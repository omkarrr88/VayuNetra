# Forecast benchmark — ahmedabad (live)

Window 2026-07-12 → 2026-08-19, test from **2026-08-09** (single temporal split; train strictly before each test origin). 8 station cells, 4,204 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-19T11:51Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 490 | 19.7 | 19.51 | 21.81 | **17.4** | +11.7% | 17.96 | +8.8% |
| non_winter | 24 | 490 | 19.7 | 19.51 | 21.81 | **17.4** | +11.7% | 17.96 | +8.8% |
| full_test | 48 | 413 | 18.91 | 19.44 | 20.27 | **16.48** | +12.9% | 17.93 | +5.2% |
| non_winter | 48 | 413 | 18.91 | 19.44 | 20.27 | **16.48** | +12.9% | 17.93 | +5.2% |
| full_test | 72 | 337 | 20.38 | 20.38 | 20.29 | **17.28** | +15.2% | 18.77 | +7.9% |
| non_winter | 72 | 337 | 20.38 | 20.38 | 20.29 | **17.28** | +15.2% | 18.77 | +7.9% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.55]; +48h [0.55]; +72h [0.7]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 7 | 58.67 | 50.52 | **63.26** | -7.8% |
| observed_over_90 | 48 | 4 | 62.39 | 54.89 | **71.81** | -15.1% |
| observed_over_90 | 72 | 4 | 55.38 | 54.76 | **62.57** | -13.0% |

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
| poor (>90) | 24 | 7 | None/0.0/None | 0.0/0.0/0.0 | 7 | 0.0 | 0.0 |
| very_poor (>120) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 48 | 4 | None/0.0/None | 0.0/0.0/0.0 | 4 | 0.0 | 0.0 |
| very_poor (>120) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 72 | 4 | None/0.0/None | 0.0/0.0/0.0 | 4 | 0.0 | 0.0 |
| very_poor (>120) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.745 (mean width 42.3 µg/m³); P(>90) Brier 0.0158 vs climatology 0.0141 (skill -12.0%); P(>120) Brier 0.0001 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.777 (mean width 42.7 µg/m³); P(>90) Brier 0.0109 vs climatology 0.0096 (skill -13.3%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.81 (mean width 46.0 µg/m³); P(>90) Brier 0.0125 vs climatology 0.0117 (skill -6.6%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._