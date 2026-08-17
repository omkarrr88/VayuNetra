# Forecast benchmark — mumbai (hist)

Window 2025-02-18 → 2026-08-15, test from **2025-11-01** (rolling-origin monthly refit, 90-day training window; train strictly before each test origin). 27 station cells, 276,130 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T17:31Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 117,359 | 48.33 | 64.32 | 44.52 | **40.36** | +16.5% | 39.81 | +17.6% |
| winter_nov_feb | 24 | 44,527 | 56.1 | 75.77 | 53.15 | **47.58** | +15.2% | 45.83 | +18.3% |
| non_winter | 24 | 72,832 | 42.89 | 56.18 | 38.3 | **35.22** | +17.9% | 35.63 | +16.9% |
| full_test | 48 | 118,152 | 52.68 | 65.26 | 45.62 | **42.6** | +19.1% | 42.69 | +19.0% |
| winter_nov_feb | 48 | 45,541 | 61.39 | 74.61 | 55.22 | **50.87** | +17.1% | 50.93 | +17.0% |
| non_winter | 48 | 72,611 | 46.4 | 58.64 | 38.4 | **36.46** | +21.4% | 36.59 | +21.1% |
| full_test | 72 | 118,539 | 59.4 | 68.5 | 49.42 | **46.75** | +21.3% | 46.89 | +21.1% |
| winter_nov_feb | 72 | 46,172 | 65.06 | 75.54 | 56.66 | **51.95** | +20.1% | 52.25 | +19.7% |
| non_winter | 72 | 72,367 | 55.49 | 63.61 | 44.18 | **43.1** | +22.3% | 43.13 | +22.3% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.7, 0.5, 0.4, 1.0, 0.7, 0.75, 0.75, 0.9, 0.3, 1.0]; +48h [0.7, 0.65, 1.0, 1.0, 0.85, 0.9, 0.75, 1.0, 0.5, 0.95]; +72h [0.8, 0.9, 1.0, 0.95, 0.9, 0.95, 0.8, 1.0, 0.65, 0.9]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 4,207 | 179.75 | 203.75 | **184.46** | -2.6% |
| observed_over_120 | 24 | 1,558 | 281.65 | 324.28 | **295.86** | -5.0% |
| observed_over_250 | 24 | 793 | 376.27 | 439.47 | **400.8** | -6.5% |
| observed_over_90 | 48 | 4,303 | 199.0 | 206.8 | **199.04** | -0.0% |
| observed_over_120 | 48 | 1,608 | 307.69 | 329.28 | **318.64** | -3.6% |
| observed_over_250 | 48 | 816 | 412.05 | 447.92 | **433.38** | -5.2% |
| observed_over_90 | 72 | 4,368 | 226.66 | 231.1 | **226.88** | -0.1% |
| observed_over_120 | 72 | 1,656 | 353.09 | 367.67 | **362.82** | -2.8% |
| observed_over_250 | 72 | 852 | 474.6 | 499.9 | **493.52** | -4.0% |

## Probability alarms — alarm = P(> band) ≥ τ (operating points on the calibrated probability)

