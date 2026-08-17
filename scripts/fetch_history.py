"""Pull multi-season historical PM2.5 + ERA5 meteorology for the forecast benchmark.

    python scripts/fetch_history.py --city delhi --start 2023-10-01 --end 2025-03-31

Writes local, git-ignored files under data/hist/ (never the production DB):
    data/hist/<city>_pm25.csv.gz     canonical measurement rows (OpenAQ v3, CPCB stations)
    data/hist/<city>_met.csv.gz      canonical met rows (Open-Meteo ERA5 archive)

The benchmark harness (ml/eval) reads these to run a strict temporal-split backtest
over real winter episodes — the season where forecasting actually matters and where the
90-day live retention window has nothing to show in August.
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import core.env  # noqa: F401,E402  (loads .env)
from connectors import openaq, openmeteo  # noqa: E402
from core.cities import load_city  # noqa: E402

OUT_DIR = Path("data/hist")


def _write_rows(path: Path, rows: list[dict]) -> None:
    import csv

    path.parent.mkdir(parents=True, exist_ok=True)
    cols = ["city_id", "h3_cell", "station_id", "ts", "variable", "value", "unit", "source", "confidence"]
    with gzip.open(path, "wt", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def fetch_pm25(city_id: str, start: str, end: str, max_stations: int, variables: tuple[str, ...]) -> list[dict]:
    """Stations that were already reporting at `start` and still reporting at `end`.

    OpenAQ lists two sensor ids per pollutant on many CPCB stations (a legacy and a
    re-ingested one); we try each until one returns history for the window.
    """
    cfg = load_city(city_id)
    lng, lat = cfg["center"]
    data = openaq._get("/locations", {"coordinates": f"{lat},{lng}",
                                      "radius": cfg.get("station_radius_m", 25000), "limit": 100})
    locs = []
    for loc in data.get("results", []):
        first = ((loc.get("datetimeFirst") or {}).get("utc") or "9999")[:10]
        last = ((loc.get("datetimeLast") or {}).get("utc") or "0000")[:10]
        if first <= start and last >= end:
            locs.append(loc)
    locs = locs[:max_stations]
    print(f"  {city_id}: {len(locs)} stations span {start}..{end}")
    records: list[dict] = []
    for i, loc in enumerate(locs, 1):
        coords = loc.get("coordinates") or {}
        for var in variables:
            cands = [s for s in loc.get("sensors", []) if (s.get("parameter") or {}).get("name") == var]
            got = 0
            for s in cands:
                sensor = {"sensor_id": s["id"], "variable": var, "unit": (s.get("parameter") or {}).get("units"),
                          "lat": coords.get("latitude"), "lng": coords.get("longitude"), "station_id": str(loc.get("id"))}
                recs = _fetch_chunked(sensor, start, end)
                if recs:
                    records.extend(recs)
                    got = len(recs)
                    break
            print(f"    [{i}/{len(locs)}] {(loc.get('name') or '')[:32]:<32} {var}: {got} pts", flush=True)
    return openaq.rows_from_records(city_id, records, cfg.get("h3_res", 8))


def _fetch_chunked(sensor: dict, start: str, end: str, chunk_days: int = 60) -> list[dict]:
    """OpenAQ times out (408) on long windows for busy sensors — pull in ~2-month chunks
    and shrink the chunk on a timeout rather than dropping the station."""
    from datetime import date, timedelta

    d0, d1 = date.fromisoformat(start), date.fromisoformat(end)
    recs: list[dict] = []
    cur, step = d0, chunk_days
    while cur <= d1:
        nxt = min(cur + timedelta(days=step - 1), d1)
        try:
            recs.extend(openaq.fetch_sensor_hourly(sensor, f"{cur}T00:00:00Z", f"{nxt}T23:59:59Z", max_pages=6))
            cur, step = nxt + timedelta(days=1), chunk_days
        except Exception as e:  # noqa: BLE001 — timeouts: halve the chunk, then give up on that slice
            if step > 10:
                step = max(10, step // 2)
                continue
            print(f"      sensor {sensor['sensor_id']} {cur}..{nxt} failed: {str(e)[:60]}")
            cur = nxt + timedelta(days=1)
    return recs


def fetch_met(city_id: str, start: str, end: str) -> list[dict]:
    # ERA5 archive is capped per request; pull in ≤ 6-month chunks and concatenate.
    from datetime import date, timedelta

    cfg = load_city(city_id)
    lng, lat = cfg["center"]
    from core.spatial.h3_utils import latlng_to_cell

    cell = latlng_to_cell(lat, lng, cfg.get("h3_res", 8))
    d0, d1 = date.fromisoformat(start), date.fromisoformat(end)
    rows: list[dict] = []
    cur = d0
    while cur <= d1:
        nxt = min(cur + timedelta(days=180), d1)
        hourly = openmeteo.fetch_hourly_archive(lat, lng, cur.isoformat(), nxt.isoformat())
        rows.extend(openmeteo.build_measurements(city_id, cell, hourly))
        print(f"    met {cur}..{nxt}: {len(rows)} rows so far", flush=True)
        cur = nxt + timedelta(days=1)
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--start", default="2023-10-01")
    ap.add_argument("--end", default="2025-03-31")
    ap.add_argument("--max-stations", type=int, default=40)
    ap.add_argument("--variables", default="pm25", help="comma list, e.g. pm25,pm10,no2")
    ap.add_argument("--skip-met", action="store_true")
    ap.add_argument("--skip-pm", action="store_true")
    args = ap.parse_args()
    variables = tuple(v.strip() for v in args.variables.split(",") if v.strip())

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    meta = {"city_id": args.city, "start": args.start, "end": args.end, "variables": variables,
            "pulled_at": datetime.now(timezone.utc).isoformat()}
    if not args.skip_met:
        met = fetch_met(args.city, args.start, args.end)
        _write_rows(OUT_DIR / f"{args.city}_met.csv.gz", met)
        meta["met_rows"] = len(met)
        print(f"  wrote {len(met)} met rows")
    if not args.skip_pm:
        pm = fetch_pm25(args.city, args.start, args.end, args.max_stations, variables)
        _write_rows(OUT_DIR / f"{args.city}_pm25.csv.gz", pm)
        meta["pm_rows"] = len(pm)
        meta["stations"] = len({r["station_id"] for r in pm})
        print(f"  wrote {len(pm)} pollutant rows from {meta['stations']} stations")
    (OUT_DIR / f"{args.city}_meta.json").write_text(json.dumps(meta, indent=1))


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    main()
