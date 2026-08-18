# Forecast benchmark — kolkata (hist)

Window 2025-02-18 → 2026-08-15, test from **2025-11-01** (rolling-origin monthly refit, 90-day training window; train strictly before each test origin). 10 station cells, 114,182 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T17:34Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 53,066 | 33.75 | 39.31 | 51.75 | **29.0** | +14.1% | 29.52 | +12.5% |
| winter_nov_feb | 24 | 20,966 | 45.94 | 54.27 | 78.59 | **40.26** | +12.4% | 41.39 | +9.9% |
| non_winter | 24 | 32,100 | 22.46 | 25.13 | 19.8 | **18.22** | +18.9% | 17.94 | +20.1% |
| full_test | 48 | 53,396 | 37.33 | 39.5 | 51.83 | **33.76** | +9.6% | 34.9 | +6.5% |
| winter_nov_feb | 48 | 21,427 | 51.99 | 54.43 | 78.4 | **45.25** | +13.0% | 47.51 | +8.6% |
| non_winter | 48 | 31,969 | 22.72 | 24.91 | 19.17 | **23.05** | -1.5% | 22.83 | -0.5% |
| full_test | 72 | 53,420 | 38.64 | 40.06 | 51.91 | **35.07** | +9.2% | 38.9 | -0.7% |
| winter_nov_feb | 72 | 21,697 | 53.16 | 55.16 | 78.15 | **48.73** | +8.3% | 55.95 | -5.3% |
| non_winter | 72 | 31,723 | 24.11 | 24.93 | 19.0 | **21.14** | +12.3% | 20.18 | +16.3% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.7, 0.6, 0.7, 0.95, 0.75, 0.05, 0.65, 0.65, 1.0, 1.0]; +48h [0.8, 0.45, 0.85, 0.95, 0.95, 0.2, 0.9, 0.6, 1.0, 0.75]; +72h [0.85, 0.5, 0.8, 0.8, 1.0, 0.2, 1.0, 0.6, 1.0, 0.85]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 8,953 | 66.15 | 73.1 | **60.6** | +8.4% |
| observed_over_120 | 24 | 4,180 | 85.31 | 94.19 | **82.58** | +3.2% |
| observed_over_250 | 24 | 183 | 304.24 | 327.59 | **311.03** | -2.2% |
| observed_over_90 | 48 | 9,048 | 71.51 | 73.02 | **66.6** | +6.9% |
| observed_over_120 | 48 | 4,235 | 89.07 | 93.99 | **89.7** | -0.7% |
| observed_over_250 | 48 | 185 | 316.32 | 323.18 | **318.94** | -0.8% |
| observed_over_90 | 72 | 9,133 | 71.25 | 75.46 | **71.88** | -0.9% |
| observed_over_120 | 72 | 4,256 | 91.58 | 97.23 | **97.91** | -6.9% |
| observed_over_250 | 72 | 188 | 313.71 | 317.7 | **328.51** | -4.7% |

## Probability alarms — alarm = P(> band) ≥ τ (operating points on the calibrated probability)

