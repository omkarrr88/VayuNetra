# Forecast benchmark — delhi (hist)

Window 2025-02-17 → 2026-08-15, test from **2025-11-01** (rolling-origin monthly refit, expanding window; train strictly before each test origin). 39 station cells, 449,526 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T17:16Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence | model+persistence blend | blend skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 207,225 | 67.05 | 82.26 | 104.17 | **68.22** | -1.7% | 61.68 | +8.0% |
| winter_nov_feb | 24 | 81,109 | 90.6 | 115.91 | 158.51 | **99.0** | -9.3% | 87.21 | +3.7% |
| non_winter | 24 | 126,116 | 45.91 | 49.78 | 40.89 | **36.66** | +20.1% | 36.86 | +19.7% |
| full_test | 48 | 208,113 | 77.73 | 84.16 | 104.16 | **72.0** | +7.4% | 67.5 | +13.2% |
| winter_nov_feb | 48 | 82,738 | 107.59 | 117.66 | 157.3 | **103.83** | +3.5% | 95.87 | +10.9% |
| non_winter | 48 | 125,375 | 48.88 | 51.2 | 40.99 | **38.62** | +21.0% | 38.69 | +20.8% |
| full_test | 72 | 208,247 | 82.15 | 85.68 | 104.52 | **74.84** | +8.9% | 70.5 | +14.2% |
| winter_nov_feb | 72 | 83,778 | 113.58 | 119.07 | 156.8 | **108.02** | +4.9% | 100.25 | +11.7% |
| non_winter | 72 | 124,469 | 51.07 | 52.34 | 41.56 | **38.97** | +23.7% | 39.39 | +22.9% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.55, 0.3, 0.3, 0.35, 0.7, 1.0, 1.0, 1.0, 1.0, 1.0]; +48h [0.5, 0.4, 0.45, 0.4, 0.8, 1.0, 1.0, 0.95, 0.95, 0.95]; +72h [0.45, 0.35, 0.5, 0.45, 0.65, 1.0, 0.9, 0.95, 0.95, 0.95]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 84,467 | 90.64 | 114.43 | **100.68** | -11.1% |
| observed_over_120 | 24 | 62,866 | 99.01 | 124.33 | **113.93** | -15.1% |
| observed_over_250 | 24 | 17,692 | 139.62 | 172.58 | **191.19** | -36.9% |
| observed_over_90 | 48 | 85,025 | 106.58 | 116.53 | **106.66** | -0.1% |
| observed_over_120 | 48 | 63,297 | 115.91 | 126.57 | **120.87** | -4.3% |
| observed_over_250 | 48 | 17,705 | 162.83 | 175.98 | **204.87** | -25.8% |
| observed_over_90 | 72 | 85,523 | 113.85 | 117.56 | **110.92** | +2.6% |
| observed_over_120 | 72 | 63,784 | 123.63 | 127.59 | **125.77** | -1.7% |
| observed_over_250 | 72 | 17,788 | 174.9 | 177.78 | **211.32** | -20.8% |

## Probability alarms — alarm = P(> band) ≥ τ (operating points on the calibrated probability)

