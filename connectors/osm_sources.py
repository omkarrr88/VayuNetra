"""OSM emission-source registry connector.  Spec: PLAN §2C; PRD §11.

Replaces the hand-seeded registry with real, city-specific sites ingested from
OpenStreetMap via the free Overpass API (no key): construction zones, industrial
areas, landfills and power plants inside each city's bbox. Re-running refreshes
the registry, so sites auto-add/remove as OSM changes (cron-able).

  python -m connectors.osm_sources --city mumbai             # fetch + summary
  python -m connectors.osm_sources --city mumbai --push      # replace registry rows
  # NOTE: --push clears recs referencing OSM sources first (FK). The daily cron
  # regenerates ALL recs right after (unconditional step in ingest.yml); manual
  # equivalent: run_enforcement(city, write_to_db=True).
"""
from __future__ import annotations

import argparse
from pathlib import Path

import requests

import core.env  # noqa: F401  (loads .env)
from core.spatial.h3_utils import latlng_to_cell

CITIES_DIR = Path(__file__).resolve().parent.parent / "core" / "config" / "cities"

# Public Overpass mirrors — tried in order (each is rate-limited but keyless).
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# OSM tag -> our registry `type` (must stay within enforcement's cat_map:
# construction | industry | waste_burn | diesel_corridor).
TYPE_FOR = {
    ("landuse", "construction"): "construction",
    ("landuse", "industrial"): "industry",
    ("landuse", "landfill"): "waste_burn",
    ("power", "plant"): "industry",
}

# Honest per-type exposure heuristics (residents near a typical site) — refined
# with WorldPop population rasters in Stage 2 (E2 dense coverage).
POP_ESTIMATE = {"construction": 15000, "industry": 12000, "waste_burn": 9000}

# Keep the registry demo-sized: worklists stay readable, Overpass stays cheap.
CAP_PER_TYPE = {"construction": 8, "industry": 8, "waste_burn": 4}

# Words that signal a substantive site (vs a small shop mis-tagged industrial).
_SIGNIFICANT = (
    "industrial", "midc", "estate", "zone", "park", "refinery", "plant", "power",
    "mill", "steel", "chemical", "textile", "cidco", "sez", "complex",
    "metro", "landfill", "dumping", "factory", "works",
)

# Water/sewage infrastructure is tagged `industrial` in OSM but pollutes water,
# not air — it must never appear on a PM2.5 enforcement worklist.
_EXCLUDE = ("sewage", "sewerage", "wastewater", "waste water", "water treatment",
            "effluent", "pumping station", "stp ", " stp", "mld")


def _score(el: dict, name: str) -> int:
    """Rank OSM elements so real zones beat mis-tagged corner shops before capping."""
    tags = el.get("tags") or {}
    s = 0
    if el.get("type") in ("way", "relation"):
        s += 3  # mapped as an area — substantive site, not a point-of-interest pin
    low = name.lower()
    if any(w in low for w in _SIGNIFICANT):
        s += 2
    if "operator" in tags or "industrial" in tags:
        s += 1
    return s


def load_city(city_id: str) -> dict:
    import yaml

    return yaml.safe_load((CITIES_DIR / f"{city_id}.yml").read_text())


def _overpass_query(bbox: list[float]) -> str:
    w, s, e, n = bbox  # yml order: [min_lng, min_lat, max_lng, max_lat]
    b = f"{s},{w},{n},{e}"  # overpass order: south,west,north,east
    return (
        "[out:json][timeout:90];("
        f'nwr["landuse"="construction"]["name"]({b});'
        f'nwr["landuse"="industrial"]["name"]({b});'
        f'nwr["landuse"="landfill"]({b});'
        f'nwr["power"="plant"]["name"]({b});'
        ");out center tags;"
    )


def fetch_elements(bbox: list[float], retries: int = 4) -> list[dict]:
    """Raw Overpass elements for the bbox. 429-aware: the public mirrors allow
    ~1 concurrent slot per IP, so back off and retry rather than fail fast."""
    import time

    last = ""
    for attempt in range(retries):
        for url in OVERPASS_URLS:
            try:
                # Overpass etiquette: identify the client or get 406/429 blocked.
                resp = requests.post(
                    url,
                    data={"data": _overpass_query(bbox)},
                    headers={"User-Agent": "VayuNetra/1.0 (air-quality platform; hackathon)"},
                    timeout=120,
                )
                if resp.status_code == 200:
                    return resp.json().get("elements", [])
                last = f"HTTP {resp.status_code}"
                if resp.status_code == 429:
                    break  # rate-limited on this IP — switching mirrors won't help much; wait
            except requests.RequestException as e:
                last = type(e).__name__
        wait = 30 * (attempt + 1)
        print(f"    overpass busy ({last}); waiting {wait}s (attempt {attempt + 1}/{retries})")
        time.sleep(wait)
    raise RuntimeError(f"Overpass unreachable after {retries} rounds ({last}) — retry later")


def _latlng(el: dict) -> tuple[float | None, float | None]:
    if "lat" in el and "lon" in el:
        return el["lat"], el["lon"]
    center = el.get("center") or {}
    return center.get("lat"), center.get("lon")


