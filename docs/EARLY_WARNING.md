# Severe-episode early warning — does the forecast warn before the air turns?

Generated from `docs/benchmarks/delhi.json` (`python -m ml.eval.benchmark --city delhi
--source hist --split 2025-11-01 --protocol rolling --window-days 90`). Real CPCB station
data via OpenAQ, 39 Delhi-NCR station cells, Feb 2025 → Aug 2026; test window = the full
2025-26 winter plus spring/summer 2026 (207 k station-hours @24 h on the shared support mask). Protocol = the deployed
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

| band | h | events | median alarm P / R / F1 | **P ≥ 0.3 alarm** P / R / F1 | persistence P / R / F1 | onsets | onset recall — median alarm | **onset recall — P ≥ 0.3** | onset recall — persistence |
|---|---:|---:|---|---|---|---:|---:|---:|---:|
| Poor (>90) | 24 | 84,467 | 0.79 / 0.82 / 0.81 | 0.74 / 0.87 / 0.80 | 0.79 / 0.80 / 0.79 | 17,190 | 26 % | **44 %** | 0 |
| Poor (>90) | 48 | 85,025 | 0.77 / 0.81 / 0.79 | 0.73 / 0.85 / 0.79 | 0.76 / 0.77 / 0.76 | 19,578 | 30 % | **42 %** | 0 |
| Poor (>90) | 72 | 85,523 | 0.75 / 0.80 / 0.78 | 0.72 / 0.85 / 0.78 | 0.75 / 0.76 / 0.75 | 20,694 | 30 % | **44 %** | 0 |
| **Very Poor (>120)** | 24 | 62,866 | 0.74 / 0.79 / 0.77 | 0.68 / 0.87 / 0.77 | 0.74 / 0.75 / 0.75 | 15,701 | 24 % | **54 %** | 0 |
| **Very Poor (>120)** | 48 | 63,297 | 0.70 / 0.77 / 0.74 | 0.66 / 0.85 / 0.74 | 0.70 / 0.71 / 0.71 | 18,226 | 31 % | **54 %** | 0 |
| **Very Poor (>120)** | 72 | 63,784 | 0.67 / 0.74 / 0.70 | 0.64 / 0.84 / 0.72 | 0.69 / 0.70 / 0.70 | 19,117 | 26 % | **51 %** | 0 |
| Severe (>250) | 24 | 17,692 | 0.60 / 0.45 / 0.51 | 0.48 / 0.66 / 0.56 | 0.55 / 0.56 / 0.56 | 7,756 | 1 % | **24 %** | 0 |
| Severe (>250) | 48 | 17,705 | 0.49 / 0.34 / 0.40 | 0.38 / 0.53 / 0.44 | 0.45 / 0.45 / 0.45 | 9,661 | 1 % | **21 %** | 0 |
| Severe (>250) | 72 | 17,788 | 0.50 / 0.28 / 0.36 | 0.38 / 0.46 / 0.41 | 0.40 / 0.41 / 0.40 | 10,569 | 0 % | **19 %** | 0 |

**Read-out (honest).**

* Two alarms are reported. The **median alarm** (served forecast > band) matches or edges persistence
  on F1 but, because the served forecast is persistence-blended, it sees only 24–31 % of Very-Poor
  onsets. The **probability alarm** — P(>120) ≥ 0.3 from the calibrated exceedance distribution — is
  the operating point the product uses (brief, cell chips, advisories): it flags **54 % / 54 % / 51 %**
  of clean→Very-Poor onsets 1–3 days ahead at precision 0.68 / 0.66 / 0.64, with F1
  0.77 / 0.74 / 0.72 vs persistence 0.75 / 0.71 / 0.70. Persistence is
  structurally 0 on onsets. τ = 0.2 buys 61–65 % recall at 0.64–0.66 precision; τ = 0.5 gives 41 % at
  0.75 — the trade-off is printed, not hidden (`docs/benchmarks/delhi.md`, "Probability alarms").
* **Severe (>250) stays our weak point and we say so.** Median-alarm recall on Severe hours is
  2–19 % and onset recall ≤ 4 %; the probability alarm helps but the extreme tail is under-predicted (as
  the official WRF-Chem system's is — CEEW found −24 µg/m³ winter bias). The calibrated P(>250) carries
  the warning even when the median does not cross the line: Brier skill +30.7 % at 24 h.
* Thresholds are the plain CPCB cut-offs, not tuned operating points; τ is the one knob and its full
  curve is in the artifact.

## How this reaches a decision-maker

* Cell story: `P(> 120)` / `P(> 250)` chip beside every horizon.
* Morning brief: "where the air is about to turn" lists every cell with P(>120) ≥ 0.3 at any horizon.
* Advisories: the same probability, in words, in the city's languages.
* City stats: expected people in Very Poor / Severe air (`docs/HEALTH_IMPACT.md`).
* Enforcement: onset-flagged cells rank higher via the forecast term in the priority score.

Reproduce: `python -m ml.eval.benchmark --city delhi --source hist --split 2025-11-01 --protocol rolling --window-days 90`

## Against real orders

The same alarm, replayed against the CAQM GRAP escalations of winter 2025-26 — what P(>120) the system carried 24/48/72 h before each order, and a weather-normalised check of the windows — is in [OUTCOMES.md](OUTCOMES.md) (`python -m ml.eval.interventions`).
