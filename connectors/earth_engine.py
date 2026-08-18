"""Earth Engine connector (satellite features).  ARCHITECTURE.md §7.1, §9.

Samples Sentinel-5P tropospheric NO2 (a recent-window mean) at the city's H3 cells and
writes canonical `measurements` (variable='no2_sat', unit mol/m^2, source='s5p') — the
satellite half of the satellite-ground fusion. Stored as a distinct variable so it never
clashes with ground NO2 (different units/meaning).

Auth needs the registered service account with Earth Engine + Service Usage Consumer roles.

  python -m connectors.earth_engine --check               # confirm auth + data availability
  python -m connectors.earth_engine --city delhi          # sample + summary
  python -m connectors.earth_engine --city delhi --push    # also insert into Supabase
"""
from __future__ import annotations

import argparse
import os
from datetime import datetime, timedelta, timezone

import ee

import core.env  # noqa: F401  (loads .env)
from core.spatial.h3_utils import cell_to_latlng
from core.supa import client, load_measurements

GEE_SERVICE_ACCOUNT = os.getenv("GEE_SERVICE_ACCOUNT", "")
GEE_KEY_JSON = os.getenv("GEE_KEY_JSON", "./gee-key.json")
GEE_PROJECT = os.getenv("GEE_PROJECT", "")

S5P_NO2 = "COPERNICUS/S5P/OFFL/L3_NO2"
NO2_BAND = "tropospheric_NO2_column_number_density"
FIRMS = "FIRMS"            # MODIS/VIIRS active-fire detections
FIRE_BAND = "T21"


def init() -> None:
    if not (GEE_SERVICE_ACCOUNT and GEE_PROJECT):
        raise RuntimeError("Set GEE_SERVICE_ACCOUNT and GEE_PROJECT in .env")
    creds = ee.ServiceAccountCredentials(GEE_SERVICE_ACCOUNT, GEE_KEY_JSON)
    ee.Initialize(creds, project=GEE_PROJECT)


def city_cells(city_id: str) -> list[str]:
    """Distinct H3 cells we already hold ground data for in this city."""
    rows = load_measurements(city_id)
    return sorted({r["h3_cell"] for r in rows if r.get("h3_cell")})


def sample_no2_at_cells(city_id: str, cells: list[str], start: str, end: str) -> list[dict]:
    """Mean S5P NO2 over [start, end) sampled at each H3 cell centre -> canonical rows."""
    img = ee.ImageCollection(S5P_NO2).select(NO2_BAND).filterDate(start, end).mean()
    feats = []
    for cell in cells:
        lat, lng = cell_to_latlng(cell)
        feats.append(ee.Feature(ee.Geometry.Point([lng, lat]), {"cell": cell}))
    sampled = img.reduceRegions(
        collection=ee.FeatureCollection(feats), reducer=ee.Reducer.mean(), scale=1113
    ).getInfo()

    ts = end + "T00:00:00+00:00"
    rows: list[dict] = []
    for f in sampled["features"]:
        val = f["properties"].get("mean")
        if val is None:
            continue
        rows.append({
            "city_id": city_id, "h3_cell": f["properties"]["cell"], "station_id": None,
            "ts": ts, "variable": "no2_sat", "value": float(val), "unit": "mol/m2",
            "source": "s5p", "confidence": 1.0,
        })
    return rows


def _cell_points(cells: list[str]) -> list:
    return [ee.Feature(ee.Geometry.Point([lng, lat]), {"cell": cell})
            for cell in cells for lat, lng in [cell_to_latlng(cell)]]


def sample_fire_at_cells(city_id: str, cells: list[str], start: str, end: str) -> list[dict]:
    """Active-fire detection count over [start, end) per H3 cell (biomass-burning signal)."""
    img = ee.ImageCollection(FIRMS).select(FIRE_BAND).filterDate(start, end).count().unmask(0)
    sampled = img.reduceRegions(
        collection=ee.FeatureCollection(_cell_points(cells)), reducer=ee.Reducer.mean(), scale=1000
    ).getInfo()
    ts = end + "T00:00:00+00:00"
    return [{
        "city_id": city_id, "h3_cell": f["properties"]["cell"], "station_id": None,
        "ts": ts, "variable": "fire", "value": float(f["properties"].get("mean") or 0.0),
        "unit": "count", "source": "modis", "confidence": 1.0,
    } for f in sampled["features"]]


def run(city_id: str, days: int = 30, push: bool = False,
        start: str | None = None, end: str | None = None) -> None:
    init()
    cells = city_cells(city_id)
    now = datetime.now(timezone.utc)
    start = start or (now - timedelta(days=days)).strftime("%Y-%m-%d")
    end = end or now.strftime("%Y-%m-%d")
    no2 = sample_no2_at_cells(city_id, cells, start, end)
    fire = sample_fire_at_cells(city_id, cells, start, end)
    print(f"{city_id}: {len(cells)} cells -> {len(no2)} NO2 + {len(fire)} fire rows ({start}..{end})")
    if push:
        c = client()
        c.table("measurements").delete().eq("city_id", city_id).in_("source", ["s5p", "modis"]).execute()
        from core.supa import insert_measurements

        if no2:
            insert_measurements(no2, c)
        if fire:
            insert_measurements(fire, c)
        print(f"pushed {len(no2) + len(fire)} satellite measurements to Supabase")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--start", help="window start ISO date (e.g. 2025-10-01)")
    ap.add_argument("--end", help="window end ISO date (e.g. 2026-01-31)")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--check", action="store_true", help="just confirm auth + image count")
    args = ap.parse_args()

    if args.check:
        init()
        delhi = ee.Geometry.Rectangle([76.84, 28.40, 77.35, 28.88])
        end = datetime.now(timezone.utc)
        start = (end - timedelta(days=30)).strftime("%Y-%m-%d")
        n = (
            ee.ImageCollection(S5P_NO2)
            .filterDate(start, end.strftime("%Y-%m-%d")).filterBounds(delhi).size().getInfo()
        )
        print(f"EE OK ✓ — {n} Sentinel-5P NO2 images over Delhi in last 30d")
        return

    run(args.city, args.days, args.push, args.start, args.end)


if __name__ == "__main__":
    main()
