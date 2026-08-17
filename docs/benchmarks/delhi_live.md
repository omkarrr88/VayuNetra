# Forecast benchmark — delhi (live)

Window 2026-06-20 → 2026-08-17, test from **2026-08-02** (single temporal split; train strictly before each test origin). 22 station cells, 10,241 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-17T13:03Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 1,763 | 15.89 | 18.17 | 18.13 | **13.9** | +12.5% |
| non_winter | 24 | 1,763 | 15.89 | 18.17 | 18.13 | **13.9** | +12.5% |
| full_test | 48 | 1,618 | 17.17 | 18.12 | 18.0 | **15.11** | +12.0% |
| non_winter | 48 | 1,618 | 17.17 | 18.12 | 18.0 | **15.11** | +12.0% |
| full_test | 72 | 1,470 | 17.0 | 18.74 | 17.99 | **15.25** | +10.3% |
| non_winter | 72 | 1,470 | 17.0 | 18.74 | 17.99 | **15.25** | +10.3% |

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 9 | 46.14 | 56.67 | **56.13** | -21.7% |
| observed_over_90 | 48 | 8 | 46.2 | 49.61 | **56.33** | -21.9% |
| observed_over_90 | 72 | 8 | 46.25 | 49.61 | **55.75** | -20.6% |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 9 | None/0.0/None | 0.0/0.0/0.0 | 9 | 0.0 | 0.0 |
| very_poor (>120) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 24 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 48 | 8 | None/0.0/None | 0.0/0.0/0.0 | 8 | 0.0 | 0.0 |
| very_poor (>120) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 48 | 0 | None/None/None | None/None/None | 0 | None | None |
| poor (>90) | 72 | 8 | None/0.0/None | 0.0/0.0/0.0 | 8 | 0.0 | 0.0 |
| very_poor (>120) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |
| severe (>250) | 72 | 0 | None/None/None | None/None/None | 0 | None | None |

## Calibration

- **+24h**: 80% PI empirical coverage 0.727 (mean width 29.0 µg/m³); P(>90) Brier 0.0051 vs climatology 0.0051 (skill +0.0%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+48h**: 80% PI empirical coverage 0.741 (mean width 32.5 µg/m³); P(>90) Brier 0.0049 vs climatology 0.0049 (skill +0.0%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)
- **+72h**: 80% PI empirical coverage 0.703 (mean width 32.0 µg/m³); P(>90) Brier 0.0054 vs climatology 0.0054 (skill +0.1%); P(>120) Brier 0.0 vs climatology 0.0 (skill –); P(>250) Brier 0.0 vs climatology 0.0 (skill –)

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._