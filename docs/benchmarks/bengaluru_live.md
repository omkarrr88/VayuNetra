# Forecast benchmark — bengaluru (live)

Window 2026-05-22 → 2026-08-19, test from **2026-07-28** (single temporal split; train strictly before each test origin). 13 station cells, 9,218 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-19T14:52Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 809 | 7.73 | 7.67 | 8.27 | **6.81** | +11.9% | 6.62 | +14.3% |
| non_winter | 24 | 809 | 7.73 | 7.67 | 8.27 | **6.81** | +11.9% | 6.62 | +14.3% |
| full_test | 48 | 753 | 13.44 | 7.86 | 8.37 | **8.86** | +34.1% | 7.49 | +44.3% |
| non_winter | 48 | 753 | 13.44 | 7.86 | 8.37 | **8.86** | +34.1% | 7.49 | +44.3% |
| full_test | 72 | 786 | 13.56 | 8.04 | 8.45 | **7.93** | +41.5% | 7.11 | +47.5% |
| non_winter | 72 | 786 | 13.56 | 8.04 | 8.45 | **7.93** | +41.5% | 7.11 | +47.5% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.5]; +48h [0.5]; +72h [0.65]

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

- **+24h**: 80% PI empirical coverage 0.842 (mean width 17.2 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.826 (mean width 17.8 µg/m³); P(>90) Brier 0.0013 vs climatology 0.0 (skill –); P(>120) Brier 0.0013 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.804 (mean width 18.1 µg/m³); P(>90) Brier 0.0012 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._