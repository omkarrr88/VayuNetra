// QA helper — accessibility audit with axe-core on the landing page and the console (all 7 sections).
// Usage: node scripts/qa/axe-audit.mjs   (dev server on :5173, API on :8000)
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const base = process.env.BASE ?? "http://localhost:5173";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
const p = await ctx.newPage();
await p.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
const targets = ["/", ...["action","forecast","citizen","compare","whatif","impact","pipeline"].map(s => `/console?city=delhi&section=${s}`)];
const totals = {};
for (const path of targets) {
  await p.goto(base + path, { waitUntil: "networkidle", timeout: 90000 }); await p.waitForTimeout(4000);
  const res = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa"]).analyze();
  console.log(`\n== ${path}: ${res.violations.length} violation types`);
  for (const v of res.violations) {
    totals[v.id] = (totals[v.id] ?? 0) + v.nodes.length;
    console.log(`  [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target?.[0]?.slice(0, 90)}`);
  }
}
console.log("\nTOTALS", JSON.stringify(totals));
await b.close();
