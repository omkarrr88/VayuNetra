# Outcomes — real interventions, in hindsight

PS-5 asks for a *demonstrated* reduction in response time and for enforcement that works.
VayuNetra's own dispatch tracker is live but young: no city has dispatched through it yet, so
there is no VayuNetra-triggered field action to grade. What we can grade honestly, today, are
the **real, dated interventions the state took last winter** — the CAQM GRAP escalations for
Delhi-NCR and Diwali night — against the same station history the forecast benchmark uses
(39 Delhi station cells, OpenAQ/CPCB, Oct 2025 → Feb 2026). Two questions, one artifact,
recomputed by `python -m ml.eval.interventions --city delhi` and served at
`GET /metrics/interventions?city=delhi` (console: Forecast → step 3). Full table:
`docs/benchmarks/delhi_interventions.md`.

Order dates come from the government releases linked in the artifact (News on Air / PIB and
the Delhi Environment Department's Stage IV order of 17 Jan 2026); nothing is dated from
memory.

## A. Would VayuNetra have warned before the order?

The served forecast — rolling monthly refit on the trailing 90 days, persistence-blended,
calibrated exceedance probabilities: the production recipe — was replayed with the split at
1 Oct 2025. For each escalation, what the system carried 24 / 48 / 72 h **before the order
time**, as the city mean over station cells:

| order (IST date) | PM2.5 at order | P(>120) 24 h before | 48 h | 72 h | cells alarming (P ≥ 0.3), 24 h before |
|---|---:|---:|---:|---:|---:|
| GRAP I · 14 Oct 2025 | 84 | 1 % | 2 % | 3 % | 0 % of 38 |
| GRAP II · 19 Oct 2025 | 165 | 9 % | 6 % | 7 % | 1 % of 38 |
| **GRAP III · 11 Nov 2025** | 326 | **94 %** ⚠ | **76 %** | **91 %** | 100 % of 2 ⚠ / 99 % of 38 (48 h) |
| **GRAP IV · 13 Dec 2025** | 382 | **83 %** | **42 %** | **33 %** | **99 % of 38** |
| GRAP III · 16 Jan 2026 | 214 | 85 % ⚠ | 72 % ⚠ | 57 % ⚠ | ⚠ 1 station |
| GRAP IV · 17 Jan 2026 | 333 | 72 % ⚠ | 83 % ⚠ | 72 % ⚠ | ⚠ 1 station |

⚠ = fewer than 5 station cells had a contiguous record at that issue time in the public feed
(OpenAQ carried a single Delhi station on 11–19 Jan 2026); those cells are one station, not the
city.

**Read honestly.**

* The two winter escalations that matter most — **Stage III on 11 Nov and Stage IV on
  13 Dec** — were flagged **a full day ahead across essentially the whole station network**
  (P(>120) 0.83–0.94, 99–100 % of cells past the alarm), and Stage III was already at 0.76 two
  days out. Persistence, by construction, only repeats today's level: 24 h before Stage IV it
  said 225 µg/m³; the city measured 407.
* The **October orders were not foreseen.** Before Stage I (14 Oct) the season had not turned;
  before Stage II (19 Oct, Diwali eve) the model carried 9 %. The mid-October rise came faster
  than a model trained on the calm season could see. That is a limit, not a footnote.
* Status quo for contrast: 13 of 17 GRAP orders that winter were passed *after* the AQI had
  already crossed the stage threshold (ThePrint analysis, Feb 2026 — press analysis; we found
  no CAG/CPCB document that quantifies the signal→enforcement lag, so we do not quote one).

## B. Did the air change during the intervention, once weather is taken out?

A city-wide order has no untreated control inside the city, and it is triggered *by* dirty
air, so a plain before/after mostly measures regression to the mean and the weather. We use
meteorological normalisation: LightGBM on ERA5 meteorology (temperature, humidity,
precipitation, boundary-layer height, wind vector, wind speed, ventilation) plus hour,
day-of-week, day-of-year and cell, fitted on the season's hours **outside** the Stage III/IV
and Diwali windows (88,270 hours; day-blocked held-out R² 0.61, RMSE 65 µg/m³), then asked what
PM2.5 that weather normally brings inside each window.

| window | days | observed | weather-expected | difference | 90 % day-bootstrap |
|---|---:|---:|---:|---:|---:|
| Diwali night · 20–21 Oct 2025 | 2 | 373 | 192 | **+182 (+95 %)** | [+92, +314] |
| GRAP III · 11–26 Nov 2025 | 16 | 239 | 239 | +0.2 (+0.1 %) | [−15, +14] |
| GRAP IV · 13–24 Dec 2025 | 12 | 242 | 201 | +41 (+21 %) | [+23, +59] |
| GRAP III · 16–22 Jan 2026 | 7 | 203 | 196 | +7.5 (+3.8 %) | [+0.1, +33] |
| GRAP IV · 17–22 Jan 2026 | 6 | 202 | 195 | +7.3 (+3.8 %) | [−0.0, +32] |

**Read honestly.**

* Diwali night is the positive control: the method sees a large, expected signal.
* For the GRAP windows we find **no weather-adjusted reduction that this method can
  detect.** Stage III in November is a clean null; the Stage IV rows are *worse* than
  expected, but they sit in the most stagnant weather of the season, where a tree model
  fitted on calmer hours cannot extrapolate and under-predicts — that positive difference is
  at least partly method, not fireworks. Association, not causation: stubble-burning decline,
  holidays and everything else coincident with the order stay in the number.
* This is the reason VayuNetra measures each dispatched action **against its own cell and
  the city's drift** (`intervention_tracking`, armed automatically at dispatch) rather than
  grading city-wide stages: a targeted action has a control; a blanket stage does not.

## What this is not

Not a VayuNetra outcome. It is the honest baseline the system will be judged against once
cities dispatch through it: how far ahead we warn, and how we will measure the effect —
with a method that has already shown it can see a real signal and already told us where it
is blind.
