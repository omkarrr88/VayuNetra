"""Run E1 CV inference via detection-lite v0 heuristics (Earth Engine).

The trained CNN weights were mock/synthetic (Kaggle artifact), so on real S2 tiles
they predictably produce 0 detections. We honestly fallback to detection-lite v0:
- NDVI drop (Sentinel-2) -> construction/bare soil.
- Thermal anomaly (FIRMS) -> waste burning.

Usage:  python scripts/run_e1_inference_live.py --city delhi --push
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone

REPO = Path(__file__).resolve().parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

import core.env  # noqa: F401


def get_heuristic_detections(city_id: str, days: int = 90) -> list[dict]:
    import ee
    import yaml
    import h3
    from connectors.earth_engine import init
    from core.spatial.h3_utils import latlng_to_cell, cell_to_latlng

    init()
    cfg = yaml.safe_load((REPO / "core/config/cities" / f"{city_id}.yml").read_text())
    lng, lat = cfg["center"]
    center = latlng_to_cell(lat, lng, 8)
    cells = list(h3.grid_disk(center, 12)) # 12 rings ~ 10km radius
    if not cells:
        return []

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    end_str = end.strftime("%Y-%m-%d")
    start_str = start.strftime("%Y-%m-%d")

    # FIRMS: Active fire count in the last 30 days > 0 -> waste_burn
    firms = ee.ImageCollection("FIRMS").select("T21").filterDate(start_str, end_str).count().unmask(0)

    # S2: NDVI drop from 6 months ago -> construction
    s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
    s2_recent = s2.filterDate(start_str, end_str).median()
    
    # 6 months ago
    past_end = start - timedelta(days=120)
    past_start = past_end - timedelta(days=60)
    s2_past = s2.filterDate(past_start.strftime("%Y-%m-%d"), past_end.strftime("%Y-%m-%d")).median()
    
    ndvi_recent = s2_recent.normalizedDifference(["B8", "B4"])
    ndvi_past = s2_past.normalizedDifference(["B8", "B4"])
    ndvi_drop = ndvi_past.subtract(ndvi_recent).unmask(0)

    # Convert cells to Features
    feats = []
    for cell in cells:
        lat, lng = cell_to_latlng(cell)
        feats.append(ee.Feature(ee.Geometry.Point([lng, lat]), {"cell": cell}))
    fc = ee.FeatureCollection(feats)

    # Sample FIRMS and NDVI drop
    sampled_firms = firms.reduceRegions(collection=fc, reducer=ee.Reducer.mean(), scale=1000).getInfo()
    sampled_ndvi = ndvi_drop.reduceRegions(collection=fc, reducer=ee.Reducer.mean(), scale=100).getInfo()

    cell_to_firms = {f["properties"]["cell"]: f["properties"].get("mean", 0) for f in sampled_firms["features"]}
    cell_to_ndvi = {f["properties"]["cell"]: f["properties"].get("mean", 0) for f in sampled_ndvi["features"]}

    rows = []
    idx = 1
    for cell in cells:
        f_count = cell_to_firms.get(cell, 0)
        n_drop = cell_to_ndvi.get(cell, 0)
        lat, lng = cell_to_latlng(cell)

        # Logic for detection
        detected_type = None
        conf = 0.0
        pop = 9000
        if f_count and f_count > 0:
            detected_type = "waste_burn"
            conf = min(0.7 + (f_count * 0.05), 0.95)
            pop = 9000
        elif n_drop and n_drop > 0.05:
            detected_type = "construction"
            conf = min(0.6 + (n_drop * 1.5), 0.90)
            pop = 15000

        if detected_type:
            rows.append({
                "city_id": city_id,
                "name": f"Satellite-detected {detected_type.replace('_', ' ')} site #{idx}",
                "type": detected_type,
                "registry_ref": f"e1_cv:{city_id}:{idx}",
                "source_origin": "cv_detected",
                "detection_confidence": round(conf, 3),
                "geom": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]},
                "attributes": {
                    "h3_cell": cell,
                    "pop_exposed_estimate": pop,
                    "model": "detection-lite v0 (EE heuristic)",
                },
            })
            idx += 1

    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    rows = get_heuristic_detections(args.city)
    print(f"{args.city}: {len(rows)} detections from EE heuristics")
    if len(rows) == 0:
        return
    
    for r in rows[:5]:
        print(f"   {r['type']:13s} conf={r['detection_confidence']} @ {r['geom']['coordinates']}")
        
    if args.push:
        from core.supa import client
        db = client()
        db.table("emission_sources").delete().eq("city_id", args.city).eq("source_origin", "cv_detected").execute()
        db.table("emission_sources").insert(rows).execute()
        print(f"{args.city}: wrote {len(rows)} cv_detected rows")


if __name__ == "__main__":
    main()
