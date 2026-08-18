"""Run the Stage-1 live writes into Supabase.

This closes the handoff gap between code/fixtures and the live database:
- emission_sources from static OSM/WorldPop-style layers
- traffic measurements from the mobility proxy
- advisories in city languages plus English/Hindi/Kannada/Marathi coverage

Run:
  python scripts/run_stage1_writes.py --push
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone

from agents.advisory import build_advisories
from connectors.mobility import build_mobility_rows
from connectors.static_layers import build_static_layers, merge_all_cities
from core.supa import client, insert_measurements

ALL_STAGE1_LANGS = ["en"]   # every city gets English; the rest come from its own config


def _cities() -> list[dict]:
    c = client()
    rows = c.table("cities").select("city_id,name,languages").eq("active", True).execute().data
    if rows:
        return rows
    return [
        {"city_id": "delhi", "name": "Delhi", "languages": ["hi", "en"]},
        {"city_id": "bengaluru", "name": "Bengaluru", "languages": ["kn", "en"]},
        {"city_id": "mumbai", "name": "Mumbai", "languages": ["mr", "en", "hi"]},
    ]


def _forecasts(city_id: str) -> list[dict]:
    return (
        client().table("forecasts")
        .select("city_id,h3_cell,horizon_h,value")
        .eq("city_id", city_id)
        .eq("horizon_h", 24)
        .execute()
        .data
    )


def _replace_emission_sources(layers: list[dict]) -> int:
    c = client()
    total = 0
    for layer in layers:
        city_id = layer["city_id"]
        c.table("emission_sources").delete().eq("city_id", city_id).eq("source_origin", "registry").execute()
        rows = []
        for src in layer["emission_sources"]:
            lng, lat = src["coordinates"]
            rows.append({
                "city_id": city_id,
                "type": src["type"],
                "name": src["name"],
                "source_origin": src["source_origin"],
                "detection_confidence": src["detection_confidence"],
                "attributes": {**src["attributes"], "lng": lng, "lat": lat},
            })
        if rows:
            c.table("emission_sources").insert(rows).execute()
            total += len(rows)
    return total


def _replace_mobility(city_ids: list[str], hours: int) -> int:
    c = client()
    total = 0
    start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    for city_id in city_ids:
        c.table("measurements").delete().eq("city_id", city_id).eq("source", "osm_gtfs").execute()
        rows = build_mobility_rows(city_id, hours=hours, start=start)
        insert_measurements(rows, c)
        total += len(rows)
    return total


def _replace_advisories(cities: list[dict], layers_by_city: dict[str, dict]) -> int:
    c = client()
    total = 0
    issued_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    for city in cities:
        city_id = city["city_id"]
        langs = sorted(set((city.get("languages") or []) + ALL_STAGE1_LANGS))
        layer = layers_by_city[city_id]
        forecasts = _forecasts(city_id)
        rows = build_advisories(
            city_id=city_id,
            city_name=city["name"],
            forecasts=forecasts,
            vulnerability_rows=layer["vulnerability"],
            languages=langs,
            horizon_h=24,
            issued_at=issued_at,
        )
        c.table("advisories").delete().eq("city_id", city_id).execute()
        for i in range(0, len(rows), 500):
            c.table("advisories").insert(rows[i : i + 500]).execute()
        total += len(rows)
    return total


def count_live() -> dict:
    c = client()
    return {
        "emission_sources": c.table("emission_sources").select("id", count="exact").execute().count,
        "osm_gtfs": c.table("measurements").select("id", count="exact").eq("source", "osm_gtfs").execute().count,
        "advisories": c.table("advisories").select("id", count="exact").execute().count,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--push", action="store_true", help="write the Stage-1 outputs into Supabase")
    ap.add_argument("--hours", type=int, default=24)
    args = ap.parse_args()

    if not args.push:
        print(count_live())
        return

    cities = _cities()
    layers = merge_all_cities()
    layers_by_city = {layer["city_id"]: layer for layer in layers}
    city_ids = [city["city_id"] for city in cities if city["city_id"] in layers_by_city]

    pushed_sources = _replace_emission_sources([layers_by_city[cid] for cid in city_ids])
    pushed_mobility = _replace_mobility(city_ids, args.hours)
    pushed_advisories = _replace_advisories([c for c in cities if c["city_id"] in layers_by_city], layers_by_city)
    print({
        "pushed_emission_sources": pushed_sources,
        "pushed_osm_gtfs": pushed_mobility,
        "pushed_advisories": pushed_advisories,
        "live_counts": count_live(),
    })


if __name__ == "__main__":
    main()
