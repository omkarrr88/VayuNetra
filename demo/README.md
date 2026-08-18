# DEMO_MODE — frozen offline snapshot (F8)

> Purpose: the **entire scored demo runs offline**
> with zero live-API dependency (ARCHITECTURE.md §15, §22; the #1-risk mitigation).

## How it works
- Set `DEMO_MODE=true` (root `.env`) and `VITE_DEMO_MODE=true` (web).
- The API (`api/main.py`) serves every endpoint from `demo/fixtures/<name>.json`.
- The web app reads the same fixtures (or hits the API) so nothing calls a live feed.

## Fixture files (the snapshot shape)
One JSON file per endpoint payload — keys match `docs/API_CONTRACT.md`:

| File | Feeds endpoint | Shape |
|---|---|---|
| `cities.json` | `GET /cities` | `City[]` |
| `aqi_current.json` | `GET /aqi/current` | `{h3_cell, aqi, pm25, dominant_source, ts}[]` |
| `attribution.json` | `GET /attribution` | `{h3_cell, ts_window, shares{}, confidence, evidence}[]` |
| `forecast.json` | `GET /forecast` | `{h3_cell, issued_at, horizon_h, value, pi_low, pi_high, persistence_value}[]` |
| `enforcement.json` | `GET /enforcement` | `{id, h3_cell, priority_score, contribution, pop_exposed, rationale, rag_citations, rubric_score, status}[]` |
| `advisory.json` | `GET /advisory` | `{city_id, ward_id, risk_tier, audience_segment, language, channel, message}[]` |
| `dossier.json`, `simulate.json`, `optimize.json` | their POSTs | per API contract |

## At the Integration Window
Replace the hand-authored fixtures above with a **real frozen snapshot**: dump the
precomputed agent outputs for all 10 cities from Supabase into these files. Deterministic,
versioned, demo-proof.
