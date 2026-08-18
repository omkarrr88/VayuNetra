# Self-computed forecast exposure — who the forecast puts in bad air

`GET /exposure?city=<id>` · `ml/impact/exposure.py` · shown in *City Statistics → Who is in the forecast?*

## What is computed

For every horizon h ∈ {24, 48, 72}:

    expected people in band  =  Σ_cells  pop_cell × P(PM2.5_cell,h > band)

* `P(·)` is the **calibrated exceedance probability** stored on each forecast row
  (`forecasts.p_over_120`, `p_over_250` — split-conformal residual distribution from a
  held-out calibration tail, `ml.forecast.train`). So this is an *expectation*, not a
  head-count from a point forecast that may or may not cross a threshold.
* `pop_cell` is **GPW v4.11** gridded population sampled per H3 cell (`connectors.population`,
  Earth Engine) where present (Delhi, Bengaluru, Mumbai today); otherwise the **cited city
  population** (`ml.impact.factors.CITY_POPULATION`, UN WUP 2018) spread uniformly over the
  forecast cells. The response's `population_basis` says which, and the UI prints it.
* Also reported: point-forecast head-count for comparison (`people_*_point`),
  population-weighted mean PM2.5 per horizon, and **person-hours** in band across the
  24 → 72 h outlook (trapezoid between horizons).

## What is deliberately not computed

* **Attributable deaths for a 3-day window.** A concentration-response function belongs on
  annual means; the annual health burden (deaths, ₹) with citations is in `ml.impact.quantify`
  and the ROI panel. Short-term exposure here is *exposure*, and is labelled that way.
* Any density variation inside a cell. Where GPW is absent the uniform basis is an
  order-of-magnitude figure and is labelled as such.

## Reading it in the finale

"At +48 h the model expects **X lakh** Delhi residents in Very Poor air and **Y lakh** in
Severe air (probability-weighted, GPW population); ≈ Z crore person-hours of Very Poor air
over the outlook" — every term traceable to a stored forecast row and a cited population
source. Compare with a reactive system: it acts at 0 h, when those people are already
breathing it.
