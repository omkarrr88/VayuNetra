# Forecast benchmark — chennai (live)

Window 2026-07-12 → 2026-08-19, test from **2026-08-10** (single temporal split; train strictly before each test origin). 6 station cells, 5,213 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-20T04:11Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 846 | 14.61 | 15.99 | 14.19 | **13.08** | +10.5% | 13.1 | +10.3% |
| non_winter | 24 | 846 | 14.61 | 15.99 | 14.19 | **13.08** | +10.5% | 13.1 | +10.3% |
| full_test | 48 | 729 | 18.99 | 14.32 | 14.7 | **13.91** | +26.8% | 13.91 | +26.8% |
| non_winter | 48 | 729 | 18.99 | 14.32 | 14.7 | **13.91** | +26.8% | 13.91 | +26.8% |
| full_test | 72 | 618 | 19.76 | 15.12 | 15.56 | **14.8** | +25.1% | 14.8 | +25.1% |
| non_winter | 72 | 618 | 19.76 | 15.12 | 15.56 | **14.8** | +25.1% | 14.8 | +25.1% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.95]; +48h [1.0]; +72h [1.0]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 3 | 197.15 | 197.16 | **193.91** | +1.6% |
| observed_over_120 | 24 | 2 | 235.72 | 236.2 | **232.2** | +1.5% |
| observed_over_250 | 24 | 1 | 293.0 | 293.0 | **292.08** | +0.3% |
| observed_over_90 | 48 | 3 | 192.78 | 197.36 | **194.96** | -1.1% |
| observed_over_120 | 48 | 2 | 230.71 | 236.45 | **233.9** | -1.4% |
| observed_over_250 | 48 | 1 | 286.4 | 296.4 | **292.35** | -2.1% |
| observed_over_90 | 72 | 3 | 197.32 | 194.97 | **194.36** | +1.5% |
| observed_over_120 | 72 | 2 | 236.84 | 233.45 | **233.18** | +1.5% |
| observed_over_250 | 72 | 1 | 294.25 | 292.55 | **291.32** | +1.0% |

## Probability alarms — alarm = P(> band) ≥ τ (operating points on the calibrated probability)

| band | h | τ | precision | recall | F1 | onset recall |
|---|---:|---:|---:|---:|---:|---:|
| poor | 24 | 0.2 | None | 0.0 | None | 0.0 |
| poor | 24 | 0.3 | None | 0.0 | None | 0.0 |
| poor | 24 | 0.4 | None | 0.0 | None | 0.0 |
| poor | 24 | 0.5 | None | 0.0 | None | 0.0 |
| very_poor | 24 | 0.2 | None | 0.0 | None | 0.0 |
| very_poor | 24 | 0.3 | None | 0.0 | None | 0.0 |
| very_poor | 24 | 0.4 | None | 0.0 | None | 0.0 |
| very_poor | 24 | 0.5 | None | 0.0 | None | 0.0 |
| severe | 24 | 0.2 | None | 0.0 | None | 0.0 |
| severe | 24 | 0.3 | None | 0.0 | None | 0.0 |
| severe | 24 | 0.4 | None | 0.0 | None | 0.0 |
| severe | 24 | 0.5 | None | 0.0 | None | 0.0 |
| poor | 48 | 0.2 | None | 0.0 | None | 0.0 |
| poor | 48 | 0.3 | None | 0.0 | None | 0.0 |
| poor | 48 | 0.4 | None | 0.0 | None | 0.0 |
| poor | 48 | 0.5 | None | 0.0 | None | 0.0 |
| very_poor | 48 | 0.2 | None | 0.0 | None | 0.0 |
| very_poor | 48 | 0.3 | None | 0.0 | None | 0.0 |
| very_poor | 48 | 0.4 | None | 0.0 | None | 0.0 |
| very_poor | 48 | 0.5 | None | 0.0 | None | 0.0 |
| severe | 48 | 0.2 | None | 0.0 | None | 0.0 |
| severe | 48 | 0.3 | None | 0.0 | None | 0.0 |
| severe | 48 | 0.4 | None | 0.0 | None | 0.0 |
| severe | 48 | 0.5 | None | 0.0 | None | 0.0 |
| poor | 72 | 0.2 | None | 0.0 | None | 0.0 |
| poor | 72 | 0.3 | None | 0.0 | None | 0.0 |
| poor | 72 | 0.4 | None | 0.0 | None | 0.0 |
| poor | 72 | 0.5 | None | 0.0 | None | 0.0 |
| very_poor | 72 | 0.2 | None | 0.0 | None | 0.0 |
| very_poor | 72 | 0.3 | None | 0.0 | None | 0.0 |
| very_poor | 72 | 0.4 | None | 0.0 | None | 0.0 |
| very_poor | 72 | 0.5 | None | 0.0 | None | 0.0 |
| severe | 72 | 0.2 | None | 0.0 | None | 0.0 |
| severe | 72 | 0.3 | None | 0.0 | None | 0.0 |
| severe | 72 | 0.4 | None | 0.0 | None | 0.0 |
| severe | 72 | 0.5 | None | 0.0 | None | 0.0 |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 3 | None/0.0/None | 0.0/0.0/0.0 | 3 | 0.0 | 0.0 |
| very_poor (>120) | 24 | 2 | None/0.0/None | 0.0/0.0/0.0 | 2 | 0.0 | 0.0 |
| severe (>250) | 24 | 1 | None/0.0/None | None/0.0/None | 1 | 0.0 | 0.0 |
| poor (>90) | 48 | 3 | None/0.0/None | 0.0/0.0/0.0 | 3 | 0.0 | 0.0 |
| very_poor (>120) | 48 | 2 | None/0.0/None | 0.0/0.0/0.0 | 2 | 0.0 | 0.0 |
| severe (>250) | 48 | 1 | None/0.0/None | 0.0/0.0/0.0 | 1 | 0.0 | 0.0 |
| poor (>90) | 72 | 3 | None/0.0/None | 0.0/0.0/0.0 | 3 | 0.0 | 0.0 |
| very_poor (>120) | 72 | 2 | None/0.0/None | 0.0/0.0/0.0 | 2 | 0.0 | 0.0 |
| severe (>250) | 72 | 1 | None/0.0/None | 0.0/0.0/0.0 | 1 | 0.0 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.812 (mean width 15.5 µg/m³); P(>90) Brier 0.0035 vs climatology 0.0035 (skill -0.2%); P(>120) Brier 0.0024 vs climatology 0.0024 (skill -0.1%); P(>250) Brier 0.0012 vs climatology 0.0012 (skill -0.2%)
- **+48h**: 80% PI empirical coverage 0.778 (mean width 16.5 µg/m³); P(>90) Brier 0.0041 vs climatology 0.0041 (skill -0.4%); P(>120) Brier 0.0027 vs climatology 0.0027 (skill -0.3%); P(>250) Brier 0.0014 vs climatology 0.0014 (skill -0.1%)
- **+72h**: 80% PI empirical coverage 0.814 (mean width 17.7 µg/m³); P(>90) Brier 0.0049 vs climatology 0.0048 (skill -0.5%); P(>120) Brier 0.0032 vs climatology 0.0032 (skill -0.3%); P(>250) Brier 0.0016 vs climatology 0.0016 (skill -0.2%)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._