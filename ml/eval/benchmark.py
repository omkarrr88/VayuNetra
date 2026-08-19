"""Temporal-split forecast benchmark — the numbers we are willing to be judged on.

    python -m ml.eval.benchmark --city delhi --source hist --split 2025-11-01
    python -m ml.eval.benchmark --city mumbai --source live            # last-quarter split on live rows

Rules (the same ones a sceptical reviewer would impose):
  * strict temporal split — train strictly before `split`, test strictly after; no shuffling
  * one shared support mask — every forecaster is scored on exactly the same rows
  * baselines that are actually hard: persistence, weekly seasonal-naive, hour-of-day climatology
  * regime slices reported separately (winter, high-pollution hours) — never averaged away
  * every number here is recomputed by this script from real station data; nothing is typed in

Outputs docs/benchmarks/<city>.json (+ .md) consumed by GET /metrics/benchmark and the UI.
"""
from __future__ import annotations

import argparse
import gzip
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from ml.forecast.baselines import rmse
from ml.forecast.features import MET, build_feature_table, make_supervised
from ml.forecast.train import QUANTILES, _cqr_models_and_q, _fit_predict

HORIZONS = (24, 48, 72)
# CPCB PM2.5 bands: Poor > 90, Very Poor > 120, Severe > 250 (µg/m³)
THRESHOLDS = {"poor": 90.0, "very_poor": 120.0, "severe": 250.0}
WINTER_MONTHS = (11, 12, 1, 2)
DERIVED_MET = ("wind_speed", "ventilation", "advected_pm25")
OUT_DIR = Path("docs/benchmarks")


# --- data ------------------------------------------------------------------------
def load_hist(city_id: str) -> pd.DataFrame:
    base = Path("data/hist")
    frames = []
    for name in (f"{city_id}_pm25.csv.gz", f"{city_id}_met.csv.gz"):
        p = base / name
        if p.exists():
            with gzip.open(p, "rt") as f:
                frames.append(pd.read_csv(f))
    if not frames:
        raise SystemExit(f"no history under data/hist for {city_id}; run scripts/fetch_history.py first")
    return pd.concat(frames, ignore_index=True)


def load_live(city_id: str, days: int = 90) -> pd.DataFrame:
    """Live rows, restricted to the production retention window (last `days`) so the
    benchmark reflects what the deployed model actually trains on."""
    from core.supa import load_measurements

    df = pd.DataFrame(load_measurements(city_id))
    if len(df) and days:
        ts = pd.to_datetime(df["ts"], utc=True)
        df = df[ts >= ts.max() - pd.Timedelta(days=days)]
    return df


# --- helpers ---------------------------------------------------------------------
def _seasonal_naive(wide: pd.DataFrame, meta: pd.DataFrame, horizon_h: int, period_h: int = 168) -> np.ndarray:
    """Weekly seasonal-naive: yhat(t+h) = pm25 observed at t+h-168 (same hour, one week earlier)."""
    lookup = {(c, t): v for c, t, v in zip(wide["h3_cell"], wide["ts"], wide["pm25"])}
    shift = pd.Timedelta(hours=horizon_h - period_h)
    return np.array([lookup.get((c, t + shift), np.nan) for c, t in zip(meta["h3_cell"], meta["ts"])], dtype=float)


def _split(X, y, meta, split_ts: pd.Timestamp):
    order = meta.sort_values("ts").index
    X, y, meta = X.loc[order].reset_index(drop=True), y.loc[order].reset_index(drop=True), meta.loc[order].reset_index(drop=True)
    tr = meta["ts"] < split_ts
    te = ~tr
    return (X[tr], y[tr], meta[tr]), (X[te], y[te], meta[te])


def _prf(alarm: np.ndarray, event: np.ndarray) -> dict:
    tp = int((alarm & event).sum())
    fp = int((alarm & ~event).sum())
    fn = int((~alarm & event).sum())
    p = tp / (tp + fp) if tp + fp else None
    r = tp / (tp + fn) if tp + fn else None
    f1 = (2 * p * r / (p + r)) if p and r else (0.0 if (p is not None and r is not None) else None)
    return {"precision": _r(p), "recall": _r(r), "f1": _r(f1), "tp": tp, "fp": fp, "fn": fn}


def _r(x, nd: int = 3):
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    return round(f, nd) if math.isfinite(f) else None


