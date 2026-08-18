import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Loading page...");
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
  
  console.log("Waiting 3 seconds...");
  await page.waitForTimeout(3000);
  
  console.log("Checking for select element...");
  const select = await page.$('select[data-tour="city"]');
  console.log("Select found:", !!select);
  
  if (!select) {
    console.log("Trying broader selector...");
    const anySelect = await page.$('select');
    console.log("Any select found:", !!anySelect);
  }
  
  console.log("All selects on page:");
  const allSelects = await page.$$('select');
  console.log(`Found ${allSelects.length} select elements`);
  
  // Get body HTML
  const html = await page.content();
  console.log("Page title:", await page.title());
  console.log("First 3000 chars of page HTML:");
  console.log(html.substring(0, 3000));
  
  await browser.close();
}

debug().catch(console.error);
