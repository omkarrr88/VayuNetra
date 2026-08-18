// Air-quality index scales the console can display. Concentrations, models, forecasts and
// advisories are always in PM2.5 µg/m³; the *scale* only changes how a concentration or an
// index is labelled and coloured:
//   in  — Indian National AQI (CPCB 2014): the official scale officers, GRAP and bulletins use
//   us  — US EPA AQI (PM2.5 breakpoints revised 2024): what aqi.in / IQAir show by default
//   who — WHO 2021 air-quality guideline: PM2.5 as multiples of the 15 µg/m³ 24-h guideline,
//         banded by the WHO interim targets (IT-1…IT-4)
// The server (`core/aqi.py`) computes the composite indices (max over the pollutants a cell
// reports, with the prominent pollutant); this file mirrors the PM2.5 sub-index so a cell that
// only carries PM2.5 (fixtures, forecasts) can be labelled client-side without a round trip.

export type AqiScale = "in" | "us" | "who";

export const SCALES: Record<AqiScale, { short: string; name: string; note: string }> = {
  in: { short: "IN · CPCB", name: "Indian National AQI (CPCB)", note: "Official Indian scale — max of pollutant sub-indices; what officers, GRAP and CPCB bulletins use." },
  us: { short: "US · EPA", name: "US EPA AQI", note: "The scale aqi.in and IQAir show by default; same PM2.5, different breakpoints and category names." },
  who: { short: "WHO", name: "WHO 2021 guideline", note: "PM2.5 as a multiple of the WHO 24-h guideline (15 µg/m³), banded by the WHO interim targets." },
};

export type AqiCategory = { label: string; color: string; text: string };

// [C_lo, C_hi, I_lo, I_hi] — PM2.5 µg/m³ → sub-index
const CPCB_PM25: [number, number, number, number][] = [
  [0, 30, 0, 50], [31, 60, 51, 100], [61, 90, 101, 200], [91, 120, 201, 300], [121, 250, 301, 400], [251, 500, 401, 500],
];
const EPA_PM25: [number, number, number, number][] = [
  [0, 9.0, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500],
];
const CPCB_CATS: [number, AqiCategory][] = [
  [50, { label: "Good", color: "#16a34a", text: "#ffffff" }],
  [100, { label: "Satisfactory", color: "#84cc16", text: "#1a2e05" }],
  [200, { label: "Moderate", color: "#eab308", text: "#422006" }],
  [300, { label: "Poor", color: "#f97316", text: "#ffffff" }],
  [400, { label: "Very Poor", color: "#dc2626", text: "#ffffff" }],
  [500, { label: "Severe", color: "#7f1d1d", text: "#ffffff" }],
];
const EPA_CATS: [number, AqiCategory][] = [
  [50, { label: "Good", color: "#16a34a", text: "#ffffff" }],
  [100, { label: "Moderate", color: "#eab308", text: "#422006" }],
  [150, { label: "Unhealthy for Sensitive Groups", color: "#f97316", text: "#ffffff" }],
  [200, { label: "Unhealthy", color: "#dc2626", text: "#ffffff" }],
  [300, { label: "Very Unhealthy", color: "#7e22ce", text: "#ffffff" }],
  [500, { label: "Hazardous", color: "#7f1d1d", text: "#ffffff" }],
];
// WHO 2021: 24-h guideline 15 µg/m³; interim targets IT-4 25, IT-3 37.5, IT-2 50, IT-1 75
const WHO_GUIDELINE = 15;
const WHO_BANDS: [number, AqiCategory][] = [
  [15, { label: "Within guideline", color: "#16a34a", text: "#ffffff" }],
  [25, { label: "Above guideline (≤ IT-4)", color: "#84cc16", text: "#1a2e05" }],
  [37.5, { label: "Above IT-4 (≤ IT-3)", color: "#eab308", text: "#422006" }],
  [50, { label: "Above IT-3 (≤ IT-2)", color: "#f97316", text: "#ffffff" }],
  [75, { label: "Above IT-2 (≤ IT-1)", color: "#dc2626", text: "#ffffff" }],
  [Infinity, { label: "Above IT-1", color: "#7f1d1d", text: "#ffffff" }],
];

function subIndex(table: [number, number, number, number][], c: number): number {
  for (const [clo, chi, ilo, ihi] of table) {
    if (c <= chi) return Math.round(((ihi - ilo) / (chi - clo)) * (Math.max(c, clo) - clo) + ilo);
  }
  return table[table.length - 1][3];
}

/** PM2.5 (µg/m³) → CPCB PM2.5 sub-index (kept for callers that predate the scale toggle). */
export function pm25ToAqi(pm25: number): number { return subIndex(CPCB_PM25, pm25); }
/** CPCB index → category (back-compat). */
export function aqiCategory(aqi: number): AqiCategory { return categoryForIndex(aqi, "in"); }

/** PM2.5 (µg/m³) → the scale's index value: CPCB / EPA sub-index, or WHO multiple (×). */
export function pm25Index(pm25: number, scale: AqiScale): number {
  if (scale === "in") return subIndex(CPCB_PM25, pm25);
  if (scale === "us") return subIndex(EPA_PM25, pm25);
  return Math.round((pm25 / WHO_GUIDELINE) * 10) / 10;
}

/** Category for an index value on the scale (WHO takes the µg/m³ value itself). */
export function categoryForIndex(index: number, scale: AqiScale): AqiCategory {
  const table = scale === "in" ? CPCB_CATS : scale === "us" ? EPA_CATS : null;
  if (!table) return categoryForPm25(index * WHO_GUIDELINE, "who");
  for (const [max, cat] of table) if (index <= max) return cat;
  return table[table.length - 1][1];
}

