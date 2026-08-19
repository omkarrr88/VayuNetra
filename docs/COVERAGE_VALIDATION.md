# The 1 km field, validated against real held-out stations

*Run 19 August 2026 — `scripts/validate_dense_field.py --all --write`, raw output in
`docs/COVERAGE_VALIDATION.json`.*

## What was tested, and why this test and not the other one

The dense field interpolates sparse station readings onto every ~1 km H3 cell. Its published skill —
**+55.3% over bilinear interpolation** — was measured on **synthetic fields**, over 64 samples. That
number establishes that the downscaler learns something. It does not establish the thing the phrase
"1 km resolution" is taken to mean: that a cell **without** a monitor carries a number you can act on.

This is the test that settles that. For each city, for each station in turn:

> hide that station → rebuild the field from the remaining stations → read what the field predicts
> at the hidden cell → compare against what that station actually measured.

Scored against the two baselines a sceptic reaches for first:

- **city mean** — predict the city average everywhere. The "why bother with a grid at all" baseline.
- **IDW of the remaining stations** — classical inverse-distance weighting, no model.

## The result

| city | stations | observed sd | RMSE field | RMSE IDW | RMSE city mean | skill vs city mean | skill vs IDW |
|---|---:|---:|---:|---:|---:|---:|---:|
| lucknow | 5 | 9.6 | 13.50 | 12.65 | 8.56 | **−0.577** | −0.067 |
| jaipur | 6 | 18.6 | 22.75 | 20.68 | 16.99 | **−0.339** | −0.100 |
| chennai | 6 | 11.8 | 14.35 | 16.21 | 10.78 | **−0.331** | +0.115 |
| hyderabad | 10 | 5.0 | 5.73 | 6.71 | 4.74 | **−0.210** | +0.145 |
| bengaluru | 9 | 80.5 | 90.38 | 96.51 | 75.85 | **−0.192** | +0.064 |
| mumbai | 18 | 12.3 | 14.14 | 17.18 | 11.97 | **−0.181** | +0.177 |
| kolkata | 8 | 15.3 | 16.43 | 17.87 | 14.28 | **−0.150** | +0.081 |
| delhi | 15 | 14.9 | 15.99 | 16.83 | 14.35 | **−0.114** | +0.050 |
| ahmedabad | 7 | 15.8 | 15.50 | 15.97 | 14.62 | **−0.060** | +0.030 |
| pune | 9 | 11.8 | 10.56 | 10.30 | 11.14 | **+0.052** | −0.026 |

**One city in ten beats predicting the city average**, and it beats it by five percent.

## What this means, stated plainly

**The dense field does not resolve real spatial variation.** At a held-out station, in nine of ten
cities, you would do better predicting the city average than reading our 1 km field.

The pattern is consistent and it is informative: the field beats classical IDW in seven of ten
cities, and loses to a flat number in nine. So the downscaler is doing *something* — it is a better
interpolator than inverse-distance weighting — but the quantity it is interpolating is largely not
spatially predictable at 1 km from the covariates available. It adds smoothness, not skill.

That is not a surprising physical result. Station-to-station differences at this scale are driven by
immediate local sources — a roadside monitor beside a junction, a background site in a park — which
no land-use prior derived from OpenStreetMap footprints is going to recover. It does mean the honest
description of the field changes.

## What we now say, and what we stop saying

**Stop saying:** "validated 1 km hyperlocal predictions", "1 km accuracy", or anything that implies a
cell without a monitor carries a measured value.

**Say:** the grid is genuinely 1 km (3,466 H3 cells for Delhi) and every cell carries a value, but
that value is a **spatial prior for visualisation and for ranking, not a measurement**. The measured
quantity is the station reading. Where a decision depends on a number, it should lean on the cell's
station support — which the API already reports as `n_support` — and on the city aggregate.

**And say this too, because it is the stronger point:** we ran the test that could have embarrassed
us, it did, and the number is published here with the script that produced it. A team that only
publishes the synthetic result is a team that did not run this one.

## Caveats a reader should apply

- **Regime.** These are monsoon readings. Concentrations are low and spatially homogeneous, which is
  exactly the regime in which a constant is hardest to beat. A winter run with strong gradients could
  read differently — that is a reason to re-run in December, not a reason to discount this.
- **Sample size.** Five to eighteen stations per city. Wide intervals; treat city-to-city ordering as
  indicative rather than a ranking.
- **Bengaluru's numbers are large** (RMSE 90 against sd 80) because one station is an extreme
  outlier in the current window. The skill figure is still comparable because every baseline sees the
  same outlier.
- **This tests the field, not the forecast.** Forecast skill is measured separately in
  `docs/BENCHMARKS.md` and is positive in eight of ten cities.

## Reproducing it

```bash
.venv/bin/python scripts/validate_dense_field.py --city delhi     # one city, printed
.venv/bin/python scripts/validate_dense_field.py --all --write    # all ten, writes the JSON
```
