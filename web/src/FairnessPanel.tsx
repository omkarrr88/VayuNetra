// Fairness audit — what actually drives enforcement priority, computed on the
// live recommendations (see metrics.ts FAIRNESS_AUDIT for method + as-of date).
import { FAIRNESS_AUDIT } from "./metrics";
import { Panel } from "./ui";

function Bar({ label, r, tone, note }: { label: string; r: number; tone: "blue" | "slate"; note: string }) {
  const width = `${Math.round(Math.abs(r) * 100)}%`;
  return (
    <div className="text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-gray-600">{label}</span>
        <span className="shrink-0 whitespace-nowrap font-mono font-bold text-slate-800">r = {r.toFixed(2)}</span>
      </div>
      <div className="mt-0.5 h-2 rounded bg-slate-100">
        <div className={`h-2 rounded ${tone === "blue" ? "bg-blue-600" : "bg-slate-400"}`} style={{ width }} />
      </div>
      <div className="mt-0.5 text-[11px] text-gray-400">{note}</div>
    </div>
  );
}

export default function FairnessPanel() {
  const f = FAIRNESS_AUDIT;
  return (
    <Panel title="Fairness audit" tag={`n=${f.n} live recs`}>
      <div className="text-xs text-gray-600">
        What drives enforcement priority — measured on every live recommendation across all cities ({f.asOf}):
      </div>
      <div className="mt-2.5 space-y-2.5">
        <Bar
          label="Pollution contribution"
          r={f.rContribution}
          tone="blue"
          note="the dominant driver — the system targets pollution, by design"
        />
        <Bar
          label="Population exposed (partial, controlling for contribution)"
          r={f.partialPopGivenContribution}
          tone="slate"
          note="deliberate exposure weighting — protecting more people ranks higher, and we disclose it"
        />
      </div>
      <div className="mt-2.5 rounded-md bg-emerald-50 p-2 text-xs leading-snug text-emerald-900">
        <b>No socio-economic inputs, by construction.</b> The scorer's only inputs are source
        contribution, population exposed, actionability, and model confidence — no income,
        land-value, or demographic feature exists anywhere in the pipeline or schema.
      </div>
      <div className="mt-1.5 text-[11px] text-gray-400">
        Ward-income partial-correlation audit is roadmap — it needs ward-level socio-economic data
        that no free public source provides today.
      </div>
    </Panel>
  );
}