| band | h | τ | precision | recall | F1 | onset recall |
|---|---:|---:|---:|---:|---:|---:|
| poor | 24 | 0.2 | 0.608 | 0.957 | 0.744 | 0.804 |
| poor | 24 | 0.3 | 0.69 | 0.921 | 0.789 | 0.65 |
| poor | 24 | 0.4 | 0.745 | 0.876 | 0.805 | 0.484 |
| poor | 24 | 0.5 | 0.783 | 0.838 | 0.81 | 0.391 |
| very_poor | 24 | 0.2 | 0.566 | 0.94 | 0.707 | 0.775 |
| very_poor | 24 | 0.3 | 0.626 | 0.893 | 0.736 | 0.631 |
| very_poor | 24 | 0.4 | 0.668 | 0.86 | 0.752 | 0.552 |
| very_poor | 24 | 0.5 | 0.712 | 0.827 | 0.765 | 0.474 |
| severe | 24 | 0.2 | 0.227 | 0.436 | 0.298 | 0.387 |
| severe | 24 | 0.3 | 0.29 | 0.306 | 0.298 | 0.14 |
| severe | 24 | 0.4 | 0.361 | 0.229 | 0.28 | 0.068 |
| severe | 24 | 0.5 | 0.431 | 0.183 | 0.257 | 0.038 |
| poor | 48 | 0.2 | 0.578 | 0.961 | 0.722 | 0.842 |
| poor | 48 | 0.3 | 0.66 | 0.925 | 0.77 | 0.719 |
| poor | 48 | 0.4 | 0.73 | 0.869 | 0.793 | 0.537 |
| poor | 48 | 0.5 | 0.77 | 0.824 | 0.796 | 0.423 |
| very_poor | 48 | 0.2 | 0.53 | 0.946 | 0.679 | 0.832 |
| very_poor | 48 | 0.3 | 0.61 | 0.891 | 0.724 | 0.676 |
| very_poor | 48 | 0.4 | 0.642 | 0.86 | 0.735 | 0.597 |
| very_poor | 48 | 0.5 | 0.678 | 0.826 | 0.744 | 0.515 |
| severe | 48 | 0.2 | 0.18 | 0.412 | 0.251 | 0.375 |
| severe | 48 | 0.3 | 0.206 | 0.234 | 0.219 | 0.154 |
| severe | 48 | 0.4 | 0.237 | 0.116 | 0.155 | 0.062 |
| severe | 48 | 0.5 | 0.264 | 0.053 | 0.089 | 0.027 |
| poor | 72 | 0.2 | 0.573 | 0.959 | 0.717 | 0.839 |
| poor | 72 | 0.3 | 0.646 | 0.923 | 0.76 | 0.722 |
| poor | 72 | 0.4 | 0.707 | 0.887 | 0.787 | 0.621 |
| poor | 72 | 0.5 | 0.757 | 0.847 | 0.8 | 0.502 |
| very_poor | 72 | 0.2 | 0.519 | 0.949 | 0.671 | 0.847 |
| very_poor | 72 | 0.3 | 0.578 | 0.917 | 0.709 | 0.761 |
| very_poor | 72 | 0.4 | 0.635 | 0.879 | 0.737 | 0.662 |
| very_poor | 72 | 0.5 | 0.668 | 0.834 | 0.742 | 0.542 |
| severe | 72 | 0.2 | 0.215 | 0.554 | 0.309 | 0.411 |
| severe | 72 | 0.3 | 0.204 | 0.224 | 0.214 | 0.128 |
| severe | 72 | 0.4 | 0.2 | 0.084 | 0.118 | 0.053 |
| severe | 72 | 0.5 | 0.193 | 0.025 | 0.044 | 0.016 |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 84,467 | 0.831/0.795/0.813 | 0.788/0.796/0.792 | 17,190 | 0.228 | 0.0 |
| very_poor (>120) | 24 | 62,866 | 0.793/0.712/0.75 | 0.744/0.75/0.747 | 15,701 | 0.19 | 0.0 |
| severe (>250) | 24 | 17,692 | 0.604/0.107/0.181 | 0.554/0.562/0.558 | 7,756 | 0.001 | 0.0 |
| poor (>90) | 48 | 85,025 | 0.822/0.752/0.786 | 0.758/0.77/0.764 | 19,578 | 0.23 | 0.0 |
| very_poor (>120) | 48 | 63,297 | 0.761/0.693/0.725 | 0.703/0.712/0.708 | 18,226 | 0.253 | 0.0 |
| severe (>250) | 48 | 17,705 | 0.382/0.006/0.012 | 0.445/0.454/0.45 | 9,661 | 0.0 | 0.0 |
| poor (>90) | 72 | 85,523 | 0.83/0.727/0.775 | 0.746/0.758/0.752 | 20,694 | 0.259 | 0.0 |
| very_poor (>120) | 72 | 63,784 | 0.748/0.609/0.671 | 0.691/0.7/0.696 | 19,117 | 0.246 | 0.0 |
| severe (>250) | 72 | 17,788 | 0.317/0.001/0.002 | 0.398/0.406/0.402 | 10,569 | 0.0 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.809 (mean width 124.4 µg/m³); P(>90) Brier 0.1175 vs climatology 0.2415 (skill +51.4%); P(>120) Brier 0.1147 vs climatology 0.2113 (skill +45.7%); P(>250) Brier 0.0748 vs climatology 0.0781 (skill +4.2%)
- **+48h**: 80% PI empirical coverage 0.807 (mean width 145.6 µg/m³); P(>90) Brier 0.1286 vs climatology 0.2416 (skill +46.8%); P(>120) Brier 0.1278 vs climatology 0.2116 (skill +39.6%); P(>250) Brier 0.0757 vs climatology 0.0778 (skill +2.8%)
- **+72h**: 80% PI empirical coverage 0.784 (mean width 142.1 µg/m³); P(>90) Brier 0.1315 vs climatology 0.242 (skill +45.7%); P(>120) Brier 0.132 vs climatology 0.2125 (skill +37.9%); P(>250) Brier 0.074 vs climatology 0.0781 (skill +5.2%)

## Meteorology ablation

- +24h: RMSE with ERA5 met 68.22 vs without 72.24 → met contributes 5.6%
- +48h: RMSE with ERA5 met 72.0 vs without 75.81 → met contributes 5.0%
- +72h: RMSE with ERA5 met 74.84 vs without 79.77 → met contributes 6.2%

_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._