"""CPCB CAAQMS connector via data.gov.in.  Owner: Omkar.  Spec: ARCHITECTURE.md §7.1; PRD §11.

The authoritative Indian ground source — real-time AQI per CPCB station (a *current
snapshot*, not history; complements OpenAQ's hourly series). Maps each station to its H3
cell -> canonical `measurements` (source='caaqms').

Needs a free key:  DATA_GOV_IN_API_KEY in .env  (register at https://data.gov.in).
data.gov.in is often flaky (502/timeouts) — the fetch retries; just re-run if it fails.

  python -m connectors.cpcb --city delhi              # fetch + summary
  python -m connectors.cpcb --city delhi --push       # insert into Supabase
"""
from __future__ import annotations

import argparse
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

import core.env  # noqa: F401  (loads .env)
from core.spatial.h3_utils import latlng_to_cell

# data.gov.in "Real time Air Quality Index" (CPCB) resource
RESOURCE = "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"
BASE = f"https://api.data.gov.in/resource/{RESOURCE}"
CITIES_DIR = Path(__file__).resolve().parent.parent / "core" / "config" / "cities"
IST = timezone(timedelta(hours=5, minutes=30))

# CPCB pollutant_id -> our canonical variable
PARAM_MAP = {
    "PM2.5": "pm25", "PM10": "pm10", "NO2": "no2",
    "SO2": "so2", "CO": "co", "OZONE": "o3", "O3": "o3",
}


def load_city(city_id: str) -> dict:
    import yaml

    return yaml.safe_load((CITIES_DIR / f"{city_id}.yml").read_text())


def _num(v) -> float | None:
    if v in (None, "", "NA", "NaN", "None"):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _ts_utc(s) -> str | None:
    """CPCB last_update (IST, day-first) -> ISO-8601 UTC."""
    for fmt in ("%d-%m-%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d-%m-%Y %H:%M"):
        try:
            return datetime.strptime(s.strip(), fmt).replace(tzinfo=IST).astimezone(timezone.utc).isoformat()
        except (ValueError, AttributeError):
            continue
    return None


def rows_from_records(city_id: str, records: list[dict], h3_res: int = 8) -> list[dict]:
    """CPCB records -> canonical measurement rows (pure; unit-tested).

    Handles both data.gov.in schema variants: avg_value / pollutant_avg.
    """
    rows: list[dict] = []
    for r in records:
        variable = PARAM_MAP.get((r.get("pollutant_id") or "").strip().upper())
        if not variable:
            continue
        value = _num(r.get("avg_value") if r.get("avg_value") is not None else r.get("pollutant_avg"))
        lat, lng = _num(r.get("latitude")), _num(r.get("longitude"))
        ts = _ts_utc(r.get("last_update"))
        if value is None or lat is None or lng is None or ts is None:
            continue
        rows.append({
            "city_id": city_id,
            "h3_cell": latlng_to_cell(lat, lng, h3_res),
            "station_id": r.get("station"),
            "ts": ts,
            "variable": variable,
            "value": value,
            "unit": "mg/m3" if variable == "co" else "ug/m3",
            "source": "caaqms",
            "confidence": 1.0,
        })
    return rows


# data.gov.in city labels differ from our city_ids (and sometimes use old names).
# Cities not listed here fall back to their config display name, which matches
# for most; add an entry whenever the registry uses a different/older label.
CITY_ALIASES = {
    "delhi": ["Delhi"],
    "bengaluru": ["Bengaluru", "Bangalore"],
    "mumbai": ["Mumbai"],
    "hyderabad": ["Hyderabad"],
    "chennai": ["Chennai", "Madras"],
    "kolkata": ["Kolkata", "Calcutta"],
    "pune": ["Pune"],
    "ahmedabad": ["Ahmedabad"],
    "jaipur": ["Jaipur"],
    "lucknow": ["Lucknow"],
}


def _get(params: dict, retries: int = 6, timeout: int = 30) -> dict:
    """One data.gov.in request. The endpoint is flaky (fast one call, hangs the next),
    so we use a short timeout and retry rather than one long 60s block."""
    key = os.environ.get("DATA_GOV_IN_API_KEY")
    if not key:
        raise RuntimeError("DATA_GOV_IN_API_KEY missing in .env — register at https://data.gov.in")
    last = ""
    for attempt in range(retries):
        try:
            resp = requests.get(BASE, params={"api-key": key, "format": "json", **params}, timeout=timeout)
            if resp.status_code == 200:
                return resp.json()
            last = f"HTTP {resp.status_code}"
        except requests.RequestException as e:
            last = type(e).__name__
        time.sleep(min(10, 2 * (attempt + 1)))   # short backoff; the source recovers quickly
    raise RuntimeError(f"data.gov.in unreachable after {retries} tries ({last}) — it is flaky, just re-run")


def fetch_city(city_id: str, limit: int = 500) -> list[dict]:
    """One small filtered request per city (a city has ~40 stations, well under `limit`).

    Tries each known name alias so 'bengaluru' also matches a 'Bangalore' label.
    """
    cfg = load_city(city_id)
    names = CITY_ALIASES.get(city_id, [cfg["name"]])
    records: list[dict] = []
    for name in names:
        recs = _get({"filters[city]": name, "limit": limit}).get("records", [])
        if recs:
            records = recs
            break
    return rows_from_records(city_id, records, cfg.get("h3_res", 8))


def push_to_supabase(rows: list[dict]) -> None:
    from core.supa import client

    client = client()
    for i in range(0, len(rows), 500):
        client.table("measurements").insert(rows[i : i + 500]).execute()
    print(f"pushed {len(rows)} CPCB measurements to Supabase")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    try:
        rows = fetch_city(args.city)
    except RuntimeError as e:
        print(f"⚠ {e}")
        return
    cells = {r["h3_cell"] for r in rows}
    variables = sorted({r["variable"] for r in rows})
    print(f"{args.city}: {len(rows)} rows · {len(cells)} stations · vars {variables}")
    if args.push:
        push_to_supabase(rows)


if __name__ == "__main__":
    main()
