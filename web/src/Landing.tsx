// Public landing page — light theme only. Console lives at /console.
import { useEffect, useState } from "react";
import { api } from "./api";
import { aqiCategory, categoryForIndex, formatIndex, pm25ToAqi, POLLUTANT_LABEL, SCALES, bandInk } from "./aqi";
import { linkClick } from "./router";

type AqiRow = { pm25?: number; value?: number };
type Trace = { total_latency_ms?: number };

/* Minimal 20px stroke icons — no emoji, no icon fonts. */
function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const IC = {
  hex: "M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2zM12 8v4m0 0l3.5 2M12 12l-3.5 2",
  chart: "M3 20h18M5 16l4-5 3 3 6-8M17 6h2v2",
  scale: "M12 3v18m-7-3h14M7 7l-3 6h6l-3-6zm10 0l-3 6h6l-3-6zM5 7h14",
  megaphone: "M3 11v2a1 1 0 001 1h2l4 4V7L6 11H4a1 1 0 00-1 0zM14 8a4 4 0 010 8M17 5a8 8 0 010 14",
  flame: "M12 3s5 4.5 5 9a5 5 0 01-10 0c0-1.5.5-3 1.5-4.5 0 0 .5 2 2 2.5C10 8 10.5 5 12 3z",
  chip: "M9 9h6v6H9zM5 5h14v14H5zM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3",
  arrow: "M5 12h14m-6-6l6 6-6 6",
  shield: "M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z",
  leaf: "M6 21c0-6 3-13 13-15-1 10-6 14-13 15zm0 0c2-4 5-7 9-9",
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18zm-9 9h18M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9z",
  rupee: "M6 3h12M6 8h12M6 3c6 0 8 2 8 5s-2 5-8 5l8 8",
  doc: "M7 3h7l5 5v13H7V3zm7 0v5h5M10 13h5m-5 4h5",
  github:
    "M12 2a10 10 0 00-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.6.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.2-.4-1.2.1-2.6 0 0 .8-.3 2.7 1a9.4 9.4 0 015 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0012 2z",
};

const STEPS = [
  {
    icon: IC.hex,
    title: "Trace",
    body: "A gradient-boosted model with SHAP explanations assigns PM2.5 blame to traffic, construction, industry and burning — per square-kilometre H3 cell, cross-checked, bucket by bucket, against published apportionment studies for Delhi and Bengaluru — agreements and disagreements both shown.",
  },
  {
    icon: IC.chart,
    title: "Predict",
    body: "Quantile forecasts at 24, 48 and 72 hours for every cell, with conformal-calibrated intervals and a calibrated probability of crossing Very Poor / Severe. Benchmarked on a strict temporal split against persistence, seasonal-naive and climatology — the numbers, including the weak spots, are printed in the product.",
  },
  {
    icon: IC.scale,
    title: "Act",
    body: "A ranked enforcement worklist scores 647 registered and satellite-detected sources across 10 cities. One click opens an evidence dossier with a real Sentinel-2 patch, regulatory citations, and a draft notice PDF.",
  },
  {
    icon: IC.megaphone,
    title: "Protect",
    body: "Health advisories generated from the forecast and targeted at the most vulnerable zones — 11,000+ mapped hospitals, 7,700+ schools, elder-care homes and outdoor-work sites — in eight Indian languages (Hindi, Kannada, Marathi, Tamil, Telugu, Bengali, Gujarati, English) over the web app, Telegram, IVR calls and public displays.",
  },
];

