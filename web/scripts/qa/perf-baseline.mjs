// Performance baseline: what the user actually waits for, per page and per endpoint.
//
// Measures against the production BUILD (not the dev server), because dev serves unbundled modules
// and its numbers mean nothing. Reports navigation timings, First Contentful Paint, Largest
// Contentful Paint, total transfer, request count, the slowest requests, and long tasks.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

const BASE = process.env.BASE ?? "http://localhost:4173";   // vite preview
const API = process.env.API ?? "http://localhost:8000";
const OUT = process.env.OUT ?? ".qa-out/perf";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["landing", "/"],
  ["overview", "/city/delhi"],
  ["map", "/map?city=delhi"],
  ["forecast", "/forecast?city=delhi"],
  ["rankings", "/rankings?city=delhi"],
  ["console-action", "/console?city=delhi&section=action"],
  ["console-forecast", "/console?city=delhi&section=forecast"],
];

const b = await chromium.launch();
const rows = [];

for (const [name, path] of PAGES) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));

  const reqs = [];
  const apiHits = [];
  p.on("request", (r) => { if (r.url().startsWith(API)) apiHits.push(r.url().replace(API, "")); });
  p.on("response", async (r) => {
    const t = r.request().timing();
    let size = 0;
    try { size = Number((await r.headerValue("content-length")) ?? 0); } catch { /* stream */ }
    reqs.push({
      url: r.url().replace(BASE, "").replace(API, "API"),
      status: r.status(),
      ms: t ? Math.round(t.responseEnd - t.startTime) : null,
      kb: Math.round(size / 1024),
      type: r.request().resourceType(),
    });
  });

  const t0 = Date.now();
  await p.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 60_000 }).catch(() => {});
  const loadMs = Date.now() - t0;
  // let the data land
  await p.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => {});
  const settledMs = Date.now() - t0;

  const vitals = await p.evaluate(() => new Promise((resolve) => {
    const out = { fcp: null, lcp: null, dcl: null, load: null, longTasks: 0, longTaskMs: 0, transferKB: 0, resources: 0 };
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav) { out.dcl = Math.round(nav.domContentLoadedEventEnd); out.load = Math.round(nav.loadEventEnd); }
    for (const e of performance.getEntriesByType("paint")) if (e.name === "first-contentful-paint") out.fcp = Math.round(e.startTime);
    const res = performance.getEntriesByType("resource");
    out.resources = res.length;
    out.transferKB = Math.round(res.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024);
    try {
      const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) out.lcp = Math.round(e.startTime); });
      po.observe({ type: "largest-contentful-paint", buffered: true });
      const lo = new PerformanceObserver((l) => { for (const e of l.getEntries()) { out.longTasks += 1; out.longTaskMs += Math.round(e.duration); } });
      lo.observe({ type: "longtask", buffered: true });
    } catch { /* unsupported */ }
    setTimeout(() => resolve(out), 600);
  }));

  const apiReqs = apiHits.map((u) => ({ url: "API" + u }));
  const slowest = [...reqs].sort((a, bb) => (bb.ms ?? 0) - (a.ms ?? 0)).slice(0, 6);
  rows.push({ name, path, loadMs, settledMs, ...vitals, requests: reqs.length, apiCalls: apiReqs.length, slowest, apiReqs });
  await ctx.close();
}
await b.close();

writeFileSync(`${OUT}/baseline.json`, JSON.stringify(rows, null, 1));

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("page", 18), pad("FCP", 7), pad("LCP", 7), pad("load", 8), pad("settled", 9), pad("reqs", 6), pad("API", 5), pad("KB", 7), "longTasks");
for (const r of rows) {
  console.log(pad(r.name, 18), pad(r.fcp ?? "-", 7), pad(r.lcp ?? "-", 7), pad(r.loadMs + "ms", 8),
              pad(r.settledMs + "ms", 9), pad(r.requests, 6), pad(r.apiCalls, 5), pad(r.transferKB, 7),
              `${r.longTasks} (${r.longTaskMs}ms)`);
}
console.log("\n--- slowest requests per page ---");
for (const r of rows) {
  console.log(`\n${r.name}:`);
  for (const s of r.slowest) console.log(`  ${String(s.ms ?? "-").padStart(6)}ms ${String(s.kb).padStart(5)}KB ${s.type.padEnd(10)} ${s.url.slice(0, 78)}`);
}
console.log(`\nreport → ${OUT}/baseline.json`);
