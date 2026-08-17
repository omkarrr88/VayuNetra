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