def _slice_metrics(y, preds: dict[str, np.ndarray], mask: np.ndarray) -> dict:
    n = int(mask.sum())
    if n == 0:
        return {"n": 0}
    out = {"n": n}
    yv = y[mask]
    rp = rmse(yv, preds["persistence"][mask])
    for name, arr in preds.items():
        rm = rmse(yv, arr[mask])
        out[f"rmse_{name}"] = _r(rm, 2)
        out[f"mae_{name}"] = _r(np.mean(np.abs(yv - arr[mask])), 2)
        if name != "persistence":
            out[f"skill_{name}_vs_persistence"] = _r(1 - rm / rp) if rp else None
    return out


MIN_ROWS_PER_COVERAGE_BIN = 400


def _conditional_coverage(level: np.ndarray, inside: np.ndarray, bins: int = 5) -> list[dict] | None:
    """Coverage within each quintile of the PREDICTED level.

    Returns None rather than a misleading table when there is too little to split. At 400 rows a
    bin, 0.80 carries a standard error of about 0.02 — tight enough that a 0.67 means something.
    Below that the table would invite exactly the over-reading that the single-origin live
    benchmark already caused once: a few hundred rows swing on regime luck, and splitting them
    five ways makes each cell noisier still.
    """
    n = len(level)
    if n < bins * MIN_ROWS_PER_COVERAGE_BIN:
        return None
    edges = np.quantile(level, np.linspace(0, 1, bins + 1))
    out = []
    for i in range(bins):
        m = (level >= edges[i]) & ((level <= edges[i + 1]) if i == bins - 1 else (level < edges[i + 1]))
        if not m.sum():
            continue
        out.append({"predicted_range": [_r(float(edges[i]), 1), _r(float(edges[i + 1]), 1)],
                    "n": int(m.sum()), "coverage": _r(float(inside[m].mean()))})
    return out


def _reliability(p: np.ndarray, event: np.ndarray, bins: int = 10) -> list[dict]:
    edges = np.linspace(0, 1, bins + 1)
    rows = []
    for i in range(bins):
        m = (p >= edges[i]) & (p < edges[i + 1] if i < bins - 1 else p <= edges[i + 1])
        if m.sum() == 0:
            continue
        rows.append({"bin": f"{edges[i]:.1f}-{edges[i+1]:.1f}", "n": int(m.sum()),
                     "mean_forecast_p": _r(p[m].mean()), "observed_freq": _r(event[m].mean())})
    return rows


def _blend_weight(model_pred: np.ndarray, persistence: np.ndarray, y: np.ndarray) -> float:
    """Same rule production applies (ml.forecast.train.blend_weight) — one implementation."""
    from ml.forecast.train import blend_weight

    return blend_weight(model_pred, persistence, y)


