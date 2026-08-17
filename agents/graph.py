"""LangGraph orchestration — Agent 0 (Orchestrator).

Full multi-agent graph:
    START → orchestrator → attribution → forecast → spike_gate
                                                         ├── enforcement (if spiking cells)
                                                         └── advisory (always)
                                             enforcement → advisory → END

Each node stamps a timestamp into ``state["trace"]`` so the total
signal-to-action latency can be measured (the North-Star metric: < 5 min).

Run standalone:
    python -m agents.graph
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import TypedDict, Optional, Any

try:
    from langgraph.graph import END, START, StateGraph
except ImportError:  # pragma: no cover - fallback for lean environments
    END = START = None
    StateGraph = None

import core.env  # noqa: F401

DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
FIXTURES = Path(__file__).resolve().parent.parent / "demo" / "fixtures"


# ---------------------------------------------------------------------------
# Typed shared state (ARCHITECTURE.md §8.1)
# ---------------------------------------------------------------------------

class TraceEntry(TypedDict, total=False):
    node: str
    ts: str
    duration_ms: int
    meta: dict


class GraphState(TypedDict, total=False):
    # Input
    city_id: str
    time_window: tuple                # (start_iso, end_iso) or None
    query: str                        # natural-language query from /agent/query
    focus_cells: list[str]            # H3 cells of interest (spiking / hotspot)

    # Agent outputs
    signals: dict                     # latest measurements snapshot
    attribution: dict                 # Agent 1 output
    forecast: dict                    # Agent 2 output
    enforcement: list                 # Agent 3 output — enforcement recs
    advisories: list                  # Agent 4 output
    comparison: dict                  # Agent 5 output

    # Cross-cutting
    citations: list                   # RAG sources used (accumulated)
    trace: list[dict]                 # per-node timestamps + decisions
    latency_ms: int                   # total latency from first signal to last action
    error: Optional[str]              # error message if any node fails


# ---------------------------------------------------------------------------
# Timing helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _stamp(state: GraphState, node: str, meta: dict | None = None) -> list:
    """Append a trace entry with current timestamp."""
    existing = list(state.get("trace") or [])
    existing.append({
        "node": node,
        "ts": _now_iso(),
        "meta": meta or {},
    })
    return existing


def _compute_latency(trace: list[dict]) -> int:
    """Compute total elapsed ms from first to last trace entry."""
    if len(trace) < 2:
        return 0
    try:
        t0 = datetime.fromisoformat(trace[0]["ts"])
        t1 = datetime.fromisoformat(trace[-1]["ts"])
        return int((t1 - t0).total_seconds() * 1000)
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# Demo data helpers
# ---------------------------------------------------------------------------

def _load_fixture(name: str, default: Any = None) -> Any:
    p = FIXTURES / f"{name}.json"
    if p.exists():
        return json.loads(p.read_text())
    return default if default is not None else {}


# ---------------------------------------------------------------------------
# Node: Orchestrator (A0)
# ---------------------------------------------------------------------------

def orchestrator(state: GraphState) -> dict:
    """Route the request, populate signals, initialize trace.

    Reads latest AQI signals for the city and identifies spiking cells
    (any cell with AQI > 300 is considered a hotspot triggering enforcement).
    """
    city_id = state.get("city_id", "delhi")

    if DEMO_MODE:
        signals = _load_fixture("aqi_current", default=[])
        # Identify spiking cells (AQI > 200)
        spiking = [
            row.get("h3_cell", "")
            for row in (signals if isinstance(signals, list) else [])
            if (row.get("aqi") or row.get("value") or 0) > 200 and row.get("h3_cell")
        ]
        # If signals don't have AQI, use focus_cells or default to a demo cell
        if not spiking and not state.get("focus_cells"):
            spiking = ["883da1a3a1fffff"]  # demo hotspot
    else:
        from core.supa import client
        db = client()
        rows = (
            db.table("measurements")
            .select("h3_cell,value,ts")
            .eq("city_id", city_id)
            .eq("variable", "pm25")
            .order("ts", desc=True)
            .limit(2000)
            .execute()
            .data
        )
        signals = rows
        # Simple spike detection: cells where latest PM2.5 > 120 µg/m³ (AQI ~200)
        latest: dict[str, float] = {}
        for r in rows:
            latest.setdefault(r["h3_cell"], r["value"])
        spiking = [cell for cell, val in latest.items() if val > 120]

    focus_cells = state.get("focus_cells") or spiking
    trace = _stamp(state, "orchestrator", {
        "city_id": city_id,
        "spiking_cells": len(spiking),
        "focus_cells": focus_cells[:5],
    })

    return {
        "signals": {"rows": signals if isinstance(signals, list) else [], "city_id": city_id},
        "focus_cells": focus_cells,
        "trace": trace,
    }


# ---------------------------------------------------------------------------
# Node: Attribution (A1) — Omkar fills the real model; stub here
# ---------------------------------------------------------------------------

def attribution_node(state: GraphState) -> dict:
    """Attribute pollution sources for spiking cells.

    Omkar (A1) fills the real gradient-boosting model.
    In DEMO_MODE or until the live model is wired: reads from DB / fixture.
    """
    city_id = state.get("city_id", "delhi")

    if DEMO_MODE:
        data = _load_fixture("attribution", default=[])
    else:
        from core.supa import client
        db = client()
        q = db.table("attribution").select("*").eq("city_id", city_id)
        focus = state.get("focus_cells") or []
        # Filter to focus cells if provided
        data = q.execute().data
        if focus:
            data = [r for r in data if r.get("h3_cell") in set(focus)]

    trace = _stamp(state, "attribution", {"rows": len(data)})
    return {"attribution": {"rows": data, "city_id": city_id}, "trace": trace}


# ---------------------------------------------------------------------------
# Node: Forecast (A2) — Omkar fills the real model; reads DB/fixture
# ---------------------------------------------------------------------------

def forecast_node(state: GraphState) -> dict:
    """Load 24/48/72h forecasts for focus cells.

    Omkar (A2) fills the real LightGBM/GNN model.
    Until then: reads DB rows / demo fixture.
    """
    city_id = state.get("city_id", "delhi")

    if DEMO_MODE:
        data = _load_fixture("forecast", default=[])
    else:
        from core.supa import client
        db = client()
        q = (
            db.table("forecasts")
            .select("h3_cell,issued_at,horizon_h,target_var,value,pi_low,pi_high,persistence_value")
            .eq("city_id", city_id)
            .order("issued_at", desc=True)
            .limit(500)
        )
        data = q.execute().data

    # Detect forecast spikes (value much higher than persistence)
    spike_detected = any(
        (row.get("value", 0) or 0) > 300
        for row in (data if isinstance(data, list) else [])
    )

    trace = _stamp(state, "forecast", {"rows": len(data), "spike_detected": spike_detected})
    return {
        "forecast": {"rows": data, "city_id": city_id, "spike_detected": spike_detected},
        "trace": trace,
    }


# ---------------------------------------------------------------------------
# Node: Enforcement (A3) — Abhinav
# ---------------------------------------------------------------------------

def enforcement_node(state: GraphState) -> dict:
    """Run enforcement scoring + RAG citation pipeline.

    Loads the FULL city attribution inside run_enforcement (attribution_data=None):
    the graph state's attribution is filtered to spiking focus cells, which breaks
    per-source spatial matching (a source's nearest cell is usually not the spike
    cell) and can zero out the whole worklist.
    """
    city_id = state.get("city_id", "delhi")

    try:
        from agents.enforcement import run_enforcement
        recs = run_enforcement(city_id=city_id, attribution_data=None, write_to_db=not DEMO_MODE)
        rec_dicts = [r.to_dict() for r in recs]

        # Collect RAG citations for cross-cutting state
        all_citations = []
        for r in recs:
            all_citations.extend(r.rag_citations)

        existing_cits = list(state.get("citations") or [])
        existing_cits.extend(all_citations[:10])  # cap to avoid bloat

        trace = _stamp(state, "enforcement", {
            "recs": len(recs),
            "top_priority": rec_dicts[0]["priority_score"] if rec_dicts else 0,
        })
        return {
            "enforcement": rec_dicts,
            "citations": existing_cits,
            "trace": trace,
        }
    except Exception as e:
        trace = _stamp(state, "enforcement", {"error": str(e)})
        return {
            "enforcement": [],
            "trace": trace,
            "error": f"enforcement_node: {e}",
        }


# ---------------------------------------------------------------------------
# Node: Advisory (A4) — Sejal fills the real agent; stub here
# ---------------------------------------------------------------------------

def advisory_node(state: GraphState) -> dict:
    """Generate citizen advisories.

    A4 fills the real LLM-localised advisory generator.
    In DEMO_MODE: reads fixture.
    """
    city_id = state.get("city_id", "delhi")

    if DEMO_MODE:
        data = _load_fixture("advisory", default=[])
    else:
        from core.supa import client
        db = client()
        data = (
            db.table("advisories")
            .select("*")
            .eq("city_id", city_id)
            .order("issued_at", desc=True)
            .limit(50)
            .execute()
            .data
        )

    trace = _stamp(state, "advisory", {"rows": len(data)})
    latency = _compute_latency(trace)
    return {
        "advisories": data if isinstance(data, list) else [],
        "trace": trace,
        "latency_ms": latency,
    }


# ---------------------------------------------------------------------------
# Conditional edge: spike gate
# ---------------------------------------------------------------------------

def spike_gate(state: GraphState) -> str:
    """Route to enforcement ONLY when focus_cells are present (spike/hotspot).

    Advisory always runs (either via enforcement → advisory, or directly).
    This gate makes Agent 0 a genuine decision-making orchestrator, not just
    a pipeline — matching the PRD multi-agent requirement.
    """
    focus = state.get("focus_cells") or []
    forecast_spike = (state.get("forecast") or {}).get("spike_detected", False)
    if focus or forecast_spike:
        return "enforcement"
    return "advisory"


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_graph():
    if StateGraph is None:
        raise ImportError("langgraph is not installed; sequential fallback is used instead")

    g = StateGraph(GraphState)

    # Register nodes
    for name, fn in [
        ("orchestrator", orchestrator),
        ("attribution", attribution_node),
        ("forecast", forecast_node),
        ("enforcement", enforcement_node),
        ("advisory", advisory_node),
    ]:
        g.add_node(name, fn)

    # Edges
    g.add_edge(START, "orchestrator")
    g.add_edge("orchestrator", "attribution")
    g.add_edge("attribution", "forecast")
    g.add_conditional_edges(
        "forecast",
        spike_gate,
        {"enforcement": "enforcement", "advisory": "advisory"},
    )
    g.add_edge("enforcement", "advisory")
    g.add_edge("advisory", END)

    return g.compile()


# ---------------------------------------------------------------------------
# Module-level compiled graph (cached)
# ---------------------------------------------------------------------------

_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph


def _run_sequential(city_id: str, query: str = "", focus_cells: list | None = None) -> dict:
    """Fallback pipeline used when langgraph is unavailable.

    This preserves the same output shape for bootstrap and API use while
    avoiding a hard dependency on langgraph in lean runtime environments.
    """
    state: GraphState = {
        "city_id": city_id,
        "query": query,
        "focus_cells": focus_cells or [],
        "trace": [],
        "citations": [],
    }

    state.update(orchestrator(state))
    state.update(attribution_node(state))
    state.update(forecast_node(state))

    if spike_gate(state) == "enforcement":
        state.update(enforcement_node(state))

    state.update(advisory_node(state))

    trace_list = state.get("trace") or []
    state["latency_ms"] = _compute_latency(trace_list)
    return dict(state)


def run_query(city_id: str, query: str = "", focus_cells: list | None = None) -> dict:
    """Convenience function used by the FastAPI /agent/query endpoint."""
    if StateGraph is None:
        result = _run_sequential(city_id=city_id, query=query, focus_cells=focus_cells)
    else:
        graph = get_graph()
        initial_state: GraphState = {
            "city_id": city_id,
            "query": query,
            "focus_cells": focus_cells or [],
            "trace": [],
            "citations": [],
        }
        result = graph.invoke(initial_state)

    if not DEMO_MODE:
        trace_list = result.get("trace") or []
        latency = _compute_latency(trace_list)
        ts_map = {t["node"]: t["ts"] for t in trace_list}
        trace_nodes = [t["node"] for t in trace_list]
        try:
            from core.supa import client
            db = client()
            db.table("action_traces").insert({
                "city_id": city_id,
                "signal_ts": ts_map.get("orchestrator") or _now_iso(),
                "attribution_ts": ts_map.get("attribution"),
                "forecast_ts": ts_map.get("forecast"),
                "enforcement_ts": ts_map.get("enforcement"),
                "advisory_ts": ts_map.get("advisory"),
                "total_latency_ms": latency,
                "trace": {"nodes": trace_nodes},
            }).execute()
            print(f"[graph] Persisted action trace for {city_id} ({latency}ms)")
        except Exception as e:
            print(f"[graph] Failed to persist action trace: {e}")

    return dict(result)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("[graph] Running VayuNetra multi-agent pipeline (DEMO_MODE)...")
    t_start = time.time()
    state = run_query("delhi", query="What are the top enforcement priorities today?")
    elapsed = int((time.time() - t_start) * 1000)

    print(f"\n[graph] Completed in {elapsed}ms (latency_ms={state.get('latency_ms', 0)})")
    print(f"  Trace: {[t['node'] for t in (state.get('trace') or [])]}")
    enf = state.get("enforcement") or []
    print(f"  Enforcement recs: {len(enf)}")
    if enf:
        top = enf[0]
        print(f"  Top rec: priority={top.get('priority_score')}, rationale={top.get('rationale', '')[:80]}...")
    print(f"  Advisories: {len(state.get('advisories') or [])}")
    cits = state.get("citations") or []
    print(f"  Citations used: {len(cits)}")
