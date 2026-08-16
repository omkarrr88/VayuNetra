"""Rolling-window retention for the measurements table.

The Supabase free tier caps the database at 500 MB; raw measurements are by
far the largest table. A real deployment keeps a bounded operational window
of raw readings (models train on 30–90 days) and lets long-horizon statistics
live in aggregates, so this prunes rows older than the window in small
batches. Run daily from CI after ingest.

Usage:
    DEMO_MODE=false python scripts/prune_measurements.py --days 90 --dry-run
    DEMO_MODE=false python scripts/prune_measurements.py --days 90
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

import core.env  # noqa: F401,E402
from core.supa import client  # noqa: E402

BATCH = 20_000  # keep each DELETE short-lived; PostgREST times out long ones


def prune(days: int, dry_run: bool) -> dict:
    db = client()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    old = (
        db.table("measurements").select("id", count="exact")
        .lt("ts", cutoff).limit(1).execute()
    )
    total_old = old.count or 0
    if dry_run or total_old == 0:
        return {"cutoff": cutoff, "rows_older": total_old, "deleted": 0, "dry_run": dry_run}

    deleted = 0
    while True:
        batch = (
            db.table("measurements").select("id")
            .lt("ts", cutoff).limit(BATCH).execute().data or []
        )
        if not batch:
            break
        ids = [r["id"] for r in batch]
        db.table("measurements").delete().in_("id", ids).execute()
        deleted += len(ids)
        print(f"  pruned {deleted:,}/{total_old:,}", flush=True)
    return {"cutoff": cutoff, "rows_older": total_old, "deleted": deleted, "dry_run": False}


WEATHER_VARS = ("precip", "wind_v", "wind_u", "temp", "rh", "blh")

_DEDUP_SQL = """DELETE FROM measurements m USING (
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY h3_cell, ts, variable ORDER BY id DESC) rn
      FROM measurements WHERE variable IN ('precip','wind_v','wind_u','temp','rh','blh')) x
    WHERE rn > 1 LIMIT 60000) d
  WHERE m.id = d.id"""


def dedup_weather() -> int:
    """Drop duplicate weather rows (same cell/ts/variable), keeping the newest.

    The hourly Open-Meteo ingest re-pushes overlapping forecast windows without
    an upsert key, so duplicates accumulate (~95% of weather rows at one point:
    961,920 dupes across 1.02M rows). Runs over the direct Postgres connection;
    silently skips when SUPABASE_DB_URL isn't configured.
    """
    import os

    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        print("[dedup] SUPABASE_DB_URL not set — skipping")
        return 0
    import psycopg

    conn = psycopg.connect(url, connect_timeout=20)
    conn.autocommit = True
    cur = conn.cursor()
    total = 0
    while True:
        cur.execute(_DEDUP_SQL)
        if cur.rowcount == 0:
            break
        total += cur.rowcount
    if total:
        cur.execute("VACUUM ANALYZE measurements")
    conn.close()
    return total


def main() -> None:
    ap = argparse.ArgumentParser(description="Prune measurements older than the retention window.")
    ap.add_argument("--days", type=int, default=90, help="retention window in days (default 90)")
    ap.add_argument("--dry-run", action="store_true", help="count only, delete nothing")
    ap.add_argument("--dedup-weather", action="store_true",
                    help="also remove duplicate weather rows (needs SUPABASE_DB_URL)")
    args = ap.parse_args()
    if args.dedup_weather and not args.dry_run:
        removed = dedup_weather()
        print(f"[dedup] duplicate weather rows removed: {removed:,}")
    result = prune(args.days, args.dry_run)
    print(f"[prune] cutoff={result['cutoff'][:10]} rows_older={result['rows_older']:,} "
          f"deleted={result['deleted']:,} dry_run={result['dry_run']}")


if __name__ == "__main__":
    main()
