import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.25 });
const p = await ctx.newPage();
await p.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
await p.goto("http://localhost:5173/console?city=delhi&section=action", { waitUntil: "networkidle", timeout: 90000 });
await p.waitForTimeout(8000);
// make sure a cell story is open (auto-open) — else click a hexagon-ish spot
const story = p.getByText("Cell story", { exact: false }).first();
if (!(await story.isVisible().catch(() => false))) { await p.mouse.click(700, 420); await p.waitForTimeout(3000); }
await p.screenshot({ path: "public/console.jpg", type: "jpeg", quality: 84 });
console.log("hero saved");
await b.close();
