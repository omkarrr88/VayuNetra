"""E7 — health & carbon quantification tests (Stage 2)."""
from ml.impact import city_roi, co2e_cobenefit, quantify_intervention
from ml.impact import factors as F


def test_every_factor_is_cited():
    # PRD §12.15 / Validation #12: no invented constants — each figure has a source.
    for c in F.all_citations():
        assert c["source"], f"factor '{c['figure']}' is missing its citation"


def test_quantify_intervention_health_and_carbon():
    sim = {
        "delta_pm25_by_cell": {"a": -30.0, "b": -10.0},
        "pm25_tonnes_avoided": 2.0,
        "intervention": {"type": "waste_burn_ban", "reductions": {"biomass_burning": 0.7}, "horizon_h": 24},
    }
    r = quantify_intervention(sim)
    assert r["cases_prevented"] >= 0
    assert r["health_cost_avoided_inr"] >= 0
    assert r["co2e_tonnes"] == round(2.0 * F.CO2_PER_PM25_RATIO["biomass_burning"].value, 1)
    assert r["impact"]["citations"], "impact must carry its citations"


def test_co2e_is_none_when_not_defensible():
    assert co2e_cobenefit(None, "biomass_burning") is None          # tonnes unknown
    assert co2e_cobenefit(2.0, "construction_dust") is None          # dust has no CO2 co-benefit


def test_no_averted_cases_without_reduction():
    sim = {"delta_pm25_by_cell": {"a": 0.0}, "pm25_tonnes_avoided": None,
           "intervention": {"reductions": {}, "horizon_h": 24}}
    r = quantify_intervention(sim)
    assert r["cases_prevented"] == 0
    assert r["co2e_tonnes"] is None


def test_city_roi_positive_and_cited():
    roi = city_roi("delhi", annual_pm25=92.0, population=20_000_000)
    assert roi["attributable_deaths_per_year"] > 0
    assert 0 < roi["deaths_avertable_per_year"] < roi["attributable_deaths_per_year"]
    assert roi["annual_health_burden_inr"] > roi["annual_savings_inr"]
    assert roi["citations"]


def test_city_roi_scales_with_pollution():
    clean = city_roi("x", annual_pm25=20.0, population=1_000_000)
    dirty = city_roi("y", annual_pm25=120.0, population=1_000_000)
    assert dirty["attributable_deaths_per_year"] > clean["attributable_deaths_per_year"]
