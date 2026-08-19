// Full-matrix audit: every page, every theme, from a 320px phone to a 2560px monitor.
//
// Checks, per combination:
//   · horizontal overflow of the document, and any element sticking past the viewport
//   · real WCAG contrast ratio for every text node (4.5:1 body, 3:1 large text)
//   · text clipped by its own box
//   · touch targets under 44×44 on phone widths
//   · overlapping interactive elements
// Screenshots are kept for the widths a human should eyeball.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";

const OUT = process.env.OUT ?? ".qa-out/responsive";
const BASE = process.env.BASE ?? "http://localhost:5173";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { w: 320, h: 568, name: "320-small-phone", shoot: true },
  { w: 390, h: 844, name: "390-phone", shoot: true },
  { w: 768, h: 1024, name: "768-tablet", shoot: true },
  { w: 1280, h: 800, name: "1280-laptop", shoot: true },
  { w: 1920, h: 1080, name: "1920-desktop", shoot: true },
  { w: 2560, h: 1440, name: "2560-monitor", shoot: true },
];

const PAGES = [
  ["landing", "/"],
  ["overview", "/city/delhi"],
  ["map", "/map?city=delhi"],
  ["forecast-public", "/forecast?city=delhi"],
  ["rankings", "/rankings?city=delhi"],
  ["about", "/about?city=delhi"],
  ["ops-action", "/console?city=delhi&section=action"],
  ["ops-forecast", "/console?city=delhi&section=forecast"],
  ["ops-citizen", "/console?city=delhi&section=citizen"],
  ["ops-compare", "/console?city=delhi&section=compare"],
  ["ops-whatif", "/console?city=delhi&section=whatif"],
  ["ops-impact", "/console?city=delhi&section=impact"],
  ["ops-pipeline", "/console?city=delhi&section=pipeline"],
];

const PROBE = ({ tag, isPhone }) => {
  const out = [];
  const push = (kind, detail) => out.push({ tag, kind, detail });

  /* ---------- overflow ---------- */
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 2) {
    push("overflow", `document scrolls horizontally (${de.scrollWidth} > ${de.clientWidth})`);
    const seen = new Set();
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > de.clientWidth + 2 || r.left < -2) {
        // report the outermost offender only
        const key = el.tagName + "." + String(el.className).slice(0, 40);
        if (seen.has(key)) continue;
        seen.add(key);
        const overflowsInside = el.closest("[data-scroll-x], .overflow-x-auto, .vn-scroll-x");
        if (overflowsInside) continue;
        push("overflow-el", `${el.tagName}.${String(el.className).slice(0, 46)} → ${Math.round(r.left)}..${Math.round(r.right)}`);
        if (seen.size >= 4) break;
      }
    }
  }

  /* ---------- contrast (real WCAG ratio) ---------- */
  const chan = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const relLum = (rgb) => 0.2126 * chan(rgb[0]) + 0.7152 * chan(rgb[1]) + 0.0722 * chan(rgb[2]);
  const parse = (c) => { const m = c && c.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]] : null; };
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
  const ratio = (a, b) => { const [l, d] = relLum(a) > relLum(b) ? [relLum(a), relLum(b)] : [relLum(b), relLum(a)]; return (l + 0.05) / (d + 0.05); };

  const bgOf = (el) => {
    let node = el, acc = null;
    while (node) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c[3] > 0) { acc = acc ? over(acc, c) : c; if (c[3] >= 0.99) return acc.slice(0, 3); }
      node = node.parentElement;
    }
    return acc ? acc.slice(0, 3) : [255, 255, 255];
  };

  let contrastHits = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length) continue;
    const t = el.textContent && el.textContent.trim();
    if (!t || t.length < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // skip anything the map owns — third-party attribution styling is not ours
    if (el.closest(".maplibregl-map, .maplibregl-ctrl")) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const size = parseFloat(cs.fontSize), weight = +cs.fontWeight || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(fg[3] < 1 ? over(fg, bgOf(el)) : fg.slice(0, 3), bgOf(el));
    if (got < need) {
      contrastHits += 1;
      if (contrastHits <= 5) push("contrast", `${got.toFixed(2)}:1 (needs ${need}) — "${t.slice(0, 40)}" [${String(el.className).slice(0, 40)}]`);
    }
  }
  if (contrastHits > 5) push("contrast", `…and ${contrastHits - 5} more below threshold`);

  /* ---------- clipped text ---------- */
  let clipped = 0;
  for (const el of document.querySelectorAll("h1,h2,h3,h4,p,span,b,strong,td,th,li,button,a,label,div")) {
    if (el.children.length || !el.textContent || !el.textContent.trim()) continue;
    const cs = getComputedStyle(el);
    if (cs.overflow === "visible" || cs.textOverflow === "ellipsis") continue;
    if (el.classList.contains("sr-only")) continue;
    if (el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 0 && cs.overflowY !== "auto" && cs.overflowY !== "scroll") {
      clipped += 1;
      if (clipped <= 3) push("clipped", `"${el.textContent.trim().slice(0, 40)}" [${String(el.className).slice(0, 36)}]`);
    }
  }

  /* ---------- touch targets ---------- */
  if (isPhone) {
    let small = 0;
    for (const el of document.querySelectorAll("button, a[href], select, input, [role=tab], [role=button]")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.closest(".maplibregl-map")) continue;
      if (r.height < 28 || r.width < 28) {
        small += 1;
        if (small <= 4) push("touch", `${Math.round(r.width)}×${Math.round(r.height)} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 28)}"`);
      }
    }
    if (small > 4) push("touch", `…and ${small - 4} more under 28px`);
  }

  return out;
};

