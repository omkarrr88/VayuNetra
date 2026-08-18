"""Tests for api.main (FastAPI read-API).

Uses FastAPI TestClient in DEMO_MODE (no Supabase needed).
"""
from __future__ import annotations

import os

os.environ["DEMO_MODE"] = "true"

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["status"] == "ok"
    assert body["data"]["demo_mode"] is True


def test_cities():
    resp = client.get("/cities")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    cities = body["data"]
    assert isinstance(cities, list)
    assert len(cities) >= 3
    city_ids = {c["city_id"] for c in cities}
    assert "delhi" in city_ids


def test_aqi_current():
    resp = client.get("/aqi/current?city=delhi")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True


def test_attribution():
    resp = client.get("/attribution?city=delhi")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    rows = body["data"]
    assert isinstance(rows, list)
    assert len(rows) > 0


def test_forecast():
    resp = client.get("/forecast?city=delhi")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True


def test_enforcement_list():
    resp = client.get("/enforcement?city=delhi")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    recs = body["data"]
    assert isinstance(recs, list)


def test_enforcement_dossier():
    resp = client.get("/enforcement/1/dossier")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    dossier = body["data"]
    assert "rec_id" in dossier
    assert "citations" in dossier


def test_advisory():
    resp = client.get("/advisory?city=delhi&lang=en")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True


def test_agent_query():
    resp = client.post("/agent/query", json={
        "city": "delhi",
        "query": "what are the top enforcement priorities?",
        "focus_cells": ["883da1a3a1fffff"],
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    data = body["data"]
    assert "enforcement" in data
    assert "trace" in data
    assert "latency_ms" in data


def test_simulate():
    resp = client.post("/simulate", json={"city": "delhi", "intervention_type": "construction_halt"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True


def test_optimize():
    resp = client.post("/optimize", json={"city": "delhi", "budget_inspector_hours": 20})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "packages" in body["data"]


def test_admin_onboard_city():
    resp = client.post("/admin/cities", json={
        "city_id": "hyderabad",
        "name": "Hyderabad",
        "state": "TS",
        "languages": ["te", "en"],
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["onboarded"] == "hyderabad"


def test_admin_onboard_city_missing_id():
    resp = client.post("/admin/cities", json={"name": "SomeCity"})
    # Pydantic will catch the missing required field
    assert resp.status_code in (422, 400)


def test_traces():
    resp = client.get("/traces?city=delhi")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True


def test_enforcement_status_update():
    resp = client.post("/enforcement/1/status", json={"status": "approved"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["status"] == "approved"


def test_enforcement_status_invalid():
    # Invalid enum is now rejected by Pydantic validation (proper 422), not a
    # 200 envelope with success=false.
    resp = client.post("/enforcement/1/status", json={"status": "invalid_status"})
    assert resp.status_code == 422
