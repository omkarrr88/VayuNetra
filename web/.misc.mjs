import { chromium } from "playwright";
const S = "/tmp/claude-1000/-home-omkar-kadam-Desktop-VayuNetra/82517b60-1549-4f2d-9b8e-cf0e3c4d1f0e/scratchpad/shots";
const b = await chromium.launch();
// landing desktop + mobile
for (const [tag, vp] of [["land-fhd",{width:1920,height:1080}],["land-mob",{width:390,height:844}]]) {
  const p = await b.newPage({ viewport: vp });
  await p.goto("http://localhost:5173/", { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${S}/${tag}.png`, fullPage: true }); await p.close();
}
// present mode at projector size + tablet
const p = await b.newPage({ viewport: {width:1366,height:768} });
await p.addInitScript(() => localStorage.setItem("vayunetra-tour-v1","done"));
await p.goto("http://localhost:5173/console?city=delhi&section=action", { waitUntil: "networkidle" }); await p.waitForTimeout(7000);
await p.keyboard.press("p"); await p.waitForTimeout(1500);
await p.screenshot({ path: `${S}/present-proj.png` });
await p.setViewportSize({width:1024,height:768}); await p.keyboard.press("p"); await p.waitForTimeout(1500);
await p.screenshot({ path: `${S}/tab-action.png` });
await b.close(); console.log("ok");
