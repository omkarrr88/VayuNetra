import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; p.on("pageerror", e => errs.push(String(e)));
await p.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
for (const sec of ["action", "forecast", "citizen", "compare", "whatif", "impact", "pipeline"]) {
  await p.goto(`http://localhost:5173/console?city=delhi&section=${sec}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(3500);
  const tabs = p.getByRole("tab");
  const n = await tabs.count();
  const cards = await p.locator("[data-rail] [data-step]").count();
  let visited = 0;
  for (let i = 0; i < n; i++) { await tabs.nth(i).click(); await p.waitForTimeout(900); visited++; }
  const cardsAfter = await p.locator("[data-rail] [data-step]").count();
  console.log(sec, "tabs", n, "cards visible at once", cards, "→", cardsAfter, "clicked", visited);
  await p.screenshot({ path: `.qa-out/tabs-${sec}.png` });
}
console.log("errors:", errs.length ? errs : "none");
await b.close();
