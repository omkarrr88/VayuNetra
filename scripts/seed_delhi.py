"""Delhi seed generator (F6 helper).

Seeds the `cities` table (from core/config/cities/*.yml) and synthetic-but-plausible
Delhi `measurements` so the WHOLE team has queryable data on day 1 — before the real
CAAQMS connector lands. Writes a fixture by default; ``--push`` inserts into Supabase.
Replace the synthetic generator with real CPCB pulls once connectors exist.

  python scripts/seed_delhi.py            # -> demo/fixtures/measurements.json
  python scripts/seed_delhi.py --push     # also upsert cities + insert measurements (needs SUPABASE_* env)
"""
from __future__ import annotations

import argparse
import json
import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:  # load .env so --push picks up SUPABASE_* without manual export
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

REPO_ROOT = Path(__file__).resolve().parent.parent
CITIES_DIR = REPO_ROOT / "core" / "config" / "cities"

# Sample H3 res-8 cells across Delhi (placeholders; regenerate from delhi.yml bbox + h3 later)
DELHI_CELLS = ["883da1a3a1fffff", "883da1a3a3fffff", "883da1a3a5fffff", "883da1a3a7fffff"]

# variable -> (low, high) plausible range
VARS = {
    "pm25": (40, 220), "pm10": (80, 400), "no2": (10, 90),
    "so2": (3, 30), "co": (0.4, 2.5), "o3": (10, 80),
}


def load_city_rows() -> list[dict]:
    """Read core/config/cities/*.yml -> minimal `cities` rows (no geometry).

    Geometry (bbox/center) is nullable; full geometry comes from the seed_cities migration.
    """
    import yaml

    rows: list[dict] = []
    for path in sorted(CITIES_DIR.glob("*.yml")):
        cfg = yaml.safe_load(path.read_text())
        rows.append({
            "city_id": cfg["city_id"],
            "name": cfg["name"],
            "state": cfg.get("state"),
            "languages": cfg.get("languages", []),
            "active": cfg.get("active", True),
        })
    return rows


def generate(days: int = 3) -> list[dict]:
    rows: list[dict] = []
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    for h in range(days * 24):
        ts = now - timedelta(hours=h)
        # crude diurnal cycle: morning + evening peaks
        diurnal = 1 + 0.4 * math.sin((ts.hour / 24) * 2 * math.pi)
        for cell in DELHI_CELLS:
            for var, (lo, hi) in VARS.items():
                value = random.uniform(lo, hi) * diurnal
                rows.append({
                    "city_id": "delhi",
                    "h3_cell": cell,
                    "station_id": None,
                    "ts": ts.isoformat(),
                    "variable": var,
                    "value": round(value, 2),
                    "unit": "mg/m3" if var == "co" else "ug/m3",
                    "source": "caaqms",
                    "confidence": 1.0,
                })
    return rows


def push_to_supabase(measurements: list[dict]) -> None:
    import os

    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(url, key)

    # 1) cities first (FK target) — insert-if-absent so existing geometry isn't clobbered
    cities = load_city_rows()
    client.table("cities").upsert(cities, on_conflict="city_id", ignore_duplicates=True).execute()
    print(f"upserted {len(cities)} cities: {[c['city_id'] for c in cities]}")

    # 2) measurements (batched)
    for i in range(0, len(measurements), 500):
        client.table("measurements").insert(measurements[i : i + 500]).execute()
    print(f"pushed {len(measurements)} measurements to Supabase")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=3)
    ap.add_argument("--push", action="store_true", help="upsert cities + insert measurements into Supabase")
    args = ap.parse_args()

    rows = generate(args.days)
    out = REPO_ROOT / "demo" / "fixtures" / "measurements.json"
    out.write_text(json.dumps(rows, indent=2))
    print(f"wrote {len(rows)} rows -> {out}")
    if args.push:
        push_to_supabase(rows)


if __name__ == "__main__":
    main()
