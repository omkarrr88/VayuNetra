// QA helper — run from web/ with the dev server on :5173 and the API on :8000 (DEMO_MODE=false).
// Usage: node scripts/qa/deck-screenshots.mjs    → six 16:9 captures used by the finale deck (slides 4, A2–A4, A8, A9)
// Output dir: OUT env var (default ./.qa-out).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const OUT = process.env.OUT ?? "./.qa-out";
mkdirSync(OUT, { recursive: true });
const base = "http://localhost:5173";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
async function go(section, city = "delhi") {
  await p.goto(`${base}/console?city=${city}&section=${section}`, { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(7000);
}
const rail = () => p.locator("[data-rail]");
// 1 · console overview (live demo backdrop)
await go("action");
await p.screenshot({ path: `${OUT}/console.jpg`, type: "jpeg", quality: 85 });
// 2 · evidence: dossier open on first item
await rail().locator("[data-step='2'] .rounded-lg.border").first().getByRole("button", { name: /evidence dossier/i }).click();
await p.getByText(/Regulatory citations/i).first().waitFor({ timeout: 60000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/evidence.jpg`, type: "jpeg", quality: 85 });
// 3 · citizens (Hindi default)
await go("citizen");
await p.screenshot({ path: `${OUT}/citizens.jpg`, type: "jpeg", quality: 85 });
// 4 · cities
await go("compare");
await p.screenshot({ path: `${OUT}/cities.jpg`, type: "jpeg", quality: 85 });
// 5 · history: forecast section scrolled to city stats
await go("forecast");
await rail().getByRole("button", { name: /4\s*The past/ }).click();
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/history.jpg`, type: "jpeg", quality: 85 });
// 6 · agents: run live and capture the trace
await go("pipeline");
await rail().getByRole("button", { name: /run agents live/i }).click();
await rail().getByText(/end-to-end/).waitFor({ timeout: 230000 });
await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/agents.jpg`, type: "jpeg", quality: 85 });
console.log("deck shots done");
await b.close();