# --- core ------------------------------------------------------------------------
def _rolling_predict(X, y, meta, split_ts: pd.Timestamp, window_days: int | None, ablation_keep: list[str] | None):
    """Rolling-origin monthly refit — how the deployed system actually behaves.

    For each calendar month M on/after `split_ts`: fit on rows strictly before M
    (optionally only the last `window_days`, mirroring the production retention window),
    predict every row inside M. Returns the concatenated test predictions plus, for the
    same origins, the CQR band, the calibration residual pool and the no-met prediction.
    """
    order = meta.sort_values("ts").index
    X, y, meta = X.loc[order].reset_index(drop=True), y.loc[order].reset_index(drop=True), meta.loc[order].reset_index(drop=True)
    ts = meta["ts"]
    months = sorted({(t.year, t.month) for t in ts[ts >= split_ts]})
    idx_te, pred, lo, hi, pred_nomet = [], [], [], [], []
    resid_pool = []
    pex = {band: [] for band in THRESHOLDS}
    pblend, weights = [], []
    for (yy, mm) in months:
        m0 = pd.Timestamp(year=yy, month=mm, day=1, tz="UTC")
        m1 = (m0 + pd.offsets.MonthBegin(1))
        te = (ts >= max(m0, split_ts)) & (ts < m1)
        tr = ts < m0
        if window_days:
            tr &= ts >= (m0 - pd.Timedelta(days=window_days))
        if tr.sum() < 500 or te.sum() == 0:
            continue
        Xtr, ytr, Xte = X[tr], y[tr], X[te]
        _, p = _fit_predict(Xtr, ytr, Xte, QUANTILES["value"])
        lo_m, hi_m, q = _cqr_models_and_q(Xtr, ytr)
        lo_v = np.asarray(lo_m.predict(Xte)) - q
        hi_v = np.asarray(hi_m.predict(Xte)) + q
        fit_n = int(len(Xtr) * 0.75)
        _, cal_pred = _fit_predict(Xtr.iloc[:fit_n], ytr.iloc[:fit_n], Xtr.iloc[fit_n:], QUANTILES["value"])
        cal_pred = np.asarray(cal_pred, dtype=float)
        ycal = ytr.iloc[fit_n:].to_numpy(dtype=float)
        # convex blend with persistence, weight chosen on the SAME calibration tail (no test leakage);
        # residuals and exceedance probabilities are then computed for the served (blended) forecast
        pers_cal = Xtr.iloc[fit_n:]["pm25"].to_numpy(dtype=float)
        w = _blend_weight(cal_pred, pers_cal, ycal)
        weights.append(w)
        cal_blend = w * cal_pred + (1 - w) * np.where(np.isfinite(pers_cal), pers_cal, cal_pred)
        r = ycal - cal_blend
        r = np.sort(r[np.isfinite(r)])
        resid_pool.append(r)
        pers_te = Xte["pm25"].to_numpy(dtype=float)
        pp = w * np.asarray(p, dtype=float) + (1 - w) * np.where(np.isfinite(pers_te), pers_te, np.asarray(p, dtype=float))
        pblend.append(pp)
        # per-origin calibrated exceedance probabilities (exactly what production serves)
        for band, thr in THRESHOLDS.items():
            if len(r) >= 50:
                pex[band].append(1.0 - np.searchsorted(r, thr - pp, side="right") / len(r))
            else:
                pex[band].append(np.full(len(pp), np.nan))
        if ablation_keep:
            _, pn = _fit_predict(Xtr[ablation_keep], ytr, Xte[ablation_keep], QUANTILES["value"])
            pred_nomet.append(np.asarray(pn, dtype=float))
        idx_te.append(np.where(te)[0])
        pred.append(np.asarray(p, dtype=float))
        lo.append(lo_v)
        hi.append(hi_v)
        print(f"    origin {yy}-{mm:02d}: train {int(tr.sum()):,} test {int(te.sum()):,}", flush=True)
    if not idx_te:
        return None
    ix = np.concatenate(idx_te)
    out = {
        "Xte": X.iloc[ix], "yte": y.iloc[ix], "mte": meta.iloc[ix],
        "pred": np.concatenate(pred), "lo": np.concatenate(lo), "hi": np.concatenate(hi),
        "resid": np.sort(np.concatenate(resid_pool)) if resid_pool else np.array([]),
        "p_exceed": {band: np.concatenate(v) for band, v in pex.items()},
        "pred_blend": np.concatenate(pblend),
        "blend_weights": weights,
        "pred_nomet": np.concatenate(pred_nomet) if pred_nomet else None,
        "n_train_last": int(len(X[ts < pd.Timestamp(year=months[-1][0], month=months[-1][1], day=1, tz="UTC")])),
        "origins": len(idx_te),
    }
    return out


