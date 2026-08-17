# VayuNetra — API Contract (F3)

> **The app contract.** Frontends and agents code against *this*, not against each other.
> Source: [ARCHITECTURE.md](ARCHITECTURE.md) §11.
> Base URL (local): `http://localhost:8000` · Auth: Supabase JWT (Bearer) · All responses use the envelope below.

## Response envelope (every endpoint)

```jsonc
{
  "success": true,            // boolean
  "data": { },                // payload, or null on error
  "error": null,              // { "code": "...", "message": "..." } or null
  "meta": { "total": 0, "page": 1, "limit": 50 }  // pagination/extra; optional
}
```

## Roles
`admin` ⊃ `officer` ⊃ `inspector` ⊃ `citizen` (all). "officer+" = officer, inspector, admin.

## Endpoints

| Method | Path | Purpose | Role |
|---|---|---|---|
| GET | `/health` | liveness + `DEMO_MODE` flag | all |
| GET | `/cities` | list onboarded cities | all |
| GET | `/aqi/current?city&bbox` | live AQI per H3 cell | all |
| GET | `/attribution?city&cell\|ward&ts` | source split + confidence (blame map) | officer+ | Abhinav |
| GET | `/forecast?city&cell&horizon` | forecast + intervals + persistence | all |
| GET | `/enforcement?city&date` | ranked enforcement recommendations | officer+ |
| POST | `/enforcement/{id}/dossier` | cited evidence packet + satellite patch (E6) | officer+ |
| GET | `/advisory?city&ward&lang` | localized citizen advisory | all |
| GET | `/static-layers?city` | OSM/WorldPop-style sources, roads, vulnerability | all |
| GET | `/mobility?city` | traffic proxy measurements from OSM roads + time model | all |
| GET | `/comparison` | Agent 5 multi-city trends + playbook recommendations | all |
| GET | `/latency?city` | latest signal-to-action widget payload | all |
| POST | `/agent/query` | conversational orchestrator (NL → action) | officer+ |
| POST | `/simulate` | what-if intervention → ΔAQI + people/₹/CO₂e (E3+E7, live) | officer+ |
| GET | `/roi?city` | City ROI: annual health burden + NCAP savings (E7) | all |
| POST | `/optimize` | best intervention bundle under budget → top-3 (E5, **deferred stub**) | officer+ |
| POST | `/admin/cities` | onboard a city via config (scalability demo) | admin |
| GET | `/metrics/benchmark?city&full` | temporal-split forecast benchmark artifact (skill, onset recall, calibration) | all |
| GET | `/brief?city` · `/brief.pdf?city` | officer morning brief (JSON / one-page PDF): air now vs yesterday, onset cells (P ≥ 0.3), top actions, yesterday's outcomes | all |
| POST | `/brief/send` | push the brief to the city's Telegram subscribers (rate-limited) | all (demo) |
| POST | `/enforcement/{id}/status` | approve / dispatch / dismiss (server-side write, rate-limited); dispatch arms before/after tracking | all (demo) |
| GET | `/exposure?city` | expected people in Very Poor / Severe air at +24/48/72 h (calibrated, population-weighted) | all |
| WS | `/live` | push attribution/forecast/alert updates | all |

## Representative payloads (shape only — fill from real data / fixtures)

**GET /cities** → `data: City[]`
```jsonc
{ "city_id": "delhi", "name": "Delhi", "state": "DL",
  "center": [77.21, 28.61], "bbox": [76.84,28.40,77.35,28.88],
  "languages": ["hi","en"], "active": true }
```

**GET /attribution** → `data: AttributionCell[]`
```jsonc
{ "h3_cell": "883da1...", "ts_window": ["2026-06-27T08:00Z","2026-06-27T09:00Z"],
  "shares": { "construction_dust": 0.68, "traffic": 0.22, "transported": 0.10 },
  "confidence": 0.83, "evidence": { "top_features": ["no2","aod","pm10_pm25_ratio"] } }
```

**GET /forecast** → `data: ForecastPoint[]`
```jsonc
{ "h3_cell": "883da1...", "issued_at": "2026-06-27T06:00Z", "horizon_h": 24,
  "target_var": "aqi", "value": 312, "pi_low": 280, "pi_high": 345,
  "persistence_value": 295, "model_version": "lgbm-v1" }
```

**POST /simulate** (body `{ city, intervention_type, target_cells?, horizon_h }`) → `data`
```jsonc
{ "delta_aqi_by_cell": { "883da1...": -45 },
  "delta_pm25_by_cell": { "883da1...": -31.5 },
  "people_protected": 28400, "exposure_hours_reduced": 681600,
  "pm25_tonnes_avoided": 2.3,
  "cases_prevented": 0.05,           // premature deaths averted over the horizon (E7)
  "health_cost_avoided_inr": 2560020,
  "co2e_tonnes": 381.8,              // null when tonnes-avoided/source ratio unknown
  "confidence": 0.81,
  "intervention": { "type": "waste_burn_ban", "reductions": {"biomass_burning": 0.7}, "horizon_h": 24 },
  "impact": { "method": "WHO AirQ+ log-linear CRF (short-term)",
              "citations": [ { "figure": "...", "value": 1.0123, "unit": "RR per 10 µg/m³", "source": "WHO HRAPIE (2013)" } ] } }
```

**GET /roi?city** → `data` (E7 City ROI dashboard; deterministic from cited factors)
```jsonc
{ "city_id": "delhi", "annual_pm25": 92.0, "who_guideline_pm25": 5.0, "population": 20600000,
  "attributable_deaths_per_year": 73395, "annual_health_burden_inr": 3669770000000,
  "ncap_target_reduction_pct": 30, "deaths_avertable_per_year": 17685, "annual_savings_inr": 884260000000,
  "narrative": "At 92 µg/m³ annual PM2.5, ~73,395 premature deaths/yr ...",
  "citations": [ { "figure": "attributable deaths", "value": 1.08, "unit": "HR per 10 µg/m³",
                   "source": "Chen & Hoek (2020), Environ. Int." } ] }
```

> **Conventions:** snake_case keys · ISO-8601 UTC timestamps · GeoJSON `[lng, lat]` order ·
> errors return `success:false` + populated `error` + HTTP 4xx/5xx. When `DEMO_MODE=true`,
> every endpoint serves `demo/fixtures/*` so the UI works with zero live dependencies.
