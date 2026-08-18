// Drive the public city page for every city: capture screenshots, click chips/tabs, catch errors.
import { chromium } from "playwright";
import { mkdirSync } from "fs";
const OUT = process.env.OUT ?? ".qa-out/city";
mkdirSync(OUT, { recursive: true });
const cities = process.env.CITIES?.split(",") ?? ["delhi", "mumbai", "bengaluru", "kolkata", "hyderabad", "chennai", "pune", "ahmedabad", "jaipur", "lucknow"];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errs.push(m.text().slice(0, 160)); });
for (const c of cities) {
  await p.goto(`http://localhost:5173/city/${c}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(3500);
  const hero = await p.locator("h1").first().textContent();
  const chips = await p.getByRole("tab").count();
  await p.screenshot({ path: `${OUT}/${c}.jpg`, type: "jpeg", quality: 72, fullPage: true });
  console.log(c, "→", hero?.trim(), "| tabs/chips", chips);
}
// interactions on one city
await p.goto("http://localhost:5173/city/delhi", { waitUntil: "networkidle" });
await p.waitForTimeout(3000);
for (const name of ["PM2.5", "PM10", "NO₂", "O₃", "AQI"]) {
  const chip = p.getByRole("tab", { name, exact: true });
  if (await chip.count()) { await chip.first().click(); await p.waitForTimeout(700); }
}
await p.getByRole("button", { name: "line" }).click(); await p.waitForTimeout(600);
await p.getByRole("button", { name: "bars" }).click();
await p.getByRole("button", { name: /earlier/ }).click(); await p.waitForTimeout(500);
for (const cond of ["Heart conditions", "Allergies", "Chronic (COPD)"]) {
  const t = p.getByRole("tab", { name: cond }); if (await t.count()) { await t.click(); await p.waitForTimeout(400); }
}
await p.getByRole("columnheader", { name: /PM2.5/ }).first().click().catch(() => {});
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/delhi-interacted.jpg`, type: "jpeg", quality: 72, fullPage: true });
// dark
await p.goto("http://localhost:5173/city/delhi?theme=dark", { waitUntil: "networkidle" });
await p.waitForTimeout(3000);
await p.screenshot({ path: `${OUT}/delhi-dark.jpg`, type: "jpeg", quality: 72, fullPage: true });
// mobile
await p.setViewportSize({ width: 390, height: 900 });
await p.goto("http://localhost:5173/city/mumbai", { waitUntil: "networkidle" });
await p.waitForTimeout(3000);
const sw = await p.evaluate(() => document.documentElement.scrollWidth);
await p.screenshot({ path: `${OUT}/mumbai-mobile.jpg`, type: "jpeg", quality: 72, fullPage: true });
console.log("mobile scrollWidth", sw, sw > 390 ? "OVERFLOW" : "ok");
console.log("errors:", errs.length ? [...new Set(errs)] : "none");
await b.close();
