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


class _FakeQuery:
    """Just enough of the supabase-py builder for write_worklist: select/neq/eq/limit/execute,
    update(...).eq(...).execute, delete().eq().eq().execute, insert().execute."""

    def __init__(self, store, table):
        self.store, self.table = store, table
        self.filters, self.op, self.payload = [], "select", None

    def select(self, *_): self.op = "select"; return self
    def update(self, patch): self.op = "update"; self.payload = patch; return self
    def delete(self): self.op = "delete"; return self
    def insert(self, rows): self.op = "insert"; self.payload = rows; return self
    def eq(self, k, v): self.filters.append((k, v, True)); return self
    def neq(self, k, v): self.filters.append((k, v, False)); return self
    def limit(self, *_): return self

    def _match(self, r):
        return all((r.get(k) == v) == want for k, v, want in self.filters)

    def execute(self):
        rows = self.store[self.table]
        if self.op == "select":
            return type("R", (), {"data": [dict(r) for r in rows if self._match(r)]})()
        if self.op == "update":
            hit = [r for r in rows if self._match(r)]
            for r in hit: r.update(self.payload)
            return type("R", (), {"data": hit})()
        if self.op == "delete":
            gone = [r for r in rows if self._match(r)]
            self.store[self.table] = [r for r in rows if not self._match(r)]
            return type("R", (), {"data": gone})()
        if self.op == "insert":
            nxt = max([r["id"] for r in rows] + [0]) + 1
            for i, r in enumerate(self.payload):
                rows.append({"id": nxt + i, **r})
            return type("R", (), {"data": self.payload})()
        raise AssertionError(self.op)


class _FakeDb:
    def __init__(self, rows): self.store = {"enforcement_recs": rows}
    def table(self, name): return _FakeQuery(self.store, name)


def test_write_worklist_keeps_acted_upon_recs_and_their_ids():
    from agents.enforcement import write_worklist

    db = _FakeDb([
        {"id": 1, "city_id": "delhi", "h3_cell": "a", "source_id": 10, "status": "dispatched", "priority_score": 0.5},
        {"id": 2, "city_id": "delhi", "h3_cell": "b", "source_id": 11, "status": "proposed", "priority_score": 0.4},
        {"id": 3, "city_id": "delhi", "h3_cell": "c", "source_id": 12, "status": "closed", "priority_score": 0.3},
        {"id": 4, "city_id": "mumbai", "h3_cell": "z", "source_id": 99, "status": "proposed", "priority_score": 0.9},
    ])
    new_rows = [
        {"city_id": "delhi", "h3_cell": "a", "source_id": 10, "status": "proposed", "priority_score": 0.7},   # same source, re-ranked
        {"city_id": "delhi", "h3_cell": "d", "source_id": 13, "status": "proposed", "priority_score": 0.6},   # brand new
    ]
    out = write_worklist(db, "delhi", new_rows)
    rows = {r["id"]: r for r in db.store["enforcement_recs"]}
    assert out == {"inserted": 1, "refreshed": 1, "deleted": 1}
    assert rows[1]["status"] == "dispatched" and rows[1]["priority_score"] == 0.7   # kept + refreshed
    assert rows[3]["status"] == "closed"                                            # kept even if no longer ranked
    assert 2 not in rows                                                             # stale proposed dropped
    assert rows[4]["city_id"] == "mumbai"                                            # other cities untouched
    assert any(r["h3_cell"] == "d" for r in rows.values())                           # new one inserted
