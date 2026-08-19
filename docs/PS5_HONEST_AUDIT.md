# VayuNetra vs ET AI Hackathon PS-5 — the honest audit

**Internal document. Not for judges.** Written to decide where the last hours go, and to rehearse
questions we would rather not be asked cold.

**Audited:** 19 August 2026, against `omkar` @ `34e1f33`, live API on `:8000`, production Supabase.

## How to read this

Every claim below is one of:

| mark | meaning |
|---|---|
| **VERIFIED** | I ran the command / hit the endpoint / read the code. Evidence cited inline. |
| **PARTIAL** | Exists and works, but narrower than the brief asks or than we say it is. |
| **ASSERTED** | We say it; nothing in the repo proves it. |
| **ABSENT** | Not built. |

No claim here is from memory. Where a number differs from what the deck or the app says, the
difference is called out, because that gap is what a judge finds.

---

## 1 · Verdict

| PS-5 build area | Verdict | The one-line truth |
|---|---|---|
| Geospatial source attribution | **Strong, but SHAP is off in the demo city** | Real per-cell attribution with a working abstain rule. But Delhi, Mumbai and Bengaluru are running **signature priors with zero SHAP rows** right now (§2.4). |
| Hyperlocal predictive forecasting | **Strong, honestly weak in places** | Genuinely 1 km, genuinely calibrated. Skill is modest (+9% multi-season) and one city is negative. |
| Enforcement intelligence | **Strongest area** | Ranked worklist → real satellite dossier → cited draft notice → tracked outcome. Nothing else in the field closes this loop. |
| Multi-city comparative | **Real but uneven** | All 10 cities live. Jaipur has 5 recommendations and 8 sources; Delhi has 45 and 103. |
| Citizen advisory | **Broad, shallow in review** | 8 languages genuinely deployed in native script, 4 channels. Only 2 of 8 reviewed by a native speaker, both team members. Public-display channel is **documented but not built**. |

**Overall:** the loop from signal → attribution → forecast → prioritised action → measured outcome is
real and complete, which is rare. The exposure is not in what we built; it is in **four claims that
outrun their evidence** (§6) and in **two demo-day landmines** (§2.1, §2.4).

The satellite story is the biggest surprise of this audit: the connectors are written and were used
once, but **nothing re-ingests satellite data on a schedule, and there are zero satellite rows in the
database today** (§4). Two of the brief's named technologies are, right now, not running.

---

## 2 · The three things to fix before the final

Ranked by (damage if caught) × (probability of being caught).

### 2.1 "Six agents" is wrong, and the product will contradict it on stage

**VERIFIED.** `agents/graph.py:344-351` registers **five** nodes:

```
orchestrator → attribution → forecast → [spike_gate] → enforcement → advisory
```

`spike_gate` is a conditional router (`add_conditional_edges`), not a node. And the gate is
currently *skipping* enforcement, because Delhi's monsoon air is not spiking. The last 20 live
traces from `GET /traces?city=delhi`:

```
nodes: ['orchestrator', 'attribution', 'forecast', 'advisory']   total_ms: 1130
nodes: ['orchestrator', 'attribution', 'forecast', 'advisory']   total_ms: 1037
```

**Four nodes.** We claim six in `README.md:44`, `web/src/Landing.tsx:70`, `docs/SUBMISSION.md:33`,
`docs/PITCH_SCRIPT.md:71`, `docs/DEMO_VIDEO_SCRIPT.md:69`.

If a judge presses "Run agents live" during the demo, the panel shows four boxes while the narrator
says six. **Fix the copy, not the code** — the gate skipping enforcement on clean air is a feature
worth bragging about. Say: *"Five agents on one graph, plus a spike gate that decides whether
enforcement should run at all — watch it skip enforcement now, because Delhi's air is clean. It
refuses to manufacture work for an inspector."* That turns the landmine into the best line in the
demo.

### 2.2 The 1 km claim is validated on synthetic data

**VERIFIED.** This is the central scientific promise — "every square kilometre gets a number" — and
its evidence is the weakest thing in the project.

Live, Delhi (`GET /coverage?city=delhi`):

```
anchors_from : live_measurements          ← good: anchored on real stations
n_stations   : 11
n_cells      : 3466                        ← one station per 315 cells
validation   : { "rmse_cnn": 2.22, "rmse_bilinear": 4.97, "skill_vs_bilinear": 0.553, "n": 64,
                 "note": "downscaler skill vs bilinear on held-out SYNTHETIC fields;
                          real held-out-station RMSE runs on Kaggle with EE AOD × CPCB" }
```

