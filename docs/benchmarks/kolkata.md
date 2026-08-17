# Forecast benchmark — kolkata (hist)

Window 2025-02-18 → 2026-08-15, test from **2025-11-01** (rolling-origin monthly refit, 90-day training window; train strictly before each test origin). 10 station cells, 114,182 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T17:14Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence | model+persistence blend | blend skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 53,066 | 33.75 | 39.31 | 51.75 | **29.52** | +12.5% | 29.0 | +14.1% |
| winter_nov_feb | 24 | 20,966 | 45.94 | 54.27 | 78.59 | **41.39** | +9.9% | 40.26 | +12.4% |
| non_winter | 24 | 32,100 | 22.46 | 25.13 | 19.8 | **17.94** | +20.1% | 18.22 | +18.9% |
| full_test | 48 | 53,396 | 37.33 | 39.5 | 51.83 | **34.9** | +6.5% | 33.76 | +9.6% |
| winter_nov_feb | 48 | 21,427 | 51.99 | 54.43 | 78.4 | **47.51** | +8.6% | 45.25 | +13.0% |
| non_winter | 48 | 31,969 | 22.72 | 24.91 | 19.17 | **22.83** | -0.5% | 23.05 | -1.5% |
| full_test | 72 | 53,420 | 38.64 | 40.06 | 51.91 | **38.9** | -0.7% | 35.07 | +9.2% |
| winter_nov_feb | 72 | 21,697 | 53.16 | 55.16 | 78.15 | **55.95** | -5.3% | 48.73 | +8.3% |
| non_winter | 72 | 31,723 | 24.11 | 24.93 | 19.0 | **20.18** | +16.3% | 21.14 | +12.3% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.7, 0.6, 0.7, 0.95, 0.75, 0.05, 0.65, 0.65, 1.0, 1.0]; +48h [0.8, 0.45, 0.85, 0.95, 0.95, 0.2, 0.9, 0.6, 1.0, 0.75]; +72h [0.85, 0.5, 0.8, 0.8, 1.0, 0.2, 1.0, 0.6, 1.0, 0.85]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 8,953 | 66.15 | 73.1 | **62.82** | +5.0% |
| observed_over_120 | 24 | 4,180 | 85.31 | 94.19 | **86.96** | -1.9% |
| observed_over_250 | 24 | 183 | 304.24 | 327.59 | **324.56** | -6.7% |
| observed_over_90 | 48 | 9,048 | 71.51 | 73.02 | **70.87** | +0.9% |
| observed_over_120 | 48 | 4,235 | 89.07 | 93.99 | **96.56** | -8.4% |
| observed_over_250 | 48 | 185 | 316.32 | 323.18 | **334.29** | -5.7% |
| observed_over_90 | 72 | 9,133 | 71.25 | 75.46 | **83.11** | -16.7% |
| observed_over_120 | 72 | 4,256 | 91.58 | 97.23 | **112.57** | -22.9% |
| observed_over_250 | 72 | 188 | 313.71 | 317.7 | **356.06** | -13.5% |

## Probability alarms — alarm = P(> band) ≥ τ (operating points on the calibrated probability)

