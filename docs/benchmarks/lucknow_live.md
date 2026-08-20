# Forecast benchmark — lucknow (live)

Window 2026-07-12 → 2026-08-20, test from **2026-08-10** (single temporal split; train strictly before each test origin). 6 station cells, 4,395 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-20T04:12Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 752 | 20.54 | 25.21 | 17.51 | **15.78** | +23.2% | 15.78 | +23.2% |
| non_winter | 24 | 752 | 20.54 | 25.21 | 17.51 | **15.78** | +23.2% | 15.78 | +23.2% |
| full_test | 48 | 653 | 21.22 | 25.14 | 17.42 | **16.79** | +20.9% | 16.66 | +21.5% |
| non_winter | 48 | 653 | 21.22 | 25.14 | 17.42 | **16.79** | +20.9% | 16.66 | +21.5% |
| full_test | 72 | 566 | 25.54 | 21.94 | 17.1 | **16.3** | +36.2% | 16.14 | +36.8% |
| non_winter | 72 | 566 | 25.54 | 21.94 | 17.1 | **16.3** | +36.2% | 16.14 | +36.8% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [1.0]; +48h [0.85]; +72h [0.95]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 2 | 148.85 | 136.21 | **145.84** | +2.0% |
| observed_over_120 | 24 | 2 | 148.85 | 136.21 | **145.84** | +2.0% |
| observed_over_90 | 48 | 2 | 125.14 | 92.47 | **110.49** | +11.7% |
| observed_over_120 | 48 | 1 | 147.17 | 109.1 | **131.52** | +10.6% |
| observed_over_90 | 72 | 2 | 116.48 | 91.27 | **109.29** | +6.2% |
| observed_over_120 | 72 | 1 | 144.5 | 115.8 | **129.75** | +10.2% |

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
| poor (>90) | 24 | 2 | None/0.0/None | 0.0/0.0/0.0 | 2 | 0.0 | 0.0 |
| very_poor (>120) | 24 | 2 | None/0.0/None | 0.0/0.0/0.0 | 2 | 0.0 | 0.0 |
| severe (>250) | 24 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| poor (>90) | 48 | 2 | None/0.0/None | 0.0/0.0/0.0 | 2 | 0.0 | 0.0 |
| very_poor (>120) | 48 | 1 | None/0.0/None | None/0.0/None | 1 | 0.0 | 0.0 |
| severe (>250) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 72 | 2 | None/0.0/None | 0.0/0.0/0.0 | 2 | 0.0 | 0.0 |
| very_poor (>120) | 72 | 1 | None/0.0/None | 0.0/0.0/0.0 | 1 | 0.0 | 0.0 |
| severe (>250) | 72 | 0 | None/None/None | 0.0/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.741 (mean width 30.1 µg/m³); P(>90) Brier 0.0027 vs climatology 0.0027 (skill -1.3%); P(>120) Brier 0.0027 vs climatology 0.0027 (skill -0.4%); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.749 (mean width 31.0 µg/m³); P(>90) Brier 0.0031 vs climatology 0.0031 (skill -0.1%); P(>120) Brier 0.0015 vs climatology 0.0015 (skill -0.5%); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.866 (mean width 36.5 µg/m³); P(>90) Brier 0.0035 vs climatology 0.0035 (skill +0.0%); P(>120) Brier 0.0018 vs climatology 0.0018 (skill -0.2%); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._