The CNN is genuinely running (torch 2.13.0+cpu present, so this is not the fallback path at
`ml/coverage/dense_field.py:143-154`). But `ml/coverage/dense_field.py:187` states plainly that the
55.3% skill is measured on **synthetic fields, n=64**.

The honest sentence, which we must be able to say without flinching:
> *"We interpolate 11 stations to 3,466 cells. The downscaler beats bilinear by 55% on synthetic
> fields. We have never validated it against a held-out real station."*

Leave-one-station-out is computable from data already in the database and would convert the most
attackable claim into the strongest. It has been deferred twice.

### 2.3 The published attribution-validation numbers are stale

**VERIFIED — and my first read of this was wrong.** The comparison IS computed in code:
`ml/attribution/inventory.py:107 _cosine()` and `:136 compare_with_inventory()`. I re-ran it live:

```
delhi      cosine_similarity = 0.991   mean_abs_diff = 0.042   vs SAFAR-Delhi 2018
bengaluru                              mean_abs_diff = 0.099   vs CSTEP 2022
mumbai                                 mean_abs_diff = 0.097   vs Urban-Emissions
```

`docs/ATTRIBUTION_VALIDATION.md:149-151` publishes **0.88 / 0.90 / 0.93**. The live number for Delhi
is **0.991**. The table is days stale, and it under-sells us.

Two honesty points before anyone quotes 0.991:
- Cosine over four renormalised buckets is a **weak** test — it is dominated by the largest
  component. `mean_abs_diff = 0.042` is the more honest headline.
- Delhi's biomass share is currently **0.0** against the inventory's 0.067, because it is monsoon and
  there is no stubble. Seasonal alignment is inflating the similarity.

Action: regenerate the table, publish `mean_abs_diff` alongside cosine, and state the date.

### 2.4 SHAP explanations are OFF for Delhi, Mumbai and Bengaluru

**VERIFIED, and this is a demo landmine.** Attribution method by city, counted live:

```
delhi       n=132  {'signature-v1': 132}          rows_with_shap_drivers = 0
mumbai      n=120  {'signature-v1': 120}          rows_with_shap_drivers = 0
bengaluru   n= 78  {'signature-v1': 78}           rows_with_shap_drivers = 0
hyderabad   n= 42  {'signature-v1': 42}           rows_with_shap_drivers = 0
pune        n= 60  {'hybrid-gbm-shap-v2': 60}     rows_with_shap_drivers = 60
kolkata     n= 30  {'hybrid-gbm-shap-v2': 18, 'signature-citymean-v1': 12}   = 18
```

The hybrid GBM+SHAP model needs `MIN_SAMPLES = 400` per cell (`ml/attribution/shap_attribution.py`).
Delhi cannot reach it because raw `measurements` are pruned at 180 days, so per-cell depth is thin.
**Only Pune and part of Kolkata currently produce SHAP drivers.**

The cell story therefore shows *"chemical-signature attribution — local model missed the ≥0.15 skill
gate here, we fall back to cited priors"* on Delhi. That abstain message is excellent and honest.
But the pitch bills SHAP as a headline capability, and the demo city does not have it.

**Two options, both fine, pick one and rehearse it:**
- Demo the SHAP path on **Pune**, and use Delhi to show the abstain path. This is the stronger story:
  *"here is the model explaining itself; here is it refusing to."*
- Or lead with the abstain and mention SHAP as what happens where depth allows.

What we must NOT do is promise SHAP and then click a Delhi cell.

---

## 3 · Area by area

### 3.1 Geospatial Pollution Source Attribution Engine

