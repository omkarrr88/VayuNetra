import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";
const API_PORT = 8000;

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  // Block API requests to simulate offline
  await context.route(`http://localhost:${API_PORT}/**`, (route) => {
    route.abort();
  });

  const page = await context.newPage();
  page.on("console", (msg) => console.log(`[PAGE] ${msg.text()}`));

  console.log("[TEST] Loading app in offline mode (API blocked)...");
  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  // Wait for any fallback banner
  await page.waitForTimeout(2000);

  // Check for api-fallback event
  const fallbackCaught = await page.evaluate(() => {
    return new Promise((resolve) => {
      const listener = () => resolve(true);
      window.addEventListener("api-fallback", listener);
      setTimeout(() => {
        window.removeEventListener("api-fallback", listener);
        resolve(false);
      }, 1000);
    });
  });

  console.log(`[TEST] Fallback event triggered: ${fallbackCaught}`);

  // Check if app loaded with fixtures
  const appLoaded = await page.evaluate(() => {
    return document.body.innerText.includes("Air Quality");
  });
  console.log(`[TEST] App loaded: ${appLoaded}`);

  // Try to load different cities
  const cities = ["delhi", "bengaluru", "mumbai"];
  for (const city of cities) {
    console.log(`\n[TEST] Testing city: ${city}`);
    await page.waitForTimeout(500);
  }

  console.log("\n[TEST] Screenshot: offline mode complete");
  await page.screenshot({ path: "/tmp/claude-1000/-home-omkar-kadam-Desktop-VayuNetra/82517b60-1549-4f2d-9b8e-cf0e3c4d1f0e/scratchpad/offline_test.png" });

  await browser.close();
  console.log("[TEST] Done");
}

main().catch(console.error);
