# Delhi — real interventions in hindsight (generated 2026-08-18)

Station cells: 39 · season 2025-10-01 → 2026-02-20 · replayed served forecast (rolling monthly refit, 90-day window, persistence blend, calibrated P).

## A. Would VayuNetra have warned before the order?

Alarm operating point P ≥ 0.3. For each escalation: what the system said 24 / 48 / 72 h before the order time (city mean of station cells).

| order | observed at order | lead | P(>120) mean | P(>250) mean | cells alarming >120 | served city mean | persistence said | observed then |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| GRAP Stage I invoked (2025-10-14) | 83.8 | 24 h | 0.01 | 0.0 | 0 % of 38 | 48.9 | 54.2 | 52.1 |
|  |  | 48 h | 0.02 | 0.0 | 0 % of 38 | 49.3 | 56.5 | 52.0 |
|  |  | 72 h | 0.03 | 0.0 | 1 % of 38 | 52.7 | 58.8 | 52.2 |
| GRAP Stage II invoked (2025-10-19) | 164.5 | 24 h | 0.09 | 0.0 | 1 % of 38 | 80.5 | 99.5 | 118.0 |
|  |  | 48 h | 0.06 | 0.0 | 0 % of 38 | 72.0 | 85.7 | 117.4 |
|  |  | 72 h | 0.07 | 0.0 | 0 % of 38 | 71.5 | 71.7 | 123.2 |
| GRAP Stage III invoked (construction / demolition ban) (2025-11-11) | 325.6 | 24 h | 0.94 | 0.23 | 100 % of 2 ⚠ low coverage | 181.7 | 208.8 | 185.5 |
|  |  | 48 h | 0.76 | 0.15 | 99 % of 38 | 134.6 | 141.6 | 228.4 |
|  |  | 72 h | 0.91 | 0.32 | 100 % of 37 | 184.3 | 201.2 | 239.2 |
| GRAP Stage IV invoked (2025-12-13) | 381.8 | 24 h | 0.83 | 0.31 | 99 % of 38 | 205.9 | 225.3 | 406.7 |
|  |  | 48 h | 0.42 | 0.09 | 83 % of 39 | 132.5 | 152.2 | 409.9 |
|  |  | 72 h | 0.33 | 0.06 | 61 % of 39 | 110.7 | 122.5 | 378.1 |
| GRAP Stage III re-invoked (2026-01-16) | 213.8 | 24 h | 0.85 | 0.35 | 100 % of 1 ⚠ low coverage | 203.6 | 205.0 | 130.5 |
|  |  | 48 h | 0.72 | 0.3 | 100 % of 1 ⚠ low coverage | 166.5 | 154.5 | 130.5 |
|  |  | 72 h | 0.57 | 0.21 | 100 % of 1 ⚠ low coverage | 132.0 | 116.5 | 130.5 |
| GRAP Stage IV re-invoked (2026-01-17) | 332.7 | 24 h | 0.72 | 0.22 | 100 % of 1 ⚠ low coverage | 160.5 | 130.5 | 247.5 |
|  |  | 48 h | 0.83 | 0.42 | 100 % of 1 ⚠ low coverage | 204.1 | 205.0 | 247.5 |
|  |  | 72 h | 0.72 | 0.33 | 100 % of 1 ⚠ low coverage | 182.7 | 154.5 | 247.5 |

⚠ low coverage = fewer than 5 station cells had a contiguous record at that issue time in the public feed (OpenAQ carried a single Delhi station on 11–19 Jan 2026); those rows are one station, not the city.

Status quo: 13 of 17 GRAP orders in winter 2025-26 were passed after the AQI had already crossed that stage's threshold — ThePrint analysis, Feb 2026 (press analysis, not an audit figure): https://theprint.in/environment/delhi-brought-grap-reactively-after-aqi-crossed-limit-13-out-of-17-times-this-winter/2855807/

## B. Did the air change during the intervention, weather taken out?

Deweathering model: LightGBM on ERA5 meteorology + hour/dow/doy/cell, fitted on season hours outside Stage III/IV and Diwali windows; expected = what that weather normally brings; difference = observed − expected (association, not causal). Trained on 88,270 hours; held-out (day-blocked) R² 0.61, RMSE 65.0 µg/m³.

| window | days · cells | observed mean | weather-expected | difference (µg/m³) | difference | 90 % day-bootstrap |
|---|---:|---:|---:|---:|---:|---:|
| Diwali night (green crackers 20:00–22:00 permitted, SC order 15 Oct) (2025-10-20 → 2025-10-21) | 2 · 39 | 373.4 | 191.6 | +181.8 | +94.9 % | [+92.1, +314.4] |
| GRAP Stage III invoked (construction / demolition ban) (2025-11-11 → 2025-11-26) | 16 · 39 | 239.3 | 239.2 | +0.2 | +0.1 % | [-14.9, +14.0] |
| GRAP Stage IV invoked (2025-12-13 → 2025-12-24) | 12 · 39 | 241.6 | 200.5 | +41.1 | +20.5 % | [+22.6, +58.7] |
| GRAP Stage III re-invoked (2026-01-16 → 2026-01-22) | 7 · 39 | 203.3 | 195.8 | +7.5 | +3.8 % | [+0.1, +32.8] |
| GRAP Stage IV re-invoked (2026-01-17 → 2026-01-22) | 6 · 39 | 202.2 | 194.9 | +7.3 | +3.8 % | [-0.0, +31.5] |

Read: a negative difference means the air was cleaner than the same weather usually brings; positive means dirtier. Association only — coincident factors stay in the number. Two limits are visible in the table itself: the Diwali row shows the method has the power to detect a large signal, and the Stage IV rows sit in the most stagnant weather of the season, where a tree model fitted on calmer hours cannot extrapolate and under-predicts — so a positive difference there is at least partly method, not fireworks. What we can say: we find no weather-adjusted reduction during Stage III/IV that this method can detect.

## Sources

- GRAP Stage I invoked — 2025-10-14: https://www.newsonair.gov.in/delhi-ncr-implements-grap-stage-i-to-tackle-worsening-air-quality
- GRAP Stage II invoked — 2025-10-19: https://www.newsonair.gov.in/ (CAQM Stage II order, 19 Oct 2025)
- Diwali night (green crackers 20:00–22:00 permitted, SC order 15 Oct) — 2025-10-20: https://www.newsonair.gov.in/supreme-court-allows-sale-use-of-green-firecrackers-in-delhi-ncr-from-oct-18-21
- GRAP Stage III invoked (construction / demolition ban) — 2025-11-11: https://www.newsonair.gov.in/delhi-enters-severe-pollution-stage-caqm-imposes-strict-stage-iii-grap-measures
- GRAP Stage IV invoked — 2025-12-13: https://www.newsonair.gov.in/delhi-ncr-air-quality-worsens-stage-iv-grap-activated
- GRAP Stage III re-invoked — 2026-01-16: https://www.newsonair.gov.in/grap-iii-reimposed-in-delhi-ncr-as-air-quality-turns-very-poor
- GRAP Stage IV re-invoked — 2026-01-17: https://environment.delhi.gov.in/sites/default/files/environment/universal/invocation_of_grap_order_stage_iv_17.01.2026_final.pdf
