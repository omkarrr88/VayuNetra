"""Tests for agents.enforcement (Agent 3).

All tests run in DEMO_MODE=true.
"""
from __future__ import annotations

import os
import pytest

os.environ["DEMO_MODE"] = "true"


def test_run_enforcement_returns_recs():
    """run_enforcement should return at least one recommendation in DEMO_MODE."""
    from agents.enforcement import run_enforcement
    recs = run_enforcement("delhi")
    assert len(recs) > 0, "Should produce at least one enforcement recommendation"


def test_enforcement_recs_sorted_by_priority():
    """Recommendations should be sorted by priority score descending."""
    from agents.enforcement import run_enforcement
    recs = run_enforcement("delhi")
    scores = [r.priority_score for r in recs]
    assert scores == sorted(scores, reverse=True), "Recs should be sorted by priority descending"


def test_enforcement_rec_has_citations():
    """Each recommendation should have RAG citations."""
    from agents.enforcement import run_enforcement
    recs = run_enforcement("delhi")
    for rec in recs:
        assert isinstance(rec.rag_citations, list), "rag_citations should be a list"
        assert len(rec.rag_citations) > 0, "Should have at least one citation"
        # Each citation should have a 'rule' key
        for cit in rec.rag_citations:
            assert "rule" in cit, "Citation should have a 'rule' key"


def test_rubric_score_structure():
    """Rubric score should be a dict with 'total' key."""
    from agents.enforcement import run_enforcement
    recs = run_enforcement("delhi")
    for rec in recs:
        rubric = rec.rubric_score
        assert isinstance(rubric, dict), "rubric_score should be a dict"
        assert "total" in rubric, "rubric_score should have 'total' key"
        assert 0 <= rubric["total"] <= 10, "Total should be between 0 and 10"


def test_build_dossier():
    """build_dossier should return a dict with required keys."""
    from agents.enforcement import build_dossier
    dossier = build_dossier(rec_id=1)
    assert isinstance(dossier, dict)
    assert "rec_id" in dossier
    assert "citations" in dossier
    assert "suggested_notice_text" in dossier
    assert isinstance(dossier["citations"], list)


def test_priority_score_range():
    """Priority scores should be in [0, 1]."""
    from agents.enforcement import run_enforcement
    recs = run_enforcement("delhi")
    for rec in recs:
        assert 0.0 <= rec.priority_score <= 1.0, f"Priority score out of range: {rec.priority_score}"


def test_enforcement_to_dict():
    """to_dict() should produce a serialisable dict."""
    import json
    from agents.enforcement import run_enforcement
    recs = run_enforcement("delhi")
    for rec in recs:
        d = rec.to_dict()
        # Should be JSON serialisable
        json.dumps(d)
        assert "city_id" in d
        assert "priority_score" in d
        assert "rationale" in d
        assert "status" in d
