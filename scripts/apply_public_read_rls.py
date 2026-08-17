"""Apply the public-read RLS migration to Supabase.

Grants anonymous SELECT on `attribution` + `enforcement_recs` so the
deployed dashboard (which calls the API with the anon key) can show those
panels. Idempotent — safe to re-run. Reads SUPABASE_DB_URL from .env.

Run:
    source .venv/bin/activate
    python3 scripts/apply_public_read_rls.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Make the repo root importable no matter where this is invoked from.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import core.env  # noqa: F401  (loads .env)

try:
    import psycopg
except ImportError:
    raise SystemExit("psycopg not installed — run:  pip install 'psycopg[binary]'")

MIGRATION = Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "20260704000001_public_read_dashboard.sql"


def _parse_db_url(url: str) -> dict:
    """Split a Postgres URL whose password may contain ?, #, & (unescaped)."""
    rest = url.strip().split("://", 1)[1]          # postgres:<pwd>@host:port/db
    userpass, hostpart = rest.rsplit("@", 1)       # password has no '@'
    user, password = userpass.split(":", 1)
    hostport, dbname = hostpart.split("/", 1)
    host, port = hostport.split(":")
    return {
        "host": host,
        "port": int(port),
        "user": user,
        "password": password,
        "dbname": dbname.split("?")[0],
        "sslmode": "require",
        "connect_timeout": 15,
    }


def main() -> None:
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        raise SystemExit("SUPABASE_DB_URL missing in .env")

    sql = MIGRATION.read_text()
    conn_args = _parse_db_url(url)
    print(f"Connecting to {conn_args['host']}:{conn_args['port']}/{conn_args['dbname']} ...")

    with psycopg.connect(autocommit=True, **conn_args) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute(
                """select tablename, policyname from pg_policies
                   where tablename in ('attribution', 'enforcement_recs')
                   order by tablename, policyname;"""
            )
            rows = cur.fetchall()

    print("\nPolicies now on those tables:")
    for table, policy in rows:
        print(f"  {table:18s} -> {policy}")
    print("\n✓ public-read RLS applied.")


if __name__ == "__main__":
    main()
