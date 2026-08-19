# Forecast benchmark — mumbai (live)

Window 2026-05-22 → 2026-08-19, test from **2026-07-28** (single temporal split; train strictly before each test origin). 21 station cells, 10,595 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-19T11:50Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 929 | 7.47 | 13.74 | 10.02 | **6.52** | +12.6% | 6.75 | +9.6% |
| non_winter | 24 | 929 | 7.47 | 13.74 | 10.02 | **6.52** | +12.6% | 6.75 | +9.6% |
| full_test | 48 | 863 | 8.12 | 14.02 | 9.37 | **6.8** | +16.3% | 6.69 | +17.6% |
| non_winter | 48 | 863 | 8.12 | 14.02 | 9.37 | **6.8** | +16.3% | 6.69 | +17.6% |
| full_test | 72 | 815 | 13.18 | 17.79 | 13.87 | **12.56** | +4.7% | 12.54 | +4.9% |
| non_winter | 72 | 815 | 13.18 | 17.79 | 13.87 | **12.56** | +4.7% | 12.54 | +4.9% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.65]; +48h [0.55]; +72h [0.55]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 72 | 2 | 217.15 | 218.0 | **217.78** | -0.3% |
| observed_over_120 | 72 | 2 | 217.15 | 218.0 | **217.78** | -0.3% |
| observed_over_250 | 72 | 1 | 253.3 | 255.05 | **254.07** | -0.3% |

## Probability alarms — alarm = P(> band) ≥ τ (operating points on the calibrated probability)

| band | h | τ | precision | recall | F1 | onset recall |
|---|---:|---:|---:|---:|---:|---:|
| poor | 24 | 0.2 | None | None | None | None |
| poor | 24 | 0.3 | None | None | None | None |
| poor | 24 | 0.4 | None | None | None | None |
| poor | 24 | 0.5 | None | None | None | None |
| very_poor | 24 | 0.2 | None | None | None | None |
| very_poor | 24 | 0.3 | None | None | None | None |
| very_poor | 24 | 0.4 | None | None | None | None |
| very_poor | 24 | 0.5 | None | None | None | None |
| severe | 24 | 0.2 | None | None | None | None |
| severe | 24 | 0.3 | None | None | None | None |
| severe | 24 | 0.4 | None | None | None | None |
| severe | 24 | 0.5 | None | None | None | None |
| poor | 48 | 0.2 | None | None | None | None |
| poor | 48 | 0.3 | None | None | None | None |
| poor | 48 | 0.4 | None | None | None | None |
| poor | 48 | 0.5 | None | None | None | None |
| very_poor | 48 | 0.2 | None | None | None | None |
| very_poor | 48 | 0.3 | None | None | None | None |
| very_poor | 48 | 0.4 | None | None | None | None |
| very_poor | 48 | 0.5 | None | None | None | None |
| severe | 48 | 0.2 | None | None | None | None |
| severe | 48 | 0.3 | None | None | None | None |
| severe | 48 | 0.4 | None | None | None | None |
| severe | 48 | 0.5 | None | None | None | None |
| poor | 72 | 0.2 | None | 0.0 | None | 0.0 |
| poor | 72 | 0.3 | None | 0.0 | None | 0.0 |
| poor | 72 | 0.4 | None | 0.0 | None | 0.0 |
| poor | 72 | 0.5 | None | 0.0 | None | 0.0 |
| very_poor | 72 | 0.2 | None | 0.0 | None | 0.0 |
| very_poor | 72 | 0.3 | None | 0.0 | None | 0.0 |
| very_poor | 72 | 0.4 | None | 0.0 | None | 0.0 |
| very_poor | 72 | 0.5 | None | 0.0 | None | 0.0 |
| severe | 72 | 0.2 | None | 0.0 | None | 0.0 |
| severe | 72 | 0.3 | None | 0.0 | None | 0.0 |
| severe | 72 | 0.4 | None | 0.0 | None | 0.0 |
| severe | 72 | 0.5 | None | 0.0 | None | 0.0 |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| very_poor (>120) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| very_poor (>120) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 72 | 2 | None/0.0/None | None/0.0/None | 2 | 0.0 | 0.0 |
| very_poor (>120) | 72 | 2 | None/0.0/None | None/0.0/None | 2 | 0.0 | 0.0 |
| severe (>250) | 72 | 1 | None/0.0/None | None/0.0/None | 1 | 0.0 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.681 (mean width 13.7 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.706 (mean width 17.6 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.827 (mean width 20.6 µg/m³); P(>90) Brier 0.0025 vs climatology 0.0024 (skill -0.2%); P(>120) Brier 0.0025 vs climatology 0.0024 (skill -0.2%); P(>250) Brier 0.0012 vs climatology 0.0012 (skill -0.1%)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._