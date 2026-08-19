import { useEffect, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SizedChart from "./SizedChart";
import { api } from "./api";
import { categoryForPm25 } from "./aqi";
import { useAqiScale } from "./aqiScale";
import { FORECAST_SKILL, SKILL_ASOF, pct } from "./metrics";
import { EmptyState, Panel, SegBtn } from "./ui";
import { placeForCell } from "./placeName";

type FC = {
  h3_cell: string;
  horizon_h: number;
  value: number;
  pi_low: number;
  pi_high: number;
  persistence_value: number;
};

const HORIZONS = [24, 48, 72];
const SPIKE = 90; // µg/m³ PM2.5 — "very poor" threshold for a spike alert

/** Short human label for an H3 id — the shared prefix says nothing, the tail does. Used only until
 *  the ward lookup resolves, and as the fallback where a city has no boundary data. */
export function cellLabel(h3: string): string {
  return `#${h3.replace(/f+$/, "").slice(-4)}`;
}

/** Ward names for a list of cells. An officer reads "Khairatabad", not "#0b03"; the H3 id stays on
 *  hover so the row is still traceable to an exact cell. */
function usePlaceNames(city: string, cells: string[]): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  const key = cells.join(",");
  useEffect(() => {
    let live = true;
    setNames({});
    Promise.all(cells.map(async (c) => [c, (await placeForCell(city, c))?.label] as const))
      .then((pairs) => {
        if (!live) return;
        const out: Record<string, string> = {};
        for (const [c, label] of pairs) if (label) out[c] = label;
        setNames(out);
      })
      .catch(() => { /* the short id is a fine fallback */ });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, key]);
  return names;
}

type ChartPoint = { h: string; avg: number; band: [number, number]; pers: number };

type BenchSummary = {
  source: "hist" | "live";
  generated_at: string;
  headline: { horizon_h: number; n_test: number; skill_vs_persistence: number | null; skill_vs_seasonal_naive: number | null; pi80_coverage: number | null }[];
};

