// Drive the console's City air section: every step tab, pollutant drill-down, graph ranges.
import { chromium } from "playwright";
import { mkdirSync } from "fs";
const OUT = process.env.OUT ?? ".qa-out/cityair";
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errs.push(m.text().slice(0, 160)); });
await p.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
await p.goto("http://localhost:5173/console?city=delhi&section=cityair", { waitUntil: "networkidle" });
await p.waitForTimeout(5000);
const rail = p.locator("[data-rail]");
for (const [n, name] of [[1, "right-now"], [2, "pollutants"], [3, "graph"], [4, "calendar"], [5, "trend"], [6, "health"]]) {
  await rail.getByRole("tab", { name: new RegExp(String(n)) }).first().click();
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${OUT}/${n}-${name}.jpg`, type: "jpeg", quality: 76 });
  console.log("step", n, name, "ok");
}
// pollutant drill-down on step 2
await rail.getByRole("tab", { name: /2/ }).first().click(); await p.waitForTimeout(1200);
const pm10 = rail.getByRole("button").filter({ hasText: "Particulate Matter (PM10)" }).first();
if (await pm10.count()) { await pm10.click(); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/2b-pm10-detail.jpg`, type: "jpeg", quality: 76 }); console.log("pm10 detail ok"); }
// graph ranges on step 3
await rail.getByRole("tab", { name: /3/ }).first().click(); await p.waitForTimeout(1500);
for (const r of ["7 d", "30 d", "1 y", "24 h"]) {
  const btn = rail.getByRole("button", { name: r, exact: true });
  if (await btn.count()) { await btn.first().click(); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/3-range-${r.replace(" ", "")}.jpg`, type: "jpeg", quality: 76 }); console.log("range", r, "ok"); }
}
// scale toggle should change the numbers everywhere
for (const s of ["US · EPA", "WHO", "IN · CPCB"]) {
  const t = p.getByRole("button", { name: s, exact: true });
  if (await t.count()) { await t.first().click(); await p.waitForTimeout(900); }
}
await rail.getByRole("tab", { name: /1/ }).first().click(); await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/scale-back-to-in.jpg`, type: "jpeg", quality: 76 });
console.log("errors:", errs.length ? [...new Set(errs)] : "none");
await b.close();
