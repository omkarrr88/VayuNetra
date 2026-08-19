"""Why the 80% band only covers ~73%, and which calibration fixes it.

The band is Conformalized Quantile Regression: fit q0.1/q0.9 on the first 75% of the training
window, compute conformity scores E = max(lo−y, y−hi) on the last 25%, serve [lo−Q, hi+Q].

Under exchangeability that is guaranteed to cover. Air quality is not exchangeable — the calibration
split sits immediately before the test window, and residuals grow as the regime moves — so the
scores under-state the error we are about to make. This measures the size of that gap and compares
candidate fixes on FORWARD coverage, which is the only number that matters.

    .venv/bin/python scripts/tune_conformal.py --city delhi --horizon 24
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


def _cal_q(scores: np.ndarray, level: float, corrected: bool) -> float:
    """Conformal quantile of the conformity scores.

    `corrected` applies the finite-sample level ⌈(n+1)(1−α)⌉/n that split conformal actually
    requires. The current code uses the plain 1−α, which under-covers by about 1/n — real, but
    nowhere near the gap we measure.
    """
    n = len(scores)
    if n == 0:
        return 0.0
    lv = min(1.0, math.ceil((n + 1) * level) / n) if corrected else level
    return max(0.0, float(np.quantile(scores, lv)))


VARIANTS = {
    # name: (calibration fraction, use finite-sample correction, recency half-life in samples)
    "A current (25% cal, plain level)":        (0.25, False, None),
    "B + finite-sample correction":           (0.25, True, None),
    "C + bigger calibration (40%)":           (0.40, True, None),
    "D + recency-weighted scores":            (0.25, True, 150),
    "E + recency-weighted, bigger cal":       (0.40, True, 150),
}


def weighted_quantile(values: np.ndarray, weights: np.ndarray, level: float) -> float:
    """Weighted quantile — lets recent conformity scores count for more than old ones."""
    order = np.argsort(values)
    v, w = values[order], weights[order]
    cw = np.cumsum(w) / np.sum(w)
    idx = int(np.searchsorted(cw, level))
    return float(v[min(idx, len(v) - 1)])


def run(city: str, horizon: int, n_folds: int = 3) -> None:
    from ml.forecast.features import build_feature_table
    from core.supa import load_measurements

    # load_measurements pages through everything; a plain .limit() returns an arbitrary slice that
    # may contain no pm25 rows at all, which is how the first attempt at this failed.
    rows = load_measurements(city)
    if not rows:
        raise SystemExit(f"no measurements for {city}")
    wide = build_feature_table(pd.DataFrame(rows))
    X, y, meta, _ = make_supervised(wide, horizon)
    n = len(X)
    if n < 120:
        raise SystemExit(f"{city}: only {n} supervised rows — too few to judge coverage")
    order = meta.sort_values("ts").index
    X, y = X.loc[order].reset_index(drop=True), y.loc[order].reset_index(drop=True)

    print(f"{city} +{horizon}h — {n} supervised rows, {n_folds} forward folds, nominal {NOMINAL_COVERAGE:.0%}\n")
    print(f"{'variant':38s} {'cal cov':>8s} {'FWD cov':>8s} {'width':>8s}")

    chunk = n // (n_folds + 1)
    for name, (cal_frac, corrected, half_life) in VARIANTS.items():
        fwd_hits = cal_hits = fwd_tot = cal_tot = 0
        width = 0.0
        for i in range(n_folds):
            te0, te1 = chunk * (i + 1), (chunk * (i + 2) if i < n_folds - 1 else n)
            Xtr, ytr = X.iloc[:te0], y.iloc[:te0]
            Xte, yte = X.iloc[te0:te1], y.iloc[te0:te1]
            if len(Xte) == 0 or len(Xtr) < 40:
                continue
            fit_n = int(len(Xtr) * (1 - cal_frac))
            Xfit, yfit = Xtr.iloc[:fit_n], ytr.iloc[:fit_n]
            Xcal, ycal = Xtr.iloc[fit_n:], ytr.iloc[fit_n:]
            if len(Xcal) < 20:
                continue
            lo_m, lo_cal = _fit_predict(Xfit, yfit, Xcal, QUANTILES["pi_low"])
            hi_m, hi_cal = _fit_predict(Xfit, yfit, Xcal, QUANTILES["pi_high"])
            sc = np.maximum(lo_cal - ycal.to_numpy(), ycal.to_numpy() - hi_cal)

            if half_life:
                age = np.arange(len(sc))[::-1]
                w = 0.5 ** (age / half_life)
                lv = min(1.0, math.ceil((len(sc) + 1) * NOMINAL_COVERAGE) / len(sc)) if corrected else NOMINAL_COVERAGE
                q = max(0.0, weighted_quantile(sc, w, lv))
            else:
                q = _cal_q(sc, NOMINAL_COVERAGE, corrected)

            # coverage on the calibration split itself (should be ~nominal by construction)
            cal_hits += int(((ycal.to_numpy() >= lo_cal - q) & (ycal.to_numpy() <= hi_cal + q)).sum())
            cal_tot += len(ycal)
            # forward coverage — the honest number
            lo = np.asarray(lo_m.predict(Xte)); hi = np.asarray(hi_m.predict(Xte))
            lo, hi = np.minimum(lo, hi), np.maximum(lo, hi)
            yv = yte.to_numpy()
            fwd_hits += int(((yv >= lo - q) & (yv <= hi + q)).sum())
            fwd_tot += len(yv)
            width += float(((hi + q) - (lo - q)).mean()) * len(yv)

        if fwd_tot:
            print(f"{name:38s} {cal_hits/cal_tot:>8.3f} {fwd_hits/fwd_tot:>8.3f} {width/fwd_tot:>8.1f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--horizon", type=int, default=24)
    a = ap.parse_args()
    run(a.city, a.horizon)
