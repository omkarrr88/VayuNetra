"""Forecast calibration — the conformal band must cover what it claims."""
from __future__ import annotations

import pytest


# ---------------------------------------------------------------- conformal calibration
# The 80% band measured only 72% forward coverage on Delhi. The conformal maths was never wrong —
# coverage ON the calibration split was 0.799. The gap is that air quality is not exchangeable, so a
# calibration split that sees one regime under-states the error the next regime brings.

def test_conformal_level_applies_the_finite_sample_correction():
    """Split conformal needs ⌈(n+1)(1−α)⌉/n, not a plain 1−α — the latter under-covers by ~1/n."""
    from ml.forecast.train import _conformal_level

    # always at or above nominal, never below
    for n in (10, 50, 200, 1000, 5000):
        assert _conformal_level(n, 0.8) >= 0.8

    # the correction shrinks toward nominal as n grows
    assert _conformal_level(10, 0.8) > _conformal_level(1000, 0.8)
    assert _conformal_level(1000, 0.8) == pytest.approx(0.8, abs=0.002)

    # never asks for a quantile above 1.0, however small the calibration set
    assert _conformal_level(2, 0.8) <= 1.0
    assert _conformal_level(1, 0.8) <= 1.0
    assert _conformal_level(0, 0.8) == 0.8       # degenerate: fall back to nominal


def test_calibration_split_stays_where_the_evidence_put_it():
    """Pinned because it is a silent-failure knob — move it and nothing errors, coverage just drifts.

    Raising it to 0.40 was tried and reverted: on the rolling multi-season benchmark (10 origins,
    53k-208k support rows) it lowered coverage at every horizon in both cities measured — delhi
    0.783/0.781/0.774 -> 0.759/0.760/0.718, kolkata 0.748/0.725/0.698 -> 0.696/0.672/0.668.
    """
    from ml.forecast.train import CAL_FRACTION

    assert CAL_FRACTION == 0.25, "raising this measured worse on the rolling benchmark; see train.py"


def test_live_pi80_is_not_read_as_a_calibration_measurement():
    """Guard the reasoning error that nearly shipped a regression.

    The live single-origin benchmark computes PI coverage over a few hundred support rows from one
    forecast origin. That is small enough to swing ~0.6-0.86 on regime luck, and tuning against it
    moved Delhi +48h to 0.596 on the protocol that actually matters. Any live artifact carrying a
    PI80 number must also carry the sample size, so nobody reads it as calibration evidence.
    """
    import json
    from pathlib import Path

    live = sorted(Path("docs/benchmarks").glob("*_live.json"))
    if not live:
        pytest.skip("no live benchmark artifacts checked in")
    for f in live:
        for h in json.loads(f.read_text()).get("horizons", []):
            if h.get("calibration", {}).get("pi80_coverage") is None:
                continue
            assert h.get("n_support") is not None, f"{f.name} +{h['horizon_h']}h: coverage without n"


def test_conformal_band_never_inverts():
    """Q is clamped at 0, so [lo−Q, hi+Q] can only ever widen the raw quantile band."""
    import numpy as np
    import pandas as pd
    from ml.forecast.train import _cqr_models_and_q

    rng = np.random.default_rng(0)
    n = 400
    X = pd.DataFrame({"a": rng.normal(size=n), "b": rng.normal(size=n)})
    y = pd.Series(X["a"] * 2.0 + rng.normal(scale=0.5, size=n))
    _lo, _hi, q = _cqr_models_and_q(X, y)
    assert q >= 0.0


# ---------------------------------------------------------------- conditional coverage
# The marginal number hides the failure that matters. Kolkata's band measures ~0.80 pooled and
# 0.62 on the fifth of rows where the model predicts the highest concentrations — the fifth an
# officer acts on. Seven conformal variants were compared (scripts/tune_conformal_tails.py) and the
# best moved that 0.62 to 0.65, so the reporting is the fix, not the recalibration.

def test_conditional_coverage_groups_by_predicted_level():
    """Grouping must be by prediction, not outcome — an outcome-grouped table is unactionable."""
    import numpy as np
    from ml.eval.benchmark import _conditional_coverage

    rng = np.random.default_rng(0)
    n = 2000
    level = rng.uniform(5, 200, size=n)
    # a band that covers well at low level and badly at high — the Kolkata shape
    inside = rng.random(n) < np.where(level > 150, 0.6, 0.85)
    rows = _conditional_coverage(level, inside)
    assert rows is not None and len(rows) == 5
    assert sum(r["n"] for r in rows) == n
    # the quintiles must be ordered and contiguous, so a reader can map a row to a concentration
    for a, b in zip(rows, rows[1:]):
        assert a["predicted_range"][1] == b["predicted_range"][0]
    assert rows[-1]["coverage"] < rows[0]["coverage"], "the top-level shortfall must be visible"


def test_conditional_coverage_refuses_to_split_thin_data():
    """Below ~400 rows a bin the cells are noise, and the live benchmark already proved once that
    a small-sample coverage number gets over-read. Better to report nothing."""
    import numpy as np
    from ml.eval.benchmark import MIN_ROWS_PER_COVERAGE_BIN, _conditional_coverage

    rng = np.random.default_rng(1)
    thin = 5 * MIN_ROWS_PER_COVERAGE_BIN - 1
    assert _conditional_coverage(rng.uniform(5, 200, thin), rng.random(thin) < 0.8) is None
    # the single-origin live artifacts sit well under the bar and must not gain a table
    assert _conditional_coverage(rng.uniform(5, 200, 929), rng.random(929) < 0.8) is None
