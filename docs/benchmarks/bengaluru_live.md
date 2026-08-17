# Forecast benchmark — bengaluru (live)

Window 2026-05-21 → 2026-08-17, test from **2026-07-26** (single temporal split; train strictly before each test origin). 13 station cells, 9,206 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T13:04Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 699 | 7.86 | 7.54 | 7.6 | **6.48** | +17.6% |
| non_winter | 24 | 699 | 7.86 | 7.54 | 7.6 | **6.48** | +17.6% |
| full_test | 48 | 662 | 13.89 | 7.4 | 7.56 | **6.56** | +52.8% |
| non_winter | 48 | 662 | 13.89 | 7.4 | 7.56 | **6.56** | +52.8% |
| full_test | 72 | 695 | 13.85 | 7.56 | 7.74 | **6.65** | +52.0% |
| non_winter | 72 | 695 | 13.85 | 7.56 | 7.74 | **6.65** | +52.0% |

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| very_poor (>120) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 48 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| very_poor (>120) | 48 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| severe (>250) | 48 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| poor (>90) | 72 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| very_poor (>120) | 72 | 0 | None/None/None | 0.0/None/None | 0 | None | None |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.811 (mean width 16.7 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.813 (mean width 17.3 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.856 (mean width 20.3 µg/m³); P(>90) Brier 0.0 vs climatology 0.0 (skill –); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._