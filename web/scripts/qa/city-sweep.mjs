// QA helper — run from web/ with the dev server on :5173 and the API on :8000 (DEMO_MODE=false).
// Usage: node scripts/qa/city-sweep.mjs    → per-city health sweep (worklist, forecast, validation, advisories, JS errors)
// Output dir: OUT env var (default ./.qa-out).
import { chromium } from "playwright";
const cities = ["delhi","bengaluru","mumbai","hyderabad","chennai","kolkata","pune","ahmedabad","jaipur","lucknow"];
const b = await chromium.launch();
const p = await b.newPage({ viewport: {width:1366,height:768} });
await p.addInitScript(() => localStorage.setItem("vayunetra-tour-v1","done"));
const errors = [];
p.on("pageerror", e => errors.push(e.message.slice(0,120)));
p.on("console", m => { if (m.type()==="error" && !/favicon|ERR_|net::/.test(m.text())) errors.push("console: "+m.text().slice(0,120)); });
for (const c of cities) {
  const row = { city: c };
  await p.goto(`http://localhost:5173/console?city=${c}&section=action`, { waitUntil: "networkidle", timeout: 90000 }); await p.waitForTimeout(6000);
  const rail = p.locator("[data-rail]");
  row.banner = await p.getByText(/backend waking up/).isVisible().catch(()=>false);
  row.worklist = await rail.locator("[data-step='2'] .rounded-lg.border").count();
  row.cellStory = await p.getByText("Cell story",{exact:false}).first().isVisible().catch(()=>false);
  row.aqi = (await p.locator("header ~ div").first().innerText().catch(()=>"")).match(/(\d+)\s*AQI/)?.[1] ?? "?";
  await p.goto(`http://localhost:5173/console?city=${c}&section=forecast`, { waitUntil: "networkidle", timeout: 90000 }); await p.waitForTimeout(5000);
  const ft = await rail.innerText();
  row.forecast = /No forecast available/.test(ft) ? "EMPTY" : "ok";
  row.validation = /No benchmark artifact/.test(ft) ? "no-artifact" : (/vs persistence/.test(ft) ? "ok" : "?");
  row.exposure = /Who is in the forecast\?/.test(ft) ? "ok" : "hidden";
  await p.goto(`http://localhost:5173/console?city=${c}&section=citizen`, { waitUntil: "networkidle", timeout: 90000 }); await p.waitForTimeout(5000);
  const ct = await rail.innerText();
  row.advisories = /No advisory in this language yet/.test(ct) ? "EMPTY" : "ok";
  row.cleanAir = /Cleanest air right now/.test(ct) ? "ok" : "hidden";
  console.log(JSON.stringify(row));
}
console.log("ERRORS:", errors.length, errors.slice(0,8));
await b.close();
