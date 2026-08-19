// Find boxes that have collapsed.
//
// A grid or flex child that ends up with almost no width still paints: it keeps its border, its
// scrollbars and a sliver of its content, which reads as a broken strip beside a normal card. The
// zero-width chart bug was one instance; this looks for every instance, on every page.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:4190";
const PAGES = [
  ["overview", "/city/delhi"], ["rankings", "/rankings?city=delhi"], ["about", "/about?city=delhi"],
  ["forecast-public", "/forecast?city=delhi"],
  ["ops-action", "/console?city=delhi&section=action"],
  ["ops-forecast", "/console?city=delhi&section=forecast"],
  ["ops-forecast-mumbai", "/console?city=mumbai&section=forecast"],
  ["ops-citizen", "/console?city=delhi&section=citizen"],
  ["ops-compare", "/console?city=delhi&section=compare"],
  ["ops-whatif", "/console?city=delhi&section=whatif"],
  ["ops-impact", "/console?city=delhi&section=impact"],
  ["ops-pipeline", "/console?city=delhi&section=pipeline"],
];

const PROBE = () => {
  const out = [];
  for (const el of document.querySelectorAll("main *")) {
    const r = el.getBoundingClientRect();
    if (r.height < 24 || r.width === 0) continue;              // invisible, not collapsed
    const cs = getComputedStyle(el);
    const scrolls = /auto|scroll/.test(cs.overflow + cs.overflowX + cs.overflowY);
    const hasText = (el.textContent || "").trim().length > 12;
    // narrow AND tall AND carrying content is the signature of a collapsed column
    if (r.width < 90 && r.height > 90 && (scrolls || hasText)) {
      out.push({
        tag: el.tagName,
        cls: String(el.className || "").slice(0, 52),
        w: Math.round(r.width), h: Math.round(r.height),
        parentCls: String(el.parentElement?.className || "").slice(0, 46),
        parentDisplay: el.parentElement ? getComputedStyle(el.parentElement).display : "",
        parentCols: el.parentElement ? getComputedStyle(el.parentElement).gridTemplateColumns : "",
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
      });
    }
  }
  // report only the outermost of each nested run
  return out.filter((a, i) => !out.some((b, j) => j !== i && b.w >= a.w && a.cls.startsWith(b.cls) && b.cls.length > 4)).slice(0, 6);
};

const b = await chromium.launch();
let total = 0;
for (const w of [1440, 1280, 1024]) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 } });
  await p.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
  for (const [name, path] of PAGES) {
    await p.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
    await p.waitForTimeout(path.includes("console") ? 5200 : 3600);
    const hits = await p.evaluate(PROBE).catch(() => []);
    for (const h of hits) {
      total += 1;
      console.log(`[${w}px] ${name}`);
      console.log(`   ${h.tag}.${h.cls}  ${h.w}x${h.h}`);
      console.log(`   parent: ${h.parentDisplay} ${h.parentCls}`);
      if (h.parentCols) console.log(`   cols: ${h.parentCols}`);
      console.log(`   text: "${h.text}"`);
    }
  }
  await p.close();
}
await b.close();
console.log(total ? `\n${total} collapsed box(es)` : "\nno collapsed boxes at any width");
