# Forecast benchmark — delhi (live)

Window 2026-06-20 → 2026-08-19, test from **2026-08-04** (single temporal split; train strictly before each test origin). 22 station cells, 10,632 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-19T14:50Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 1,823 | 15.0 | 18.82 | 16.94 | **13.14** | +12.4% | 13.48 | +10.2% |
| non_winter | 24 | 1,823 | 15.0 | 18.82 | 16.94 | **13.14** | +12.4% | 13.48 | +10.2% |
| full_test | 48 | 1,677 | 17.14 | 18.93 | 16.92 | **13.76** | +19.7% | 14.16 | +17.4% |
| non_winter | 48 | 1,677 | 17.14 | 18.93 | 16.92 | **13.76** | +19.7% | 14.16 | +17.4% |
| full_test | 72 | 1,544 | 18.6 | 19.7 | 16.93 | **15.42** | +17.1% | 15.33 | +17.6% |
| non_winter | 72 | 1,544 | 18.6 | 19.7 | 16.93 | **15.42** | +17.1% | 15.33 | +17.6% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.9]; +48h [0.75]; +72h [0.65]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 9 | 46.14 | 56.67 | **53.44** | -15.8% |
| observed_over_90 | 48 | 8 | 46.2 | 49.61 | **52.46** | -13.5% |
| observed_over_90 | 72 | 8 | 46.25 | 49.61 | **51.75** | -11.9% |

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
| poor | 72 | 0.2 | 0.0 | 0.0 | 0.0 | 0.0 |
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
| poor (>90) | 24 | 9 | None/0.0/None | 0.0/0.0/0.0 | 9 | 0.0 | 0.0 |
| very_poor (>120) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 48 | 8 | None/0.0/None | 0.0/0.0/0.0 | 8 | 0.0 | 0.0 |
| very_poor (>120) | 48 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| severe (>250) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 72 | 8 | None/0.0/None | 0.0/0.0/0.0 | 8 | 0.0 | 0.0 |
| very_poor (>120) | 72 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.794 (mean width 32.0 µg/m³); P(>90) Brier 0.0049 vs climatology 0.0049 (skill +0.3%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.769 (mean width 33.0 µg/m³); P(>90) Brier 0.0047 vs climatology 0.0047 (skill +0.2%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.727 (mean width 32.5 µg/m³); P(>90) Brier 0.0052 vs climatology 0.0052 (skill -0.3%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._