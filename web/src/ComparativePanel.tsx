import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, Legend, Tooltip, XAxis, YAxis } from "recharts";
import SizedChart from "./SizedChart";
import { api } from "./api";
import { type AqiScale, categoryForPm25, formatIndex, pm25Index, SCALES } from "./aqi";
import { useAqiScale } from "./aqiScale";
import { inr, intfmt } from "./format";
import { EmptyState, Panel, Step } from "./ui";

// Three states, three colours. "improving" and "stable" used to render the same green, which threw
// away the one bit the badge exists to carry. The band the label comes from scales with the city's
// own level — see trend_band() in agents/multicity.py — so the hint says how much movement it took.
const TREND_STYLE: Record<string, { cls: string; arrow: string; hint: string }> = {
  deteriorating: { cls: "bg-red-50 text-red-700", arrow: "\u2191", hint: "PM2.5 rises by more than 15% of the current level over the next 24 h" },
  improving:     { cls: "bg-emerald-50 text-emerald-700", arrow: "\u2193", hint: "PM2.5 falls by more than 15% of the current level over the next 24 h" },
  stable:        { cls: "bg-slate-100 text-slate-600", arrow: "\u2192", hint: "Forecast change stays inside 15% of the current level (min 5 \u00b5g/m\u00b3)" },
};

// The server already computes each city's index the way the city's own page does — over every
// pollutant, not PM2.5 alone — so use it when it exists. Deriving the badge here from PM2.5 would
// show 32 on the scoreboard next to the 66 the same city reports on its own page whenever PM10 or
// a gas is the prominent one. The WHO scale has no server-side equivalent, and neither does a city
// whose index RPC failed, so the PM2.5-only derivation stays as the labelled fallback.
function cityIndex(c: CityCard, scale: AqiScale): { label: string; note: string } {
  const served = scale === "in" ? c.aqi_in : scale === "us" ? c.aqi_us : null;
  const cat = categoryForPm25(c.current_pm25, scale).label;
  if (served != null) {
    return { label: String(Math.round(served)), note: `${SCALES[scale].name}: ${Math.round(served)} — all pollutants, same computation as ${c.name}'s own page` };
  }
  const derived = formatIndex(pm25Index(c.current_pm25, scale), scale);
  return { label: derived, note: `${SCALES[scale].name}: ${derived} ${cat} — from PM2.5 only (station gases are not in this city aggregate)` };
}

type CityCard = {
  city_id: string;
  name: string;
  current_pm25: number;
  current_pm25_basis?: string;
  aqi_in?: number | null;
  aqi_us?: number | null;
  pm25_24h?: number | null;
  forecast_24h_pm25: number;
  trend: string;
  dominant_source: string;
  signature_match: string;
  playbook: string[];
  compliance?: { total: number; proposed: number; approved: number; dispatched: number; dismissed: number };
  health?: {
    annual_pm25: number;
    attributable_deaths_per_year: number;
    annual_health_burden_inr: number;
  };
};

type Comparison = {
  summary: {
    cities_compared: number;
    highest_risk_city: string;
    highest_burden_city?: string;
    shared_pattern: string;
  };
  cities: CityCard[];
};

