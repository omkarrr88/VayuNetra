# Forecast benchmark — bengaluru (live)

Window 2026-05-23 → 2026-08-20, test from **2026-07-29** (single temporal split; train strictly before each test origin). 14 station cells, 9,492 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-20T04:10Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 831 | 7.76 | 7.53 | 8.33 | **6.8** | +12.4% | 6.46 | +16.8% |
| non_winter | 24 | 831 | 7.76 | 7.53 | 8.33 | **6.8** | +12.4% | 6.46 | +16.8% |
| full_test | 48 | 775 | 13.31 | 7.78 | 8.31 | **8.47** | +36.4% | 7.39 | +44.5% |
| non_winter | 48 | 775 | 13.31 | 7.78 | 8.31 | **8.47** | +36.4% | 7.39 | +44.5% |
| full_test | 72 | 809 | 13.51 | 8.03 | 8.43 | **7.94** | +41.3% | 7.16 | +47.0% |
| non_winter | 72 | 809 | 13.51 | 8.03 | 8.43 | **7.94** | +41.3% | 7.16 | +47.0% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.45]; +48h [0.55]; +72h [0.65]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|

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
| poor | 48 | 0.2 | 0.0 | None | None | None |
| poor | 48 | 0.3 | 0.0 | None | None | None |
| poor | 48 | 0.4 | 0.0 | None | None | None |
| poor | 48 | 0.5 | 0.0 | None | None | None |
| very_poor | 48 | 0.2 | 0.0 | None | None | None |
| very_poor | 48 | 0.3 | 0.0 | None | None | None |
| very_poor | 48 | 0.4 | 0.0 | None | None | None |
| very_poor | 48 | 0.5 | 0.0 | None | None | None |
| severe | 48 | 0.2 | None | None | None | None |
| severe | 48 | 0.3 | None | None | None | None |
| severe | 48 | 0.4 | None | None | None | None |
| severe | 48 | 0.5 | None | None | None | None |
| poor | 72 | 0.2 | 0.0 | None | None | None |
| poor | 72 | 0.3 | 0.0 | None | None | None |
| poor | 72 | 0.4 | 0.0 | None | None | None |
| poor | 72 | 0.5 | 0.0 | None | None | None |
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
| poor (>90) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| very_poor (>120) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 48 | 0 | 0.0/None/None | 0.0/None/None | 0 | None | None |
| very_poor (>120) | 48 | 0 | 0.0/None/None | 0.0/None/None | 0 | None | None |
| severe (>250) | 48 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| poor (>90) | 72 | 0 | 0.0/None/None | 0.0/None/None | 0 | None | None |
| very_poor (>120) | 72 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.828 (mean width 17.4 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.839 (mean width 17.4 µg/m³); P(>90) Brier 0.0013 vs climatology 0.0 (skill –); P(>120) Brier 0.001 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.797 (mean width 17.5 µg/m³); P(>90) Brier 0.0011 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._