def evaluate_horizon(wide: pd.DataFrame, horizon_h: int, split_ts: pd.Timestamp, ablation: bool = True,
                     protocol: str = "single", window_days: int | None = None) -> dict:
    X, y, meta, feature_cols = make_supervised(wide, horizon_h)
    drop = [c for c in feature_cols if c in MET or c in DERIVED_MET]
    keep = [c for c in feature_cols if c not in drop]
    rolling = None
    if protocol == "rolling":
        rolling = _rolling_predict(X, y, meta, split_ts, window_days, keep if (ablation and drop and keep) else None)
        if rolling is None:
            return {"horizon_h": horizon_h, "note": "insufficient data for rolling protocol"}
        Xte, yte, mte = rolling["Xte"], rolling["yte"], rolling["mte"]
        pred = rolling["pred"]
        n_train = rolling["n_train_last"]
    else:
        (Xtr, ytr, mtr), (Xte, yte, mte) = _split(X, y, meta, split_ts)
        if len(Xtr) < 500 or len(Xte) < 100:
            return {"horizon_h": horizon_h, "n_train": int(len(Xtr)), "n_test": int(len(Xte)), "note": "insufficient data"}
        _, pred = _fit_predict(Xtr, ytr, Xte, QUANTILES["value"])
        pred = np.asarray(pred, dtype=float)
        n_train = int(len(Xtr))
    persistence = Xte["pm25"].to_numpy(dtype=float)
    seasonal = _seasonal_naive(wide, mte, horizon_h)
    if rolling is not None:   # climatology from everything before the split (no leakage)
        pre = meta["ts"] < split_ts
        clim_map = y[pre].groupby(X.loc[pre, "hour"]).mean()
        clim_fill = float(y[pre].mean())
    else:
        clim_map = ytr.groupby(Xtr["hour"]).mean()
        clim_fill = float(ytr.mean())
    climatology = Xte["hour"].map(clim_map).fillna(clim_fill).to_numpy(dtype=float)
    yv = yte.to_numpy(dtype=float)
    if rolling is not None:
        pred_blend = rolling["pred_blend"]
        blend_w = rolling["blend_weights"]
    else:
        fit_n = int(len(Xtr) * 0.75)
        _, cal_pred_b = _fit_predict(Xtr.iloc[:fit_n], ytr.iloc[:fit_n], Xtr.iloc[fit_n:], QUANTILES["value"])
        w_single = _blend_weight(np.asarray(cal_pred_b, dtype=float), Xtr.iloc[fit_n:]["pm25"].to_numpy(dtype=float), ytr.iloc[fit_n:].to_numpy(dtype=float))
        pred_blend = w_single * pred + (1 - w_single) * persistence
        blend_w = [w_single]
    # "model" is what production serves (persistence-blended median); the raw LightGBM median is
    # kept as "model_raw" so the blend's contribution stays visible
    preds = {"model": pred_blend, "model_raw": pred, "persistence": persistence, "seasonal_naive": seasonal, "climatology": climatology}
    served = pred_blend

    # --- shared support mask: every forecaster has a value -----------------------
    support = np.isfinite(yv)
    for arr in preds.values():
        support &= np.isfinite(arr)
    months = mte["ts"].dt.month.to_numpy()
    winter = support & np.isin(months, WINTER_MONTHS)

    out = {
        "horizon_h": horizon_h,
        "n_train": n_train, "n_test": int(len(Xte)), "n_support": int(support.sum()),
        "protocol": protocol, "window_days": window_days,
        "origins": rolling["origins"] if rolling else 1,
        "features": feature_cols,
        "blend_weights": [round(float(w), 2) for w in blend_w],
        "regimes": {
            "full_test": _slice_metrics(yv, preds, support),
            "winter_nov_feb": _slice_metrics(yv, preds, winter),
            "non_winter": _slice_metrics(yv, preds, support & ~np.isin(months, WINTER_MONTHS)),
        },
        "episodes": {},
        "early_warning": {},
    }
    for band, thr in THRESHOLDS.items():
        out["episodes"][f"observed_over_{int(thr)}"] = _slice_metrics(yv, preds, support & (yv > thr))

    # --- exceedance probabilities (needed by both the probability alarms and calibration) ---
    if rolling is not None:
        rs = rolling["resid"]
        p_ex_all = {b: np.where(np.isfinite(rolling["p_exceed"][b]), rolling["p_exceed"][b], 0.0) for b in THRESHOLDS}
    else:
        fit_n = int(len(Xtr) * 0.75)
        _, cal_pred = _fit_predict(Xtr.iloc[:fit_n], ytr.iloc[:fit_n], Xtr.iloc[fit_n:], QUANTILES["value"])
        cal_pred = np.asarray(cal_pred, dtype=float)
        pers_cal = Xtr.iloc[fit_n:]["pm25"].to_numpy(dtype=float)
        cal_blend = blend_w[0] * cal_pred + (1 - blend_w[0]) * np.where(np.isfinite(pers_cal), pers_cal, cal_pred)
        resid = ytr.iloc[fit_n:].to_numpy(dtype=float) - cal_blend
        rs = np.sort(resid[np.isfinite(resid)])
        p_ex_all = {b: (1.0 - np.searchsorted(rs, thr - served, side="right") / len(rs)) if len(rs) >= 50 else np.zeros_like(served)
                    for b, thr in THRESHOLDS.items()}

    # --- early warning: alarm = forecast > T; onsets = clean now, over T at t+h ---
    for band, thr in THRESHOLDS.items():
        ev = support & (yv > thr)
        alarm_m = support & (served > thr)
        alarm_p = support & (persistence > thr)
        onset = ev & (persistence <= thr)          # not over T at issue time, over T at t+h
        entry = {
            "threshold": thr,
            "events": int(ev.sum()),
            "model": _prf(alarm_m[support], ev[support]),
            "persistence": _prf(alarm_p[support], ev[support]),
            "onsets": int(onset.sum()),
            "onset_recall_model": _r(float((alarm_m & onset).sum() / onset.sum())) if onset.sum() else None,
            "onset_recall_persistence": _r(float((alarm_p & onset).sum() / onset.sum())) if onset.sum() else None,
            # operating points on the calibrated probability: alarm = P(> band) ≥ τ
            "probability_alarms": [],
        }
        for tau in (0.2, 0.3, 0.4, 0.5):
            alarm_q = support & (p_ex_all[band] >= tau)
            entry["probability_alarms"].append({
                "tau": tau,
                **_prf(alarm_q[support], ev[support]),
                "onset_recall": _r(float((alarm_q & onset).sum() / onset.sum())) if onset.sum() else None,
            })
        out["early_warning"][band] = entry

    # --- calibrated exceedance probability (split-conformal predictive distribution)
    # residuals from the calibration tail of TRAIN only (last 25%, chronological), applied
    # to the test-window median forecast: P(y > T) = mean(pred + r > T) over calibration r.
    calib = {"n_calibration": int(len(rs))}
    if len(rs) >= 50:
        for band, thr in THRESHOLDS.items():
            p_exceed = p_ex_all[band]
            ev = (yv > thr)
            m = support
            base_rate = float(ev[m].mean())
            brier_model = float(np.mean((p_exceed[m] - ev[m]) ** 2))
            brier_base = float(np.mean((base_rate - ev[m]) ** 2))
            calib[band] = {
                "threshold": thr,
                "brier_model": _r(brier_model, 4),
                "brier_climatology": _r(brier_base, 4),
                "brier_skill": _r(1 - brier_model / brier_base) if brier_base else None,
                "reliability": _reliability(p_exceed[m], ev[m].astype(float)),
            }
    # PI coverage of the served CQR band on the test window
    if rolling is not None:
        lo, hi = rolling["lo"], rolling["hi"]
    else:
        lo_m, hi_m, q = _cqr_models_and_q(Xtr, ytr)
        lo = np.asarray(lo_m.predict(Xte)) - q
        hi = np.asarray(hi_m.predict(Xte)) + q
    lo, hi = np.minimum(lo, hi), np.maximum(lo, hi)
    inside = (yv >= lo) & (yv <= hi)
    calib["pi80_coverage"] = _r(float(inside[support].mean()))
    calib["pi80_mean_width"] = _r(float((hi - lo)[support].mean()), 1)
    # Conditional coverage, because the marginal number hides the failure that matters.
    #
    # Split conformal only ever promises MARGINAL coverage — 80% of all rows, pooled. A band can
    # hit that while being badly wrong in every regime separately, and Kolkata is exactly that
    # case: 0.80 overall, but 0.62 on the fifth of rows where the model predicts the highest
    # concentrations. That is the operationally important fifth, the one an officer acts on.
    #
    # Grouped by PREDICTED level, not observed. Grouping by the outcome would be a diagnosis we
    # could never act on — at serve time the outcome is the thing we do not have.
    calib["pi80_coverage_by_predicted_quintile"] = _conditional_coverage(
        (lo + hi)[support] / 2.0, inside[support])
    out["calibration"] = calib

    # --- meteorology ablation: same model without ERA5 met + derived met features ---
    if ablation and drop and keep:
        if rolling is not None:
            pred_nomet = rolling["pred_nomet"]
        else:
            _, pred_nomet = _fit_predict(Xtr[keep], ytr, Xte[keep], QUANTILES["value"])
            pred_nomet = np.asarray(pred_nomet, dtype=float)
        if pred_nomet is not None:
            m = support & np.isfinite(pred_nomet)
            r_full, r_nomet = rmse(yv[m], pred[m]), rmse(yv[m], pred_nomet[m])
            out["ablation_no_meteorology"] = {
                "dropped": drop, "rmse_with_met": _r(r_full, 2), "rmse_without_met": _r(r_nomet, 2),
                "met_gain_pct": _r(100 * (r_nomet - r_full) / r_nomet, 1) if r_nomet else None,
            }
    return out


