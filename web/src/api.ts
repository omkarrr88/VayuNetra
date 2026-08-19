// Envelope-aware API client. Matches docs/API_CONTRACT.md.
//
// Demo insurance: if the backend is unreachable (Render cold start, judging-day
// outage), GET endpoints fall back to bundled demo fixtures instead of rendering
// blank panels, and an "api-fallback" event lets the app show a banner.
import fxCities from "./fixtures/cities.json";
import fxAqi from "./fixtures/aqi_current.json";
import fxAttribution from "./fixtures/attribution.json";
import fxForecast from "./fixtures/forecast.json";
import fxAdvisory from "./fixtures/advisory.json";
import fxEnforcement from "./fixtures/enforcement.json";
import fxComparison from "./fixtures/comparison.json";
import fxLatency from "./fixtures/latency.json";
import fxDossier from "./fixtures/dossier.json";
import fxSimulate from "./fixtures/simulate.json";
import fxRoi from "./fixtures/roi.json";
import fxInterventionsDelhi from "./fixtures/interventions_delhi.json";
import fxAttrMethods from "./fixtures/attribution_methods.json";
import fxStatic from "./fixtures/static_layers.json";
import fxCoverage from "./fixtures/coverage.json";
import fxTrend from "./fixtures/history_trend.json";
import fxBench from "./fixtures/benchmarks.json";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
// Supabase anon key — safe to expose in the browser (publishable by design).
const TOKEN = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
// Render free tier + a parallel first-load burst: the slowest live endpoint
// (~9s warm) regularly crossed the old 12s limit and false-triggered the
// demo-snapshot fallback. 25s tolerates warm-but-slow; a true cold start
// (30-60s) still falls back — which is exactly what the insurance is for.
const TIMEOUT_MS = 25_000;
// The live agent run regenerates a spiking city's whole enforcement worklist —
// legitimately slower than any read. It gets its own generous budget instead
// of the read timeout (which would abort a run the server happily finishes).
const AGENT_RUN_TIMEOUT_MS = 240_000;

export const API_BASE = BASE;
export const API_TOKEN = TOKEN;

type Envelope<T> = {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
};

type Row = Record<string, unknown>;

function byCity(rows: Row[], city: string | null): Row[] {
  if (!city) return rows;
  const hit = rows.filter((r) => r.city_id === city);
  return hit.length ? hit : rows; // mirror backend fixture_rows: fall back to all
}

/** Bundled-fixture answer for a GET path, or undefined if we don't cover it.
 *
 *  Async because the city-overview snapshot is ~290 KB for ten cities and is only ever needed when
 *  the API is unreachable. A dynamic import puts it in its own chunk, so the healthy path never
 *  downloads it and the insurance costs nothing until it is claimed. */
async function fixtureFor(path: string): Promise<unknown> {
  const url = new URL(path, "http://x");
  const p = url.pathname;
  const city = url.searchParams.get("city");
  if (p === "/cities") return fxCities;
  // The public overview page IS the home page. Without this it rendered an error box and nothing
  // else whenever the backend was asleep — 121 characters on the first screen a judge sees.
  if (p === "/city/overview") {
    const byId = (await import("./fixtures/city_overview.json")).default as Record<string, unknown>;
    return byId[city ?? "delhi"] ?? byId["delhi"];
  }
  if (p === "/city/now") {
    const byId = (await import("./fixtures/city_now.json")).default as Record<string, unknown>;
    return byId[city ?? "delhi"] ?? byId["delhi"];
  }
  if (p === "/aqi/current") return byCity(fxAqi as Row[], city);
  if (p === "/attribution") return byCity(fxAttribution as Row[], city);
  if (p === "/forecast") {
    const h = Number(url.searchParams.get("horizon") ?? 24);
    const rows = byCity(fxForecast as Row[], city).filter((r) => r.horizon_h === h);
    return rows.length ? rows : byCity(fxForecast as Row[], city);
  }
  if (p === "/advisory") {
    const lang = url.searchParams.get("lang");
    const rows = byCity(fxAdvisory as Row[], city);
    const hit = lang ? rows.filter((r) => !r.language || r.language === lang) : rows;
    return hit.length ? hit : rows;
  }
  if (p === "/enforcement") return byCity(fxEnforcement as Row[], city);
  if (/^\/enforcement\/\d+\/dossier$/.test(p)) return fxDossier;
  if (p === "/history/trend") {
    // real captured daily series per city (30/90/365d); nearest range wins
    const days = Number(url.searchParams.get("days") ?? 90);
    const key = String([365, 90, 30].reduce((a, b) => (Math.abs(b - days) < Math.abs(a - days) ? b : a)));
    const perCity = (fxTrend as Record<string, Record<string, unknown>>)[city ?? "delhi"];
    const entry = (perCity?.[key] ?? {}) as { series?: unknown[]; verdict?: unknown; days_of_history?: number };
    return { city_id: city ?? "delhi", days, series: entry.series ?? [], verdict: entry.verdict ?? null,
             days_of_history: entry.days_of_history ?? 0, note: url.searchParams.get("cell") ? "city-level history (offline snapshot)" : null };
  }
  if (p === "/metrics/benchmark") {
    const byId = fxBench as Record<string, unknown>;
    return byId[city ?? "delhi"] ?? byId["delhi"];
  }
  if (p === "/exposure") return undefined; // no offline fixture: the card simply hides itself
  if (p === "/metrics/interventions") return (city ?? "delhi") === "delhi" ? fxInterventionsDelhi : undefined; // Delhi's published artifact
  if (p === "/metrics/attribution") return fxAttrMethods; // production breakdown, 18 Aug 2026
  if (p === "/landing/snapshot") return undefined; // the landing keeps its bundled snapshot
  if (p === "/comparison") return fxComparison;
  if (p === "/latency") return fxLatency;
  if (p === "/simulate") return fxSimulate;
  if (p === "/roi") {
    const byId = fxRoi as Record<string, unknown>;
    return byId[city ?? "delhi"] ?? byId["delhi"];
  }
  if (p === "/static-layers") {
    // Only the seeded cities are in this fixture. Falling back to rows[0] meant that with the API
    // unreachable, Jaipur's City Intel panel showed Delhi's "Okhla industrial cluster" and
    // "Yamuna waste hotspot" labelled as Jaipur's — another city's places presented as this one's.
    // A missing fixture returns undefined so the card shows its empty state, which is what
    // /exposure and /landing/snapshot already do.
    return (fxStatic as Row[]).find((r) => r.city_id === (city ?? "delhi"));
  }
  if (p === "/coverage") {
    const byId = fxCoverage as Record<string, unknown>;
    return byId[city ?? "delhi"] ?? byId["delhi"];
  }
  return undefined;
}

