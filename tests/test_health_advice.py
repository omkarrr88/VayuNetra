"""core/health_advice.py — the module that tells people with asthma what to do today.

It had no tests at all. Everything here is either a CPCB band boundary (getting one wrong tells a
sensitive person the air is safer than it is) or a completeness invariant (a missing key is a
KeyError on a live public page).
"""
from __future__ import annotations

import pytest

from core.health_advice import (
    ACTIONS,
    BAND_ADVICE,
    BAND_LABEL,
    BANDS,
    CONDITIONS,
    DISCLAIMER,
    RISK_BY_BAND,
    advice,
    band_for_index,
    cigarettes,
)

ALL_BANDS = [name for _hi, name in BANDS]


# --------------------------------------------------------------------- band boundaries
# CPCB National AQI: 0-50 Good, 51-100 Satisfactory, 101-200 Moderate, 201-300 Poor,
# 301-400 Very Poor, 401+ Severe. The upper edge belongs to the LOWER band.
@pytest.mark.parametrize(
    "index,expected",
    [
        (0, "good"), (25, "good"), (50, "good"),
        (51, "satisfactory"), (100, "satisfactory"),
        (101, "moderate"), (200, "moderate"),
        (201, "poor"), (300, "poor"),
        (301, "very_poor"), (400, "very_poor"),
        (401, "severe"), (500, "severe"), (9999, "severe"),
    ],
)
def test_band_boundaries_follow_cpcb(index, expected):
    assert band_for_index(index) == expected


def test_band_above_the_table_is_still_severe():
    """The table's last row caps at 10,000. A reading beyond it must not fall through to nothing."""
    assert band_for_index(10_001) == "severe"
    assert band_for_index(1e9) == "severe"


def test_a_negative_index_is_not_worse_than_good():
    assert band_for_index(-5) == "good"


def test_no_reading_is_not_reported_as_moderate():
    """A city with no readings must not be given confident moderate-air advice.

    This module used to return "moderate" for a null index, so /city/overview -> health rendered
    "What to do now — air is Moderate" with a full set of prescriptions for a city we had measured
    nothing in. Everywhere else this product shows a gap as a gap; this one invented a band.
    """
    assert band_for_index(None) == "unknown"
    a = advice(None)
    assert a["band"] == "unknown"
    assert a["index"] is None
    assert a["actions"] == []                      # nothing to prescribe
    assert "no" in a["headline"].lower()           # says so in words
    assert a["disclaimer"] == DISCLAIMER           # still carries the disclaimer


# --------------------------------------------------------------------- cigarettes
def test_cigarettes_uses_the_published_equivalence():
    """Berkeley Earth: 22 µg/m³ over a day ~ 1 cigarette."""
    c = cigarettes(22.0)
    assert c["per_day"] == 1.0
    assert c["per_week"] == 7.0
    assert c["per_month"] == 30.0
    assert c["pm25_basis"] == 22.0


def test_cigarettes_scales_linearly():
    assert cigarettes(44.0)["per_day"] == 2.0
    assert cigarettes(220.0)["per_day"] == 10.0


def test_cigarettes_without_a_reading_returns_nothing_but_still_cites():
    c = cigarettes(None)
    assert c["per_day"] is None and c["per_week"] is None and c["per_month"] is None
    assert "Berkeley Earth" in c["source"]
    assert "pm25_basis" not in c        # no basis to state


def test_cigarettes_zero_is_zero_not_missing():
    c = cigarettes(0.0)
    assert c["per_day"] == 0.0
    assert c["pm25_basis"] == 0.0


def test_cigarettes_is_labelled_as_a_communication_device():
    """The figure is rhetorical. If the caveat ever goes missing it becomes a clinical claim."""
    assert "not a clinical dose" in cigarettes(50.0)["note"]


# --------------------------------------------------------------------- completeness invariants
@pytest.mark.parametrize("band", ALL_BANDS)
def test_every_band_has_every_piece_of_copy(band):
    """A band present in BANDS but missing from any lookup is a KeyError on a public page."""
    assert band in BAND_LABEL
    assert band in BAND_ADVICE
    assert band in ACTIONS
    assert band in RISK_BY_BAND
    assert BAND_LABEL[band] and BAND_ADVICE[band]


@pytest.mark.parametrize("band", ALL_BANDS)
def test_advice_renders_for_every_band(band):
    idx = next(hi for hi, name in BANDS if name == band)
    a = advice(idx, pm25_24h=55.0)
    assert a["band"] == band
    assert a["band_label"] == BAND_LABEL[band]
    assert a["headline"] == BAND_ADVICE[band]
    assert a["cigarettes"]["per_day"] == 2.5
    for key in ("band", "band_label", "index", "headline", "actions", "conditions",
                "cigarettes", "sources", "disclaimer"):
        assert key in a, f"{band} advice is missing {key}"


@pytest.mark.parametrize("band", ALL_BANDS)
def test_actions_are_well_formed(band):
    for a in advice(next(hi for hi, n in BANDS if n == band))["actions"]:
        assert a["key"] and a["label"] and a["prescription"]


def test_conditions_carry_the_band_risk_and_keep_their_own_guidance():
    a = advice(350)          # very_poor
    assert a["conditions"], "the risk panel would be empty"
    assert len(a["conditions"]) == len(CONDITIONS)
    for c in a["conditions"]:
        assert c["risk"] == RISK_BY_BAND["very_poor"]
        assert c["label"] and c["symptoms"]
        assert c["do"] and c["dont"]          # both columns must have content


def test_risk_rises_with_the_band():
    order = [RISK_BY_BAND[b] for b in ALL_BANDS]
    assert order == ["minimal", "low", "mild", "moderate", "high", "very high"]
    assert len(set(order)) == len(order), "two bands would read as the same risk"


def test_every_answer_is_cited_and_disclaimed():
    a = advice(180, pm25_24h=90.0)
    assert a["disclaimer"] == DISCLAIMER
    assert "not medical advice" in a["disclaimer"]
    joined = " ".join(a["sources"])
    assert "CPCB" in joined and "WHO" in joined and "Berkeley Earth" in joined


def test_advice_is_pure_and_repeatable():
    """No hidden state: the same inputs must give the same answer, and one call must not mutate the
    module tables the next call reads."""
    first = advice(210, pm25_24h=44.0)
    second = advice(210, pm25_24h=44.0)
    assert first == second
    first["conditions"][0]["risk"] = "tampered"
    assert advice(210, pm25_24h=44.0)["conditions"][0]["risk"] == RISK_BY_BAND["poor"]
