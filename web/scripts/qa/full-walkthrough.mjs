// Full application walkthrough — every section, every control — against the local dev server
// (:5173) and live API (:8000, DEMO_MODE=false). Captures page errors, console errors and any
// 4xx/5xx API response, and writes the screenshots the User Guide embeds (docs/guide/*.jpg).
//
//   cd web && node scripts/qa/full-walkthrough.mjs
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
const shot = async (name, opts = {}) => { await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 78, ...opts }); };
const wait = (ms) => page.waitForTimeout(ms);
const rail = () => page.locator("[data-rail]");

// ------------------------------------------------------------------ landing
await step("landing loads", async () => {
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await wait(2500);
  await shot("01-landing-hero");
  await page.getByText("The data, at a glance").first().scrollIntoViewIfNeeded(); await wait(1200);
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

// ------------------------------------------------------------------ first-run tour
await step("first-run tour", async () => {
  await page.evaluate(() => localStorage.removeItem("vayunetra-tour-v1"));
  await page.goto(`${base}/console?city=delhi&section=action`, { waitUntil: "networkidle" });
  await wait(3500);
  await shot("05-console-tour");
  const next = page.getByRole("button", { name: /^Next$/ });
  for (let i = 0; i < 6 && (await next.count()); i++) { await next.first().click(); await wait(400); }
  const done = page.getByRole("button", { name: /Done|Finish|Start|Got it|Skip/i });
  if (await done.count()) await done.first().click();
  await wait(500);
});

// ------------------------------------------------------------------ shell
await step("shell + status strip", async () => {
  await page.goto(`${base}/console?city=delhi&section=action`, { waitUntil: "networkidle" });
  await wait(4500);
  await shot("06-console-enforcement");
  await page.getByRole("button", { name: "Replay the quick tour" }).click(); await wait(600);
  const skip = page.getByRole("button", { name: /Skip/i }); if (await skip.count()) await skip.first().click();
});
await step("presentation mode", async () => {
  await page.getByRole("button", { name: "Toggle presentation mode" }).click(); await wait(800);
  await shot("07-presentation-mode");
  await page.getByRole("button", { name: "Toggle presentation mode" }).click(); await wait(400);
});
await step("keyboard sections 1–7", async () => {
  for (const k of ["2", "3", "4", "5", "6", "7", "1"]) { await page.keyboard.press(k); await wait(700); }
});

// ------------------------------------------------------------------ map + layers
await step("layers chip and modes", async () => {
  await page.getByRole("button", { name: /^Layers/ }).click(); await wait(500);
  await shot("08-map-layers");
  for (const m of ["Sat NO2", "PM2.5", "Sources"]) { await page.getByRole("button", { name: m, exact: true }).click(); await wait(1500); await shot(`09-map-mode-${m.replace(/\W/g, "").toLowerCase()}`); }
  for (const t of ["Detected sources", "Wind plumes", "Ward boundaries"]) { await page.getByText(t, { exact: true }).click(); await wait(1200); }
  await shot("10-map-overlays");
  for (const t of ["Detected sources", "Wind plumes", "Ward boundaries"]) { await page.getByText(t, { exact: true }).click(); await wait(400); }
  await page.getByRole("button", { name: "Collapse layer panel" }).click(); await wait(300);
});
await step("time scrub play", async () => {
  const play = page.getByRole("button", { name: "Play the last 24 hours" });
  await play.click(); await wait(2500); await shot("11-map-timescrub");
  await page.getByRole("button", { name: "Pause replay" }).click(); await wait(300);
});
await step("cell story", async () => {
  await expect_(page.getByText("Cell story", { exact: false }).first());
  await shot("12-cell-story", { clip: { x: 210, y: 240, width: 330, height: 640 } });
  await page.getByText(/Where it's heading/).first().scrollIntoViewIfNeeded(); await wait(400);
  await shot("13-cell-story-forecast", { clip: { x: 210, y: 60, width: 330, height: 820 } });
  const share = page.getByRole("button", { name: "Share this place as an image" }).first();
  const dl = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
  await share.click(); const d = await dl; if (d) say(`     share card → ${await d.suggestedFilename()}`);
  await wait(500);
  const closeBtn = page.getByRole("button", { name: "Close cell story" }); if (await closeBtn.count()) { await closeBtn.click(); await wait(300); }
  // click another hexagon on the map to reopen a story
  await page.mouse.click(760, 450); await wait(1500);
});

// ------------------------------------------------------------------ enforcement
await step("morning brief", async () => {
  await page.getByText("Morning brief").first().scrollIntoViewIfNeeded(); await wait(500);
  await shot("14-morning-brief", { clip: { x: 1112, y: 200, width: 488, height: 700 } });
  const dl = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
  await rail().getByRole("button", { name: /^PDF$/ }).first().click(); const d = await dl; say(`     brief PDF → ${d ? await d.suggestedFilename() : "no download"}`);
});
await step("worklist filters + search", async () => {
  await page.getByText("Enforcement Worklist").scrollIntoViewIfNeeded(); await wait(400);
  await shot("15-worklist", { clip: { x: 1112, y: 200, width: 488, height: 700 } });
  for (const f of ["Construction", "Industrial", "Waste", "All"]) { const b = rail().getByRole("button", { name: f, exact: true }); if (await b.count()) { await b.first().click(); await wait(500); } }
  await page.getByLabel("Search enforcement recommendations").fill("dust"); await wait(500);
  await page.getByLabel("Search enforcement recommendations").fill(""); await wait(300);
});
let recCard;
await step("dossier + notice", async () => {
  const cards = rail().locator("[data-step='2'] .rounded-lg.border");
  const n = await cards.count(); let idx = -1;
  for (let i = 0; i < n; i++) if (await cards.nth(i).getByRole("button", { name: "Approve" }).count()) { idx = i; break; }
  if (idx < 0) throw new Error("no proposed card");
  recCard = cards.nth(idx);
  await recCard.getByRole("button", { name: "Evidence dossier" }).click(); await wait(4000);
  await recCard.scrollIntoViewIfNeeded();
  await shot("16-evidence-dossier", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
  const dl = page.waitForEvent("download", { timeout: 45000 }).catch(() => null);
  await recCard.getByRole("button", { name: "Notice PDF" }).click(); const d = await dl; say(`     notice PDF → ${d ? await d.suggestedFilename() : "no download"}`);
  await recCard.getByRole("button", { name: /Hide dossier/ }).click(); await wait(300);
});
await step("approve → dispatch → close → history", async () => {
  await rail().getByLabel("Acting officer name").fill("Guide walkthrough");
  await recCard.getByRole("button", { name: "Approve" }).click();
  await recCard.getByRole("button", { name: /dispatch team/i }).waitFor({ timeout: 20000 });
  await shot("17-approved", { clip: { x: 1112, y: 200, width: 488, height: 700 } });
  await recCard.getByRole("button", { name: /dispatch team/i }).click();
  await recCard.getByText(/Dispatched · tracking armed/).waitFor({ timeout: 30000 });
  await recCard.getByRole("button", { name: "Close case" }).click(); await wait(300);
  await shot("18-close-case", { clip: { x: 1112, y: 200, width: 488, height: 700 } });
  await recCard.getByLabel("Closure finding").selectOption("not_applicable");
  await recCard.getByLabel("Closure note").fill("user-guide walkthrough — no field visit");
  await recCard.getByRole("button", { name: /Record & close/ }).click();
  await recCard.getByText(/Closed · not applicable/).waitFor({ timeout: 30000 });
  await recCard.getByRole("button", { name: "History" }).click();
  await recCard.getByText(/by Guide walkthrough/).first().waitFor({ timeout: 30000 });
  await recCard.scrollIntoViewIfNeeded(); await wait(300);
  await shot("19-history", { clip: { x: 1112, y: 200, width: 488, height: 700 } });
});
await step("dispatch queues + tracking + export", async () => {
  await rail().locator("[data-step='4']").scrollIntoViewIfNeeded(); await wait(1500);
  await shot("20-dispatch-queues", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
  await rail().locator("[data-step='5']").scrollIntoViewIfNeeded(); await wait(1500);
  await shot("21-intervention-tracking", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
  const exp = rail().getByRole("button", { name: /export|PRANA|CSV/i }).first();
  if (await exp.count()) { const dl = page.waitForEvent("download", { timeout: 30000 }).catch(() => null); await exp.click(); const d = await dl; say(`     PRANA export → ${d ? await d.suggestedFilename() : "no download"}`); }
  await page.getByText("City Intel").first().scrollIntoViewIfNeeded(); await wait(500);
  await shot("22-city-intel", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
});

// ------------------------------------------------------------------ forecast
await step("forecast section", async () => {
  await page.getByRole("navigation", { name: "Console sections" }).first().getByRole("button", { name: "Forecast", exact: true }).click(); await wait(4000);
  await shot("23-forecast");
  for (const h of ["+48h", "+72h", "+24h"]) { const b = rail().getByRole("button", { name: h }); if (await b.count()) { await b.first().click(); await wait(800); } }
  await page.getByText("Forecast validation").first().scrollIntoViewIfNeeded(); await wait(800);
  await shot("24-forecast-validation", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
  const live = rail().getByRole("button", { name: /live 90d/ }); if (await live.count()) { await live.first().click(); await wait(600); await rail().getByRole("button", { name: /multi-season/ }).first().click(); }
  await page.getByText("Real interventions, in hindsight").first().scrollIntoViewIfNeeded(); await wait(800);
  await shot("25-hindsight-warn", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
  await rail().getByRole("button", { name: /did the air change/ }).click(); await wait(600);
  await shot("26-hindsight-effect", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
  await page.getByText("City Statistics").first().scrollIntoViewIfNeeded(); await wait(1500);
  await shot("27-city-statistics", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
  for (const d of ["30d", "1y", "90d"]) { const b = rail().getByRole("button", { name: d, exact: true }); if (await b.count()) { await b.first().click(); await wait(1200); } }
});

// ------------------------------------------------------------------ advisories
await step("advisories section", async () => {
  await page.getByRole("navigation", { name: "Console sections" }).first().getByRole("button", { name: "Advisories", exact: true }).click(); await wait(4000);
  await shot("28-advisories");
  const sel = rail().getByLabel("Advisory language");
  for (const l of ["hi", "ta", "en"]) { await sel.selectOption(l).catch(() => {}); await wait(900); if (l === "hi") await shot("29-advisory-hindi", { clip: { x: 1112, y: 100, width: 488, height: 800 } }); }
  for (const t of ["Telegram", "IVR call", "App"]) { const b = rail().getByRole("button", { name: t, exact: true }); if (await b.count()) { await b.first().click(); await wait(700); if (t === "Telegram") await shot("30-advisory-telegram", { clip: { x: 1112, y: 100, width: 488, height: 800 } }); } }
  await page.getByText("Send it").first().scrollIntoViewIfNeeded(); await wait(500);
  await shot("31-send-it", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
  await page.getByText("Cleanest air right now").first().scrollIntoViewIfNeeded(); await wait(1500);
  await shot("32-clean-air", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
  await page.getByText("Citizen reports").first().scrollIntoViewIfNeeded(); await wait(1000);
  await shot("33-citizen-reports", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
});

// ------------------------------------------------------------------ cities
await step("cities section", async () => {
  await page.getByRole("navigation", { name: "Console sections" }).first().getByRole("button", { name: "Cities", exact: true }).click(); await wait(4000);
  await shot("34-cities");
  await rail().getByText("Mumbai", { exact: true }).first().click(); await wait(4000);
  await shot("35-mumbai");
  await page.getByLabel("Choose city").selectOption("delhi"); await wait(3000);
});

// ------------------------------------------------------------------ simulator
await step("simulator section", async () => {
  await page.getByRole("navigation", { name: "Console sections" }).first().getByRole("button", { name: "Simulator", exact: true }).click(); await wait(3000);
  await shot("36-simulator");
  const run = rail().getByRole("button", { name: /^Run|Simulate|Run simulation/i }).first();
  await run.click(); await wait(6000);
  await page.getByText("Result", { exact: false }).first().scrollIntoViewIfNeeded(); await wait(500);
  await shot("37-simulator-result", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
  await page.getByText("Best bundle for a budget").first().scrollIntoViewIfNeeded(); await wait(500);
  const opt = rail().getByRole("button", { name: /optimi[sz]e|rank|bundle/i }).first(); if (await opt.count()) { await opt.click(); await wait(6000); }
  await shot("38-optimizer", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
});

// ------------------------------------------------------------------ impact
await step("impact section", async () => {
  await page.getByRole("navigation", { name: "Console sections" }).first().getByRole("button", { name: "Impact", exact: true }).click(); await wait(4000);
  await shot("39-impact");
  await page.getByText("Where the funds should go").first().scrollIntoViewIfNeeded(); await wait(800);
  await shot("40-fund-guidance", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
  await page.getByText(/Fairness/i).first().scrollIntoViewIfNeeded(); await wait(800);
  await shot("41-fairness", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
});

// ------------------------------------------------------------------ pipeline
await step("pipeline section", async () => {
  await page.getByRole("navigation", { name: "Console sections" }).first().getByRole("button", { name: "Pipeline", exact: true }).click(); await wait(3000);
  await shot("42-pipeline");
  const run = rail().getByRole("button", { name: /Run the agents|Run agents/i }).first();
  await run.click(); await wait(25000);
  await shot("43-pipeline-run", { clip: { x: 1112, y: 100, width: 488, height: 800 } });
});

// ------------------------------------------------------------------ mobile
await step("mobile viewport", async () => {
  const m = await ctx.newPage(); await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(`${base}/console?city=delhi&section=action`, { waitUntil: "networkidle" }); await m.waitForTimeout(4000);
  await m.screenshot({ path: `${OUT}/44-mobile-enforcement.jpg`, type: "jpeg", quality: 78 });
  const scrollW = await m.evaluate(() => document.documentElement.scrollWidth); if (scrollW > 390) throw new Error(`horizontal overflow ${scrollW}px`);
  await m.close();
});

// ------------------------------------------------------------------ reset the walkthrough action
await step("reset walkthrough action", async () => {
  const anon = process.env.SUPABASE_ANON_KEY;
  const r = await fetch(`${api}/enforcement?city=delhi&limit=60`, { headers: anon ? { Authorization: `Bearer ${anon}` } : {} }).then((x) => x.json());
  const mine = (r.data || []).filter((x) => x.closure_note === "user-guide walkthrough — no field visit");
  for (const x of mine) { await fetch(`${api}/enforcement/${x.id}/status`, { method: "POST", headers: { "Content-Type": "application/json", ...(anon ? { Authorization: `Bearer ${anon}` } : {}) }, body: JSON.stringify({ status: "proposed", actor: "Guide walkthrough", note: "reset after walkthrough" }) }); }
  say(`     reset ${mine.length} walkthrough record(s)`);
});

await browser.close();
const uniq = [...new Set(errors)];
writeFileSync(`${OUT}/walkthrough-log.txt`, [...log, "", "ERRORS:", ...uniq, "", "PROBLEMS:", ...problems].join("\n"));
console.log(`\n${problems.length} problem step(s); ${uniq.length} unique error(s)`);
if (uniq.length) console.log(uniq.slice(0, 40).join("\n"));
async function expect_(loc) { await loc.waitFor({ timeout: 20000 }); }