| Brief asks | Status | Evidence |
|---|---|---|
| Spatial-temporal AQI patterns | **VERIFIED** | Per-H3-cell attribution, hourly windows. `GET /attribution?city=delhi` returns `shares` per source category with `ts_window`. |
| Land use | **VERIFIED** | `connectors/osm_sources.py` → `emission_sources`; 103 rows for Delhi, 243 Mumbai (counted from DB). |
| Traffic density | **PARTIAL** | `connectors/mobility.py` is an OSM-road time-of-day proxy, not measured traffic. |
| Construction permits | **ABSENT, and honestly so** | `connectors/permits.py:3` says it plainly: *"No Indian city publishes a machine-readable permit registry today."* Construction sites come from OSM + CV detection instead. This is a real-world data gap, not our failure — say it that way. |
| Industrial stacks | **VERIFIED** | In the source registry with detection confidence. |
| Satellite thermal anomalies | **BUILT, NOT RUNNING** | `connectors/earth_engine.py:32` `FIRE_BAND = "T21"` exists, but the marker reads **0.0 in every live attribution row** because nothing ingests it on a schedule. Same for `no2_sat`. |
| **Confidence scores** | **VERIFIED** | Every attribution row carries `confidence`; the cell story shows it. |
| **Abstains without skill** | **VERIFIED** | The model falls back to cited chemical-signature priors when out-of-sample R² misses the gate — visible in the UI as *"Local model missed the ≥0.15 skill gate here — we fall back to cited priors rather than over-claim."* This is a genuine differentiator; most teams will not have an abstain path. |
| Ward/zone level | **VERIFIED** | H3 res-8 (~1 km²), finer than ward. Cells are now named by locality (`placeName.ts`). |

**Weakness a domain expert attacks first:** source apportionment normally requires chemical
speciation (elemental carbon, ions, trace metals). We infer from six CPCB pollutants plus satellite
NO₂ and fire counts. Our answer must be that we do not claim receptor-model accuracy — we claim a
prioritisation signal with a stated confidence, validated in shape against published apportionment,
and that we abstain when the local model has no skill.

### 3.2 Hyperlocal Predictive AQI Forecasting

**VERIFIED, and the numbers are mixed.** There are two benchmark sets in `docs/benchmarks/` and they
say different things. We must be precise about which we quote.

**Multi-season, rolling protocol** (`delhi.json`, Feb 2025 → Aug 2026, split Nov 2025, n_test 234,491):

| horizon | skill vs persistence | onset recall (point) | onset recall (alarm τ=0.3) | precision | Brier skill |
|---|---|---|---|---|---|
| +24 h | **+9.1%** | 24.4% | **54.0%** | 0.683 | 0.513 |
| +48 h | +12.9% | 31.2% | — | — | 0.456 |
| +72 h | +12.1% | 26.5% | — | — | 0.379 |

Persistence onset recall is **0.0 by construction** — a "tomorrow = today" model can never predict a
change. That contrast is the strongest forecasting line we have.

**Recent window** (`*_live.json`, monsoon, Jun–Aug 2026) — all ten cities:

| city | n_test | +24h | +48h | +72h | PI80 coverage |
|---|---|---|---|---|---|
| lucknow | 810 | +26% | +24% | +23% | 0.81 |
| pune | 1297 | +20% | +21% | +32% | 0.73 |
| delhi | 2235 | +16% | +19% | +12% | **0.74** |
| bengaluru | 1127 | +14% | +42% | +47% | 0.83 |
| ahmedabad | 745 | +14% | +13% | +3% | 0.79 |
| kolkata | 354 | +12% | +12% | +30% | 0.82 |
| hyderabad | 760 | +11% | +25% | +37% | 0.78 |
| mumbai | 1877 | +10% | +14% | +6% | **0.72** |
| chennai | 884 | +6% | +5% | +6% | 0.79 |
| **jaipur** | 941 | +6% | **−4%** | **−6%** | 0.85 |

Three honest problems, all of which we ship rather than hide:
1. **Jaipur is negative at +48/+72 h.** Persistence beats us there.
2. **PI80 under-covers** for Delhi (0.74), Mumbai (0.72) and Pune (0.73) against a 0.80 target — the
   interval is too narrow, i.e. we are overconfident on exactly our three biggest cities.
3. In the monsoon window Delhi's early-warning recall is **0 of 9 onsets** at the 90 µg/m³ threshold.
   Nothing crosses Very Poor in a Delhi monsoon, so there is nothing to catch — but the artifact says
   `recall: 0.0` and a judge reading the JSON will see that before they read the context.

**Resolution is genuinely 1 km** (H3 res-8, 3,466 cells for Delhi) — but see §2.2 on what that
interpolation is validated against.

**Dispersion modelling: VERIFIED and real.** `ml/dispersion/plume.py` implements Pasquill stability
classes with Briggs urban σ_y/σ_z coefficients; `footprint.py` computes plume reach at ±2.15σ ≈ 95%
of lateral mass. This is not a decorative overlay.

### 3.3 Enforcement Intelligence & Prioritisation — our strongest area

