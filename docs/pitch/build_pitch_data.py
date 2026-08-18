"""Assemble every number the pitch deck animates, from the repo's own artifacts and the running
API — nothing typed in. Writes docs/pitch/pitch_data.json (git-ignored copy in the built HTML).

    .venv/bin/python docs/pitch/build_pitch_data.py            # API on :8000 (DEMO_MODE=false)
"""
from __future__ import annotations

import gzip
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import h3
import pandas as pd
import requests
import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
import core.env  # noqa: E402,F401

API = os.environ.get("PITCH_API", "http://localhost:8000")
ANON = os.environ.get("SUPABASE_ANON_KEY", "")
H = {"Authorization": f"Bearer {ANON}", "apikey": ANON} if ANON else {}
SCRATCH = Path(os.environ.get("PITCH_SCRATCH", "/tmp/claude-1000/-home-omkar-kadam-Desktop-VayuNetra/82517b60-1549-4f2d-9b8e-cf0e3c4d1f0e/scratchpad"))
OUT = ROOT / "docs" / "pitch" / "pitch_data.json"


def get(path, tries: int = 4):
    import time
    last = None
    for i in range(tries):
        r = requests.get(API + path, headers=H, timeout=180)
        j = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.ok and isinstance(j, dict) and j.get("data") is not None:
            return j["data"]
        last = (r.status_code, str(j)[:200])
        print(f"  retry {i+1} {path}: {last}", flush=True)
        time.sleep(3 * (i + 1))
    raise SystemExit(f"{path} failed: {last}")


def cities():
    out = []
    for p in sorted((ROOT / "core" / "config" / "cities").glob("*.yml")):
        c = yaml.safe_load(p.read_text())
        out.append({"city_id": c["city_id"], "name": c["name"], "center": c.get("center") or c.get("centre"), "languages": c.get("languages", [])})
    comp = {c["city_id"]: c for c in get("/comparison")["cities"]}
    for c in out:
        m = comp.get(c["city_id"], {})
        c.update({"pm25": m.get("current_pm25"), "pm25_24h": m.get("forecast_24h_pm25"), "trend": m.get("trend"), "dominant_source": m.get("dominant_source")})
    return out


def delhi_winter():
    df = pd.read_csv(gzip.open(ROOT / "data/hist/delhi_pm25.csv.gz", "rt"))
    df["ts"] = pd.to_datetime(df["ts"], utc=True)
    w = df[(df["ts"] >= "2025-10-01") & (df["ts"] < "2026-02-20") & (df["variable"] == "pm25")]
    daily = w.groupby([w["ts"].dt.floor("D"), "h3_cell"])["value"].mean().reset_index()
    days = sorted(daily["ts"].unique())
    cells = sorted(daily["h3_cell"].unique())
    idx = {c: i for i, c in enumerate(cells)}
    grid = [[None] * len(cells) for _ in days]
    dpos = {d: i for i, d in enumerate(days)}
    for _, r in daily.iterrows():
        grid[dpos[r["ts"]]][idx[r["h3_cell"]]] = round(float(r["value"]))
    hourly = w.groupby(w["ts"].dt.floor("h"))["value"].mean()
    return {
        "days": [d.strftime("%Y-%m-%d") for d in days],
        "cells": [{"id": c, "ring": [[round(lat, 4), round(lng, 4)] for lat, lng in h3.cell_to_boundary(c)]} for c in cells],
        "daily": grid,
        "hourly": {"t0": hourly.index.min().isoformat(), "values": [round(float(v)) if pd.notna(v) else None for v in hourly.reindex(pd.date_range(hourly.index.min(), hourly.index.max(), freq="h", tz="UTC"))]},
    }


def delhi_year_daily():
    df = pd.read_csv(gzip.open(ROOT / "data/hist/delhi_pm25.csv.gz", "rt"))
    df["ts"] = pd.to_datetime(df["ts"], utc=True)
    end = df["ts"].max()
    w = df[(df["ts"] > end - pd.Timedelta(days=365)) & (df["variable"] == "pm25")]
    d = w.groupby(w["ts"].dt.floor("D"))["value"].agg(["mean", "count"]).reset_index()
    return [{"date": r["ts"].strftime("%Y-%m-%d"), "pm25": round(float(r["mean"]), 1), "n": int(r["count"])} for _, r in d.iterrows() if r["count"] >= 24]


def delhi_outline():
    from shapely.geometry import shape
    from shapely.ops import unary_union
    g = json.load(open(ROOT / "web/public/wards/delhi.geojson"))
    u = unary_union([shape(f["geometry"]) for f in g["features"]]).simplify(0.003)
    polys = u.geoms if u.geom_type == "MultiPolygon" else [u]
    return [[[round(lat, 4), round(lng, 4)] for lng, lat in p.exterior.coords] for p in polys if p.area > 0.001]


def advisories():
    from agents.advisory import SUPPORTED_LANGS, render_message
    names = {"en": "English", "hi": "Hindi", "kn": "Kannada", "mr": "Marathi", "ta": "Tamil", "te": "Telugu", "bn": "Bengali", "gu": "Gujarati"}
    return [{"lang": l, "name": names[l], "text": render_message("Delhi", "Ward 12", "very_poor", 24, l)} for l in SUPPORTED_LANGS]


def main():
    data = {
        "built_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "india": json.load(open(SCRATCH / "india_outline.json")),
        "cities": cities(),
        "snapshot": get("/landing/snapshot"),
        "roi_delhi": get("/roi?city=delhi"),
        "exposure_delhi": get("/exposure?city=delhi"),
        "benchmarks": {c: get(f"/metrics/benchmark?city={c}") for c in ["delhi", "mumbai", "kolkata", "bengaluru", "hyderabad", "chennai", "pune", "ahmedabad", "jaipur", "lucknow"]},
        "benchmark_full_delhi": get("/metrics/benchmark?city=delhi&full=true")["history"],
        "interventions": get("/metrics/interventions?city=delhi"),
        "attribution_methods": get("/metrics/attribution"),
        "trend_delhi_1y": get("/history/trend?city=delhi&days=365"),
        "latency": get("/latency?city=delhi"),
        "advisories": advisories(),
        "winter": delhi_winter(),
        "delhi_outline": delhi_outline(),
        "delhi_year_daily": delhi_year_daily(),
    }
    OUT.write_text(json.dumps(data, separators=(",", ":"), default=str))
    print("wrote", OUT, OUT.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
