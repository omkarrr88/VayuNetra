// What a judge sees when something is broken.
//
// The demo runs on a Render free tier, a hall's wifi, and a laptop nobody has tested. This drives
// the built app through the failures that could actually happen on stage and asserts the only thing
// that matters: the page still says something true, and nothing crashes.
//
//   cd web && npm run build && npx vite preview --port 4180 &
//   BASE=http://localhost:4180 node scripts/qa/failure-modes.mjs
//
// Each scenario reports: page errors, whether real content rendered, whether a permanent skeleton or
// empty panel was left behind, and whether the "showing a snapshot" notice appeared when it should.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";

const BASE = process.env.BASE ?? "http://localhost:4180";
const API = process.env.API ?? "http://localhost:8000";
const OUT = process.env.OUT ?? ".qa-out/failure";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["overview", "/city/delhi", /Delhi/],
  ["rankings", "/rankings?city=delhi", /India, right now/],
  ["ops-action", "/console?city=delhi&section=action", /Enforcement/],
  ["ops-forecast", "/console?city=delhi&section=forecast", /Forecast/],
];

/** Every scenario is a function that installs its failure on a fresh context. */
const SCENARIOS = [
  {
    key: "healthy",
    what: "nothing wrong — the control",
    expectFallback: false,
    setup: async () => {},
  },
  {
    key: "api-down",
    what: "API unreachable (Render asleep, or the venue blocks it)",
    expectFallback: true,
    setup: async (ctx) => ctx.route(`${API}/**`, (r) => r.abort("connectionrefused")),
  },
  {
    key: "api-500",
    what: "API up but every endpoint errors",
    expectFallback: true,
    setup: async (ctx) => ctx.route(`${API}/**`, (r) =>
      r.fulfill({ status: 500, contentType: "application/json",
        body: JSON.stringify({ success: false, data: null, error: { code: "boom", message: "upstream failure" } }) })),
  },
  {
    key: "api-401",
    what: "wrong or missing anon key — the deploy-config mistake",
    expectFallback: true,
    setup: async (ctx) => ctx.route(`${API}/**`, (r) =>
      r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ detail: "Missing authorization token" }) })),
  },
  {
    key: "api-garbage",
    what: "API returns HTML instead of JSON (a proxy or captive portal in the way)",
    expectFallback: true,
    setup: async (ctx) => ctx.route(`${API}/**`, (r) =>
      r.fulfill({ status: 200, contentType: "text/html", body: "<html><body>Sign in to the venue wifi</body></html>" })),
  },
  {
    key: "api-one-endpoint-down",
    what: "only /coverage fails — partial degradation, the most likely real failure",
    expectFallback: null,   // may or may not trigger; must not crash either way
    setup: async (ctx) => ctx.route(`${API}/coverage*`, (r) =>
      r.fulfill({ status: 500, contentType: "application/json",
        body: JSON.stringify({ success: false, data: null, error: { code: "boom", message: "no coverage" } }) })),
  },
  {
    key: "no-webgl",
    what: "WebGL blocked or no GPU — the map cannot initialise",
    expectFallback: null,
    setup: async (ctx) => ctx.addInitScript(() => {
      const real = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
        if (String(kind).includes("webgl")) return null;
        return real.call(this, kind, ...rest);
      };
    }),
  },
  {
    key: "no-storage",
    what: "localStorage throws — private mode, or storage blocked by policy",
    expectFallback: null,
    setup: async (ctx) => ctx.addInitScript(() => {
      const boom = () => { throw new DOMException("blocked", "SecurityError"); };
      try {
        Object.defineProperty(window, "localStorage", {
          configurable: true,
          get: () => ({ getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 }),
        });
      } catch { /* nothing we can do */ }
    }),
  },
];

