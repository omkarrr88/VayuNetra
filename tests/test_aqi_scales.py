"""Both AQI standards: sub-index arithmetic, unit normalisation, the composite (max) rule and the
prominent pollutant — checked against public reference values (aqi.in / IQAir, 18 Aug 2026 Delhi)."""
from __future__ import annotations

import pytest

from core.aqi import CPCB, EPA, _sub_index, category, composite, normalise


def test_cpcb_pm25_breakpoints_match_published_bands():
    assert _sub_index(CPCB["pm25"], 0) == 0
    assert _sub_index(CPCB["pm25"], 30) == 50
    assert _sub_index(CPCB["pm25"], 60) == 100
    assert _sub_index(CPCB["pm25"], 90) == 200
    assert _sub_index(CPCB["pm25"], 120) == 300
    assert _sub_index(CPCB["pm25"], 250) == 400


def test_delhi_18_aug_2026_matches_the_public_dashboards():
    """aqi.in showed PM2.5 48, PM10 133 → AQI (IN) 123 prominent PM10; AQI (US) ≈ 132 from PM2.5."""
    r = composite([{"pollutant": "pm25", "value": 48, "unit": "µg/m³"},
                   {"pollutant": "pm10", "value": 133, "unit": "µg/m³"}])
    assert abs(r["aqi_in"] - 123) <= 2 and r["prominent_in"] == "pm10"
    assert r["category_in"] == "Moderate"                      # CPCB naming for 101–200
    assert abs(r["aqi_us"] - 132) <= 3 and r["prominent_us"] == "pm25"
    assert r["category_us"] == "Unhealthy for Sensitive Groups"


def test_pm25_only_cell_gives_the_pm25_sub_index_on_both_scales():
    r = composite([{"pollutant": "pm25", "value": 34, "unit": "µg/m³"}])
    assert r["aqi_in"] == 56 and r["category_in"] == "Satisfactory"      # IQAir's 34 µg/m³ …
    assert abs(r["aqi_us"] - 97) <= 2 and r["category_us"] == "Moderate"  # … their US AQI 97


def test_gas_units_are_normalised_per_scale():
    n = normalise("no2", 100, "ppb")
    assert n["cpcb"] == pytest.approx(188.0)      # µg/m³ for CPCB
    assert n["epa"] == pytest.approx(100.0)       # ppb for EPA
    n = normalise("no2", 188, "µg/m³")
    assert n["cpcb"] == pytest.approx(188.0) and n["epa"] == pytest.approx(100.0, rel=1e-3)
    o = normalise("o3", 100, "µg/m³")
    assert o["epa"] == pytest.approx(0.051, rel=1e-2)          # ppm for EPA
    assert normalise("co", 0.64, "ppb") == {"cpcb": None, "epa": None}   # ambiguous → skipped


def test_glitched_reading_never_sets_the_headline():
    r = composite([{"pollutant": "no2", "value": 900, "unit": "ppb"},   # 1692 µg/m³ — implausible
                   {"pollutant": "pm25", "value": 40, "unit": "µg/m³"}])
    assert r["prominent_in"] == "pm25" and r["aqi_in"] == 66


def test_categories_are_scale_specific():
    assert category(81, "in") == "Satisfactory" and category(81, "us") == "Moderate"
    assert category(160, "in") == "Moderate" and category(160, "us") == "Unhealthy"
    assert category(450, "in") == "Severe" and category(450, "us") == "Hazardous"


def test_epa_pm25_uses_the_2024_revision():
    assert _sub_index(EPA["pm25"], 9.0) == 50        # 2024 revision moved this from 12.0
    assert _sub_index(EPA["pm25"], 35.4) == 100


# --------------------------------------------------------------------------- mislabelled units
# One Delhi OpenAQ station publishes the CPCB µg/m³ feed re-labelled as ppb. Believing the label
# multiplies NO2 by 1.88 and SO2 by 2.62, which handed Delhi's National AQI to NO2 on 19 Aug 2026
# when PM10 was actually driving it. The tell is CO: a "ppb" value below 50 cannot be ambient air.

DELHI_MISLABELLED = [
    {"pollutant": "pm25", "value": 40.0, "unit": "µg/m³"},
    {"pollutant": "pm10", "value": 88.0, "unit": "µg/m³"},
    {"pollutant": "no2", "value": 38.0, "unit": "ppb"},
    {"pollutant": "so2", "value": 14.4, "unit": "ppb"},
    {"pollutant": "co", "value": 0.8, "unit": "ppb"},      # impossible as ppb → mg/m³
    {"pollutant": "o3", "value": 5.0, "unit": "µg/m³"},    # same station, mass units
]


def test_impossible_co_in_ppb_marks_the_feed_untrustworthy():
    from core.aqi import units_are_trustworthy
    assert units_are_trustworthy(DELHI_MISLABELLED) is False


def test_mixed_unit_systems_from_one_station_are_untrustworthy():
    from core.aqi import units_are_trustworthy
    assert units_are_trustworthy([
        {"pollutant": "no2", "value": 30.0, "unit": "ppb"},
        {"pollutant": "o3", "value": 20.0, "unit": "µg/m³"},
    ]) is False


def test_a_genuine_ppb_feed_is_still_believed():
    from core.aqi import composite, units_are_trustworthy
    genuine = [
        {"pollutant": "no2", "value": 38.0, "unit": "ppb"},
        {"pollutant": "co", "value": 900.0, "unit": "ppb"},   # plausible ambient CO in ppb
    ]
    assert units_are_trustworthy(genuine) is True
    # 38 ppb NO2 = 71.4 µg/m³ → CPCB sub-index 89
    assert composite(genuine)["sub_in"]["no2"] == 89


def test_all_mass_units_are_trustworthy():
    from core.aqi import units_are_trustworthy
    assert units_are_trustworthy([
        {"pollutant": "no2", "value": 38.0, "unit": "µg/m³"},
        {"pollutant": "co", "value": 0.8, "unit": "mg/m3"},
    ]) is True


def test_mislabelled_feed_gives_pm10_not_no2_the_indian_index():
    from core.aqi import composite
    c = composite(DELHI_MISLABELLED)
    # NO2 38 µg/m³ → sub-index 48, not the 89 the bogus ppb conversion produced
    assert c["sub_in"]["no2"] == 48
    assert c["sub_in"]["so2"] == 18
    assert c["prominent_in"] == "pm10"
    assert c["aqi_in"] == 88


def test_mislabelled_feed_leaves_the_us_index_on_pm25():
    from core.aqi import composite
    c = composite(DELHI_MISLABELLED)
    # US EPA 2024 PM2.5: 40 µg/m³ sits in 35.5-55.4 → 101-150
    assert c["sub_us"]["pm25"] == 112
    assert c["prominent_us"] == "pm25"
    assert c["aqi_us"] == 112


def test_co_becomes_usable_once_the_label_is_corrected():
    from core.aqi import composite
    c = composite(DELHI_MISLABELLED)
    # 0.8 mg/m³ → CPCB CO band (0, 1.0, 0, 50) → 40; EPA wants ppm → 0.70 ppm → 8
    assert c["sub_in"]["co"] == 40
    assert c["sub_us"]["co"] == 8
