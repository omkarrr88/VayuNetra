"""Push a city's historical daily PM2.5 into pm25_daily_rollup, the table that keeps history forever.

Why the rollup and not `measurements`: the free-tier database prunes raw readings after the
retention window (scripts/archive_measurements.py), so no city currently holds a raw row older than
about 180 days — not even Delhi. History survives in `pm25_daily_rollup`, and both
`pm25_daily_trend` and `city_pollutants_daily` read the union of live raw rows and that rollup,
preferring raw where a day exists in both. Writing raw hourly rows for December 2025 would therefore
be deleted on the next archive run AND never reach the trend or calendar views.

Source is data/hist/<city>_pm25.csv.gz — measured CPCB readings via OpenAQ, the same store the
model training and the pitch deck read. Aggregated to (city, cell, day) exactly the way
archive_measurements.py does, so a day written here is indistinguishable from one the archiver wrote.

Idempotent: upserts on the table's own primary key (city_id, h3_cell, day).

    .venv/bin/python scripts/push_hist_rollup.py --cities pune,ahmedabad,jaipur,lucknow \
        --from 2025-12-01 --to 2026-03-01                     # add --commit to write
"""
from __future__ import annotations

import argparse
import gzip
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import core.env  # noqa: E402,F401
from core.supa import client  # noqa: E402

HIST = ROOT / "data" / "hist"
TABLE = "pm25_daily_rollup"
MIN_HOURS = 12          # a day needs half its hours before it is a daily mean
CHUNK = 500


def daily_rows(city: str, date_from: str, date_to: str) -> list[dict]:
    f = HIST / f"{city}_pm25.csv.gz"
    if not f.exists():
        raise FileNotFoundError(f"no history for {city}: {f}")
    with gzip.open(f, "rt") as fh:
        df = pd.read_csv(fh)
    df["ts"] = pd.to_datetime(df["ts"], utc=True, format="mixed")
    df = df[df["variable"] == "pm25"]
    w = df[(df["ts"] >= date_from) & (df["ts"] < date_to)]
    if w.empty:
        return []
    g = (w.assign(day=w["ts"].dt.tz_convert("UTC").dt.date)
          .groupby(["h3_cell", "day"])["value"].agg(["mean", "count"]).reset_index())
    g = g[g["count"] >= MIN_HOURS]
    return [{"city_id": city, "h3_cell": r["h3_cell"], "day": str(r["day"]),
             "pm25": round(float(r["mean"]), 2), "n": int(r["count"])} for _, r in g.iterrows()]


def existing(db, city: str, date_from: str, date_to: str) -> int:
    r = (db.table(TABLE).select("day", count="exact").eq("city_id", city)
           .gte("day", date_from[:10]).lt("day", date_to[:10]).limit(1).execute())
    return r.count or 0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cities", required=True)
    ap.add_argument("--from", dest="date_from", required=True)
    ap.add_argument("--to", dest="date_to", required=True)
    ap.add_argument("--commit", action="store_true", help="actually write; otherwise dry-run")
    args = ap.parse_args()

    db = client()
    total = 0
    for city in [c.strip() for c in args.cities.split(",") if c.strip()]:
        rows = daily_rows(city, args.date_from, args.date_to)
        before = existing(db, city, args.date_from, args.date_to)
        days = len({r["day"] for r in rows})
        cells = len({r["h3_cell"] for r in rows})
        print(f"{city:11s} {len(rows):6d} cell-days ({days} days x {cells} cells)  already in rollup: {before}")
        if not args.commit or not rows:
            continue
        for i in range(0, len(rows), CHUNK):
            db.table(TABLE).upsert(rows[i:i + CHUNK], on_conflict="city_id,h3_cell,day").execute()
        after = existing(db, city, args.date_from, args.date_to)
        print(f"            -> wrote {len(rows)}; rollup rows in window now {after}")
        total += len(rows)

    print(("\nwrote %d cell-days" % total) if args.commit else "\ndry run — nothing written; add --commit")


if __name__ == "__main__":
    main()