const FEATURES = [
  { icon: IC.hex, title: "Source blame map", body: "Interactive hexagon map with per-source shares, SHAP drivers in µg/m³, satellite NO₂ overlay and detected-source pins. Every cell explains why it was blamed." },
  { icon: IC.chart, title: "Hyperlocal forecasts", body: "24/48/72 h per ~1 km cell with honest, CQR-calibrated 80% intervals — and the skill numbers printed next to them, including the weak spots." },
  { icon: IC.scale, title: "Enforcement intelligence", body: "Prioritised worklist with category filters, evidence dossiers carrying real Sentinel-2 imagery and RAG citations, and one-click draft Notice PDFs." },
  { icon: IC.flame, title: "Multi-hazard alerts", body: "Heat×smog compound risk (IMD × CPCB criteria), dust×traffic co-occurrence corridors, and the statutory CAQM GRAP stage triggered a day early — by our own forecast." },
  { icon: IC.chip, title: "What-if simulator + optimiser", body: "Cited counterfactuals — odd-even, construction bans, full GRAP packages — and an optimiser that ranks intervention bundles by impact per inspector-hour." },
  { icon: IC.rupee, title: "Health & carbon ROI", body: "Every ΔPM2.5 priced in ₹, lives and CO₂e using WHO HRAPIE dose–response and GPW population — the NCAP funding case, fully cited." },
  { icon: IC.shield, title: "Vulnerability-targeted advisories", body: "5,495 zones scored from real OSM hospitals, clinics, schools, elder-care and outdoor-work sites × population. Advisories escalate where forecast air is bad and sensitive people are." },
  { icon: IC.leaf, title: "Clean-air zones", body: "The flip side of the blame map: the cleanest ~1 km cells right now, computed from the dense coverage field, with one-tap directions." },
  { icon: IC.globe, title: "Multi-city, config-driven", body: "10 cities live today — Delhi, Bengaluru, Mumbai, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad, Jaipur, Lucknow — with cross-city playbooks. Seven were onboarded from config in one week; every layer is city-agnostic." },
  { icon: IC.megaphone, title: "Citizen channels", body: "Eight languages in their own scripts — Hindi, Kannada, Marathi, Tamil, Telugu, Bengali, Gujarati, English — over PWA, a Telegram bot judges can subscribe to live (/start), IVR voice calls and a public-display mode." },
  { icon: IC.chip, title: "Visible multi-agent pipeline", body: "Five agents on one LangGraph with per-node latency stamps, plus a spike gate that decides whether enforcement should run at all. A 'Run agents live' button replays the whole detect → decide → issue chain on stage — including the gate skipping enforcement when the air is clean." },
  { icon: IC.doc, title: "Honest by construction", body: "Attribution abstains without out-of-sample skill; intervals are calibrated; fairness is audited on live data; demo fixtures are labeled as fixtures. Nothing fabricated." },
];

const VALIDATION: Array<[string, string, string]> = [
  ["Attribution checked against published apportionment", "cosine 0.88 / 0.90 / 0.93", "vs SAFAR-Delhi 2018, CSTEP-Bengaluru 2022 (verified from the report), Urban-Emissions Mumbai — plus bucket-by-bucket tables vs TERI-ARAI and Guttikunda et al."],
  ["Attribution behaves physically", "2.30× traffic signal in rush hours", "IST rush vs off-peak SHAP, weather controlled"],
  ["Forecast beats real baselines", "Delhi +9 / +13 / +12% · Mumbai +17 / +19 / +21% at 24/48/72 h", "multi-season temporal split (2025-26 winter + summer 2026), monthly refit on the trailing 90 d; served forecast = LightGBM blended with persistence; vs persistence and weekly seasonal-naive — the raw model's weaker numbers ship too"],
  ["It warns before the air turns", "51–54% of Very Poor onsets flagged 1–3 days ahead", "alarm on the calibrated probability P ≥ 0.3 (precision 0.64–0.68); persistence catches 0% by construction; the Severe tail stays weak — stated, not hidden"],
  ["Uncertainty is calibrated, and where it is not we say so", "80% band → 0.783 Delhi · 0.749 Kolkata, published by predicted level", "conformal calibration; we report coverage per predicted band rather than one marginal number, because Kolkata drops to 0.55 where it matters most"],
  ["Enforcement is equitable", "no socio-economic inputs, by construction", "fairness audit on every live recommendation (n=390 at the July audit)"],
  ["Model choice was earned", "TFT trained on GPU — and rejected", "LightGBM won every launch city on held-out skill"],
  ["The loop is fast", "seconds from signal to cited recommendation", "measured pipeline latency with live per-node agent traces — the time to PRODUCE the recommendation, not a municipality's response time; approval, dispatch and closure are timestamped per action"],
];