export default function ComparativePanel({ onSelectCity, onOpenEnforcement }: {
  onSelectCity: (city: string) => void;
  onOpenEnforcement?: (city: string) => void;
}) {
  const { scale } = useAqiScale();
  const [data, setData] = useState<Comparison | null>(null);
  const [failed, setFailed] = useState(false);

  function load() {
    setFailed(false);
    api<Comparison>("/comparison").then(setData).catch(() => setFailed(true));
  }
  useEffect(load, []);

  // Ranked cleanest-first, and the chart is built from the SAME ordered array as the list below —
  // when the two disagreed, a reader could not tell which bar belonged to which row.
  const ranked = [...(data?.cities ?? [])].sort((a, b) => a.current_pm25 - b.current_pm25);

  const chart = ranked.map((c) => ({
    name: c.name,
    "avg now": Math.round(c.current_pm25),
    "+24h": Math.round(c.forecast_24h_pm25),
    worsening: c.forecast_24h_pm25 > c.current_pm25,
  }));

  return (
    <Step n={1} label="Scoreboard" info={<p>The ten cities ranked by current PM2.5 with trend, dominant source, health burden and enforcement load; click a city to switch the whole console. Playbook lines come from the multi-city agent.</p>}>
    <Panel title="Multi-City Compare">
      {failed && !data ? (
        <EmptyState message="Couldn't load the multi-city comparison." tone="error" onRetry={load} />
      ) : (
        <>
      <div className="text-xs text-slate-600">
        {data?.summary.shared_pattern ?? "Loading city comparison…"}
        <span className="ml-1 text-slate-500">· city-average PM2.5</span>
      </div>

      {chart.length > 0 && (
        <div className="mt-2 h-32">
          <SizedChart>
            <BarChart data={chart} margin={{ top: 4, right: 4, left: -10, bottom: -6 }} barGap={2}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={34} />
              <Tooltip
                formatter={(v) => `${v ?? "–"} µg/m³`}
                labelStyle={{ fontSize: 11 }}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                cursor={{ fill: "#f1f5f9" }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
              <Bar dataKey="avg now" fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={26} />
              {/* the forecast bar carries the direction: amber if the air is getting worse,
                  emerald if it is clearing. A flat blue said nothing a reader could use. */}
              <Bar dataKey="+24h" radius={[3, 3, 0, 0]} maxBarSize={26}>
                {chart.map((c) => (
                  <Cell key={c.name} fill={c.worsening ? "#d97706" : "#059669"} />
                ))}
              </Bar>
            </BarChart>
          </SizedChart>
        </div>
      )}

      {(data?.cities.length ?? 0) > 1 && (
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Clean-air ranking
          <span className="ml-1 font-normal normal-case tracking-normal text-slate-500">
            — Swachh Vayu style, by current PM2.5 (cleanest first)
          </span>
        </div>
      )}
      <div className="mt-2 space-y-2">
        {ranked.map((c, rank) => (
          <button
            key={c.city_id}
            onClick={() => onSelectCity(c.city_id)}
            className="block w-full rounded-lg border border-slate-200 p-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">
                <span
                  className={`mr-1.5 inline-block w-8 rounded px-1 text-center text-[11px] font-bold ${
                    rank === 0
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  #{rank + 1}
                </span>
                {c.name}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${TREND_STYLE[c.trend]?.cls ?? "bg-slate-50 text-slate-600"}`}
                title={TREND_STYLE[c.trend]?.hint}
              >
                {TREND_STYLE[c.trend]?.arrow ?? ""} {c.trend}
              </span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-slate-600">
              <span>
                <span title={cityIndex(c, scale).note} className="rounded px-1 py-0.5 font-bold" style={{ background: categoryForPm25(c.current_pm25, scale).color, color: categoryForPm25(c.current_pm25, scale).text }}>{cityIndex(c, scale).label}</span>{" "}
                avg <b className="text-slate-800">{Math.round(c.current_pm25)}</b> µg/m³
              </span>
              <span>
                +24h <b className="text-slate-800">{Math.round(c.forecast_24h_pm25)}</b> µg/m³
              </span>
              <span className="capitalize">{c.dominant_source.replace("_", " ")}</span>
              <span>{c.signature_match}</span>
            </div>
            {c.health && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                <span>~{intfmt(c.health.attributable_deaths_per_year)} deaths/yr</span>
                <span>·</span>
                <span>{inr(c.health.annual_health_burden_inr)}/yr</span>
                {data?.summary.highest_burden_city === c.city_id && (
                  <span className="rounded bg-red-100 px-1 text-red-700">highest burden</span>
                )}
              </div>
            )}
            <div className="mt-1.5 text-xs text-slate-600">→ {c.playbook[0]}</div>
            {c.compliance && c.compliance.total > 0 && (() => {
              // A queue where nothing has been actioned is the exact failure this product exists to
              // surface — the CAG audit finding is that recommendations do not become action. Showing
              // it in the same grey as everything else states the bottleneck as if it were neutral.
              const acted = c.compliance.approved + c.compliance.dispatched + c.compliance.dismissed;
              const stalled = acted === 0;
              return (
                <div className={`mt-1.5 border-t pt-1.5 text-[11px] ${stalled ? "border-amber-200 text-amber-800" : "border-slate-100 text-slate-500"}`}>
                  {/* Counting a queue without offering a way into it is a dead end — this is the
                      only place the number appears, and the queue itself lives in Enforcement. */}
                  <span
                    role="link"
                    tabIndex={0}
                    title={`Open ${c.name}'s enforcement queue`}
                    onClick={(e) => { e.stopPropagation(); onOpenEnforcement?.(c.city_id); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onOpenEnforcement?.(c.city_id); }
                    }}
                    className={`cursor-pointer font-medium underline decoration-dotted underline-offset-2 ${stalled ? "text-amber-900" : "text-slate-600"}`}
                  >
                    Compliance:
                  </span>{" "}{c.compliance.total} recommendations
                  {c.compliance.approved > 0 && <> · {c.compliance.approved} approved</>}
                  {c.compliance.dispatched > 0 && <> · {c.compliance.dispatched} dispatched</>}
                  {c.compliance.dismissed > 0 && <> · {c.compliance.dismissed} dismissed</>}
                  {stalled && (
                    <span className="ml-1 rounded bg-amber-100 px-1 font-semibold text-amber-900">
                      backlog — none actioned yet
                    </span>
                  )}
                </div>
              );
            })()}
          </button>
        ))}
      </div>
        </>
      )}
    </Panel>
    </Step>
  );
}
