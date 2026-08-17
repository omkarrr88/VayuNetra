# Forecast benchmark — bengaluru (live)

Window 2026-05-21 → 2026-08-17, test from **2026-07-26** (single temporal split; train strictly before each test origin). 13 station cells, 9,094 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T17:27Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 708 | 7.85 | 7.56 | 7.71 | **6.72** | +14.3% | 6.59 | +16.0% |
| non_winter | 24 | 708 | 7.85 | 7.56 | 7.71 | **6.72** | +14.3% | 6.59 | +16.0% |
| full_test | 48 | 672 | 13.82 | 7.41 | 7.65 | **8.41** | +39.1% | 7.06 | +48.9% |
| non_winter | 48 | 672 | 13.82 | 7.41 | 7.65 | **8.41** | +39.1% | 7.06 | +48.9% |
| full_test | 72 | 702 | 13.79 | 7.58 | 7.83 | **7.36** | +46.7% | 6.67 | +51.6% |
| non_winter | 72 | 702 | 13.79 | 7.58 | 7.83 | **7.36** | +46.7% | 6.67 | +51.6% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.65]; +48h [0.55]; +72h [0.7]

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
| poor (>90) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| very_poor (>120) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 48 | 0 | 0.0/None/None | 0.0/None/None | 0 | None | None |
| very_poor (>120) | 48 | 0 | 0.0/None/None | 0.0/None/None | 0 | None | None |
| severe (>250) | 48 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| poor (>90) | 72 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| very_poor (>120) | 72 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.823 (mean width 16.9 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.832 (mean width 17.5 µg/m³); P(>90) Brier 0.0015 vs climatology 0.0 (skill –); P(>120) Brier 0.0011 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.862 (mean width 20.1 µg/m³); P(>90) Brier 0.0002 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._