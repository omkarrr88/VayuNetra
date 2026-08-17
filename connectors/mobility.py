"""GTFS/OSM traffic proxy for the Stage-1 mobility feed.

Real-time traffic APIs are paid or fragile. This connector creates a transparent,
repeatable proxy from OSM-style road weights + hour/day multipliers and writes canonical
`measurements` rows with variable='traffic', source='osm_gtfs'.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from core.spatial.h3_utils import latlng_to_cell

from .static_layers import build_static_layers


def time_multiplier(ts: datetime) -> float:
    hour = ts.hour
    weekday = ts.weekday() < 5
    if weekday and 7 <= hour <= 10:
        return 1.35
    if weekday and 17 <= hour <= 21:
        return 1.45
    if not weekday and 11 <= hour <= 20:
        return 0.90
    if 0 <= hour <= 5:
        return 0.35
    return 0.72 if weekday else 0.55


def midpoint(line: list[list[float]]) -> tuple[float, float]:
    lng = sum(p[0] for p in line) / len(line)
    lat = sum(p[1] for p in line) / len(line)
    return lat, lng


def live_scale(city_id: str) -> tuple[float, str]:
    """(multiplier, source label) — real TomTom congestion when a key is set.

    Free-flow scales the proxy down, standstill scales it up; without a key
    (or coverage) the proxy passes through unchanged and says so in `source`.
    """
    try:
        from connectors.traffic_live import city_congestion

        live = city_congestion(city_id)
    except Exception:  # noqa: BLE001 — live feed must never break the cron
        live = None
    if not live:
        return 1.0, "osm_gtfs"
    return 0.6 + 0.8 * float(live["congestion_ratio"]), "osm_gtfs×tomtom_live"


def build_mobility_rows(city_id: str, hours: int = 24, start: datetime | None = None) -> list[dict]:
    layer = build_static_layers(city_id)
    start = start or datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    rows: list[dict] = []
    scale, src = live_scale(city_id)
    for step in range(hours):
        ts = start + timedelta(hours=step)
        tm = time_multiplier(ts) * scale
        for road in layer["roads"]:
            lat, lng = midpoint(road["coordinates"])
            value = round(100.0 * road["traffic_weight"] * tm, 2)
            rows.append({
                "city_id": city_id,
                "h3_cell": latlng_to_cell(lat, lng, 8),
                "station_id": road["road_id"],
                "ts": ts.isoformat(),
                "variable": "traffic",
                "value": value,
                "unit": "index",
                "source": src,
                "confidence": 0.72,
            })
    return rows


def push_to_supabase(rows: list[dict]) -> None:
    from core.supa import client

    c = client()
    for i in range(0, len(rows), 500):
        c.table("measurements").insert(rows[i : i + 500]).execute()
    print(f"pushed {len(rows)} mobility measurements")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--hours", type=int, default=24)
    ap.add_argument("--out", help="write JSON fixture")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    rows = build_mobility_rows(args.city, args.hours)
    if args.out:
        Path(args.out).write_text(json.dumps(rows, indent=2))
        print(f"wrote {len(rows)} rows -> {args.out}")
    else:
        print(f"{args.city}: {len(rows)} mobility rows, {len({r['h3_cell'] for r in rows})} cells")
    if args.push:
        push_to_supabase(rows)


if __name__ == "__main__":
    main()
