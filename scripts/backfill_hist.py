"""Backfill a city's PM2.5 history from OpenAQ into data/hist/<city>_pm25.csv.gz.

Four cities (Pune, Ahmedabad, Jaipur, Lucknow) were onboarded on 12 July 2026, so the production
database holds nothing earlier for them and any slide dated December 2025 had to leave them blank.
OpenAQ *does* hold that history — this pulls it into the same store the other six cities already
use, in the same schema, so every dated view can cover all ten cities from measured data.

It writes only to data/hist/ — the production database is untouched. Existing rows are preserved and
de-duplicated on (station_id, ts, variable), so re-running is safe and never double-counts.

    .venv/bin/python scripts/backfill_hist.py --cities pune,ahmedabad,jaipur,lucknow \
        --from 2025-12-01 --to 2026-03-01
"""
from __future__ import annotations

import argparse
import gzip
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))          # run as a script from anywhere

import core.env  # noqa: E402,F401  (loads .env, needed for OPENAQ_API_KEY)
from connectors.openaq import fetch_city  # noqa: E402

HIST = ROOT / "data" / "hist"
COLUMNS = ["city_id", "h3_cell", "station_id", "ts", "variable", "value", "unit", "source", "confidence"]


def load_existing(city: str) -> pd.DataFrame:
    f = HIST / f"{city}_pm25.csv.gz"
    if not f.exists():
        return pd.DataFrame(columns=COLUMNS)
    with gzip.open(f, "rt") as fh:
        return pd.read_csv(fh)


def backfill(city: str, date_from: str, date_to: str, max_sensors: int, variables: list[str]) -> dict:
    rows = fetch_city(city, max_sensors=max_sensors, date_from=date_from, date_to=date_to, only_vars=variables)
    fresh = pd.DataFrame(rows)
    if fresh.empty:
        return {"city": city, "fetched": 0, "added": 0, "total": len(load_existing(city))}

    for col in COLUMNS:
        if col not in fresh.columns:
            fresh[col] = None
    fresh = fresh[COLUMNS]
    fresh["source"] = fresh["source"].fillna("openaq")
    fresh["confidence"] = fresh["confidence"].fillna(1.0)

    old = load_existing(city)
    before = len(old)
    both = pd.concat([old, fresh], ignore_index=True)
    # one reading per station, timestamp and pollutant — the later fetch wins on a conflict
    both = both.drop_duplicates(subset=["station_id", "ts", "variable"], keep="last")
    both = both.sort_values(["ts", "station_id", "variable"]).reset_index(drop=True)

    out = HIST / f"{city}_pm25.csv.gz"
    HIST.mkdir(parents=True, exist_ok=True)
    with gzip.open(out, "wt", newline="") as fh:
        both.to_csv(fh, index=False)
    return {"city": city, "fetched": len(fresh), "added": len(both) - before, "total": len(both)}


def coverage(city: str, date_from: str, date_to: str) -> str:
    df = load_existing(city)
    if df.empty:
        return "no rows"
    df["ts"] = pd.to_datetime(df["ts"], utc=True, format="mixed")
    pm = df[df["variable"] == "pm25"]
    w = pm[(pm["ts"] >= date_from) & (pm["ts"] < date_to)]
    if w.empty:
        return f"{len(pm)} pm25 rows, none in window"
    daily = w.groupby(w["ts"].dt.floor("D"))["value"].agg(["mean", "count"])
    daily = daily[daily["count"] >= 12]
    return (f"{len(w)} pm25 rows in window · {len(daily)} usable days · "
            f"worst {daily['mean'].max():.1f} on {str(daily['mean'].idxmax())[:10]} · mean {daily['mean'].mean():.1f}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cities", required=True, help="comma-separated city ids")
    ap.add_argument("--from", dest="date_from", required=True)
    ap.add_argument("--to", dest="date_to", required=True)
    ap.add_argument("--vars", dest="variables", default="pm25")
    ap.add_argument("--max-sensors", type=int, default=14)
    args = ap.parse_args()

    variables = [v.strip() for v in args.variables.split(",")]
    for city in [c.strip() for c in args.cities.split(",") if c.strip()]:
        print(f"\n=== {city} ===", flush=True)
        try:
            res = backfill(city, args.date_from, args.date_to, args.max_sensors, variables)
        except Exception as e:  # noqa: BLE001 — one city failing must not abort the rest
            print(f"  FAILED: {e}")
            continue
        print(f"  fetched {res['fetched']} rows, added {res['added']} new, file now {res['total']} rows")
        print(f"  coverage: {coverage(city, args.date_from, args.date_to)}")


if __name__ == "__main__":
    main()
