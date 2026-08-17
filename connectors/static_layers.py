"""Static OSM/WorldPop-style layers for the Stage-1 static-layers lane.

This module is intentionally free/offline first. It creates deterministic seed layers
with the same shape a live OSM + WorldPop connector would produce:

- emission sources for `emission_sources`
- road/land-use context for the UI
- ward vulnerability summaries for Agent 4 advisory

Run:
  python -m connectors.static_layers --city delhi
  python -m connectors.static_layers --city delhi --out demo/fixtures/static_layers.json
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
CITIES_DIR = REPO_ROOT / "core" / "config" / "cities"

CITY_SEED = {
    "delhi": {
        "wards": [("ward-12", 18400, 0.82), ("ward-31", 9200, 0.58), ("ward-44", 12600, 0.42)],
        "sources": [
            ("construction", "Ring Road construction belt", 0.010, 0.008, 0.86),
            ("industry", "Okhla industrial cluster", 0.035, -0.006, 0.78),
            ("waste_burn", "Yamuna waste hotspot", -0.025, 0.014, 0.64),
        ],
        "roads": [("arterial", "Ring Road", 1.0), ("highway", "NH-48 corridor", 1.25), ("collector", "Ward feeder roads", 0.55)],
    },
    "bengaluru": {
        "wards": [("ward-84", 11200, 0.55), ("ward-101", 15600, 0.48), ("ward-128", 9800, 0.39)],
        "sources": [
            ("diesel_corridor", "Outer Ring Road traffic corridor", 0.018, 0.006, 0.74),
            ("construction", "Bellandur construction cluster", 0.030, -0.012, 0.69),
            ("industry", "Peenya industrial edge", -0.028, 0.020, 0.66),
        ],
        "roads": [("arterial", "Outer Ring Road", 1.15), ("highway", "Hosur Road", 1.05), ("collector", "Tech park connectors", 0.65)],
    },
    "mumbai": {
        "wards": [("ward-k-east", 13600, 0.61), ("ward-g-north", 20100, 0.69), ("ward-m-west", 10800, 0.45)],
        "sources": [
            ("construction", "Coastal road works", -0.012, 0.010, 0.80),
            ("diesel_corridor", "Port freight corridor", 0.020, -0.018, 0.77),
            ("industry", "Chembur industrial belt", 0.030, 0.006, 0.70),
        ],
        "roads": [("arterial", "Western Express Highway", 1.05), ("highway", "Eastern Freeway", 1.20), ("collector", "Station access roads", 0.62)],
    },
}


def load_city(city_id: str) -> dict:
    return yaml.safe_load((CITIES_DIR / f"{city_id}.yml").read_text())


def _point(center: list[float], dlng: float, dlat: float) -> list[float]:
    return [round(center[0] + dlng, 6), round(center[1] + dlat, 6)]


def _line(center: list[float], offset: float) -> list[list[float]]:
    return [
        _point(center, -0.035, offset),
        _point(center, -0.012, offset + 0.006),
        _point(center, 0.018, offset - 0.002),
        _point(center, 0.040, offset + 0.004),
    ]


def build_static_layers(city_id: str) -> dict:
    cfg = load_city(city_id)
    seed = CITY_SEED.get(city_id, CITY_SEED["delhi"])
    center = cfg["center"]
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    emission_sources = []
    for idx, (typ, name, dlng, dlat, conf) in enumerate(seed["sources"], 1):
        emission_sources.append({
            "id": f"{city_id}-src-{idx}",
            "city_id": city_id,
            "type": typ,
            "name": name,
            "source_origin": "registry",
            "detection_confidence": conf,
            "coordinates": _point(center, dlng, dlat),
            "attributes": {
                "osm_seeded": True,
                "inspection_radius_m": 500,
                "stage": "stage1_static_registry",
            },
        })

    vulnerability = []
    for idx, (ward_id, population, vuln) in enumerate(seed["wards"], 1):
        vulnerability.append({
            "city_id": city_id,
            "ward_id": ward_id,
            "population": population,
            "vulnerable_population": round(population * (0.18 + vuln * 0.12)),
            "hospitals": 1 + idx % 2,
            "schools": 2 + idx,
            "outdoor_worker_share": round(0.18 + vuln * 0.16, 2),
            "vulnerability_index": vuln,
        })

    roads = []
    for idx, (road_class, name, weight) in enumerate(seed["roads"], 1):
        roads.append({
            "city_id": city_id,
            "road_id": f"{city_id}-road-{idx}",
            "name": name,
            "class": road_class,
            "coordinates": _line(center, (idx - 2) * 0.018),
            "traffic_weight": weight,
        })

    return {
        "city_id": city_id,
        "generated_at": generated_at,
        "emission_sources": emission_sources,
        "vulnerability": vulnerability,
        "roads": roads,
        "land_use": [
            {"type": "industrial", "share": 0.18 if city_id != "mumbai" else 0.23},
            {"type": "built_up", "share": 0.52},
            {"type": "green_open", "share": 0.12 if city_id == "bengaluru" else 0.08},
        ],
    }


def merge_all_cities() -> list[dict]:
    return [build_static_layers(path.stem) for path in sorted(CITIES_DIR.glob("*.yml"))]


def push_emission_sources(layer: dict) -> int:
    """Insert seeded emission sources. Geometry is supplied as lon/lat attributes.

    The live pipeline can replace this with PostGIS-native upserts once registry data
    arrives. For Stage 1 the same rows are enough for enforcement and UI joins.
    """
    from core.supa import client

    rows = []
    for src in layer["emission_sources"]:
        lng, lat = src["coordinates"]
        rows.append({
            "city_id": src["city_id"],
            "type": src["type"],
            "name": src["name"],
            "source_origin": src["source_origin"],
            "detection_confidence": src["detection_confidence"],
            "attributes": {**src["attributes"], "lng": lng, "lat": lat},
        })
    client().table("emission_sources").insert(rows).execute()
    return len(rows)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="all")
    ap.add_argument("--out", help="write JSON fixture")
    ap.add_argument("--push", action="store_true", help="insert emission_sources into Supabase")
    args = ap.parse_args()

    payload = merge_all_cities() if args.city == "all" else [build_static_layers(args.city)]
    if args.out:
        Path(args.out).write_text(json.dumps(payload, indent=2))
        print(f"wrote {len(payload)} city static layer(s) -> {args.out}")
    else:
        print(json.dumps(payload, indent=2))
    if args.push:
        total = sum(push_emission_sources(layer) for layer in payload)
        print(f"pushed {total} emission source rows")


if __name__ == "__main__":
    main()
