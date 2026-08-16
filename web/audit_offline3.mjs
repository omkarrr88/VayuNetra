import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";
const API_PORT = 8000;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log("[TEST] Loading console with API available...");
  await page.goto(`${BASE_URL}/console`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  console.log("[TEST] Console loaded successfully");

  // Now block API
  console.log("[TEST] Blocking API requests...");
  await page.context().route(`http://localhost:${API_PORT}/**`, (route) => {
    route.abort();
  });

  // Check for fallback event
  let fallbackFired = false;
  page.on("console", (msg) => {
    if (msg.text().includes("fallback")) {
      console.log(`[PAGE LOG] ${msg.text()}`);
    }
  });

  // Try to switch cities or trigger a new API call
  console.log("[TEST] Navigating to different city...");

  // Find and click a city button
  const cityButtons = await page.locator("[data-testid*='city']").all().catch(() => []);
  console.log(`[TEST] Found ${cityButtons.length} city elements`);

  if (cityButtons.length > 0) {
    await cityButtons[1].click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Listen for fallback event
  fallbackFired = await page.evaluate(() => {
    return new Promise((resolve) => {
      let fired = false;
      const listener = () => {
        fired = true;
      };
      window.addEventListener("api-fallback", listener);
      // Trigger a new /cities fetch
      fetch("http://localhost:8000/cities", { headers: { Authorization: "Bearer x" } }).catch(() => {});
      setTimeout(() => {
        window.removeEventListener("api-fallback", listener);
        resolve(fired);
      }, 3000);
    });
  });

  console.log(`[TEST] Fallback event fired after API block: ${fallbackFired}`);

  // Check page content
  const pageHasContent = await page.evaluate(() => {
    return document.body.innerText.length > 1000;
  });
  console.log(`[TEST] Page has substantial content: ${pageHasContent}`);

  await browser.close();
  console.log("[TEST] Done");
}

main().catch(console.error);
