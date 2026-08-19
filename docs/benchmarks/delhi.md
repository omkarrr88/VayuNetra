# Forecast benchmark — delhi (hist)

Window 2025-02-17 → 2026-08-15, test from **2025-11-01** (rolling-origin monthly refit, 90-day training window; train strictly before each test origin). 39 station cells, 449,526 hourly rows. Model: LightGBM quantile (median) — same class/params as production (ml.forecast.train). Generated 2026-08-19T13:19Z by `python -m ml.eval.benchmark`.

## RMSE (µg/m³) on the shared support mask

| regime | h | n | persistence | seasonal-naive | climatology | **model (served: blended)** | skill vs persistence | raw LightGBM | raw skill |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| full_test | 24 | 207,225 | 67.05 | 82.26 | 104.17 | **60.96** | +9.1% | 65.92 | +1.7% |
| winter_nov_feb | 24 | 81,109 | 90.6 | 115.91 | 158.51 | **84.53** | +6.7% | 94.37 | -4.2% |
| non_winter | 24 | 126,116 | 45.91 | 49.78 | 40.89 | **38.87** | +15.3% | 37.57 | +18.2% |
| full_test | 48 | 208,113 | 77.73 | 84.16 | 104.16 | **67.71** | +12.9% | 70.2 | +9.7% |
| winter_nov_feb | 48 | 82,738 | 107.59 | 117.66 | 157.3 | **95.34** | +11.4% | 100.35 | +6.7% |
| non_winter | 48 | 125,375 | 48.88 | 51.2 | 40.99 | **40.14** | +17.9% | 39.19 | +19.8% |
| full_test | 72 | 208,247 | 82.15 | 85.68 | 104.52 | **72.18** | +12.1% | 74.39 | +9.4% |
| winter_nov_feb | 72 | 83,778 | 113.58 | 119.07 | 156.8 | **101.52** | +10.6% | 106.49 | +6.2% |
| non_winter | 72 | 124,469 | 51.07 | 52.34 | 41.56 | **42.18** | +17.4% | 40.33 | +21.0% |

Blend weights (w on model, chosen per training origin on its calibration tail): +24h [0.4, 0.5, 0.55, 0.9, 0.25, 0.85, 0.9, 0.85, 1.0, 0.65]; +48h [0.4, 0.65, 0.75, 0.95, 0.35, 0.8, 0.8, 0.9, 1.0, 0.75]; +72h [0.4, 0.6, 0.8, 0.8, 0.2, 0.7, 0.9, 0.9, 0.95, 0.75]

## High-pollution hours only (observed PM2.5 above band)

| band | h | n | persistence | seasonal-naive | **model** | skill vs persistence |
|---|---:|---:|---:|---:|---:|---:|
| observed_over_90 | 24 | 84,467 | 90.64 | 114.43 | **84.28** | +7.0% |
| observed_over_120 | 24 | 62,866 | 99.01 | 124.33 | **92.55** | +6.5% |
| observed_over_250 | 24 | 17,692 | 139.62 | 172.58 | **140.25** | -0.5% |
| observed_over_90 | 48 | 85,025 | 106.58 | 116.53 | **94.39** | +11.4% |
| observed_over_120 | 48 | 63,297 | 115.91 | 126.57 | **103.65** | +10.6% |
| observed_over_250 | 48 | 17,705 | 162.83 | 175.98 | **161.77** | +0.7% |
| observed_over_90 | 72 | 85,523 | 113.85 | 117.56 | **100.64** | +11.6% |
| observed_over_120 | 72 | 63,784 | 123.63 | 127.59 | **111.27** | +10.0% |
| observed_over_250 | 72 | 17,788 | 174.9 | 177.78 | **178.36** | -2.0% |

## Probability alarms — alarm = P(> band) ≥ τ (operating points on the calibrated probability)

| band | h | τ | precision | recall | F1 | onset recall |
|---|---:|---:|---:|---:|---:|---:|
| poor | 24 | 0.2 | 0.661 | 0.912 | 0.766 | 0.597 |
| poor | 24 | 0.3 | 0.742 | 0.868 | 0.8 | 0.438 |
| poor | 24 | 0.4 | 0.785 | 0.837 | 0.81 | 0.346 |
| poor | 24 | 0.5 | 0.817 | 0.804 | 0.81 | 0.259 |
| very_poor | 24 | 0.2 | 0.635 | 0.899 | 0.744 | 0.637 |
| very_poor | 24 | 0.3 | 0.683 | 0.87 | 0.765 | 0.54 |
| very_poor | 24 | 0.4 | 0.722 | 0.835 | 0.774 | 0.425 |
| very_poor | 24 | 0.5 | 0.757 | 0.791 | 0.774 | 0.293 |
| severe | 24 | 0.2 | 0.397 | 0.787 | 0.528 | 0.518 |
| severe | 24 | 0.3 | 0.478 | 0.663 | 0.556 | 0.243 |
| severe | 24 | 0.4 | 0.538 | 0.578 | 0.557 | 0.09 |
| severe | 24 | 0.5 | 0.584 | 0.504 | 0.541 | 0.016 |
| poor | 48 | 0.2 | 0.643 | 0.901 | 0.75 | 0.594 |
| poor | 48 | 0.3 | 0.731 | 0.851 | 0.786 | 0.424 |
| poor | 48 | 0.4 | 0.769 | 0.812 | 0.79 | 0.337 |
| poor | 48 | 0.5 | 0.803 | 0.77 | 0.786 | 0.273 |
| very_poor | 48 | 0.2 | 0.619 | 0.89 | 0.73 | 0.648 |
| very_poor | 48 | 0.3 | 0.661 | 0.851 | 0.744 | 0.544 |
| very_poor | 48 | 0.4 | 0.694 | 0.807 | 0.746 | 0.437 |
| very_poor | 48 | 0.5 | 0.726 | 0.755 | 0.74 | 0.333 |
| severe | 48 | 0.2 | 0.307 | 0.69 | 0.425 | 0.445 |
| severe | 48 | 0.3 | 0.38 | 0.534 | 0.444 | 0.211 |
| severe | 48 | 0.4 | 0.451 | 0.423 | 0.437 | 0.079 |
| severe | 48 | 0.5 | 0.502 | 0.348 | 0.411 | 0.02 |
| poor | 72 | 0.2 | 0.636 | 0.905 | 0.747 | 0.615 |
| poor | 72 | 0.3 | 0.716 | 0.854 | 0.779 | 0.436 |
| poor | 72 | 0.4 | 0.754 | 0.804 | 0.778 | 0.334 |
| poor | 72 | 0.5 | 0.773 | 0.75 | 0.761 | 0.298 |
| very_poor | 72 | 0.2 | 0.608 | 0.892 | 0.723 | 0.656 |
| very_poor | 72 | 0.3 | 0.636 | 0.842 | 0.725 | 0.512 |
| very_poor | 72 | 0.4 | 0.65 | 0.778 | 0.708 | 0.422 |
| very_poor | 72 | 0.5 | 0.673 | 0.698 | 0.685 | 0.336 |
| severe | 72 | 0.2 | 0.278 | 0.583 | 0.376 | 0.329 |
| severe | 72 | 0.3 | 0.375 | 0.46 | 0.413 | 0.187 |
| severe | 72 | 0.4 | 0.45 | 0.371 | 0.407 | 0.105 |
| severe | 72 | 0.5 | 0.486 | 0.309 | 0.378 | 0.05 |

