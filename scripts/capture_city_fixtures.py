"""Capture a real /city/overview + /city/now snapshot per city for the offline fallback.

The public overview page IS the app's home. It had no bundled fixture, so with the API unreachable
— Render asleep, a CORS mismatch, venue wifi behind a portal — it rendered an error box and nothing
else: 121 characters on the first screen a judge sees. Every other read endpoint already had this
insurance; the most important one did not.

This captures the live response and trims it to what the page actually renders, so the bundle cost
stays reasonable. Real measured data, clearly served behind the "showing a snapshot" notice — the
same contract as the existing fixtures.

    .venv/bin/python scripts/capture_city_fixtures.py            # API on :8000
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import core.env  # noqa: E402,F401
from core.cities import list_city_ids  # noqa: E402

API = os.environ.get("PITCH_API", "http://localhost:8000")
KEY = os.environ.get("SUPABASE_ANON_KEY", "")
OUT_OVERVIEW = ROOT / "web" / "src" / "fixtures" / "city_overview.json"
OUT_NOW = ROOT / "web" / "src" / "fixtures" / "city_now.json"


def get(path: str) -> dict:
    req = urllib.request.Request(API + path, headers={"Authorization": f"Bearer {KEY}"} if KEY else {})
    with urllib.request.urlopen(req, timeout=180) as r:
        body = json.load(r)
    if not body.get("success") or body.get("data") is None:
        raise SystemExit(f"{path} failed: {str(body)[:200]}")
    return body["data"]


def trim(d: dict) -> dict:
    """Keep everything the page renders; drop what it never reads offline.

    `daily.pollutants` carries six pollutants x ~200 days and is 70% of the payload. The calendar and
    the monthly trend read PM2.5; the other pollutants are only reachable through the graph's 7d/30d/1y
    ranges, which degrade to "no data for this range" — an honest offline state, and worth 25 KB a city.
    """
    daily = d.get("daily") or {}
    pollutants = daily.get("pollutants") or {}
    d["daily"] = {**daily, "pollutants": {"pm25": pollutants.get("pm25", [])}}
    return d


def main() -> None:
    cities = list_city_ids()
    overview: dict[str, dict] = {}
    now: dict[str, dict] = {}
    for c in cities:
        try:
            overview[c] = trim(get(f"/city/overview?city={c}"))
            now[c] = get(f"/city/now?city={c}")
            kb = len(json.dumps(overview[c])) / 1024
            print(f"  {c:11s} {kb:6.1f} KB  calendar {len(overview[c]['daily']['calendar']):3d} days")
        except Exception as e:  # noqa: BLE001 — one bad city must not lose the rest
            print(f"  {c:11s} SKIPPED ({e})")

    if not overview:
        raise SystemExit("captured nothing — is the API up and SUPABASE_ANON_KEY set?")

    OUT_OVERVIEW.write_text(json.dumps(overview, separators=(",", ":")))
    OUT_NOW.write_text(json.dumps(now, separators=(",", ":")))
    print(f"\nwrote {OUT_OVERVIEW.relative_to(ROOT)}  {OUT_OVERVIEW.stat().st_size // 1024} KB  ({len(overview)} cities)")
    print(f"wrote {OUT_NOW.relative_to(ROOT)}  {OUT_NOW.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
