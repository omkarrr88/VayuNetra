// QA helper — mobile sanity: no horizontal overflow, bottom nav works, key controls reachable (iPhone 13 emulation).
// Usage: node scripts/qa/mobile-check.mjs   (dev server on :5173)
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
const OUT = process.env.OUT ?? "./.qa-out"; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"] });
const p = await ctx.newPage();
await p.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
const report = [];
for (const path of ["/", "/console?city=delhi&section=action", "/console?city=delhi&section=forecast", "/console?city=delhi&section=citizen", "/console?city=delhi&section=whatif"]) {
  await p.goto("http://localhost:5173" + path, { waitUntil: "networkidle", timeout: 90000 }); await p.waitForTimeout(5000);
  const ov = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  const small = await p.evaluate(() => Array.from(document.querySelectorAll("button,a,[role=button]")).filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24); }).length);
  report.push({ path, overflow: ov.sw > ov.iw + 1 ? `${ov.sw}>${ov.iw}` : "ok", tinyTargets: small });
  await p.screenshot({ path: `${OUT}/mob-${path.replace(/[^a-z]+/g, "_")}.png`, fullPage: false });
}
// bottom nav switches sections
await p.goto("http://localhost:5173/console?city=delhi&section=action", { waitUntil: "networkidle" }); await p.waitForTimeout(3000);
await p.getByRole("navigation", { name: "Console sections" }).last().getByRole("button", { name: "Forecast" }).click();
await p.waitForTimeout(1500);
report.push({ bottomNav: (await p.locator("[data-tour=spine]").innerText()).toLowerCase().includes("anticipate") ? "ok" : "FAIL" });
console.log(JSON.stringify(report, null, 1)); console.log("errors", errors);
await b.close();
