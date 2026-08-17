# Forecast benchmark — mumbai (live)

Window 2026-05-21 → 2026-08-17, test from **2026-07-26** (single temporal split; train strictly before each test origin). 19 station cells, 10,421 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T13:06Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 860 | 7.86 | 14.15 | 10.75 | **7.33** | +6.8% |
| non_winter | 24 | 860 | 7.86 | 14.15 | 10.75 | **7.33** | +6.8% |
| full_test | 48 | 804 | 8.23 | 14.4 | 10.56 | **7.55** | +8.3% |
| non_winter | 48 | 804 | 8.23 | 14.4 | 10.56 | **7.55** | +8.3% |
| full_test | 72 | 766 | 13.53 | 18.27 | 14.7 | **12.85** | +5.0% |
| non_winter | 72 | 766 | 13.53 | 18.27 | 14.7 | **12.85** | +5.0% |

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 72 | 2 | 217.15 | 218.0 | **217.29** | -0.1% |
| observed_over_120 | 72 | 2 | 217.15 | 218.0 | **217.29** | -0.1% |
| observed_over_250 | 72 | 1 | 253.3 | 255.05 | **253.33** | -0.0% |

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

- **+24h**: 80% PI empirical coverage 0.74 (mean width 17.9 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.728 (mean width 19.9 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.766 (mean width 21.1 µg/m³); P(>90) Brier 0.0026 vs climatology 0.0026 (skill -0.3%); P(>120) Brier 0.0026 vs climatology 0.0026 (skill -0.3%); P(>250) Brier 0.0013 vs climatology 0.0013 (skill -0.1%)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._