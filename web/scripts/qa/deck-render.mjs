// Render every slide of docs/VayuNetra_Pitch.html to PNG (1920×1080). ?static=1 jumps animations to their end state.
import { chromium } from "playwright";
import { mkdirSync } from "fs";
const file = new URL("../../../docs/VayuNetra_Pitch.html", import.meta.url).href;
const out = process.env.OUT ?? "../docs/pitch/render";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(`${file}?static=1#1`, { waitUntil: "load" });
await page.waitForTimeout(800);
const n = await page.evaluate(() => document.querySelectorAll(".slide").length);
for (let i = 1; i <= n; i++) {
  await page.evaluate((k) => { location.hash = "#" + k; }, i);
  await page.waitForTimeout(i === 4 ? 1400 : 700);
  await page.screenshot({ path: `${out}/slide-${String(i).padStart(2, "0")}.png` });
}
console.log("slides", n, "errors", errors.length ? errors : "none");
await browser.close();
