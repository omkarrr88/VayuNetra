// Honest model metrics, surfaced in the UI.
// Source: walk-forward backtests (3 folds) via `python -m ml.forecast.train --city <c>`
// run against the live Supabase data on 2026-07-06. Regenerate with eval/evaluate.ipynb.
// skill = 1 − RMSE_model / RMSE_baseline  (higher is better; 0 = no better than baseline)
//
// NOTE: these are POINT-IN-TIME SNAPSHOTS (see SKILL_ASOF below, shown in the UI
// tooltip). They drift as new data lands; re-run the backtests and update here —
// or replace with a /metrics endpoint if the drift ever matters more than a badge.

export type CitySkill = {
  n: number; // backtest samples @24h
  vsPersistence: Record<number, number>; // horizon_h -> skill
  vsClimatology: Record<number, number>;
};

export const FORECAST_SKILL: Record<string, CitySkill> = {
  delhi: {
    n: 27154,
    vsPersistence: { 24: 0.036, 48: 0.039, 72: 0.078 },
    vsClimatology: { 24: 0.307, 48: 0.181, 72: 0.158 },
  },
  bengaluru: {
    n: 3539,
    vsPersistence: { 24: 0.146, 48: 0.169, 72: 0.091 },
    vsClimatology: { 24: 0.142, 48: 0.045, 72: -0.07 },
  },
  mumbai: {
    n: 3584,
    vsPersistence: { 24: 0.148, 48: 0.178, 72: 0.3 },
    vsClimatology: { 24: 0.029, 48: 0.031, 72: 0.043 },
  },
};

export const SKILL_ASOF = "2026-07-06";

// Fairness audit over the LIVE enforcement recommendations (measured on the 3 launch cities; re-audit pending for the 7 added Aug 2026).
// Computed 2026-07-19 on n=390 recs: Pearson r of priority_score vs each
// disclosed input, and the partial correlation of population exposure after
// controlling for pollution contribution. The scorer's ONLY inputs are
// contribution, population exposed, actionability, and model confidence —
// no income, land-value, or demographic feature exists anywhere in the schema,
// so socio-economic bias cannot enter by construction. A ward-income
// partial-correlation audit is roadmap (needs ward socio-economic data).
export const FAIRNESS_AUDIT = {
  asOf: "2026-07-19",
  n: 390,
  rContribution: 0.946, // pollution contribution — the dominant driver, by design
  rPopExposed: 0.293, // exposure weighting — deliberate and disclosed
  partialPopGivenContribution: 0.453,
};

export function pct(x: number | undefined): string {
  if (x === undefined) return "–";
  return `${x >= 0 ? "+" : ""}${Math.round(x * 100)}%`;
}
