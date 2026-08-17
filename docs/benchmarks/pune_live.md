# Forecast benchmark — pune (live)

Window 2026-07-12 → 2026-08-16, test from **2026-08-07** (single temporal split; train strictly before each test origin). 9 station cells, 5,874 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T13:11Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 1,000 | 7.87 | 8.43 | 6.66 | **6.5** | +17.4% |
| non_winter | 24 | 1,000 | 7.87 | 8.43 | 6.66 | **6.5** | +17.4% |
| full_test | 48 | 853 | 7.73 | 8.02 | 6.5 | **6.29** | +18.6% |
| non_winter | 48 | 853 | 7.73 | 8.02 | 6.5 | **6.29** | +18.6% |
| full_test | 72 | 702 | 8.81 | 8.26 | 6.15 | **5.93** | +32.7% |
| non_winter | 72 | 702 | 8.81 | 8.26 | 6.15 | **5.93** | +32.7% |

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| very_poor (>120) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 48 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| very_poor (>120) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 72 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| very_poor (>120) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.741 (mean width 13.7 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.782 (mean width 14.4 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.848 (mean width 16.4 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._