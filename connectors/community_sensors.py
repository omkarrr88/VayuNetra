"""Community / low-cost sensor ingestion (PurpleAir-pattern, honest source).

Government CAAQMS stations are sparse (~40/city); community sensors densify
the 1 km field cheaply. This ingests NON-government providers already
aggregated by OpenAQ (StateAir, AirNow, AirGradient, PurpleAir where
present), written as source='community' with reduced confidence so every
downstream model knows exactly what it is standing on.

Usage:
    DEMO_MODE=false python -m connectors.community_sensors --city delhi --days 7 --push
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
from connectors.openaq import (  # noqa: E402
    PARAM_MAP,
    _get,
    fetch_sensor_hourly,
    load_city,
    push_to_supabase,
)
from core.spatial.h3_utils import latlng_to_cell  # noqa: E402

# Providers that ARE the official network — everything else counts as
# community/third-party for our purposes.
_GOV_PROVIDERS = {"cpcb", "caaqm", "caaqms"}
COMMUNITY_CONFIDENCE = 0.6


def find_community_sensors(lat: float, lng: float, radius_m: int = 25000) -> list[dict]:
    data = _get("/locations", {"coordinates": f"{lat},{lng}", "radius": radius_m, "limit": 100})
    sensors: list[dict] = []
    for loc in data.get("results", []):
        provider = ((loc.get("provider") or {}).get("name") or "").strip()
        if provider.lower() in _GOV_PROVIDERS:
            continue
        coords = loc.get("coordinates") or {}
        for s in loc.get("sensors", []):
            pname = (s.get("parameter") or {}).get("name")
            if pname in PARAM_MAP:
                sensors.append({
                    "sensor_id": s["id"],
                    "variable": PARAM_MAP[pname],
                    "unit": (s.get("parameter") or {}).get("units"),
                    "lat": coords.get("latitude"),
                    "lng": coords.get("longitude"),
                    "station_id": f"community:{loc.get('id')}",
                    "provider": provider,
                })
    return sensors


def fetch_city_community(city_id: str, days: int = 7, max_sensors: int = 20) -> list[dict]:
    cfg = load_city(city_id)
    lng, lat = cfg["center"]
    since = (datetime.now(timezone.utc) - timedelta(days=days)).replace(microsecond=0).isoformat()
    sensors = find_community_sensors(lat, lng)
    if not sensors:
        return []
    providers = sorted({s["provider"] for s in sensors})
    print(f"  {len(sensors)} community sensors from {providers}; capping to {max_sensors}")
    rows: list[dict] = []
    for sensor in sensors[:max_sensors]:
        for r in fetch_sensor_hourly(sensor, since):
            if r.get("value") is None or r.get("lat") is None:
                continue
            rows.append({
                "city_id": city_id,
                "h3_cell": latlng_to_cell(float(r["lat"]), float(r["lng"]), cfg.get("h3_res", 8)),
                "station_id": r.get("station_id"),
                "ts": r["ts"],
                "variable": r["variable"],
                "value": float(r["value"]),
                "unit": r.get("unit"),
                "source": "community",
                "confidence": COMMUNITY_CONFIDENCE,
            })
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--max-sensors", type=int, default=20)
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    rows = fetch_city_community(args.city, args.days, args.max_sensors)
    cells = len({r["h3_cell"] for r in rows})
    print(f"{args.city}: {len(rows)} community rows across {cells} cells "
          f"(source=community, confidence={COMMUNITY_CONFIDENCE})")
    if args.push and rows:
        push_to_supabase(rows)
        print(f"pushed {len(rows)} community measurements")


if __name__ == "__main__":
    main()
