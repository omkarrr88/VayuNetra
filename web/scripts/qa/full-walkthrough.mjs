// Full application walkthrough — the front page, every public app page, every console section, and
// every control — against the local dev server (:5173) and live API (:8000, DEMO_MODE=false).
// Captures page errors, console errors and any 4xx/5xx API response, and writes the screenshots the
// User Guide embeds (docs/guide/*.jpg).
//
//   cd web && node scripts/qa/full-walkthrough.mjs
//
// Screenshots are taken of ELEMENTS, not of fixed rectangles. The old script clipped to the
// right rail's coordinates; the console is now full scrolling pages, so a fixed clip would capture
// the wrong region on every card. `card()` finds the panel by its heading and shoots its own box,
// which survives any future layout change.
//
// It performs REAL officer actions on one Delhi recommendation (approve → dispatch → close) and
// resets that recommendation to 'proposed' at the end (the audit trail keeps the record).
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";

const base = "http://localhost:5173";
const api = "http://localhost:8000";
const OUT = process.env.OUT ?? "../docs/guide";
mkdirSync(OUT, { recursive: true });

const log = [];
const problems = [];
const say = (m) => { log.push(m); console.log(m); };
const step = async (name, fn) => {
  try { await fn(); say(`ok   ${name}`); }
  catch (e) { problems.push(`${name}: ${String(e).split("\n")[0]}`); say(`FAIL ${name}: ${String(e).split("\n")[0]}`); try { await page.screenshot({ path: `${OUT}/FAIL-${name.replace(/\W+/g, "_")}.jpg`, type: "jpeg", quality: 60 }); } catch {} }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e}`));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|chrome-extension|net::ERR_ABORTED/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`); });
page.on("response", (r) => { const u = r.url(); if (u.startsWith(api) && r.status() >= 400) errors.push(`http ${r.status()} ${u.replace(api, "")}`); });

const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name, opts = {}) => { await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 78, ...opts }); };
const nav = (label) => page.getByRole("navigation", { name: label }).first();
const rail = () => page.locator("[data-rail]");

/** The panel whose visible heading matches `title`. */
const panel = (title) => page.locator("section, .vn-panel, [data-step]").filter({ has: page.getByText(title, { exact: false }) }).first();

/** Screenshot one card by its own bounding box, with a little breathing room around it. */
const cardShot = async (name, locator, pad = 12) => {
  await locator.scrollIntoViewIfNeeded();
  await wait(500);
  const b = await locator.boundingBox();
  if (!b) throw new Error(`no box for ${name}`);
  const vp = page.viewportSize();
  const clip = {
    x: Math.max(0, b.x - pad),
    y: Math.max(0, b.y - pad),
    width: Math.min(vp.width - Math.max(0, b.x - pad), b.width + pad * 2),
    height: Math.min(vp.height - Math.max(0, b.y - pad), b.height + pad * 2),
  };
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 80, clip });
};

/** Shoot the card that carries a given step number. */
const stepShot = (name, n) => cardShot(name, page.locator(`[data-step='${n}']`).first());

// ══════════════════════════════════════════════════════════════════ front page
await step("front page", async () => {
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await wait(2500);
  await shot("01-landing-hero");
  await page.getByText("Ten cities, this minute").first().scrollIntoViewIfNeeded(); await wait(1200);
  await shot("02-landing-glance");
  await page.locator("#how").scrollIntoViewIfNeeded(); await wait(800);
  await shot("03-landing-how");
  await page.locator("#architecture").scrollIntoViewIfNeeded(); await wait(800);
  await shot("03b-landing-architecture");
  await page.locator("#platform").scrollIntoViewIfNeeded(); await wait(800);
  await shot("03c-landing-platform");
  await page.locator("#validation").scrollIntoViewIfNeeded(); await wait(800);
  await shot("04-landing-validation");
});

