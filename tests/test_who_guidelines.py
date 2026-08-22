"""The WHO 2021 guideline values, pinned against the publication.

Transcribed from Table 0.1 of the WHO global air quality guidelines (ISBN 9789240034228) — the
short-term level for each pollutant: the 24-hour AQG, except ozone whose short-term metric is the
8-hour mean. These are published constants; if one drifts, every WHO reading in the product is
wrong by a fixed factor and nothing else would catch it.

The same table is mirrored in web/src/aqi.ts. The last test checks the two copies agree, because a
value corrected in one place and not the other is the failure mode that survives review.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from api.main import WHO_AQG_SHORT_TERM

# pollutant -> (short-term AQG level, unit) exactly as printed in Table 0.1
PUBLISHED = {
    "pm25": (15.0, "µg/m3"),
    "pm10": (45.0, "µg/m3"),
    "no2": (25.0, "µg/m3"),
    "so2": (40.0, "µg/m3"),
    "co": (4.0, "mg/m3"),      # note the unit — a µg/m³ reading here would be wrong by 1000×
    "o3": (100.0, "µg/m3"),    # 8-hour; WHO's other O3 metric is a peak-season average
}


@pytest.mark.parametrize("pollutant,expected", [(p, v[0]) for p, v in PUBLISHED.items()])
def test_guideline_matches_the_publication(pollutant, expected):
    assert WHO_AQG_SHORT_TERM[pollutant] == expected


def test_no_pollutant_is_missing_or_invented():
    assert set(WHO_AQG_SHORT_TERM) == set(PUBLISHED)


def test_carbon_monoxide_is_in_milligrams():
    """WHO states CO in mg/m³ and our readings arrive in mg/m³. If either side ever moves to
    µg/m³ the ratio is out by a thousand, and 0.7 mg/m³ would read as 175× the guideline."""
    assert WHO_AQG_SHORT_TERM["co"] == 4.0
    assert PUBLISHED["co"][1] == "mg/m3"


def test_the_worst_pollutant_sets_the_city_reading():
    """The WHO reading is the worst multiple, the way CPCB and EPA take the worst sub-index — which
    is what makes "set by PM10" true on this scale rather than borrowed from the CPCB index."""
    from api.main import _who_worst

    # Ahmedabad as measured on 20 Aug: PM10 174 is 3.9x its 45 guideline; PM2.5 23.5 only 1.6x its 15
    worst = _who_worst({"pm25": 23.5, "pm10": 174.0, "no2": 17.6, "o3": 26.7})
    assert worst == ("pm10", 3.9)

    # and where PM2.5 is the worse offender it wins, even though PM10's raw number is larger
    worst = _who_worst({"pm25": 54.0, "pm10": 145.3})
    assert worst[0] == "pm25"


def test_none_when_nothing_is_measured():
    from api.main import _who_worst

    assert _who_worst({}) is None
    assert _who_worst({"pm25": None}) is None


def test_the_browser_copy_agrees_with_the_server():
    """web/src/aqi.ts carries the same table so the page can band a reading without a round trip."""
    ts = Path("web/src/aqi.ts").read_text()
    for pollutant, (aqg, _unit) in PUBLISHED.items():
        m = re.search(rf"{pollutant}:\s*\{{\s*aqg:\s*([\d.]+)", ts)
        assert m, f"{pollutant} missing from the browser's WHO table"
        assert float(m.group(1)) == aqg, f"{pollutant}: browser says {m.group(1)}, publication says {aqg}"
