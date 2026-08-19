// Dry-run the walkthrough's selectors without performing any action.
//
// The full walkthrough takes ~6 minutes and mutates a real enforcement record. Finding a stale
// selector halfway through wastes the run and leaves that record part-way through its lifecycle.
// This checks every selector it depends on, read-only, in about a minute.
import { chromium } from "playwright";

const base = process.env.BASE ?? "http://localhost:5173";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));

const results = [];
const check = async (where, label, locator, { min = 1 } = {}) => {
  try {
    const n = await locator.count();
    results.push({ where, label, ok: n >= min, n });
  } catch (e) {
    results.push({ where, label, ok: false, n: 0, err: String(e).split("\n")[0].slice(0, 80) });
  }
};

const nav = (name) => p.getByRole("navigation", { name }).first();

// ── front page ────────────────────────────────────────────────────────────────────────────────
await p.goto(`${base}/`, { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
for (const [label, loc] of [
  ["hero heading", p.getByRole("heading", { name: /operations layer for urban air quality/i })],
  ["Ten cities, this minute", p.getByText("Ten cities, this minute")],
  ["#how", p.locator("#how")],
  ["#architecture", p.locator("#architecture")],
  ["#platform", p.locator("#platform")],
  ["#validation", p.locator("#validation")],
  ["Check your city's air", p.getByRole("link", { name: /check your city/i })],
]) await check("landing", label, loc);

// ── public app ────────────────────────────────────────────────────────────────────────────────
await p.goto(`${base}/city/delhi`, { waitUntil: "networkidle" });
await p.waitForTimeout(4000);
for (const [label, loc] of [
  ["Site sections nav", nav("Site sections")],
  ["hero wash section", p.locator("section.vn-wash")],
  ["Major air pollutants", p.getByText("Major air pollutants")],
  ["PM2.5 card button", p.getByRole("button").filter({ hasText: "Particulate Matter (PM2.5)" })],
  ["Most polluted areas", p.getByText("Most polluted areas right now")],
  ["Air quality calendar", p.getByText("Air quality calendar")],
  ["Monthly trend", p.getByText("Monthly trend")],
  ["Health advice", p.getByText("Health advice")],
  ["The other cities", p.getByText("The other cities, right now")],
  ["scale US · EPA", p.getByRole("button", { name: "US · EPA", exact: true })],
  ["nav: Live map", nav("Site sections").getByRole("button", { name: "Live map", exact: true })],
  ["nav: Forecast", nav("Site sections").getByRole("button", { name: "Forecast", exact: true })],
  ["nav: Rankings", nav("Site sections").getByRole("button", { name: "Rankings", exact: true })],
  ["nav: How it works", nav("Site sections").getByRole("button", { name: "How it works", exact: true })],
]) await check("public/overview", label, loc);

await p.goto(`${base}/about?city=delhi`, { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
await check("public/about", "Where the data comes from", p.getByText("Where the data comes from"));

await p.goto(`${base}/rankings?city=delhi`, { waitUntil: "networkidle" });
await p.waitForTimeout(3000);
await check("public/rankings", "Which scale am I looking at?", p.getByText("Which scale am I looking at?"));

await p.goto(`${base}/forecast?city=delhi`, { waitUntil: "networkidle" });
await p.waitForTimeout(4000);
await check("public/forecast", "What is causing it", p.getByText("What is causing it"));

// ── console ───────────────────────────────────────────────────────────────────────────────────
await p.goto(`${base}/console?city=delhi&section=action`, { waitUntil: "networkidle" });
await p.waitForTimeout(5200);
for (const [label, loc] of [
  ["Console sections nav", nav("Console sections")],
  ["Present button", p.getByRole("button", { name: "Present", exact: true })],
  ["Tour button", p.getByRole("button", { name: "Tour", exact: true })],
  ["Choose a city select", p.getByLabel("Choose a city")],
  ["map frame", p.locator("[data-tour=map]")],
  ["map canvas", p.locator("[data-tour=map] canvas")],
  ["Layers chip", p.getByRole("button", { name: /^Layers/ })],
  ["Play the last 24 hours", p.getByRole("button", { name: "Play the last 24 hours" })],
  ["Cell story", p.getByText("Cell story", { exact: false })],
  ["step 1 (brief)", p.locator("[data-step='1']")],
  ["step 2 (worklist)", p.locator("[data-step='2']")],
  ["step 4 (queues)", p.locator("[data-step='4']")],
  ["step 5 (tracking)", p.locator("[data-step='5']")],
  ["brief PDF button", p.locator("[data-rail]").getByRole("button", { name: /^PDF$/ })],
  ["worklist cards", p.locator("[data-rail] [data-step='2'] .rounded-lg.border")],
  ["Acting officer name", p.locator("[data-rail]").getByLabel("Acting officer name")],
  ["search box", p.getByLabel("Search enforcement recommendations")],
  ["City Intel", p.getByText("City Intel")],
]) await check("console/action", label, loc);

for (const [section, labels] of [
  ["forecast", [["Forecast validation", "Forecast validation"], ["hindsight", "Real interventions, in hind"],
                ["City Statistics", "City Statistics"], ["Pollutants right now", "Pollutants right now"]]],
  ["citizen", [["Citizen Advisory", "Citizen Advisory"], ["Send it", "Send it"],
               ["Cleanest air right now", "Cleanest air right now"], ["Citizen reports", "Citizen reports"],
               ["health card", "What today's air does to people"]]],
  ["compare", [["scoreboard", "Mumbai"]]],
  ["whatif", [["Choose an intervention", "Choose an intervention"], ["Best bundle", "Best bundle for a budget"]]],
  ["impact", [["funds", "Where the funds should go"], ["fairness", "Fairness audit"]]],
  ["pipeline", [["Agent Pipeline", "Agent Pipeline"]]],
]) {
  await p.goto(`${base}/console?city=delhi&section=${section}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(4200);
  for (const [label, text] of labels) await check(`console/${section}`, label, p.getByText(text, { exact: false }));
}
for (const [label, loc] of [
  ["Run simulation", p.getByRole("button", { name: /^Run simulation$/i })],
]) { await p.goto(`${base}/console?city=delhi&section=whatif`, { waitUntil: "networkidle" }); await p.waitForTimeout(2500); await check("console/whatif", label, loc); }
await p.goto(`${base}/console?city=delhi&section=pipeline`, { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
await check("console/pipeline", "Run agents live", p.getByRole("button", { name: /Run agents live/i }));

// ── phone ─────────────────────────────────────────────────────────────────────────────────────
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(`${base}/city/delhi`, { waitUntil: "networkidle" });
await p.waitForTimeout(3500);
await check("phone", "Menu button", p.getByRole("button", { name: "Menu" }));

await b.close();
const bad = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "ok  " : "MISS"} ${r.where.padEnd(18)} ${r.label}${r.ok ? ` (${r.n})` : ""}${r.err ? " — " + r.err : ""}`);
console.log(`\n${results.length - bad.length}/${results.length} selectors resolve · ${bad.length} missing`);
if (bad.length) process.exitCode = 1;