| Brief asks | Status | Evidence |
|---|---|---|
| Correlate hotspots with registered sources | **VERIFIED** | `agents/enforcement.py`; 647 sources across 10 cities. |
| Prioritised | **VERIFIED** | `priority = share × pop_norm × actionability × confidence` (`_compute_priority`). |
| Evidence-backed | **VERIFIED** | Dossier with real Sentinel-2 patch (`allow_placeholder=False` — a live dossier may only show genuinely ingested imagery) + RAG citations from 1,271 embedded regulation chunks (`kb_chunks`, BAAI/bge-small-en-v1.5 on pgvector). |
| Geospatial documentation | **VERIFIED** | Draft notice PDF naming the issuing authority, with an impact projection chart. |
| For municipal/PCB authorities | **VERIFIED** | Status lifecycle proposed → approved → dispatched → closed, with an audit trail (`enforcement_status_log`) that survives regeneration. |

**Beyond the brief:** a value-per-inspector-hour ranking added this session —
`benefit = (share × confidence) × pm25_low × residents × (1 + 3 × P(>120))`, divided by assumed
inspector-hours. It is risk-averse (a sure 30% share outranks a shaky 60%) and cost-aware (a
45%-share fire outranks a 60%-share industrial source, because a stack test costs 8 hours and
stopping a fire costs 1). **The inspector-hours are our estimates, not measured** — labelled as
assumptions on the card and in the API.

**Outcome measurement: VERIFIED.** Dispatched interventions get a frozen 7-day baseline and a
drift-corrected before/after, exported PRANA-ready. This is the thing India's official DSS lacks
(CEEW 2025) and almost no hackathon project will have.

### 3.4 Multi-City Comparative Intelligence

**VERIFIED that all 10 are live.** Counted from the production database:

| city | PM2.5 cell-days | attribution | forecasts | recs | sources |
|---|---|---|---|---|---|
| delhi | 3,714 | 132 | 66 | 45 | 103 |
| mumbai | 1,715 | 120 | 60 | 172 | 243 |
| bengaluru | 543 | 78 | 39 | 120 | 201 |
| hyderabad | 863 | 42 | 21 | 15 | 20 |
| kolkata | 747 | 30 | 15 | 14 | 18 |
| pune | 692 | 60 | 30 | 14 | 16 |
| ahmedabad | 489 | 42 | 21 | 11 | 12 |
| chennai | 436 | 36 | 18 | 11 | 20 |
| lucknow | 449 | 30 | 15 | 6 | 6 |
| **jaipur** | 452 | 36 | 18 | **5** | **8** |

**PARTIAL against the brief.** The brief asks to compare *intervention effectiveness* and
*compliance metrics* across cities. `/comparison` returns current air, forecast, dominant source, a
playbook and a compliance count — but intervention effectiveness is only real for Delhi, because
only Delhi has a winter of dated government orders to replay.

**If a judge picks Jaipur** — the weakest city — they get 5 recommendations, 8 sources, 1 station per
pollutant, and negative forecast skill at +48/+72 h. That is the drill-down to be ready for.

### 3.5 Citizen Health Risk Advisory

| Brief asks | Status | Evidence |
|---|---|---|
| Ward-level alerts | **VERIFIED** | Per-zone advisories tiered by forecast risk. |
| Vulnerability mapping | **VERIFIED** | 11,000+ hospitals/clinics, 7,700+ schools, elder-care and outdoor-work sites; 5,495 scored zones. |
| Against **forecast** AQI | **VERIFIED** | Driven by the forecast, not current readings — this is the "act before the air turns" claim and it holds. |
| Regional languages | **VERIFIED, 8, and genuinely deployed** | 384 advisory rows in production: en 160, hi 112, mr 32, and 16 each of kn/ta/te/bn/gu. Per city, in native script — Bengaluru `kn` "ಮುಂದಿನ 24 ಗಂಟೆಗಳಲ್ಲಿ…", Chennai `ta` "அடுத்த 24 மணி நேரத்தில்…", Kolkata `bn`, Ahmedabad `gu`, Hyderabad `te`, Pune `mr`. (An automated check flagged this as English-only; it had queried Kannada for **Delhi**, whose configured languages are `[hi, en]`. False positive.) |
| Mobile / displays / IVR | **VERIFIED** | PWA, Telegram bot, Twilio IVR (places a real call), public-display mode. |

