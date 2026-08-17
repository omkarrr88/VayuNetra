# Forecast benchmark — kolkata (hist)

Window 2025-02-18 → 2026-08-15, test from **2025-11-01** (rolling-origin monthly refit, 90-day training window; train strictly before each test origin). 10 station cells, 114,949 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T13:34Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 53,443 | 33.83 | 39.37 | 51.74 | **29.44** | +13.0% |
| winter_nov_feb | 24 | 21,054 | 46.1 | 54.39 | 78.71 | **41.37** | +10.3% |
| non_winter | 24 | 32,389 | 22.51 | 25.2 | 19.78 | **17.83** | +20.8% |
| full_test | 48 | 53,769 | 37.34 | 39.58 | 51.85 | **34.62** | +7.3% |
| winter_nov_feb | 48 | 21,516 | 51.99 | 54.58 | 78.55 | **47.04** | +9.5% |
| non_winter | 48 | 32,253 | 22.84 | 24.97 | 19.14 | **22.84** | +0.0% |
| full_test | 72 | 53,798 | 38.63 | 40.14 | 51.94 | **39.77** | -2.9% |
| winter_nov_feb | 72 | 21,787 | 53.16 | 55.33 | 78.32 | **57.55** | -8.3% |
| non_winter | 72 | 32,011 | 24.17 | 24.98 | 18.95 | **20.09** | +16.9% |

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 8,960 | 66.85 | 73.15 | **62.32** | +6.8% |
| observed_over_120 | 24 | 4,183 | 85.32 | 94.23 | **86.22** | -1.1% |
| observed_over_250 | 24 | 183 | 304.1 | 327.45 | **324.23** | -6.6% |
| observed_over_90 | 48 | 9,061 | 72.01 | 72.87 | **70.0** | +2.8% |
| observed_over_120 | 48 | 4,239 | 89.11 | 93.72 | **95.32** | -7.0% |
| observed_over_250 | 48 | 185 | 316.26 | 322.13 | **332.55** | -5.2% |
| observed_over_90 | 72 | 9,148 | 71.1 | 73.65 | **85.54** | -20.3% |
| observed_over_120 | 72 | 4,265 | 91.28 | 94.14 | **115.58** | -26.6% |
| observed_over_250 | 72 | 188 | 313.06 | 316.53 | **359.4** | -14.8% |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 8,960 | 0.712/0.679/0.695 | 0.712/0.713/0.712 | 2,571 | 0.149 | 0.0 |
| very_poor (>120) | 24 | 4,183 | 0.634/0.405/0.495 | 0.616/0.617/0.616 | 1,604 | 0.052 | 0.0 |
| severe (>250) | 24 | 183 | None/0.0/None | 0.223/0.219/0.221 | 143 | 0.0 | 0.0 |
| poor (>90) | 48 | 9,061 | 0.65/0.485/0.556 | 0.64/0.639/0.639 | 3,271 | 0.137 | 0.0 |
| very_poor (>120) | 48 | 4,239 | 0.559/0.253/0.348 | 0.526/0.525/0.526 | 2,012 | 0.053 | 0.0 |
| severe (>250) | 48 | 185 | None/0.0/None | 0.188/0.184/0.186 | 151 | 0.0 | 0.0 |
| poor (>90) | 72 | 9,148 | 0.555/0.262/0.356 | 0.622/0.621/0.622 | 3,468 | 0.147 | 0.0 |
| very_poor (>120) | 72 | 4,265 | 0.382/0.079/0.131 | 0.501/0.502/0.501 | 2,124 | 0.051 | 0.0 |
| severe (>250) | 72 | 188 | None/0.0/None | 0.181/0.17/0.175 | 156 | 0.0 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.743 (mean width 50.2 µg/m³); P(>90) Brier 0.069 vs climatology 0.1395 (skill +50.5%); P(>120) Brier 0.0465 vs climatology 0.0721 (skill +35.6%); P(>250) Brier 0.0033 vs climatology 0.0034 (skill +4.0%)
- **+48h**: 80% PI empirical coverage 0.74 (mean width 58.9 µg/m³); P(>90) Brier 0.086 vs climatology 0.1401 (skill +38.6%); P(>120) Brier 0.0536 vs climatology 0.0726 (skill +26.1%); P(>250) Brier 0.0033 vs climatology 0.0034 (skill +3.6%)
- **+72h**: 80% PI empirical coverage 0.711 (mean width 60.6 µg/m³); P(>90) Brier 0.0948 vs climatology 0.1411 (skill +32.8%); P(>120) Brier 0.06 vs climatology 0.073 (skill +17.7%); P(>250) Brier 0.0035 vs climatology 0.0035 (skill +0.5%)

## Meteorology ablation

- +24h: RMSE with ERA5 met 29.44 vs without 32.12 → met contributes 8.3%
- +48h: RMSE with ERA5 met 34.62 vs without 37.85 → met contributes 8.5%
- +72h: RMSE with ERA5 met 39.77 vs without 41.43 → met contributes 4.0%

_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._