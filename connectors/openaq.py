"""OpenAQ ground-AQI connector (v3).  Spec: ARCHITECTURE.md §7.1; PRD §11.

Pulls real station PM2.5/PM10/NO2/SO2/CO/O3 (hourly history) near a city, maps each
station to its H3 cell, and writes canonical `measurements`. This is what turns the
forecast skill score into a *real* number (it replaces the synthetic seed target).

Needs a free key:  OPENAQ_API_KEY in .env  (sign up at https://openaq.org).

  python -m connectors.openaq --city delhi --days 14            # fetch + summary
  python -m connectors.openaq --city delhi --days 14 --push     # insert into Supabase
"""
from __future__ import annotations

import argparse
import os
import time
from pathlib import Path

import requests

import core.env  # noqa: F401  (loads .env)
from core.spatial.h3_utils import latlng_to_cell

BASE = "https://api.openaq.org/v3"
CITIES_DIR = Path(__file__).resolve().parent.parent / "core" / "config" / "cities"

# OpenAQ parameter name -> our canonical variable
PARAM_MAP = {"pm25": "pm25", "pm10": "pm10", "no2": "no2", "so2": "so2", "co": "co", "o3": "o3"}


def load_city(city_id: str) -> dict:
    import yaml

    return yaml.safe_load((CITIES_DIR / f"{city_id}.yml").read_text())


def rows_from_records(city_id: str, records: list[dict], h3_res: int = 8) -> list[dict]:
    """Normalised records -> canonical measurement rows (pure; unit-tested).

    Each record: {lat, lng, variable, value, unit, ts, station_id}.
    Records whose variable isn't one of our pollutants are skipped.
    """
    rows: list[dict] = []
    for r in records:
        if r.get("variable") not in PARAM_MAP.values():
            continue
        if r.get("value") is None or r.get("lat") is None or r.get("lng") is None:
            continue
        rows.append({
            "city_id": city_id,
            "h3_cell": latlng_to_cell(float(r["lat"]), float(r["lng"]), h3_res),
            "station_id": r.get("station_id"),
            "ts": r["ts"],
            "variable": r["variable"],
            "value": float(r["value"]),
            "unit": r.get("unit"),
            "source": "openaq",
            "confidence": 1.0,
        })
    return rows


# --- OpenAQ v3 HTTP (throttled + 429-aware; free tier ~60 req/min) ---------
MIN_INTERVAL_S = 1.2          # space requests to stay under the per-minute limit
_last_call = [0.0]


def _throttle() -> None:
    gap = time.monotonic() - _last_call[0]
    if gap < MIN_INTERVAL_S:
        time.sleep(MIN_INTERVAL_S - gap)
    _last_call[0] = time.monotonic()


def _get(path: str, params: dict, retries: int = 5) -> dict:
    key = os.environ.get("OPENAQ_API_KEY")
    if not key:
        raise RuntimeError("OPENAQ_API_KEY missing in .env — sign up at https://openaq.org")
    headers = {"X-API-Key": key.strip()}
    for attempt in range(retries):
        _throttle()
        resp = requests.get(f"{BASE}{path}", params=params, headers=headers, timeout=30)
        if resp.status_code == 429:                       # rate limited -> back off
            wait = float(resp.headers.get("Retry-After") or 0) or min(60, 2 ** attempt * 3)
            print(f"    429 rate-limited; waiting {wait:.0f}s (attempt {attempt + 1}/{retries})")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError(f"OpenAQ still rate-limiting after {retries} retries: {path}")


def find_sensors(lat: float, lng: float, radius_m: int = 25000) -> list[dict]:
    """Sensors for our pollutants at stations within `radius_m` of the city centre."""
    data = _get("/locations", {"coordinates": f"{lat},{lng}", "radius": radius_m, "limit": 100})
    sensors: list[dict] = []
    for loc in data.get("results", []):
        coords = loc.get("coordinates") or {}
        last = (loc.get("datetimeLast") or {}).get("utc")   # station recency
        for s in loc.get("sensors", []):
            pname = (s.get("parameter") or {}).get("name")
            if pname in PARAM_MAP:
                sensors.append({
                    "sensor_id": s["id"],
                    "variable": PARAM_MAP[pname],
                    "unit": (s.get("parameter") or {}).get("units"),
                    "lat": coords.get("latitude"),
                    "lng": coords.get("longitude"),
                    "station_id": str(loc.get("id")),
                    "last": last,
                })
    return sensors


