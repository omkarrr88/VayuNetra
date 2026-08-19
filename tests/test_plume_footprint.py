"""Plume footprint geometry + /plume endpoint tests.

The polygon math must be orientation-correct (downwind), calm-safe (no NaN,
no infinite plume in stagnant air), and honestly labeled (relative intensity).
"""
import math
import os

os.environ["DEMO_MODE"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

import api.main as m  # noqa: E402
from ml.dispersion.footprint import (  # noqa: E402
    plume_footprints,
    wind_bearing_deg,
)

client = TestClient(m.app)

SRC = [
    {"id": 1, "name": "Plant A", "type": "industry", "lon": 77.20, "lat": 28.60,
     "detection_confidence": 0.9},
    {"id": 2, "name": "Site B", "type": "construction", "lon": 77.25, "lat": 28.65,
     "detection_confidence": 0.5},
]


def test_bearing_convention():
    assert wind_bearing_deg(1, 0) == 90.0    # eastward wind -> plume travels east
    assert wind_bearing_deg(0, 1) == 0.0     # northward
    assert wind_bearing_deg(0, -1) == 180.0  # southward


def test_east_wind_extends_polygon_east():
    out = plume_footprints(SRC, wind_u=4.0, wind_v=0.0, is_day=True, top=5)
    poly = out["plumes"][0]["polygon"]
    lon0, lat0 = out["plumes"][0]["origin"]
    lons = [p[0] for p in poly]
    lats = [p[1] for p in poly]
    assert max(lons) - lon0 > 0.005          # reaches clearly east
    assert min(lons) >= lon0 - 1e-4          # nothing upwind
    assert abs(max(lats) - lat0) < abs(max(lons) - lon0)  # elongated, not round


def test_polygon_ring_is_closed_and_finite():
    out = plume_footprints(SRC, wind_u=2.0, wind_v=-3.0, is_day=False, top=5)
    for p in out["plumes"]:
        ring = p["polygon"]
        assert ring[0] == ring[-1]
        assert all(math.isfinite(c) for pt in ring for c in pt)


def test_calm_wind_is_flagged_and_bounded():
    out = plume_footprints(SRC, wind_u=0.0, wind_v=0.0, is_day=True, top=5)
    assert out["wind"]["calm"] is True
    assert out["reach_m"] <= 1500
    assert len(out["plumes"]) == 2           # still renders, just short footprints


def test_intensity_relative_and_ranked():
    out = plume_footprints(SRC, wind_u=3.0, wind_v=1.0, is_day=True, top=5)
    intensities = [p["intensity"] for p in out["plumes"]]
    assert intensities[0] == 1.0             # top source normalized to 1
    assert intensities == sorted(intensities, reverse=True)
    assert out["plumes"][0]["type"] == "industry"  # outweighs construction


def test_top_cap_and_missing_coords_skipped():
    many = SRC + [{"id": 3, "name": "NoGeom", "type": "industry"}]
    out = plume_footprints(many * 10, wind_u=3.0, wind_v=0.0, top=4)
    assert len(out["plumes"]) == 4


def test_note_declares_relative_intensity():
    out = plume_footprints(SRC, wind_u=3.0, wind_v=0.0)
    assert "relative" in out["note"]


# --- endpoint (DEMO_MODE fixture) ---------------------------------------------

def test_plume_endpoint_fixture():
    r = client.get("/plume", params={"city": "delhi"})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["plumes"], "fixture must contain plumes"
    assert "wind" in body["data"]


def test_plume_endpoint_unknown_city_returns_empty_layer():
    # consistent with /coverage: unknown city is an empty layer, not an error,
    # so /admin/cities onboarding stays graceful
    body = client.get("/plume", params={"city": "atlantis"}).json()
    assert body["success"] is True
    assert body["data"]["plumes"] == []
    assert body["data"]["wind"] is None


def test_plume_endpoint_validates_top():
    assert client.get("/plume", params={"city": "delhi", "top": 999}).status_code == 422


# --- /history (48h PM2.5 trend) ----------------------------------------------

def test_history_fixture_series():
    body = client.get("/history", params={"city": "delhi"}).json()
    assert body["success"] is True
    series = body["data"]["series"]
    assert len(series) >= 12
    assert all(p["pm25"] > 0 and p["n"] > 0 for p in series)
    assert series == sorted(series, key=lambda p: p["ts"])


def test_history_unknown_city_empty_not_error():
    body = client.get("/history", params={"city": "atlantis"}).json()
    assert body["success"] is True
    assert body["data"]["series"] == []


def test_history_validates_hours():
    assert client.get("/history", params={"city": "delhi", "hours": 9999}).status_code == 422


def test_plume_uses_current_wind_not_a_forecast_hour():
    """Open-Meteo supplies forecast hours alongside history, so `newest row` is up to ~30 hours
    ahead. The plume was drawing tomorrow's wind on a map labelled "now".

    It showed as Delhi losing its wind arrows: 0.18 m/s at the future hour (below the speed at
    which a Gaussian plume is defined, so flagged calm and hidden) against 1.66 m/s actually
    blowing. Windier cities were windy in both hours, so only Delhi looked broken.
    """
    import inspect

    import api.main as m

    src = inspect.getsource(m)
    i = src.index('return err("no_wind"')
    window = src[max(0, i - 1200):i]
    assert '.lte("ts", now_iso)' in window, (
        "the plume must select the most recent wind AT OR BEFORE NOW, not the newest row"
    )