// ═════════════════════════════════════════════════════════ public app: overview
await step("public overview page", async () => {
  await page.goto(`${base}/city/delhi`, { waitUntil: "networkidle" });
  await wait(4000);
  await shot("05-app-overview");
  await cardShot("06-app-hero", page.locator("section.vn-wash").first(), 8);
  await page.getByText("Major air pollutants").first().scrollIntoViewIfNeeded(); await wait(700);
  await shot("07-app-pollutants");
  // open one pollutant's reference drill-down
  await page.getByRole("button").filter({ hasText: "Particulate Matter (PM2.5)" }).first().click(); await wait(900);
  await shot("08-app-pollutant-detail");
  await page.getByRole("button", { name: "Close pollutant detail" }).click(); await wait(300);
  await page.getByText("Most polluted areas right now").first().scrollIntoViewIfNeeded(); await wait(900);
  await shot("09-app-graph-and-worst");
  await page.getByText("Air quality calendar").first().scrollIntoViewIfNeeded(); await wait(900);
  await shot("10-app-calendar");
  await page.getByText("Monthly trend").first().scrollIntoViewIfNeeded(); await wait(900);
  await shot("11-app-trend");
  await page.getByText("Health advice").first().scrollIntoViewIfNeeded(); await wait(900);
  await shot("12-app-health");
  await page.getByText("The other cities, right now").first().scrollIntoViewIfNeeded(); await wait(900);
  await shot("13-app-other-cities");
});

await step("public app: scale toggle", async () => {
  for (const s of ["US · EPA", "WHO", "IN · CPCB"]) {
    await page.getByRole("button", { name: s, exact: true }).first().click();
    await wait(900);
    if (s === "US · EPA") { await page.locator("section.vn-wash").first().scrollIntoViewIfNeeded(); await wait(400); await shot("14-app-scale-us"); }
  }
});

await step("public app: live map", async () => {
  await nav("Site sections").getByRole("button", { name: "Live map", exact: true }).click();
  await wait(5500);
  await shot("15-app-map");
  const box = page.locator("canvas").first();
  const b = await box.boundingBox();
  if (b) { await page.mouse.click(b.x + b.width * 0.42, b.y + b.height * 0.45); await wait(2500); }
  await shot("16-app-map-cell");
});

await step("public app: forecast + causes", async () => {
  await nav("Site sections").getByRole("button", { name: "Forecast", exact: true }).click();
  await wait(5000);
  await shot("17-app-forecast");
  await page.getByText("What is causing it").first().scrollIntoViewIfNeeded(); await wait(1500);
  await shot("18-app-causes");
});

await step("public app: rankings + how it works", async () => {
  await nav("Site sections").getByRole("button", { name: "Rankings", exact: true }).click();
  await wait(4500);
  await shot("19-app-rankings");
  await page.getByText("Which scale am I looking at?").first().scrollIntoViewIfNeeded(); await wait(800);
  await shot("20-app-scales");
  await nav("Site sections").getByRole("button", { name: "How it works", exact: true }).click();
  await wait(3000);
  await shot("21-app-about");
  await page.getByText("Where the data comes from").first().scrollIntoViewIfNeeded(); await wait(800);
  await shot("22-app-provenance");
});

// ════════════════════════════════════════════════════════ console: first-run tour
await step("first-run tour", async () => {
  await page.evaluate(() => localStorage.removeItem("vayunetra-tour-v1"));
  await page.goto(`${base}/console?city=delhi&section=action`, { waitUntil: "networkidle" });
  await wait(4000);
  await shot("23-console-tour");
  // Scope every click to the dialog. Searching the whole page can match a button BEHIND the tour's
  // backdrop, and clicking a covered element blocks until the timeout.
  const dialog = page.getByRole("dialog", { name: "Quick tour" });
  await dialog.waitFor({ timeout: 15000 });
  for (let i = 0; i < 6; i++) {
    const next = dialog.getByRole("button", { name: /^Next$/ });
    if (!(await next.count())) break;
    await next.click({ timeout: 8000 });
    await wait(500);
  }
  const done = dialog.getByRole("button", { name: /Start exploring|Skip/i });
  if (await done.count()) await done.first().click({ timeout: 8000 });
  await dialog.waitFor({ state: "hidden", timeout: 10000 });
});

// ═══════════════════════════════════════════════════════════════ console: shell
await step("console shell", async () => {
  await page.goto(`${base}/console?city=delhi&section=action`, { waitUntil: "networkidle" });
  await wait(5000);
  await shot("24-console-enforcement");
});
await step("presentation mode", async () => {
  await page.getByRole("button", { name: "Present", exact: true }).click(); await wait(900);
  await shot("25-presentation-mode");
  await page.getByRole("button", { name: "Present", exact: true }).click(); await wait(500);
});
await step("keyboard sections 1–7", async () => {
  await page.locator("body").click({ position: { x: 6, y: 400 } });
  for (const k of ["2", "3", "4", "5", "6", "7", "1"]) { await page.keyboard.press(k); await wait(800); }
  await wait(2500);
});

