"""Real diesel-freight corridors from OSM — motorway/trunk ways per city.

The PS lists "diesel fleet movement" as a correlatable source. No public fleet
GPS exists, so this is the honest corridor-level layer: the actual roads heavy
freight runs on (OSM motorway/trunk), with the real Delhi truck entry window
(23:00-07:00, CAQM/MCD rule) carried as metadata. Output goes to
web/public/corridors/{city}.geojson — a static map layer, like the ward files.

  python -m scripts.fetch_freight_corridors            # all three cities
"""
from __future__ import annotations

import json
from pathlib import Path

import core.env  # noqa: F401
from connectors.vulnerability import OVERPASS_URLS, load_city

import requests

OUT_DIR = Path(__file__).resolve().parent.parent / "web" / "public" / "corridors"

# Real policy metadata per city (cited in the UI tooltip).
ENTRY_WINDOW = {
    "delhi": "truck entry 23:00-07:00 (CAQM/MCD rule)",
    "bengaluru": "HGV restrictions on select corridors (BTP)",
    "mumbai": "day-time heavy-vehicle bans on select roads (MTP)",
}


def _query(bbox: list[float]) -> str:
    w, s, e, n = bbox
    return (
        "[out:json][timeout:120];"
        f'way["highway"~"^(motorway|trunk)$"]({s},{w},{n},{e});'
        "out geom tags;"
    )


def fetch(city_id: str) -> dict:
    cfg = load_city(city_id)
    elements: list[dict] = []
    last = ""
    for url in OVERPASS_URLS:
        try:
            resp = requests.post(
                url,
                data={"data": _query(cfg["bbox"])},
                headers={"User-Agent": "VayuNetra/1.0 (air-quality platform; hackathon)"},
                timeout=180,
            )
            if resp.status_code == 200:
                elements = resp.json().get("elements", [])
                break
            last = f"HTTP {resp.status_code}"
        except requests.RequestException as e:
            last = type(e).__name__
    if not elements:
        raise RuntimeError(f"Overpass unreachable for {city_id} ({last})")

    feats = []
    for el in elements:
        geom = el.get("geometry") or []
        if len(geom) < 2:
            continue
        coords = [[round(p["lon"], 5), round(p["lat"], 5)] for p in geom]
        tags = el.get("tags") or {}
        feats.append({
            "type": "Feature",
            "properties": {
                "name": tags.get("name") or tags.get("ref") or "freight corridor",
                "highway": tags.get("highway"),
                "policy": ENTRY_WINDOW.get(city_id, ""),
            },
            "geometry": {"type": "LineString", "coordinates": coords},
        })
    return {"type": "FeatureCollection", "features": feats}


def main() -> None:
    from core.cities import list_city_ids

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for city in list_city_ids():
        fc = fetch(city)
        p = OUT_DIR / f"{city}.geojson"
        p.write_text(json.dumps(fc, separators=(",", ":")))
        print(f"{city}: {len(fc['features'])} corridor segments -> {p.name} "
              f"({round(p.stat().st_size / 1024)} KB)")


if __name__ == "__main__":
    main()
