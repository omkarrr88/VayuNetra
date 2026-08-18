// E7 — health & carbon impact tiles + a "sources" drawer (every figure cited).
// Shared by the What-if panel; the shape matches the /simulate response.
import { useState } from "react";
import { inr, intfmt, num } from "./format";

export type Citation = {
  figure: string;
  value: number | string;
  unit: string;
  source: string;
  caveat?: string;
};

export type ImpactData = {
  people_protected?: number;
  cases_prevented?: number;
  health_cost_avoided_inr?: number;
  co2e_tonnes?: number | null;
  exposure_hours_reduced?: number;
  impact?: { method?: string; citations?: Citation[] };
};

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold leading-tight text-slate-900">{value}</div>
      {sub && <div className="text-[11px] leading-tight text-slate-500">{sub}</div>}
    </div>
  );
}

export function Citations({ items }: { items: Citation[] }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className="mt-2">
      <button className="text-[11px] text-blue-600 underline" onClick={() => setOpen((v) => !v)}>
        {open ? "hide sources" : `sources (${items.length}) — every figure is cited`}
      </button>
      {open && (
        <ul className="mt-1 space-y-1 text-[11px] text-slate-600">
          {items.map((c, i) => (
            <li key={i} className="border-l-2 border-slate-200 pl-2">
              <span className="font-medium">{c.figure}:</span> {String(c.value)} {c.unit} — {c.source}
              {c.caveat && <span className="italic text-slate-500"> ({c.caveat})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ImpactCards({ data }: { data: ImpactData }) {
  const co2e = data.co2e_tonnes;
  return (
    <div className="mt-2">
      <div className="grid grid-cols-2 gap-2">
        <Tile label="People protected" value={intfmt(data.people_protected)} />
        <Tile label="Health cost avoided" value={inr(data.health_cost_avoided_inr)} />
        <Tile
          label="Deaths averted"
          value={num(data.cases_prevented, 2)}
          sub="premature, over the window"
        />
        <Tile
          label="CO₂e co-benefit"
          value={co2e == null ? "n/a" : `${intfmt(co2e)} t`}
          sub={co2e == null ? "no combustion source" : "vs cited emission factor"}
        />
      </div>
      <Citations items={data.impact?.citations ?? []} />
    </div>
  );
}
