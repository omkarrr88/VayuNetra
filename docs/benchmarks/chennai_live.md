# Forecast benchmark — chennai (live)

Window 2026-07-12 → 2026-08-19, test from **2026-08-10** (single temporal split; train strictly before each test origin). 6 station cells, 5,039 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-19T14:52Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 711 | 13.33 | 16.22 | 13.67 | **12.67** | +5.0% | 12.68 | +4.8% |
| non_winter | 24 | 711 | 13.33 | 16.22 | 13.67 | **12.67** | +5.0% | 12.68 | +4.8% |
| full_test | 48 | 607 | 14.34 | 14.16 | 14.1 | **13.65** | +4.8% | 13.65 | +4.8% |
| non_winter | 48 | 607 | 14.34 | 14.16 | 14.1 | **13.65** | +4.8% | 13.65 | +4.8% |
| full_test | 72 | 491 | 15.76 | 15.15 | 15.11 | **14.78** | +6.2% | 14.78 | +6.2% |
| non_winter | 72 | 491 | 15.76 | 15.15 | 15.11 | **14.78** | +6.2% | 14.78 | +6.2% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.95]; +48h [1.0]; +72h [1.0]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 2 | 213.69 | 213.18 | **212.37** | +0.6% |
| observed_over_120 | 24 | 1 | 293.0 | 293.0 | **292.07** | +0.3% |
| observed_over_250 | 24 | 1 | 293.0 | 293.0 | **292.07** | +0.3% |
| observed_over_90 | 48 | 2 | 208.65 | 215.52 | **212.67** | -1.9% |
| observed_over_120 | 48 | 1 | 286.4 | 296.4 | **293.0** | -2.3% |
| observed_over_250 | 48 | 1 | 286.4 | 296.4 | **293.0** | -2.3% |
| observed_over_90 | 72 | 2 | 213.55 | 212.87 | **211.69** | +0.9% |
| observed_over_120 | 72 | 1 | 294.25 | 292.55 | **291.61** | +0.9% |
| observed_over_250 | 72 | 1 | 294.25 | 292.55 | **291.61** | +0.9% |

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
| poor (>90) | 24 | 2 | None/0.0/None | 0.0/0.0/0.0 | 2 | 0.0 | 0.0 |
| very_poor (>120) | 24 | 1 | None/0.0/None | None/0.0/None | 1 | 0.0 | 0.0 |
| severe (>250) | 24 | 1 | None/0.0/None | None/0.0/None | 1 | 0.0 | 0.0 |
| poor (>90) | 48 | 2 | None/0.0/None | 0.0/0.0/0.0 | 2 | 0.0 | 0.0 |
| very_poor (>120) | 48 | 1 | None/0.0/None | None/0.0/None | 1 | 0.0 | 0.0 |
| severe (>250) | 48 | 1 | None/0.0/None | None/0.0/None | 1 | 0.0 | 0.0 |
| poor (>90) | 72 | 2 | None/0.0/None | 0.0/0.0/0.0 | 2 | 0.0 | 0.0 |
| very_poor (>120) | 72 | 1 | None/0.0/None | None/0.0/None | 1 | 0.0 | 0.0 |
| severe (>250) | 72 | 1 | None/0.0/None | None/0.0/None | 1 | 0.0 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.823 (mean width 14.8 µg/m³); P(>90) Brier 0.0028 vs climatology 0.0028 (skill -0.1%); P(>120) Brier 0.0014 vs climatology 0.0014 (skill -0.0%); P(>250) Brier 0.0014 vs climatology 0.0014 (skill -0.2%)
- **+48h**: 80% PI empirical coverage 0.822 (mean width 16.4 µg/m³); P(>90) Brier 0.0033 vs climatology 0.0033 (skill -0.3%); P(>120) Brier 0.0016 vs climatology 0.0016 (skill -0.2%); P(>250) Brier 0.0016 vs climatology 0.0016 (skill -0.2%)
- **+72h**: 80% PI empirical coverage 0.802 (mean width 17.2 µg/m³); P(>90) Brier 0.0041 vs climatology 0.0041 (skill -0.4%); P(>120) Brier 0.002 vs climatology 0.002 (skill -0.2%); P(>250) Brier 0.002 vs climatology 0.002 (skill -0.2%)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._