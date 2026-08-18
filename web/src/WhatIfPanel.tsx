// E3 what-if simulator + E7 impact — pick an intervention, run the counterfactual,
// see ΔAQI and the cited health/carbon payoff. Consumes POST /simulate.
import { useState } from "react";
import { api } from "./api";
import ImpactCards, { type ImpactData } from "./ImpactCards";
import { Panel, SegBtn, Step } from "./ui";
import { Cols } from "./console/Cols";

type SimResult = ImpactData & {
  delta_aqi_by_cell?: Record<string, number>;
  confidence?: number;
  intervention?: { type: string; description?: string; ward?: string; horizon_h?: number };
};

type OptimizerPackage = {
  interventions: Array<string | { type?: string; target?: string }>;
  total_cost?: number;
  inspector_hours?: number;
  people_protected?: number;
  score?: number;
  rubric_score?: number;
  description?: string;
};

type OptimizerResult = {
  budget?: number;
  packages?: OptimizerPackage[];
};

const INTERVENTIONS = [
  { id: "waste_burn_ban", label: "Crop-residue / waste burn ban" },
  { id: "construction_halt", label: "Halt construction dust" },
  { id: "traffic_restriction", label: "Traffic restriction (odd-even)" },
  { id: "industrial_shutdown", label: "Industrial shutdown" },
  { id: "grap_stage3", label: "GRAP Stage III (combined)" },
];

const LABEL_BY_ID = Object.fromEntries(INTERVENTIONS.map((i) => [i.id, i.label]));

function interventionLabel(item: OptimizerPackage["interventions"][number]): string {
  if (typeof item === "string") return LABEL_BY_ID[item] ?? item.replace(/_/g, " ");
  const type = item.type ?? "intervention";
  return item.target ? `${LABEL_BY_ID[type] ?? type.replace(/_/g, " ")}: ${item.target}` : type.replace(/_/g, " ");
}

function packageCost(pkg: OptimizerPackage): number {
  return Number(pkg.total_cost ?? pkg.inspector_hours ?? 0);
}

function packageScore(pkg: OptimizerPackage): number {
  return Number(pkg.score ?? pkg.rubric_score ?? 0);
}