| band | h | τ | precision | recall | F1 | onset recall |
|---|---:|---:|---:|---:|---:|---:|
| poor | 24 | 0.2 | 0.291 | 0.434 | 0.348 | 0.19 |
| poor | 24 | 0.3 | 0.338 | 0.29 | 0.312 | 0.068 |
| poor | 24 | 0.4 | 0.353 | 0.203 | 0.258 | 0.032 |
| poor | 24 | 0.5 | 0.357 | 0.155 | 0.216 | 0.012 |
| very_poor | 24 | 0.2 | 0.261 | 0.135 | 0.178 | 0.01 |
| very_poor | 24 | 0.3 | 0.27 | 0.109 | 0.155 | 0.003 |
| very_poor | 24 | 0.4 | 0.256 | 0.089 | 0.132 | 0.003 |
| very_poor | 24 | 0.5 | 0.247 | 0.078 | 0.119 | 0.002 |
| severe | 24 | 0.2 | 0.254 | 0.066 | 0.104 | 0.0 |
| severe | 24 | 0.3 | 0.254 | 0.064 | 0.103 | 0.0 |
| severe | 24 | 0.4 | 0.258 | 0.064 | 0.103 | 0.0 |
| severe | 24 | 0.5 | 0.264 | 0.064 | 0.103 | 0.0 |
| poor | 48 | 0.2 | 0.209 | 0.213 | 0.211 | 0.074 |
| poor | 48 | 0.3 | 0.198 | 0.102 | 0.134 | 0.034 |
| poor | 48 | 0.4 | 0.199 | 0.062 | 0.094 | 0.012 |
| poor | 48 | 0.5 | 0.21 | 0.047 | 0.077 | 0.003 |
| very_poor | 48 | 0.2 | 0.133 | 0.038 | 0.059 | 0.001 |
| very_poor | 48 | 0.3 | 0.152 | 0.033 | 0.054 | 0.001 |
| very_poor | 48 | 0.4 | 0.16 | 0.031 | 0.052 | 0.001 |
| very_poor | 48 | 0.5 | 0.163 | 0.03 | 0.05 | 0.001 |
| severe | 48 | 0.2 | 0.162 | 0.033 | 0.055 | 0.0 |
| severe | 48 | 0.3 | 0.163 | 0.033 | 0.055 | 0.0 |
| severe | 48 | 0.4 | 0.16 | 0.032 | 0.053 | 0.0 |
| severe | 48 | 0.5 | 0.167 | 0.032 | 0.053 | 0.0 |
| poor | 72 | 0.2 | 0.107 | 0.099 | 0.103 | 0.054 |
| poor | 72 | 0.3 | 0.126 | 0.063 | 0.084 | 0.029 |
| poor | 72 | 0.4 | 0.161 | 0.041 | 0.065 | 0.011 |
| poor | 72 | 0.5 | 0.186 | 0.027 | 0.047 | 0.003 |
| very_poor | 72 | 0.2 | 0.121 | 0.025 | 0.042 | 0.003 |
| very_poor | 72 | 0.3 | 0.142 | 0.023 | 0.04 | 0.001 |
| very_poor | 72 | 0.4 | 0.146 | 0.022 | 0.038 | 0.0 |
| very_poor | 72 | 0.5 | 0.145 | 0.02 | 0.035 | 0.0 |
| severe | 72 | 0.2 | 0.211 | 0.019 | 0.034 | 0.0 |
| severe | 72 | 0.3 | 0.181 | 0.015 | 0.028 | 0.0 |
| severe | 72 | 0.4 | 0.082 | 0.006 | 0.011 | 0.0 |
| severe | 72 | 0.5 | 0.02 | 0.001 | 0.002 | 0.0 |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 4,207 | 0.358/0.144/0.205 | 0.352/0.35/0.351 | 2,734 | 0.004 | 0.0 |
| very_poor (>120) | 24 | 1,558 | 0.272/0.091/0.137 | 0.231/0.232/0.231 | 1,197 | 0.002 | 0.0 |
| severe (>250) | 24 | 793 | 0.263/0.064/0.103 | 0.302/0.304/0.303 | 552 | 0.0 | 0.0 |
| poor (>90) | 48 | 4,303 | 0.214/0.034/0.058 | 0.293/0.285/0.289 | 3,076 | 0.001 | 0.0 |
| very_poor (>120) | 48 | 1,608 | 0.167/0.03/0.051 | 0.17/0.16/0.165 | 1,350 | 0.001 | 0.0 |
| severe (>250) | 48 | 816 | 0.17/0.032/0.054 | 0.205/0.199/0.202 | 654 | 0.0 | 0.0 |
| poor (>90) | 72 | 4,368 | 0.23/0.023/0.042 | 0.23/0.221/0.225 | 3,402 | 0.001 | 0.0 |
| very_poor (>120) | 72 | 1,656 | 0.154/0.021/0.037 | 0.118/0.111/0.114 | 1,472 | 0.0 | 0.0 |
| severe (>250) | 72 | 852 | 0.037/0.002/0.004 | 0.137/0.124/0.13 | 746 | 0.0 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.816 (mean width 47.6 µg/m³); P(>90) Brier 0.0338 vs climatology 0.0346 (skill +2.1%); P(>120) Brier 0.0145 vs climatology 0.0131 (skill -10.6%); P(>250) Brier 0.0075 vs climatology 0.0067 (skill -11.1%)
- **+48h**: 80% PI empirical coverage 0.817 (mean width 50.4 µg/m³); P(>90) Brier 0.0361 vs climatology 0.0351 (skill -2.7%); P(>120) Brier 0.015 vs climatology 0.0134 (skill -11.8%); P(>250) Brier 0.0076 vs climatology 0.0069 (skill -11.2%)
- **+72h**: 80% PI empirical coverage 0.794 (mean width 56.0 µg/m³); P(>90) Brier 0.0372 vs climatology 0.0355 (skill -4.8%); P(>120) Brier 0.0151 vs climatology 0.0138 (skill -9.4%); P(>250) Brier 0.0074 vs climatology 0.0071 (skill -4.1%)

## Meteorology ablation

- +24h: RMSE with ERA5 met 39.81 vs without 40.14 → met contributes 0.8%
- +48h: RMSE with ERA5 met 42.69 vs without 42.72 → met contributes 0.1%
- +72h: RMSE with ERA5 met 46.89 vs without 46.62 → met contributes -0.6%

_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._