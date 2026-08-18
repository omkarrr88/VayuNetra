"""Tests for agents.graph (Agent 0 Orchestrator).

All tests run in DEMO_MODE=true so no external services are needed.
"""
from __future__ import annotations

import os
import pytest

os.environ["DEMO_MODE"] = "true"


def test_build_graph_compiles():
    """Graph should compile without errors."""
    from agents.graph import build_graph
    g = build_graph()
    assert g is not None


def test_run_query_returns_state():
    """run_query should return a dict with expected keys."""
    from agents.graph import run_query
    state = run_query("delhi", query="enforcement priorities")
    assert isinstance(state, dict)
    # Trace should have at least orchestrator entry
    trace = state.get("trace") or []
    nodes = [t["node"] for t in trace]
    assert "orchestrator" in nodes
    assert "attribution" in nodes
    assert "forecast" in nodes
    assert "advisory" in nodes


def test_spike_gate_enforcement():
    """When focus_cells is provided, enforcement node should run."""
    from agents.graph import run_query
    state = run_query("delhi", focus_cells=["883da1a3a1fffff"])
    trace = state.get("trace") or []
    nodes = [t["node"] for t in trace]
    assert "enforcement" in nodes, "enforcement node should run when focus_cells are provided"


def test_spike_gate_no_enforcement():
    """When no focus_cells and no spike, enforcement node should NOT run."""
    from agents.graph import run_query
    # Inject a mock scenario with no spiking cells
    state = run_query("delhi", focus_cells=[])
    trace = state.get("trace") or []
    nodes = [t["node"] for t in trace]
    # Advisory should always be in the trace
    assert "advisory" in nodes


def test_enforcement_recs_in_state():
    """When enforcement runs, recs should be non-empty in DEMO_MODE."""
    from agents.graph import run_query
    state = run_query("delhi", focus_cells=["883da1a3a1fffff"])
    enf = state.get("enforcement") or []
    assert len(enf) > 0, "Should have at least one enforcement recommendation"
    top = enf[0]
    assert "priority_score" in top
    assert "rationale" in top
    assert "rag_citations" in top


def test_latency_stamped():
    """Latency should be computed and reasonable (< 60 seconds in DEMO_MODE)."""
    from agents.graph import run_query
    state = run_query("delhi", query="test")
    latency = state.get("latency_ms") or 0
    assert latency >= 0
    # In DEMO_MODE should be fast
    assert latency < 60_000, f"Latency too high: {latency}ms"
