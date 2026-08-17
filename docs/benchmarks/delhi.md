# Forecast benchmark — delhi (hist)

Window 2025-02-17 → 2026-08-15, test from **2025-11-01** (rolling-origin monthly refit, 90-day training window; train strictly before each test origin). 39 station cells, 451,397 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-16T17:55Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 208,273 | 74.09 | 85.84 | 105.59 | **68.36** | +7.7% |
| winter_nov_feb | 24 | 81,476 | 91.46 | 116.28 | 158.56 | **94.82** | -3.7% |
| non_winter | 24 | 126,797 | 60.34 | 58.45 | 46.46 | **43.58** | +27.8% |
| full_test | 48 | 209,171 | 83.62 | 89.55 | 105.53 | **71.91** | +14.0% |
| winter_nov_feb | 48 | 83,101 | 107.93 | 117.91 | 157.36 | **99.86** | +7.5% |
| non_winter | 48 | 126,070 | 62.63 | 64.36 | 46.43 | **44.81** | +28.5% |
| full_test | 72 | 209,277 | 87.73 | 90.92 | 105.9 | **76.19** | +13.2% |
| winter_nov_feb | 72 | 84,152 | 113.87 | 119.27 | 156.89 | **106.34** | +6.6% |
| non_winter | 72 | 125,125 | 64.44 | 65.25 | 46.94 | **45.88** | +28.8% |

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 84,656 | 95.54 | 114.7 | **94.05** | +1.6% |
| observed_over_120 | 24 | 63,005 | 99.66 | 124.65 | **104.53** | -4.9% |
| observed_over_250 | 24 | 17,722 | 141.12 | 173.16 | **171.08** | -21.2% |
| observed_over_90 | 48 | 85,208 | 107.83 | 120.27 | **98.85** | +8.3% |
| observed_over_120 | 48 | 63,433 | 116.13 | 129.99 | **109.72** | +5.5% |
| observed_over_250 | 48 | 17,738 | 163.16 | 176.2 | **180.94** | -10.9% |
| observed_over_90 | 72 | 85,708 | 116.46 | 121.28 | **104.18** | +10.5% |
| observed_over_120 | 72 | 63,926 | 123.86 | 132.19 | **116.62** | +5.8% |
| observed_over_250 | 72 | 17,822 | 175.23 | 177.83 | **197.0** | -12.4% |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 84,656 | 0.794/0.814/0.804 | 0.786/0.795/0.791 | 17,360 | 0.341 | 0.0 |
| very_poor (>120) | 24 | 63,005 | 0.74/0.784/0.761 | 0.743/0.749/0.746 | 15,817 | 0.362 | 0.0 |
| severe (>250) | 24 | 17,722 | 0.48/0.188/0.27 | 0.552/0.56/0.556 | 7,793 | 0.024 | 0.0 |
| poor (>90) | 48 | 85,208 | 0.769/0.808/0.788 | 0.756/0.769/0.762 | 19,719 | 0.391 | 0.0 |
| very_poor (>120) | 48 | 63,433 | 0.702/0.763/0.731 | 0.702/0.711/0.706 | 18,356 | 0.38 | 0.0 |
| severe (>250) | 48 | 17,738 | 0.369/0.123/0.184 | 0.445/0.454/0.449 | 9,684 | 0.042 | 0.0 |
| poor (>90) | 72 | 85,708 | 0.759/0.804/0.781 | 0.745/0.757/0.751 | 20,846 | 0.428 | 0.0 |
| very_poor (>120) | 72 | 63,926 | 0.661/0.721/0.689 | 0.69/0.699/0.695 | 19,212 | 0.383 | 0.0 |
| severe (>250) | 72 | 17,822 | 0.379/0.022/0.042 | 0.398/0.407/0.402 | 10,577 | 0.006 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.78 (mean width 144.9 µg/m³); P(>90) Brier 0.1204 vs climatology 0.2413 (skill +50.1%); P(>120) Brier 0.1087 vs climatology 0.211 (skill +48.5%); P(>250) Brier 0.0599 vs climatology 0.0778 (skill +23.0%)
- **+48h**: 80% PI empirical coverage 0.777 (mean width 160.9 µg/m³); P(>90) Brier 0.1295 vs climatology 0.2414 (skill +46.4%); P(>120) Brier 0.1181 vs climatology 0.2113 (skill +44.1%); P(>250) Brier 0.064 vs climatology 0.0776 (skill +17.5%)
- **+72h**: 80% PI empirical coverage 0.779 (mean width 172.0 µg/m³); P(>90) Brier 0.1501 vs climatology 0.2418 (skill +37.9%); P(>120) Brier 0.1442 vs climatology 0.2122 (skill +32.0%); P(>250) Brier 0.0721 vs climatology 0.0779 (skill +7.4%)

## Meteorology ablation

- +24h: RMSE with ERA5 met 68.36 vs without 69.67 → met contributes 1.9%
- +48h: RMSE with ERA5 met 71.91 vs without 71.78 → met contributes -0.2%
- +72h: RMSE with ERA5 met 76.19 vs without 78.09 → met contributes 2.4%

_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._