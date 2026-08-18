"""Archive raw readings older than the retention window out of the free-tier database.

    python scripts/archive_measurements.py                 # dry run: report what would move
    python scripts/archive_measurements.py --apply         # roll up → export → verify → delete
    python scripts/archive_measurements.py --keep-days 120 --apply

Per city × calendar month older than ``--keep-days`` (default 180):
  1. daily PM2.5 per cell is upserted into ``pm25_daily_rollup`` (the trend views read it,
     so no history disappears from the console);
  2. the raw rows are exported as ``measurements/<city>/<YYYY-MM>.csv.gz`` to the private
     Supabase Storage bucket ``archive`` (and to ``data/archive/`` locally when writable);
  3. the upload is read back and its row count checked against the query;
  4. only then are those rows deleted. Any failure stops before the delete.

Nothing here touches the last ``--keep-days`` of readings, which is what forecast training
(trailing 90 d), attribution and the map read. Restore = load the CSV back with
``core.supa.insert_measurements`` (the unique key makes that idempotent).
"""
from __future__ import annotations

import argparse
import csv
import gzip
import io
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import core.env  # noqa: E402,F401  (loads .env)

BUCKET = "archive"
STATIC_VARIABLES = ("population",)   # per-cell constants stored as readings — never archived
COLUMNS = ["id", "city_id", "h3_cell", "station_id", "ts", "variable", "value", "unit", "source", "confidence", "ingested_at"]
LOCAL_DIR = Path(__file__).resolve().parent.parent / "data" / "archive"


def _months(conn, cutoff: datetime) -> list[tuple[str, date, int]]:
    """Whole calendar months that end before the cutoff — a month is archived in one piece,
    so each day is rolled up exactly once and a re-run is idempotent."""
    month_floor = cutoff.date().replace(day=1)          # months strictly before this are complete
    rows = conn.execute(
        """select city_id, date_trunc('month', ts)::date as month, count(*)
           from measurements where ts < %s and variable <> all(%s) group by 1, 2 order by 1, 2""",
        (month_floor, list(STATIC_VARIABLES)),
    ).fetchall()
    return [(c, m, int(n)) for c, m, n in rows]


def _rollup(conn, city: str, month: date, cutoff: datetime) -> int:
    nxt = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
    return conn.execute(
        """insert into pm25_daily_rollup (city_id, h3_cell, day, pm25, n)
           select city_id, h3_cell, date_trunc('day', ts)::date, avg(value), count(*)
           from measurements
           where city_id = %s and variable = 'pm25' and ts >= %s and ts < %s and ts < %s
           group by 1, 2, 3
           on conflict (city_id, h3_cell, day) do update
             set pm25 = excluded.pm25, n = excluded.n""",
        (city, month, nxt, cutoff),
    ).rowcount


def _export(conn, city: str, month: date, cutoff: datetime) -> tuple[bytes, int]:
    nxt = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(COLUMNS)
    n = 0
    cur = conn.execute(
        f"select {', '.join(COLUMNS)} from measurements where city_id = %s and ts >= %s and ts < %s and ts < %s and variable <> all(%s) order by ts, id",
        (city, month, nxt, cutoff, list(STATIC_VARIABLES)),
    )
    while True:
        chunk = cur.fetchmany(5000)
        if not chunk:
            break
        for row in chunk:
            w.writerow([v.isoformat() if isinstance(v, datetime) else v for v in row])
            n += 1
    return gzip.compress(buf.getvalue().encode("utf-8")), n


def _storage():
    from supabase import create_client  # type: ignore

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    st = sb.storage
    names = {b.name for b in st.list_buckets()}
    if BUCKET not in names:
        st.create_bucket(BUCKET, options={"public": False})
    return st.from_(BUCKET)


def _upload_and_verify(bucket, path: str, blob: bytes, expected_rows: int) -> None:
    bucket.upload(path, blob, {"content-type": "application/gzip", "upsert": "true"})
    back = bucket.download(path)
    if back != blob:
        raise RuntimeError(f"{path}: readback differs from upload")
    lines = gzip.decompress(back).decode("utf-8").count("\n") - 1
    if lines != expected_rows:
        raise RuntimeError(f"{path}: {lines} rows in archive vs {expected_rows} exported")


def _delete(conn, city: str, month: date, cutoff: datetime) -> int:
    nxt = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
    return conn.execute(
        "delete from measurements where city_id = %s and ts >= %s and ts < %s and ts < %s and variable <> all(%s)",
        (city, month, nxt, cutoff, list(STATIC_VARIABLES)),
    ).rowcount


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--keep-days", type=int, default=180, help="retention window for raw readings (default 180)")
    ap.add_argument("--apply", action="store_true", help="actually export + delete (default: dry run)")
    ap.add_argument("--city", default=None, help="limit to one city")
    args = ap.parse_args()

    cutoff = datetime.now(timezone.utc) - timedelta(days=args.keep_days)
    dsn = os.environ["SUPABASE_DB_URL"]
    with psycopg.connect(dsn, autocommit=True) as conn:
        conn.execute("set statement_timeout = '600s'")
        plan = [(c, m, n) for c, m, n in _months(conn, cutoff) if not args.city or c == args.city]
        total = sum(n for _, _, n in plan)
        print(f"retention {args.keep_days} d → cutoff {cutoff:%Y-%m-%d}; {len(plan)} city-months, {total:,} rows older")
        if not plan:
            return 0
        if not args.apply:
            for c, m, n in plan:
                print(f"  {c:10s} {m:%Y-%m}  {n:>8,} rows  → {BUCKET}/measurements/{c}/{m:%Y-%m}.csv.gz")
            print("dry run — nothing moved (pass --apply)")
            return 0

        bucket = _storage()
        moved = 0
        for c, m, n in plan:
            rolled = _rollup(conn, c, m, cutoff)
            blob, exported = _export(conn, c, m, cutoff)
            path = f"measurements/{c}/{m:%Y-%m}.csv.gz"
            _upload_and_verify(bucket, path, blob, exported)
            try:
                LOCAL_DIR.joinpath(c).mkdir(parents=True, exist_ok=True)
                LOCAL_DIR.joinpath(c, f"{m:%Y-%m}.csv.gz").write_bytes(blob)
            except OSError:
                pass
            deleted = _delete(conn, c, m, cutoff)
            moved += deleted
            print(f"  {c:10s} {m:%Y-%m}  rollup +{rolled:>6,} days · archived {exported:>8,} rows ({len(blob)/1024:,.0f} KB) · deleted {deleted:>8,}")
        conn.execute("vacuum (analyze) measurements")
        size = conn.execute("select pg_size_pretty(pg_database_size(current_database()))").fetchone()[0]
        print(f"done: {moved:,} rows archived and pruned; database now {size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
