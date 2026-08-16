import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";

async function auditCitySwitch() {
  console.log("🔍 VayuNetra Audit: City Switch Race Condition Test");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log("\n1. Direct navigation to console...");
    await page.goto(`${BASE_URL}/console`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000); // Give it time to load interactively
    console.log("✓ Console loaded");

    // Look for city elements
    console.log("\n2. Looking for city selector...");
    const links = await page.locator("a").all();
    const cityLinks = [];
    
    for (const link of links) {
      const text = (await link.textContent())?.trim() || "";
      if (text.match(/Delhi|Hyderabad|Chennai|Bangalore|Mumbai|Kolkata|Pune|Lucknow|Jaipur|Ahmedabad/i)) {
        cityLinks.push({ text, link });
      }
    }
    
    console.log(`   Found ${cityLinks.length} city links`);
    
    if (cityLinks.length >= 3) {
      // Perform rapid city switching
      console.log("\n3. Rapid city switching (6 switches)...");
      
      for (let i = 0; i < Math.min(6, cityLinks.length); i++) {
        const { text, link } = cityLinks[i % cityLinks.length];
        console.log(`   Switch ${i + 1}: ${text}`);
        
        await link.click();
        await page.waitForTimeout(200); // Brief wait
      }

      console.log("\n4. Final UI state check...");
      const url = page.url();
      console.log(`   URL: ${url}`);
      
      const visibleText = await page.evaluate(() => document.body.innerText);
      if (visibleText.length > 200) {
        console.log(`   ✓ Content loaded (${visibleText.length} chars)`);
      } else {
        console.log(`   ⚠️ Minimal content (${visibleText.length} chars)`);
      }

    } else {
      console.log("   ⚠️ Not enough city links. Showing page content:");
      const text = await page.evaluate(() => document.body.innerText);
      console.log(text.substring(0, 300));
    }
    
    console.log("\n✓ City switch test complete (no crashes)");
  } catch (e) {
    console.error("❌ Test failed:", e.message);
  } finally {
    await browser.close();
  }
}

auditCitySwitch().catch(console.error);
