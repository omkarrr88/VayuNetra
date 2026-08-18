# Forecast benchmark — delhi (hist)

Window 2025-02-17 → 2026-08-15, test from **2025-11-01** (rolling-origin monthly refit, expanding window; train strictly before each test origin). 39 station cells, 449,526 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T17:36Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 207,225 | 67.05 | 82.26 | 104.17 | **61.68** | +8.0% | 68.22 | -1.7% |
| winter_nov_feb | 24 | 81,109 | 90.6 | 115.91 | 158.51 | **87.21** | +3.7% | 99.0 | -9.3% |
| non_winter | 24 | 126,116 | 45.91 | 49.78 | 40.89 | **36.86** | +19.7% | 36.66 | +20.1% |
| full_test | 48 | 208,113 | 77.73 | 84.16 | 104.16 | **67.5** | +13.2% | 72.0 | +7.4% |
| winter_nov_feb | 48 | 82,738 | 107.59 | 117.66 | 157.3 | **95.87** | +10.9% | 103.83 | +3.5% |
| non_winter | 48 | 125,375 | 48.88 | 51.2 | 40.99 | **38.69** | +20.8% | 38.62 | +21.0% |
| full_test | 72 | 208,247 | 82.15 | 85.68 | 104.52 | **70.5** | +14.2% | 74.84 | +8.9% |
| winter_nov_feb | 72 | 83,778 | 113.58 | 119.07 | 156.8 | **100.25** | +11.7% | 108.02 | +4.9% |
| non_winter | 72 | 124,469 | 51.07 | 52.34 | 41.56 | **39.39** | +22.9% | 38.97 | +23.7% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.55, 0.3, 0.3, 0.35, 0.7, 1.0, 1.0, 1.0, 1.0, 1.0]; +48h [0.5, 0.4, 0.45, 0.4, 0.8, 1.0, 1.0, 0.95, 0.95, 0.95]; +72h [0.45, 0.35, 0.5, 0.45, 0.65, 1.0, 0.9, 0.95, 0.95, 0.95]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 84,467 | 90.64 | 114.43 | **88.21** | +2.7% |
| observed_over_120 | 24 | 62,866 | 99.01 | 124.33 | **97.95** | +1.1% |
| observed_over_250 | 24 | 17,692 | 139.62 | 172.58 | **151.44** | -8.5% |
| observed_over_90 | 48 | 85,025 | 106.58 | 116.53 | **97.39** | +8.6% |
| observed_over_120 | 48 | 63,297 | 115.91 | 126.57 | **108.09** | +6.7% |
| observed_over_250 | 48 | 17,705 | 162.83 | 175.98 | **170.24** | -4.5% |
| observed_over_90 | 72 | 85,523 | 113.85 | 117.56 | **102.08** | +10.3% |
| observed_over_120 | 72 | 63,784 | 123.63 | 127.59 | **113.19** | +8.4% |
| observed_over_250 | 72 | 17,788 | 174.9 | 177.78 | **178.47** | -2.0% |

## Probability alarms — alarm = P(> band) ≥ τ (operating points on the calibrated probability)

