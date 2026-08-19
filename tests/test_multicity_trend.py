"""The scoreboard trend badge — it has to mean something at every city's baseline."""
from __future__ import annotations

from agents.multicity import TREND_MIN_ABS, trend_band, trend_label


def test_trend_scales_with_the_city_baseline():
    """The same 14 µg/m³ rise is noise in Delhi and a near-doubling in monsoon Mumbai."""
    assert trend_label(214.0, 200.0) == "stable"          # +14 on 200 — inside the daily swing
    assert trend_label(28.0, 14.0) == "deteriorating"     # +14 on 14 — the air doubled


def test_a_flat_threshold_would_have_called_everything_stable():
    """Regression: a fixed ±15 µg/m³ band left every monsoon city reading "stable" all season."""
    monsoon = [(14.0, 23.0), (18.0, 27.0), (33.0, 21.0)]  # (current, forecast) seen in Aug 2026
    labels = {trend_label(fc, cur) for cur, fc in monsoon}
    assert labels != {"stable"}, "the badge must distinguish these, not collapse them"
    assert trend_label(23.0, 14.0) == "deteriorating"
    assert trend_label(21.0, 33.0) == "improving"


def test_clean_air_does_not_flip_on_measurement_noise():
    """At very low concentrations the relative band would fire on the spread between monitors."""
    assert trend_band(1.0) == TREND_MIN_ABS
    assert trend_band(0.0) == TREND_MIN_ABS
    assert trend_label(6.0, 3.0) == "stable"              # +3 on 3 is 100%, but only 3 µg/m³
    assert trend_label(9.0, 3.0) == "deteriorating"       # +6 clears the floor


def test_the_band_is_symmetric():
    """Improving and deteriorating must need the same evidence — no optimistic thumb on the scale."""
    for cur in (10.0, 50.0, 200.0):
        band = trend_band(cur)
        assert trend_label(cur + band, cur) == "deteriorating"
        assert trend_label(cur - band, cur) == "improving"
        assert trend_label(cur + band * 0.99, cur) == "stable"