// Forecast panel: horizon picker, interval-band chart, spike alerts.
export default function ForecastPanel({ city }: { city: string }) {
  const { scale } = useAqiScale();
  const [horizon, setHorizon] = useState(24);
  const [byHorizon, setByHorizon] = useState<Record<number, FC[]> | null>(null);

  useEffect(() => {
    setByHorizon(null);
    Promise.all(
      HORIZONS.map((h) =>
        api<FC[]>(`/forecast?city=${city}&horizon=${h}`).then((rows) => [h, rows] as const).catch(() => [h, [] as FC[]] as const),
      ),
    ).then((all) => setByHorizon(Object.fromEntries(all)));
  }, [city]);

  // Measured skill: the benchmark artifact (recomputed by ml.eval.benchmark) wins;
  // the metrics.ts snapshot is only the fallback for cities without an artifact yet.
  const [bench, setBench] = useState<BenchSummary | null>(null);
  useEffect(() => {
    setBench(null);
    api<{ history: BenchSummary | null; live: BenchSummary | null }>(`/metrics/benchmark?city=${city}`)
      .then((d) => setBench(d.live ?? d.history ?? null))
      .catch(() => setBench(null));
  }, [city]);
  const skill = FORECAST_SKILL[city];
  const bh = bench?.headline.find((h) => h.horizon_h === horizon);
  const rows = byHorizon?.[horizon] ?? [];

  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const chart: ChartPoint[] = HORIZONS.flatMap((h) => {
    const r = byHorizon?.[h] ?? [];
    if (!r.length) return [];
    return [
      {
        h: `+${h}h`,
        avg: Math.round(mean(r.map((x) => x.value))),
        band: [Math.round(mean(r.map((x) => x.pi_low))), Math.round(mean(r.map((x) => x.pi_high)))] as [number, number],
        pers: Math.round(mean(r.map((x) => x.persistence_value))),
      },
    ];
  });

  const spikes = rows.filter((r) => r.value >= SPIKE);
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  // only the rows that are actually listed need a name
  const places = usePlaceNames(city, sorted.slice(0, 40).map((r) => r.h3_cell));

  return (
    <Panel
      title="Forecast"
      tag="PM2.5"
      right={
        <div className="flex gap-1">
          {HORIZONS.map((h) => (
            <SegBtn key={h} active={horizon === h} onClick={() => setHorizon(h)}>
              +{h}h
            </SegBtn>
          ))}
        </div>
      }
    >
      {chart.length > 1 && (
        <div className="h-28">
          <SizedChart>
            <ComposedChart data={chart} margin={{ top: 4, right: 8, left: -10, bottom: -6 }}>
              <XAxis dataKey="h" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={34} domain={[0, "dataMax + 20"]} />
              <Tooltip
                formatter={(v, name) =>
                  Array.isArray(v)
                    ? [`${v[0]}–${v[1]} µg/m³`, "80% interval"]
                    : [`${v ?? "–"} µg/m³`, name === "avg" ? "forecast" : "persistence"]
                }
                labelStyle={{ fontSize: 11 }}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Area type="monotone" dataKey="band" stroke="none" fill="#3b82f6" fillOpacity={0.12} />
              <Line type="monotone" dataKey="avg" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="pers" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            </ComposedChart>
          </SizedChart>
        </div>
      )}
      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 rounded bg-blue-600" /> city avg + 80% band</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 rounded bg-slate-400" /> persistence</span>
      </div>

      {bh ? (
        <div
          className="mt-2 rounded-md bg-indigo-50 px-2 py-1 text-[11px] leading-4 text-indigo-800"
          title={`Temporal-split benchmark (${bench?.source === "hist" ? "multi-season history" : "live 90-day window"}, n=${bh.n_test} test hours) recomputed ${bench?.generated_at.slice(0, 10)}. skill = 1 − RMSE_model/RMSE_baseline`}
        >
          measured skill @{horizon}h: <b>{pct(bh.skill_vs_persistence ?? undefined)}</b> vs persistence ·{" "}
          <b>{pct(bh.skill_vs_seasonal_naive ?? undefined)}</b> vs seasonal-naive
          {typeof bh.pi80_coverage === "number" && <> · 80% band covers <b>{Math.round(bh.pi80_coverage * 100)}%</b></>}
        </div>
      ) : skill ? (
        <div
          className="mt-2 rounded-md bg-indigo-50 px-2 py-1 text-[11px] leading-4 text-indigo-800"
          title={`Walk-forward backtest (3 folds, n=${skill.n}) on live data, ${SKILL_ASOF}. skill = 1 − RMSE_model/RMSE_baseline`}
        >
          backtested skill @{horizon}h: <b>{pct(skill.vsPersistence[horizon])}</b> vs persistence ·{" "}
          <b>{pct(skill.vsClimatology[horizon])}</b> vs climatology
        </div>
      ) : null}

      {byHorizon === null ? (
        <div className="mt-2 h-20 animate-pulse rounded-md bg-slate-100" />
      ) : rows.length ? (
        <div className="mt-2 text-xs text-slate-700">
          {spikes.length > 0 && (
            <div className="rounded-md bg-red-50 px-2 py-1 font-medium text-red-700">
              ⚠ spike alert: {spikes.length} cell{spikes.length > 1 ? "s" : ""} forecast ≥ {SPIKE} µg/m³
            </div>
          )}
          <div className="mt-1.5 max-h-36 space-y-0.5 overflow-auto pr-1" tabIndex={0} role="region" aria-label="Per-cell forecasts, worst first">
            {sorted.map((r) => {
              const cat = categoryForPm25(r.value, scale);
              return (
                <div key={r.h3_cell} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[11px] text-slate-600" title={`1 km cell ${r.h3_cell}`}>
                    {r.value >= SPIKE ? "⚠ " : ""}
                    {places[r.h3_cell] ?? `cell ${cellLabel(r.h3_cell)}`}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-slate-500">
                      [{Math.round(r.pi_low)}–{Math.round(r.pi_high)}]
                    </span>
                    <span
                      className="w-9 rounded px-1 text-center font-mono text-[11px] font-bold"
                      style={{ background: cat.color, color: cat.text }}
                    >
                      {Math.round(r.value)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState message="No forecast available for this city yet." />
      )}
    </Panel>
  );
}
