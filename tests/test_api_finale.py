"""API tests for the finale additions (DEMO_MODE, no Supabase): benchmark artifacts,
exposure, the officer brief (JSON + PDF + send), status writes, comparison fixture."""
from __future__ import annotations

import os

os.environ["DEMO_MODE"] = "true"
os.environ["WARM_ON_START"] = "0"

from fastapi.testclient import TestClient  # noqa: E402

import api.main as m  # noqa: E402

client = TestClient(m.app)


def test_metrics_benchmark_serves_the_artifact_and_summary():
    r = client.get("/metrics/benchmark?city=delhi")
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["city_id"] == "delhi" and d["history"] is not None
    heads = d["history"]["headline"]
    assert [h["horizon_h"] for h in heads] == [24, 48, 72]
    h24 = heads[0]
    for k in ("skill_vs_persistence", "onset_recall_model", "pi80_coverage", "brier_skill_very_poor"):
        assert k in h24
    # full=true returns the complete per-regime tables (what docs/benchmarks/*.md is built from)
    full = client.get("/metrics/benchmark?city=delhi&full=true").json()["data"]["history"]
    assert "horizons" in full and "regimes" in full["horizons"][0]


def test_metrics_benchmark_404_for_unknown_city():
    assert client.get("/metrics/benchmark?city=atlantis").status_code == 404


def test_exposure_from_fixture_forecasts():
    r = client.get("/exposure?city=delhi")
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["city_id"] == "delhi"
    assert d["population_basis"] in ("uniform_city_population", "gpw411_cells", "none")
    assert len(d["horizons"]) == 3 and "population_citation" in d
    assert d["method"].startswith("expected people")


def test_brief_json_pdf_and_send_in_demo_mode():
    r = client.get("/brief?city=delhi")
    assert r.status_code == 200
    b = r.json()["data"]
    assert b["city_id"] == "delhi" and "air" in b and "actions" in b and "provenance" in b
    assert "language model" in b["provenance"]
    pdf = client.get("/brief.pdf?city=delhi")
    assert pdf.status_code == 200 and pdf.headers["content-type"] == "application/pdf"
    assert pdf.content[:4] == b"%PDF"
    sent = client.post("/brief/send", json={"city": "delhi"})
    assert sent.status_code == 200
    assert sent.json()["data"]["status"] == "skipped"          # no Telegram in tests, said honestly


def test_status_write_is_validated_and_demo_safe():
    ok = client.post("/enforcement/1/status", json={"status": "dispatched"})
    assert ok.status_code == 200 and ok.json()["data"]["demo"] is True
    bad = client.post("/enforcement/1/status", json={"status": "shipped"})
    assert bad.status_code == 422


def test_comparison_fixture_covers_all_ten_cities_with_sources():
    d = client.get("/comparison").json()["data"]
    assert len(d["cities"]) == 10
    assert all(c.get("dominant_source") not in (None, "", "unknown") for c in d["cities"])
    assert all((c.get("current_pm25") or 0) > 0 for c in d["cities"])


def test_ward_lookup_names_places_in_every_city():
    from core.wards import place_for_latlng

    probes = {"delhi": (28.66, 77.13), "kolkata": (22.57, 88.36), "pune": (18.52, 73.86), "ahmedabad": (23.03, 72.58),
              "jaipur": (26.92, 75.82), "lucknow": (26.85, 80.95), "chennai": (13.08, 80.27), "hyderabad": (17.39, 78.48),
              "bengaluru": (12.97, 77.59), "mumbai": (19.07, 72.88)}
    for city, (lat, lng) in probes.items():
        p = place_for_latlng(city, lat, lng)
        assert p and p["label"], city
