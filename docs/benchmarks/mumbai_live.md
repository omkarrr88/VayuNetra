# Forecast benchmark — mumbai (live)

Window 2026-05-21 → 2026-08-17, test from **2026-07-26** (single temporal split; train strictly before each test origin). 19 station cells, 10,445 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T17:49Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 865 | 7.75 | 14.11 | 10.66 | **6.95** | +10.4% | 7.21 | +7.0% |
| non_winter | 24 | 865 | 7.75 | 14.11 | 10.66 | **6.95** | +10.4% | 7.21 | +7.0% |
| full_test | 48 | 806 | 8.23 | 14.4 | 10.45 | **7.04** | +14.4% | 7.26 | +11.8% |
| non_winter | 48 | 806 | 8.23 | 14.4 | 10.45 | **7.04** | +14.4% | 7.26 | +11.8% |
| full_test | 72 | 767 | 13.48 | 18.23 | 14.56 | **12.74** | +5.5% | 12.77 | +5.3% |
| non_winter | 72 | 767 | 13.48 | 18.23 | 14.56 | **12.74** | +5.5% | 12.77 | +5.3% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.4]; +48h [0.5]; +72h [0.55]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 72 | 2 | 217.15 | 218.0 | **217.24** | -0.0% |
| observed_over_120 | 72 | 2 | 217.15 | 218.0 | **217.24** | -0.0% |
| observed_over_250 | 72 | 1 | 253.3 | 255.05 | **253.47** | -0.1% |

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

- **+24h**: 80% PI empirical coverage 0.723 (mean width 16.3 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.697 (mean width 18.9 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.795 (mean width 21.4 µg/m³); P(>90) Brier 0.0026 vs climatology 0.0026 (skill -0.3%); P(>120) Brier 0.0026 vs climatology 0.0026 (skill -0.3%); P(>250) Brier 0.0013 vs climatology 0.0013 (skill -0.1%)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._