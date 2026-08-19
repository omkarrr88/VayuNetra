# Forecast benchmark — lucknow (live)

Window 2026-07-12 → 2026-08-19, test from **2026-08-09** (single temporal split; train strictly before each test origin). 5 station cells, 4,123 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-19T11:51Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 354 | 21.93 | 24.85 | 16.79 | **16.15** | +26.4% | 16.15 | +26.4% |
| non_winter | 24 | 354 | 21.93 | 24.85 | 16.79 | **16.15** | +26.4% | 16.15 | +26.4% |
| full_test | 48 | 300 | 19.57 | 26.04 | 16.99 | **16.87** | +13.8% | 17.03 | +13.0% |
| non_winter | 48 | 300 | 19.57 | 26.04 | 16.99 | **16.87** | +13.8% | 17.03 | +13.0% |
| full_test | 72 | 220 | 21.91 | 19.87 | 15.21 | **14.55** | +33.6% | 14.31 | +34.7% |
| non_winter | 72 | 220 | 21.91 | 19.87 | 15.21 | **14.55** | +33.6% | 14.31 | +34.7% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [1.0]; +48h [0.9]; +72h [0.9]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 1 | 160.0 | 158.75 | **156.58** | +2.1% |
| observed_over_120 | 24 | 1 | 160.0 | 158.75 | **156.58** | +2.1% |
| observed_over_90 | 48 | 1 | 140.2 | 158.75 | **150.64** | -7.4% |
| observed_over_120 | 48 | 1 | 140.2 | 158.75 | **150.64** | -7.4% |

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
| poor | 72 | 0.2 | None | None | None | None |
| poor | 72 | 0.3 | None | None | None | None |
| poor | 72 | 0.4 | None | None | None | None |
| poor | 72 | 0.5 | None | None | None | None |
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
| poor (>90) | 24 | 1 | None/0.0/None | 0.0/0.0/0.0 | 1 | 0.0 | 0.0 |
| very_poor (>120) | 24 | 1 | None/0.0/None | 0.0/0.0/0.0 | 1 | 0.0 | 0.0 |
| severe (>250) | 24 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| poor (>90) | 48 | 1 | None/0.0/None | None/0.0/None | 1 | 0.0 | 0.0 |
| very_poor (>120) | 48 | 1 | None/0.0/None | None/0.0/None | 1 | 0.0 | 0.0 |
| severe (>250) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 72 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| very_poor (>120) | 72 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.766 (mean width 31.2 µg/m³); P(>90) Brier 0.0029 vs climatology 0.0028 (skill -1.2%); P(>120) Brier 0.0028 vs climatology 0.0028 (skill -0.5%); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.803 (mean width 33.8 µg/m³); P(>90) Brier 0.0033 vs climatology 0.0033 (skill -0.1%); P(>120) Brier 0.0033 vs climatology 0.0033 (skill -0.0%); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.836 (mean width 39.6 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._