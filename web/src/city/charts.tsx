// Charts and tables of the public city page: the 24-hour index/pollutant graph, the daily AQI
// calendar, the monthly trend, and the all-cities comparison. Every series is this city's own
// station data from GET /city/overview; where a city has fewer days, the view says so instead of
// stretching the axis.
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { POLLUTANT_LABEL, SCALES, categoryForIndex, categoryForPm25, formatIndex, pm25Index, type AqiScale, bandInk } from "../aqi";
import { BandLegend, Section, type Overview, type Pollutant } from "./parts";
import { Monument, landmarkName } from "../site/monuments";

const hourLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const dayNum = (d: string) => Number(d.slice(8, 10));
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The main series graph. Range 24 h (hourly) or 7 d / 30 d / 1 y (daily means); shows the
 *  composite index when the AQI chip is selected, otherwise the chosen pollutant's concentration.
 *  Bars or line, with the period's min and max called out. Ranges longer than the record say so. */
export type Range = "24h" | "7d" | "30d" | "1y";
const RANGES: [Range, string, number][] = [["24h", "24 hours", 1], ["7d", "7 days", 7], ["30d", "30 days", 30], ["1y", "1 year", 365]];

export function SeriesGraph({ d, scale, pollutant }: { d: Overview; scale: AqiScale; pollutant: Pollutant }) {
  const [kind, setKind] = useState<"bar" | "area">("bar");
  const [range, setRange] = useState<Range>("24h");
  const isIndex = pollutant === "aqi";
  const daily = range !== "24h";

  const rows = useMemo(() => {
    if (!daily) {
      if (isIndex) return d.hourly.index.map((r) => ({ at: r.hour, value: scale === "us" ? r.aqi_us : r.aqi_in }));
      return (d.hourly.pollutants[pollutant] ?? []).map((r) => ({ at: r.hour, value: r.value }));
    }
    const days = RANGES.find(([k]) => k === range)![2];
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    if (isIndex) {
      return d.daily.calendar
        .filter((r) => r.day >= cutoff && (scale === "us" ? r.aqi_us : r.aqi_in) !== null)
        .map((r) => ({ at: r.day, value: (scale === "us" ? r.aqi_us : r.aqi_in) as number }));
    }
    return (d.daily.pollutants[pollutant] ?? []).filter((r) => r.day >= cutoff).map((r) => ({ at: r.day, value: r.value }));
  }, [d, scale, pollutant, isIndex, range, daily]);

  const label = (v: string) => (daily ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : hourLabel(v));
  const unit = isIndex ? SCALES[scale].short : (d.now.pollutants[pollutant]?.unit ?? "");
  const cat = (v: number) => (isIndex ? categoryForIndex(v, scale) : categoryForPm25(pollutant === "pm25" ? v : (d.now.pollutants.pm25?.value ?? v), scale));
  const colour = (v: number) => cat(v).color;

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded-md border border-slate-300" role="group" aria-label="Time range">
        {RANGES.map(([k, name]) => (
          <button key={k} onClick={() => setRange(k)} aria-pressed={range === k} title={name}
            className={`px-2 py-1 text-[11px] font-semibold ${range === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {k === "24h" ? "24 h" : k === "7d" ? "7 d" : k === "30d" ? "30 d" : "1 y"}
          </button>
        ))}
      </div>
      <div className="flex overflow-hidden rounded-md border border-slate-300" role="group" aria-label="Chart type">
        {(["bar", "area"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
            className={`px-2 py-1 text-[11px] font-semibold ${kind === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {k === "bar" ? "bars" : "line"}
          </button>
        ))}
      </div>
    </div>
  );

  if (!rows.length) {
    return (
      <div className="vn-card p-4">
        <div className="flex justify-end">{controls}</div>
        <div className="py-8 text-center text-[13px] text-slate-500">
          No {isIndex ? "index" : POLLUTANT_LABEL[pollutant]} readings for {d.name} over the last {RANGES.find(([k]) => k === range)![1]}
          {d.coverage.since ? ` — this city's record starts ${d.coverage.since}` : ""}.
        </div>
      </div>
    );
  }
  const lo = rows.reduce((a, b) => (b.value < a.value ? b : a));
  const hi = rows.reduce((a, b) => (b.value > a.value ? b : a));

  return (
    <div className="vn-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <span className="rounded-lg px-2 py-1 text-[12px] font-bold" style={{ background: colour(lo.value), color: cat(lo.value).text }}>
            {isIndex ? formatIndex(lo.value, scale) : lo.value} <span className="font-semibold">↓ min · {label(lo.at)}</span>
          </span>
          <span className="rounded-lg px-2 py-1 text-[12px] font-bold" style={{ background: colour(hi.value), color: cat(hi.value).text }}>
            {isIndex ? formatIndex(hi.value, scale) : hi.value} <span className="font-semibold">↑ max · {label(hi.at)}</span>
          </span>
        </div>
        {controls}
      </div>
      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "bar" ? (
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(100,116,139,.18)" />
              <XAxis dataKey="at" tickFormatter={label} tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={26} />
              <YAxis tick={{ fontSize: 10 }} width={38} />
              <Tooltip formatter={((v: unknown) => [`${v} ${unit}`, isIndex ? "index" : POLLUTANT_LABEL[pollutant]]) as never} labelFormatter={(l) => label(String(l))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {rows.map((r, i) => <Cell key={i} fill={colour(r.value)} />)}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(100,116,139,.18)" />
              <XAxis dataKey="at" tickFormatter={label} tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={26} />
              <YAxis tick={{ fontSize: 10 }} width={38} />
              <Tooltip formatter={((v: unknown) => [`${v} ${unit}`, isIndex ? "index" : POLLUTANT_LABEL[pollutant]]) as never} labelFormatter={(l) => label(String(l))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Area type="monotone" dataKey="value" stroke={colour(hi.value)} strokeWidth={2} fill={colour(hi.value)} fillOpacity={0.15} isAnimationActive={false} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
      <div className="mt-1 text-[11px] text-slate-500">
        {isIndex ? `${SCALES[scale].name} ${daily ? "per day" : "per hour"}` : `${POLLUTANT_LABEL[pollutant]} city mean ${daily ? "per day" : "per hour"}`},
        computed from this city's station means · {rows.length} point{rows.length === 1 ? "" : "s"} with readings
        {daily && d.coverage.since ? ` · record starts ${d.coverage.since}` : ""}
      </div>
    </div>
  );
}

/** Month-by-month calendar of the daily index — one tile per day, blank where no station reported. */
export function AqiCalendar({ d, scale }: { d: Overview; scale: AqiScale }) {
  const byMonth = useMemo(() => {
    const m = new Map<string, { day: string; index: number | null; pm25: number | null }[]>();
    for (const row of d.daily.calendar) {
      const key = row.day.slice(0, 7);
      const index = scale === "us" ? row.aqi_us : scale === "who" ? (row.pm25 !== null ? pm25Index(row.pm25, "who") : null) : row.aqi_in;
      (m.get(key) ?? m.set(key, []).get(key)!).push({ day: row.day, index, pm25: row.pm25 });
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));   // newest month first
  }, [d, scale]);
  const [openMonth, setOpenMonth] = useState(0);
  if (!byMonth.length) return <div className="vn-card p-6 text-center text-[13px] text-slate-500">No daily history for {d.name} yet.</div>;
  // Paged newest-first, but READ left-to-right in time: the earlier month sits on the left and the
  // later one on the right, the way a calendar is read.
  const shown = byMonth.slice(openMonth, openMonth + 2).slice().reverse();
  return (
    <div className="vn-card p-4">
      <div className="flex items-center justify-between">
        <BandLegend scale={scale} />
        <div className="flex gap-1">
          <button onClick={() => setOpenMonth(Math.min(byMonth.length - 1, openMonth + 1))} disabled={openMonth >= byMonth.length - 2}
            className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-40">← earlier</button>
          <button onClick={() => setOpenMonth(Math.max(0, openMonth - 1))} disabled={openMonth === 0}
            className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-40">later →</button>
        </div>
      </div>
      <div className="mt-3 grid gap-6 sm:grid-cols-2">
        {shown.map(([month, days]) => {
          const first = new Date(days[0].day);
          const pad = (first.getDay() + 6) % 7;   // weeks start Monday
          return (
            <div key={month}>
              <div className="text-[13px] font-bold text-slate-800">{MONTH_NAMES[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}</div>
              <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
                {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => <span key={i}>{w}</span>)}
                {Array.from({ length: pad }).map((_, i) => <span key={`p${i}`} />)}
                {days.map((x) => {
                  const cat = x.index !== null ? categoryForIndex(x.index, scale) : null;
                  return (
                    <span key={x.day}
                      title={`${x.day}${x.index !== null ? ` · ${formatIndex(x.index, scale)} ${cat?.label}` : " · no reading"}${x.pm25 !== null ? ` · PM2.5 ${x.pm25} µg/m³` : ""}`}
                      className="flex h-9 flex-col items-center justify-center rounded-md text-[11px] font-bold"
                      style={{ background: cat?.color ?? "var(--vn-surface-2)", color: cat?.text ?? "#94a3b8" }}
                    >
                      <span className="text-[9px] font-semibold opacity-80">{dayNum(x.day)}</span>
                      {x.index !== null ? formatIndex(x.index, scale) : "–"}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Monthly means with the most / least polluted month of the covered period. */
export function MonthlyTrend({ d, scale }: { d: Overview; scale: AqiScale }) {
  const rows = d.months.series.map((m) => ({ ...m, index: pm25Index(m.pm25, scale) }));
  if (!rows.length) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="vn-card p-4">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(100,116,139,.18)" />
              <XAxis dataKey="month" tickFormatter={(m: string) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={38} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={((v: unknown, _n: unknown, item: unknown) => {
                  const p = (item as { payload?: { pm25?: number; days?: number } })?.payload ?? {};
                  return [`${v} ${SCALES[scale].short}`, `PM2.5 ${p.pm25 ?? "–"} µg/m³ · ${p.days ?? "–"} days`];
                }) as never}
              />
              <Bar dataKey="index" radius={[3, 3, 0, 0]}>
                {rows.map((r, i) => <Cell key={i} fill={categoryForPm25(r.pm25, scale).color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 text-[11px] text-slate-500">Monthly mean PM2.5 for {d.name}, expressed on the {SCALES[scale].short} scale · {rows.length} month(s) of record</div>
      </div>
      <div className="vn-card p-4">
        <div className="text-[13px] font-bold text-slate-800">Most &amp; least polluted month</div>
        {d.months.most_polluted && (
          <div className="mt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">most polluted</div>
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-bold text-slate-900">{MONTH_NAMES[Number(d.months.most_polluted.month.slice(5, 7)) - 1]} {d.months.most_polluted.month.slice(0, 4)}</span>
              <span className="rounded-md px-2 py-0.5 text-[13px] font-extrabold" style={{ background: categoryForPm25(d.months.most_polluted.pm25, scale).color, color: categoryForPm25(d.months.most_polluted.pm25, scale).text }}>
                {formatIndex(pm25Index(d.months.most_polluted.pm25, scale), scale)}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">PM2.5 {d.months.most_polluted.pm25} µg/m³</div>
          </div>
        )}
        {d.months.least_polluted && (
          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">least polluted</div>
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-bold text-slate-900">{MONTH_NAMES[Number(d.months.least_polluted.month.slice(5, 7)) - 1]} {d.months.least_polluted.month.slice(0, 4)}</span>
              <span className="rounded-md px-2 py-0.5 text-[13px] font-extrabold" style={{ background: categoryForPm25(d.months.least_polluted.pm25, scale).color, color: categoryForPm25(d.months.least_polluted.pm25, scale).text }}>
                {formatIndex(pm25Index(d.months.least_polluted.pm25, scale), scale)}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">PM2.5 {d.months.least_polluted.pm25} µg/m³</div>
          </div>
        )}
        <div className="mt-4 text-[11px] leading-4 text-slate-500">
          Computed from this city's own station record{d.coverage.since ? `, which starts ${d.coverage.since}` : ""} — we do not chart years we have not measured.
        </div>
      </div>
    </div>
  );
}

export type CityRow = {
  city_id: string; name: string; current_pm25: number | null; forecast_24h_pm25: number | null;
  dominant_source?: string; trend?: string;
  /** Composite indices computed server-side from this city's means (GET /comparison) — the same
   *  definition the city's own page uses, so the scoreboard can never disagree with it. */
  aqi_in?: number | null; prominent_in?: string | null; aqi_us?: number | null; prominent_us?: string | null;
};

/** The city's index on the chosen scale: the server composite where we have it (CPCB / EPA are
 *  multi-pollutant), the PM2.5 multiple for WHO, which is defined on PM2.5 alone. */
export function cityIndex(r: CityRow, scale: AqiScale): number | null {
  if (scale === "who") return r.current_pm25 !== null ? pm25Index(r.current_pm25, "who") : null;
  const v = scale === "us" ? r.aqi_us : r.aqi_in;
  if (typeof v === "number") return v;
  return r.current_pm25 !== null ? pm25Index(r.current_pm25, scale) : null;   // pre-index fixtures
}

/** Sortable table of every city we run, plus a card grid — the "how does my city compare" view. */
export function CitiesTable({ rows, scale, onOpen, activeCity }: { rows: CityRow[]; scale: AqiScale; onOpen: (city: string) => void; activeCity?: string }) {
  const [sort, setSort] = useState<{ key: "name" | "index" | "pm25" | "next"; dir: 1 | -1 }>({ key: "index", dir: -1 });
  const withIdx = rows.filter((r) => r.current_pm25 !== null).map((r) => ({ ...r, index: cityIndex(r, scale) ?? 0, prominent: scale === "us" ? r.prominent_us : r.prominent_in }));
  const sorted = [...withIdx].sort((a, b) => {
    const v = sort.key === "name" ? a.name.localeCompare(b.name)
      : sort.key === "pm25" ? (a.current_pm25 ?? 0) - (b.current_pm25 ?? 0)
      : sort.key === "next" ? (a.forecast_24h_pm25 ?? 0) - (b.forecast_24h_pm25 ?? 0)
      : a.index - b.index;
    return v * sort.dir;
  });
  const head = (key: typeof sort.key, label: string, align = "left") => (
    <th className={`cursor-pointer whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-slate-500 ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : -1 }))}>
      {label} <span className="text-slate-400">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
    </th>
  );
  return (
    <div className="vn-card overflow-x-auto">
      <table className="w-full min-w-[36rem]">
        <thead className="border-b border-slate-200">
          <tr>{head("name", "city")}<th className="px-3 py-2 text-left text-[11px] font-bold tracking-wide text-slate-500">status</th>{head("index", SCALES[scale].short, "right")}{head("pm25", "PM2.5 µg/m³", "right")}{head("next", "+24 h PM2.5", "right")}<th className="px-3 py-2 text-left text-[11px] font-bold tracking-wide text-slate-500">dominant source</th></tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const cat = categoryForIndex(r.index, scale);
            return (
              <tr key={r.city_id} className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 ${r.city_id === activeCity ? "bg-blue-50" : ""}`} onClick={() => onOpen(r.city_id)}>
                <td className="px-3 py-2 text-[13px] font-bold text-slate-800">{r.name}</td>
                <td className="px-3 py-2"><span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: cat.color, color: cat.text }}>{cat.label}</span></td>
                <td className="px-3 py-2 text-right text-[14px] font-extrabold tabular-nums text-slate-900" title={r.prominent && scale !== "who" ? `set by ${POLLUTANT_LABEL[r.prominent] ?? r.prominent}` : undefined}>
                  {formatIndex(r.index, scale)}
                  {r.prominent && scale !== "who" && <span className="ml-1 align-middle text-[9px] font-bold uppercase text-slate-400">{POLLUTANT_LABEL[r.prominent] ?? r.prominent}</span>}
                </td>
                <td className="px-3 py-2 text-right text-[13px] tabular-nums text-slate-700">{r.current_pm25}</td>
                <td className="px-3 py-2 text-right text-[13px] tabular-nums text-slate-700">{r.forecast_24h_pm25 ?? "–"}</td>
                <td className="px-3 py-2 text-[12px] text-slate-600">{(r.dominant_source ?? "–").replace(/_/g, " ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Card grid of the other cities — click to open that city's page. */
export function CityCards({ rows, scale, onOpen, exclude }: { rows: CityRow[]; scale: AqiScale; onOpen: (city: string) => void; exclude?: string }) {
  const list = rows.filter((r) => r.current_pm25 !== null && r.city_id !== exclude);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {list.map((r) => {
        const index = cityIndex(r, scale) ?? 0;
        const cat = categoryForIndex(index, scale);
        return (
          <button
            key={r.city_id}
            onClick={() => onOpen(r.city_id)}
            title={landmarkName(r.city_id) ? `${r.name} — ${landmarkName(r.city_id)}` : r.name}
            className="vn-card group p-4 text-left transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="text-[14px] font-bold text-slate-800">{r.name}</span>
              <span className="text-slate-400" aria-hidden="true">↗</span>
            </div>
            {/* The index and the landmark share this row: the number keeps the eye, and the drawing
                fills the space beside it that was empty. It is tinted with the city's own band
                colour, so a card is recognisable by shape AND by hue before a word is read. */}
            <div className="mt-1 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <div className="text-3xl font-extrabold leading-none" style={{ color: bandInk(cat.color) }}>
                  {formatIndex(index, scale)}
                </div>
                <div className="mt-1 text-[12px] font-semibold" style={{ color: bandInk(cat.color) }}>{cat.label}</div>
              </div>
              <Monument
                city={r.city_id}
                width={92}
                className="shrink-0 opacity-60 transition-opacity group-hover:opacity-90"
                style={{ color: bandInk(cat.color) }}
              />
            </div>
            <div className="mt-3 flex justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
              <span>PM2.5 <b className="text-slate-700">{r.current_pm25}</b></span>
              <span>+24 h <b className="text-slate-700">{r.forecast_24h_pm25 ?? "–"}</b></span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Our own cigarette mark for the "how many cigarettes is this air" figure — a lit cigarette with
 *  drifting smoke, drawn inline so nothing is fetched and it recolours with the band. */
function CigaretteMark({ color = "#e11d48" }: { color?: string }) {
  return (
    <svg viewBox="0 0 96 64" className="h-14 w-20 shrink-0" role="img" aria-label="Cigarette equivalent">
      <g fill="none" stroke="currentColor" className="text-slate-400" strokeWidth="2" strokeLinecap="round">
        <path d="M20 12c-5 4-5 8 0 12s5 8 0 12" opacity=".55" />
        <path d="M31 8c-6 5-6 10 0 15s6 10 0 15" opacity=".35" />
      </g>
      {/* body */}
      <rect x="42" y="38" width="42" height="12" rx="3" fill="var(--vn-surface, #f8fafc)" stroke="currentColor" className="text-slate-300" strokeWidth="2" />
      {/* filter */}
      <rect x="72" y="38" width="12" height="12" rx="3" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
      <line x1="72" y1="38" x2="72" y2="50" stroke="#d97706" strokeWidth="1.5" opacity=".8" />
      {/* ember */}
      <rect x="42" y="38" width="7" height="12" rx="3" fill={color} />
      <circle cx="45" cy="44" r="2.4" fill="#fb923c" />
    </svg>
  );
}

/** Health section: what to do now, the cigarette equivalent, and per-condition guidance. */
export function HealthAdvice({ d }: { d: Overview }) {
  const [cond, setCond] = useState(d.health.conditions[0]?.key ?? "asthma");
  const active = d.health.conditions.find((c) => c.key === cond) ?? d.health.conditions[0];
  const cig = d.health.cigarettes;
  return (
    <div className="space-y-4">
      <div className="vn-card p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex items-end gap-2">
                <span className="text-5xl font-extrabold text-rose-600">{cig.per_day ?? "–"}</span>
                <span className="pb-1 text-[13px] font-semibold text-slate-600">cigarettes / day</span>
              </div>
              <CigaretteMark />
            </div>
            <p className="mt-2 text-[13px] text-slate-600">
              Breathing {d.name}'s air over the last 24 hours is comparable to smoking about <b className="text-slate-900">{cig.per_day ?? "–"}</b> cigarettes a day.
            </p>
            <div className="mt-3 flex gap-6 text-[13px]">
              <span className="text-slate-600">weekly <b className="text-slate-900">{cig.per_week ?? "–"}</b></span>
              <span className="text-slate-600">monthly <b className="text-slate-900">{cig.per_month ?? "–"}</b></span>
            </div>
            <div className="mt-2 text-[11px] leading-4 text-slate-500">
              {cig.pm25_basis !== undefined && <>Basis: 24-h mean PM2.5 {cig.pm25_basis} µg/m³. </>}{cig.note} Source: {cig.source}.
            </div>
          </div>
          <div>
            <div className="text-[13px] font-bold text-slate-800">
              {d.health.actions.length ? `What to do now — air is ${d.health.band_label}` : "No advice to give"}
            </div>
            <p className="mt-1 text-[13px] text-slate-600">{d.health.headline}</p>
            {/* An empty grid would read as a broken card; the headline already says why it is empty. */}
            {d.health.actions.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {d.health.actions.map((a) => (
                  <div key={a.key} className="rounded-lg border border-slate-200 px-3 py-2">
                    <div className="text-[12px] font-bold text-slate-800">{a.label}</div>
                    <div className="text-[12px] text-blue-700">{a.prescription}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="vn-card p-4">
        <div className="text-[13px] font-bold text-slate-800">Understand your risk</div>
        <div className="mt-2 flex flex-wrap gap-2" role="tablist" aria-label="Health condition">
          {d.health.conditions.map((c) => (
            <button key={c.key} role="tab" aria-selected={c.key === cond} onClick={() => setCond(c.key)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${c.key === cond ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-600 hover:border-slate-400"}`}>
              {c.label}
            </button>
          ))}
        </div>
        {active && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="text-[14px] font-bold text-slate-900">{active.label}</div>
              <p className="mt-1 text-[13px] text-slate-600">
                Risk today is <b className="text-slate-900">{active.risk}</b> — the air is {d.health.band_label}. {active.symptoms}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wide text-emerald-700">Do</div>
                <ul className="mt-1 space-y-1 text-[12px] text-slate-600">{active.do.map((x) => <li key={x}>✓ {x}</li>)}</ul>
              </div>
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wide text-rose-700">Don't</div>
                <ul className="mt-1 space-y-1 text-[12px] text-slate-600">{active.dont.map((x) => <li key={x}>✕ {x}</li>)}</ul>
              </div>
            </div>
          </div>
        )}
        <div className="mt-4 border-t border-slate-100 pt-2 text-[11px] leading-4 text-slate-500">
          {d.health.disclaimer} Sources: {d.health.sources.join(" · ")}.
        </div>
      </div>
    </div>
  );
}

export { Section };
