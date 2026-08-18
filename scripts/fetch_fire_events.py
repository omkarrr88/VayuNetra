"""Fetch recent FIRMS thermal-anomaly detections per city → static GeoJSON.

The stubble/waste-burning layer: NASA FIRMS fire detections (via Earth
Engine) for the last N days over each city's bbox, written to
web/public/fires/{city}.geojson so the map layer works offline like the
wards and freight-corridor layers. Refresh daily from CI in season.

Usage: DEMO_MODE=false python scripts/fetch_fire_events.py [--days 30]
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

import core.env  # noqa: F401,E402

OUT_DIR = REPO / "web" / "public" / "fires"


def fetch_city(city_id: str, days: int) -> dict:
    import ee

    from core.cities import load_city

    cfg = load_city(city_id)
    w, s, e, n = cfg["bbox"]
    region = ee.Geometry.Rectangle([w, s, e, n])
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)

    col = (ee.ImageCollection("FIRMS")
           .filterBounds(region)
           .filterDate(str(start), str(end))
           .select("T21"))

    def to_points(img):
        # each FIRMS pixel above the detection threshold becomes a point
        vectors = img.gt(0).selfMask().reduceToVectors(
            geometry=region, scale=1000, geometryType="centroid",
            maxPixels=1e8, bestEffort=True)
        date = img.date().format("YYYY-MM-dd")
        return vectors.map(lambda f: f.set("date", date))

    fc = col.map(to_points).flatten()
    raw = fc.getInfo() or {}
    features = []
    seen: set[tuple] = set()
    for f in raw.get("features", []):
        geom = f.get("geometry") or {}
        if geom.get("type") != "Point":
            continue
        lng, lat = geom["coordinates"][:2]
        key = (round(lng, 3), round(lat, 3), f.get("properties", {}).get("date"))
        if key in seen:
            continue
        seen.add(key)
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lng, 5), round(lat, 5)]},
            "properties": {"date": f.get("properties", {}).get("date")},
        })
    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {"city_id": city_id, "days": days, "source": "NASA FIRMS via Earth Engine",
                 "generated": str(end)},
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--city", help="one city only (default: all)")
    args = ap.parse_args()

    from connectors.earth_engine import init
    from core.cities import list_city_ids

    init()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cities = [args.city] if args.city else list_city_ids()
    for city in cities:
        try:
            fc = fetch_city(city, args.days)
        except Exception as e:  # noqa: BLE001 — one city must not kill the batch
            print(f"{city}: FIRMS fetch failed ({type(e).__name__}: {str(e)[:80]})")
            continue
        path = OUT_DIR / f"{city}.geojson"
        path.write_text(json.dumps(fc, separators=(",", ":")))
        print(f"{city}: {len(fc['features'])} fire detections (last {args.days}d) -> {path.name}")


if __name__ == "__main__":
    main()
