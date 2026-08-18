import { useEffect, useState } from "react";
import { Area, AreaChart, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import SizedChart from "./SizedChart";
import type { AttrCell, CoverageCell } from "./BlameMap";
import { api } from "./api";
import { categoryForPm25, type AqiScale } from "./aqi";
import { useAqiScale } from "./aqiScale";
import { SOURCE_COLORS } from "./sources";
import { Step, Panel } from "./ui";
import TrendPanel from "./TrendPanel";
import ExposureCard from "./ExposureCard";

type HistoryPoint = { ts: string; pm25: number; n: number };
type HistoryData = { series: HistoryPoint[] };

function rgb(c: [number, number, number]): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Mean source share across all attributed cells → donut slices. */
function sourceMix(cells: AttrCell[]): Array<{ name: string; value: number; color: string }> {
  if (!cells.length) return [];
  const sums: Record<string, number> = {};
  for (const c of cells) {
    for (const [k, v] of Object.entries(c.shares ?? {})) {
      sums[k] = (sums[k] ?? 0) + (typeof v === "number" ? v : 0);
    }
  }
  return Object.entries(sums)
    .map(([k, v]) => ({
      name: k.replace("_", " "),
      value: Math.round((v / cells.length) * 1000) / 10,
      color: rgb(SOURCE_COLORS[k] ?? [148, 163, 184]),
    }))
    .filter((d) => d.value >= 0.5)
    .sort((a, b) => b.value - a.value);
}

/** Share of the dense-field cells in each AQI band → stacked bar segments. */
function aqiBands(cells: CoverageCell[], scale: AqiScale): Array<{ label: string; color: string; text: string; count: number; pct: number }> {
  if (!cells.length) return [];
  const counts = new Map<string, { label: string; color: string; text: string; count: number }>();
  for (const c of cells) {
    const cat = categoryForPm25(c.pm25, scale);
    const cur = counts.get(cat.label) ?? { label: cat.label, color: cat.color, text: cat.text, count: 0 };
    cur.count += 1;
    counts.set(cat.label, cur);
  }
  const ORDER = ["Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe", "Unhealthy for Sensitive Groups", "Unhealthy", "Very Unhealthy", "Hazardous", "Within guideline", "Above guideline (≤ IT-4)", "Above IT-4 (≤ IT-3)", "Above IT-3 (≤ IT-2)", "Above IT-2 (≤ IT-1)", "Above IT-1"];
  return Array.from(counts.values())
    .map((b) => ({ ...b, pct: (b.count / cells.length) * 100 }))
    .sort((a, b) => ORDER.indexOf(a.label) - ORDER.indexOf(b.label));
}

function hourLabel(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:00`;
}

export default function CityStatsPanel({
  city,
  cells,
  coverageCells,
}: {
  city: string;
  cells: AttrCell[];
  coverageCells: CoverageCell[];
}) {
  const { scale } = useAqiScale();
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);

  useEffect(() => {
    let alive = true;
    setHistory(null);
    api<HistoryData>(`/history?city=${city}&hours=48`)
      .then((d) => alive && setHistory(d.series ?? []))
      .catch(() => alive && setHistory([]));
    return () => {
      alive = false;
    };
  }, [city]);

  const mix = sourceMix(cells);
  const bands = aqiBands(coverageCells, scale);

  return (
    <>
    <Step n={4} label="Who is in the forecast" info={<p>Expected people in Very Poor / Severe air = Σ cell population × calibrated P(&gt; band); GPW population where sampled, cited city population otherwise. Exposure, not mortality.</p>}>
      <Panel title="Who is in the forecast" tag="LIVE">
        <ExposureCard city={city} />
      </Panel>
    </Step>
    <Step n={5} label="The past" info={<p>Daily station means for 30 d / 90 d / 1 y with a plain-language verdict and spike-day markers (raw readings ∪ the archived daily rollup), then the last 48 h, the live source mix and the band split.</p>}>
    <Panel title="City Statistics" tag="LIVE">
      <TrendPanel city={city} compact />
      <div className="my-2 border-t border-slate-100" />
      {/* 48h trend — real station-hour means */}
      <div className="text-[12px] font-semibold text-slate-700">PM2.5 — last 48 hours</div>
      {history === null ? (
        <div className="mt-1 h-24 animate-pulse rounded-md bg-gray-100" />
      ) : history.length < 3 ? (
        <div className="mt-1 text-xs text-gray-500">Not enough recent station data for a trend.</div>
      ) : (
        <>
          <div className="mt-1 h-24">
            <SizedChart>
              <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="ts" tickFormatter={hourLabel} tick={{ fontSize: 9 }} interval="preserveStartEnd" minTickGap={40} />
                <YAxis tick={{ fontSize: 9 }} width={28} domain={[0, "auto"]} />
                <Tooltip
                  formatter={(v) => `${v} µg/m³ PM2.5`}
                  labelFormatter={(ts) => new Date(String(ts)).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  contentStyle={{ fontSize: 11 }}
                />
                <Area type="monotone" dataKey="pm25" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.15} strokeWidth={1.6} />
              </AreaChart>
            </SizedChart>
          </div>
          <div className="text-[10px] text-gray-500">city-mean of real station readings, hourly buckets</div>
        </>
      )}

      {/* Source-mix donut — who is to blame, city-wide */}
      {mix.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <div className="text-[12px] font-semibold text-slate-700">Source mix — city average</div>
          <div className="flex items-center gap-2">
            <div className="h-32 w-32 shrink-0">
              <SizedChart>
                <PieChart>
                  <Pie data={mix} dataKey="value" nameKey="name" innerRadius={30} outerRadius={52} paddingAngle={2} stroke="none">
                    {mix.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 11 }} />
                </PieChart>
              </SizedChart>
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              {mix.map((d) => (
                <div key={d.name} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <span className="font-semibold text-slate-700">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[10px] text-gray-500">mean attribution share across {cells.length} live cells</div>
        </div>
      )}

      {/* AQI-band distribution — who breathes what */}
      {bands.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <div className="text-[12px] font-semibold text-slate-700">Who breathes what — AQI bands</div>
          <div className="mt-1.5 flex h-4 w-full overflow-hidden rounded-full">
            {bands.map((b) => (
              <div key={b.label} style={{ width: `${b.pct}%`, background: b.color }} title={`${b.label}: ${b.count} cells`} />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {bands.map((b) => (
              <span key={b.label} className="flex items-center gap-1 text-[11px] text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />
                {b.label} <b>{Math.round(b.pct)}%</b>
              </span>
            ))}
          </div>
          <div className="mt-0.5 text-[10px] text-gray-500">
            share of {coverageCells.length} ~1 km cells (dense model field, station-anchored)
          </div>
        </div>
      )}
    </Panel>
    </Step>
    </>
  );
}
