# Forecast benchmark — delhi (hist)

Window 2025-02-17 → 2026-08-15, test from **2025-11-01** (rolling-origin monthly refit, 90-day training window; train strictly before each test origin). 39 station cells, 449,526 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T14:59Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 207,225 | 67.05 | 82.26 | 104.17 | **65.92** | +1.7% |
| winter_nov_feb | 24 | 81,109 | 90.6 | 115.91 | 158.51 | **94.37** | -4.2% |
| non_winter | 24 | 126,116 | 45.91 | 49.78 | 40.89 | **37.57** | +18.2% |
| full_test | 48 | 208,113 | 77.73 | 84.16 | 104.16 | **70.2** | +9.7% |
| winter_nov_feb | 48 | 82,738 | 107.59 | 117.66 | 157.3 | **100.35** | +6.7% |
| non_winter | 48 | 125,375 | 48.88 | 51.2 | 40.99 | **39.19** | +19.8% |
| full_test | 72 | 208,247 | 82.15 | 85.68 | 104.52 | **74.39** | +9.4% |
| winter_nov_feb | 72 | 83,778 | 113.58 | 119.07 | 156.8 | **106.49** | +6.2% |
| non_winter | 72 | 124,469 | 51.07 | 52.34 | 41.56 | **40.33** | +21.0% |

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 84,467 | 90.64 | 114.43 | **93.69** | -3.4% |
| observed_over_120 | 24 | 62,866 | 99.01 | 124.33 | **104.18** | -5.2% |
| observed_over_250 | 24 | 17,692 | 139.62 | 172.58 | **169.74** | -21.6% |
| observed_over_90 | 48 | 85,025 | 106.58 | 116.53 | **99.49** | +6.7% |
| observed_over_120 | 48 | 63,297 | 115.91 | 126.57 | **110.52** | +4.7% |
| observed_over_250 | 48 | 17,705 | 162.83 | 175.98 | **182.48** | -12.1% |
| observed_over_90 | 72 | 85,523 | 113.85 | 117.56 | **104.37** | +8.3% |
| observed_over_120 | 72 | 63,784 | 123.63 | 127.59 | **116.74** | +5.6% |
| observed_over_250 | 72 | 17,788 | 174.9 | 177.78 | **196.8** | -12.5% |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 84,467 | 0.798/0.816/0.807 | 0.788/0.796/0.792 | 17,190 | 0.335 | 0.0 |
| very_poor (>120) | 24 | 62,866 | 0.745/0.785/0.765 | 0.744/0.75/0.747 | 15,701 | 0.352 | 0.0 |
| severe (>250) | 24 | 17,692 | 0.46/0.189/0.268 | 0.554/0.562/0.558 | 7,756 | 0.031 | 0.0 |
| poor (>90) | 48 | 85,025 | 0.77/0.807/0.789 | 0.758/0.77/0.764 | 19,578 | 0.387 | 0.0 |
| very_poor (>120) | 48 | 63,297 | 0.706/0.765/0.735 | 0.703/0.712/0.708 | 18,226 | 0.382 | 0.0 |
| severe (>250) | 48 | 17,705 | 0.343/0.109/0.166 | 0.445/0.454/0.45 | 9,661 | 0.03 | 0.0 |
| poor (>90) | 72 | 85,523 | 0.759/0.803/0.78 | 0.746/0.758/0.752 | 20,694 | 0.418 | 0.0 |
| very_poor (>120) | 72 | 63,784 | 0.662/0.719/0.69 | 0.691/0.7/0.696 | 19,117 | 0.384 | 0.0 |
| severe (>250) | 72 | 17,788 | 0.333/0.019/0.036 | 0.398/0.406/0.402 | 10,569 | 0.004 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.783 (mean width 145.1 µg/m³); P(>90) Brier 0.1191 vs climatology 0.2415 (skill +50.7%); P(>120) Brier 0.1075 vs climatology 0.2113 (skill +49.2%); P(>250) Brier 0.0604 vs climatology 0.0781 (skill +22.6%)
- **+48h**: 80% PI empirical coverage 0.781 (mean width 162.8 µg/m³); P(>90) Brier 0.1312 vs climatology 0.2416 (skill +45.7%); P(>120) Brier 0.1202 vs climatology 0.2116 (skill +43.2%); P(>250) Brier 0.0651 vs climatology 0.0778 (skill +16.4%)
- **+72h**: 80% PI empirical coverage 0.774 (mean width 170.9 µg/m³); P(>90) Brier 0.1519 vs climatology 0.242 (skill +37.2%); P(>120) Brier 0.1453 vs climatology 0.2125 (skill +31.6%); P(>250) Brier 0.0729 vs climatology 0.0781 (skill +6.6%)

## Meteorology ablation

- +24h: RMSE with ERA5 met 65.92 vs without 67.33 → met contributes 2.1%
- +48h: RMSE with ERA5 met 70.2 vs without 69.68 → met contributes -0.8%
- +72h: RMSE with ERA5 met 74.39 vs without 75.09 → met contributes 0.9%

_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._