def fetch_sensor_hourly(
    sensor: dict, datetime_from: str, datetime_to: str | None = None, max_pages: int = 12
) -> list[dict]:
    """Hourly history for one sensor over [datetime_from, datetime_to) -> normalised records."""
    records: list[dict] = []
    for page in range(1, max_pages + 1):
        params = {"datetime_from": datetime_from, "limit": 1000, "page": page}
        if datetime_to:
            params["datetime_to"] = datetime_to
        data = _get(f"/sensors/{sensor['sensor_id']}/measurements/hourly", params)
        results = data.get("results", [])
        for m in results:
            period = (m.get("period") or {}).get("datetimeFrom") or {}
            records.append({
                "lat": sensor["lat"], "lng": sensor["lng"],
                "variable": sensor["variable"],
                "value": m.get("value"),
                "unit": sensor["unit"],
                "ts": period.get("utc"),
                "station_id": sensor["station_id"],
            })
        if len(results) < 1000:
            break
    return records


def fetch_city(
    city_id: str, days: int = 14, max_sensors: int = 40,
    date_from: str | None = None, date_to: str | None = None,
    only_vars: list[str] | None = None,
) -> list[dict]:
    from datetime import datetime, timedelta, timezone

    cfg = load_city(city_id)
    lng, lat = cfg["center"]
    since = date_from or (datetime.now(timezone.utc) - timedelta(days=days)).replace(microsecond=0).isoformat()

    sensors = find_sensors(lat, lng)
    # A backfill usually wants one pollutant across the whole window, not the fullest station.
    # Without this filter the sensor cap is spent on whichever pollutants happen to sort first.
    if only_vars:
        want = {v.lower() for v in only_vars}
        sensors = [s for s in sensors if s["variable"] in want]
        print(f"  filtered to {sorted(want)}: {len(sensors)} sensors")
    # most-recently-active stations first -> active stations bring their full pollutant set
    sensors.sort(key=lambda s: s.get("last") or "", reverse=True)
    if len(sensors) > max_sensors:
        print(f"  found {len(sensors)} sensors; capping to {max_sensors} (raise with --max-sensors)")
        sensors = sensors[:max_sensors]
    window = f"{since[:10]}..{(date_to[:10] if date_to else 'now')}"
    print(f"  fetching {len(sensors)} sensors hourly {window} (throttled ~{MIN_INTERVAL_S}s/req)...")

    records: list[dict] = []
    for i, sensor in enumerate(sensors, 1):
        recs = fetch_sensor_hourly(sensor, since, date_to)
        records.extend(recs)
        print(f"    [{i}/{len(sensors)}] {sensor['variable']:5s} sensor {sensor['sensor_id']}: {len(recs)} pts")
    return rows_from_records(city_id, records, cfg.get("h3_res", 8))


def push_to_supabase(rows: list[dict]) -> None:
    from core.supa import client

    from core.supa import insert_measurements

    insert_measurements(rows, client())
    print(f"pushed {len(rows)} OpenAQ measurements to Supabase (duplicates ignored)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument("--max-sensors", type=int, default=40)
    ap.add_argument("--from", dest="date_from", help="ISO start, e.g. 2025-10-01")
    ap.add_argument("--vars", dest="only_vars", help="comma-separated pollutants to fetch, e.g. pm25,pm10")
    ap.add_argument("--to", dest="date_to", help="ISO end, e.g. 2026-01-31")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    rows = fetch_city(args.city, args.days, args.max_sensors, args.date_from, args.date_to,
                      [v.strip() for v in args.only_vars.split(",")] if args.only_vars else None)
    cells = {r["h3_cell"] for r in rows}
    variables = sorted({r["variable"] for r in rows})
    print(f"{args.city}: {len(rows)} rows · {len(cells)} cells · vars {variables}")
    if args.push:
        push_to_supabase(rows)


if __name__ == "__main__":
    main()
