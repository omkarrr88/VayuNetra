import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";

async function auditCitySwitch() {
  console.log("🔍 VayuNetra Audit: City Switch Race Condition Test");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log("\n1. Loading homepage...");
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    
    // Click "Open console" link
    const openConsoleLink = await page.locator("a:has-text('Open console')").first();
    if (await openConsoleLink.isVisible()) {
      console.log("2. Clicking 'Open console'...");
      await openConsoleLink.click();
      await page.waitForNavigation({ waitUntil: "networkidle" });
      console.log("✓ Navigated to console");
    } else {
      console.log("⚠️ Open console link not found, trying direct path");
      await page.goto(`${BASE_URL}/console`, { waitUntil: "networkidle" });
    }

    // Now look for city elements
    console.log("\n3. Looking for city selector...");
    const links = await page.locator("a").all();
    const cityLinks = [];
    
    for (const link of links) {
      const text = (await link.textContent())?.trim() || "";
      if (text.match(/Delhi|Hyderabad|Chennai|Bangalore|Mumbai|Kolkata|Pune|Lucknow|Jaipur/)) {
        cityLinks.push({ text, link });
      }
    }
    
    console.log(`Found ${cityLinks.length} city links`);
    
    if (cityLinks.length < 3) {
      console.log("⚠️ Not enough city links found");
      // Try to find by data attributes
      const allElements = await page.locator("[data-city], [class*='city']").all();
      console.log(`   Found ${allElements.length} elements with city data attributes`);
      
      // Show what's visible
      const visibleText = await page.evaluate(() => document.body.innerText);
      const snippet = visibleText.substring(0, 500);
      console.log("\n   Visible text sample:");
      console.log("   " + snippet.split("\n").slice(0, 15).join("\n   "));
    } else {
      // Perform rapid city switching
      console.log("\n4. Rapid city switching (6 switches)...");
      
      for (let i = 0; i < Math.min(6, cityLinks.length); i++) {
        const { text, link } = cityLinks[i % cityLinks.length];
        console.log(`   Switch ${i + 1}: ${text}`);
        
        await link.click();
        await page.waitForTimeout(300); // Brief wait for UI update
        
        // Check URL changed
        const url = page.url();
        if (url.includes(text.toLowerCase())) {
          console.log(`      ✓ URL updated`);
        }
      }

      console.log("\n5. Taking viewport screenshots...");
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: "/tmp/claude-1000/-home-omkar-kadam-Desktop-VayuNetra/82517b60-1549-4f2d-9b8e-cf0e3c4d1f0e/scratchpad/viewport-1366x768.png" });
      console.log("   ✓ 1366x768 screenshot saved");
      
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: "/tmp/claude-1000/-home-omkar-kadam-Desktop-VayuNetra/82517b60-1549-4f2d-9b8e-cf0e3c4d1f0e/scratchpad/viewport-1280x720.png" });
      console.log("   ✓ 1280x720 screenshot saved");
    }
    
    console.log("\n✓ Audit complete");
  } catch (e) {
    console.error("❌ Test failed:", e.message);
  } finally {
    await browser.close();
  }
}

auditCitySwitch().catch(console.error);
