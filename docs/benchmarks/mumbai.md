# Forecast benchmark — mumbai (hist)

Window 2025-02-18 → 2026-08-15, test from **2025-11-01** (rolling-origin monthly refit, 90-day training window; train strictly before each test origin). 27 station cells, 278,778 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T13:50Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 118,570 | 2275.28 | 2760.07 | 1549.92 | **1549.82** | +31.9% |
| winter_nov_feb | 24 | 44,838 | 56.13 | 75.71 | 53.29 | **45.32** | +19.3% |
| non_winter | 24 | 73,732 | 2884.99 | 3499.59 | 1965.04 | **1965.04** | +31.9% |
| full_test | 48 | 119,366 | 2125.77 | 2416.68 | 1081.88 | **1081.76** | +49.1% |
| winter_nov_feb | 48 | 45,852 | 61.42 | 74.57 | 55.34 | **50.63** | +17.6% |
| non_winter | 48 | 73,514 | 2708.33 | 3078.89 | 1377.89 | **1377.86** | +49.1% |
| full_test | 72 | 119,806 | 3028.76 | 2187.5 | 1545.55 | **1545.53** | +49.0% |
| winter_nov_feb | 72 | 46,483 | 65.01 | 75.46 | 56.77 | **52.14** | +19.8% |
| non_winter | 72 | 73,323 | 3871.2 | 2795.55 | 1975.1 | **1975.16** | +49.0% |

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 4,242 | 8192.79 | 8192.15 | **8193.32** | -0.0% |
| observed_over_120 | 24 | 1,577 | 13436.68 | 13435.65 | **13437.7** | -0.0% |
| observed_over_250 | 24 | 806 | 18794.53 | 18793.12 | **18796.03** | -0.0% |
| observed_over_90 | 48 | 4,339 | 5672.85 | 5671.05 | **5673.13** | -0.0% |
| observed_over_120 | 48 | 1,627 | 9263.49 | 9260.82 | **9264.32** | -0.0% |
| observed_over_250 | 48 | 833 | 12945.66 | 12942.07 | **12946.98** | -0.0% |
| observed_over_90 | 72 | 4,409 | 9575.64 | 8055.29 | **8056.04** | +15.9% |
| observed_over_120 | 72 | 1,677 | 13061.44 | 13061.03 | **13062.31** | -0.0% |
| observed_over_250 | 72 | 872 | 18112.9 | 18112.45 | **18114.24** | -0.0% |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 4,242 | 0.362/0.044/0.079 | 0.352/0.35/0.351 | 2,756 | 0.003 | 0.0 |
| very_poor (>120) | 24 | 1,577 | 0.284/0.041/0.071 | 0.231/0.231/0.231 | 1,212 | 0.001 | 0.0 |
| severe (>250) | 24 | 806 | 0.366/0.042/0.076 | 0.298/0.3/0.299 | 564 | 0.0 | 0.0 |
| poor (>90) | 48 | 4,339 | 0.219/0.014/0.026 | 0.293/0.285/0.289 | 3,103 | 0.001 | 0.0 |
| very_poor (>120) | 48 | 1,627 | 0.139/0.015/0.028 | 0.17/0.16/0.165 | 1,366 | 0.002 | 0.0 |
| severe (>250) | 48 | 833 | 0.6/0.014/0.028 | 0.204/0.197/0.2 | 669 | 0.0 | 0.0 |
| poor (>90) | 72 | 4,409 | 0.219/0.012/0.023 | 0.23/0.222/0.226 | 3,429 | 0.001 | 0.0 |
| very_poor (>120) | 72 | 1,677 | 0.164/0.013/0.024 | 0.121/0.116/0.118 | 1,483 | 0.0 | 0.0 |
| severe (>250) | 72 | 872 | 0.0/0.0/0.0 | 0.135/0.125/0.13 | 763 | 0.0 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.81 (mean width 48.6 µg/m³); P(>90) Brier 0.0339 vs climatology 0.0345 (skill +1.6%); P(>120) Brier 0.0139 vs climatology 0.0131 (skill -6.2%); P(>250) Brier 0.007 vs climatology 0.0068 (skill -3.0%)
- **+48h**: 80% PI empirical coverage 0.811 (mean width 51.7 µg/m³); P(>90) Brier 0.0366 vs climatology 0.035 (skill -4.4%); P(>120) Brier 0.0146 vs climatology 0.0134 (skill -8.7%); P(>250) Brier 0.007 vs climatology 0.0069 (skill -0.6%)
- **+72h**: 80% PI empirical coverage 0.786 (mean width 62.3 µg/m³); P(>90) Brier 0.0369 vs climatology 0.0354 (skill -4.1%); P(>120) Brier 0.0146 vs climatology 0.0138 (skill -5.8%); P(>250) Brier 0.0073 vs climatology 0.0072 (skill -1.6%)

## Meteorology ablation

- +24h: RMSE with ERA5 met 1549.82 vs without 1549.81 → met contributes -0.0%
- +48h: RMSE with ERA5 met 1081.76 vs without 1081.78 → met contributes 0.0%
- +72h: RMSE with ERA5 met 1545.53 vs without 1545.49 → met contributes -0.0%

_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._