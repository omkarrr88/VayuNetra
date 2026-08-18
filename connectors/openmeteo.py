"""Open-Meteo weather connector.  Spec: ARCHITECTURE.md §7.1, §9.2; PRD §11.

Free, no API key. Pulls hourly met variables (the forecast model's drivers) for a city,
converts to canonical `measurements`, and (optionally) pushes to Supabase.

  python -m connectors.openmeteo --city delhi              # fetch + print summary
  python -m connectors.openmeteo --city delhi --push       # also insert into Supabase
"""
from __future__ import annotations

import argparse
import math
from datetime import datetime, timezone
from pathlib import Path

import requests

import core.env  # noqa: F401  (loads .env)
from core.spatial.h3_utils import latlng_to_cell

API_URL = "https://api.open-meteo.com/v1/forecast"
CITIES_DIR = Path(__file__).resolve().parent.parent / "core" / "config" / "cities"

# Open-Meteo hourly field -> (canonical variable, unit). wind is handled separately.
FIELD_MAP = {
    "temperature_2m": ("temp", "degC"),
    "relative_humidity_2m": ("rh", "%"),
    "precipitation": ("precip", "mm"),
    "boundary_layer_height": ("blh", "m"),
}
HOURLY = list(FIELD_MAP) + ["wind_speed_10m", "wind_direction_10m"]


def load_city(city_id: str) -> dict:
    import yaml

    cfg = yaml.safe_load((CITIES_DIR / f"{city_id}.yml").read_text())
    return cfg


def wind_uv(speed_ms: float, dir_deg: float) -> tuple[float, float]:
    """Meteorological wind (speed m/s, direction FROM) -> (u eastward, v northward) m/s."""
    rad = math.radians(dir_deg)
    u = -speed_ms * math.sin(rad)
    v = -speed_ms * math.cos(rad)
    return u, v


def fetch_hourly(lat: float, lng: float, past_days: int = 3, forecast_days: int = 2) -> dict:
    """Raw hourly payload from Open-Meteo (UTC, wind in m/s)."""
    resp = requests.get(
        API_URL,
        params={
            "latitude": lat,
            "longitude": lng,
            "hourly": ",".join(HOURLY),
            "wind_speed_unit": "ms",
            "timezone": "GMT",
            "past_days": past_days,
            "forecast_days": forecast_days,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["hourly"]


def fetch_hourly_archive(lat: float, lng: float, start_date: str, end_date: str) -> dict:
    """Historical hourly weather (ERA5 archive) — for windows older/longer than the 92-day forecast API."""
    resp = requests.get(
        "https://archive-api.open-meteo.com/v1/archive",
        params={
            "latitude": lat, "longitude": lng, "hourly": ",".join(HOURLY),
            "wind_speed_unit": "ms", "timezone": "GMT",
            "start_date": start_date, "end_date": end_date,
        },
        timeout=90,
    )
    resp.raise_for_status()
    return resp.json()["hourly"]


def build_measurements(city_id: str, h3_cell: str, hourly: dict) -> list[dict]:
    """Open-Meteo hourly payload -> canonical measurement rows."""
    rows: list[dict] = []
    times = hourly["time"]
    for i, t in enumerate(times):
        ts = datetime.fromisoformat(t).replace(tzinfo=timezone.utc).isoformat()

        # scalar met variables
        for field, (variable, unit) in FIELD_MAP.items():
            val = hourly.get(field, [None] * len(times))[i]
            if val is None:
                continue
            rows.append(_row(city_id, h3_cell, ts, variable, float(val), unit))

        # wind speed/dir -> u/v components
        spd = hourly.get("wind_speed_10m", [None] * len(times))[i]
        wdir = hourly.get("wind_direction_10m", [None] * len(times))[i]
        if spd is not None and wdir is not None:
            u, v = wind_uv(float(spd), float(wdir))
            rows.append(_row(city_id, h3_cell, ts, "wind_u", round(u, 3), "m/s"))
            rows.append(_row(city_id, h3_cell, ts, "wind_v", round(v, 3), "m/s"))
    return rows


def _row(city_id: str, h3_cell: str, ts: str, variable: str, value: float, unit: str) -> dict:
    return {
        "city_id": city_id, "h3_cell": h3_cell, "station_id": None, "ts": ts,
        "variable": variable, "value": value, "unit": unit,
        "source": "openmeteo", "confidence": 1.0,
    }


def fetch_city(
    city_id: str, past_days: int = 3, forecast_days: int = 2,
    start: str | None = None, end: str | None = None,
) -> list[dict]:
    cfg = load_city(city_id)
    lng, lat = cfg["center"]  # YAML stores [lng, lat]
    cell = latlng_to_cell(lat, lng, cfg.get("h3_res", 8))
    if start and end:
        hourly = fetch_hourly_archive(lat, lng, start, end)
    else:
        hourly = fetch_hourly(lat, lng, past_days, forecast_days)
    return build_measurements(city_id, cell, hourly)


def push_to_supabase(rows: list[dict]) -> None:
    from core.supa import client

    from core.supa import insert_measurements

    insert_measurements(rows, client())
    print(f"pushed {len(rows)} weather measurements to Supabase (duplicates ignored)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--past-days", type=int, default=3)
    ap.add_argument("--forecast-days", type=int, default=2)
    ap.add_argument("--start", help="archive start ISO date, e.g. 2025-10-01")
    ap.add_argument("--end", help="archive end ISO date, e.g. 2026-01-31")
    ap.add_argument("--push", action="store_true", help="insert into Supabase")
    args = ap.parse_args()

    rows = fetch_city(args.city, args.past_days, args.forecast_days, args.start, args.end)
    variables = sorted({r["variable"] for r in rows})
    print(f"{args.city}: {len(rows)} rows across {len(variables)} variables {variables}")
    if args.push:
        push_to_supabase(rows)


if __name__ == "__main__":
    main()
