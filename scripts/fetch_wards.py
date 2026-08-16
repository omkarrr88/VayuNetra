"""Fetch administrative ward boundaries per city from OSM → static GeoJSON.

The original three cities ship datameet community boundaries; new cities get
OSM administrative polygons (admin_level 9/10 — also ODbL). Output matches
what web/src/placeName.ts and the ward map layer expect:
Feature.properties = { ward_id, name }.

Usage: python scripts/fetch_wards.py --city hyderabad   (or no --city: all
cities missing a wards file)
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import requests

REPO = Path(__file__).resolve().parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

import core.env  # noqa: F401,E402
from connectors.vulnerability import OVERPASS_URLS  # noqa: E402
from core.cities import list_city_ids, load_city  # noqa: E402

OUT_DIR = REPO / "web" / "public" / "wards"


def _query(bbox: list[float], admin_level: int) -> str:
    s, w, n, e = bbox[1], bbox[0], bbox[3], bbox[2]
    return f"""
    [out:json][timeout:90];
    relation["boundary"="administrative"]["admin_level"="{admin_level}"]({s},{w},{n},{e});
    out geom;
    """


def _ring_from_members(rel: dict) -> list[list[list[float]]]:
    """Outer ways of an OSM relation → polygon rings (best-effort join)."""
    segments = []
    for m in rel.get("members", []):
        if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry"):
            segments.append([[p["lon"], p["lat"]] for p in m["geometry"]])
    if not segments:
        return []
    # join segments that share endpoints; tolerate imperfect closure
    rings: list[list[list[float]]] = []
    pool = segments[:]
    ring = pool.pop(0)
    while pool:
        extended = False
        for i, seg in enumerate(pool):
            if ring[-1] == seg[0]:
                ring += seg[1:]
            elif ring[-1] == seg[-1]:
                ring += list(reversed(seg[:-1]))
            elif ring[0] == seg[-1]:
                ring = seg[:-1] + ring
            elif ring[0] == seg[0]:
                ring = list(reversed(seg[1:])) + ring
            else:
                continue
            pool.pop(i)
            extended = True
            break
        if not extended:
            rings.append(ring)
            ring = pool.pop(0)
    rings.append(ring)
    out = []
    for r in rings:
        if len(r) >= 4:
            if r[0] != r[-1]:
                r = r + [r[0]]
            out.append(r)
    return out


def fetch_city(city_id: str) -> dict | None:
    cfg = load_city(city_id)
    for admin_level in (10, 9, 8):
        for url in OVERPASS_URLS:
            try:
                resp = requests.post(url, data={"data": _query(cfg["bbox"], admin_level)}, timeout=120,
                                     headers={"User-Agent": "VayuNetra/1.0 (air-quality research; github.com/omkarrr88/VayuNetra)"})
                resp.raise_for_status()
                elements = resp.json().get("elements", [])
            except Exception:  # noqa: BLE001 — try the next mirror
                continue
            feats = []
            for rel in elements:
                name = (rel.get("tags") or {}).get("name")
                if not name:
                    continue
                rings = _ring_from_members(rel)
                if not rings:
                    continue
                feats.append({
                    "type": "Feature",
                    "properties": {"ward_id": str(rel.get("id")), "name": name},
                    "geometry": {"type": "Polygon",
                                 "coordinates": [[[round(x, 5), round(y, 5)] for x, y in r] for r in rings[:1]]},
                })
            if len(feats) >= 5:  # a real ward map, not a stray boundary
                return {"type": "FeatureCollection", "features": feats,
                        "meta": {"source": f"OSM administrative boundaries (admin_level={admin_level}, ODbL)"}}
        time.sleep(2)
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", help="one city (default: every city missing a wards file)")
    args = ap.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cities = [args.city] if args.city else [
        c for c in list_city_ids() if not (OUT_DIR / f"{c}.geojson").exists()
    ]
    for city in cities:
        fc = fetch_city(city)
        if not fc:
            print(f"{city}: no usable admin boundaries found on OSM — Cell Story falls back to H3 ids")
            continue
        path = OUT_DIR / f"{city}.geojson"
        path.write_text(json.dumps(fc, separators=(",", ":")))
        print(f"{city}: {len(fc['features'])} wards -> {path.name} ({round(path.stat().st_size/1024)} KB)")
        time.sleep(3)


if __name__ == "__main__":
    main()