def run(city_id: str, source: str, split: str | None, ablation: bool = True,
        protocol: str = "single", window_days: int | None = None) -> dict:
    long_df = load_hist(city_id) if source == "hist" else load_live(city_id)
    long_df = long_df[long_df["variable"].notna()]
    wide = build_feature_table(long_df)
    ts_min, ts_max = wide["ts"].min(), wide["ts"].max()
    if split:
        split_ts = pd.Timestamp(split, tz="UTC")
    else:  # live rows: last quarter of the window is the test set
        split_ts = ts_min + (ts_max - ts_min) * 0.75
    result = {
        "city_id": city_id, "source": source,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "window": {"start": ts_min.isoformat(), "end": ts_max.isoformat(), "split": split_ts.isoformat()},
        "stations_cells": int(wide["h3_cell"].nunique()),
        "rows_wide": int(len(wide)),
        "model": "LightGBM quantile (median) — same class/params as production (ml.forecast.train)",
        "baselines": ["persistence", "seasonal_naive (weekly)", "climatology (hour-of-day, train)"],
        "thresholds": THRESHOLDS,
        "protocol": protocol, "window_days": window_days,
        "horizons": [evaluate_horizon(wide, h, split_ts, ablation, protocol, window_days) for h in HORIZONS],
    }
    return result


