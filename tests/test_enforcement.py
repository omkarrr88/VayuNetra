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


# --------------------------------------------------------------- value per inspector-hour
# The priority score answers "how big is this source". It cannot answer "where is my next hour
# best spent", which needs the cost of an inspection, whether the cell is heading for trouble at
# all, and how much of the estimate is worth betting on.

def test_value_is_risk_averse_a_sure_smaller_share_can_win():
    from agents.enforcement import _compute_value
    shaky = _compute_value(0.60, 0.40, 15_000, "construction_dust", pm25_low=90.0, p_exceed=0.7)
    sure = _compute_value(0.30, 0.95, 15_000, "construction_dust", pm25_low=90.0, p_exceed=0.7)
    # twice the share, but the model is only 40% sure of it
    assert sure["value_per_hour"] > shaky["value_per_hour"]
    assert shaky["share_low"] == 0.24     # 0.60 x 0.40
    assert sure["share_low"] == 0.285     # 0.30 x 0.95


def test_inspection_cost_can_outrank_a_bigger_source():
    from agents.enforcement import _compute_value
    industrial = _compute_value(0.60, 0.95, 15_000, "industrial", pm25_low=90.0, p_exceed=0.7)
    burning = _compute_value(0.45, 0.90, 15_000, "biomass_burning", pm25_low=90.0, p_exceed=0.7)
    # the industrial source is conservatively responsible for MORE pollution...
    assert industrial["delta_pm25_low"] > burning["delta_pm25_low"]
    # ...but a stack test costs eight hours and stopping a fire costs one
    assert burning["value_per_hour"] > industrial["value_per_hour"]


def test_a_cell_heading_for_very_poor_is_worth_more_but_a_clean_one_is_not_worthless():
    """Urgency scales the benefit; it does not gate it. Multiplying by P(exceed) outright would say
    pollution matters only above 120 µg/m³ — contradicting the no-safe-threshold science this
    product quotes — and in the monsoon, when P(>120) is ~0.001 everywhere, it collapses every score
    to nearly zero and the ranking stops discriminating."""
    from agents.enforcement import _compute_value
    heading_bad = _compute_value(0.4, 0.9, 10_000, "construction_dust", pm25_low=90.0, p_exceed=1.0)
    heading_fine = _compute_value(0.4, 0.9, 10_000, "construction_dust", pm25_low=90.0, p_exceed=0.0)
    assert heading_bad["value_per_hour"] > heading_fine["value_per_hour"]
    assert heading_bad["urgency_x"] == 4.0      # 1 + 3 x 1.0
    assert heading_fine["urgency_x"] == 1.0     # still worth acting on
    assert heading_fine["value_per_hour"] > 0   # reducing exposure always counts
    assert heading_bad["value_per_hour"] == heading_fine["value_per_hour"] * 4


def test_missing_forecast_falls_back_instead_of_inventing_a_number():
    from agents.enforcement import _compute_value
    v = _compute_value(0.4, 0.9, 10_000, "traffic", pm25_low=None, p_exceed=None)
    assert v["value_per_hour"] is None
    assert "priority score" in v["basis"]
    # the assumption is stated whether or not the value could be computed
    assert "not a measured figure" in v["assumption"]


def test_every_value_states_its_assumption_and_basis():
    from agents.enforcement import _compute_value, INSPECTOR_HOURS
    v = _compute_value(0.4, 0.9, 10_000, "industrial", pm25_low=80.0, p_exceed=0.5)
    assert v["inspector_hours"] == INSPECTOR_HOURS["industrial"]
    assert "conformal lower bound" in v["basis"]
    assert "not a measured figure" in v["assumption"]
    # every term of the arithmetic is exposed, so a reviewer can disagree with a number
    for k in ("share_low", "pm25_low", "p_exceed", "delta_pm25_low", "benefit_person_ugm3"):
        assert k in v


def test_forecast_index_takes_the_newest_and_the_worst_probability():
    from agents.enforcement import _cell_forecast_index
    rows = [
        {"h3_cell": "c1", "horizon_h": 24, "pi_low": 40.0, "p_over_120": 0.30, "issued_at": "2026-08-19T06:00:00Z"},
        {"h3_cell": "c1", "horizon_h": 48, "pi_low": 20.0, "p_over_120": 0.61, "issued_at": "2026-08-19T06:00:00Z"},
        {"h3_cell": "c1", "horizon_h": 24, "pi_low": 99.0, "p_over_120": 0.99, "issued_at": "2026-08-18T06:00:00Z"},
    ]
    idx = _cell_forecast_index(rows)
    assert idx["c1"]["pm25_low"] == 40.0      # newest +24 h bound — not yesterday's
    assert idx["c1"]["p_exceed"] == 0.61      # the worse of the two horizons


def test_forecast_index_handles_per_horizon_issue_stamps():
    """Production writes each horizon's batch seconds apart, so one cell's horizons carry
    DIFFERENT issued_at values. Selecting 'the newest issue for this cell' picked only the +72 h
    batch and then discarded it for being the wrong horizon, leaving every recommendation without a
    value. This is that regression."""
    from agents.enforcement import _cell_forecast_index
    rows = [
        {"h3_cell": "c1", "horizon_h": 72, "pi_low": 1.0, "p_over_120": 0.001, "issued_at": "2026-08-19T02:40:12Z"},
        {"h3_cell": "c1", "horizon_h": 48, "pi_low": 30.0, "p_over_120": 0.40, "issued_at": "2026-08-19T02:40:09Z"},
        {"h3_cell": "c1", "horizon_h": 24, "pi_low": 55.0, "p_over_120": 0.25, "issued_at": "2026-08-19T02:40:06Z"},
    ]
    idx = _cell_forecast_index(rows)
    assert idx["c1"]["pm25_low"] == 55.0      # the +24 h bound, despite being the OLDEST stamp
    assert idx["c1"]["p_exceed"] == 0.40


def test_forecast_index_ignores_unusable_rows():
    from agents.enforcement import _cell_forecast_index
    idx = _cell_forecast_index([
        {"h3_cell": None, "horizon_h": 24, "pi_low": 10.0, "p_over_120": 0.5, "issued_at": "2026-08-19T06:00:00Z"},
        {"h3_cell": "c2", "horizon_h": 72, "pi_low": 10.0, "p_over_120": 0.5, "issued_at": "2026-08-19T06:00:00Z"},
        {"h3_cell": "c3", "horizon_h": "x", "pi_low": 10.0, "p_over_120": 0.5, "issued_at": "2026-08-19T06:00:00Z"},
    ])
    assert idx == {}    # no cell, an unused horizon, and an unparseable horizon
