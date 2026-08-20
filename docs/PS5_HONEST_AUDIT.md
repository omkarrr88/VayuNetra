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

The satellite story was the biggest surprise of this audit: the connectors were written and had been
used once, but nothing re-ingested on a schedule and there were **zero satellite rows in the database**.
**Fixed 19 Aug** — `.github/workflows/ingest.yml` now calls `earth_engine` in the daily job, and the
database holds live rows (164 MODIS `fire`, 136 Sentinel-5P `no2_sat` at the time of writing). §4
carries the current status.

---

## 2 · The things to fix before the final

Ranked by (damage if caught) × (probability of being caught). **Status updated 19 Aug 2026** — the
finding is left as it was written, and what happened to it is recorded underneath. A closed finding
is more useful than a deleted one: it shows the check that caught it and the check that now keeps
it caught.

### 2.1 "Six agents" is wrong, and the product will contradict it on stage

> **CLOSED — 19 Aug.** Corrected in `README.md`, `web/src/Landing.tsx`, `docs/SUBMISSION.md`,
> `docs/PITCH_SCRIPT.md`, `docs/USER_GUIDE.md`, `docs/DEMO_VIDEO_SCRIPT.md`, both architecture SVGs
> and the dark PNG, and in the pitch deck itself (five places, found last and the worst place for
> it to survive). The architecture diagram had also drawn multi-city compare inside the graph box,
> which is what made six look true; it is served by `/comparison` and is not a node. Nothing in the
> repo now claims six.

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

> **RUN — 19 Aug — and it failed.** `scripts/validate_dense_field.py` now does leave-one-station-out
> against real held-out stations in all ten cities. **One city in ten beats predicting the city
> average**, and by 5%. The field beats classical IDW in seven of ten, so the downscaler is the
> better interpolator, but at 1 km the between-station variance is largely not predictable from the
> covariates available. Full table in `docs/COVERAGE_VALIDATION.md`.
>
> This finding is therefore no longer "unvalidated" — it is **measured, and negative**. The claim has
> been retired from the manual and the audit: the grid is 1 km and every cell carries a value, but
> that value is a spatial prior for visualisation and ranking, not a measurement. Running the test
> that could embarrass us, and publishing the result, is a better position than the one we were in
> this morning.

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

> **CLOSED — 18/19 Aug.** `docs/ATTRIBUTION_VALIDATION.md` was regenerated and dated, and now
> publishes **0.991 / 0.928 / 0.939** with mean absolute deltas of 0.042 / 0.099 / 0.097, plus a
> per-bucket table and the two caveats (biomass ≈ 0 in monsoon; Bengaluru industrial +0.199). The
> README was still quoting the old 0.88 / 0.90 / 0.93 four days later and now leads with the mean
> absolute delta, which is the figure that document tells a reader to use. Both remaining
> occurrences of the old trio in the repo are explicit "this was the stale version" notes.

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

> **STILL TRUE for Delhi, and the city list has moved — 19 Aug.** Counted live today, the per-cell
> model runs in **Pune (54 cells), Jaipur (36), Kolkata (30) and Hyderabad (18)**; Delhi, Mumbai and
> Bengaluru still fall back to cited chemical-signature priors. Hyderabad has since crossed the
> gate, so any list of "which cities have SHAP" goes stale quickly — count it on the day.
>
> Not an engineering defect: the gate is doing its job. It is a **demo** decision, and the pitch
> script now handles it — `docs/PITCH_SCRIPT.md` tells the presenter to show the abstain in amber
> and explain it as the feature, and `docs/USER_GUIDE.md` §17 says not to open a Delhi cell while
> promising SHAP.

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
| Satellite thermal anomalies | **RUNNING** *(since 19 Aug)* | `connectors/earth_engine.py:32` `FIRE_BAND = "T21"`, ingested daily. 164 `fire` rows and 136 `no2_sat` rows present. Caveat worth stating out loud: the cadence is **daily, not hourly**, so these markers are a slowly-moving prior rather than a live signal, and the attribution shares they drive move correspondingly slowly. |
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

**Recent window** (`*_live.json`, monsoon, Jun–Aug 2026) — all ten cities. The column is
`n_support`, the rows coverage is actually computed over, not the larger `n_test`. Regenerated in
full on 19 Aug. Two cautions before reading it: **the PI80 column is unstable by construction** (see
problem 2), and **this is not a 90-day window for most cities** — live ingestion started on different
dates, giving Bengaluru 90 days, Delhi 60 and the other seven about 38, so each artifact carries its
own `window` instead of a shared label:

