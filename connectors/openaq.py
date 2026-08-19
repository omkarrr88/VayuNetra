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


def find_sensors(bbox: list[float] | None = None, lat: float | None = None,
                 lng: float | None = None, radius_m: int = 25000) -> list[dict]:
    """Sensors for our pollutants at every station inside the city.

    Queried by BBOX, not by a circle around the city centre, which is what this used to do.

    `center` in the city config is where the MAP opens — a recognisable downtown point, not the
    middle of the city's extent — so a circle around it skews the station set. Delhi was the worst
    case: its display centre sits 11.7 km east of the bbox centre, so a 25 km circle stopped 11 km
    short of western Delhi (which has stations we were therefore never ingesting) while reaching
    11 km past the eastern edge into the NCR (whose stations we were ingesting as Delhi). On the
    winter map that reads exactly as it is: an empty west, and hexagons outside the boundary east.
    Six of the ten cities were not fully covered by a fixed 25 km radius.

    Widening the circle is not an option — OpenAQ rejects a radius above 25 km — but /locations
    accepts a bbox, which is both exact and simpler. For Delhi it returns 98 stations against the
    circle's 69, including four in the west that the circle could not reach, and none outside the
    city at all.

    The lat/lng/radius form is kept for callers that genuinely want a circle.
    """
    if bbox is not None:
        params = {"bbox": ",".join(str(v) for v in bbox), "limit": 100}
    else:
        params = {"coordinates": f"{lat},{lng}", "radius": radius_m, "limit": 100}
    data = _get("/locations", params)
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
    only_vars: list[str] | None = None, per_var: int | None = None,
) -> list[dict]:
    from datetime import datetime, timedelta, timezone

    cfg = load_city(city_id)
    since = date_from or (datetime.now(timezone.utc) - timedelta(days=days)).replace(microsecond=0).isoformat()

    sensors = find_sensors(bbox=cfg["bbox"])
    print(f"  discovery: every station inside {cfg['bbox']}")
    # A backfill usually wants one pollutant across the whole window, not the fullest station.
    # Without this filter the sensor cap is spent on whichever pollutants happen to sort first.
    if only_vars:
        want = {v.lower() for v in only_vars}
        sensors = [s for s in sensors if s["variable"] in want]
        print(f"  filtered to {sorted(want)}: {len(sensors)} sensors")
    # most-recently-active stations first -> active stations bring their full pollutant set
    sensors.sort(key=lambda s: s.get("last") or "", reverse=True)

    # Allocate the budget PER POLLUTANT, not as a global top-N.
    #
    # Delhi has ~740 sensors within 25 km, ~95 of them active per pollutant. Taking the 15
    # most-recent overall gave PM2.5 five stations and every gas exactly one — so a single sensor
    # decided the city's headline index whenever PM10 or NO2 was the prominent pollutant. An even
    # split guarantees each pollutant is a mean over several stations, which is what "city mean"
    # is supposed to mean.
    # ...and SPREAD the quota over the city, instead of spending it on whichever sensors happen to
    # have reported most recently.
    #
    # Recency correlates with nothing spatial. In Delhi it put all six PM2.5 slots inside a narrow
    # central band — two of them at the same station — while 34 actively-reporting sensors in the
    # west sat unused, the most recent of them ranked 43rd. A "city mean" drawn from one part of the
    # city is not a city mean, and on the map it showed as an empty western third.
    #
    # So: one sensor per station first (a second sensor at the same site adds no coverage), then
    # fill the quota round-robin across a coarse 3x3 grid of the bbox, taking the most recent
    # unused sensor from each sector in turn. Where a sector has no station the others absorb its
    # share, so a city with genuinely one-sided monitoring still fills its budget.
    def _sector(sn: dict) -> tuple[int, int]:
        lng0, lat0, lng1, lat1 = cfg["bbox"]
        la, lo = sn.get("lat"), sn.get("lng")
        if la is None or lo is None:
            return (-1, -1)
        fx = min(2, max(0, int((lo - lng0) / max(1e-9, lng1 - lng0) * 3)))
        fy = min(2, max(0, int((la - lat0) / max(1e-9, lat1 - lat0) * 3)))
        return (fx, fy)

    def _spread(cands: list[dict], n: int) -> list[dict]:
        seen_station: set[str] = set()
        uniq = []
        for sn in cands:                       # cands already sorted most-recent-first
            sid = str(sn.get("station_id"))
            if sid in seen_station:
                continue
            seen_station.add(sid)
            uniq.append(sn)
        buckets: dict[tuple[int, int], list[dict]] = {}
        for sn in uniq:
            buckets.setdefault(_sector(sn), []).append(sn)
        out: list[dict] = []
        while len(out) < n and any(buckets.values()):
            for k in sorted(buckets):
                if len(out) >= n:
                    break
                if buckets[k]:
                    out.append(buckets[k].pop(0))
        return out

    by_var: dict[str, list[dict]] = {}
    for s in sensors:
        by_var.setdefault(s["variable"], []).append(s)
    quota = per_var or max(1, max_sensors // max(1, len(by_var)))
    picked: list[dict] = []
    for var in sorted(by_var):
        take = _spread(by_var[var], quota)
        picked.extend(take)
        if len(by_var[var]) > len(take):
            print(f"  {var:5s}: {len(by_var[var])} sensors available, taking {len(take)}")
        else:
            print(f"  {var:5s}: {len(take)} sensors")
    if len(sensors) > len(picked):
        print(f"  found {len(sensors)} sensors; using {len(picked)} ({quota} per pollutant)")
    sensors = picked
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
    ap.add_argument("--per-var", dest="per_var", type=int,
                    help="sensors per pollutant (default: max-sensors split evenly across pollutants)")
    ap.add_argument("--to", dest="date_to", help="ISO end, e.g. 2026-01-31")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    rows = fetch_city(args.city, args.days, args.max_sensors, args.date_from, args.date_to,
                      [v.strip() for v in args.only_vars.split(",")] if args.only_vars else None,
                      args.per_var)
    cells = {r["h3_cell"] for r in rows}
    variables = sorted({r["variable"] for r in rows})
    print(f"{args.city}: {len(rows)} rows · {len(cells)} cells · vars {variables}")
    if args.push:
        push_to_supabase(rows)


if __name__ == "__main__":
    main()
