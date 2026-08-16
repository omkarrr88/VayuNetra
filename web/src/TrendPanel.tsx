// Past-history view a layman can read: daily PM2.5 for a place (a cell) or a
// city, coloured by the CPCB bands people already know, with a one-line
// verdict — better / worse / about the same than a month ago. Backed by real
// station readings aggregated per day (GET /history/trend).
import { useEffect, useState } from "react";
import { Area, AreaChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "./api";

type Point = { date: string; pm25: number; n: number; band: string };
type Verdict = {
  change_pct: number;
  direction: "better" | "worse" | "about the same";
  dominant_band_30d: string | null;
  days_of_history: number;
  text: string;
};
type Trend = { series: Point[]; verdict: Verdict | null; days_of_history: number; note?: string | null };

const BAND_COLORS: Array<[number, number, string, string]> = [
  [0, 30, "#22c55e", "good"],
  [30, 60, "#84cc16", "satisfactory"],
  [60, 90, "#eab308", "moderate"],
  [90, 120, "#f97316", "poor"],
  [120, 250, "#ef4444", "very poor"],
];

const RANGES: Array<[number, string]> = [[30, "30d"], [90, "90d"], [365, "1y"]];

export default function TrendPanel({
  city, cell, compact = false,
}: { city: string; cell?: string; compact?: boolean }) {
  const [days, setDays] = useState(90);
  const [t, setT] = useState<Trend | null | "err">(null);

  useEffect(() => {
    let alive = true;
    setT(null);
    const q = `/history/trend?city=${city}&days=${days}${cell ? `&cell=${cell}` : ""}`;
    api<Trend>(q).then((d) => alive && setT(d)).catch(() => alive && setT("err"));
    return () => {
      alive = false;
    };
  }, [city, cell, days]);

  if (t === "err") return null;
  const series = t ? t.series : [];
  const verdict = t ? t.verdict : null;
  const maxY = Math.max(60, ...series.map((p) => p.pm25)) * 1.1;

  return (
    <div className={compact ? "" : "rounded-md border border-slate-200 bg-white p-2"}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {cell ? "This place — past air" : "City — past air"}
        </div>
        <div className="flex gap-0.5">
          {RANGES.map(([d, l]) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                days === d ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {t === null ? (
        <div className="mt-2 h-20 animate-pulse rounded bg-slate-100" />
      ) : series.length < 3 ? (
        <div className="mt-2 text-[11px] text-slate-400">Not enough daily history for this place yet.</div>
      ) : (
        <>
          {verdict && (
            <div
              className={`mt-1.5 rounded px-2 py-1 text-xs font-semibold ${
                verdict.direction === "better"
                  ? "bg-emerald-50 text-emerald-800"
                  : verdict.direction === "worse"
                    ? "bg-red-50 text-red-700"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              {verdict.direction === "better" ? "↓ " : verdict.direction === "worse" ? "↑ " : "→ "}
              {verdict.text}
            </div>
          )}
          <div className="mt-1.5 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                {BAND_COLORS.map(([lo, hi, color]) => (
                  <ReferenceArea key={lo} y1={lo} y2={Math.min(hi, maxY)} fill={color} fillOpacity={0.09} strokeOpacity={0} />
                ))}
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  tickFormatter={(d: string) => d.slice(5)}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis domain={[0, maxY]} tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [`${v} µg/m³`, "PM2.5 daily mean"]}
                  labelFormatter={(d) => String(d)}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <Area type="monotone" dataKey="pm25" stroke="#1e3a8a" strokeWidth={1.6} fill="#1e3a8a" fillOpacity={0.12} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
            {BAND_COLORS.map(([, , color, name]) => (
              <span key={name} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: color }} /> {name}
              </span>
            ))}
            <span className="ml-auto">{t.days_of_history} days of readings</span>
          </div>
          {t.note && <div className="mt-0.5 text-[10px] italic text-amber-700">{t.note}</div>}
        </>
      )}
    </div>
  );
}
