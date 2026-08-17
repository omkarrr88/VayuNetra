# Forecast benchmark — mumbai (hist)

Window 2025-02-18 → 2026-08-15, test from **2025-11-01** (rolling-origin monthly refit, 90-day training window; train strictly before each test origin). 27 station cells, 276,130 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T14:56Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 117,359 | 48.33 | 64.32 | 44.52 | **39.81** | +17.6% |
| winter_nov_feb | 24 | 44,527 | 56.1 | 75.77 | 53.15 | **45.83** | +18.3% |
| non_winter | 24 | 72,832 | 42.89 | 56.18 | 38.3 | **35.63** | +16.9% |
| full_test | 48 | 118,152 | 52.68 | 65.26 | 45.62 | **42.69** | +19.0% |
| winter_nov_feb | 48 | 45,541 | 61.39 | 74.61 | 55.22 | **50.93** | +17.0% |
| non_winter | 48 | 72,611 | 46.4 | 58.64 | 38.4 | **36.59** | +21.1% |
| full_test | 72 | 118,539 | 59.4 | 68.5 | 49.42 | **46.89** | +21.1% |
| winter_nov_feb | 72 | 46,172 | 65.06 | 75.54 | 56.66 | **52.25** | +19.7% |
| non_winter | 72 | 72,367 | 55.49 | 63.61 | 44.18 | **43.13** | +22.3% |

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 4,207 | 179.75 | 203.75 | **190.34** | -5.9% |
| observed_over_120 | 24 | 1,558 | 281.65 | 324.28 | **306.24** | -8.7% |
| observed_over_250 | 24 | 793 | 376.27 | 439.47 | **415.16** | -10.3% |
| observed_over_90 | 48 | 4,303 | 199.0 | 206.8 | **203.71** | -2.4% |
| observed_over_120 | 48 | 1,608 | 307.69 | 329.28 | **326.99** | -6.3% |
| observed_over_250 | 48 | 816 | 412.05 | 447.92 | **445.12** | -8.0% |
| observed_over_90 | 72 | 4,368 | 226.66 | 231.1 | **228.78** | -0.9% |
| observed_over_120 | 72 | 1,656 | 353.09 | 367.67 | **365.89** | -3.6% |
| observed_over_250 | 72 | 852 | 474.6 | 499.9 | **497.6** | -4.8% |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 4,207 | 0.385/0.053/0.093 | 0.352/0.35/0.351 | 2,734 | 0.006 | 0.0 |
| very_poor (>120) | 24 | 1,558 | 0.353/0.055/0.094 | 0.231/0.232/0.231 | 1,197 | 0.003 | 0.0 |
| severe (>250) | 24 | 793 | 0.289/0.03/0.055 | 0.302/0.304/0.303 | 552 | 0.0 | 0.0 |
| poor (>90) | 48 | 4,303 | 0.248/0.018/0.033 | 0.293/0.285/0.289 | 3,076 | 0.002 | 0.0 |
| very_poor (>120) | 48 | 1,608 | 0.171/0.021/0.037 | 0.17/0.16/0.165 | 1,350 | 0.001 | 0.0 |
| severe (>250) | 48 | 816 | 0.424/0.017/0.033 | 0.205/0.199/0.202 | 654 | 0.0 | 0.0 |
| poor (>90) | 72 | 4,368 | 0.229/0.013/0.024 | 0.23/0.221/0.225 | 3,402 | 0.001 | 0.0 |
| very_poor (>120) | 72 | 1,656 | 0.192/0.011/0.022 | 0.118/0.111/0.114 | 1,472 | 0.0 | 0.0 |
| severe (>250) | 72 | 852 | 0.0/0.0/0.0 | 0.137/0.124/0.13 | 746 | 0.0 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.816 (mean width 47.6 µg/m³); P(>90) Brier 0.0336 vs climatology 0.0346 (skill +2.7%); P(>120) Brier 0.0138 vs climatology 0.0131 (skill -5.3%); P(>250) Brier 0.007 vs climatology 0.0067 (skill -4.1%)
- **+48h**: 80% PI empirical coverage 0.817 (mean width 50.4 µg/m³); P(>90) Brier 0.0362 vs climatology 0.0351 (skill -3.1%); P(>120) Brier 0.0146 vs climatology 0.0134 (skill -8.7%); P(>250) Brier 0.007 vs climatology 0.0069 (skill -1.7%)
- **+72h**: 80% PI empirical coverage 0.794 (mean width 56.0 µg/m³); P(>90) Brier 0.0369 vs climatology 0.0355 (skill -3.8%); P(>120) Brier 0.0144 vs climatology 0.0138 (skill -4.6%); P(>250) Brier 0.0073 vs climatology 0.0071 (skill -1.7%)

## Meteorology ablation

- +24h: RMSE with ERA5 met 39.81 vs without 40.14 → met contributes 0.8%
- +48h: RMSE with ERA5 met 42.69 vs without 42.72 → met contributes 0.1%
- +72h: RMSE with ERA5 met 46.89 vs without 46.62 → met contributes -0.6%

_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._