import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";
const API_PORT = 8000;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log("[TEST] Loading app with API available...");
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  console.log("[TEST] App loaded successfully");

  // Now block API
  console.log("[TEST] Blocking API requests...");
  await page.context().route(`http://localhost:${API_PORT}/**`, (route) => {
    route.abort();
  });

  // Try to trigger an API call (simulate clicking what-if)
  console.log("[TEST] Triggering API call after blocking...");
  const hasWhatIfButton = await page.locator("text=/What.*[Ii]f/").isVisible().catch(() => false);
  console.log(`[TEST] What-if button found: ${hasWhatIfButton}`);

  if (hasWhatIfButton) {
    await page.click("text=/What.*[Ii]f/");
    await page.waitForTimeout(500);
  }

  // Check for fallback event
  const fallbackFired = await page.evaluate(() => {
    return new Promise((resolve) => {
      let fired = false;
      const listener = () => {
        fired = true;
        resolve(true);
      };
      window.addEventListener("api-fallback", listener);
      setTimeout(() => {
        window.removeEventListener("api-fallback", listener);
        resolve(fired);
      }, 2000);
    });
  });

  console.log(`[TEST] Fallback event fired: ${fallbackFired}`);

  // Check if page still rendered
  const pageContent = await page.evaluate(() => document.body.innerText);
  console.log(`[TEST] Page content length: ${pageContent.length}`);
  console.log(`[TEST] Page content sample: ${pageContent.substring(0, 100)}`);

  // Test each city endpoint
  console.log("\n[TEST] Testing cities...");
  const cities = ["delhi", "bengaluru", "mumbai", "hyderabad"];

  for (const city of cities) {
    const result = await page.evaluate(async (c) => {
      try {
        // This will trigger the API call with fallback
        const res = await fetch(`http://localhost:8000/cities`, {
          headers: { Authorization: "Bearer dummy" }
        });
        return { status: res.status, ok: res.ok };
      } catch (err) {
        return { error: err.message };
      }
    }, city);
    console.log(`  ${city}: ${JSON.stringify(result)}`);
  }

  await browser.close();
  console.log("[TEST] Done");
}

main().catch(console.error);