/** Did the page render something real, and is anything permanently blank? */
const INSPECT = () => {
  const text = (document.querySelector("main") || document.body).innerText || "";
  const skeletons = document.querySelectorAll(".vn-skeleton").length;
  const notice = /waking up|snapshot|last captured/i.test(document.body.innerText || "");
  // a panel with a heading but no content underneath reads as broken
  let emptyPanels = 0;
  for (const p of document.querySelectorAll(".vn-panel, section.vn-panel")) {
    const t = (p.innerText || "").trim();
    if (t.length < 24) emptyPanels += 1;
  }
  return { chars: text.trim().length, skeletons, notice, emptyPanels, sample: text.trim().slice(0, 120) };
};

const b = await chromium.launch();
const findings = [];
const rows = [];

for (const sc of SCENARIOS) {
  for (const [pageName, path, marker] of PAGES) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => { try { localStorage.setItem("vayunetra-tour-v1", "done"); } catch { /* blocked */ } });
    await sc.setup(ctx);
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(`pageerror: ${String(e).slice(0, 120)}`));
    p.on("console", (m) => {
      if (m.type() !== "error") return;
      const t = m.text();
      // failures we deliberately caused produce expected network noise
      if (/favicon|manifest|Failed to load resource|net::ERR|net::ERR_FAILED|500 \(|401 \(/i.test(t)) return;
      errs.push(`console: ${t.slice(0, 120)}`);
    });

    await p.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 60_000 }).catch(() => {});
    await p.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    // past the deferral backstop, so nothing is still waiting by design
    await p.waitForTimeout(pageName.startsWith("ops") ? 6000 : 4000);

    const seen = await p.evaluate(INSPECT).catch(() => null);
    // Scope to main: /Delhi/ also matches an <option> in the city select, which is never "visible",
    // so an unscoped .first() reported every healthy page as marker-less.
    const markerVisible = await p.locator("main").getByText(marker).first().isVisible().catch(() => false);
    await p.screenshot({ path: `${OUT}/${sc.key}-${pageName}.jpg`, type: "jpeg", quality: 60, fullPage: false }).catch(() => {});

    const row = { scenario: sc.key, page: pageName, errors: errs.length, marker: markerVisible, ...(seen || {}) };
    rows.push(row);

    const tag = `${sc.key}/${pageName}`;
    if (errs.length) findings.push({ tag, kind: "crash", detail: [...new Set(errs)].slice(0, 2).join(" | ") });
    if (!seen || seen.chars < 200) findings.push({ tag, kind: "blank", detail: `only ${seen?.chars ?? 0} chars of text rendered` });
    else if (!markerVisible) findings.push({ tag, kind: "no-marker", detail: `expected ${marker} — got "${seen.sample}"` });
    if (seen && seen.skeletons > 0) findings.push({ tag, kind: "stuck-skeleton", detail: `${seen.skeletons} skeleton(s) still showing after the backstop` });
    if (seen && seen.emptyPanels > 0) findings.push({ tag, kind: "empty-panel", detail: `${seen.emptyPanels} panel(s) with a heading and no content` });
    if (sc.expectFallback === true && seen && !seen.notice) {
      findings.push({ tag, kind: "no-notice", detail: "served a snapshot without telling the user" });
    }
    if (sc.expectFallback === false && seen && seen.notice) {
      findings.push({ tag, kind: "false-notice", detail: "claimed a snapshot while the API was healthy" });
    }

    await ctx.close();
  }
}
await b.close();

writeFileSync(`${OUT}/report.json`, JSON.stringify({ rows, findings }, null, 1));

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("scenario", 24), pad("page", 14), pad("err", 5), pad("marker", 7), pad("chars", 7), pad("skel", 5), pad("empty", 6), "notice");
for (const r of rows) {
  console.log(pad(r.scenario, 24), pad(r.page, 14), pad(r.errors, 5), pad(r.marker ? "yes" : "NO", 7),
              pad(r.chars ?? 0, 7), pad(r.skeletons ?? 0, 5), pad(r.emptyPanels ?? 0, 6), r.notice ? "shown" : "-");
}
console.log(`\n=== findings (${findings.length}) ===`);
for (const f of findings) console.log(` [${f.kind}] ${f.tag}\n     ${f.detail}`);
if (!findings.length) console.log(" none — every failure mode degrades cleanly");
console.log(`\nreport → ${OUT}/report.json · screenshots → ${OUT}`);