## Early warning — alarm = forecast above band

| band | h | events | model P/R/F1 | persistence P/R/F1 | onsets | onset recall model | onset recall persistence |
|---|---:|---:|---|---|---:|---:|---:|
| poor (>90) | 24 | 84,467 | 0.794/0.822/0.808 | 0.788/0.796/0.792 | 17,190 | 0.256 | 0.0 |
| very_poor (>120) | 24 | 62,866 | 0.745/0.786/0.765 | 0.744/0.75/0.747 | 15,701 | 0.244 | 0.0 |
| severe (>250) | 24 | 17,692 | 0.596/0.451/0.514 | 0.554/0.562/0.558 | 7,756 | 0.012 | 0.0 |
| poor (>90) | 48 | 85,025 | 0.766/0.811/0.788 | 0.758/0.77/0.764 | 19,578 | 0.298 | 0.0 |
| very_poor (>120) | 48 | 63,297 | 0.704/0.773/0.737 | 0.703/0.712/0.708 | 18,226 | 0.312 | 0.0 |
| severe (>250) | 48 | 17,705 | 0.491/0.343/0.404 | 0.445/0.454/0.45 | 9,661 | 0.013 | 0.0 |
| poor (>90) | 72 | 85,523 | 0.753/0.804/0.778 | 0.746/0.758/0.752 | 20,694 | 0.295 | 0.0 |
| very_poor (>120) | 72 | 63,784 | 0.666/0.742/0.702 | 0.691/0.7/0.696 | 19,117 | 0.265 | 0.0 |
| severe (>250) | 72 | 17,788 | 0.497/0.28/0.358 | 0.398/0.406/0.402 | 10,569 | 0.002 | 0.0 |

## Calibration

- **+24h**: 80% PI empirical coverage 0.783 (mean width 145.1 µg/m³); P(>90) Brier 0.1153 vs climatology 0.2415 (skill +52.3%); P(>120) Brier 0.1029 vs climatology 0.2113 (skill +51.3%); P(>250) Brier 0.0541 vs climatology 0.0781 (skill +30.7%)
- **+48h**: 80% PI empirical coverage 0.781 (mean width 162.8 µg/m³); P(>90) Brier 0.1265 vs climatology 0.2416 (skill +47.7%); P(>120) Brier 0.1151 vs climatology 0.2116 (skill +45.6%); P(>250) Brier 0.0642 vs climatology 0.0778 (skill +17.5%)
- **+72h**: 80% PI empirical coverage 0.775 (mean width 170.9 µg/m³); P(>90) Brier 0.1415 vs climatology 0.242 (skill +41.5%); P(>120) Brier 0.1319 vs climatology 0.2125 (skill +37.9%); P(>250) Brier 0.0701 vs climatology 0.0781 (skill +10.3%)

### Coverage by predicted level

Grouped by *predicted* PM2.5, not observed — at forecast time the outcome is exactly
what we do not have, so this is the only breakdown a served band can be held to.
Every cell should read ~0.80; the worst in each row is bolded.

| horizon | Q1 lowest | Q2 | Q3 | Q4 | Q5 highest | overall |
|---|---|---|---|---|---|---|
| +24h | 0.827 | 0.768 | **0.704** | 0.8 | 0.816 | 0.783 |
| +48h | 0.799 | 0.736 | **0.731** | 0.831 | 0.81 | 0.781 |
| +72h | 0.784 | 0.769 | **0.705** | 0.821 | 0.793 | 0.775 |

- +24h quintile edges (µg/m³): 16.1 · 50.3 · 68.0 · 89.7 · 152.8 · 361.4
- +48h quintile edges (µg/m³): 16.9 · 51.8 · 68.0 · 99.6 · 159.9 · 338.5
- +72h quintile edges (µg/m³): 21.7 · 52.8 · 70.3 · 99.7 · 173.1 · 351.4

## Meteorology ablation


_Read honestly: persistence is the hard baseline for PM2.5; a positive skill on high-pollution hours and a non-zero onset recall are the numbers that matter for intervention. Negative numbers are kept, not hidden._