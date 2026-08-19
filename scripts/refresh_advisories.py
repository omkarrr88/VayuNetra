"""Regenerate citizen advisories from the CURRENT forecasts.

Surgical version of run_stage1_writes --push: touches ONLY the advisories
table (the full script would also re-insert its synthetic registry rows next
to the OSM-ingested emission_sources). Cron-safe and idempotent.

Run:
    python scripts/refresh_advisories.py
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import core.env  # noqa: F401,E402


TOP_ZONES = 4  # advisories target the most vulnerable zones per city


def _live_vulnerability(city_id: str) -> list[dict]:
    """Top REAL vulnerability zones (OSM facilities × GPW population) — the
    advisory generator reads ward_id/vulnerability_index/schools/hospitals."""
    from core.supa import client

    rows = (
        client().table("vulnerability")
        .select("h3_cell,zone_id,population,hospitals,schools,eldercare,outdoor_sites,vulnerability_index")
        .eq("city_id", city_id).order("vulnerability_index", desc=True)
        .limit(TOP_ZONES).execute().data or []
    )
    return [
        {
            "ward_id": r["zone_id"],
            # the advisory names the ward from this; without it every message falls back to
            # the zone id, which is the hex-truncation nobody can read
            "h3_cell": r.get("h3_cell"),
            "population": r["population"],
            "vulnerability_index": r["vulnerability_index"],
            "schools": r["schools"],
            "hospitals": r["hospitals"],
            "outdoor_worker_share": min(1.0, (r.get("outdoor_sites") or 0) / 8.0),
        }
        for r in rows
    ]


def main() -> None:
    from connectors.static_layers import build_static_layers
    from scripts.run_stage1_writes import _cities, _replace_advisories

    cities = _cities()
    layers = {c["city_id"]: build_static_layers(c["city_id"]) for c in cities}
    # Prefer the live vulnerability table (real OSM + GPW data) over the
    # deterministic seed wards; fall back to the seed if a city has no rows yet.
    for c in cities:
        live = _live_vulnerability(c["city_id"])
        if live:
            layers[c["city_id"]]["vulnerability"] = live
    total = _replace_advisories(cities, layers)
    print(f"advisories refreshed: {total} rows across {len(cities)} cities")


if __name__ == "__main__":
    main()
