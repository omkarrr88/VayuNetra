"""Leave-one-station-out validation of the 1 km field — against REAL held-out stations.

The dense field's published skill (+55% over bilinear) was measured on SYNTHETIC fields. That
established the downscaler learns something; it never established that a cell WITHOUT a monitor
carries a trustworthy number, which is what "1 km resolution" is taken to mean.

This is the test that does. For each city, for each station cell in turn:

    hide that station -> rebuild the field from the remaining stations
    -> read the value the field predicts at the hidden cell
    -> compare against what that station actually measured

and score it against two baselines a sceptic would reach for first:

    city mean       predict the city average everywhere (the "why bother" baseline)
    IDW of the rest inverse-distance weighting from the remaining stations only

A model that cannot beat the city mean at a held-out station is not resolving anything spatial,
whatever it scores on synthetic data.

    .venv/bin/python scripts/validate_dense_field.py --city delhi
    .venv/bin/python scripts/validate_dense_field.py --all --write
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import core.env  # noqa: E402,F401


def _station_anchors(city_id: str) -> list[dict]:
    """One anchor per station cell: its most recent PM2.5, with the cell's centre."""
    import h3

    from core.supa import load_measurements

    rows = [r for r in load_measurements(city_id) if r.get("variable") == "pm25"]
    latest: dict[str, dict] = {}
    for r in rows:
        c, ts = r.get("h3_cell"), r.get("ts")
        if not c or r.get("value") is None:
            continue
        if c not in latest or ts > latest[c]["ts"]:
            latest[c] = {"ts": ts, "value": float(r["value"])}
    out = []
    for cell, v in latest.items():
        lat, lng = h3.cell_to_latlng(cell)
        out.append({"h3_cell": cell, "lat": lat, "lng": lng, "pm25": v["value"]})
    return out


def _idw_at(anchors: list[dict], lat: float, lng: float, power: float = 2.0) -> float:
    num = den = 0.0
    for a in anchors:
        d2 = (a["lng"] - lng) ** 2 + (a["lat"] - lat) ** 2
        if d2 < 1e-12:
            return a["pm25"]
        w = 1.0 / d2 ** (power / 2)
        num += w * a["pm25"]
        den += w
    return num / den if den else float("nan")


def _field_at(city_id: str, bbox, anchors: list[dict], cell: str) -> float | None:
    """Rebuild the dense field from `anchors` and read it at `cell`."""
    from ml.coverage.dense_field import build_dense_field

    field = build_dense_field(city_id, bbox, anchors=anchors)
    for c in field.get("cells", []):
        if (c.get("h3_cell") or c.get("cell")) == cell:
            v = c.get("pm25")
            return float(v) if v is not None else None
    return None


def run(city_id: str, min_stations: int = 4) -> dict | None:
    from core.cities import load_city

    cfg = load_city(city_id)
    bbox = cfg["bbox"]
    anchors = _station_anchors(city_id)
    if len(anchors) < min_stations:
        print(f"{city_id}: only {len(anchors)} station cells — too few to hold one out")
        return None

    truth, pred_field, pred_idw = [], [], []
    for i, held in enumerate(anchors):
        rest = anchors[:i] + anchors[i + 1:]
        got = _field_at(city_id, bbox, rest, held["h3_cell"])
        if got is None:
            continue
        truth.append(held["pm25"])
        pred_field.append(got)
        pred_idw.append(_idw_at(rest, held["lat"], held["lng"]))

    if len(truth) < min_stations:
        print(f"{city_id}: only {len(truth)} usable folds")
        return None

    t = np.array(truth, dtype=float)
    f = np.array(pred_field, dtype=float)
    w = np.array(pred_idw, dtype=float)
    m = np.full_like(t, statistics.fmean(truth))          # city-mean baseline

    def rmse(a):  return float(np.sqrt(np.mean((t - a) ** 2)))
    def mae(a):   return float(np.mean(np.abs(t - a)))

    res = {
        "city_id": city_id,
        "n_stations_held_out": len(truth),
        "observed_mean": round(float(t.mean()), 2),
        "observed_sd": round(float(t.std(ddof=1)), 2) if len(t) > 1 else None,
        "rmse_dense_field": round(rmse(f), 2),
        "rmse_idw_remaining": round(rmse(w), 2),
        "rmse_city_mean": round(rmse(m), 2),
        "mae_dense_field": round(mae(f), 2),
        "mae_city_mean": round(mae(m), 2),
        "skill_vs_city_mean": round(1 - rmse(f) / rmse(m), 3) if rmse(m) else None,
        "skill_vs_idw": round(1 - rmse(f) / rmse(w), 3) if rmse(w) else None,
        "protocol": "leave-one-station-out on real held-out CPCB/OpenAQ stations",
    }
    return res


def _print(r: dict) -> None:
    print(f"\n=== {r['city_id']} — {r['n_stations_held_out']} stations held out one at a time ===")
    print(f"  observed at the held-out station: mean {r['observed_mean']} sd {r['observed_sd']} µg/m³")
    print(f"  RMSE  dense field {r['rmse_dense_field']:>7}   IDW of the rest {r['rmse_idw_remaining']:>7}"
          f"   city mean {r['rmse_city_mean']:>7}")
    s1, s2 = r["skill_vs_city_mean"], r["skill_vs_idw"]
    verdict = "beats" if (s1 or 0) > 0 else "does NOT beat"
    print(f"  skill vs city mean {s1:+.3f}  ({verdict} predicting the city average)")
    print(f"  skill vs IDW       {s2:+.3f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--write", action="store_true", help="write docs/COVERAGE_VALIDATION.json")
    a = ap.parse_args()

    from core.cities import list_city_ids

    cities = list_city_ids() if a.all else [a.city]
    results = []
    for c in cities:
        try:
            r = run(c)
        except Exception as e:  # noqa: BLE001 — one city must not stop the sweep
            print(f"{c}: FAILED {e}")
            continue
        if r:
            results.append(r)
            _print(r)
    if a.write and results:
        out = ROOT / "docs" / "COVERAGE_VALIDATION.json"
        out.write_text(json.dumps({"generated_at": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc).isoformat(timespec="seconds"),
            "cities": results}, indent=1))
        print(f"\nwrote {out}")
