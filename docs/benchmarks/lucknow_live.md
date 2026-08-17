# Forecast benchmark — lucknow (live)

Window 2026-07-12 → 2026-08-16, test from **2026-08-07** (single temporal split; train strictly before each test origin). 5 station cells, 3,953 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T17:29Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 685 | 19.41 | 52.59 | 15.13 | **14.29** | +26.4% | 14.29 | +26.4% |
| non_winter | 24 | 685 | 19.41 | 52.59 | 15.13 | **14.29** | +26.4% | 14.29 | +26.4% |
| full_test | 48 | 581 | 21.03 | 23.81 | 15.39 | **15.96** | +24.1% | 15.96 | +24.1% |
| non_winter | 48 | 581 | 21.03 | 23.81 | 15.39 | **15.96** | +24.1% | 15.96 | +24.1% |
| full_test | 72 | 480 | 21.79 | 24.73 | 15.91 | **16.81** | +22.9% | 16.81 | +22.9% |
| non_winter | 72 | 480 | 21.79 | 24.73 | 15.91 | **16.81** | +22.9% | 16.81 | +22.9% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [1.0]; +48h [1.0]; +72h [1.0]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 1 | 160.0 | 158.75 | **153.95** | +3.8% |
| observed_over_120 | 24 | 1 | 160.0 | 158.75 | **153.95** | +3.8% |
| observed_over_90 | 48 | 1 | 140.2 | 158.75 | **151.12** | -7.8% |
| observed_over_120 | 48 | 1 | 140.2 | 158.75 | **151.12** | -7.8% |
| observed_over_90 | 72 | 1 | 145.7 | 158.75 | **149.76** | -2.8% |
| observed_over_120 | 72 | 1 | 145.7 | 158.75 | **149.76** | -2.8% |

## Probability alarms — alarm = P(> band) ≥ τ (operating points on the calibrated probability)

| band | h | τ | precision | recall | F1 | onset recall |
|---|---:|---:|---:|---:|---:|---:|
| poor | 24 | 0.2 | None | 0.0 | None | 0.0 |
| poor | 24 | 0.3 | None | 0.0 | None | 0.0 |
| poor | 24 | 0.4 | None | 0.0 | None | 0.0 |
| poor | 24 | 0.5 | None | 0.0 | None | 0.0 |
| very_poor | 24 | 0.2 | None | 0.0 | None | 0.0 |
| very_poor | 24 | 0.3 | None | 0.0 | None | 0.0 |
| very_poor | 24 | 0.4 | None | 0.0 | None | 0.0 |
| very_poor | 24 | 0.5 | None | 0.0 | None | 0.0 |
| severe | 24 | 0.2 | None | None | None | None |
| severe | 24 | 0.3 | None | None | None | None |
| severe | 24 | 0.4 | None | None | None | None |
| severe | 24 | 0.5 | None | None | None | None |
| poor | 48 | 0.2 | None | 0.0 | None | 0.0 |
| poor | 48 | 0.3 | None | 0.0 | None | 0.0 |
| poor | 48 | 0.4 | None | 0.0 | None | 0.0 |
| poor | 48 | 0.5 | None | 0.0 | None | 0.0 |
| very_poor | 48 | 0.2 | None | 0.0 | None | 0.0 |
| very_poor | 48 | 0.3 | None | 0.0 | None | 0.0 |
| very_poor | 48 | 0.4 | None | 0.0 | None | 0.0 |
| very_poor | 48 | 0.5 | None | 0.0 | None | 0.0 |
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
| severe | 72 | 0.2 | None | None | None | None |
| severe | 72 | 0.3 | None | None | None | None |
| severe | 72 | 0.4 | None | None | None | None |
| severe | 72 | 0.5 | None | None | None | None |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 1 | None/0.0/None | 0.0/0.0/0.0 | 1 | 0.0 | 0.0 |
| very_poor (>120) | 24 | 1 | None/0.0/None | 0.0/0.0/0.0 | 1 | 0.0 | 0.0 |
| severe (>250) | 24 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| poor (>90) | 48 | 1 | None/0.0/None | 0.0/0.0/0.0 | 1 | 0.0 | 0.0 |
| very_poor (>120) | 48 | 1 | None/0.0/None | 0.0/0.0/0.0 | 1 | 0.0 | 0.0 |
| severe (>250) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 72 | 1 | None/0.0/None | 0.0/0.0/0.0 | 1 | 0.0 | 0.0 |
| very_poor (>120) | 72 | 1 | None/0.0/None | 0.0/0.0/0.0 | 1 | 0.0 | 0.0 |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.809 (mean width 33.0 µg/m³); P(>90) Brier 0.0019 vs climatology 0.0015 (skill -31.1%); P(>120) Brier 0.0018 vs climatology 0.0015 (skill -21.2%); P(>250) Brier 0.0002 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.792 (mean width 35.5 µg/m³); P(>90) Brier 0.0018 vs climatology 0.0017 (skill -2.2%); P(>120) Brier 0.0017 vs climatology 0.0017 (skill -1.3%); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.752 (mean width 33.8 µg/m³); P(>90) Brier 0.0021 vs climatology 0.0021 (skill -3.0%); P(>120) Brier 0.0021 vs climatology 0.0021 (skill -1.2%); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._