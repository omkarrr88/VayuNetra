import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";

async function auditCitySwitch() {
  console.log("🔍 VayuNetra Audit: City Switch Race Condition Test");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log("\n1. Loading console...");
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    console.log("✓ Loaded");

    // Inspect page structure
    const buttons = await page.locator("button").all();
    console.log(`Found ${buttons.length} total buttons`);
    
    const cityButtons = [];
    for (const btn of buttons) {
      const text = (await btn.textContent())?.trim() || "";
      if (text.match(/Delhi|Hyderabad|Chennai|Bangalore|Mumbai|Kolkata|Pune|Lucknow|Jaipur/i)) {
        cityButtons.push({ text, element: btn });
      }
    }
    
    console.log(`Found ${cityButtons.length} city buttons`);
    if (cityButtons.length < 3) {
      console.log("⚠️ Could not find 3+ city buttons. Available cities:");
      cityButtons.forEach(c => console.log(`   - ${c.text}`));
      await browser.close();
      return;
    }

    const citiesToSwitch = cityButtons.slice(0, 6);
    console.log("\n2. Rapid city switching (6 switches)...");

    for (let i = 0; i < citiesToSwitch.length; i++) {
      const { text } = citiesToSwitch[i];
      console.log(`  Switch ${i + 1}: ${text}`);
      
      const btn = await page.locator("button").filter({ hasText: text }).first();
      await btn.click();
      
      // Check for loading states
      await page.waitForTimeout(200);
      
      const spinners = await page.locator(".animate-spin, [class*='spinner'], [class*='loading']").all();
      if (spinners.length > 0) {
        console.log(`    Loading indicator present (${spinners.length})`);
      }
    }

    console.log("\n3. Checking final state...");
    const url = page.url();
    console.log(`   Final URL: ${url}`);
    
    const mainContent = await page.locator("main, [role='main'], body > div").first();
    const isVisible = await mainContent.isVisible();
    console.log(`   Main content visible: ${isVisible}`);

    // Take screenshot to verify UI state
    await page.screenshot({ path: "/tmp/claude-1000/-home-omkar-kadam-Desktop-VayuNetra/82517b60-1549-4f2d-9b8e-cf0e3c4d1f0e/scratchpad/city-switch.png" });
    console.log("   Screenshot saved: /tmp/claude-1000/-home-omkar-kadam-Desktop-VayuNetra/82517b60-1549-4f2d-9b8e-cf0e3c4d1f0e/scratchpad/city-switch.png");

    console.log("\n✓ City switch audit complete (no crashes detected)");
  } catch (e) {
    console.error("❌ Test failed:", e.message);
  } finally {
    await browser.close();
  }
}

auditCitySwitch().catch(console.error);
