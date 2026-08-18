// Sweep the public site: every page, both themes, desktop + phone. Captures screenshots, collects
// page errors, and flags overflow / overlap / low-contrast text — the three things a restructure
// breaks first.
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = process.env.OUT ?? ".qa-out/site";
const BASE = process.env.BASE ?? "http://localhost:5173";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["landing", "/"],
  ["overview", "/city/delhi"],
  ["overview-mumbai", "/city/mumbai"],
  ["map", "/map?city=delhi"],
  ["forecast", "/forecast?city=delhi"],
  ["rankings", "/rankings?city=delhi"],
  ["about", "/about?city=delhi"],
];

const b = await chromium.launch();
const errs = [];
const findings = [];

async function probe(p, name) {
  return p.evaluate((tag) => {
    const out = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 2) out.push(`${tag}: horizontal overflow (${de.scrollWidth} > ${de.clientWidth})`);
    const lum = (c) => { const m = c.match(/[\d.]+/g); return m ? 0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2] : null; };
    let low = 0;
    for (const el of document.querySelectorAll("main *, footer *, header *")) {
      const t = el.textContent?.trim();
      if (!t || el.children.length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.opacity === "0") continue;
      let bg = cs.backgroundColor, node = el;
      while (bg === "rgba(0, 0, 0, 0)" && node.parentElement) { node = node.parentElement; bg = getComputedStyle(node).backgroundColor; }
      const a = lum(cs.color), c = lum(bg);
      if (a !== null && c !== null && Math.abs(a - c) < 40) { low += 1; if (low <= 3) out.push(`${tag}: low contrast "${t.slice(0, 34)}"`); }
    }
    // text clipped by its own box (a classic overlap symptom)
    for (const el of document.querySelectorAll("h1, h2, h3, p, span, b, td, th, li, button, a")) {
      if (el.children.length || !el.textContent?.trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.overflow === "hidden" && cs.textOverflow !== "ellipsis" && el.scrollHeight > el.clientHeight + 3 && el.clientHeight > 0) {
        out.push(`${tag}: clipped text "${el.textContent.trim().slice(0, 30)}"`);
        break;
      }
    }
    return out;
  }, name);
}

for (const [theme, viewport] of [["light", { width: 1600, height: 950 }], ["dark", { width: 1600, height: 950 }], ["light", { width: 390, height: 844 }]]) {
  const label = viewport.width < 500 ? `${theme}-mobile` : theme;
  const p = await b.newPage({ viewport });
  p.on("pageerror", (e) => errs.push(`${label}: ${String(e).slice(0, 160)}`));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon|manifest/i.test(m.text())) errs.push(`${label}: ${m.text().slice(0, 160)}`); });
  for (const [name, path] of PAGES) {
    const sep = path.includes("?") ? "&" : "?";
    await p.goto(`${BASE}${path}${sep}theme=${theme}`, { waitUntil: "networkidle" }).catch(() => {});
    await p.waitForTimeout(name === "map" ? 5000 : 2600);
    await p.screenshot({ path: `${OUT}/${label}-${name}.jpg`, type: "jpeg", quality: 68, fullPage: name !== "map" });
    findings.push(...(await probe(p, `${label}/${name}`)));
  }
  await p.close();
}

await b.close();
console.log(`\n=== page errors (${errs.length}) ===`);
for (const e of [...new Set(errs)]) console.log(" -", e);
console.log(`\n=== layout findings (${findings.length}) ===`);
for (const f of [...new Set(findings)]) console.log(" -", f);
console.log(`\nscreenshots → ${OUT}`);
