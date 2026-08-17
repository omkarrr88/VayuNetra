# Severe-episode early warning — does the forecast warn before the air turns?

Generated from `docs/benchmarks/delhi.json` (`python -m ml.eval.benchmark --city delhi
--source hist --split 2025-11-01 --protocol rolling --window-days 90`). Real CPCB station
data via OpenAQ, 39 Delhi-NCR station cells, Feb 2025 → Aug 2026; test window = the full
2025-26 winter plus spring/summer 2026 (208 k station-hours @24 h). Protocol = the deployed
one: monthly refit on the trailing 90 days, train strictly before each test month.

## The question that matters for intervention

GRAP, and every reactive system, acts when the AQI *has already* crossed a threshold. The
CEEW audit (Oct 2025) found Delhi's official AQEWS caught 5 of 14 'severe and above' episodes
in winter 2024-25 and that GRAP III/IV were triggered on observed AQI. So the decision-
relevant metric is not average RMSE — it is: **when a cell is clean now and will be bad at
t+h, do we say so at t?**

An *onset* is a station-hour where observed PM2.5 is above the band at t+h but was **not**
above it at issue time t. Persistence ("tomorrow = today") has **onset recall 0 by
construction** — it can never warn of a spike before it starts. Any non-zero onset recall is
real anticipatory value.

## Results (Delhi, rolling 90-day protocol)

Alarm = forecast above the band. CPCB PM2.5 bands: Poor > 90, Very Poor > 120, Severe > 250 µg/m³.

| band | h | events | model P / R / F1 | persistence P / R / F1 | onsets | **onset recall — model** | onset recall — persistence |
|---|---:|---:|---|---|---:|---:|---:|
| Poor (>90) | 24 | 84,656 | 0.79 / 0.81 / 0.80 | 0.79 / 0.80 / 0.79 | 17,360 | **34 %** | 0 |
| Poor (>90) | 48 | 85,208 | 0.77 / 0.81 / 0.79 | 0.76 / 0.77 / 0.76 | 19,719 | **39 %** | 0 |
| Poor (>90) | 72 | 85,708 | 0.76 / 0.80 / 0.78 | 0.75 / 0.76 / 0.75 | 20,846 | **43 %** | 0 |
| **Very Poor (>120)** | 24 | 63,005 | 0.74 / 0.78 / 0.76 | 0.74 / 0.75 / 0.75 | 15,817 | **36 %** | 0 |
| **Very Poor (>120)** | 48 | 63,433 | 0.70 / 0.76 / 0.73 | 0.70 / 0.71 / 0.71 | 18,356 | **38 %** | 0 |
| **Very Poor (>120)** | 72 | 63,926 | 0.66 / 0.72 / 0.69 | 0.69 / 0.70 / 0.70 | 19,212 | **38 %** | 0 |
| Severe (>250) | 24 | 17,722 | 0.48 / 0.19 / 0.27 | 0.55 / 0.56 / 0.56 | 7,793 | 2 % | 0 |
| Severe (>250) | 48 | 17,738 | 0.37 / 0.12 / 0.18 | 0.45 / 0.45 / 0.45 | 9,684 | 4 % | 0 |
| Severe (>250) | 72 | 17,822 | 0.38 / 0.02 / 0.04 | 0.40 / 0.41 / 0.40 | 10,577 | 1 % | 0 |

**Read-out (honest).**

* On overall alarm F1 the model matches or edges persistence at Poor / Very Poor at every
  horizon (0.80 vs 0.79 @24 h; 0.78 vs 0.75 @72 h). Persistence is strong here only because
  most bad hours are *continuations* of an already-bad spell.
* The distinct value is **onsets**: the model flags **36–38 % of clean→Very-Poor
  transitions 24–72 h ahead** (34–43 % for Poor). That is lead time a reactive trigger
  structurally cannot have.
* **Severe (>250) is our weak point and we say so.** Recall 2–19 %, onset recall ≤ 4 %:
  the model under-predicts the extreme tail (as does the official WRF-Chem system, which
  CEEW found under-predicts PM2.5 by −24 µg/m³ in winter). This is why every forecast now
  ships a **calibrated P(>250)** rather than a point: at +24 h P(>250) has a Brier skill of
  +23 % over climatology (`docs/benchmarks/delhi.md`, Calibration) — the probability carries
  the warning even when the median does not cross the line.
* Precision/recall trade off with the alarm threshold; these use the plain CPCB cut-offs,
  not a tuned operating point. Tuning the alarm on P(>band) rather than the median is the
  obvious next step and is on the roadmap.

## How this reaches a decision-maker

* Cell story: `P(> 120)` / `P(> 250)` chip beside every horizon.
* Advisories: the same probability, in words, in the city's languages.
* City stats: expected people in Very Poor / Severe air (`docs/HEALTH_IMPACT.md`).
* Enforcement: onset-flagged cells rank higher via the forecast term in the priority score.

Reproduce: `python -m ml.eval.benchmark --city delhi --source hist --split 2025-11-01 --protocol rolling --window-days 90`