const DATA_SOURCES = ["CPCB / CAAQMS", "Sentinel-5P", "Sentinel-2", "Open-Meteo · ERA5", "NASA FIRMS", "OpenStreetMap", "GPW v4.11"];

// Fallback snapshot (production, 18 August 2026) — used only until GET /landing/snapshot
// answers; the live payload replaces every number below. Colors match the console.
const MIX_COLOR: Record<string, string> = { traffic: "#ef4444", transported: "#3b82f6", industrial: "#9333ea", construction_dust: "#ca8a04", biomass_burning: "#16a34a", other: "#6b7280" };
const MIX_LABEL: Record<string, string> = { construction_dust: "construction dust", biomass_burning: "biomass burning", industrial: "industry", transported: "regional transport" };
/** One row of the live city board — the index is the server composite (index of the city mean),
 *  the same number that city's own page shows. */
type CityBoardRow = {
  city_id: string; name: string; current_pm25: number | null; forecast_24h_pm25: number | null;
  dominant_source?: string; aqi_in?: number | null; prominent_in?: string | null;
};

type Snapshot = {
  generated_at: string;
  mix: { source: string; pct: number }[];
  cities: { name: string; now: number | null; next: number | null; trend: string | null }[];
  scale: { cells: number | null; sources: number | null; zones: number | null; recs: number | null };
};
const SNAPSHOT_MIX: Array<[string, number, string]> = [
  ["traffic", 50.2, "#ef4444"],
  ["transported", 13.5, "#3b82f6"],
  ["industrial", 13.3, "#9333ea"],
  ["construction dust", 12.4, "#ca8a04"],
  ["other", 10.6, "#6b7280"],
];
const SNAPSHOT_CITIES: Array<[string, number, number, string]> = [
  ["Delhi", 38.3, 43.0, "stable"],
  ["Jaipur", 40.5, 37.6, "stable"],
  ["Ahmedabad", 32.2, 30.6, "stable"],
  ["Kolkata", 26.1, 21.1, "stable"],
  ["Hyderabad", 22.1, 21.8, "stable"],
  ["Lucknow", 20.3, 19.4, "stable"],
  ["Pune", 20.1, 16.4, "stable"],
  ["Chennai", 16.7, 19.6, "stable"],
  ["Bengaluru", 13.1, 10.2, "stable"],
  ["Mumbai", 12.3, 19.7, "stable"],
];
const SNAPSHOT_SCALE: Array<[string, string]> = [
  ["16,529", "~1 km² cells modeled across 10 cities"],
  ["647", "registered + satellite-detected sources"],
  ["5,495", "vulnerability-scored zones (hospitals, schools, outdoor work)"],
  ["399", "live enforcement recommendations"],
];