def rows_from_elements(city_id: str, elements: list[dict], h3_res: int = 8) -> list[dict]:
    """Overpass elements -> canonical emission_sources rows (pure; unit-tested).

    Named elements only (unnamed landfills get a readable fallback name),
    deduped by (name, type), capped per type so the registry stays curated.
    """
    # Rank first so substantive sites win the per-type cap, then keep stable order.
    candidates: list[tuple[int, dict, str, str]] = []
    for el in elements:
        tags = el.get("tags") or {}
        stype = next(
            (t for (k, v), t in TYPE_FOR.items() if tags.get(k) == v),
            None,
        )
        if stype is None:
            continue
        lat, lng = _latlng(el)
        if lat is None or lng is None:
            continue
        name = (tags.get("name") or "").strip()
        if not name:
            if stype != "waste_burn":  # only landfills may be unnamed in OSM
                continue
            name = f"Landfill site (OSM {el.get('type', 'way')}/{el.get('id')})"
        low = f" {name.lower()} "
        if any(w in low for w in _EXCLUDE):
            continue  # water infrastructure — not an air-pollution source
        candidates.append((_score(el, name), el, stype, name))
    candidates.sort(key=lambda c: -c[0])

    rows: list[dict] = []
    seen: set[tuple[str, str]] = set()
    counts: dict[str, int] = {}
    for _, el, stype, name in candidates:
        tags = el.get("tags") or {}
        lat, lng = _latlng(el)
        key = (name.lower(), stype)
        if key in seen:
            continue
        if counts.get(stype, 0) >= CAP_PER_TYPE.get(stype, 8):
            continue
        seen.add(key)
        counts[stype] = counts.get(stype, 0) + 1
        rows.append({
            "city_id": city_id,
            "name": name,
            "type": stype,
            "registry_ref": f"osm:{el.get('type', 'way')}/{el.get('id')}",
            "source_origin": "osm",
            "detection_confidence": 0.9,
            "geom": {"type": "Point", "coordinates": [round(float(lng), 6), round(float(lat), 6)]},
            "attributes": {
                "h3_cell": latlng_to_cell(float(lat), float(lng), h3_res),
                "pop_exposed_estimate": POP_ESTIMATE.get(stype, 5000),
                "osm_tags": {k: tags[k] for k in ("landuse", "power", "operator", "industrial") if k in tags},
            },
        })
    return rows


def push_to_supabase(city_id: str, rows: list[dict]) -> None:
    """Replace the city's registry. FK order: enforcement_recs reference sources,
    so recs pointing at OSM rows are cleared first — regenerate via bootstrap_live."""
    from core.supa import client

    db = client()
    # Scope the FK clear to recs that reference OSM-origin sources only.
    # The old blanket delete wiped every rec (incl. cv_detected-backed ones);
    # combined with the pipeline's spike gate skipping enforcement on calm
    # days, that left the live worklist empty until the next spike.
    # (Row-count note: OSM sources are capped at ~20/city by CAP_PER_TYPE, far
    # under the REST client's 1000-row page — no pagination needed here.)
    osm_ids = [
        r["id"] for r in (
            db.table("emission_sources").select("id")
            .eq("city_id", city_id).eq("source_origin", "osm").execute().data or []
        )
    ]
    if osm_ids:
        db.table("enforcement_recs").delete().eq("city_id", city_id).in_("source_id", osm_ids).execute()
    # Replace ONLY OSM-origin rows: the daily refresh was wiping the E1
    # cv_detected rows (and any registry rows) along with its own.
    db.table("emission_sources").delete().eq("city_id", city_id).eq("source_origin", "osm").execute()
    try:
        db.table("emission_sources").insert(rows).execute()
    except Exception:  # noqa: BLE001 — PostGIS/GeoJSON casting can differ per setup
        stripped = [{k: v for k, v in r.items() if k != "geom"} for r in rows]
        db.table("emission_sources").insert(stripped).execute()
    print(f"{city_id}: replaced registry with {len(rows)} OSM sources "
          f"(cleared recs referencing {len(osm_ids)} OSM sources — the cron regenerates recs right after)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--from-file", help="parse a saved Overpass JSON instead of fetching")
    args = ap.parse_args()

    cfg = load_city(args.city)
    if args.from_file:
        import json

        elements = json.loads(Path(args.from_file).read_text()).get("elements", [])
    else:
        try:
            elements = fetch_elements(cfg["bbox"])
        except RuntimeError as e:
            print(f"⚠ {e}")
            return
    rows = rows_from_elements(args.city, elements, cfg.get("h3_res", 8))
    by_type: dict[str, int] = {}
    for r in rows:
        by_type[r["type"]] = by_type.get(r["type"], 0) + 1
    print(f"{args.city}: {len(elements)} OSM elements -> {len(rows)} registry rows {by_type}")
    for r in rows:
        print(f"  {r['type']:14s} {r['name'][:60]}")
    if args.push:
        push_to_supabase(args.city, rows)


if __name__ == "__main__":
    main()
