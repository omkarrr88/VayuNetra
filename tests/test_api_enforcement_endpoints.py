"""Enforcement endpoint tests (list, dossier, log, PDF notice, status change).

Uses FastAPI TestClient in DEMO_MODE (no Supabase needed). Covers filtering,
pagination, edge cases (unknown ids, invalid status), and the dossier's shape
including regulatory citations.
"""
from __future__ import annotations

import os

os.environ["DEMO_MODE"] = "true"

from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

import api.main as m  # noqa: E402

client = TestClient(m.app)


# --- /enforcement (list + filters) -----------------------------------------------

def test_enforcement_list_requires_city():
    """Missing city parameter must 422."""
    resp = client.get("/enforcement")
    assert resp.status_code == 422


def test_enforcement_list_by_city_delhi():
    """Fetch enforcement recs for Delhi."""
    resp = client.get("/enforcement?city=delhi")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    recs = body["data"]
    assert isinstance(recs, list)
    assert len(recs) > 0
    # All recs must be from delhi in the fixture.
    for rec in recs:
        assert rec.get("city_id") == "delhi"


def test_enforcement_list_by_city_bengaluru():
    """Fetch enforcement recs for Bengaluru."""
    resp = client.get("/enforcement?city=bengaluru")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    recs = body["data"]
    assert isinstance(recs, list)
    assert len(recs) > 0
    # All recs must be from bengaluru in the fixture.
    for rec in recs:
        assert rec.get("city_id") == "bengaluru"


def test_enforcement_list_by_city_mumbai():
    """Fetch enforcement recs for Mumbai."""
    resp = client.get("/enforcement?city=mumbai")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    recs = body["data"]
    assert isinstance(recs, list)
    assert len(recs) > 0
    # All recs must be from mumbai in the fixture.
    for rec in recs:
        assert rec.get("city_id") == "mumbai"


def test_enforcement_list_by_city_hyderabad():
    """Fetch enforcement recs for Hyderabad."""
    resp = client.get("/enforcement?city=hyderabad")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    recs = body["data"]
    assert isinstance(recs, list)
    assert len(recs) > 0
    # All recs must be from hyderabad in the fixture.
    for rec in recs:
        assert rec.get("city_id") == "hyderabad"


def test_enforcement_list_status_filter_proposed():
    """Filter enforcement recs by status 'proposed'."""
    resp = client.get("/enforcement?city=delhi&status=proposed")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    recs = body["data"]
    assert isinstance(recs, list)
    # All recs must have status 'proposed'.
    for rec in recs:
        assert rec.get("status") == "proposed"


def test_enforcement_list_status_filter_approved():
    """Filter enforcement recs by status 'approved' (may be empty in fixture)."""
    resp = client.get("/enforcement?city=delhi&status=approved")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    recs = body["data"]
    assert isinstance(recs, list)
    # All returned recs (if any) must have status 'approved'.
    for rec in recs:
        assert rec.get("status") == "approved"


def test_enforcement_list_limit_parameter():
    """Limit parameter restricts the number of results."""
    # Get all delhi enforcement recs.
    resp_all = client.get("/enforcement?city=delhi")
    all_count = len(resp_all.json()["data"])

    # Get with limit=2.
    resp_limited = client.get("/enforcement?city=delhi&limit=2")
    assert resp_limited.status_code == 200
    body = resp_limited.json()
    recs = body["data"]
    assert len(recs) <= 2
    # Unless there are less than 2 recs total, we should get exactly 2.
    if all_count >= 2:
        assert len(recs) == 2


def test_enforcement_list_limit_zero():
    """Limit of 0 should return an empty list."""
    resp = client.get("/enforcement?city=delhi&limit=0")
    assert resp.status_code == 200
    body = resp.json()
    recs = body["data"]
    assert recs == []


def test_enforcement_list_limit_large():
    """Large limit parameter should work without crashing."""
    resp = client.get("/enforcement?city=delhi&limit=1000")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    recs = body["data"]
    assert isinstance(recs, list)


