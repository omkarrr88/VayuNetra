"""Forecast exposure: expected people in band, population basis, person-hours."""
from ml.impact.exposure import compute_exposure


def _rows():
    out = []
    for h, p120, p250, v in ((24, 0.9, 0.2, 140), (48, 0.5, 0.1, 118), (72, 0.1, 0.0, 80)):
        out.append({"h3_cell": "a", "horizon_h": h, "value": v, "p_over_120": p120, "p_over_250": p250})
        out.append({"h3_cell": "b", "horizon_h": h, "value": v - 30, "p_over_120": p120 / 2, "p_over_250": 0.0})
    return out


def test_uniform_basis_when_no_gpw():
    res = compute_exposure(_rows(), {}, 1_000_000)
    assert res["population_basis"] == "uniform_city_population"
    h24 = next(e for e in res["horizons"] if e["horizon_h"] == 24)
    # 500k × 0.9 + 500k × 0.45 = 675k expected in Very Poor+
    assert h24["people_very_poor"] == 675_000
    assert h24["people_severe"] == 100_000
    assert h24["calibrated"] is True
    assert res["person_hours_24_to_72h"]["very_poor"] > 0


def test_gpw_weights_used_when_available():
    res = compute_exposure(_rows(), {"a": 300_000, "b": 100_000, "zzz": 5}, 9_999_999)
    assert res["population_basis"] == "gpw411_cells"
    assert res["population_covered"] == 400_000


def test_point_fallback_without_probabilities():
    rows = [{"h3_cell": "a", "horizon_h": 24, "value": 130}, {"h3_cell": "b", "horizon_h": 24, "value": 50}]
    res = compute_exposure(rows, {}, 200_000)
    h24 = res["horizons"][0]
    assert h24["calibrated"] is False
    assert h24["people_very_poor"] == 100_000
