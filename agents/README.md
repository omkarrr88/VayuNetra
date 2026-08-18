# agents/ — LangGraph multi-agent layer

Stateful agent graph (typed shared state, spike gate, `action_traces` latency stamping).
Spec: ARCHITECTURE.md §8, PRD §8.

| Node | Writes |
|---|---|
| **A0 Orchestrator** (state, topology, gate, `/agent/query`) | `action_traces` |
| **A1 Attribution** | `attribution` |
| **A2 Forecast** | `forecasts` |
| **A3 Enforcement** | `enforcement_recs` |
| **A4 Advisory** | `advisories` |
| **A5 Multi-City** | comparison output |

`tools/` = shared agent tools (SQL, RAG retrieve, ML model service, i18n). Design rule:
ML/physics produce the numbers; the LLM only explains, cites, localises, synthesises.
