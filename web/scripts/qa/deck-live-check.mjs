// Drive the deck like a presenter: animations on, keyboard nav, D overlay, N notes, R replay.
import { chromium } from "playwright";
const file = new URL("../../../docs/VayuNetra_Pitch.html", import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(file, { waitUntil: "load" });
await page.waitForTimeout(2500);
await page.screenshot({ path: "../docs/pitch/render/live-01-title.png" });
for (let i = 0; i < 3; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(1500); }
await page.waitForTimeout(6000); // winter replay running
await page.screenshot({ path: "../docs/pitch/render/live-04-winter-mid.png" });
await page.keyboard.press("ArrowRight"); await page.waitForTimeout(2200);
await page.screenshot({ path: "../docs/pitch/render/live-05-proof.png" });
await page.keyboard.press("ArrowRight"); await page.waitForTimeout(800);
await page.keyboard.press("d"); await page.waitForTimeout(6000);
const src = await page.evaluate(() => document.getElementById("ovFrame").src);
await page.screenshot({ path: "../docs/pitch/render/live-06-overlay.png" });
await page.keyboard.press("Escape"); await page.waitForTimeout(500);
await page.keyboard.press("n"); await page.waitForTimeout(400);
await page.screenshot({ path: "../docs/pitch/render/live-06-notes.png" });
const counter = await page.textContent("#ctr");
console.log("overlay src:", src, "| counter:", counter, "| errors:", errors.length ? errors : "none");
await browser.close();
