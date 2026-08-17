# Forecast benchmark — delhi (hist)

Window 2025-02-17 → 2026-08-15, test from **2025-11-01** (rolling-origin monthly refit, expanding window; train strictly before each test origin). 39 station cells, 451,397 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-16T17:55Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 208,273 | 74.09 | 85.84 | 105.59 | **70.22** | +5.2% |
| winter_nov_feb | 24 | 81,476 | 91.46 | 116.28 | 158.56 | **98.75** | -8.0% |
| non_winter | 24 | 126,797 | 60.34 | 58.45 | 46.46 | **42.82** | +29.0% |
| full_test | 48 | 209,171 | 83.62 | 89.55 | 105.53 | **74.34** | +11.1% |
| winter_nov_feb | 48 | 83,101 | 107.93 | 117.91 | 157.36 | **104.55** | +3.1% |
| non_winter | 48 | 126,070 | 62.63 | 64.36 | 46.43 | **44.33** | +29.2% |
| full_test | 72 | 209,277 | 87.73 | 90.92 | 105.9 | **77.2** | +12.0% |
| winter_nov_feb | 72 | 84,152 | 113.87 | 119.27 | 156.89 | **108.78** | +4.5% |
| non_winter | 72 | 125,125 | 64.44 | 65.25 | 46.94 | **44.83** | +30.4% |

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 84,656 | 95.54 | 114.7 | **100.44** | -5.1% |
| observed_over_120 | 24 | 63,005 | 99.66 | 124.65 | **113.6** | -14.0% |
| observed_over_250 | 24 | 17,722 | 141.12 | 173.16 | **190.72** | -35.2% |
| observed_over_90 | 48 | 85,208 | 107.83 | 120.27 | **107.36** | +0.4% |
| observed_over_120 | 48 | 63,433 | 116.13 | 129.99 | **121.79** | -4.9% |
| observed_over_250 | 48 | 17,738 | 163.16 | 176.2 | **206.53** | -26.6% |
| observed_over_90 | 72 | 85,708 | 116.46 | 121.28 | **111.72** | +4.1% |
| observed_over_120 | 72 | 63,926 | 123.86 | 132.19 | **126.78** | -2.4% |
| observed_over_250 | 72 | 17,822 | 175.23 | 177.83 | **213.03** | -21.6% |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 84,656 | 0.83/0.793/0.811 | 0.786/0.795/0.791 | 17,360 | 0.233 | 0.0 |
| very_poor (>120) | 24 | 63,005 | 0.791/0.714/0.751 | 0.743/0.749/0.746 | 15,817 | 0.193 | 0.0 |
| severe (>250) | 24 | 17,722 | 0.614/0.115/0.193 | 0.552/0.56/0.556 | 7,793 | 0.001 | 0.0 |
| poor (>90) | 48 | 85,208 | 0.823/0.753/0.787 | 0.756/0.769/0.762 | 19,719 | 0.229 | 0.0 |
| very_poor (>120) | 48 | 63,433 | 0.759/0.694/0.725 | 0.702/0.711/0.706 | 18,356 | 0.252 | 0.0 |
| severe (>250) | 48 | 17,738 | 0.389/0.006/0.013 | 0.445/0.454/0.449 | 9,684 | 0.001 | 0.0 |
| poor (>90) | 72 | 85,708 | 0.826/0.722/0.77 | 0.745/0.757/0.751 | 20,846 | 0.255 | 0.0 |
| very_poor (>120) | 72 | 63,926 | 0.744/0.603/0.666 | 0.69/0.699/0.695 | 19,212 | 0.244 | 0.0 |
| severe (>250) | 72 | 17,822 | 0.263/0.001/0.001 | 0.398/0.407/0.402 | 10,577 | 0.0 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.809 (mean width 125.7 µg/m³); P(>90) Brier 0.1185 vs climatology 0.2413 (skill +50.9%); P(>120) Brier 0.1159 vs climatology 0.211 (skill +45.1%); P(>250) Brier 0.0754 vs climatology 0.0778 (skill +3.2%)
- **+48h**: 80% PI empirical coverage 0.806 (mean width 144.4 µg/m³); P(>90) Brier 0.1283 vs climatology 0.2414 (skill +46.9%); P(>120) Brier 0.1273 vs climatology 0.2113 (skill +39.8%); P(>250) Brier 0.0759 vs climatology 0.0776 (skill +2.2%)
- **+72h**: 80% PI empirical coverage 0.792 (mean width 146.3 µg/m³); P(>90) Brier 0.1352 vs climatology 0.2418 (skill +44.1%); P(>120) Brier 0.1368 vs climatology 0.2122 (skill +35.5%); P(>250) Brier 0.0756 vs climatology 0.0779 (skill +3.0%)

## Meteorology ablation

- +24h: RMSE with ERA5 met 70.22 vs without 74.73 → met contributes 6.0%
- +48h: RMSE with ERA5 met 74.34 vs without 78.36 → met contributes 5.1%
- +72h: RMSE with ERA5 met 77.2 vs without 81.54 → met contributes 5.3%

_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._