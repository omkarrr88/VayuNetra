"""GPW v4.11 population per H3 cell, via Earth Engine.

Replaces the flat POP_PER_CELL=40k heuristic with real gridded population:
CIESIN GPW v4.11 Population Count (~1 km, 2020, SEDAC/NASA) summed over each
H3 res-8 cell polygon. Written as canonical `measurements` rows
(variable='population', source='gpw411', ts=2020-01-01) — zero schema changes.

  python -m connectors.population --city delhi            # sample + print
  python -m connectors.population --city delhi --push     # upsert into Supabase
"""
from __future__ import annotations

import argparse

import h3

import core.env  # noqa: F401

GPW_IMAGE = "CIESIN/GPWv411/GPW_Population_Count/gpw_v4_population_count_rev11_2020_30_sec"
CITATION = "GPW v4.11 Population Count 2020 (CIESIN/SEDAC, NASA) via Google Earth Engine"
TS = "2020-01-01T00:00:00+00:00"


def _target_cells(city_id: str) -> list[str]:
    """Cells that actually consume population: attribution/forecast + source cells."""
    from core.supa import client

    db = client()
    cells: set[str] = set()
    for table, col in (("attribution", "h3_cell"), ("forecasts", "h3_cell")):
        for r in db.table(table).select(col).eq("city_id", city_id).execute().data:
            if r.get(col):
                cells.add(r[col])
    for r in db.table("emission_sources").select("attributes").eq("city_id", city_id).execute().data:
        c = (r.get("attributes") or {}).get("h3_cell")
        if c:
            cells.add(c)
    return sorted(cells)


def sample_population(city_id: str, cells: list[str]) -> list[dict]:
    """Sum GPW population over each cell's polygon -> canonical measurement rows."""
    import ee

    from connectors.earth_engine import init

    init()
    img = ee.Image(GPW_IMAGE)
    feats = []
    for cell in cells:
        boundary = [[lng, lat] for lat, lng in h3.cell_to_boundary(cell)]
        feats.append(ee.Feature(ee.Geometry.Polygon([boundary]), {"cell": cell}))
    sampled = img.reduceRegions(
        collection=ee.FeatureCollection(feats), reducer=ee.Reducer.sum(), scale=927
    ).getInfo()

    rows: list[dict] = []
    for f in sampled["features"]:
        val = f["properties"].get("sum")
        if val is None:
            continue
        rows.append({
            "city_id": city_id, "h3_cell": f["properties"]["cell"], "station_id": None,
            "ts": TS, "variable": "population", "value": round(float(val)),
            "unit": "people", "source": "gpw411", "confidence": 1.0,
        })
    return rows


def push(city_id: str, rows: list[dict]) -> None:
    from core.supa import client

    db = client()
    # idempotent: one population row per cell
    db.table("measurements").delete().eq("city_id", city_id).eq("variable", "population").execute()
    if rows:
        db.table("measurements").insert(rows).execute()
    print(f"{city_id}: wrote {len(rows)} population cells ({CITATION})")


def load_population(city_id: str) -> dict[str, float]:
    """Per-cell population for consumers (counterfactual, enforcement)."""
    from core.supa import client

    rows = (
        client().table("measurements").select("h3_cell,value")
        .eq("city_id", city_id).eq("variable", "population")
        .execute().data
    )
    return {r["h3_cell"]: float(r["value"]) for r in rows}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    cells = _target_cells(args.city)
    rows = sample_population(args.city, cells)
    total = sum(r["value"] for r in rows)
    print(f"{args.city}: {len(rows)}/{len(cells)} cells sampled · total pop in cells: {total:,.0f}")
    for r in rows[:5]:
        print(f"   {r['h3_cell']}  {r['value']:>10,.0f}")
    if args.push:
        push(args.city, rows)


if __name__ == "__main__":
    main()
