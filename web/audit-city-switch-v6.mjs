import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";

async function auditCitySwitch() {
  console.log("🔍 VayuNetra Audit: City Switch Test (v6 - close modal first)");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log("\n1. Load console...");
    await page.goto(`${BASE_URL}/console`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    console.log("✓ Loaded");

    console.log("\n2. Closing quick tour modal...");
    const closeBtn = await page.locator("button[aria-label*='close'], [role='button'][aria-label*='Close'], button:has-text('×')").first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(300);
      console.log("✓ Modal closed");
    } else {
      console.log("⚠️ Close button not found, trying escape key");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    console.log("\n3. Finding cities to switch...");
    const allText = await page.evaluate(() => document.body.innerText);
    const cityNames = ["Delhi", "Hyderabad", "Chennai", "Mumbai", "Bangalore", "Kolkata", "Pune", "Lucknow", "Jaipur", "Ahmedabad"];
    const foundCities = cityNames.filter(city => allText.includes(city));
    
    console.log(`   Found ${foundCities.length} cities on page: ${foundCities.slice(0, 3).join(", ")}...`);
    
    if (foundCities.length >= 3) {
      console.log("\n4. Rapid city switches (6 switches)...");
      let switchCount = 0;
      
      for (let i = 0; i < 6; i++) {
        const city = foundCities[i % foundCities.length];
        console.log(`   Switch ${i + 1}: ${city}`);
        
        const cityElem = await page.locator(`text="${city}"`).first();
        try {
          await cityElem.click({ timeout: 3000 });
          await page.waitForTimeout(200);
          switchCount++;
          console.log(`      ✓ Switched`);
        } catch (e) {
          console.log(`      ⚠️ Click failed: ${e.message}`);
        }
      }
      
      console.log(`\n5. Post-switch state checks...`);
      console.log(`   Successfully switched: ${switchCount}/6 times`);
      
      // Check for loading state
      const spinners = await page.locator("[class*='animate-spin'], [class*='loader']").count();
      console.log(`   Spinning loaders: ${spinners}`);
      
      // Check content
      const content = await page.evaluate(() => document.body.innerText.length);
      console.log(`   Page content length: ${content} chars`);
      
      // Check URL
      const url = page.url();
      console.log(`   Final URL: ${url}`);
      
      // Take screenshots
      console.log("\n6. Taking viewport screenshots...");
      
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: "/tmp/claude-1000/-home-omkar-kadam-Desktop-VayuNetra/82517b60-1549-4f2d-9b8e-cf0e3c4d1f0e/scratchpad/viewport-1366x768.png" });
      console.log("   ✓ Screenshot 1366x768 saved");
      
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: "/tmp/claude-1000/-home-omkar-kadam-Desktop-VayuNetra/82517b60-1549-4f2d-9b8e-cf0e3c4d1f0e/scratchpad/viewport-1280x720.png" });
      console.log("   ✓ Screenshot 1280x720 saved");
      
      console.log("\n✓ City switching test complete");
    }
    
  } catch (e) {
    console.error("❌ Error:", e.message);
  } finally {
    await browser.close();
  }
}

auditCitySwitch().catch(console.error);
