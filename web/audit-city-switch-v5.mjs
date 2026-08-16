import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";

async function auditCitySwitch() {
  console.log("🔍 VayuNetra Audit: City Switch Test (v5 - via Cities nav)");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log("\n1. Load console...");
    await page.goto(`${BASE_URL}/console`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    console.log("✓ Loaded");

    console.log("\n2. Click on 'Cities' nav item...");
    const citiesNav = await page.locator("nav *:has-text('Cities')").first();
    if (await citiesNav.isVisible()) {
      await citiesNav.click();
      await page.waitForTimeout(500);
      console.log("✓ Cities section opened");
    } else {
      console.log("⚠️ Cities nav not found, trying alternate");
    }

    console.log("\n3. Finding city selector options...");
    const allText = await page.evaluate(() => document.body.innerText);
    const lines = allText.split("\n");
    
    // Find indices of each city
    const cityNames = ["Delhi", "Hyderabad", "Chennai", "Mumbai", "Bangalore", "Kolkata", "Pune", "Lucknow", "Jaipur", "Ahmedabad"];
    const foundCities = [];
    
    for (const city of cityNames) {
      if (lines.some(l => l.trim() === city)) {
        foundCities.push(city);
      }
    }
    
    console.log(`   Found cities in page: ${foundCities.join(", ")}`);
    
    if (foundCities.length >= 3) {
      console.log("\n4. Testing rapid city switches...");
      
      // Try clicking cities in sequence
      for (let i = 0; i < 6; i++) {
        const city = foundCities[i % foundCities.length];
        console.log(`   Switch ${i + 1}: ${city}`);
        
        // Look for element containing this city name
        const cityElem = await page.locator(`text="${city}"`).first();
        if (await cityElem.isVisible()) {
          await cityElem.click();
          await page.waitForTimeout(300);
          
          // Check URL or other state changes
          const url = page.url();
          const currentCity = await page.locator("text=/\\d+ Cells|AQI/").first().textContent();
          console.log(`      URL: ${url.split("/").pop() || url.substring(url.length - 20)}`);
        }
      }
      
      console.log("\n5. Checking for stuck UI...");
      const loadingSpinners = await page.locator("[class*='animate'], [class*='spinner'], [class*='loading']").count();
      console.log(`   Loading indicators: ${loadingSpinners}`);
      
      const contentVisible = await page.locator("main, [role='main']").first().isVisible();
      console.log(`   Main content visible: ${contentVisible}`);
      
      console.log("\n✓ City switching test complete (no crashes)");
    }
    
  } catch (e) {
    console.error("❌ Error:", e.message);
    console.error(e.stack);
  } finally {
    await browser.close();
  }
}

auditCitySwitch().catch(console.error);