**The soft spot: review, not coverage.** `docs/ADVISORY_REVIEW.md` — only **2 of 8** languages have
had a native-speaker review (Hindi, Marathi), and both reviewers were **team members**, not
independent. Six are "deterministic + script-validated; native-speaker review pending". Script
validation proves the characters are in the right script. It does not prove the sentence is
idiomatic, or that the medical advice reads correctly to a Tamil speaker.

---

## 4 · Suggested technologies

| Technology | Status | Evidence |
|---|---|---|
| Sentinel-5P (NO₂) | **BUILT, NOT RUNNING** | `connectors/earth_engine.py` implements it, but `.github/workflows/ingest.yml` calls only openaq, cpcb and openmeteo — never earth_engine. **0 rows** in `measurements` for source in (s5p, modis, viirs, firms); the only source present is `openaq`. |
| Sentinel-2 | **PARTIAL** | 487 of 647 emission sources are `cv_detected`, i.e. machine-detected from imagery in an earlier offline run. Dossier patches refuse placeholders (`allow_placeholder=False`). But nothing re-ingests imagery on a schedule. |
| MODIS / VIIRS | **BUILT, NOT RUNNING** | Same as S5P. The `fire` and `no2_sat` attribution markers therefore read 0.0 in every live row — confirmed in a real `/attribution` response. |
| Multi-agent AI | **VERIFIED (5, not 6)** | LangGraph `StateGraph`, per-node latency stamps, conditional spike gate. See §2.1. |
| Real-time CAAQMS/IoT | **VERIFIED** | CPCB via OpenAQ, hourly GitHub Actions cron. Now 4 sensors per pollutant per city after this session's fix. |
| Atmospheric dispersion | **VERIFIED** | Pasquill stability + Briggs urban coefficients. Real physics. |
| Predictive analytics | **VERIFIED** | LightGBM quantile, persistence-blended, conformal intervals. |
| **LLMs for citizen communication** | **DELIBERATELY ABSENT** | No LLM anywhere in the product. `core/health_advice.py:1` — "templated, cited, LLM-free". |

**The LLM question needs a prepared answer.** The brief suggests LLMs for multi-language citizen
communication; we deliberately refuse. The answer is not "we ran out of time":

> *"We use no language model anywhere a citizen or an officer reads a number. Health advice and
> enforcement notices are templated from CPCB's own advisory table and the cited regulation. A
> hallucinated line in an asthma advisory or a legal notice is not a bug we are willing to risk.
> Where AI belongs — attribution, forecasting, downscaling, retrieval — we use it heavily, including
> a 1,271-chunk embedded regulation corpus for citation retrieval."*

That is a strength framed as a decision. Framed as an omission, it scores zero.

---

## 5 · Evaluation focus — what judges actually score

| Criterion | Evidence | Honest grade |
|---|---|---|
| Source attribution accuracy vs ground-truth inventories | Reproducible from `compare_with_inventory()`; live Delhi **cosine 0.991, mean abs Δ 0.042** vs SAFAR-2018 (published table says 0.88 — stale). Rush-hour traffic signal 2.30× as a physical check | **B+** — computable and re-runnable, but the published table is stale and cosine over 4 buckets is a weak test |
| Forecast RMSE vs persistence at hyperlocal resolution | +9.1% multi-season, +6…+26% recent, **−6% Jaipur**; RMSE 60.96 @ +24 h; PI80 0.72–0.85 | **B−** — genuinely measured, modestly good, one city negative |
| Enforcement quality rated by domain experts | **n = 0.** Kit exists (`docs/EXPERT_OUTREACH.md`, `PILOT_OUTREACH.md`), ratings pending | **F** — this is a named scoring criterion and we have nothing |
| Citizen advisory relevance + language coverage | 8 languages × 4 channels, script-validated; **2/8** natively reviewed, both team members | **B** on coverage, **D** on review |
| Response time from signal to intervention | **1,130 ms** pipeline wall-clock (`/latency`) | **C** — we measure our *pipeline*, not an organisation's response time. The criterion means the latter. |

**The F is the one that matters.** "Enforcement recommendation quality rated by domain experts" is
written into the evaluation focus. We have a protocol, a rating sheet and an outreach kit — and
zero responses. One officer's rating, even a mediocre one, moves this from F to C and is worth more
than any remaining code.

---

## 6 · Claims that outrun their evidence

1. **"Six agents"** → five nodes registered, four in the live trace. §2.1.
2. **"Validated 1 km field"** → validated on synthetic fields; never against a held-out real
   station. §2.2.