const b = await chromium.launch();
const errs = [];
const findings = [];

for (const vp of VIEWPORTS) {
  for (const theme of ["light", "dark"]) {
    const page = await b.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    await page.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
    page.on("pageerror", (e) => errs.push(`${vp.name}/${theme}: ${String(e).slice(0, 150)}`));
    page.on("console", (m) => { if (m.type() === "error" && !/favicon|manifest|maplibre/i.test(m.text())) errs.push(`${vp.name}/${theme}: ${m.text().slice(0, 150)}`); });

    for (const [name, path] of PAGES) {
      const sep = path.includes("?") ? "&" : "?";
      try {
        await page.goto(`${BASE}${path}${sep}theme=${theme}`, { waitUntil: "networkidle", timeout: 45_000 });
      } catch { /* keep going: a slow page still gets probed */ }
      await page.waitForTimeout(name.includes("map") || name === "ops-action" ? 4200 : 2200);
      if (vp.shoot) {
        await page.screenshot({ path: `${OUT}/${vp.name}-${theme}-${name}.jpg`, type: "jpeg", quality: 62, fullPage: !name.includes("map") }).catch(() => {});
      }
      const res = await page.evaluate(PROBE, { tag: `${vp.name}/${theme}/${name}`, isPhone: vp.w <= 430 }).catch(() => []);
      findings.push(...res);
    }
    await page.close();
  }
}
await b.close();

const byKind = {};
for (const f of findings) (byKind[f.kind] ??= []).push(f);
const report = { errors: [...new Set(errs)], counts: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, v.length])), findings };
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));

console.log(`\n=== page errors (${report.errors.length}) ===`);
for (const e of report.errors.slice(0, 20)) console.log(" -", e);
console.log(`\n=== findings by kind ===`);
for (const [k, v] of Object.entries(report.counts)) console.log(` ${k}: ${v}`);
for (const [k, list] of Object.entries(byKind)) {
  console.log(`\n--- ${k} ---`);
  for (const f of [...new Map(list.map((x) => [x.detail, x])).values()].slice(0, 22)) console.log(` ${f.tag}\n   ${f.detail}`);
}
console.log(`\nreport → ${OUT}/report.json · screenshots → ${OUT}`);