/** Category for a PM2.5 concentration on the scale — the one function every band colour uses. */
export function categoryForPm25(pm25: number, scale: AqiScale): AqiCategory {
  if (scale === "who") { for (const [max, cat] of WHO_BANDS) if (pm25 <= max) return cat; return WHO_BANDS[WHO_BANDS.length - 1][1]; }
  return categoryForIndex(pm25Index(pm25, scale), scale);
}

/** PM2.5 concentration bands (µg/m³) for legends and chart backgrounds. */
export function pm25Bands(scale: AqiScale): Array<{ lo: number; hi: number; color: string; label: string }> {
  if (scale === "in") return [
    { lo: 0, hi: 30, color: "#16a34a", label: "Good" }, { lo: 30, hi: 60, color: "#84cc16", label: "Satisfactory" }, { lo: 60, hi: 90, color: "#eab308", label: "Moderate" },
    { lo: 90, hi: 120, color: "#f97316", label: "Poor" }, { lo: 120, hi: 250, color: "#dc2626", label: "Very Poor" }, { lo: 250, hi: 500, color: "#7f1d1d", label: "Severe" },
  ];
  if (scale === "us") return [
    { lo: 0, hi: 9, color: "#16a34a", label: "Good" }, { lo: 9, hi: 35.4, color: "#eab308", label: "Moderate" }, { lo: 35.4, hi: 55.4, color: "#f97316", label: "Unhealthy for Sensitive Groups" },
    { lo: 55.4, hi: 125.4, color: "#dc2626", label: "Unhealthy" }, { lo: 125.4, hi: 225.4, color: "#7e22ce", label: "Very Unhealthy" }, { lo: 225.4, hi: 500, color: "#7f1d1d", label: "Hazardous" },
  ];
  return [
    { lo: 0, hi: 15, color: "#16a34a", label: "Within guideline" }, { lo: 15, hi: 25, color: "#84cc16", label: "≤ IT-4" }, { lo: 25, hi: 37.5, color: "#eab308", label: "≤ IT-3" },
    { lo: 37.5, hi: 50, color: "#f97316", label: "≤ IT-2" }, { lo: 50, hi: 75, color: "#dc2626", label: "≤ IT-1" }, { lo: 75, hi: 500, color: "#7f1d1d", label: "> IT-1" },
  ];
}

/** Legend entries for the PM2.5 map layer, per scale. */
export function pm25Legend(scale: AqiScale): [string, string][] {
  return pm25Bands(scale).map((b, i, arr) => {
    const range = i === 0 ? `≤${b.hi}` : i === arr.length - 1 ? `>${b.lo}` : `${b.lo}–${b.hi}`;
    return [`${range} ${b.label}`, b.color];
  });
}

/** Deck.gl RGBA for a PM2.5 value on the scale. */
export function pm25Rgba(pm25: number, scale: AqiScale, alpha = 205): [number, number, number, number] {
  const hex = categoryForPm25(pm25, scale).color.replace("#", "");
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), alpha];
}

/** Human formatting of an index on the scale ("81", "134", "3.3×"). */
export function formatIndex(v: number | null | undefined, scale: AqiScale): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–";
  return scale === "who" ? `${v.toFixed(1)}×` : `${Math.round(v)}`;
}

/** Row shape returned by GET /aqi/current. */
export type AqiRow = {
  h3_cell: string; pm25: number | null; value?: number; ts?: string; confidence?: number;
  pollutants?: Record<string, { value: number; unit?: string | null; ts?: string }>;
  aqi_in?: number | null; prominent_in?: string | null; aqi_us?: number | null; prominent_us?: string | null;
  sub_in?: Record<string, number>; sub_us?: Record<string, number>;
};

/** Headline for a set of cells on the scale: the worst cell's index (server composite when present,
 *  else the PM2.5 sub-index), its prominent pollutant, and the city-mean PM2.5. */
export function headline(rows: AqiRow[], scale: AqiScale): { index: number | null; category: AqiCategory | null; prominent: string | null; worstPm25: number | null; meanPm25: number | null; cell: AqiRow | null } {
  const withPm = rows.filter((r) => typeof (r.pm25 ?? r.value) === "number");
  if (!withPm.length) return { index: null, category: null, prominent: null, worstPm25: null, meanPm25: null, cell: null };
  const pm = (r: AqiRow) => (typeof r.pm25 === "number" ? r.pm25 : (r.value as number));
  const meanPm25 = withPm.reduce((s, r) => s + pm(r), 0) / withPm.length;
  const worstPm25 = Math.max(...withPm.map(pm));
  const idx = (r: AqiRow): { v: number; p: string } => {
    if (scale === "in" && typeof r.aqi_in === "number") return { v: r.aqi_in, p: r.prominent_in ?? "pm25" };
    if (scale === "us" && typeof r.aqi_us === "number") return { v: r.aqi_us, p: r.prominent_us ?? "pm25" };
    return { v: pm25Index(pm(r), scale), p: "pm25" };
  };
  let best: { r: AqiRow; v: number; p: string } | null = null;
  for (const r of withPm) { const x = idx(r); if (!best || x.v > best.v) best = { r, v: x.v, p: x.p }; }
  return { index: best!.v, category: categoryForIndex(best!.v, scale), prominent: best!.p, worstPm25, meanPm25, cell: best!.r };
}

export const POLLUTANT_LABEL: Record<string, string> = { pm25: "PM2.5", pm10: "PM10", no2: "NO₂", so2: "SO₂", co: "CO", o3: "O₃", nh3: "NH₃" };

/** Human "x min/h ago" from an ISO timestamp. */
export function agoLabel(iso?: string): string {
  if (!iso) return "–";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "now";
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
