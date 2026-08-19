"""Kolkata's 80% band misses at BOTH tails. Which conformal variant fixes it?

The rolling multi-season backtest measures Kolkata at 0.748 / 0.725 / 0.699 for +24/48/72h, and
splitting the misses by outcome decile shows the failure is not uniform:

    y quintile      coverage   below band   above band     (nominal .10 / .10)
    0-20 ug/m3        0.617        0.382        0.000
    20-30             0.848        0.127        0.025
    30-48             0.824        0.083        0.093
    48-83             0.858        0.049        0.094
    83-1000           0.595        0.011        0.395

The middle is fine. The band sits too high for clean air and too narrow for dirty air. A single
scalar Q added symmetrically to both edges cannot fix that — it is one number being asked to
correct two opposite errors. This compares the variants that can:

  A  current            one two-sided Q                    E = max(lo-y, y-hi)
  B  asymmetric         separate Q per edge at 1-a/2       E_lo = lo-y,  E_hi = y-hi
  C  normalized         Q scales with the model's own      E = max(...)/(hi-lo)
                        uncertainty (locally adaptive)
  D  asymmetric+norm    both
  E  Mondrian           a separate Q per PREDICTED-level bin (Vovk); the only one of these that
                        targets conditional coverage on something we actually know at serve time
  F  level-scaled      Q scales with the PREDICTED CONCENTRATION, not the band width — PM2.5
                        error is roughly proportional to level, and (hi-lo) under-states that
  G  asym + level-scaled

    .venv/bin/python scripts/tune_conformal_tails.py --city kolkata --horizon 24
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import core.env  # noqa: E402,F401
from ml.forecast.train import NOMINAL_COVERAGE, QUANTILES, _fit_predict, make_supervised  # noqa: E402

ALPHA = 1.0 - NOMINAL_COVERAGE
EPS = 1e-6          # keeps a degenerate zero-width band from dividing by zero


def _level(n: int, coverage: float) -> float:
    """Finite-sample split-conformal level."""
    return min(1.0, math.ceil((n + 1) * coverage) / n) if n > 0 else coverage


N_BINS = 10


def _bin_edges(mid_cal: np.ndarray) -> np.ndarray:
    """Bin boundaries from the calibration split's PREDICTED level.

    Predicted, not true. Binning on the outcome would be cheating — at serve time we do not know
    it, and a band chosen with hindsight is not a band.
    """
    return np.quantile(mid_cal, np.linspace(0, 1, N_BINS + 1)[1:-1])


def calibrate(lo_cal, hi_cal, ycal, variant: str):
    """Return the adjustment(s) this variant serves, given calibration-split predictions."""
    n = len(ycal)
    width = np.maximum(hi_cal - lo_cal, EPS)
    if variant == "A":
        s = np.maximum(lo_cal - ycal, ycal - hi_cal)
        q = max(0.0, float(np.quantile(s, _level(n, NOMINAL_COVERAGE))))
        return {"kind": "abs", "q_lo": q, "q_hi": q}
    if variant == "B":
        # each edge gets its own budget at 1-a/2, so the band can move down more than it moves up
        lv = _level(n, 1.0 - ALPHA / 2.0)
        return {"kind": "abs",
                "q_lo": max(0.0, float(np.quantile(lo_cal - ycal, lv))),
                "q_hi": max(0.0, float(np.quantile(ycal - hi_cal, lv)))}
    if variant == "C":
        s = np.maximum(lo_cal - ycal, ycal - hi_cal) / width
        q = max(0.0, float(np.quantile(s, _level(n, NOMINAL_COVERAGE))))
        return {"kind": "rel", "q_lo": q, "q_hi": q}
    if variant == "D":
        lv = _level(n, 1.0 - ALPHA / 2.0)
        return {"kind": "rel",
                "q_lo": max(0.0, float(np.quantile((lo_cal - ycal) / width, lv))),
                "q_hi": max(0.0, float(np.quantile((ycal - hi_cal) / width, lv)))}
    if variant in ("F", "G"):
        # a floor on the divisor: at 5 ug/m3 a proportional band would be meaninglessly tight, and
        # dividing by a near-zero prediction turns one clean cell into an enormous score
        lvl = np.maximum((lo_cal + hi_cal) / 2.0, 10.0)
        if variant == "F":
            s_ = np.maximum(lo_cal - ycal, ycal - hi_cal) / lvl
            q = max(0.0, float(np.quantile(s_, _level(n, NOMINAL_COVERAGE))))
            return {"kind": "lvl", "q_lo": q, "q_hi": q}
        lv = _level(n, 1.0 - ALPHA / 2.0)
        return {"kind": "lvl",
                "q_lo": max(0.0, float(np.quantile((lo_cal - ycal) / lvl, lv))),
                "q_hi": max(0.0, float(np.quantile((ycal - hi_cal) / lvl, lv)))}
    if variant == "E":
        mid = (lo_cal + hi_cal) / 2.0
        edges = _bin_edges(mid)
        idx = np.digitize(mid, edges)
        s = np.maximum(lo_cal - ycal, ycal - hi_cal)
        qs = []
        for b in range(N_BINS):
            m = idx == b
            # a bin too thin to estimate a 0.8 quantile falls back to the pooled one rather than
            # inventing a number from a handful of points
            qs.append(max(0.0, float(np.quantile(s[m], _level(int(m.sum()), NOMINAL_COVERAGE))))
                      if m.sum() >= 100 else
                      max(0.0, float(np.quantile(s, _level(n, NOMINAL_COVERAGE)))))
        return {"kind": "bin", "edges": edges, "q": np.asarray(qs)}
    raise ValueError(variant)


def apply(lo, hi, adj) -> tuple[np.ndarray, np.ndarray]:
    """Widen the raw quantile band by whatever the variant calibrated."""
    if adj["kind"] == "abs":
        return lo - adj["q_lo"], hi + adj["q_hi"]
    if adj["kind"] == "lvl":
        lvl = np.maximum((lo + hi) / 2.0, 10.0)
        return lo - adj["q_lo"] * lvl, hi + adj["q_hi"] * lvl
    if adj["kind"] == "bin":
        q = adj["q"][np.digitize((lo + hi) / 2.0, adj["edges"])]
        return lo - q, hi + q
    w = np.maximum(hi - lo, EPS)
    return lo - adj["q_lo"] * w, hi + adj["q_hi"] * w


def run(city: str, horizon: int, cal_fraction: float = 0.25, n_folds: int = 4) -> None:
    from core.supa import load_measurements  # noqa: F401  (live path, unused by default)
    from ml.eval.benchmark import load_hist
    from ml.forecast.features import build_feature_table

    wide = build_feature_table(load_hist(city))
    X, y, meta, _ = make_supervised(wide, horizon)
    order = meta.sort_values("ts").index
    X, y = X.loc[order].reset_index(drop=True), y.loc[order].reset_index(drop=True)
    n = len(X)
    print(f"{city} +{horizon}h — {n} supervised rows, {n_folds} forward folds, nominal {NOMINAL_COVERAGE:.0%}\n")

    chunk = n // (n_folds + 1)
    acc: dict[str, dict] = {}
    for i in range(n_folds):
        te0, te1 = chunk * (i + 1), (chunk * (i + 2) if i < n_folds - 1 else n)
        Xtr, ytr, Xte, yte = X.iloc[:te0], y.iloc[:te0], X.iloc[te0:te1], y.iloc[te0:te1]
        fit_n = int(len(Xtr) * (1.0 - cal_fraction))
        lo_m, lo_cal = _fit_predict(Xtr.iloc[:fit_n], ytr.iloc[:fit_n], Xtr.iloc[fit_n:], QUANTILES["pi_low"])
        hi_m, hi_cal = _fit_predict(Xtr.iloc[:fit_n], ytr.iloc[:fit_n], Xtr.iloc[fit_n:], QUANTILES["pi_high"])
        lo_cal, hi_cal = np.minimum(lo_cal, hi_cal), np.maximum(lo_cal, hi_cal)
        ycal = ytr.iloc[fit_n:].to_numpy()
        lo_t, hi_t = np.asarray(lo_m.predict(Xte)), np.asarray(hi_m.predict(Xte))
        lo_t, hi_t = np.minimum(lo_t, hi_t), np.maximum(lo_t, hi_t)
        yv = yte.to_numpy()
        mid_t = (lo_t + hi_t) / 2.0
        for v in ("A", "B", "C", "D", "E", "F", "G"):
            lo_a, hi_a = apply(lo_t, hi_t, calibrate(lo_cal, hi_cal, ycal, v))
            d = acc.setdefault(v, {"y": [], "lo": [], "hi": [], "mid": []})
            d["y"].append(yv); d["lo"].append(lo_a); d["hi"].append(hi_a); d["mid"].append(mid_t)

    NAMES = {"A": "A current (one two-sided Q)", "B": "B asymmetric per edge",
             "C": "C normalized by band width", "D": "D asymmetric + normalized",
             "E": "E Mondrian by predicted bin",
             "F": "F scaled by predicted level", "G": "G asymmetric + level-scaled"}
    VS = ("A", "B", "C", "D", "E", "F", "G")
    yall = np.concatenate(acc["A"]["y"])
    tedges = np.quantile(yall, [0, .2, .4, .6, .8, 1.0])
    midall = np.concatenate(acc["A"]["mid"])
    pedges = np.quantile(midall, [0, .2, .4, .6, .8, 1.0])

    for space, edges, src in (("TRUE  outcome quintile", tedges, "y"), ("PREDICTED level quintile", pedges, "mid")):
        print(f"\n--- coverage by {space} ---")
        print(f"{'variant':30s} {'cov':>6s} {'width':>7s} " + " ".join(f"{f'Q{i+1}':>6s}" for i in range(5)))
        for v in VS:
            yv = np.concatenate(acc[v]["y"]); lo = np.concatenate(acc[v]["lo"])
            hi = np.concatenate(acc[v]["hi"]); mid = np.concatenate(acc[v]["mid"])
            ok = np.isfinite(yv) & np.isfinite(lo) & np.isfinite(hi)
            yv, lo, hi, mid = yv[ok], lo[ok], hi[ok], mid[ok]
            key = yv if src == "y" else mid
            inside = (yv >= lo) & (yv <= hi)
            cells = []
            for k in range(5):
                m = (key >= edges[k]) & ((key <= edges[k + 1]) if k == 4 else (key < edges[k + 1]))
                cells.append(f"{inside[m].mean():>6.3f}" if m.sum() else f"{'-':>6s}")
            print(f"{NAMES[v]:30s} {inside.mean():>6.3f} {np.mean(hi - lo):>7.1f} " + " ".join(cells))
    print("\nEvery quintile should read ~0.80. The TRUE-outcome table is the diagnosis; the")
    print("PREDICTED-level table is the only one a served band can be held to, because it is the")
    print("only one whose grouping is knowable before the outcome arrives.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="kolkata")
    ap.add_argument("--horizon", type=int, default=24)
    ap.add_argument("--cal-fraction", type=float, default=0.25)
    a = ap.parse_args()
    run(a.city, a.horizon, a.cal_fraction)
