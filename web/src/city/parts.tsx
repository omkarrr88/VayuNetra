// Building blocks of the public city page. Every value comes from GET /city/overview, which is
// computed from this city's own station readings — nothing here is city-specific in code, so all
// ten cities (and the eleventh, whenever a YAML is added) render identically.
import { type ReactNode } from "react";
import { POLLUTANT_LABEL, SCALES, categoryForIndex, categoryForPm25, formatIndex, pm25Index, type AqiScale } from "../aqi";

export type Overview = {
  city_id: string; name: string; languages: string[]; generated_at: string;
  now: {
    pollutants: Record<string, { value: number; unit?: string | null; hour: string; n?: number }>;
    pm25_24h: number | null;
    aqi_in: number | null; prominent_in: string | null; sub_in?: Record<string, number>;
    aqi_us: number | null; prominent_us: string | null; sub_us?: Record<string, number>;
  };
  hourly: {
    pollutants: Record<string, { hour: string; value: number }[]>;
    index: { hour: string; aqi_in: number; aqi_us: number; prominent_in: string }[];
    min: { hour: string; aqi_in: number } | null; max: { hour: string; aqi_in: number } | null;
  };
  daily: {
    pollutants: Record<string, { day: string; value: number }[]>;
    calendar: { day: string; aqi_in: number | null; aqi_us: number | null; prominent_in: string | null; pm25: number | null }[];
  };
  months: { series: { month: string; pm25: number; days: number }[]; most_polluted: { month: string; pm25: number } | null; least_polluted: { month: string; pm25: number } | null };
  rank: { position: number; of: number; scope: string; basis: string } | null;
  health: {
    band: string; band_label: string; index: number | null; headline: string;
    actions: { key: string; label: string; prescription: string }[];
    conditions: { key: string; label: string; symptoms: string; risk: string; do: string[]; dont: string[] }[];
    cigarettes: { per_day: number | null; per_week: number | null; per_month: number | null; pm25_basis?: number; source: string; note?: string };
    sources: string[]; disclaimer: string;
  };
  coverage: { since: string | null; days: number; hours_24h: number; note: string };
};

export const POLLUTANTS = ["pm25", "pm10", "no2", "so2", "co", "o3"] as const;
export type Pollutant = (typeof POLLUTANTS)[number] | "aqi";
export const POLLUTANT_FULL: Record<string, string> = {
  pm25: "Particulate Matter (PM2.5)", pm10: "Particulate Matter (PM10)", no2: "Nitrogen Dioxide (NO₂)",
  so2: "Sulphur Dioxide (SO₂)", co: "Carbon Monoxide (CO)", o3: "Ozone (O₃)", nh3: "Ammonia (NH₃)",
};

/** "2 h ago" style age of a reading. */
export function ago(iso?: string): string {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

/** The pollutant selector — AQI first, then whichever pollutants this city actually reports. */
export function PollutantChips({ available, value, onChange, compact = false }: { available: string[]; value: Pollutant; onChange: (p: Pollutant) => void; compact?: boolean }) {
  const chips: Pollutant[] = ["aqi", ...POLLUTANTS.filter((p) => available.includes(p))];
  return (
    <div className={`flex flex-wrap ${compact ? "gap-1" : "gap-2"}`} role="tablist" aria-label="Pollutant">
      {chips.map((p) => {
        const on = p === value;
        return (
          <button
            key={p}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(p)}
            className={`rounded-full font-semibold transition-colors ${compact ? "px-2.5 py-1 text-[11px]" : "px-4 py-1.5 text-[13px]"} ${
              on ? "bg-blue-600 text-white shadow" : "border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900"
            }`}
          >
            {p === "aqi" ? "AQI" : POLLUTANT_LABEL[p]}
          </button>
        );
      })}
    </div>
  );
}