| band | h | τ | precision | recall | F1 | onset recall |
|---|---:|---:|---:|---:|---:|---:|
| poor | 24 | 0.2 | 0.552 | 0.904 | 0.686 | 0.671 |
| poor | 24 | 0.3 | 0.622 | 0.836 | 0.713 | 0.463 |
| poor | 24 | 0.4 | 0.677 | 0.768 | 0.719 | 0.295 |
| poor | 24 | 0.5 | 0.723 | 0.687 | 0.705 | 0.158 |
| very_poor | 24 | 0.2 | 0.473 | 0.722 | 0.571 | 0.398 |
| very_poor | 24 | 0.3 | 0.555 | 0.595 | 0.574 | 0.21 |
| very_poor | 24 | 0.4 | 0.605 | 0.501 | 0.548 | 0.119 |
| very_poor | 24 | 0.5 | 0.639 | 0.425 | 0.51 | 0.06 |
| severe | 24 | 0.2 | None | 0.0 | None | 0.0 |
| severe | 24 | 0.3 | None | 0.0 | None | 0.0 |
| severe | 24 | 0.4 | None | 0.0 | None | 0.0 |
| severe | 24 | 0.5 | None | 0.0 | None | 0.0 |
| poor | 48 | 0.2 | 0.443 | 0.853 | 0.583 | 0.643 |
| poor | 48 | 0.3 | 0.549 | 0.745 | 0.632 | 0.429 |
| poor | 48 | 0.4 | 0.636 | 0.615 | 0.626 | 0.212 |
| poor | 48 | 0.5 | 0.697 | 0.515 | 0.592 | 0.115 |
| very_poor | 48 | 0.2 | 0.42 | 0.592 | 0.492 | 0.355 |
| very_poor | 48 | 0.3 | 0.495 | 0.441 | 0.466 | 0.176 |
| very_poor | 48 | 0.4 | 0.549 | 0.347 | 0.425 | 0.092 |
| very_poor | 48 | 0.5 | 0.601 | 0.3 | 0.4 | 0.053 |
| severe | 48 | 0.2 | None | 0.0 | None | 0.0 |
| severe | 48 | 0.3 | None | 0.0 | None | 0.0 |
| severe | 48 | 0.4 | None | 0.0 | None | 0.0 |
| severe | 48 | 0.5 | None | 0.0 | None | 0.0 |
| poor | 72 | 0.2 | 0.534 | 0.791 | 0.638 | 0.553 |
| poor | 72 | 0.3 | 0.613 | 0.564 | 0.587 | 0.245 |
| poor | 72 | 0.4 | 0.652 | 0.386 | 0.485 | 0.122 |
| poor | 72 | 0.5 | 0.697 | 0.281 | 0.4 | 0.067 |
| very_poor | 72 | 0.2 | 0.462 | 0.38 | 0.417 | 0.155 |
| very_poor | 72 | 0.3 | 0.524 | 0.223 | 0.312 | 0.059 |
| very_poor | 72 | 0.4 | 0.551 | 0.133 | 0.214 | 0.032 |
| very_poor | 72 | 0.5 | 0.565 | 0.082 | 0.143 | 0.019 |
| severe | 72 | 0.2 | None | 0.0 | None | 0.0 |
| severe | 72 | 0.3 | None | 0.0 | None | 0.0 |
| severe | 72 | 0.4 | None | 0.0 | None | 0.0 |
| severe | 72 | 0.5 | None | 0.0 | None | 0.0 |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 8,953 | 0.72/0.666/0.692 | 0.711/0.712/0.712 | 2,576 | 0.13 | 0.0 |
| very_poor (>120) | 24 | 4,180 | 0.648/0.382/0.481 | 0.616/0.616/0.616 | 1,607 | 0.039 | 0.0 |
| severe (>250) | 24 | 183 | None/0.0/None | 0.223/0.219/0.221 | 143 | 0.0 | 0.0 |
| poor (>90) | 48 | 9,048 | 0.648/0.473/0.547 | 0.64/0.639/0.64 | 3,262 | 0.133 | 0.0 |
| very_poor (>120) | 48 | 4,235 | 0.551/0.235/0.33 | 0.524/0.523/0.524 | 2,020 | 0.042 | 0.0 |
| severe (>250) | 48 | 185 | None/0.0/None | 0.182/0.178/0.18 | 152 | 0.0 | 0.0 |
| poor (>90) | 72 | 9,133 | 0.563/0.289/0.382 | 0.621/0.62/0.621 | 3,467 | 0.153 | 0.0 |
| very_poor (>120) | 72 | 4,256 | 0.382/0.081/0.133 | 0.496/0.499/0.497 | 2,134 | 0.05 | 0.0 |
| severe (>250) | 72 | 188 | None/0.0/None | 0.181/0.17/0.175 | 156 | 0.0 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.748 (mean width 51.3 µg/m³); P(>90) Brier 0.068 vs climatology 0.1402 (skill +51.5%); P(>120) Brier 0.0467 vs climatology 0.0726 (skill +35.6%); P(>250) Brier 0.0033 vs climatology 0.0034 (skill +4.1%)
- **+48h**: 80% PI empirical coverage 0.725 (mean width 58.3 µg/m³); P(>90) Brier 0.0866 vs climatology 0.1407 (skill +38.5%); P(>120) Brier 0.0543 vs climatology 0.073 (skill +25.7%); P(>250) Brier 0.0033 vs climatology 0.0035 (skill +3.5%)
- **+72h**: 80% PI empirical coverage 0.698 (mean width 60.8 µg/m³); P(>90) Brier 0.094 vs climatology 0.1417 (skill +33.7%); P(>120) Brier 0.0591 vs climatology 0.0733 (skill +19.4%); P(>250) Brier 0.0035 vs climatology 0.0035 (skill +0.7%)

## Meteorology ablation

- +24h: RMSE with ERA5 met 29.52 vs without 31.79 → met contributes 7.1%
- +48h: RMSE with ERA5 met 34.9 vs without 37.72 → met contributes 7.5%
- +72h: RMSE with ERA5 met 38.9 vs without 41.05 → met contributes 5.2%

_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._