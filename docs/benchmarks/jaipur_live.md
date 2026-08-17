# Forecast benchmark — jaipur (live)

Window 2026-07-12 → 2026-08-16, test from **2026-08-07** (single temporal split; train strictly before each test origin). 6 station cells, 4,645 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T13:18Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 723 | 14.26 | 18.0 | 14.4 | **14.23** | +0.3% |
| non_winter | 24 | 723 | 14.26 | 18.0 | 14.4 | **14.23** | +0.3% |
| full_test | 48 | 634 | 16.64 | 18.64 | 14.82 | **15.89** | +4.5% |
| non_winter | 48 | 634 | 16.64 | 18.64 | 14.82 | **15.89** | +4.5% |
| full_test | 72 | 497 | 17.64 | 19.37 | 15.47 | **18.12** | -2.7% |
| non_winter | 72 | 497 | 17.64 | 19.37 | 15.47 | **18.12** | -2.7% |

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 2 | 48.46 | 43.35 | **73.08** | -50.8% |
| observed_over_90 | 48 | 2 | 67.6 | 43.35 | **75.77** | -12.1% |
| observed_over_90 | 72 | 2 | 90.23 | 43.35 | **74.15** | +17.8% |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 2 | None/0.0/None | None/0.0/None | 2 | 0.0 | 0.0 |
| very_poor (>120) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 48 | 2 | None/0.0/None | 0.0/0.0/0.0 | 2 | 0.0 | 0.0 |
| very_poor (>120) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 72 | 2 | None/0.0/None | 0.0/0.0/0.0 | 2 | 0.0 | 0.0 |
| very_poor (>120) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.855 (mean width 38.1 µg/m³); P(>90) Brier 0.0028 vs climatology 0.0028 (skill -0.3%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.809 (mean width 36.0 µg/m³); P(>90) Brier 0.0032 vs climatology 0.0031 (skill -0.4%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.718 (mean width 36.8 µg/m³); P(>90) Brier 0.004 vs climatology 0.004 (skill -0.2%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._