export default function WhatIfPanel({ city }: { city: string }) {
  const [type, setType] = useState("waste_burn_ban");
  const [horizon, setHorizon] = useState(24);
  const [res, setRes] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [budget, setBudget] = useState(20);
  const [opt, setOpt] = useState<OptimizerResult | null>(null);
  const [optLoading, setOptLoading] = useState(false);
  const [optErr, setOptErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const data = await api<SimResult>("/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, intervention_type: type, horizon_h: horizon }),
      });
      setRes(data);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function optimize() {
    setOptLoading(true);
    setOptErr(null);
    try {
      const data = await api<OptimizerResult>("/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, budget_inspector_hours: budget }),
      });
      setOpt(data);
    } catch (e) {
      setOpt(null);
      setOptErr((e as Error).message || "Optimizer failed");
    } finally {
      setOptLoading(false);
    }
  }

  const deltas = res ? Object.values(res.delta_aqi_by_cell ?? {}) : [];
  const avgDelta = deltas.length ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : 0;
  const bestDelta = deltas.length ? Math.min(...deltas) : 0;

  return (
    <>
    <Cols>
    <Step n={1} label="Choose an intervention" info={<p>Pick an intervention and a horizon; the counterfactual runs over this city's live attribution shares and forecasts.</p>}>
    <Panel title="Choose an intervention" tag="what-if">
      <div className="text-xs text-slate-600">
        Counterfactual over attribution × forecast, with cited health &amp; carbon impact.
      </div>

      <div className="mt-3 space-y-2">
        <label className="block text-xs">
          <span className="text-slate-500">Intervention</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-medium text-slate-700"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {INTERVENTIONS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Horizon</span>
          {[24, 48, 72].map((h) => (
            <SegBtn key={h} active={horizon === h} onClick={() => setHorizon(h)}>
              +{h}h
            </SegBtn>
          ))}
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Simulating…" : "Run simulation"}
        </button>
      </div>

      {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
    </Panel>
</Step>

      {/* 2 — the result: ΔAQI per cell + cited health/₹/CO₂e cards */}
      <Step n={2} label="Run & read the result" info={<p>Counterfactual over attribution shares × forecasts (E3) with cited WHO AirQ+ health economics (E7). A near-zero effect is reported as such — the engine never inflates an intervention that does not match the dominant source. Missing inputs return null, never a made-up number.</p>}>
      <Panel title="Result" tag={res ? `+${horizon}h · ${deltas.length} cells` : "run a simulation"}>
      {!res && (
        <div className="text-xs leading-5 text-slate-500">
          Choose an intervention above and press <b>Run simulation</b>. You will get the change in AQI per cell,
          the people protected, and the health cost avoided — each with its citation.
        </div>
      )}
      {res && (
        <div>
          {res.intervention?.description && (
            <div className="text-xs font-medium text-slate-800">{res.intervention.description}</div>
          )}
          {res.intervention?.ward && <div className="text-[11px] text-slate-500">{res.intervention.ward}</div>}
          {Number(avgDelta) === 0 && (
            <div className="mt-2 rounded-md bg-amber-50 p-2 text-[11px] leading-4 text-amber-800">
              Near-zero effect — honest result: this source contributes ~0% of the city's current
              PM2.5 mix (see the blame map), so banning it changes little today. Try an intervention
              matching the dominant source, e.g. a traffic or construction measure.
            </div>
          )}
          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-700">
            <span>
              avg ΔAQI <b>{avgDelta}</b>
            </span>
            <span>
              best cell ΔAQI <b>{bestDelta}</b>
            </span>
            <span>
              cells affected <b>{deltas.length}</b>
            </span>
            <span>
              confidence <b>{res.confidence != null ? `${Math.round(res.confidence * 100)}%` : "—"}</b>
            </span>
          </div>
          <ImpactCards data={res} />
        </div>
      )}
      </Panel>
      </Step>
      </Cols>

      {/* 3 — best bundle under a budget */}
      <Step n={3} label="Best bundle for a budget" info={<p>The optimiser ranks intervention packages under an inspector-hour budget — which set of actions buys the most ΔAQI for the effort available today.</p>}>
      <Panel title="Best bundle for a budget" tag="optimizer">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs text-slate-600">Ranked actions under the inspector-hour budget.</div>
          </div>
          <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            {budget}h
          </span>
        </div>

        <label className="mt-3 block text-xs">
          <span className="text-slate-500">Inspector-hour budget</span>
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="mt-1 w-full accent-blue-600"
          />
        </label>
        <button
          onClick={optimize}
          disabled={optLoading}
          className="mt-2 w-full rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {optLoading ? "Ranking packages..." : "Rank packages"}
        </button>

        {optErr && (
          <div className="mt-2 rounded border border-red-100 bg-red-50 p-2 text-xs text-red-700">
            Optimizer unavailable: {optErr}
          </div>
        )}

        {opt?.packages?.length ? (
          <div className="mt-3 space-y-2">
            {opt.packages.map((pkg, idx) => (
              <div key={`${idx}-${pkg.description ?? pkg.interventions.map(interventionLabel).join("-")}`} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-800">Package #{idx + 1}</div>
                  <div className="text-[11px] text-slate-500">
                    score <b className="text-slate-700">{packageScore(pkg).toFixed(0)}</b>
                  </div>
                </div>
                {pkg.description && <div className="mt-1 text-xs text-slate-600">{pkg.description}</div>}
                <div className="mt-1 flex flex-wrap gap-1">
                  {pkg.interventions.map((item, itemIdx) => (
                    <span key={`${itemIdx}-${interventionLabel(item)}`} className="rounded bg-white px-1.5 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200">
                      {interventionLabel(item)}
                    </span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <span>
                    people protected <b className="text-slate-900">{Number(pkg.people_protected ?? 0).toLocaleString()}</b>
                  </span>
                  <span>
                    inspector-hours <b className="text-slate-900">{packageCost(pkg)}</b>
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          opt && <div className="mt-2 text-xs text-slate-500">No feasible package returned for this budget.</div>
        )}
      </div>
      </Panel>
      </Step>
    </>
  );
}