// ═══════════════════════════════════════════════════════════ console: map frame
await step("layers chip and modes", async () => {
  await page.getByRole("button", { name: /^Layers/ }).click(); await wait(600);
  await shot("26-map-layers");
  for (const m of ["Sat NO2", "PM2.5", "Sources"]) {
    const b = page.getByRole("button", { name: m, exact: true });
    if (await b.count()) { await b.first().click(); await wait(1600); await shot(`27-map-mode-${m.replace(/\W/g, "").toLowerCase()}`); }
  }
  for (const t of ["Detected sources", "Wind plumes", "Ward boundaries"]) { const l = page.getByText(t, { exact: true }); if (await l.count()) { await l.first().click(); await wait(1200); } }
  await shot("28-map-overlays");
  for (const t of ["Detected sources", "Wind plumes", "Ward boundaries"]) { const l = page.getByText(t, { exact: true }); if (await l.count()) { await l.first().click(); await wait(400); } }
  const collapse = page.getByRole("button", { name: "Collapse layer panel" });
  if (await collapse.count()) { await collapse.click(); await wait(300); }
});
await step("time scrub play", async () => {
  const play = page.getByRole("button", { name: "Play the last 24 hours" });
  await play.click(); await wait(2600); await shot("29-map-timescrub");
  const pause = page.getByRole("button", { name: "Pause replay" });
  if (await pause.count()) { await pause.click(); await wait(300); }
});
await step("cell story", async () => {
  const story = page.getByText("Cell story", { exact: false }).first();
  await story.waitFor({ timeout: 20000 });
  await cardShot("30-cell-story", page.locator("[data-tour=map] .vn-sheet").first(), 6);
  const heading = page.getByText(/Where it's heading/).first();
  if (await heading.count()) { await heading.scrollIntoViewIfNeeded(); await wait(500); }
  await cardShot("31-cell-story-forecast", page.locator("[data-tour=map] .vn-sheet").first(), 6);
  const share = page.getByRole("button", { name: "Share this place as an image" }).first();
  if (await share.count()) {
    const dl = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
    await share.click(); const d = await dl; if (d) say(`     share card → ${await d.suggestedFilename()}`);
    await wait(500);
  }
  const closeBtn = page.getByRole("button", { name: "Close cell story" });
  if (await closeBtn.count()) { await closeBtn.click(); await wait(400); }
  const canvas = page.locator("[data-tour=map] canvas").first();
  const b = await canvas.boundingBox();
  if (b) { await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.45); await wait(2000); }
});

// ══════════════════════════════════════════════════════════ console: enforcement
await step("morning brief", async () => {
  await stepShot("32-morning-brief", 1);
  const dl = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
  await rail().getByRole("button", { name: /^PDF$/ }).first().click();
  const d = await dl; say(`     brief PDF → ${d ? await d.suggestedFilename() : "no download"}`);
});
await step("worklist filters + search", async () => {
  await stepShot("33-worklist", 2);
  for (const f of ["Construction", "Industrial", "Waste", "All"]) { const b = rail().getByRole("button", { name: f, exact: true }); if (await b.count()) { await b.first().click(); await wait(600); } }
  const search = page.getByLabel("Search enforcement recommendations");
  if (await search.count()) { await search.fill("dust"); await wait(600); await search.fill(""); await wait(400); }
});
let recCard;
await step("dossier + notice", async () => {
  const cards = rail().locator("[data-step='2'] .rounded-lg.border");
  const n = await cards.count(); let idx = -1;
  for (let i = 0; i < n; i++) if (await cards.nth(i).getByRole("button", { name: "Approve" }).count()) { idx = i; break; }
  if (idx < 0) throw new Error("no proposed card");
  recCard = cards.nth(idx);
  await recCard.getByRole("button", { name: "Evidence dossier" }).click(); await wait(4500);
  await cardShot("34-evidence-dossier", recCard);
  const dl = page.waitForEvent("download", { timeout: 45000 }).catch(() => null);
  await recCard.getByRole("button", { name: "Notice PDF" }).click();
  const d = await dl; say(`     notice PDF → ${d ? await d.suggestedFilename() : "no download"}`);
  const hide = recCard.getByRole("button", { name: /Hide dossier/ });
  if (await hide.count()) { await hide.click(); await wait(400); }
});
// SKIP_MUTATION=1 leaves the production record untouched (keeps the previous 35–37 shots).
if (process.env.SKIP_MUTATION) console.log("skip: approve → dispatch → close → history (SKIP_MUTATION)");
else await step("approve → dispatch → close → history", async () => {
  await rail().getByLabel("Acting officer name").fill("Guide walkthrough");
  await recCard.getByRole("button", { name: "Approve" }).click();
  await recCard.getByRole("button", { name: /dispatch team/i }).waitFor({ timeout: 20000 });
  await cardShot("35-approved", recCard);
  await recCard.getByRole("button", { name: /dispatch team/i }).click();
  await recCard.getByText(/Dispatched · tracking armed/).waitFor({ timeout: 30000 });
  await recCard.getByRole("button", { name: "Close case" }).click(); await wait(400);
  await cardShot("36-close-case", recCard);
  await recCard.getByLabel("Closure finding").selectOption("not_applicable");
  await recCard.getByLabel("Closure note").fill("user-guide walkthrough — no field visit");
  await recCard.getByRole("button", { name: /Record & close/ }).click();
  await recCard.getByText(/Closed · not applicable/).waitFor({ timeout: 30000 });
  await recCard.getByRole("button", { name: "History" }).click();
  await recCard.getByText(/by Guide walkthrough/).first().waitFor({ timeout: 30000 });
  await cardShot("37-history", recCard);
});
await step("dispatch queues + tracking + export", async () => {
  await stepShot("38-dispatch-queues", 4);
  await stepShot("39-intervention-tracking", 5);
  const exp = rail().getByRole("button", { name: /export|PRANA|CSV/i }).first();
  if (await exp.count()) { const dl = page.waitForEvent("download", { timeout: 30000 }).catch(() => null); await exp.click(); const d = await dl; say(`     PRANA export → ${d ? await d.suggestedFilename() : "no download"}`); }
  await cardShot("40-city-intel", panel("City Intel"));
});