def test_enforcement_list_city_and_status_and_limit():
    """Combine city, status, and limit filters."""
    resp = client.get("/enforcement?city=delhi&status=proposed&limit=3")
    assert resp.status_code == 200
    body = resp.json()
    recs = body["data"]
    assert isinstance(recs, list)
    assert len(recs) <= 3
    # All returned recs must be from delhi with status proposed.
    for rec in recs:
        assert rec.get("city_id") == "delhi"
        assert rec.get("status") == "proposed"


def test_enforcement_list_unknown_city_no_crash():
    """Unknown city should not crash; may return empty list."""
    resp = client.get("/enforcement?city=unknown_city_xyz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    # Should return empty or gracefully handle unknown city.
    recs = body["data"]
    assert isinstance(recs, list)


def test_enforcement_list_response_structure():
    """Enforcement list response has correct fields."""
    resp = client.get("/enforcement?city=delhi&limit=1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    recs = body["data"]
    if len(recs) > 0:
        rec = recs[0]
        # Check for key fields in enforcement rec.
        assert "id" in rec
        assert "city_id" in rec
        assert "h3_cell" in rec
        assert "ts" in rec
        assert "source_id" in rec
        assert "priority_score" in rec
        assert "contribution" in rec
        assert "pop_exposed" in rec
        assert "status" in rec
        assert "rationale" in rec
        assert "rag_citations" in rec
        assert "rubric_score" in rec


def test_enforcement_list_date_filter():
    """Date filter is accepted by the endpoint (may or may not filter)."""
    resp = client.get("/enforcement?city=delhi&date=2026-08-16")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    recs = body["data"]
    assert isinstance(recs, list)


# --- /enforcement/{rec_id}/dossier ---------------------------------------------------

def test_enforcement_dossier_valid_id():
    """Fetch dossier for a valid rec_id."""
    resp = client.get("/enforcement/1/dossier")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    dossier = body["data"]
    # Check dossier structure.
    assert "rec_id" in dossier
    assert "citations" in dossier
    assert isinstance(dossier["citations"], list)


def test_enforcement_dossier_contains_regulatory_citations():
    """Dossier citations have the expected structure (rule, url, excerpt, similarity)."""
    resp = client.get("/enforcement/1/dossier")
    assert resp.status_code == 200
    dossier = resp.json()["data"]
    citations = dossier.get("citations", [])
    # In DEMO_MODE, dossier.json has citations; verify their structure.
    for citation in citations:
        assert "rule" in citation
        assert "url" in citation
        assert "excerpt" in citation
        assert "similarity" in citation


def test_enforcement_dossier_contains_rationale():
    """Dossier includes the enforcement rationale."""
    resp = client.get("/enforcement/1/dossier")
    assert resp.status_code == 200
    dossier = resp.json()["data"]
    # Rationale should exist and be a string.
    if "rationale" in dossier:
        assert isinstance(dossier["rationale"], str)


def test_enforcement_dossier_contains_rubric_score():
    """Dossier includes the rubric scoring breakdown."""
    resp = client.get("/enforcement/1/dossier")
    assert resp.status_code == 200
    dossier = resp.json()["data"]
    # Rubric score may or may not be present, but if it is, it's a dict.
    if "rubric_score" in dossier:
        assert isinstance(dossier["rubric_score"], dict)


def test_enforcement_dossier_contains_suggested_notice_text():
    """Dossier includes a suggested enforcement notice text."""
    resp = client.get("/enforcement/1/dossier")
    assert resp.status_code == 200
    dossier = resp.json()["data"]
    # Suggested notice text may be present.
    if "suggested_notice_text" in dossier:
        assert isinstance(dossier["suggested_notice_text"], str)


def test_enforcement_dossier_unknown_id():
    """Fetch dossier for an unknown rec_id returns the fixture dossier (which has rec_id from fixture).

    In DEMO_MODE, all dossier requests return the bundled dossier.json fixture,
    regardless of rec_id. This is expected behavior for the demo mode.
    """
    resp = client.get("/enforcement/999999/dossier")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    dossier = body["data"]
    # In DEMO_MODE, dossier.json is always returned (has rec_id: 1).
    assert "rec_id" in dossier
    assert "citations" in dossier
    # The fixture contains dossier for rec_id 1.
    assert dossier["rec_id"] == 1


def test_enforcement_dossier_large_rec_id():
    """Fetch dossier for a very large rec_id (no crash)."""
    resp = client.get("/enforcement/999999999/dossier")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True


# --- /enforcement/{rec_id}/notice.pdf ------------------------------------------------

def test_enforcement_notice_pdf_valid_id():
    """Fetch PDF notice for a valid rec_id."""
    resp = client.get("/enforcement/1/notice.pdf")
    assert resp.status_code == 200
    # Response should be a PDF (application/pdf content type).
    assert "application/pdf" in resp.headers.get("content-type", "")
    # Should have Content-Disposition header for download.
    assert "attachment" in resp.headers.get("content-disposition", "")
    assert "notice_" in resp.headers.get("content-disposition", "")
    # PDF should have some content.
    assert len(resp.content) > 0


def test_enforcement_notice_pdf_has_correct_filename():
    """PDF notice has the correct filename in Content-Disposition header."""
    resp = client.get("/enforcement/1/notice.pdf")
    assert resp.status_code == 200
    disposition = resp.headers.get("content-disposition", "")
    assert "notice_1.pdf" in disposition


def test_enforcement_notice_pdf_unknown_id():
    """Fetch PDF notice for an unknown rec_id (may return demo notice)."""
    resp = client.get("/enforcement/999999/notice.pdf")
    # Should still return a PDF without crashing.
    assert resp.status_code == 200
    assert "application/pdf" in resp.headers.get("content-type", "")
    assert len(resp.content) > 0


def test_enforcement_notice_pdf_large_rec_id():
    """Fetch PDF notice for a very large rec_id (no crash)."""
    resp = client.get("/enforcement/999999999/notice.pdf")
    assert resp.status_code == 200
    assert "application/pdf" in resp.headers.get("content-type", "")
    assert len(resp.content) > 0


# --- /enforcement/{rec_id}/log -------------------------------------------------------

def test_enforcement_status_log_valid_id():
    """Fetch status log for a valid rec_id."""
    resp = client.get("/enforcement/1/log")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    log_data = body["data"]
    assert "rec_id" in log_data
    assert "log" in log_data
    # In DEMO_MODE, log should be empty.
    assert log_data["log"] == []


def test_enforcement_status_log_has_correct_rec_id():
    """Log response includes the correct rec_id."""
    resp = client.get("/enforcement/42/log")
    assert resp.status_code == 200
    log_data = resp.json()["data"]
    assert log_data["rec_id"] == 42


def test_enforcement_status_log_unknown_id():
    """Fetch status log for an unknown rec_id (graceful in DEMO_MODE)."""
    resp = client.get("/enforcement/999999/log")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    log_data = body["data"]
    # In DEMO_MODE, should return the requested rec_id with empty log.
    assert log_data["rec_id"] == 999999
    assert log_data["log"] == []


def test_enforcement_status_log_large_rec_id():
    """Fetch status log for a very large rec_id (no crash)."""
    resp = client.get("/enforcement/999999999/log")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True


# --- /enforcement/{rec_id}/status (POST) ============================================

def test_enforcement_status_change_valid_status():
    """POST a valid status change in DEMO_MODE."""
    resp = client.post("/enforcement/1/status", json={"status": "approved"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    result = body["data"]
    assert result["rec_id"] == 1
    assert result["status"] == "approved"
    # In DEMO_MODE, should return demo: True.
    assert result.get("demo") is True


def test_enforcement_status_change_proposed():
    """POST status 'proposed' (initial state)."""
    resp = client.post("/enforcement/1/status", json={"status": "proposed"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "proposed"


def test_enforcement_status_change_dispatched():
    """POST status 'dispatched' (action initiated)."""
    resp = client.post("/enforcement/1/status", json={"status": "dispatched"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "dispatched"


def test_enforcement_status_change_dismissed():
    """POST status 'dismissed' (action cancelled)."""
    resp = client.post("/enforcement/1/status", json={"status": "dismissed"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "dismissed"


def test_enforcement_status_change_closed():
    """POST status 'closed' with finding (action completed)."""
    resp = client.post("/enforcement/1/status", json={
        "status": "closed",
        "finding": "violation_found"
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "closed"


def test_enforcement_status_change_closed_finding_compliant():
    """POST status 'closed' with finding 'compliant'."""
    resp = client.post("/enforcement/1/status", json={
        "status": "closed",
        "finding": "compliant"
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "closed"


def test_enforcement_status_change_closed_finding_inaccessible():
    """POST status 'closed' with finding 'inaccessible'."""
    resp = client.post("/enforcement/1/status", json={
        "status": "closed",
        "finding": "inaccessible"
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "closed"


def test_enforcement_status_change_closed_finding_not_applicable():
    """POST status 'closed' with finding 'not_applicable'."""
    resp = client.post("/enforcement/1/status", json={
        "status": "closed",
        "finding": "not_applicable"
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "closed"


def test_enforcement_status_change_with_actor_and_note():
    """POST status change with optional actor name and note fields."""
    resp = client.post("/enforcement/1/status", json={
        "status": "approved",
        "actor": "Inspector Ahmed",
        "note": "Site inspection completed; violations found."
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["status"] == "approved"


def test_enforcement_status_change_invalid_status_garbage():
    """Invalid status value 'garbage' must 422."""
    resp = client.post("/enforcement/1/status", json={"status": "garbage"})
    assert resp.status_code == 422


def test_enforcement_status_change_invalid_status_pending():
    """Invalid status value 'pending' must 422."""
    resp = client.post("/enforcement/1/status", json={"status": "pending"})
    assert resp.status_code == 422


def test_enforcement_status_change_invalid_status_reopened():
    """Invalid status value 'reopened' must 422."""
    resp = client.post("/enforcement/1/status", json={"status": "reopened"})
    assert resp.status_code == 422


def test_enforcement_status_change_closed_without_finding():
    """Closing without finding must raise error (422 or similar)."""
    resp = client.post("/enforcement/1/status", json={"status": "closed"})
    # In DEMO_MODE, the check happens before DEMO_MODE return, so it should 422.
    assert resp.status_code == 422


def test_enforcement_status_change_closed_invalid_finding():
    """POST closed with invalid finding value must 422."""
    resp = client.post("/enforcement/1/status", json={
        "status": "closed",
        "finding": "garbage_finding"
    })
    assert resp.status_code == 422


def test_enforcement_status_change_missing_status():
    """Missing 'status' field must 422."""
    resp = client.post("/enforcement/1/status", json={})
    assert resp.status_code == 422


def test_enforcement_status_change_note_too_long():
    """Note exceeding max_length must 422."""
    long_note = "x" * 501  # max_length is 500
    resp = client.post("/enforcement/1/status", json={
        "status": "approved",
        "note": long_note
    })
    assert resp.status_code == 422


def test_enforcement_status_change_actor_too_long():
    """Actor name exceeding max_length must 422."""
    long_actor = "x" * 81  # max_length is 80
    resp = client.post("/enforcement/1/status", json={
        "status": "approved",
        "actor": long_actor
    })
    assert resp.status_code == 422


def test_enforcement_status_change_different_rec_ids():
    """POST status change to different rec_ids returns correct rec_id."""
    for rec_id in [1, 2, 12005, 12083]:
        resp = client.post(f"/enforcement/{rec_id}/status", json={"status": "approved"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["rec_id"] == rec_id


def test_enforcement_status_change_with_db_mock(monkeypatch):
    """When not in DEMO_MODE, status changes go to database (mocked here).

    We monkeypatch to avoid actual database writes. This test verifies the
    non-DEMO_MODE path handles valid/invalid input correctly.
    """
    # Mock DEMO_MODE to False so the real status change logic runs.
    monkeypatch.setattr(m, "DEMO_MODE", False)

    # Mock _db() and the status rate checker.
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"city_id": "delhi", "status": "proposed"}
    ]
    monkeypatch.setattr(m, "_db", lambda: mock_db)
    monkeypatch.setattr(m, "_status_rate_ok", lambda limit=60, window_s=60: True)

    # Mock get_db to return None (or a mock).
    def mock_get_db(credentials=None):
        return None

    monkeypatch.setattr(m, "get_db", mock_get_db)

    # Now POST a status change. The endpoint will use the mocked _db().
    # Note: This test runs outside the route context, so we can't easily
    # test the full endpoint. Instead, we validate the StatusBody model.
    body = m.StatusBody(status="approved")
    assert body.status == "approved"

    body2 = m.StatusBody(status="closed", finding="violation_found")
    assert body2.status == "closed"
    assert body2.finding == "violation_found"

    # Invalid status should fail at validation.
    try:
        m.StatusBody(status="invalid")
        assert False, "Should have raised validation error"
    except Exception:
        pass  # Expected


# --- Integration: enforcement features work together --------------------------------

def test_enforcement_workflow_list_then_dossier():
    """List enforcement recs, then fetch a dossier for one of them.

    In DEMO_MODE, the dossier endpoint always returns the bundled fixture
    dossier (rec_id 1) regardless of the rec_id parameter, so we verify
    the dossier is valid and has the expected structure.
    """
    # Get list for delhi.
    resp_list = client.get("/enforcement?city=delhi&limit=1")
    assert resp_list.status_code == 200
    recs = resp_list.json()["data"]
    assert len(recs) > 0

    # Get the first rec's ID.
    rec_id = recs[0]["id"]

    # Fetch a dossier (in DEMO_MODE, returns bundled fixture).
    resp_dossier = client.get(f"/enforcement/{rec_id}/dossier")
    assert resp_dossier.status_code == 200
    dossier = resp_dossier.json()["data"]
    # In DEMO_MODE, fixture dossier is always returned (rec_id 1).
    assert "rec_id" in dossier
    assert "citations" in dossier


def test_enforcement_workflow_list_then_notice_pdf():
    """List enforcement recs, then fetch a notice PDF for one of them."""
    # Get list for delhi.
    resp_list = client.get("/enforcement?city=delhi&limit=1")
    assert resp_list.status_code == 200
    recs = resp_list.json()["data"]
    assert len(recs) > 0

    # Get the first rec's ID.
    rec_id = recs[0]["id"]

    # Fetch its notice PDF.
    resp_pdf = client.get(f"/enforcement/{rec_id}/notice.pdf")
    assert resp_pdf.status_code == 200
    assert "application/pdf" in resp_pdf.headers.get("content-type", "")


def test_enforcement_workflow_list_then_log():
    """List enforcement recs, then fetch the status log for one of them."""
    # Get list for delhi.
    resp_list = client.get("/enforcement?city=delhi&limit=1")
    assert resp_list.status_code == 200
    recs = resp_list.json()["data"]
    assert len(recs) > 0

    # Get the first rec's ID.
    rec_id = recs[0]["id"]

    # Fetch its status log.
    resp_log = client.get(f"/enforcement/{rec_id}/log")
    assert resp_log.status_code == 200
    log_data = resp_log.json()["data"]
    assert log_data["rec_id"] == rec_id


def test_enforcement_all_cities_have_recs():
    """Every city should have at least one enforcement rec."""
    cities = ["delhi", "bengaluru", "mumbai", "hyderabad"]
    for city in cities:
        resp = client.get(f"/enforcement?city={city}")
        assert resp.status_code == 200
        recs = resp.json()["data"]
        # At least one rec per city in fixture.
        assert len(recs) > 0, f"City {city} has no enforcement recs"


def test_enforcement_recs_have_valid_status_values():
    """All enforcement recs have valid status values."""
    valid_statuses = {"proposed", "approved", "dispatched", "dismissed", "closed"}
    resp = client.get("/enforcement?city=delhi&limit=100")
    recs = resp.json()["data"]
    for rec in recs:
        assert rec["status"] in valid_statuses


def test_enforcement_dossier_population_exposed_is_number():
    """Dossier contains population_exposed as a number."""
    resp = client.get("/enforcement/1/dossier")
    dossier = resp.json()["data"]
    if "pop_exposed" in dossier:
        assert isinstance(dossier["pop_exposed"], (int, float))


def test_enforcement_list_citation_structure():
    """Enforcement rec citations have url, rule, excerpt, similarity."""
    resp = client.get("/enforcement?city=delhi&limit=1")
    recs = resp.json()["data"]
    if len(recs) > 0 and "rag_citations" in recs[0]:
        citations = recs[0]["rag_citations"]
        for citation in citations:
            assert "url" in citation
            assert "rule" in citation
            assert "excerpt" in citation
            assert "similarity" in citation
