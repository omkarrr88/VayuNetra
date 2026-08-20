// Building blocks of the public city page. Every value comes from GET /city/overview, which is
// computed from this city's own station readings — nothing here is city-specific in code, so all
// ten cities (and the eleventh, whenever a YAML is added) render identically.
import { type ReactNode } from "react";
import { POLLUTANT_LABEL, SCALES, WHO_AQG, categoryForIndex, formatIndex, pm25Bands, whoCategory, whoMultiple, whoWorst, type AqiScale, bandInk } from "../aqi";

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
    index: { hour: string; aqi_in: number; aqi_us: number; prominent_in: string; who?: number; prominent_who?: string }[];
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
    <div className={`vn-chiprow flex flex-wrap ${compact ? "gap-1" : "gap-2"}`} role="tablist" aria-label="Pollutant">
      {chips.map((p) => {
        const on = p === value;
        return (
          <button
            key={p}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(p)}
            className={`vn-chip rounded-full font-semibold transition-colors ${compact ? "px-2.5 py-1 text-[11px]" : "px-4 py-1.5 text-[13px]"} ${
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
export function ScaleBar({ index, scale, pollutant }: { index: number | null; scale: AqiScale; pollutant?: string | null }) {
  // On WHO the ticks are the interim targets OF THE POLLUTANT SETTING THE READING, expressed as
  // multiples of its own guideline. They used to be PM2.5's ladder regardless, so a bar showing a
  // PM10 reading marked IT-4 at 1.7× when PM10's IT-4 is 1.1× — the marker sat in the wrong band.
  const whoStops = (): readonly (readonly [string, number])[] => {
    const g = (pollutant && WHO_AQG[pollutant]) || WHO_AQG.pm25;
    const names = g.ladder.length === 6
      ? ["≤ guideline", "IT-4", "IT-3", "IT-2", "IT-1", "> IT-1"]
      : g.ladder.length === 4
        ? ["≤ guideline", "IT-2", "IT-1", "> IT-1"]
        : ["≤ guideline", "IT-1", "> IT-1"];
    return g.ladder.map((st, i) => [
      names[i] ?? `×${Math.round((st.limit / g.aqg) * 10) / 10}`,
      Number.isFinite(st.limit) ? Math.round((st.limit / g.aqg) * 100) / 100
        : Math.round((g.ladder[i - 1].limit / g.aqg) * 1.6 * 10) / 10,
    ] as const);
  };
  const stops = scale === "in"
    ? [["Good", 50], ["Satisfactory", 100], ["Moderate", 200], ["Poor", 300], ["Very Poor", 400], ["Severe", 500]] as const
    : scale === "us"
      ? [["Good", 50], ["Moderate", 100], ["USG", 150], ["Unhealthy", 200], ["Very Unhealthy", 300], ["Hazardous", 500]] as const
      : whoStops();
  const max = stops[stops.length - 1][1];
  const pct = index === null ? null : Math.min(100, (index / max) * 100);
  return (
    <div className="mt-2">
      <div className="relative h-2 w-full overflow-hidden rounded-full">
        <div className="flex h-full w-full">
          {stops.map(([label, hi], i) => {
            const lo = i === 0 ? 0 : stops[i - 1][1];
            const cat = scale === "who"
              ? (whoCategory(pollutant || "pm25", hi * ((WHO_AQG[pollutant || "pm25"] ?? WHO_AQG.pm25).aqg)) ?? { color: "#94a3b8", label: "", text: "#000" })
              : categoryForIndex(hi, scale);
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
  // WHO takes the pollutant furthest above ITS OWN guideline, the same way the CPCB and EPA indices
  // take the worst sub-index. Dividing PM2.5 alone by 15 while naming the CPCB prominent pollutant
  // meant the number and the caption described different pollutants.
  const heroWho = scale === "who" ? whoWorst(d.now.pollutants) : null;
  const index = scale === "in" ? d.now.aqi_in : scale === "us" ? d.now.aqi_us : heroWho?.multiple ?? null;
  const cat = scale === "who" ? heroWho?.category ?? null : index !== null ? categoryForIndex(index, scale) : null;
  const prominent = scale === "us" ? d.now.prominent_us : scale === "who" ? heroWho?.pollutant ?? null : d.now.prominent_in;
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
            <span className="text-6xl font-extrabold leading-none tracking-tight" style={{ color: bandInk(cat?.color) }}>{formatIndex(index, scale)}</span>
            <span className="pb-1 text-[12px] font-semibold text-slate-500">{SCALES[scale].short}</span>
          </div>
          <div className="mt-1 text-lg font-bold" style={{ color: bandInk(cat?.color) }}>{cat?.label ?? "no reading"}</div>
          <ScaleBar index={index} scale={scale} pollutant={prominent} />
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
  // Each card shows its pollutant's own sub-index on the chosen scale. On WHO that is the multiple
  // of that pollutant's own guideline — showing the CPCB sub-index here, as this did, meant the WHO
  // tab displayed CPCB numbers under a WHO heading.
  const subs = (scale === "us" ? d.now.sub_us : d.now.sub_in) ?? {};
  const entries = POLLUTANTS.filter((p) => d.now.pollutants[p]);
  const worst = scale === "who" ? whoWorst(d.now.pollutants) : null;
  const prominent = scale === "us" ? d.now.prominent_us : scale === "who" ? worst?.pollutant ?? null : d.now.prominent_in;
  if (!entries.length) return null;
  return (
    <div className={compact ? "grid gap-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
      {entries.map((p) => {
        const r = d.now.pollutants[p];
        const sub = scale === "who" ? whoMultiple(p, r.value) ?? undefined : subs[p];
        const cat = scale === "who"
          ? whoCategory(p, r.value)
          : sub !== undefined ? categoryForIndex(sub, scale) : null;
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
              <div className="text-[11px] text-slate-500">{ago(r.hour)}{sub !== undefined ? (scale === "who" ? ` · ${sub}× guideline` : ` · sub-index ${sub}`) : ""}</div>
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
  // Derived from the scale's own bands, one entry each. It used to probe six fixed PM2.5 values and
  // key on the resulting label — but on the US scale 75 and 105 µg/m³ are both "Unhealthy", and on
  // the WHO scale three of the six land above IT-1, so the legend both repeated itself and handed
  // React duplicate keys.
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {pm25Bands(scale).map((b) => (
        <span key={`${b.lo}-${b.hi}`} className="flex items-center gap-1 text-[11px] text-slate-600" title={`PM2.5 ${b.lo}–${b.hi} µg/m³`}>
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />{b.label}
        </span>
      ))}
    </div>
  );
}