// ═════════════════════════════════════════════════════════════ console: forecast
await step("forecast section", async () => {
  await nav("Console sections").getByRole("button", { name: "Forecast", exact: true }).click(); await wait(5000);
  await shot("41-forecast");
  for (const h of ["+48h", "+72h", "+24h"]) { const b = rail().getByRole("button", { name: h }); if (await b.count()) { await b.first().click(); await wait(900); } }
  await cardShot("42-forecast-validation", panel("Forecast validation"));
  const live = rail().getByRole("button", { name: /live 90d/ });
  if (await live.count()) { await live.first().click(); await wait(700); await rail().getByRole("button", { name: /multi-season/ }).first().click(); await wait(500); }
  await cardShot("43-hindsight-warn", panel("Real interventions, in hind"));
  const didAir = rail().getByRole("button", { name: /did the air change/ });
  if (await didAir.count()) { await didAir.click(); await wait(800); await cardShot("44-hindsight-effect", panel("Real interventions, in hind")); }
  await cardShot("45-city-statistics", panel("City Statistics"));
  for (const d of ["30d", "1y", "90d"]) { const b = rail().getByRole("button", { name: d, exact: true }); if (await b.count()) { await b.first().click(); await wait(1300); } }
  await cardShot("46-pollutants-now", page.locator("[data-step='6']").first());
  await cardShot("47-air-graph", page.locator("[data-step='7']").first());
  await page.getByText("Air quality calendar").first().scrollIntoViewIfNeeded(); await wait(900);
  await shot("48-forecast-record");
});

// ════════════════════════════════════════════════════════════ console: advisories
await step("advisories section", async () => {
  await nav("Console sections").getByRole("button", { name: "Advisories", exact: true }).click(); await wait(5000);
  await shot("49-advisories");
  const sel = rail().getByLabel("Advisory language");
  for (const l of ["hi", "ta", "en"]) { await sel.selectOption(l).catch(() => {}); await wait(1000); if (l === "hi") await stepShot("50-advisory-hindi", 1); }
  for (const t of ["Telegram", "IVR call", "App"]) { const b = rail().getByRole("button", { name: t, exact: true }); if (await b.count()) { await b.first().click(); await wait(800); if (t === "Telegram") await stepShot("51-advisory-telegram", 1); } }
  await stepShot("52-send-it", 2);
  await page.getByText("Cleanest air right now").first().scrollIntoViewIfNeeded(); await wait(1600);
  await shot("53-clean-air-and-reports");
  await cardShot("54-health-advice", page.locator("[data-step='5']").first());
});

// ═══════════════════════════════════════════════════════════════ console: cities
await step("cities section", async () => {
  await nav("Console sections").getByRole("button", { name: "Cities", exact: true }).click(); await wait(4500);
  await shot("55-cities");
  const mum = rail().getByRole("button").filter({ hasText: "Mumbai" }).first();
  if (await mum.count()) { await mum.click({ timeout: 15000 }); await wait(4500); }
  else say("     no Mumbai row on the scoreboard — skipped");
  await shot("56-mumbai");
  await page.getByLabel("Choose a city").selectOption("delhi"); await wait(3500);
});

