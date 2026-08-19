// Sweep every console section in both themes after the full-page rebuild: screenshots, page
// errors, overflow and clipped text.
import { chromium } from "playwright";
import { mkdirSync } from "fs";
const OUT = process.env.OUT ?? ".qa-out/console";
const BASE = process.env.BASE ?? "http://localhost:5173";
mkdirSync(OUT, { recursive: true });
const SECTIONS = ["action", "forecast", "citizen", "compare", "whatif", "impact", "pipeline"];
const b = await chromium.launch();
const errs = [], findings = [];
for (const [theme, viewport] of [["light", { width: 1600, height: 950 }], ["dark", { width: 1600, height: 950 }], ["light", { width: 390, height: 844 }]]) {
  const label = viewport.width < 500 ? `${theme}-mobile` : theme;
  const p = await b.newPage({ viewport });
  p.on("pageerror", (e) => errs.push(`${label}: ${String(e).slice(0, 160)}`));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon|manifest/i.test(m.text())) errs.push(`${label}: ${m.text().slice(0, 160)}`); });
  await p.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
  for (const s of SECTIONS) {
    await p.goto(`${BASE}/console?city=delhi&section=${s}&theme=${theme}`, { waitUntil: "networkidle" }).catch(() => {});
    await p.waitForTimeout(s === "action" ? 5200 : 3200);
    await p.screenshot({ path: `${OUT}/${label}-${s}.jpg`, type: "jpeg", quality: 68, fullPage: true });
    findings.push(...await p.evaluate((tag) => {
      const out = [], de = document.documentElement;
      if (de.scrollWidth > de.clientWidth + 2) out.push(`${tag}: horizontal overflow (${de.scrollWidth} > ${de.clientWidth})`);
      const lum = (c) => { const m = c.match(/[\d.]+/g); return m ? 0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2] : null; };
      let low = 0;
      for (const el of document.querySelectorAll("main *")) {
        const t = el.textContent?.trim();
        if (!t || el.children.length) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.opacity === "0") continue;
        let bg = cs.backgroundColor, node = el;
        while (bg === "rgba(0, 0, 0, 0)" && node.parentElement) { node = node.parentElement; bg = getComputedStyle(node).backgroundColor; }
        const a = lum(cs.color), c = lum(bg);
        if (a !== null && c !== null && Math.abs(a - c) < 40) { low += 1; if (low <= 3) out.push(`${tag}: low contrast "${t.slice(0, 34)}"`); }
      }
      return out;
    }, `${label}/${s}`));
  }
  await p.close();
}
await b.close();
console.log(`\n=== page errors (${errs.length}) ===`);
for (const e of [...new Set(errs)]) console.log(" -", e);
console.log(`\n=== layout findings (${findings.length}) ===`);
for (const f of [...new Set(findings)]) console.log(" -", f);