| band | h | τ | precision | recall | F1 | onset recall |
|---|---:|---:|---:|---:|---:|---:|
| poor | 24 | 0.2 | 0.57 | 0.89 | 0.695 | 0.62 |
| poor | 24 | 0.3 | 0.635 | 0.827 | 0.718 | 0.411 |
| poor | 24 | 0.4 | 0.68 | 0.766 | 0.721 | 0.243 |
| poor | 24 | 0.5 | 0.727 | 0.697 | 0.711 | 0.108 |
| very_poor | 24 | 0.2 | 0.498 | 0.75 | 0.599 | 0.363 |
| very_poor | 24 | 0.3 | 0.57 | 0.662 | 0.612 | 0.192 |
| very_poor | 24 | 0.4 | 0.623 | 0.594 | 0.608 | 0.095 |
| very_poor | 24 | 0.5 | 0.658 | 0.531 | 0.588 | 0.042 |
| severe | 24 | 0.2 | 0.342 | 0.148 | 0.206 | 0.0 |
| severe | 24 | 0.3 | 0.344 | 0.115 | 0.172 | 0.0 |
| severe | 24 | 0.4 | 0.367 | 0.098 | 0.155 | 0.0 |
| severe | 24 | 0.5 | 0.378 | 0.093 | 0.149 | 0.0 |
| poor | 48 | 0.2 | 0.465 | 0.843 | 0.6 | 0.592 |
| poor | 48 | 0.3 | 0.571 | 0.736 | 0.643 | 0.356 |
| poor | 48 | 0.4 | 0.646 | 0.644 | 0.645 | 0.186 |
| poor | 48 | 0.5 | 0.693 | 0.563 | 0.621 | 0.085 |
| very_poor | 48 | 0.2 | 0.437 | 0.636 | 0.518 | 0.337 |
| very_poor | 48 | 0.3 | 0.507 | 0.516 | 0.511 | 0.178 |
| very_poor | 48 | 0.4 | 0.559 | 0.428 | 0.484 | 0.081 |
| very_poor | 48 | 0.5 | 0.601 | 0.365 | 0.455 | 0.034 |
| severe | 48 | 0.2 | 0.276 | 0.146 | 0.191 | 0.0 |
| severe | 48 | 0.3 | 0.306 | 0.119 | 0.171 | 0.0 |
| severe | 48 | 0.4 | 0.29 | 0.097 | 0.146 | 0.0 |
| severe | 48 | 0.5 | 0.294 | 0.081 | 0.127 | 0.0 |
| poor | 72 | 0.2 | 0.534 | 0.805 | 0.642 | 0.531 |
| poor | 72 | 0.3 | 0.606 | 0.676 | 0.639 | 0.269 |
| poor | 72 | 0.4 | 0.654 | 0.553 | 0.599 | 0.114 |
| poor | 72 | 0.5 | 0.702 | 0.445 | 0.545 | 0.054 |
| very_poor | 72 | 0.2 | 0.453 | 0.516 | 0.482 | 0.227 |
| very_poor | 72 | 0.3 | 0.518 | 0.368 | 0.43 | 0.062 |
| very_poor | 72 | 0.4 | 0.562 | 0.284 | 0.377 | 0.026 |
| very_poor | 72 | 0.5 | 0.594 | 0.226 | 0.327 | 0.013 |
| severe | 72 | 0.2 | 0.265 | 0.069 | 0.11 | 0.0 |
| severe | 72 | 0.3 | 0.244 | 0.053 | 0.087 | 0.0 |
| severe | 72 | 0.4 | 0.27 | 0.053 | 0.089 | 0.0 |
| severe | 72 | 0.5 | 0.267 | 0.043 | 0.073 | 0.0 |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 8,953 | 0.717/0.693/0.705 | 0.711/0.712/0.712 | 2,576 | 0.085 | 0.0 |
| very_poor (>120) | 24 | 4,180 | 0.663/0.505/0.573 | 0.616/0.616/0.616 | 1,607 | 0.023 | 0.0 |
| severe (>250) | 24 | 183 | 0.366/0.082/0.134 | 0.223/0.219/0.221 | 143 | 0.0 | 0.0 |
| poor (>90) | 48 | 9,048 | 0.663/0.568/0.612 | 0.64/0.639/0.64 | 3,262 | 0.116 | 0.0 |
| very_poor (>120) | 48 | 4,235 | 0.575/0.339/0.427 | 0.524/0.523/0.524 | 2,020 | 0.034 | 0.0 |
| severe (>250) | 48 | 185 | 0.267/0.065/0.104 | 0.182/0.178/0.18 | 152 | 0.0 | 0.0 |
| poor (>90) | 72 | 9,133 | 0.639/0.45/0.528 | 0.621/0.62/0.621 | 3,467 | 0.129 | 0.0 |
| very_poor (>120) | 72 | 4,256 | 0.53/0.22/0.311 | 0.496/0.499/0.497 | 2,134 | 0.035 | 0.0 |
| severe (>250) | 72 | 188 | 0.192/0.027/0.047 | 0.181/0.17/0.175 | 156 | 0.0 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.748 (mean width 51.3 µg/m³); P(>90) Brier 0.0678 vs climatology 0.1402 (skill +51.6%); P(>120) Brier 0.0441 vs climatology 0.0726 (skill +39.3%); P(>250) Brier 0.0034 vs climatology 0.0034 (skill +0.5%)
- **+48h**: 80% PI empirical coverage 0.725 (mean width 58.3 µg/m³); P(>90) Brier 0.0846 vs climatology 0.1407 (skill +39.9%); P(>120) Brier 0.0532 vs climatology 0.073 (skill +27.2%); P(>250) Brier 0.0036 vs climatology 0.0035 (skill -2.8%)
- **+72h**: 80% PI empirical coverage 0.698 (mean width 60.8 µg/m³); P(>90) Brier 0.0871 vs climatology 0.1417 (skill +38.5%); P(>120) Brier 0.0559 vs climatology 0.0733 (skill +23.8%); P(>250) Brier 0.0036 vs climatology 0.0035 (skill -3.0%)

## Meteorology ablation

- +24h: RMSE with ERA5 met 29.52 vs without 31.79 → met contributes 7.1%
- +48h: RMSE with ERA5 met 34.9 vs without 37.72 → met contributes 7.5%
- +72h: RMSE with ERA5 met 38.9 vs without 41.05 → met contributes 5.2%

_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._