# --- markdown ---------------------------------------------------------------------
def to_markdown(res: dict) -> str:
    L = [f"# Forecast benchmark — {res['city_id']} ({res['source']})", ""]
    w = res["window"]
    proto = ("rolling-origin monthly refit" + (f", {res['window_days']}-day training window" if res.get("window_days") else ", expanding window")) if res.get("protocol") == "rolling" else "single temporal split"
    L += [f"Window {w['start'][:10]} → {w['end'][:10]}, test from **{w['split'][:10]}** ({proto}; train strictly before each test origin). {res['stations_cells']} station cells, {res['rows_wide']:,} hourly rows. "
          f"Model: {res['model']}. Generated {res['generated_at'][:16]}Z by `python -m ml.eval.benchmark`.", ""]
    L += ["## RMSE (µg/m³) on the shared support mask", "",
          "| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |",
          "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|"]
    for h in res["horizons"]:
        if "regimes" not in h:
            continue
        for reg, m in h["regimes"].items():
            if m.get("n"):
                L.append(f"| {reg} | {h['horizon_h']} | {m['n']:,} | {m['rmse_persistence']} | {m['rmse_seasonal_naive']} | "
                         f"{m['rmse_climatology']} | **{m['rmse_model']}** | {_pct(m['skill_model_vs_persistence'])} | "
                         f"{m.get('rmse_model_raw', '–')} | {_pct(m.get('skill_model_raw_vs_persistence'))} |")
    L += ["", "Blend weights (w on model, chosen per training origin on its calibration tail): " +
          "; ".join(f"+{h['horizon_h']}h {h.get('blend_weights')}" for h in res["horizons"] if h.get("blend_weights"))]
    L += ["", "## High-pollution hours only (observed PM2.5 above band)", "",
          "| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |", "|---|---:|---:|---:|---:|---:|---:|"]
    for h in res["horizons"]:
        for band, m in h.get("episodes", {}).items():
            if m.get("n"):
                L.append(f"| {band} | {h['horizon_h']} | {m['n']:,} | {m['rmse_persistence']} | {m['rmse_seasonal_naive']} | "
                         f"**{m['rmse_model']}** | {_pct(m['skill_model_vs_persistence'])} |")
    L += ["", "## Probability alarms — alarm = P(> band) ≥ τ (operating points on the calibrated probability)", "",
          "| band | h | τ | precision | recall | F1 | onset recall |", "|---|---:|---:|---:|---:|---:|---:|"]
    for h in res["horizons"]:
        for band, e in h.get("early_warning", {}).items():
            for pa in e.get("probability_alarms", []):
                L.append(f"| {band} | {h['horizon_h']} | {pa['tau']} | {pa['precision']} | {pa['recall']} | {pa['f1']} | {pa['onset_recall']} |")
    L += ["", "## Early warning — alarm = forecast above band", "",
          "| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |",
          "|---|---:|---:|---|---|---:|---:|---:|"]
    for h in res["horizons"]:
        for band, e in h.get("early_warning", {}).items():
            mm, pp = e["model"], e["persistence"]
            L.append(f"| {band} (>{int(e['threshold'])}) | {h['horizon_h']} | {e['events']:,} | {mm['precision']}/{mm['recall']}/{mm['f1']} | "
                     f"{pp['precision']}/{pp['recall']}/{pp['f1']} | {e['onsets']:,} | {e['onset_recall_model']} | {e['onset_recall_persistence']} |")
    L += ["", "## Calibration", ""]
    for h in res["horizons"]:
        c = h.get("calibration", {})
        if not c:
            continue
        L.append(f"- **+{h['horizon_h']}h**: 80% PI empirical coverage {c.get('pi80_coverage')} (mean width {c.get('pi80_mean_width')} µg/m³); "
                 + "; ".join(f"P(>{int(c[b]['threshold'])}) Brier {c[b]['brier_model']} vs climatology {c[b]['brier_climatology']} (skill {_pct(c[b]['brier_skill'])})"
                             for b in THRESHOLDS if b in c))
    # The marginal number is the one that hides the failure, so the breakdown goes next to it —
    # a reader who only opens the .md must see both or neither. The quintile edges are computed per
    # horizon and differ by a few ug/m3 between them, so they are listed per row rather than used
    # as shared column headers, which would silently mislabel every row but the first.
    if any(h["calibration"].get("pi80_coverage_by_predicted_quintile") for h in res["horizons"]):
        L += ["", "### Coverage by predicted level", "",
              "Grouped by *predicted* PM2.5, not observed — at forecast time the outcome is exactly",
              "what we do not have, so this is the only breakdown a served band can be held to.",
              "Every cell should read ~0.80; the worst in each row is bolded.", "",
              "| horizon | Q1 lowest | Q2 | Q3 | Q4 | Q5 highest | overall |",
              "|---|---|---|---|---|---|---|"]
        edges_note = []
        for h in res["horizons"]:
            c = h["calibration"]
            rows = c.get("pi80_coverage_by_predicted_quintile")
            if not rows:
                continue
            worst = min(r["coverage"] for r in rows)
            cells = " | ".join(f"**{r['coverage']}**" if r["coverage"] == worst else f"{r['coverage']}"
                               for r in rows)
            L.append(f"| +{h['horizon_h']}h | {cells} | {c.get('pi80_coverage')} |")
            bounds = [rows[0]["predicted_range"][0]] + [r["predicted_range"][1] for r in rows]
            edges_note.append(f"- +{h['horizon_h']}h quintile edges (µg/m³): "
                              + " · ".join(str(b) for b in bounds))
        L += [""] + edges_note
    L += ["", "## Meteorology ablation", ""]
    for h in res["horizons"]:
        a = h.get("ablation_no_meteorology")
        if a:
            L.append(f"- +{h['horizon_h']}h: RMSE with ERA5 met {a['rmse_with_met']} vs without {a['rmse_without_met']} → met contributes {a['met_gain_pct']}%")
    L += ["", "_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._"]
    return "\n".join(L)


