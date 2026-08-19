"""The scoreboard must rank and label with the same PM2.5 the AQI badge is derived from."""
from __future__ import annotations

from agents.multicity import build_comparison

CITIES = [{"city_id": "bengaluru", "name": "Bengaluru"}, {"city_id": "delhi", "name": "Delhi"}]

# Bengaluru as it actually was on 19 Aug 2026: six cells, one of them stuck at 256 ug/m3.
BENGALURU_CELLS = [256.0, 28.0, 21.4, 16.0, 10.0, 6.0]
AQI_ROWS = (
    [{"city_id": "bengaluru", "pm25": v, "dominant_source": "traffic"} for v in BENGALURU_CELLS]
    + [{"city_id": "delhi", "pm25": 38.0, "dominant_source": "construction_dust"}]
)
FORECASTS = [{"city_id": "bengaluru", "horizon_h": 24, "value": 11.4},
             {"city_id": "delhi", "horizon_h": 24, "value": 32.2}]
INDEX = {"bengaluru": {"pm25_24h": 25.0, "aqi_in": 120}, "delhi": {"pm25_24h": 38.3, "aqi_in": 129}}


def _card(data, cid):
    return next(c for c in data["cities"] if c["city_id"] == cid)


def test_one_faulty_station_does_not_set_the_city_figure():
    """The cell mean is 56.2 — a sixth of a single 256 reading lands straight on the average."""
    blr = _card(build_comparison(CITIES, AQI_ROWS, FORECASTS, None, INDEX), "bengaluru")
    assert blr["current_pm25"] == 25.0
    assert blr["current_pm25_basis"] == "city_24h_mean"


def test_ranking_matches_the_badge_not_a_second_number():
    """Ranked on the cell mean, Bengaluru (56.2) looks dirtier than Delhi (38.0). It is not."""
    data = build_comparison(CITIES, AQI_ROWS, FORECASTS, None, INDEX)
    ranked = sorted(data["cities"], key=lambda c: c["current_pm25"])
    assert [c["city_id"] for c in ranked] == ["bengaluru", "delhi"]


def test_trend_is_computed_from_the_figure_the_card_shows():
    """A trend measured against a number the reader cannot see is not checkable."""
    blr = _card(build_comparison(CITIES, AQI_ROWS, FORECASTS, None, INDEX), "bengaluru")
    # 25.0 -> 11.4 is a 54% fall, comfortably past the band; the inflated 56.2 would have
    # exaggerated it further, which is how a sensor fault became a headline "improving".
    assert blr["trend"] == "improving"


def test_falls_back_to_the_cell_mean_when_the_index_is_unavailable():
    """The RPC can fail; the scoreboard still has to render, and must say what it fell back to."""
    blr = _card(build_comparison(CITIES, AQI_ROWS, FORECASTS, None, {}), "bengaluru")
    assert blr["current_pm25_basis"] == "latest_per_cell"
    assert blr["current_pm25"] > 50.0     # the old, fragile number — labelled as such
