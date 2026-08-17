import { chromium } from "playwright";
const S = "/tmp/claude-1000/-home-omkar-kadam-Desktop-VayuNetra/82517b60-1549-4f2d-9b8e-cf0e3c4d1f0e/scratchpad/shots";
const base = "http://localhost:5173";
const sections = ["action","forecast","citizen","compare","whatif","impact","pipeline"];
const only = process.argv[2] ? process.argv[2].split(",") : sections;
const vps = (process.argv[3] || "proj,fhd").split(",");
const VP = { proj: {w:1366,h:768}, fhd: {w:1920,h:1080}, mob: {w:390,h:844}, tab: {w:1024,h:768} };
const browser = await chromium.launch();
for (const tag of vps) {
  const vp = VP[tag];
  const ctx = await browser.newContext({ viewport: {width: vp.w, height: vp.h}, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(() => { localStorage.setItem("vn_tour_done","1"); localStorage.setItem("vayunetra.tour.v2","done"); localStorage.setItem("vayunetra-tour-seen","1"); });
  for (const s of only) {
    await page.goto(`${base}/console?city=delhi&section=${s}`, { waitUntil: "networkidle", timeout: 90000 }).catch(()=>{});
    await page.waitForTimeout(7000);
    for (const t of ["Skip","Skip tour","Got it","Close","Finish"]) { const b = page.getByRole("button",{name:t}); if (await b.count()) { await b.first().click().catch(()=>{}); } }
    await page.screenshot({ path: `${S}/${tag}-${s}.png`, fullPage: tag === "mob" });
  }
  await ctx.close();
}
await browser.close();
console.log("done");
