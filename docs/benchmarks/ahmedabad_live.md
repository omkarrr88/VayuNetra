# Forecast benchmark — ahmedabad (live)

Window 2026-07-12 → 2026-08-19, test from **2026-08-10** (single temporal split; train strictly before each test origin). 8 station cells, 4,218 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-19T14:53Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 490 | 19.39 | 19.59 | 21.99 | **17.04** | +12.1% | 17.79 | +8.2% |
| non_winter | 24 | 490 | 19.39 | 19.59 | 21.99 | **17.04** | +12.1% | 17.79 | +8.2% |
| full_test | 48 | 407 | 19.02 | 19.8 | 20.85 | **16.64** | +12.5% | 17.96 | +5.6% |
| non_winter | 48 | 407 | 19.02 | 19.8 | 20.85 | **16.64** | +12.5% | 17.96 | +5.6% |
| full_test | 72 | 336 | 20.4 | 20.46 | 20.86 | **17.5** | +14.2% | 19.2 | +5.9% |
| non_winter | 72 | 336 | 20.4 | 20.46 | 20.86 | **17.5** | +14.2% | 19.2 | +5.9% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.55]; +48h [0.55]; +72h [0.65]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 8 | 56.15 | 51.06 | **60.47** | -7.7% |
| observed_over_90 | 48 | 5 | 58.68 | 53.23 | **67.43** | -14.9% |
| observed_over_90 | 72 | 5 | 54.4 | 51.15 | **59.75** | -9.8% |

## Probability alarms — alarm = P(> band) ≥ τ (operating points on the calibrated probability)

| band | h | τ | precision | recall | F1 | onset recall |
|---|---:|---:|---:|---:|---:|---:|
| poor | 24 | 0.2 | 0.0 | 0.0 | 0.0 | 0.0 |
| poor | 24 | 0.3 | None | 0.0 | None | 0.0 |
| poor | 24 | 0.4 | None | 0.0 | None | 0.0 |
| poor | 24 | 0.5 | None | 0.0 | None | 0.0 |
| very_poor | 24 | 0.2 | None | None | None | None |
| very_poor | 24 | 0.3 | None | None | None | None |
| very_poor | 24 | 0.4 | None | None | None | None |
| very_poor | 24 | 0.5 | None | None | None | None |
| severe | 24 | 0.2 | None | None | None | None |
| severe | 24 | 0.3 | None | None | None | None |
| severe | 24 | 0.4 | None | None | None | None |
| severe | 24 | 0.5 | None | None | None | None |
| poor | 48 | 0.2 | 0.0 | 0.0 | 0.0 | 0.0 |
| poor | 48 | 0.3 | 0.0 | 0.0 | 0.0 | 0.0 |
| poor | 48 | 0.4 | None | 0.0 | None | 0.0 |
| poor | 48 | 0.5 | None | 0.0 | None | 0.0 |
| very_poor | 48 | 0.2 | None | None | None | None |
| very_poor | 48 | 0.3 | None | None | None | None |
| very_poor | 48 | 0.4 | None | None | None | None |
| very_poor | 48 | 0.5 | None | None | None | None |
| severe | 48 | 0.2 | None | None | None | None |
| severe | 48 | 0.3 | None | None | None | None |
| severe | 48 | 0.4 | None | None | None | None |
| severe | 48 | 0.5 | None | None | None | None |
| poor | 72 | 0.2 | 0.0 | 0.0 | 0.0 | 0.0 |
| poor | 72 | 0.3 | None | 0.0 | None | 0.0 |
| poor | 72 | 0.4 | None | 0.0 | None | 0.0 |
| poor | 72 | 0.5 | None | 0.0 | None | 0.0 |
| very_poor | 72 | 0.2 | None | None | None | None |
| very_poor | 72 | 0.3 | None | None | None | None |
| very_poor | 72 | 0.4 | None | None | None | None |
| very_poor | 72 | 0.5 | None | None | None | None |
| severe | 72 | 0.2 | None | None | None | None |
| severe | 72 | 0.3 | None | None | None | None |
| severe | 72 | 0.4 | None | None | None | None |
| severe | 72 | 0.5 | None | None | None | None |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 8 | None/0.0/None | 0.0/0.0/0.0 | 8 | 0.0 | 0.0 |
| very_poor (>120) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 48 | 5 | None/0.0/None | 0.0/0.0/0.0 | 5 | 0.0 | 0.0 |
| very_poor (>120) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 72 | 5 | None/0.0/None | 0.0/0.0/0.0 | 5 | 0.0 | 0.0 |
| very_poor (>120) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.712 (mean width 41.7 µg/m³); P(>90) Brier 0.0175 vs climatology 0.0161 (skill -8.7%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.776 (mean width 43.8 µg/m³); P(>90) Brier 0.0133 vs climatology 0.0121 (skill -9.6%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.801 (mean width 45.9 µg/m³); P(>90) Brier 0.0152 vs climatology 0.0147 (skill -3.9%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._