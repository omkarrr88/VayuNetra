# Forecast benchmarks — the numbers we are willing to be judged on

Every figure below is produced by `python -m ml.eval.benchmark` from real CPCB station data
and written to `docs/benchmarks/<city>.json` + `.md`. The API serves those files unchanged
(`GET /metrics/benchmark?city=`), the console renders them (*Forecast → Forecast validation*),
and nothing is typed in by hand. Negative numbers are kept.

## Protocol (what a sceptical reviewer would impose)

| rule | how |
|---|---|
| Strict temporal split | train strictly before each test origin; no shuffling, no leakage of future rows |
| Production-faithful | same LightGBM class/params as `ml.forecast.train`; **rolling monthly refit on the trailing 90 days** — exactly the retention window the deployed pipeline retrains on |
| Hard baselines | persistence (`tomorrow = today`), weekly seasonal-naive, hour-of-day climatology fitted before the split |
| One shared support mask | every forecaster is scored on the same station-hours |
| Regimes kept apart | full test · winter (Nov–Feb) · non-winter · hours above 90 / 120 / 250 µg/m³ |
| Beyond RMSE | alarm precision/recall, **onset recall** (clean → bad transitions) for the median alarm and for operating points on the calibrated probability (τ = 0.2–0.5), calibrated exceedance probability (Brier vs climatology, reliability bins), 80 % interval coverage, meteorology ablation, raw-vs-blended model |

## Delhi — multi-season, 39 station cells, 451 k station-hours (Feb 2025 → Aug 2026)

Test window: **1 Nov 2025 → 15 Aug 2026** — the entire 2025-26 winter plus spring/summer 2026;
208 k test station-hours at 24 h. (`docs/benchmarks/delhi.md`)

| horizon | RMSE persistence | seasonal-naive | **served forecast** | skill vs persistence | raw LightGBM alone | winter only | non-winter | Very-Poor hours (>120) | onset recall >120 — alarm on P ≥ 0.3 (median alarm) · persistence = 0 | 80 % PI coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| +24 h | 67.0 | 82.3 | **61.0** | **+9.1 %** | +1.7 % | +6.7 % | +15.3 % | +6.5 % | **54 %** (24 %) | 0.78 |
| +48 h | 77.7 | 84.2 | **67.7** | **+12.9 %** | +9.7 % | +11.4 % | +17.9 % | +10.6 % | **54 %** (31 %) | 0.78 |
| +72 h | 82.2 | 85.7 | **72.2** | **+12.1 %** | +9.4 % | +10.6 % | +17.4 % | +10.0 % | **51 %** (26 %) | 0.77 |

Calibrated exceedance probability, Brier skill vs climatology: P(>120) **+51.3 % / +45.6 % / +37.9 %**,
P(>250) **+30.7 % / +17.5 % / +10.3 %** at 24/48/72 h. Alarm on P(>120) ≥ 0.3: precision
0.68 / 0.66 / 0.64, F1 0.77 / 0.74 / 0.72 vs persistence's
0.75 / 0.71 / 0.70. Rows with physically implausible readings
(negatives, 100,000-class glitches) are dropped by the same guard production uses.

**What "served forecast" means.** Production serves the LightGBM median **blended with persistence**,
w·model + (1−w)·persistence, with w chosen per training origin on its own calibration tail (no test
leakage; the same rule ships in `ml.forecast.train.blend_weight`; typical Delhi w = 0.4–0.8). The raw
LightGBM column shows what the blend adds: at 24 h it turns +1.7 % into +9.1 % and a −4.2 % winter into
+6.7 %; the Severe tail goes from −22 % to ≈ 0 %.

**Honest read.** We beat persistence at every horizon overall (+9 / +13 / +12 %), in winter
(+7 / +11 / +11 %) and on Very-Poor hours (+7 / +11 / +10 %); on the Severe tail we only match
it. The blend costs some sharpness on the *median* alarm (onset recall 24–31 % vs 35–38 % for the raw
model) — which is exactly why the product alarms on the **calibrated probability**: at P(>120) ≥ 0.3
it flags **54 / 54 / 51 %** of clean→Very-Poor onsets 1–3 days ahead with better F1 than persistence,
which is structurally 0 on onsets. Meteorology (ERA5) is worth ~2 % RMSE at 24 h.

**Design finding kept in the record.** With an *expanding* training window (`delhi_expanding.md`)
winter skill is +3.7 / +10.9 / +11.7 % vs +6.7 / +11.4 / +10.6 % on the trailing 90 days — the short
window wins where it matters most (24 h in winter), so production retrains on a rolling 90 days.

## Mumbai — multi-season, 27 station cells, 142 k test station-hours (Feb 2025 → Aug 2026)

Same protocol (`docs/benchmarks/mumbai.md`). Served-forecast skill vs persistence **+16.5 % / +19.1 % / +21.3 %** at
24/48/72 h; winter **+15.2 % / +17.1 % / +20.1 %**. Mumbai's coastal regime is where the model earns its
keep most consistently. Very-Poor hours are rare there (1.6 k of 117 k), so onset recall is reported but small.

## Kolkata — multi-season, 10 station cells (Feb 2025 → Aug 2026)

Same protocol (`docs/benchmarks/kolkata.md`). Served-forecast skill vs persistence **+14.1 % / +9.6 % / +9.2 %** at
24/48/72 h; winter +12.4 % / +13.0 % / +8.3 %; onset recall at P ≥ 0.3 19 % / 18 % / 6 %.
A thin station network (10 sites) and few severe hours make Kolkata our weakest multi-season city, and the
artifact says so.

## Live 90-day window — all 10 cities

`docs/benchmarks/<city>_live.md`: last-quarter temporal split on the live database (monsoon
2026 for every city). Reported for completeness — clean-season windows have few or no
Very-Poor hours, so the episode slices are mostly empty there and say so.

## Comparison to the official system

CEEW (Oct 2025) audited Delhi's WRF-Chem AQEWS: 5 of 14 'severe and above' episodes caught in
winter 2024-25 (POD 36 %), PM2.5 mean bias −24 µg/m³ in winter. Our numbers are not directly
comparable (station-hour PM2.5 vs city-day AQI) and we do not claim to out-model WRF-Chem —
we claim a **calibrated, hyperlocal, publicly served** forecast whose skill and failure modes
are printed next to it. See `docs/POSITIONING.md`, `docs/EARLY_WARNING.md`.

## Reproduce

```bash
python scripts/fetch_history.py --city delhi --start 2025-02-18 --end 2026-08-15   # local, git-ignored
python -m ml.eval.benchmark --city delhi --source hist --split 2025-11-01 --protocol rolling --window-days 90
python -m ml.eval.benchmark --city delhi --source hist --split 2025-11-01 --protocol rolling            # expanding
python -m ml.eval.benchmark --city mumbai --source hist --split 2025-11-01 --protocol rolling --window-days 90
python -m ml.eval.benchmark --city bengaluru --source live                                             # 90-day live
```
