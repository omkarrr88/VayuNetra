import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
for (const [name, url] of [["dark-console", "/console?city=delhi&section=action&theme=dark"], ["light-console", "/console?city=delhi&section=action&theme=light"], ["dark-forecast", "/console?city=delhi&section=forecast&theme=dark"]]) {
  await p.goto("http://localhost:5173" + url, { waitUntil: "networkidle" });
  await p.waitForTimeout(4500);
  await p.screenshot({ path: `.qa-out/${name}.png` });
  console.log(name, "ok");
}
await b.close();
