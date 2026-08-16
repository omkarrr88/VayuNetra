import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";

async function auditCitySwitch() {
  console.log("🔍 VayuNetra Audit: City Switch Test (v4)");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log("\n1. Load console...");
    await page.goto(`${BASE_URL}/console`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    console.log("✓ Loaded");

    console.log("\n2. Looking for city selector elements...");
    
    // Get all clickable elements
    const clickables = await page.locator("button, a, [role='button'], [class*='cursor-pointer']").all();
    console.log(`   Found ${clickables.length} clickable elements`);
    
    let cityElements = [];
    for (const elem of clickables) {
      const text = (await elem.textContent())?.trim() || "";
      const ariaLabel = await elem.getAttribute("aria-label");
      
      if (text.match(/Delhi|Hyderabad|Chennai|Mumbai|Bangalore|Kolkata|Pune|Lucknow|Jaipur|Ahmedabad/i) ||
          ariaLabel?.match(/Delhi|Hyderabad|Chennai|Mumbai|Bangalore|Kolkata|Pune|Lucknow|Jaipur|Ahmedabad/i)) {
        cityElements.push({ text, elem });
      }
    }
    
    console.log(`   Found ${cityElements.length} city elements`);
    
    if (cityElements.length < 2) {
      // Try different approach - look for city selector dropdown or tabs
      const navItems = await page.locator("nav *").all();
      console.log(`   Inspecting nav elements...`);
      
      // Print all nav element text
      for (const item of navItems.slice(0, 20)) {
        const text = (await item.textContent())?.trim() || "";
        if (text && text.length < 30 && text.length > 0) {
          console.log(`     - ${text}`);
        }
      }
    }
    
    // Look for "Cities" section and its children
    console.log("\n3. Searching for Cities section...");
    const citiesSection = await page.locator("h2:has-text('Cities'), h3:has-text('Cities'), [class*='Cities']").first();
    if (await citiesSection.isVisible()) {
      console.log("   ✓ Found Cities section");
      const parent = await citiesSection.evaluate(el => el.parentElement);
      console.log("   Section HTML:", parent);
    }
    
    // Try to find by page layout structure
    console.log("\n4. Checking page content structure...");
    const mainContent = await page.evaluate(() => {
      const nav = document.querySelector("nav");
      if (nav) {
        const items = Array.from(nav.querySelectorAll("*"))
          .filter(el => {
            const text = el.textContent?.trim() || "";
            return text.length > 0 && text.length < 50;
          })
          .map(el => el.textContent?.trim())
          .slice(0, 15);
        return items;
      }
      return [];
    });
    console.log("   Nav items:", mainContent);
    
    console.log("\n✓ Inspection complete");
  } catch (e) {
    console.error("❌ Error:", e.message);
  } finally {
    await browser.close();
  }
}

auditCitySwitch().catch(console.error);
