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
| Beyond RMSE | alarm precision/recall, **onset recall** (clean → bad transitions), calibrated exceedance probability (Brier vs climatology, reliability bins), 80 % interval coverage, meteorology ablation |

## Delhi — multi-season, 39 station cells, 451 k station-hours (Feb 2025 → Aug 2026)

Test window: **1 Nov 2025 → 15 Aug 2026** — the entire 2025-26 winter plus spring/summer 2026;
208 k test station-hours at 24 h. (`docs/benchmarks/delhi.md`)

| horizon | RMSE persistence | seasonal-naive | **model** | skill vs persistence | winter only | non-winter | Very-Poor hours (>120) | onset recall >120 (persistence = 0) | 80 % PI coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| +24 h | 67.1 | 82.3 | **65.9** | **+1.7 %** | −4.2 % | +18.2 % | −5.2 % | **35 %** | 0.78 |
| +48 h | 77.7 | 84.2 | **70.2** | **+9.7 %** | +6.7 % | +19.8 % | +4.7 % | **38 %** | 0.78 |
| +72 h | 82.2 | 85.7 | **74.4** | **+9.4 %** | +6.2 % | +21.0 % | +5.6 % | **38 %** | 0.77 |

Calibrated exceedance probability, Brier skill vs climatology: P(>120) **+49 / +43 / +32 %**,
P(>250) **+23 / +16 / +7 %** at 24/48/72 h. (Rows with physically implausible readings —
negatives, 100,000-class glitches — are dropped by the same guard production uses; the numbers
above are on cleaned data.)

**Honest read.** At 24 h the model is only marginally better than persistence overall (+1.7 %)
and slightly worse in winter (−4.2 %) — persistence is a genuinely hard baseline at one day.
From 48 h out we beat it everywhere (+9.7 / +9.4 % overall, +6.7 / +6.2 % in winter, +4.7 /
+5.6 % on Very-Poor hours), and outside winter by ~20 % at every horizon. We under-predict the
Severe tail (>250: −22/−12/−13 %). Onset recall on Very Poor (35–38 %) is the number that
matters for intervention — persistence is structurally 0 there. Meteorology (ERA5) is worth
~2 % RMSE at 24 h and nothing at 48 h — an honest ablation.

**Design finding kept in the record.** The same benchmark with an *expanding* training window
(`delhi_expanding.md`) is worse in winter (−9.3 / +3.5 / +4.9 %) than the 90-day window: monsoon
rows dilute winter behaviour. That is why production retrains on a rolling 90 days.

## Mumbai — multi-season, 27 station cells, 142 k test station-hours (Feb 2025 → Aug 2026)

Same protocol (`docs/benchmarks/mumbai.md`). Skill vs persistence **+17.6 / +19.0 / +21.1 %** at
24/48/72 h; winter **+18.3 / +17.0 / +19.7 %**. Mumbai's coastal regime is where the model earns
its keep most consistently. Very-Poor hours are rare there (1.6 k of 117 k), so onset recall is
reported but small.

## Kolkata — multi-season, 10 station cells (Feb 2025 → Aug 2026)

Same protocol (`docs/benchmarks/kolkata.md`). Skill vs persistence **+12.5 / +6.5 / −0.7 %** at
24/48/72 h; winter +9.9 / +8.6 / −5.3 %. Onset recall on Very Poor is only 4–5 % and the model
loses to persistence at 72 h — a thin station network (10 sites) and few severe hours make
Kolkata our weakest multi-season city, and the artifact says so.

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
