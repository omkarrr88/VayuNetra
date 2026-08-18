"""Calibrated exceedance probabilities (split-conformal predictive distribution)."""
import numpy as np

from ml.forecast.train import exceedance_probability


def test_exceedance_is_monotone_and_bounded():
    resid = np.sort(np.array([-20.0, -10.0, -5.0, 0.0, 5.0, 10.0, 20.0, 30.0]))
    p_low = exceedance_probability(50.0, resid, 120.0)
    p_mid = exceedance_probability(115.0, resid, 120.0)
    p_high = exceedance_probability(200.0, resid, 120.0)
    assert p_low == 0.0
    assert 0.0 < p_mid < 1.0
    assert p_high == 1.0
    assert p_low <= p_mid <= p_high


def test_exceedance_matches_empirical_share():
    # yhat = 100; residuals put 3 of 8 outcomes above 120 (needs r > 20): 30 only -> 1/8
    resid = np.sort(np.array([-20.0, -10.0, -5.0, 0.0, 5.0, 10.0, 20.0, 30.0]))
    assert abs(exceedance_probability(100.0, resid, 120.0) - 1 / 8) < 1e-9


def test_exceedance_none_without_calibration():
    assert exceedance_probability(100.0, np.array([]), 120.0) is None


def test_blend_weight_prefers_the_better_forecaster():
    from ml.forecast.train import blend_weight

    y = np.linspace(50, 150, 200)
    good = y + np.random.default_rng(0).normal(0, 2, 200)
    bad = y + np.random.default_rng(1).normal(0, 40, 200)
    assert blend_weight(good, bad, y) >= 0.9          # model clearly better -> weight on model
    assert blend_weight(bad, good, y) <= 0.1          # persistence clearly better -> weight on persistence
    assert blend_weight(good[:10], bad[:10], y[:10]) == 1.0   # too few calibration rows -> plain model