| city | n_support | +24h | +48h | +72h | PI80 coverage |
|---|---|---|---|---|---|
| lucknow | 354 | +26% | +14% | +34% | 0.766 |
| pune | 898 | +18% | +15% | +26% | 0.777 |
| delhi | 282 | +16% | +25% | +14% | 0.858 |
| kolkata | 283 | +16% | +14% | +28% | 0.802 |
| bengaluru | 786 | +13% | +37% | +40% | 0.833 |
| mumbai | 929 | +13% | +16% | +5% | 0.681 |
| ahmedabad | 490 | +12% | +13% | +15% | 0.745 |
| **jaipur** | 601 | +4% | **-4%** | **-14%** | 0.825 |
| chennai | 718 | +4% | +4% | +6% | 0.806 |
| hyderabad | 494 | **-5%** | +5% | +24% | 0.719 |

Four honest problems, all of which we ship rather than hide:
1. **One city cannot be separated from the naive baseline — and the other one was a data bug.**
   *(20 Aug)* Every skill figure ships with a percentile-bootstrap 95% interval. Nine of ten cities
   now beat persistence with the interval entirely above zero; Hyderabad's spans zero
   (−0.025, [−0.069, +0.021]), so the honest statement is that we cannot distinguish it from the
   baseline, not that it loses.

   Jaipur *was* genuinely negative on 19 Aug — −0.160, interval entirely below zero, and this
   document said so. The cause turned out not to be the model. Station discovery searched a 25 km
   circle around each city's **map centre** rather than its actual extent; Delhi's centre sits
   11.7 km east of its bbox centre, so roughly a third of each city was never sampled and the "city
   mean" came from one side of it. Six of ten cities were not fully covered. With discovery
   corrected to the bbox, and a fall-through for sensors that report a recent timestamp but return
   no history, Jaipur reads **+0.104 [+0.065, +0.140]**.

   Read that as a data-coverage fix rather than a modelling win: the station set and the evaluation
   set moved together (Jaipur's supported rows went 299 → 812), so it is a better measurement, not
   the same measurement improved. The lesson worth keeping is that a "weak city" was a symptom of
   an ingestion bug, and it took someone looking at the map and saying the cells looked shifted.

2. **PI80 in this column is not a calibration measurement — do not read it as one.** *(revised
   19 Aug after chasing it)* The live protocol is a single split at one forecast origin, and its PI
   coverage is computed over `n_support` rows only: **282** for Delhi +24 h, against an `n_test` of
   2,235. A few hundred rows from one origin sit in whatever regime that fortnight held, so the
   figure swings on luck — the clearest demonstration is Delhi itself, which read **0.74 on 17 Aug
   and 0.858 on 19 Aug with no calibration change whatsoever**, only two more days of ingest. Tuning against it produced a real regression — a larger
   calibration split lowered coverage at every horizon on the protocol that carries weight (delhi
   0.783/0.781/0.774 → 0.759/0.760/0.718; kolkata 0.748/0.725/0.698 → 0.696/0.672/0.668), and a
   per-city selector fitted to it took Delhi +48 h down to 0.596. Both were reverted; the reasoning
   is recorded in `ml/forecast/train.py` above `CAL_FRACTION` and pinned by
   `tests/test_forecast.py`. **The measurement that counts** is the rolling multi-season benchmark
   (10 origins, 53k–208k support rows), where calibration is close to nominal: delhi
   **0.783 / 0.781 / 0.775**, mumbai **0.816 / 0.817 / 0.794**. The one genuine shortfall is
   **kolkata — 0.748 / 0.725 / 0.698**, degrading with horizon. Chased properly on 19 Aug and
   **deliberately not "fixed"** — see problem 3.
3. **Kolkata's band under-covers at the decision boundary, and recalibration did not fix it.**
   *(19 Aug)* The marginal 0.748 hides where the misses are. Reporting coverage by **predicted**
   level — the only grouping a served band can be held to, since at serve time the outcome is
   precisely what we lack — on the rolling protocol (10 origins, 53k rows/horizon):

   | predicted PM2.5 (µg/m³) | 8–25 | 25–38 | 38–56 | **56–76** | 76–245 | overall |
   |---|---|---|---|---|---|---|
   | +24 h | 0.803 | 0.778 | 0.761 | **0.668** | 0.733 | 0.749 |
   | +48 h | 0.799 | 0.793 | 0.725 | **0.620** | 0.687 | 0.725 |
   | +72 h | 0.812 | 0.785 | 0.649 | **0.547** | 0.699 | 0.699 |

   The band is fine in clean air and fails in the **upper-middle**, ~50–75 µg/m³ — which is the
   CPCB Satisfactory→Moderate→Poor transition, the range where the number actually changes what an
   officer does. It degrades sharply with horizon: 0.668 → 0.620 → **0.547**.

   Delhi, run the same way, does **not** have this problem — its worst predicted quintile is
   **0.704** (+24 h: 0.827 / 0.768 / 0.704 / 0.800 / 0.816). So this is one city's model, not a
   systemic flaw in the approach, and the conditional table is what makes that distinguishable.

   Seven conformity scores were compared over four forward folds to try to close it — asymmetric
   per-edge, normalized by band width, normalized by predicted level, Mondrian by predicted bin,
   and the combinations (`scripts/tune_conformal_tails.py`). On that protocol the worst predicted
   quintile moved from **0.615 (current) to 0.646 at best** (level-scaled), paid for with coverage
   in the lower quintiles:

   | variant | A current | B asym | C norm | D asym+norm | E Mondrian | F level-scaled | G asym+level |
   |---|---|---|---|---|---|---|---|
   | worst predicted quintile | 0.615 | 0.628 | 0.640 | 0.637 | 0.640 | **0.646** | 0.638 |

   Three points on an eighteen-point shortfall. Split conformal promises **marginal** coverage and
   delivers it; what fails is **conditional** coverage, and that is the quantile models
   under-dispersing in the mid-to-upper range — a model problem, not a calibration one. We kept the
   simple score and made the shortfall **measurable instead**: the benchmark now emits
   `pi80_coverage_by_predicted_quintile`. Say this plainly if asked — *"our 80% band is 75% overall
   and 67% in the 56–76 µg/m³ range, and we publish the breakdown"* is a stronger answer than a
   single number that hides it. **Unfixed, quantified, and disclosed.**
4. In the monsoon window Delhi's early-warning recall is **0 of 9 onsets** at the 90 µg/m³ threshold.
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
| Sentinel-5P (NO₂) | **RUNNING** *(since 19 Aug)* | `connectors/earth_engine.py`, invoked by the daily job in `.github/workflows/ingest.yml`. **136 rows** in `measurements` with `source='s5p'`, `variable='no2_sat'`. Skips with a `::warning::` rather than failing when the GEE secrets are absent. |
| Sentinel-2 | **PARTIAL** | 487 of 647 emission sources are `cv_detected`, i.e. machine-detected from imagery in an earlier offline run. Dossier patches refuse placeholders (`allow_placeholder=False`). But nothing re-ingests imagery on a schedule. |
| MODIS / VIIRS | **RUNNING** *(since 19 Aug)* | Same path as S5P; **164 rows** with `source='modis'`, `variable='fire'` (FIRMS `T21` band). The `fire` and `no2_sat` markers are no longer identically zero, though coverage is days-old rather than hourly — a daily job, not a live feed. |
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
| Forecast RMSE vs persistence at hyperlocal resolution | +9.1% multi-season, +6…+26% recent, **−6% Jaipur**; RMSE 60.96 @ +24 h; PI80 (rolling, 10 origins) delhi 0.783 / mumbai 0.816 / **kolkata 0.748→0.698** | **B−** — genuinely measured, modestly good, one city negative and one under-covered |
| Enforcement quality rated by domain experts | **n = 0.** Kit exists (`docs/EXPERT_OUTREACH.md`, `PILOT_OUTREACH.md`), ratings pending | **F** — this is a named scoring criterion and we have nothing |
| Citizen advisory relevance + language coverage | 8 languages × 4 channels, script-validated; **2/8** natively reviewed, both team members | **B** on coverage, **D** on review |
| Response time from signal to intervention | **1,130 ms** pipeline wall-clock (`/latency`) | **C** — we measure our *pipeline*, not an organisation's response time. The criterion means the latter. |

**The F is the one that matters.** "Enforcement recommendation quality rated by domain experts" is
written into the evaluation focus. We have a protocol, a rating sheet and an outreach kit — and
zero responses. One officer's rating, even a mediocre one, moves this from F to C and is worth more
than any remaining code.

---

## 6 · Claims that outrun their evidence

1. ~~**"Six agents"**~~ → **FIXED 19 Aug.** Five nodes registered, four in a clean-air trace. §2.1.
2. ~~**"Validated 1 km field"**~~ → **RESOLVED 19 Aug, against us.** Leave-one-station-out was run
   on real held-out stations in all ten cities: the field beats predicting the city average in one
   of ten. The claim is retired rather than defended. §2.2 and `docs/COVERAGE_VALIDATION.md`.
3. **"SHAP explanations"** → **STILL TRUE, list moved.** Not produced for Delhi, Mumbai or
   Bengaluru; Hyderabad has since crossed the gate. §2.4.
4. **"Response time from signal to intervention: seconds"** → **STILL A TRAP.** That is our compute
   latency. No organisation's response time has been measured. Say *"our pipeline turns a signal
   into a cited, ready-to-sign recommendation in about a second"* — never imply we shortened a
   municipality's response. The pitch script and the manual both use the safe phrasing; the danger
   is improvising in Q&A.

Plus two documentation defects found while auditing, **both fixed 19 Aug**:
- ~~`channels/README.md` claims "LLM (Gemini) translation"~~ — removed; the file now states
  explicitly that there is no language model anywhere in the product, and why that is deliberate.
- ~~`PRD.md:63-64` lists MODIS/VIIRS AOD, Sentinel-2 change detection and traffic density as
  attribution inputs~~ — the input list is now split into "wired into the model", "adjacent, not
  features" and "not used, honestly so". Note that MODIS fire and Sentinel-5P NO₂ **have since
  become real inputs** (§4), on a daily cadence.

Found and fixed after this audit was first written, all 19 Aug:
- The scoreboard **ranked cities by a different number than the badge beside it** — a mean of each
  cell's latest reading versus the canonical 24 h mean, disagreeing by up to 2.25×. Bengaluru
  ranked dirtiest of ten when it is sixth, because one of its six cells was stuck at 256 µg/m³.
- **8 of 303 served forecasts had a negative lower bound.** A mass concentration cannot be negative.
- Station discovery used a **25 km circle around the map's centre point**, which sits 11.7 km east
  of Delhi's actual extent — so western Delhi was never ingested and NCR stations were ingested as
  Delhi. Six of ten cities were not fully covered.
- The plume drew **tomorrow's forecast wind** on a map labelled "now", which is why Delhi appeared
  to have no wind direction at all.
- Two trend badges **contradicted the integers printed beside them** (rounding, not arithmetic).

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

**Rewritten 19 Aug against what is actually left.** Four of the original seven are done.

| # | Action | Effort | Status |
|---|---|---|---|
| 1 | Fix "six agents"; rehearse the spike-gate line and the Pune-for-SHAP switch | 45 min | **DONE** — corrected everywhere including the deck; the script now carries both lines |
| 2 | Get **one** officer or academic to rate the worklist | outreach | **OPEN — and now the single largest gap.** The only **F** on a named scoring criterion. Cannot be closed by writing code, which is exactly why it keeps slipping |
| 3 | Leave-one-station-out validation of the 1 km field | ~half a day | **DONE 19 Aug — and it failed.** One city in ten beats a constant. The claim is retired, the result published in `docs/COVERAGE_VALIDATION.md`, and the honest framing is now the asset instead |
| 4 | Rehearse the Jaipur drill-down and the LLM question | 1 hour | **DONE** — both are written out verbatim in `docs/PITCH_SCRIPT.md`, and the manual carries 220 prepared questions with an adversarial pass over the answers |
| 5 | Regenerate `ATTRIBUTION_VALIDATION.md` and date it | 20 min | **DONE** — 0.991 / 0.928 / 0.939, dated, leading with the mean absolute delta |
| 6 | Either run the satellite ingest on a cron, or stop listing S5P/MODIS as live inputs | 1 hour | **DONE** — the daily job runs it; 136 Sentinel-5P and 164 MODIS rows are in the database. State the cadence as *daily*, not live |
| 7 | `api/main.py` coverage 33% → 80% | ~half a day | **OPEN.** Only matters if a judge opens the repo |

**What is genuinely left, in order:**

1. **One expert rating.** Everything else on this page can be done by us. This cannot, and it is the
   only named criterion scoring zero.
2. ~~Leave-one-station-out validation.~~ **Done, and the result was disappointing.** One city in ten
   beats a constant. Published in full. The prediction in this line — that publishing a bad result
   beats not running the test — is now the position we are actually in, and it holds: nothing about
   the 1 km field can be caught overstating itself any more, because the worst number is ours.
3. **API test coverage.** Cosmetic unless the repo is opened, and the ML and agent modules — the
   parts a technical judge would actually probe — are the well-covered ones.

Everything else on this page is closed. The project is no longer in a "build it" phase; it is in a
"make it impossible to catch overstating itself" phase, and the remaining gap is evidence someone
outside this team has to supply.