// ════════════════════════════════════════════════════════════ console: simulator
await step("simulator section", async () => {
  await nav("Console sections").getByRole("button", { name: "Simulator", exact: true }).click(); await wait(3500);
  await shot("57-simulator");
  const run = rail().getByRole("button", { name: /^Run simulation$/i }).first();
  await run.click(); await wait(7000);
  await shot("58-simulator-result");
  const opt = rail().getByRole("button", { name: /Rank packages/i }).first();
  if (await opt.count()) { await opt.click(); await wait(7000); }
  await cardShot("59-optimizer", page.locator("[data-step='3']").first());
});

// ═══════════════════════════════════════════════════════════════ console: impact
await step("impact section", async () => {
  await nav("Console sections").getByRole("button", { name: "Impact", exact: true }).click(); await wait(4500);
  await shot("60-impact");
  await cardShot("61-fund-guidance", panel("Where the funds should go"));
  await cardShot("62-fairness", panel("Fairness audit"));
});

// ═════════════════════════════════════════════════════════════ console: pipeline
await step("pipeline section", async () => {
  await nav("Console sections").getByRole("button", { name: "Pipeline", exact: true }).click(); await wait(3500);
  await shot("63-pipeline");
  const run = rail().getByRole("button", { name: /Run agents live/i }).first();
  await run.click(); await wait(26000);
  await shot("64-pipeline-run");
});

// ═══════════════════════════════════════════════════════════════ dark theme + phone
await step("dark theme", async () => {
  await page.goto(`${base}/city/delhi?theme=dark`, { waitUntil: "networkidle" }); await wait(4000);
  await shot("65-dark-overview");
  await page.goto(`${base}/console?city=delhi&section=action&theme=dark`, { waitUntil: "networkidle" }); await wait(5000);
  await shot("66-dark-console");
});

await step("phone viewport", async () => {
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  for (const [name, path, hold] of [
    ["67-phone-overview", "/city/delhi", 4200],
    ["68-phone-console", "/console?city=delhi&section=action", 5200],
  ]) {
    await m.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await m.waitForTimeout(hold);
    await m.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 78 });
    const scrollW = await m.evaluate(() => document.documentElement.scrollWidth);
    if (scrollW > 392) throw new Error(`${path}: horizontal overflow ${scrollW}px`);
  }
  // the compact nav sheet is the only way to change section on a phone — prove it opens
  await m.getByRole("button", { name: "Menu" }).click();
  await m.waitForTimeout(700);
  await m.screenshot({ path: `${OUT}/69-phone-menu.jpg`, type: "jpeg", quality: 78 });
  await m.close();
});

// ══════════════════════════════════════════════════ reset the walkthrough action
await step("reset walkthrough action", async () => {
  // Without the key /enforcement 401s, the filter matches nothing, and a real record is left closed
  // in production while the step still reports "ok". That must be an error, not a silent no-op.
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!anon) throw new Error("SUPABASE_ANON_KEY not set — cannot reset the walkthrough record; reset it by hand");
  const r = await fetch(`${api}/enforcement?city=delhi&limit=200`, { headers: { Authorization: `Bearer ${anon}` } }).then((x) => x.json());
  if (!r || r.success === false || !Array.isArray(r.data)) throw new Error(`could not list enforcement to reset: ${JSON.stringify(r).slice(0, 120)}`);
  const mine = (r.data || []).filter((x) => x.closure_note === "user-guide walkthrough — no field visit");
  for (const x of mine) {
    const res = await fetch(`${api}/enforcement/${x.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ status: "proposed", actor: "Guide walkthrough", note: "reset after walkthrough" }),
    });
    if (!res.ok) throw new Error(`failed to reset rec ${x.id}: HTTP ${res.status}`);
  }
  say(`     reset ${mine.length} walkthrough record(s)`);
});

await browser.close();
const uniq = [...new Set(errors)];
writeFileSync(`${OUT}/walkthrough-log.txt`, [...log, "", "ERRORS:", ...uniq, "", "PROBLEMS:", ...problems].join("\n"));
console.log(`\n${problems.length} problem step(s); ${uniq.length} unique error(s)`);
if (uniq.length) console.log(uniq.slice(0, 40).join("\n"));
