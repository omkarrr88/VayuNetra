# Forecast benchmark — ahmedabad (live)

Window 2026-07-12 → 2026-08-16, test from **2026-08-07** (single temporal split; train strictly before each test origin). 6 station cells, 3,951 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T13:15Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 599 | 19.08 | 20.05 | 20.37 | **17.07** | +10.5% |
| non_winter | 24 | 599 | 19.08 | 20.05 | 20.37 | **17.07** | +10.5% |
| full_test | 48 | 498 | 19.44 | 19.39 | 20.78 | **18.59** | +4.4% |
| non_winter | 48 | 498 | 19.44 | 19.39 | 20.78 | **18.59** | +4.4% |
| full_test | 72 | 425 | 19.71 | 19.33 | 21.51 | **19.86** | -0.8% |
| non_winter | 72 | 425 | 19.71 | 19.33 | 21.51 | **19.86** | -0.8% |

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 9 | 55.37 | 63.18 | **63.24** | -14.2% |
| observed_over_90 | 48 | 7 | 58.65 | 56.54 | **68.69** | -17.1% |
| observed_over_90 | 72 | 5 | 58.98 | 54.56 | **63.26** | -7.3% |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 9 | None/0.0/None | 0.0/0.0/0.0 | 9 | 0.0 | 0.0 |
| very_poor (>120) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 48 | 7 | None/0.0/None | 0.0/0.0/0.0 | 7 | 0.0 | 0.0 |
| very_poor (>120) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 72 | 5 | None/0.0/None | 0.0/0.0/0.0 | 5 | 0.0 | 0.0 |
| very_poor (>120) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.785 (mean width 42.7 µg/m³); P(>90) Brier 0.0148 vs climatology 0.0148 (skill +0.3%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.821 (mean width 49.4 µg/m³); P(>90) Brier 0.0142 vs climatology 0.0139 (skill -2.5%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.755 (mean width 45.5 µg/m³); P(>90) Brier 0.0117 vs climatology 0.0116 (skill -0.8%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._