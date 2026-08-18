import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";

async function auditViewports() {
  console.log("🔍 VayuNetra Audit: Viewport & Rendering Test");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log("\n1. Testing 1366x768 (laptop projector)...");
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${BASE_URL}/console`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    
    // Close modal if present
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);
    
    // Take screenshot
    await page.screenshot({ path: "/tmp/claude-1000/-home-omkar-kadam-Desktop-VayuNetra/82517b60-1549-4f2d-9b8e-cf0e3c4d1f0e/scratchpad/viewport-1366x768.png" });
    console.log("   ✓ Screenshot saved: viewport-1366x768.png");
    
    // Check for visual issues
    const overflow = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      return {
        bodyWidth: body.scrollWidth,
        bodyHeight: body.scrollHeight,
        viewportWidth: html.clientWidth,
        viewportHeight: html.clientHeight,
        hasHorizontalScroll: body.scrollWidth > html.clientWidth,
        hasVerticalScroll: body.scrollHeight > html.clientHeight,
      };
    });
    console.log(`   Body size: ${overflow.bodyWidth}x${overflow.bodyHeight}`);
    console.log(`   Viewport size: ${overflow.viewportWidth}x${overflow.viewportHeight}`);
    if (overflow.hasHorizontalScroll) {
      console.log("   ⚠️ HORIZONTAL SCROLL DETECTED - text may be cut off");
    } else {
      console.log("   ✓ No horizontal scroll");
    }

    console.log("\n2. Testing 1280x720 (HD)...");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/console`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);
    
    await page.screenshot({ path: "/tmp/claude-1000/-home-omkar-kadam-Desktop-VayuNetra/82517b60-1549-4f2d-9b8e-cf0e3c4d1f0e/scratchpad/viewport-1280x720.png" });
    console.log("   ✓ Screenshot saved: viewport-1280x720.png");
    
    const overflow2 = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      return {
        bodyWidth: body.scrollWidth,
        bodyHeight: body.scrollHeight,
        viewportWidth: html.clientWidth,
        viewportHeight: html.clientHeight,
        hasHorizontalScroll: body.scrollWidth > html.clientWidth,
      };
    });
    console.log(`   Body size: ${overflow2.bodyWidth}x${overflow2.bodyHeight}`);
    console.log(`   Viewport size: ${overflow2.viewportWidth}x${overflow2.viewportHeight}`);
    if (overflow2.hasHorizontalScroll) {
      console.log("   ⚠️ HORIZONTAL SCROLL DETECTED - text may be cut off");
    } else {
      console.log("   ✓ No horizontal scroll");
    }
    
    console.log("\n✓ Viewport tests complete");
    
  } catch (e) {
    console.error("❌ Error:", e.message);
  } finally {
    await browser.close();
  }
}

auditViewports().catch(console.error);