/** Coloured band ruler with the current value's marker — the "where am I on the scale" strip. */
export function ScaleBar({ index, scale }: { index: number | null; scale: AqiScale }) {
  const stops = scale === "in"
    ? [["Good", 50], ["Satisfactory", 100], ["Moderate", 200], ["Poor", 300], ["Very Poor", 400], ["Severe", 500]] as const
    : scale === "us"
      ? [["Good", 50], ["Moderate", 100], ["USG", 150], ["Unhealthy", 200], ["Very Unhealthy", 300], ["Hazardous", 500]] as const
      : [["≤ guideline", 1], ["IT-4", 1.7], ["IT-3", 2.5], ["IT-2", 3.3], ["IT-1", 5], ["> IT-1", 8]] as const;
  const max = stops[stops.length - 1][1];
  const pct = index === null ? null : Math.min(100, (index / max) * 100);
  return (
    <div className="mt-2">
      <div className="relative h-2 w-full overflow-hidden rounded-full">
        <div className="flex h-full w-full">
          {stops.map(([label, hi], i) => {
            const lo = i === 0 ? 0 : stops[i - 1][1];
            const cat = categoryForIndex(scale === "who" ? hi * 15 / 15 : hi, scale);
            return <div key={label} style={{ width: `${((hi - lo) / max) * 100}%`, background: cat.color }} title={`${label} ≤ ${hi}`} />;
          })}
        </div>
        {pct !== null && (
          <div className="absolute -top-0.5 h-3 w-1 rounded-full bg-slate-900 ring-2 ring-white" style={{ left: `calc(${pct}% - 2px)` }} aria-hidden="true" />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        {stops.map(([label]) => <span key={label} className="truncate">{label}</span>)}
      </div>
    </div>
  );
}

/** The hero: this city's index right now, its category, the driving pollutant and the two anchors
 *  (PM2.5 / PM10) people recognise. No weather, no global rank — we show only what we measure. */
export function CityHero({ d, scale }: { d: Overview; scale: AqiScale }) {
  const index = scale === "in" ? d.now.aqi_in : scale === "us" ? d.now.aqi_us : (d.now.pollutants.pm25 ? pm25Index(d.now.pollutants.pm25.value, "who") : null);
  const cat = index !== null ? categoryForIndex(index, scale) : null;
  const prominent = scale === "us" ? d.now.prominent_us : d.now.prominent_in;
  const subs = scale === "us" ? d.now.sub_us : d.now.sub_in;
  const pm25 = d.now.pollutants.pm25, pm10 = d.now.pollutants.pm10;
  const newest = Object.values(d.now.pollutants).map((p) => p.hour).sort().pop();
  return (
    <div className="vn-card overflow-hidden">
      <div className="flex flex-wrap items-start gap-6 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-rose-500" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-rose-600">live</span>
          </div>
          <div className="mt-1 flex items-end gap-3">
            <span className="text-6xl font-extrabold leading-none tracking-tight" style={{ color: cat?.color }}>{formatIndex(index, scale)}</span>
            <span className="pb-1 text-[12px] font-semibold text-slate-500">{SCALES[scale].short}</span>
          </div>
          <div className="mt-1 text-lg font-bold" style={{ color: cat?.color }}>{cat?.label ?? "no reading"}</div>
          <ScaleBar index={index} scale={scale} />
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
            {pm25 && <span className="text-slate-600">PM2.5 <b className="text-slate-900">{pm25.value}</b> µg/m³</span>}
            {pm10 && <span className="text-slate-600">PM10 <b className="text-slate-900">{pm10.value}</b> µg/m³</span>}
            {prominent && <span className="text-slate-600">driven by <b className="text-slate-900">{POLLUTANT_LABEL[prominent] ?? prominent}</b></span>}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {d.name} · station means, {ago(newest)}
            {subs && Object.keys(subs).length > 1 && <> · sub-indices {Object.entries(subs).map(([k, v]) => `${POLLUTANT_LABEL[k] ?? k} ${v}`).join(" · ")}</>}
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-2">
          {d.rank && (
            <div className="rounded-xl border border-slate-200 px-3 py-2 text-right">
              <div className="text-2xl font-extrabold text-slate-900">#{d.rank.position}<span className="text-sm font-semibold text-slate-500"> of {d.rank.of}</span></div>
              <div className="text-[11px] text-slate-500">most polluted right now<br />among the {d.rank.of} cities we run</div>
            </div>
          )}
          {d.now.pm25_24h !== null && (
            <div className="rounded-xl border border-slate-200 px-3 py-2 text-right">
              <div className="text-2xl font-extrabold text-slate-900">{d.now.pm25_24h}</div>
              <div className="text-[11px] text-slate-500">PM2.5 µg/m³<br />mean of the last 24 h</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** One card per pollutant this city reports, with its sub-index colour as the accent. */
export function PollutantCards({ d, scale, onPick, selected, compact = false }: { d: Overview; scale: AqiScale; onPick: (p: Pollutant) => void; selected?: Pollutant; compact?: boolean }) {
  const subs = (scale === "us" ? d.now.sub_us : d.now.sub_in) ?? {};
  const entries = POLLUTANTS.filter((p) => d.now.pollutants[p]);
  const prominent = scale === "us" ? d.now.prominent_us : d.now.prominent_in;
  if (!entries.length) return null;
  return (
    <div className={compact ? "grid gap-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
      {entries.map((p) => {
        const r = d.now.pollutants[p];
        const sub = subs[p];
        const cat = sub !== undefined ? categoryForIndex(sub, scale) : null;
        return (
          <button
            key={p}
            onClick={() => onPick(p)}
            className={`vn-card flex items-center gap-3 p-3 text-left transition-shadow hover:shadow-md ${selected === p ? "ring-2 ring-blue-500" : ""}`}
            style={{ borderLeft: `4px solid ${cat?.color ?? "#94a3b8"}` }}
            title={sub !== undefined ? `${SCALES[scale].short} sub-index ${sub} — ${cat?.label}` : "no sub-index for this pollutant on this scale"}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-bold text-slate-800">{POLLUTANT_FULL[p]}</span>
                {prominent === p && <span className="shrink-0 rounded bg-slate-900 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white" title="This pollutant sets the city index right now">prominent</span>}
              </div>
              <div className="text-[11px] text-slate-500">{ago(r.hour)}{sub !== undefined ? ` · sub-index ${sub}` : ""}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold tabular-nums text-slate-900">{r.value}</div>
              <div className="text-[11px] text-slate-500">{r.unit ?? ""}</div>
            </div>
            <span className="text-slate-400" aria-hidden="true">›</span>
          </button>
        );
      })}
    </div>
  );
}

/** Section frame: title, city line, optional right-hand controls. */
export function Section({ title, city, right, children, note }: { title: string; city?: string; right?: ReactNode; children: ReactNode; note?: string }) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h2>
          {city && <div className="text-[13px] font-semibold text-blue-700">{city}</div>}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
      {note && <p className="mt-2 text-[11px] leading-4 text-slate-500">{note}</p>}
    </section>
  );
}

/** Colour swatch + label, used by the calendar and graph legends. */
export function BandLegend({ scale }: { scale: AqiScale }) {
  const stops = [10, 45, 75, 105, 180, 300];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {stops.map((pm) => {
        const cat = categoryForPm25(pm, scale);
        return (
          <span key={cat.label} className="flex items-center gap-1 text-[11px] text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: cat.color }} />{cat.label}
          </span>
        );
      })}
    </div>
  );
}
