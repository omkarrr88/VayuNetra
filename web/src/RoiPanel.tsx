// E7 — City ROI dashboard: the annual PM2.5 health burden and the NCAP-target
// savings, i.e. "the funding case". Consumes GET /roi?city. Every figure cited.
import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from "recharts";
import SizedChart from "./SizedChart";
import { api } from "./api";
import { Citations, type Citation } from "./ImpactCards";
import { inr, intfmt } from "./format";
import { EmptyState, Panel, Step } from "./ui";

type Roi = {
  city_id: string;
  annual_pm25: number;
  who_guideline_pm25: number;
  population: number;
  attributable_deaths_per_year: number;
  annual_health_burden_inr: number;
  ncap_target_reduction_pct: number;
  deaths_avertable_per_year: number;
  annual_savings_inr: number;
  narrative: string;
  citations: Citation[];
};

type AttrCell = { shares?: Record<string, number> };

const FUND_HEAD: Record<string, string> = {
  traffic: "vehicular emission control",
  construction_dust: "C&D dust control",
  industrial: "industrial emission control",
  biomass_burning: "solid-waste / open-burning control",
  transported: "regional airshed coordination",
};

/** Attribution-weighted NCAP spending guidance — the answer to CREA's finding
 *  that NCAP cities put 67% of funds into road dust because they lacked
 *  attribution. Shares come straight from the live blame model. */
function FundGuidance({ city }: { city: string }) {
  const [mix, setMix] = useState<Array<[string, number]> | null>(null);

  useEffect(() => {
    let alive = true;
    setMix(null);
    api<AttrCell[]>(`/attribution?city=${city}`)
      .then((cells) => {
        if (!alive) return;
        const sums: Record<string, number> = {};
        let n = 0;
        for (const c of cells) {
          if (!c.shares) continue;
          n += 1;
          for (const [k, v] of Object.entries(c.shares)) sums[k] = (sums[k] ?? 0) + v;
        }
        const rows = Object.entries(sums)
          .map(([k, v]) => [k, (100 * v) / Math.max(1, n)] as [string, number])
          .filter(([k, pct]) => pct >= 5 && FUND_HEAD[k])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        setMix(rows);
      })
      .catch(() => alive && setMix([]));
    return () => {
      alive = false;
    };
  }, [city]);

  if (!mix || mix.length === 0) return null;
  return (
    <Step n={2} label="Where funds should go" info={<p>Attribution-weighted guidance across NCAP spending heads: the city's live source mix maps each share to the fund head that addresses it. Context: NCAP cities spent 67 % of funds on road dust and under 1 % on industry (CREA, 2026) because allocation was not attribution-led.</p>}>
    <Panel title="Where the funds should go" tag="attribution-weighted">
      <div className="space-y-0.5 text-xs text-gray-700">
        {mix.map(([k, pct]) => (
          <div key={k}>
            <b>{Math.round(pct)}%</b> of PM2.5 is {k.replace(/_/g, " ")} → prioritise{" "}
            <b>{FUND_HEAD[k]}</b>
          </div>
        ))}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-gray-500">
        NCAP cities spent 67% of funds on road dust and &lt;1% on industry (CREA, 2026) — because
        allocation wasn't attribution-led. This is the per-city fix.
      </div>
    </Panel>
    </Step>
  );
}

function Big({ label, value, tone }: { label: string; value: string; tone: "bad" | "good" }) {
  const cls =
    tone === "bad"
      ? "border-red-100 bg-red-50 text-red-700"
      : "border-emerald-100 bg-emerald-50 text-emerald-700";
  return (
    <div className={`rounded-md border p-2 ${cls}`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-700">{label}</div>
      <div className="text-lg font-semibold leading-tight">{value}</div>
    </div>
  );
}

export default function RoiPanel({ city }: { city: string }) {
  const [d, setD] = useState<Roi | null>(null);
  const [failed, setFailed] = useState(false);

  function load() {
    setFailed(false);
    api<Roi>(`/roi?city=${city}`).then(setD).catch(() => setFailed(true));
  }
  useEffect(load, [city]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d)
    return (
      <Panel title="City ROI — the funding case">
        {failed ? (
          <EmptyState message="Couldn't load the ROI figures." tone="error" onRetry={load} />
        ) : (
          <div className="h-24 animate-pulse rounded-md bg-slate-100" />
        )}
      </Panel>
    );

  const chart = [
    { name: "burden / yr", cr: Math.round(d.annual_health_burden_inr / 1e7), fill: "#dc2626" },
    { name: "avertable / yr", cr: Math.round(d.annual_savings_inr / 1e7), fill: "#059669" },
  ];

  return (
    <>
    <Panel title="City ROI — the funding case">
      <div className="grid grid-cols-2 gap-2">
        <Big label="Attributable deaths / yr" value={intfmt(d.attributable_deaths_per_year)} tone="bad" />
        <Big label="Annual health burden" value={inr(d.annual_health_burden_inr)} tone="bad" />
        <Big
          label={`Avertable (−${d.ncap_target_reduction_pct}% NCAP)`}
          value={intfmt(d.deaths_avertable_per_year)}
          tone="good"
        />
        <Big label="Avertable ₹ / yr" value={inr(d.annual_savings_inr)} tone="good" />
      </div>

      <div className="mt-2 h-24">
        <SizedChart>
          <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `${intfmt(v)} cr`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={78} />
            <Tooltip
              formatter={(v) => `₹${intfmt(Number(v))} cr / yr`}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
              cursor={{ fill: "#f8fafc" }}
            />
            <Bar dataKey="cr" radius={[0, 3, 3, 0]} maxBarSize={18}>
              {chart.map((c) => (
                <Cell key={c.name} fill={c.fill} />
              ))}
            </Bar>
          </BarChart>
        </SizedChart>
      </div>

      <div className="mt-1 text-[11px] text-gray-600">
        Annual mean {d.annual_pm25} µg/m³ vs WHO {d.who_guideline_pm25} µg/m³ · pop {intfmt(d.population)}
      </div>
      <div className="mt-2 rounded-md bg-slate-50 p-2 text-xs leading-snug text-gray-700">{d.narrative}</div>
      <Citations items={d.citations ?? []} />
    </Panel>
    <FundGuidance city={city} />
    </>
  );
}
