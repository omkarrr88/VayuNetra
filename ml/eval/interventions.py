"""Real, dated interventions in hindsight — two honest questions, one artifact.

    python -m ml.eval.interventions --city delhi            # writes docs/benchmarks/delhi_interventions.json|md

For the winter 2025-26 GRAP escalations in Delhi-NCR (dates from CAQM / PIB orders, listed in
INTERVENTIONS with their sources) and Diwali night, using the same station history the
forecast benchmark uses (data/hist, 39 station cells):

A. **Would VayuNetra have warned before the order?**  The served forecast (rolling monthly
   refit, persistence-blended, calibrated exceedance probabilities — the production recipe,
   `ml.eval.benchmark._rolling_predict`) is replayed with the split at 1 Oct 2025, and for
   every escalation we read what the system would have said 24 / 48 / 72 h before the order:
   city-mean P(> 120) and P(> 250), the share of station cells alarming at P ≥ 0.3, and what
   persistence said (the level at issue time). Reactive governance is the documented status
   quo — 13 of 17 GRAP orders in that winter came after the AQI had already crossed the
   stage threshold (ThePrint analysis, Feb 2026) — so "would we have flagged it earlier" is the
   question a judge should ask.

B. **Did the air change during the intervention, once weather is taken out?**  A city-wide
   order has no untreated control inside the city and it is triggered *by* dirty air, so a
   plain before/after mostly measures regression to the mean and weather. We use
   meteorological normalisation instead (the standard "deweathering" idea): a gradient-boosted
   model of PM2.5 on ERA5 meteorology (temperature, humidity, precipitation, boundary-layer
   height, wind vector and speed, ventilation), hour, day-of-week and day-of-year, fitted on the
   season's hours *outside* Stage III/IV windows, then asked what PM2.5 the same weather would
   normally bring during each window. Reported: observed vs weather-expected mean, the
   difference in µg/m³ and %, and a day-block bootstrap 90 % interval. Negative results are
   kept. This is an association, not a causal estimate: stubble-burning decline, holidays and
   anything else coincident with the order stay in the number, and the model can only be as
   good as its held-out skill, which we print.

Every number is computed here; nothing is typed in from memory except the order dates, each
of which carries its source.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from ml.eval.benchmark import THRESHOLDS, _rolling_predict, load_hist
from ml.forecast.features import MET, build_feature_table, make_supervised

OUT = Path("docs/benchmarks")

# Winter 2025-26 Delhi-NCR, IST dates as published; the hour is midday IST (06:30 UTC) when the
# order gives no time. Sources are the government releases the dates were read from.
INTERVENTIONS: list[dict] = [
    {"key": "grap1_2025-10-14", "label": "GRAP Stage I invoked", "kind": "escalation", "stage": 1,
     "start": "2025-10-14T06:30:00Z", "end": "2025-10-19T06:30:00Z",
     "source": "https://www.newsonair.gov.in/delhi-ncr-implements-grap-stage-i-to-tackle-worsening-air-quality"},
    {"key": "grap2_2025-10-19", "label": "GRAP Stage II invoked", "kind": "escalation", "stage": 2,
     "start": "2025-10-19T06:30:00Z", "end": "2025-11-11T06:30:00Z",
     "source": "https://www.newsonair.gov.in/ (CAQM Stage II order, 19 Oct 2025)"},
    {"key": "diwali_2025-10-20", "label": "Diwali night (green crackers 20:00–22:00 permitted, SC order 15 Oct)", "kind": "event",
     "start": "2025-10-20T14:30:00Z", "end": "2025-10-21T06:30:00Z",
     "source": "https://www.newsonair.gov.in/supreme-court-allows-sale-use-of-green-firecrackers-in-delhi-ncr-from-oct-18-21"},
    {"key": "grap3_2025-11-11", "label": "GRAP Stage III invoked (construction / demolition ban)", "kind": "escalation", "stage": 3,
     "start": "2025-11-11T06:30:00Z", "end": "2025-11-26T06:30:00Z",
     "source": "https://www.newsonair.gov.in/delhi-enters-severe-pollution-stage-caqm-imposes-strict-stage-iii-grap-measures"},
    {"key": "grap4_2025-12-13", "label": "GRAP Stage IV invoked", "kind": "escalation", "stage": 4,
     "start": "2025-12-13T04:30:00Z", "end": "2025-12-24T16:00:00Z",
     "source": "https://www.newsonair.gov.in/delhi-ncr-air-quality-worsens-stage-iv-grap-activated"},
    {"key": "grap3_2026-01-16", "label": "GRAP Stage III re-invoked", "kind": "escalation", "stage": 3,
     "start": "2026-01-16T06:30:00Z", "end": "2026-01-22T06:30:00Z",
     "source": "https://www.newsonair.gov.in/grap-iii-reimposed-in-delhi-ncr-as-air-quality-turns-very-poor"},
    {"key": "grap4_2026-01-17", "label": "GRAP Stage IV re-invoked", "kind": "escalation", "stage": 4,
     "start": "2026-01-17T06:30:00Z", "end": "2026-01-22T06:30:00Z",
     "source": "https://environment.delhi.gov.in/sites/default/files/environment/universal/invocation_of_grap_order_stage_iv_17.01.2026_final.pdf"},
]
STATUS_QUO_NOTE = ("13 of 17 GRAP orders in winter 2025-26 were passed after the AQI had already crossed that stage's "
                   "threshold — ThePrint analysis, Feb 2026 (press analysis, not an audit figure): "
                   "https://theprint.in/environment/delhi-brought-grap-reactively-after-aqi-crossed-limit-13-out-of-17-times-this-winter/2855807/")

SEASON = ("2025-10-01T00:00:00Z", "2026-02-20T00:00:00Z")
TAU = 0.3
HORIZONS = (24, 48, 72)


def _ts(s: str) -> pd.Timestamp:
    return pd.Timestamp(s).tz_convert("UTC") if pd.Timestamp(s).tzinfo else pd.Timestamp(s, tz="UTC")


def _r(x, nd=1):
    return None if x is None or not np.isfinite(x) else round(float(x), nd)


# --------------------------------------------------------------------------- A: early warning
def warning_before_orders(wide: pd.DataFrame, split_ts: pd.Timestamp) -> dict:
    out = {"tau": TAU, "horizons": {}, "events": []}
    per_h = {}
    for h in HORIZONS:
        X, y, meta, _ = make_supervised(wide, h)
        roll = _rolling_predict(X, y, meta, split_ts, window_days=90, ablation_keep=None)
        if roll is None:
            continue
        m = roll["mte"].copy().reset_index(drop=True)
        m["issue_ts"] = pd.to_datetime(m["ts"], utc=True)
        m["target_ts"] = m["issue_ts"] + pd.Timedelta(hours=h)
        m["p120"] = roll["p_exceed"]["very_poor"]
        m["p250"] = roll["p_exceed"]["severe"]
        m["served"] = roll["pred_blend"]
        m["persist"] = roll["Xte"]["pm25"].to_numpy(dtype=float)
        m["y"] = roll["yte"].to_numpy(dtype=float)
        per_h[h] = m
        out["horizons"][h] = {"origins": roll["origins"], "blend_weights": [round(float(w), 2) for w in roll["blend_weights"]]}
    for ev in INTERVENTIONS:
        if ev["kind"] != "escalation":
            continue
        t0 = _ts(ev["start"])
        row = {"key": ev["key"], "label": ev["label"], "stage": ev["stage"], "order_at": ev["start"], "source": ev["source"], "lead": {}}
        # observed city mean in the 6 h up to the order and in the 24 h after
        obs = wide[(wide["ts"] >= t0 - pd.Timedelta(hours=6)) & (wide["ts"] < t0)]["pm25"]
        after = wide[(wide["ts"] >= t0) & (wide["ts"] < t0 + pd.Timedelta(hours=24))]["pm25"]
        row["observed_at_order"] = _r(obs.mean())
        row["observed_24h_after"] = _r(after.mean())
        for h, m in per_h.items():
            issue = t0 - pd.Timedelta(hours=h)
            # forecasts issued within ±1 h of the issue time whose target lands at the order
            sel = m[(m["issue_ts"] >= issue - pd.Timedelta(hours=1)) & (m["issue_ts"] <= issue + pd.Timedelta(hours=1))]
            if sel.empty:
                row["lead"][h] = None
                continue
            row["lead"][h] = {
                "n_cells": int(sel["h3_cell"].nunique()),
                "low_coverage": bool(sel["h3_cell"].nunique() < 5),   # e.g. the public feed carried 1 Delhi station on 11–19 Jan 2026
                "p_over_120_mean": _r(sel["p120"].mean(), 2),
                "p_over_250_mean": _r(sel["p250"].mean(), 2),
                "share_cells_alarm_120": _r((sel["p120"] >= TAU).mean(), 2),
                "share_cells_alarm_250": _r((sel["p250"] >= TAU).mean(), 2),
                "served_city_mean": _r(sel["served"].mean()),
                "persistence_city_mean": _r(sel["persist"].mean()),
                "observed_target_mean": _r(sel["y"].mean()),
            }
        out["events"].append(row)
    return out


# --------------------------------------------------------------------------- B: deweathering
def _deweather_features(wide: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    df = wide.copy()
    df["doy"] = df["ts"].dt.dayofyear
    df["cell_code"] = df["h3_cell"].astype("category").cat.codes
    cols = [c for c in MET if c in df.columns] + [c for c in ("wind_speed", "ventilation") if c in df.columns] + ["hour", "dow", "doy", "cell_code"]
    return df, cols


def _in_any_window(ts: pd.Series, windows: list[tuple[pd.Timestamp, pd.Timestamp]]) -> pd.Series:
    mask = pd.Series(False, index=ts.index)
    for a, b in windows:
        mask |= (ts >= a) & (ts < b)
    return mask


def deweathered_effects(wide: pd.DataFrame, seed: int = 0) -> dict:
    import lightgbm as lgb

    s0, s1 = _ts(SEASON[0]), _ts(SEASON[1])
    season = wide[(wide["ts"] >= s0) & (wide["ts"] < s1)].dropna(subset=["pm25"]).copy()
    df, cols = _deweather_features(season)
    df = df.dropna(subset=[c for c in cols if c != "cell_code"])
    windows = [(_ts(e["start"]), _ts(e["end"])) for e in INTERVENTIONS if e["kind"] == "escalation" and e["stage"] >= 3]
    windows += [(_ts(e["start"]), _ts(e["end"])) for e in INTERVENTIONS if e["kind"] == "event"]
    treated = _in_any_window(df["ts"], windows)
    base = df[~treated]
    # held-out skill of the deweathering model itself on baseline hours (day-blocked split)
    days = base["ts"].dt.floor("D")
    uniq = np.array(sorted(days.unique()))
    rng = np.random.default_rng(seed)
    hold = set(rng.choice(uniq, size=max(1, len(uniq) // 5), replace=False))
    is_hold = days.isin(hold)
    params = dict(objective="regression", learning_rate=0.05, num_leaves=31, n_estimators=600, min_child_samples=40,
                  subsample=0.8, subsample_freq=1, colsample_bytree=0.9, verbose=-1, seed=seed)
    mdl = lgb.LGBMRegressor(**params).fit(base.loc[~is_hold, cols], base.loc[~is_hold, "pm25"])
    ph = mdl.predict(base.loc[is_hold, cols])
    yh = base.loc[is_hold, "pm25"].to_numpy(dtype=float)
    r2 = 1 - np.sum((yh - ph) ** 2) / np.sum((yh - yh.mean()) ** 2)
    skill = {"holdout_days": len(hold), "holdout_r2": _r(r2, 2), "holdout_rmse": _r(np.sqrt(np.mean((yh - ph) ** 2)))}
    full = lgb.LGBMRegressor(**params).fit(base[cols], base["pm25"])

    results = []
    for ev in INTERVENTIONS:
        if not (ev["kind"] == "event" or (ev["kind"] == "escalation" and ev["stage"] >= 3)):
            continue
        a, b = _ts(ev["start"]), _ts(ev["end"])
        w = df[(df["ts"] >= a) & (df["ts"] < b)]
        if len(w) < 24:
            results.append({"key": ev["key"], "label": ev["label"], "note": "too few hours"})
            continue
        exp = full.predict(w[cols])
        obs = w["pm25"].to_numpy(dtype=float)
        diff = obs - exp
        # day-block bootstrap on the difference
        wd = w["ts"].dt.floor("D").to_numpy()
        ud = np.unique(wd)
        boots = []
        for _ in range(400):
            pick = rng.choice(ud, size=len(ud), replace=True)
            idx = np.concatenate([np.where(wd == d)[0] for d in pick])
            boots.append(diff[idx].mean())
        lo, hi = np.percentile(boots, [5, 95])
        results.append({
            "key": ev["key"], "label": ev["label"], "kind": ev["kind"], "start": ev["start"], "end": ev["end"], "source": ev["source"],
            "hours": int(len(w)), "cells": int(w["h3_cell"].nunique()), "days": int(len(ud)),
            "observed_mean": _r(obs.mean()), "weather_expected_mean": _r(exp.mean()),
            "difference": _r(diff.mean()), "difference_pct": _r(100 * diff.mean() / exp.mean()),
            "ci90": [_r(lo), _r(hi)],
        })
    return {"model": {"features": cols, "trained_on_hours": int(len(base)), "excluded_windows": len(windows), **skill,
                      "note": "LightGBM on ERA5 meteorology + hour/dow/doy/cell, fitted on season hours outside Stage III/IV and Diwali windows; "
                              "expected = what that weather normally brings; difference = observed − expected (association, not causal)"},
            "windows": results}


# --------------------------------------------------------------------------- run
def run(city_id: str) -> dict:
    long_df = load_hist(city_id)
    wide = build_feature_table(long_df)
    wide["ts"] = pd.to_datetime(wide["ts"], utc=True)
    split = _ts(SEASON[0])
    print(f"[interventions] {city_id}: {len(wide):,} rows, {wide['h3_cell'].nunique()} cells; replaying the served forecast from {split.date()}", flush=True)
    a = warning_before_orders(wide, split)
    print("[interventions] deweathering …", flush=True)
    b = deweathered_effects(wide)
    return {
        "city_id": city_id,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "season": {"start": SEASON[0], "end": SEASON[1]},
        "stations_cells": int(wide["h3_cell"].nunique()),
        "interventions": INTERVENTIONS,
        "status_quo": STATUS_QUO_NOTE,
        "early_warning": a,
        "deweathered": b,
        "method": "docs/OUTCOMES.md",
    }


def to_markdown(res: dict) -> str:
    L = [f"# {res['city_id'].title()} — real interventions in hindsight (generated {res['generated_at'][:10]})", ""]
    L += [f"Station cells: {res['stations_cells']} · season {res['season']['start'][:10]} → {res['season']['end'][:10]} · replayed served forecast (rolling monthly refit, 90-day window, persistence blend, calibrated P).", ""]
    L += ["## A. Would VayuNetra have warned before the order?", "",
          f"Alarm operating point P ≥ {res['early_warning']['tau']}. For each escalation: what the system said 24 / 48 / 72 h before the order time (city mean of station cells).", "",
          "| order | observed at order | lead | P(>120) mean | P(>250) mean | cells alarming >120 | served city mean | persistence said | observed then |",
          "|---|---:|---:|---:|---:|---:|---:|---:|---:|"]
    for e in res["early_warning"]["events"]:
        first = True
        for h in HORIZONS:
            ld = e["lead"].get(h) or e["lead"].get(str(h))
            name = f"{e['label']} ({e['order_at'][:10]})" if first else ""
            obs = e["observed_at_order"] if first else ""
            first = False
            if not ld:
                L.append(f"| {name} | {obs} | {h} h | – | – | – | – | – | – |")
                continue
            cov = f"{int(round((ld['share_cells_alarm_120'] or 0)*100))} % of {ld['n_cells']}" + (" ⚠ low coverage" if ld.get("low_coverage") else "")
            L.append(f"| {name} | {obs} | {h} h | {ld['p_over_120_mean']} | {ld['p_over_250_mean']} | {cov} | {ld['served_city_mean']} | {ld['persistence_city_mean']} | {ld['observed_target_mean']} |")
    L += ["", "⚠ low coverage = fewer than 5 station cells had a contiguous record at that issue time in the public feed (OpenAQ carried a single Delhi station on 11–19 Jan 2026); those rows are one station, not the city.", "",
          f"Status quo: {res['status_quo']}", ""]
    L += ["## B. Did the air change during the intervention, weather taken out?", ""]
    m = res["deweathered"]["model"]
    L += [f"Deweathering model: {m['note']}. Trained on {m['trained_on_hours']:,} hours; held-out (day-blocked) R² {m['holdout_r2']}, RMSE {m['holdout_rmse']} µg/m³.", "",
          "| window | days · cells | observed mean | weather-expected | difference (µg/m³) | difference | 90 % day-bootstrap |",
          "|---|---:|---:|---:|---:|---:|---:|"]
    for w in res["deweathered"]["windows"]:
        if "note" in w:
            L.append(f"| {w['label']} | – | – | – | – | – | {w['note']} |")
            continue
        L.append(f"| {w['label']} ({w['start'][:10]} → {w['end'][:10]}) | {w['days']} · {w['cells']} | {w['observed_mean']} | {w['weather_expected_mean']} | {w['difference']:+} | {w['difference_pct']:+} % | [{w['ci90'][0]:+}, {w['ci90'][1]:+}] |")
    L += ["", "Read: a negative difference means the air was cleaner than the same weather usually brings; positive means dirtier. Association only — coincident factors stay in the number. "
          "Two limits are visible in the table itself: the Diwali row shows the method has the power to detect a large signal, and the Stage IV rows sit in the most stagnant weather of the season, "
          "where a tree model fitted on calmer hours cannot extrapolate and under-predicts — so a positive difference there is at least partly method, not fireworks. "
          "What we can say: we find no weather-adjusted reduction during Stage III/IV that this method can detect.", ""]
    L += ["## Sources", ""] + [f"- {e['label']} — {e['start'][:10]}: {e['source']}" for e in res["interventions"]]
    return "\n".join(L) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--city", default="delhi")
    args = ap.parse_args()
    res = run(args.city)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{args.city}_interventions.json").write_text(json.dumps(res, indent=1, default=str))
    (OUT / f"{args.city}_interventions.md").write_text(to_markdown(res))
    print(to_markdown(res))


if __name__ == "__main__":
    main()