export default function Landing() {
  const [aqi, setAqi] = useState<number | null>(null);
  const [latencyS, setLatencyS] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [board, setBoard] = useState<CityBoardRow[]>([]);

  useEffect(() => {
    api<{ cities: CityBoardRow[] }>("/comparison")
      .then((c) => setBoard((c.cities ?? []).filter((x) => typeof x.current_pm25 === "number")))
      .catch(() => setBoard([]));
    api<Snapshot>("/landing/snapshot")
      .then((d) => { if (d && d.mix?.length && d.cities?.length) setSnap(d); })
      .catch(() => {});
    api<AqiRow[]>("/aqi/current?city=delhi")
      .then((rows) => {
        const pm = rows.map((r) => r.pm25 ?? r.value).filter((v): v is number => typeof v === "number");
        if (pm.length) setAqi(pm25ToAqi(Math.max(...pm)));
      })
      .catch(() => {});
    api<Trace>("/latency?city=delhi")
      .then((t) => {
        const ms = t?.total_latency_ms;
        if (typeof ms === "number" && ms > 0) setLatencyS((ms / 1000).toFixed(1));
      })
      .catch(() => {});
  }, []);

  const cat = aqi !== null ? aqiCategory(aqi) : null;
  const mix: Array<[string, number, string]> = snap
    ? snap.mix.filter((m) => m.pct > 0).map((m) => [MIX_LABEL[m.source] ?? m.source, m.pct, MIX_COLOR[m.source] ?? "#6b7280"])
    : SNAPSHOT_MIX;
  const cities: Array<[string, number, number, string]> = snap
    ? snap.cities.filter((c) => c.now !== null).map((c) => [c.name, Math.round((c.now ?? 0) * 10) / 10, Math.round((c.next ?? c.now ?? 0) * 10) / 10, c.trend ?? "stable"])
    : SNAPSHOT_CITIES;
  const fmt = (n: number | null | undefined, fallback: string) => (typeof n === "number" && n > 0 ? n.toLocaleString("en-IN") : fallback);
  const scale: Array<[string, string]> = snap
    ? [
        [fmt(snap.scale.cells, SNAPSHOT_SCALE[0][0]), SNAPSHOT_SCALE[0][1]],
        [fmt(snap.scale.sources, SNAPSHOT_SCALE[1][0]), SNAPSHOT_SCALE[1][1]],
        [fmt(snap.scale.zones, SNAPSHOT_SCALE[2][0]), SNAPSHOT_SCALE[2][1]],
        [fmt(snap.scale.recs, SNAPSHOT_SCALE[3][0]), SNAPSHOT_SCALE[3][1]],
      ]
    : SNAPSHOT_SCALE;
  const asOf = snap ? new Date(snap.generated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "18 August 2026";

  return (
    <div className="vn-landing min-h-full overflow-y-auto antialiased" style={{ scrollBehavior: "smooth" }}>
      {/* Nav */}
      <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <a href="/" onClick={(e) => linkClick(e, "/")} className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-slate-900">
              <img src="/icon-192.png" alt="" className="h-6 w-6 rounded-md" width={24} height={24} />
              VayuNetra
            </a>
            <div className="hidden items-center gap-6 text-[13px] text-slate-500 md:flex">
              <a href="#how" className="transition-colors hover:text-slate-900">How it works</a>
              <a href="#architecture" className="transition-colors hover:text-slate-900">Architecture</a>
              <a href="#platform" className="transition-colors hover:text-slate-900">Platform</a>
              <a href="#validation" className="transition-colors hover:text-slate-900">Validation</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/omkarrr88/VayuNetra" target="_blank" rel="noreferrer"
              className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900" title="Source on GitHub" aria-label="Source on GitHub">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true"><path d={IC.github} /></svg>
            </a>
            <a href="/city/delhi" onClick={(e) => linkClick(e, "/city/delhi")}
              className="hidden rounded-md border border-slate-300 px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 sm:block min-h-11 flex items-center">
              Check your city
            </a>
            <a href="/console" onClick={(e) => linkClick(e, "/console")}
              className="rounded-md bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-700 min-h-11 flex items-center">
              Open console
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="vn-hero vn-rise mx-auto max-w-6xl px-6 pb-12 pt-16 sm:pt-24" style={{ ["--wash" as string]: cat?.color ?? "var(--primary)" }}>
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-sky-700">
          ET AI Hackathon 2026 · Problem Statement 5
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-[3.4rem]">
          The operations layer for urban air quality.
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-slate-600">
          India already measures its air — 900+ CAAQMS stations — yet a 2024 CAG audit found only 31% of
          monitored cities have any actionable response protocol. VayuNetra is that missing layer: it traces
          PM2.5 to its sources square-kilometre by square-kilometre, forecasts 72 hours ahead with calibrated
          uncertainty, and turns both into cited enforcement notices and citizen alerts in eight languages.
          Live today across 10 Indian cities — from Delhi to Lucknow — built entirely on free public infrastructure.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a href="/city/delhi" onClick={(e) => linkClick(e, "/city/delhi")}
            className="flex items-center gap-2 rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 min-h-11">
            Check your city's air
            <Icon d={IC.arrow} className="h-4 w-4" />
          </a>
          <a href="/console" onClick={(e) => linkClick(e, "/console")}
            className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 min-h-11 flex items-center">
            Open the console
          </a>
          <a href="#how"
            className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 min-h-11 flex items-center">
            How it works
          </a>
        </div>
        {/* Each fact is one unbreakable unit, so on a phone the strip wraps by fact, never mid-phrase. */}
        {(cat || latencyS) && (
          <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1.5 font-mono text-xs text-slate-500">
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              live
            </span>
            {cat && (
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span className="text-slate-400">·</span>
                Delhi AQI <span title={SCALES.in.note} style={{ background: cat.color, color: cat.text }} className="rounded px-1.5 py-0.5 font-bold">{aqi} {cat.label}</span>
              </span>
            )}
            {cat && <span className="hidden text-slate-400 md:inline">({SCALES.in.short}; the console can switch to US · EPA or WHO)</span>}
            {latencyS && (
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span className="text-slate-400">·</span>
                last pipeline run {latencyS}s end-to-end
              </span>
            )}
          </p>
        )}
      </header>

      {/* Product screenshot in a browser frame */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="ml-3 rounded bg-white px-3 py-0.5 font-mono text-[11px] text-slate-500 ring-1 ring-slate-200">
              vayunetra-aqi.vercel.app/console
            </span>
          </div>
          <img src="/console.jpg" alt="VayuNetra operations console: source blame map with SHAP explanation, forecast, enforcement worklist and a Sentinel-2 evidence dossier"
            className="block w-full" width={2400} height={1500} />
        </div>
        <p className="mt-3 text-center font-mono text-[11px] text-slate-500">
          The live console — a Delhi cell opened: attribution shares with the SHAP "why", 72 h forecast, and the enforcement dossier with real satellite evidence.
        </p>
      </div>

      {/* Data sources strip */}
      <div className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
          Built on public data infrastructure
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-mono text-[13px] text-slate-500">
          {DATA_SOURCES.map((s) => <span key={s}>{s}</span>)}
        </div>
      </div>

      {/* The numbers, right now — real production snapshot, hand-rolled SVG
          (no chart library on the landing: the console bundle stays split). */}
      <section className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-14">
          {board.length > 0 && (
            <div className="mb-14">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sky-700">Live right now</p>
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Ten cities, this minute.</h2>
                <p className="text-[13px] text-slate-500">Indian National AQI (CPCB) — the maximum of each city's pollutant sub-indices. Open any city.</p>
              </div>
              <div className="vn-stagger mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[...board].sort((a, b) => (b.aqi_in ?? 0) - (a.aqi_in ?? 0)).map((c) => {
                  const idx = c.aqi_in ?? null;
                  const cat = idx !== null ? categoryForIndex(idx, "in") : null;
                  return (
                    <a
                      key={c.city_id}
                      href={`/city/${c.city_id}`}
                      onClick={(e) => linkClick(e, `/city/${c.city_id}`)}
                      className="group rounded-xl border border-slate-200 p-3 transition-shadow hover:shadow-md"
                      title={`${c.name} — open the live city page${c.prominent_in ? ` · set by ${POLLUTANT_LABEL[c.prominent_in] ?? c.prominent_in}` : ""}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-bold text-slate-800 group-hover:text-slate-900">{c.name}</span>
                        <span className="text-[10px] text-slate-400 group-hover:text-sky-700">open →</span>
                      </div>
                      <div className="mt-1 flex items-end gap-2">
                        <span className="text-3xl font-extrabold leading-none tracking-tight" style={{ color: bandInk(cat?.color) }}>{formatIndex(idx, "in")}</span>
                        <span className="pb-0.5 text-[11px] font-semibold" style={{ color: bandInk(cat?.color) }}>{cat?.label}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, ((idx ?? 0) / 500) * 100)}%`, background: cat?.color }} />
                      </div>
                      <div className="mt-1.5 text-[11px] text-slate-500">
                        PM2.5 {c.current_pm25} µg/m³{c.prominent_in ? ` · ${POLLUTANT_LABEL[c.prominent_in] ?? c.prominent_in}` : ""}
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sky-700">The data, at a glance</p>
          <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Delhi source-mix donut */}
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">Who is to blame — Delhi</h3>
              <div className="mt-3 flex items-center gap-4">
                <svg viewBox="0 0 42 42" className="h-28 w-28 -rotate-90" role="img" aria-label="Delhi PM2.5 source mix">
                  {(() => {
                    const R = 15.9155; // circumference = 100
                    let off = 0;
                    return mix.map(([, pct, color]) => {
                      const el = (
                        <circle
                          key={color + off}
                          cx="21" cy="21" r={R} fill="none" stroke={color} strokeWidth="7"
                          strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-off}
                        />
                      );
                      off += pct;
                      return el;
                    });
                  })()}
                </svg>
                <div className="space-y-1">
                  {mix.map(([name, pct, color]) => (
                    <div key={name} className="flex items-center gap-2 text-[12px] text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
                      {name} <b className="text-slate-800">{pct}%</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* City PM2.5 now vs +24h */}
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">City PM2.5 — now vs forecast +24h</h3>
              <div className="mt-1 text-[10px] text-slate-500"><span className="inline-block h-2 w-3 rounded-sm bg-slate-400/70 align-middle" /> now &nbsp;·&nbsp; <span className="inline-block h-2 w-0.5 bg-blue-600 align-middle" /> +24h forecast &nbsp;·&nbsp; µg/m³, sorted by current level</div>
              <div className="mt-3 space-y-1.5">
                {cities.map(([name, now, next, trend]) => (
                  <div key={name} className="flex items-center gap-2 text-[11px]">
                    <span className="w-[4.6rem] shrink-0 truncate font-semibold text-slate-700">{name}</span>
                    <div className="relative h-2.5 flex-1 rounded-full bg-slate-100" title={`now ${now} · +24h ${next} µg/m³ · ${trend}`}>
                      <div className="absolute inset-y-0 left-0 rounded-full bg-slate-400/70" style={{ width: `${Math.min(100, (Number(now) / 60) * 100)}%` }} />
                      <div className="absolute inset-y-0 left-0 rounded-full border-r-2 border-blue-600" style={{ width: `${Math.min(100, (Number(next) / 60) * 100)}%` }} />
                    </div>
                    <span className="w-14 shrink-0 text-right font-mono text-[10px] text-slate-500">
                      {now}<span className="text-slate-400">→</span>{next}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scale numbers */}
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">Running scale</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {scale.map(([n, label]) => (
                  <div key={label} className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xl font-extrabold tracking-tight text-slate-900">{n}</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-6 text-[11px] text-slate-500">
            {snap ? "Live from the production system, as of " : "Snapshot from the production system, "}{asOf} — aggregated from real station measurements
            and the latest attribution run; refreshed every 10 minutes. Open the console for the cell-level numbers.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-slate-200 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sky-700">How it works</p>
          <h2 className="mt-3 max-w-xl text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            From raw signal to a signed notice, in one pipeline.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] text-slate-600">
            CPCB measures. SAFAR forecasts. The missing layer is operational: who is responsible in this
            square kilometre, and what should be done before tomorrow.
          </p>
          <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title}>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700"><Icon d={s.icon} /></span>
                  <span className="font-mono text-[11px] text-slate-500">0{i + 1}</span>
                </div>
                <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sky-700">Architecture</p>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Two seams. Five agents and a gate. Zero blocking.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] text-slate-600">
            Everything decouples through the Supabase schema and the API contract: models write rows, the API
            reads rows, panels call only the API. The spatial unit everywhere is an Uber H3 res-8 cell (~1 km).
            The same design let three people build in parallel for weeks — the architecture is also the team process.
          </p>
          <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
            <img src="/architecture.svg"
              alt="VayuNetra architecture: data sources feed the Supabase schema (seam one); the LangGraph agents read and write it; the FastAPI contract (seam two) serves the console, citizen channels and officer artefacts"
              className="block w-full" width={1280} height={720} />
          </div>
        </div>
      </section>

      {/* Platform features */}
      <section id="platform" className="border-t border-slate-200 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sky-700">Platform</p>
          <h2 className="mt-3 max-w-xl text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Everything a city needs to act — in one console.
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700"><Icon d={f.icon} /></span>
                <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-[13px] text-slate-500">
            Health text is deliberately LLM-free — deterministic templates cannot hallucinate medical advice.
            LLM polish over locked facts is on the roadmap, not in the safety path.
          </p>
        </div>
      </section>

      {/* Validation */}
      <section id="validation" className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sky-700">Validation</p>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Every number is checked — including the failures.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] text-slate-600">
            Each claim below is reproducible from the repository — the evaluation notebook and{" "}
            <code className="rounded bg-slate-100 px-1 text-[13px]">python -m ml.eval.benchmark</code>, whose
            artifacts the API serves and the console prints. Where a method underperformed, that result ships too.
          </p>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-3 pr-4 font-medium">Claim</th>
                  <th className="py-3 pr-4 font-medium">Result</th>
                  <th className="py-3 font-medium">Method</th>
                </tr>
              </thead>
              <tbody>
                {VALIDATION.map(([claim, result, method]) => (
                  <tr key={claim} className="border-b border-slate-200">
                    <td className="py-3.5 pr-4 text-[13px] text-slate-700">{claim}</td>
                    <td className="py-3.5 pr-4 font-mono text-[13px] font-semibold text-sky-700">{result}</td>
                    <td className="py-3.5 text-[13px] text-slate-500">{method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA + QR */}
      <section className="border-t border-slate-200 bg-slate-50/60">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 py-14 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">See it running on live data.</h2>
            <p className="mt-1 text-[14px] text-slate-600">Ten cities, real measurements, no sign-up.</p>
            <a href="/console" onClick={(e) => linkClick(e, "/console")}
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 min-h-11">
              Open the console
              <Icon d={IC.arrow} className="h-4 w-4" />
            </a>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <img src="/qr-app.svg" alt="QR code — open the VayuNetra app" className="mx-auto h-28 w-28" width={112} height={112} />
              <p className="mt-2 text-xs font-semibold text-slate-700">Open on your phone</p>
              <p className="font-mono text-[11px] text-slate-500">vayunetra-aqi.vercel.app</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <img src="/qr-telegram.svg" alt="QR code — subscribe to air-quality alerts on Telegram" className="mx-auto h-28 w-28" width={112} height={112} />
              <p className="mt-2 text-xs font-semibold text-slate-700">Subscribe on Telegram</p>
              <p className="font-mono text-[11px] text-slate-500">/start → pick your city</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 sm:flex-row sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[14px] font-bold text-slate-900">
              <img src="/icon-192.png" alt="" className="h-5 w-5 rounded" width={20} height={20} />
              VayuNetra
            </div>
            <p className="mt-2 max-w-xs text-[12px] leading-relaxed text-slate-500">
              Air-quality intelligence for smart-city intervention. Live in 10 Indian cities.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-[13px] sm:grid-cols-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Product</p>
              <div className="mt-2 space-y-1 text-slate-600">
                <a href="/console" onClick={(e) => linkClick(e, "/console")} className="block py-2 transition-colors hover:text-slate-900 min-h-10 flex items-center">Console</a>
                <a href="#how" className="block py-2 transition-colors hover:text-slate-900 min-h-10 flex items-center">How it works</a>
                <a href="#architecture" className="block py-2 transition-colors hover:text-slate-900 min-h-10 flex items-center">Architecture</a>
                <a href="#validation" className="block py-2 transition-colors hover:text-slate-900 min-h-10 flex items-center">Validation</a>
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Resources</p>
              <div className="mt-2 space-y-1 text-slate-600">
                <a href="https://github.com/omkarrr88/VayuNetra" target="_blank" rel="noreferrer" className="block py-2 transition-colors hover:text-slate-900 min-h-10 flex items-center">GitHub</a>
                <a href="https://vayunetra-c8i8.onrender.com/docs" target="_blank" rel="noreferrer" className="block py-2 transition-colors hover:text-slate-900 min-h-10 flex items-center">API reference</a>
                <a href="https://vayunetra-c8i8.onrender.com/health" target="_blank" rel="noreferrer" className="block py-2 transition-colors hover:text-slate-900 min-h-10 flex items-center">API status</a>
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Team</p>
              <div className="mt-2 space-y-1.5 text-slate-600">
                <span className="block">Omkar Kadam</span>
                <span className="block">Abhinav Prasad</span>
                <span className="block">Sejal Kumbhar</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 py-4 text-center font-mono text-[11px] text-slate-500">
          © 2026 VayuNetra · open source · built for ET AI Hackathon 2026 · ₹0 infrastructure
        </div>
      </footer>
    </div>
  );
}