| band | h | τ | precision | recall | F1 | onset recall |
|---|---:|---:|---:|---:|---:|---:|
| poor | 24 | 0.2 | 0.612 | 0.956 | 0.746 | 0.795 |
| poor | 24 | 0.3 | 0.706 | 0.911 | 0.796 | 0.601 |
| poor | 24 | 0.4 | 0.772 | 0.859 | 0.814 | 0.396 |
| poor | 24 | 0.5 | 0.818 | 0.812 | 0.815 | 0.238 |
| very_poor | 24 | 0.2 | 0.587 | 0.929 | 0.719 | 0.731 |
| very_poor | 24 | 0.3 | 0.669 | 0.873 | 0.758 | 0.535 |
| very_poor | 24 | 0.4 | 0.729 | 0.823 | 0.773 | 0.369 |
| very_poor | 24 | 0.5 | 0.774 | 0.774 | 0.774 | 0.204 |
| severe | 24 | 0.2 | 0.442 | 0.585 | 0.503 | 0.23 |
| severe | 24 | 0.3 | 0.509 | 0.482 | 0.495 | 0.087 |
| severe | 24 | 0.4 | 0.55 | 0.424 | 0.478 | 0.019 |
| severe | 24 | 0.5 | 0.579 | 0.386 | 0.463 | 0.004 |
| poor | 48 | 0.2 | 0.577 | 0.96 | 0.721 | 0.839 |
| poor | 48 | 0.3 | 0.666 | 0.918 | 0.772 | 0.688 |
| poor | 48 | 0.4 | 0.747 | 0.851 | 0.796 | 0.451 |
| poor | 48 | 0.5 | 0.8 | 0.795 | 0.798 | 0.277 |
| very_poor | 48 | 0.2 | 0.538 | 0.936 | 0.683 | 0.799 |
| very_poor | 48 | 0.3 | 0.629 | 0.872 | 0.731 | 0.6 |
| very_poor | 48 | 0.4 | 0.687 | 0.821 | 0.748 | 0.447 |
| very_poor | 48 | 0.5 | 0.733 | 0.771 | 0.751 | 0.292 |
| severe | 48 | 0.2 | 0.33 | 0.578 | 0.42 | 0.25 |
| severe | 48 | 0.3 | 0.402 | 0.455 | 0.427 | 0.083 |
| severe | 48 | 0.4 | 0.452 | 0.379 | 0.413 | 0.022 |
| severe | 48 | 0.5 | 0.491 | 0.329 | 0.394 | 0.004 |
| poor | 72 | 0.2 | 0.575 | 0.958 | 0.718 | 0.833 |
| poor | 72 | 0.3 | 0.659 | 0.916 | 0.766 | 0.691 |
| poor | 72 | 0.4 | 0.739 | 0.86 | 0.795 | 0.509 |
| poor | 72 | 0.5 | 0.795 | 0.803 | 0.799 | 0.311 |
| very_poor | 72 | 0.2 | 0.53 | 0.941 | 0.678 | 0.819 |
| very_poor | 72 | 0.3 | 0.613 | 0.883 | 0.723 | 0.645 |
| very_poor | 72 | 0.4 | 0.673 | 0.826 | 0.742 | 0.467 |
| very_poor | 72 | 0.5 | 0.721 | 0.767 | 0.743 | 0.289 |
| severe | 72 | 0.2 | 0.291 | 0.565 | 0.384 | 0.27 |
| severe | 72 | 0.3 | 0.369 | 0.445 | 0.403 | 0.088 |
| severe | 72 | 0.4 | 0.416 | 0.37 | 0.392 | 0.015 |
| severe | 72 | 0.5 | 0.448 | 0.325 | 0.377 | 0.001 |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 84,467 | 0.835/0.785/0.809 | 0.788/0.796/0.792 | 17,190 | 0.117 | 0.0 |
| very_poor (>120) | 24 | 62,866 | 0.797/0.733/0.764 | 0.744/0.75/0.747 | 15,701 | 0.075 | 0.0 |
| severe (>250) | 24 | 17,692 | 0.608/0.359/0.452 | 0.554/0.562/0.558 | 7,756 | 0.0 | 0.0 |
| poor (>90) | 48 | 85,025 | 0.824/0.756/0.788 | 0.758/0.77/0.764 | 19,578 | 0.144 | 0.0 |
| very_poor (>120) | 48 | 63,297 | 0.764/0.71/0.736 | 0.703/0.712/0.708 | 18,226 | 0.124 | 0.0 |
| severe (>250) | 48 | 17,705 | 0.519/0.286/0.369 | 0.445/0.454/0.45 | 9,661 | 0.0 | 0.0 |
| poor (>90) | 72 | 85,523 | 0.821/0.755/0.787 | 0.746/0.758/0.752 | 20,694 | 0.16 | 0.0 |
| very_poor (>120) | 72 | 63,784 | 0.757/0.7/0.727 | 0.691/0.7/0.696 | 19,117 | 0.132 | 0.0 |
| severe (>250) | 72 | 17,788 | 0.472/0.287/0.356 | 0.398/0.406/0.402 | 10,569 | 0.0 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.809 (mean width 124.4 µg/m³); P(>90) Brier 0.1118 vs climatology 0.2415 (skill +53.7%); P(>120) Brier 0.1025 vs climatology 0.2113 (skill +51.5%); P(>250) Brier 0.0595 vs climatology 0.0781 (skill +23.8%)
- **+48h**: 80% PI empirical coverage 0.807 (mean width 145.6 µg/m³); P(>90) Brier 0.1217 vs climatology 0.2416 (skill +49.6%); P(>120) Brier 0.1155 vs climatology 0.2116 (skill +45.4%); P(>250) Brier 0.0686 vs climatology 0.0778 (skill +11.9%)
- **+72h**: 80% PI empirical coverage 0.784 (mean width 142.1 µg/m³); P(>90) Brier 0.1236 vs climatology 0.242 (skill +48.9%); P(>120) Brier 0.1195 vs climatology 0.2125 (skill +43.7%); P(>250) Brier 0.0746 vs climatology 0.0781 (skill +4.5%)

## Meteorology ablation

- +24h: RMSE with ERA5 met 68.22 vs without 72.24 → met contributes 5.6%
- +48h: RMSE with ERA5 met 72.0 vs without 75.81 → met contributes 5.0%
- +72h: RMSE with ERA5 met 74.84 vs without 79.77 → met contributes 6.2%

_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._