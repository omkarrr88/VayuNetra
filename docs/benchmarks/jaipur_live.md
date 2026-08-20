# Forecast benchmark — jaipur (live)

Window 2026-07-12 → 2026-08-19, test from **2026-08-10** (single temporal split; train strictly before each test origin). 6 station cells, 5,058 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-20T04:11Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 812 | 16.11 | 20.53 | 14.7 | **14.43** | +10.4% | 15.0 | +6.8% |
| non_winter | 24 | 812 | 16.11 | 20.53 | 14.7 | **14.43** | +10.4% | 15.0 | +6.8% |
| full_test | 48 | 711 | 17.09 | 20.4 | 14.39 | **17.3** | -1.2% | 17.3 | -1.2% |
| non_winter | 48 | 711 | 17.09 | 20.4 | 14.39 | **17.3** | -1.2% | 17.3 | -1.2% |
| full_test | 72 | 597 | 18.64 | 20.72 | 15.43 | **19.01** | -2.0% | 19.72 | -5.8% |
| non_winter | 72 | 597 | 18.64 | 20.72 | 15.43 | **19.01** | -2.0% | 19.72 | -5.8% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.75]; +48h [1.0]; +72h [0.9]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 3 | 53.74 | 47.94 | **66.15** | -23.1% |
| observed_over_90 | 48 | 1 | 69.2 | 74.7 | **81.15** | -17.3% |
| observed_over_90 | 72 | 1 | 58.3 | 75.5 | **81.44** | -39.7% |

## Probability alarms — alarm = P(> band) ≥ τ (operating points on the calibrated probability)

| band | h | τ | precision | recall | F1 | onset recall |
|---|---:|---:|---:|---:|---:|---:|
| poor | 24 | 0.2 | None | 0.0 | None | 0.0 |
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
| poor | 48 | 0.2 | None | 0.0 | None | 0.0 |
| poor | 48 | 0.3 | None | 0.0 | None | 0.0 |
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
| poor | 72 | 0.2 | None | 0.0 | None | 0.0 |
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
| poor (>90) | 24 | 3 | None/0.0/None | 0.0/0.0/0.0 | 3 | 0.0 | 0.0 |
| very_poor (>120) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 48 | 1 | None/0.0/None | 0.0/0.0/0.0 | 1 | 0.0 | 0.0 |
| very_poor (>120) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 72 | 1 | None/0.0/None | 0.0/0.0/0.0 | 1 | 0.0 | 0.0 |
| very_poor (>120) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.825 (mean width 39.3 µg/m³); P(>90) Brier 0.0037 vs climatology 0.0037 (skill -0.7%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.807 (mean width 40.3 µg/m³); P(>90) Brier 0.0014 vs climatology 0.0014 (skill -2.5%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.65 (mean width 34.6 µg/m³); P(>90) Brier 0.0017 vs climatology 0.0017 (skill -0.3%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._