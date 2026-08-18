// Sweep every console section in both themes: capture screenshots, catch errors, and flag
// low-contrast text (a cheap proxy for "unreadable in dark mode").
import { chromium } from "playwright";
import { mkdirSync } from "fs";
const OUT = process.env.OUT ?? ".qa-out/theme";
mkdirSync(OUT, { recursive: true });
const SECTIONS = ["action", "forecast", "citizen", "compare", "whatif", "impact", "pipeline", "cityair"];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errs.push(m.text().slice(0, 140)); });
await p.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
for (const theme of ["light", "dark"]) {
  for (const s of SECTIONS) {
    await p.goto(`http://localhost:5173/console?city=delhi&section=${s}&theme=${theme}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(3500);
    await p.screenshot({ path: `${OUT}/${theme}-${s}.jpg`, type: "jpeg", quality: 70 });
    // contrast proxy: text whose colour is within 40 of its background luminance
    const bad = await p.evaluate(() => {
      const lum = (c) => { const m = c.match(/\d+/g); return m ? 0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2] : null; };
      const out = [];
      for (const el of document.querySelectorAll("[data-rail] *")) {
        if (!el.textContent?.trim() || el.children.length) continue;
        const cs = getComputedStyle(el);
        let bg = cs.backgroundColor, node = el;
        while (bg === "rgba(0, 0, 0, 0)" && node.parentElement) { node = node.parentElement; bg = getComputedStyle(node).backgroundColor; }
        const a = lum(cs.color), c = lum(bg);
        if (a !== null && c !== null && Math.abs(a - c) < 40) out.push(`${el.tagName}.${(el.className || "").toString().slice(0, 30)} "${el.textContent.trim().slice(0, 28)}"`);
      }
      return out.slice(0, 4);
    });
    if (bad.length) console.log(`${theme}/${s} LOW CONTRAST:`, bad);
  }
}
console.log("errors:", errs.length ? [...new Set(errs)] : "none");
await b.close();