// ---------------------------------------------------------------- request coalescing + micro-cache
// Console sections are full pages now, so every panel on a page mounts at once and fetches at once.
// That made one page load ask the same question several times: /city/overview three times on the
// forecast page (one per card that needs it), /attribution and /static-layers twice on enforcement.
// On a free-tier API each duplicate is a real round trip a user waits for.
//
// Two mechanisms, both GET-only:
//   · coalesce — a second call for a path already in flight joins the first instead of starting another
//   · micro-cache — a completed GET is reusable for CACHE_TTL_MS, which covers the mount storm and a
//     quick section switch, and is far too short for a stale reading to reach a decision
//
// Callers treat responses as read-only (they already did: the offline fixtures were always shared
// objects). Any mutation, and any enforcement change, clears the cache immediately, so an officer
// action never reads back through it.
const CACHE_TTL_MS = 10_000;
const inflight = new Map<string, Promise<unknown>>();
const cached = new Map<string, { at: number; data: unknown }>();

/** Drop everything: called after any mutation and on the enforcement-changed signal. */
export function clearApiCache(): void {
  cached.clear();
}
if (typeof window !== "undefined") {
  window.addEventListener("vn:enforcement-changed", clearApiCache);
}

function notifyFallback() {
  window.dispatchEvent(new CustomEvent("api-fallback"));
}

/** Fired on every successful live response — lets the app clear the
 * "backend waking up" banner the moment the backend is actually awake,
 * instead of showing it forever after one slow request. */
function notifyLive() {
  window.dispatchEvent(new CustomEvent("api-live"));
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method0 = (init?.method ?? "GET").toUpperCase();
  const cacheable = method0 === "GET" && !init?.signal;
  if (cacheable) {
    const hit = cached.get(path);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data as T;
    const live = inflight.get(path);
    if (live) return live as Promise<T>;
  }

  const run = fetchOnce<T>(path, init);
  if (cacheable) {
    inflight.set(path, run as Promise<unknown>);
    run.then((data) => cached.set(path, { at: Date.now(), data }))
       .catch(() => { /* never cache a failure */ })
       .finally(() => { if (inflight.get(path) === (run as Promise<unknown>)) inflight.delete(path); });
  } else {
    // a mutation may have changed anything a read would return
    run.then(clearApiCache).catch(() => { /* the caller surfaces the error */ });
  }
  return run;
}

async function fetchOnce<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (TOKEN && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${TOKEN}`);
  }
  const method = (init?.method ?? "GET").toUpperCase();
  const ctrl = new AbortController();
  const isAgentRun = new URL(path, "http://x").pathname === "/agent/query";
  const timer = setTimeout(() => ctrl.abort(), isAgentRun ? AGENT_RUN_TIMEOUT_MS : TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, headers, signal: ctrl.signal });
    const env = (await res.json()) as Envelope<T>;
    if (!env.success || env.data === null) {
      throw new Error(env.error?.message ?? `API error (${res.status})`);
    }
    notifyLive();
    return env.data;
  } catch (e) {
    // Silent-fallback idempotent reads plus the pure /simulate compute; real
    // mutations (e.g. advisory broadcast) must still surface their error.
    const idempotent =
      method === "GET" || new URL(path, "http://x").pathname === "/simulate";
    if (idempotent) {
      const fx = await fixtureFor(path);
      if (fx !== undefined) {
        notifyFallback();
        return fx as T;
      }
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch a binary endpoint (e.g. a PDF) with auth and trigger a browser download. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const headers = new Headers();
  if (TOKEN) headers.set("Authorization", `Bearer ${TOKEN}`);
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