3. **"SHAP explanations"** → not produced for Delhi, Mumbai, Bengaluru or Hyderabad today. §2.4.
4. **"Response time from signal to intervention: seconds"** → that is our compute latency. No
   organisation's response time has been measured. Say *"our pipeline turns a signal into a cited,
   ready-to-sign recommendation in about a second"* — never imply we shortened a municipality's
   response.

Plus two documentation defects found while auditing:
- `channels/README.md` claims **"LLM (Gemini) translation"**. There is no LLM anywhere in the
  product. The doc is wrong in the safe direction, but a judge reading it and then grepping for
  Gemini will find nothing.
- `PRD.md:63-64` lists MODIS/VIIRS AOD, Sentinel-2 change detection and traffic density as
  attribution inputs. None of the three reach the model.

Everything else I checked is stated accurately, including the uncomfortable parts (negative Jaipur
skill, the Severe-tail weakness, the abstain path, "not a compliance measurement").

---

## 7 · Demo-day risks

1. **The pipeline panel shows 4 nodes while we say 6.** §2.1. Fix the words today.
1b. **Clicking a Delhi cell shows the abstain message, not SHAP.** §2.4. Demo SHAP on Pune.
2. **Monsoon air makes the product look becalmed.** Every city is Good/Satisfactory in August. The
   winter data is now in the database (Dec 2025 – Feb 2026, pushed this session), so the calendar,
   monthly trend and "most polluted month" all show the real season — lead with those, not with
   today's number.
3. **Jaipur drill-down** — 5 recs, 8 sources, negative skill. Have the answer ready: thin OpenAQ
   coverage, and we show the station count rather than hiding it.
4. **Render cold start** — mitigated: keep-alive cron every 10 min, and every page now degrades to a
   labelled snapshot (32/32 failure scenarios verified clean this session).
5. **FIXED during this audit:** with the API unreachable, the offline fixture for `/static-layers`
   fell back to `rows[0]`, so **Jaipur's City Intel panel showed Delhi's "Okhla industrial cluster"
   and "Yamuna waste hotspot" labelled as Jaipur's**. Only Delhi, Mumbai and Bengaluru are in that
   fixture. It now returns nothing for an unseeded city and the card shows its empty state. This was
   the only place in the product where one city's data could be presented as another's.

---

## 8 · Engineering quality (what a technical judge sees on opening the repo)

| | |
|---|---|
| Backend tests | **270 passing** |
| Backend coverage | **61–63%** overall; `api/main.py` **33%** (927/1379 statements untested) |
| `core/health_advice.py` | 0% → **100%** this session, and writing those tests found a real bug: a city with no reading was being told its air was "Moderate" |
| Frontend unit tests | **0.** e2e only (8 smoke + 9 live journey) |
| Accessibility | WCAG AA verified across 13 pages × 2 themes × 6 viewports; 0 contrast failures, 0 overflow 320→2560 px |
| Failure modes | 8 scenarios × 4 pages, all degrade cleanly with a labelled snapshot |
| Infrastructure | ₹0 — Vercel + Render + Supabase free tiers, GitHub Actions crons |

`api/main.py` at 33% is the number a technical judge will find. It is the entire API contract.

---

## 9 · Where the remaining hours should go

| # | Action | Effort | Why |
|---|---|---|---|
| 1 | Fix "six agents"; rehearse the spike-gate line AND the Pune-for-SHAP switch | 45 min | Removes the two live contradictions and turns both into good moments |
| 2 | Get **one** officer or academic to rate the worklist | outreach | The only **F** on a named scoring criterion |
| 3 | Leave-one-station-out validation of the 1 km field | ~half a day | Converts the most attackable claim into the strongest |
| 4 | Rehearse the Jaipur drill-down and the LLM question | 1 hour | Both are certain to be asked |
| 5 | Regenerate `ATTRIBUTION_VALIDATION.md` and date it | 20 min | Currently under-sells us (0.88 published vs 0.991 live) and is trivially checkable |
| 6 | Either run the satellite ingest on a cron, or stop listing S5P/MODIS as live inputs | 1 hour | Two named brief technologies currently have zero rows |
| 7 | `api/main.py` coverage 33% → 80% | ~half a day | Only matters if a judge opens the repo |

Items 1 and 4 cost almost nothing and remove the two most likely on-stage failures. Item 2 cannot be
done by writing code, which is exactly why it keeps slipping.
