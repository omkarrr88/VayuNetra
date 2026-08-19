# Forecast benchmark — pune (live)

Window 2026-07-12 → 2026-08-19, test from **2026-08-09** (single temporal split; train strictly before each test origin). 10 station cells, 6,220 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-19T14:52Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 902 | 7.76 | 8.48 | 6.64 | **6.42** | +17.3% | 6.3 | +18.8% |
| non_winter | 24 | 902 | 7.76 | 8.48 | 6.64 | **6.42** | +17.3% | 6.3 | +18.8% |
| full_test | 48 | 769 | 7.85 | 9.0 | 6.88 | **6.64** | +15.4% | 6.69 | +14.8% |
| non_winter | 48 | 769 | 7.85 | 9.0 | 6.88 | **6.64** | +15.4% | 6.69 | +14.8% |
| full_test | 72 | 619 | 9.41 | 9.87 | 7.17 | **7.05** | +25.0% | 6.88 | +26.8% |
| non_winter | 72 | 619 | 9.41 | 9.87 | 7.17 | **7.05** | +25.0% | 6.88 | +26.8% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.65]; +48h [0.7]; +72h [0.8]

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
| poor (>90) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| very_poor (>120) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| very_poor (>120) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |
| very_poor (>120) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.774 (mean width 15.0 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.795 (mean width 15.5 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.75 (mean width 15.0 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._