# Forecast benchmark — ahmedabad (live)

Window 2026-07-12 → 2026-08-20, test from **2026-08-10** (single temporal split; train strictly before each test origin). 10 station cells, 4,470 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-20T04:11Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 561 | 19.54 | 19.98 | 21.62 | **16.66** | +14.7% | 16.76 | +14.2% |
| non_winter | 24 | 561 | 19.54 | 19.98 | 21.62 | **16.66** | +14.7% | 16.76 | +14.2% |
| full_test | 48 | 476 | 19.83 | 20.19 | 20.65 | **16.86** | +15.0% | 18.06 | +8.9% |
| non_winter | 48 | 476 | 19.83 | 20.19 | 20.65 | **16.86** | +15.0% | 18.06 | +8.9% |
| full_test | 72 | 420 | 19.16 | 20.24 | 19.96 | **16.9** | +11.8% | 18.79 | +1.9% |
| non_winter | 72 | 420 | 19.16 | 20.24 | 19.96 | **16.9** | +11.8% | 18.79 | +1.9% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.55]; +48h [0.55]; +72h [0.65]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 8 | 56.06 | 52.68 | **59.95** | -6.9% |
| observed_over_90 | 48 | 6 | 55.0 | 57.41 | **63.38** | -15.2% |
| observed_over_90 | 72 | 5 | 53.9 | 54.24 | **60.43** | -12.1% |

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
| poor | 72 | 0.3 | 0.0 | 0.0 | 0.0 | 0.0 |
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
| poor (>90) | 48 | 6 | None/0.0/None | 0.0/0.0/0.0 | 6 | 0.0 | 0.0 |
| very_poor (>120) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 72 | 5 | None/0.0/None | 0.0/0.0/0.0 | 5 | 0.0 | 0.0 |
| very_poor (>120) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.754 (mean width 40.0 µg/m³); P(>90) Brier 0.0149 vs climatology 0.0141 (skill -6.3%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.83 (mean width 50.0 µg/m³); P(>90) Brier 0.0136 vs climatology 0.0124 (skill -9.0%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.84 (mean width 49.7 µg/m³); P(>90) Brier 0.0124 vs climatology 0.0118 (skill -5.6%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._