import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";

async function inspectDOM() {
  console.log("🔍 Inspecting VayuNetra DOM structure");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log("\n1. Loading page...");
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    
    console.log("\n2. DOM Structure:");
    const htmlContent = await page.content();
    
    // Look for city-related content
    const cityMatches = htmlContent.match(/Delhi|Hyderabad|Chennai|Mumbai/gi);
    console.log(`   Found ${cityMatches ? cityMatches.length : 0} city name mentions in HTML`);
    
    // Count different element types
    const buttons = await page.locator("button").count();
    const links = await page.locator("a").count();
    const divs = await page.locator("div").count();
    
    console.log(`   Elements: ${buttons} buttons, ${links} links, ${divs} divs`);
    
    // Look for selectors
    const dropdowns = await page.locator("select").count();
    console.log(`   Selects: ${dropdowns}`);
    
    // Print first 1000 chars of body
    const body = await page.locator("body").first();
    const bodyHTML = await body.innerHTML();
    console.log("\n3. Body HTML (first 1500 chars):");
    console.log(bodyHTML.substring(0, 1500));
    
    // Look for any city-related elements
    const allText = await page.evaluate(() => document.body.innerText);
    const lines = allText.split("\n").slice(0, 20);
    console.log("\n4. Visible text (first 20 lines):");
    lines.forEach(line => {
      if (line.trim()) console.log(`   ${line.substring(0, 80)}`);
    });
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await browser.close();
  }
}

inspectDOM().catch(console.error);
