// Screenshots for the pitch deck — live console sections + landing, 1600×900 JPEG.
import { chromium } from "playwright";
const base = "http://localhost:5173";
const out = "../docs/pitch/shots";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
const shot = async (name, url, wait = 4000, act) => {
  await page.goto(`${base}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(wait);
  if (act) await act();
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 72 });
  console.log("shot", name);
};
await shot("landing", "/", 2500);
await shot("action", "/console?city=delhi&section=action", 5000);
await shot("dossier", "/console?city=delhi&section=action", 5000, async () => {
  const b = page.getByRole("button", { name: "Evidence dossier" }).first();
  await b.click(); await page.waitForTimeout(3500);
  await b.scrollIntoViewIfNeeded();
});
await shot("forecast", "/console?city=delhi&section=forecast", 5000);
await shot("hindsight", "/console?city=delhi&section=forecast", 5000, async () => {
  const c = page.getByText("Real interventions, in hindsight").first(); await c.scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
});
await shot("citizen", "/console?city=delhi&section=citizen", 5000);
await shot("compare", "/console?city=delhi&section=compare", 5000);
await shot("whatif", "/console?city=delhi&section=whatif", 4000);
await shot("impact", "/console?city=delhi&section=impact", 4000);
await shot("pipeline", "/console?city=delhi&section=pipeline", 4000);
await shot("mumbai", "/console?city=mumbai&section=action", 5000);
await browser.close();
