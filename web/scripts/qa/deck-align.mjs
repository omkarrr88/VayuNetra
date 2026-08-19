// Alignment audit for the pitch deck: for every slide, find content that overflows the stage, spills
// past the slide's padding box, collides with the footer strip, or overlaps a sibling column.
// Cheaper and far more reliable than eyeballing 23 renders.
import { chromium } from "playwright";

const FILE = process.env.DECK ?? "file:///home/omkar-kadam/Desktop/VayuNetra/docs/VayuNetra_Pitch.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });

await p.goto(`${FILE}?static=1#1`, { waitUntil: "load" });
await p.waitForTimeout(1200);
const n = await p.evaluate(() => document.querySelectorAll(".slide").length);

const findings = [];
for (let i = 1; i <= n; i++) {
  await p.evaluate((k) => { location.hash = `#${k}`; }, i);
  await p.waitForTimeout(i === 4 ? 1600 : 800);
  const res = await p.evaluate((k) => {
    const out = [];
    const slide = document.querySelectorAll(".slide")[k - 1];
    if (!slide) return out;
    const cs = getComputedStyle(slide);
    const pad = { t: parseFloat(cs.paddingTop), r: parseFloat(cs.paddingRight), b: parseFloat(cs.paddingBottom), l: parseFloat(cs.paddingLeft) };
    const sb = slide.getBoundingClientRect();
    const box = { l: sb.left + pad.l, r: sb.right - pad.r, t: sb.top + pad.t, b: sb.bottom - pad.b };
    const label = (el) => `${el.tagName}${el.id ? "#" + el.id : ""}.${String(el.className || "").slice(0, 26)}`;
    // Two things are meant to leave the padding box: a decorative element that bleeds to the stage
    // edge (the India maps on the title and closing slides), and a full-bleed backdrop behind the
    // content (the demo slide's screenshot). Neither is an alignment fault; text over them is.
    const inBleed = (el) => { for (let n = el; n && n !== slide; n = n.parentElement) if (isBleed(n)) return true; return false; };
    const isBleed = (el) => {
      if (!el.hasAttribute("style")) return false;
      const st = el.getAttribute("style");
      return /position:absolute/.test(st) && /(right:0|right:1\.5%|inset:0)/.test(st);
    };

    if (slide.scrollHeight > slide.clientHeight + 2) out.push(`slide scrolls vertically (${slide.scrollHeight} > ${slide.clientHeight})`);
    if (slide.scrollWidth > slide.clientWidth + 2) out.push(`slide scrolls horizontally (${slide.scrollWidth} > ${slide.clientWidth})`);

    for (const el of slide.querySelectorAll("*")) {
      if (el.closest(".foot") || el.classList.contains("haze") || el.tagName === "I") continue;
      if (inBleed(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.bottom > box.b + 6) { out.push(`spills ${Math.round(r.bottom - box.b)}px below the content box: ${label(el)} "${(el.textContent || "").trim().slice(0, 40)}"`); break; }
    }
    for (const el of slide.querySelectorAll("*")) {
      if (el.closest(".foot") || el.classList.contains("haze") || el.tagName === "I") continue;
      if (inBleed(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.right > box.r + 6 || r.left < box.l - 6) { out.push(`spills sideways: ${label(el)} -> ${Math.round(r.left)}..${Math.round(r.right)} (box ${Math.round(box.l)}..${Math.round(box.r)})`); break; }
    }

    const foot = slide.querySelector(".foot");
    if (foot) {
      const fr = foot.getBoundingClientRect();
      for (const el of slide.querySelectorAll("p, h1, h2, h3, div.card, svg, ol, ul, table")) {
        if (el.closest(".foot")) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (r.bottom > fr.top + 2 && r.top < fr.bottom - 2 && r.right > fr.left && r.left < fr.right) {
          out.push(`overlaps the footer: ${label(el)} "${(el.textContent || "").trim().slice(0, 34)}"`);
          break;
        }
      }
    }

    for (const row of slide.querySelectorAll(".row")) {
      const cols = [...row.children].map((c) => ({ c, r: c.getBoundingClientRect() })).filter((x) => x.r.width > 2);
      for (let a = 0; a < cols.length; a++)
        for (let bb = a + 1; bb < cols.length; bb++) {
          const A = cols[a].r, B = cols[bb].r;
          const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left);
          const oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
          if (ox > 4 && oy > 4) out.push(`columns overlap by ${Math.round(ox)}px: ${label(cols[a].c)} x ${label(cols[bb].c)}`);
        }
    }

    for (const abs of slide.querySelectorAll("*")) {
      const acs = getComputedStyle(abs);
      // decorative backdrops are meant to sit under the text: haze particles, and the demo slide's
      // full-bleed screenshot at 28% opacity
      if (acs.position !== "absolute" || abs.closest(".foot") || abs.classList.contains("haze")) continue;
      if (abs.tagName === "I" || parseFloat(acs.opacity) < 0.5) continue;
      // a backdrop that covers the whole slide sits UNDER the content by design
      const abr = abs.getBoundingClientRect();
      if (abr.width >= sb.width - 2 && abr.height >= sb.height - 2) continue;
      const ar = abs.getBoundingClientRect();
      if (ar.width < 40 || ar.height < 40) continue;
      let hit = false;
      for (const t of slide.querySelectorAll("h1, h2, p, .kicker")) {
        if (abs.contains(t) || t.contains(abs)) continue;
        const tr = t.getBoundingClientRect();
        if (tr.width < 20 || !(t.textContent || "").trim()) continue;
        const ox = Math.min(ar.right, tr.right) - Math.max(ar.left, tr.left);
        const oy = Math.min(ar.bottom, tr.bottom) - Math.max(ar.top, tr.top);
        if (ox > 12 && oy > 8) { out.push(`absolute ${label(abs)} covers text "${(t.textContent || "").trim().slice(0, 34)}" by ${Math.round(ox)}x${Math.round(oy)}px`); hit = true; break; }
      }
      if (hit) break;
    }

    for (const h of slide.querySelectorAll("h1, h2")) {
      const lh = parseFloat(getComputedStyle(h).lineHeight) || parseFloat(getComputedStyle(h).fontSize) * 1.1;
      const lines = Math.round(h.getBoundingClientRect().height / lh);
      if (lines >= 3) out.push(`heading wraps to ${lines} lines: "${(h.textContent || "").trim().slice(0, 50)}"`);
    }
    return out;
  }, i);
  for (const f of res) findings.push(`slide ${String(i).padStart(2, "0")}: ${f}`);
}
await b.close();
console.log(`=== deck errors (${errs.length}) ===`);
for (const e of [...new Set(errs)]) console.log(" -", e);
console.log(`\n=== alignment findings (${findings.length}) ===`);
for (const f of findings) console.log(" -", f);
