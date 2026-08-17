# Forecast benchmark — delhi (hist)

Window 2025-02-17 → 2026-08-15, test from **2025-11-01** (rolling-origin monthly refit, 90-day training window; train strictly before each test origin). 39 station cells, 449,526 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T17:09Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence | model+persistence blend | blend skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 207,225 | 67.05 | 82.26 | 104.17 | **65.92** | +1.7% | 60.96 | +9.1% |
| winter_nov_feb | 24 | 81,109 | 90.6 | 115.91 | 158.51 | **94.37** | -4.2% | 84.53 | +6.7% |
| non_winter | 24 | 126,116 | 45.91 | 49.78 | 40.89 | **37.57** | +18.2% | 38.87 | +15.3% |
| full_test | 48 | 208,113 | 77.73 | 84.16 | 104.16 | **70.2** | +9.7% | 67.71 | +12.9% |
| winter_nov_feb | 48 | 82,738 | 107.59 | 117.66 | 157.3 | **100.35** | +6.7% | 95.34 | +11.4% |
| non_winter | 48 | 125,375 | 48.88 | 51.2 | 40.99 | **39.19** | +19.8% | 40.14 | +17.9% |
| full_test | 72 | 208,247 | 82.15 | 85.68 | 104.52 | **74.39** | +9.4% | 72.18 | +12.1% |
| winter_nov_feb | 72 | 83,778 | 113.58 | 119.07 | 156.8 | **106.49** | +6.2% | 101.52 | +10.6% |
| non_winter | 72 | 124,469 | 51.07 | 52.34 | 41.56 | **40.33** | +21.0% | 42.18 | +17.4% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.4, 0.5, 0.55, 0.9, 0.25, 0.85, 0.9, 0.85, 1.0, 0.65]; +48h [0.4, 0.65, 0.75, 0.95, 0.35, 0.8, 0.8, 0.9, 1.0, 0.75]; +72h [0.4, 0.6, 0.8, 0.8, 0.2, 0.7, 0.9, 0.9, 0.95, 0.75]

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

## Probability alarms — alarm = P(> band) ≥ τ (operating points on the calibrated probability)

| band | h | τ | precision | recall | F1 | onset recall |
|---|---:|---:|---:|---:|---:|---:|
| poor | 24 | 0.2 | 0.675 | 0.879 | 0.763 | 0.518 |
| poor | 24 | 0.3 | 0.764 | 0.83 | 0.796 | 0.414 |
| poor | 24 | 0.4 | 0.806 | 0.803 | 0.804 | 0.365 |
| poor | 24 | 0.5 | 0.833 | 0.777 | 0.804 | 0.309 |
| very_poor | 24 | 0.2 | 0.657 | 0.877 | 0.751 | 0.609 |
| very_poor | 24 | 0.3 | 0.693 | 0.858 | 0.767 | 0.56 |
| very_poor | 24 | 0.4 | 0.721 | 0.833 | 0.773 | 0.487 |
| very_poor | 24 | 0.5 | 0.747 | 0.803 | 0.774 | 0.408 |
| severe | 24 | 0.2 | 0.325 | 0.854 | 0.47 | 0.687 |
| severe | 24 | 0.3 | 0.396 | 0.69 | 0.503 | 0.424 |
| severe | 24 | 0.4 | 0.453 | 0.486 | 0.469 | 0.22 |
| severe | 24 | 0.5 | 0.479 | 0.3 | 0.369 | 0.093 |
| poor | 48 | 0.2 | 0.647 | 0.872 | 0.743 | 0.574 |
| poor | 48 | 0.3 | 0.745 | 0.815 | 0.779 | 0.427 |
| poor | 48 | 0.4 | 0.787 | 0.778 | 0.782 | 0.354 |
| poor | 48 | 0.5 | 0.819 | 0.742 | 0.779 | 0.297 |
| very_poor | 48 | 0.2 | 0.637 | 0.871 | 0.736 | 0.639 |
| very_poor | 48 | 0.3 | 0.671 | 0.835 | 0.744 | 0.548 |
| very_poor | 48 | 0.4 | 0.698 | 0.798 | 0.745 | 0.475 |
| very_poor | 48 | 0.5 | 0.725 | 0.752 | 0.738 | 0.406 |
| severe | 48 | 0.2 | 0.279 | 0.716 | 0.401 | 0.556 |
| severe | 48 | 0.3 | 0.33 | 0.514 | 0.402 | 0.32 |
| severe | 48 | 0.4 | 0.382 | 0.325 | 0.351 | 0.169 |
| severe | 48 | 0.5 | 0.45 | 0.189 | 0.266 | 0.085 |
| poor | 72 | 0.2 | 0.656 | 0.873 | 0.749 | 0.577 |
| poor | 72 | 0.3 | 0.748 | 0.814 | 0.78 | 0.446 |
| poor | 72 | 0.4 | 0.781 | 0.748 | 0.764 | 0.359 |
| poor | 72 | 0.5 | 0.788 | 0.679 | 0.73 | 0.326 |
| very_poor | 72 | 0.2 | 0.635 | 0.87 | 0.734 | 0.647 |
| very_poor | 72 | 0.3 | 0.648 | 0.798 | 0.715 | 0.517 |
| very_poor | 72 | 0.4 | 0.649 | 0.711 | 0.679 | 0.457 |
| very_poor | 72 | 0.5 | 0.655 | 0.632 | 0.643 | 0.412 |
| severe | 72 | 0.2 | 0.247 | 0.573 | 0.345 | 0.454 |
| severe | 72 | 0.3 | 0.311 | 0.44 | 0.365 | 0.303 |
| severe | 72 | 0.4 | 0.396 | 0.357 | 0.375 | 0.204 |
| severe | 72 | 0.5 | 0.445 | 0.283 | 0.346 | 0.133 |

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