def _pct(x):
    return "–" if x is None else f"{x*100:+.1f}%"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--source", choices=("hist", "live"), default="hist")
    ap.add_argument("--split", default=None, help="ISO date; test = on/after this date (default: last quarter)")
    ap.add_argument("--no-ablation", action="store_true")
    ap.add_argument("--protocol", choices=("single", "rolling"), default="single",
                    help="single: one split; rolling: monthly refit on all data before each test month (production-like)")
    ap.add_argument("--window-days", type=int, default=None, help="rolling only: cap the training window (production retention = 90)")
    ap.add_argument("--out", default=str(OUT_DIR))
    args = ap.parse_args()
    res = run(args.city, args.source, args.split, ablation=not args.no_ablation,
              protocol=args.protocol, window_days=args.window_days)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    # canonical artifact = production-faithful protocol (rolling refit on a capped window);
    # the other protocols are kept as transparently-named variants
    if args.source == "live":
        stem = f"{args.city}_live"
    elif args.protocol == "rolling" and args.window_days:
        stem = f"{args.city}"
    elif args.protocol == "rolling":
        stem = f"{args.city}_expanding"
    else:
        stem = f"{args.city}_single"
    (out / f"{stem}.json").write_text(json.dumps(res, indent=1))
    (out / f"{stem}.md").write_text(to_markdown(res))
    print(to_markdown(res))


if __name__ == "__main__":
    main()
