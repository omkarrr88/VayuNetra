#!/usr/bin/env node
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const CITIES = [
  "delhi",
  "bengaluru",
  "mumbai",
  "hyderabad",
  "chennai",
  "kolkata",
  "pune",
  "ahmedabad",
  "jaipur",
  "lucknow",
];

const SECTIONS = [
  { id: "action", label: "Enforcement" },
  { id: "forecast", label: "Forecast" },
  { id: "citizen", label: "Advisories" },
  { id: "compare", label: "Cities" },
  { id: "whatif", label: "Simulator" },
  { id: "impact", label: "Impact" },
  { id: "pipeline", label: "Pipeline" },
];

const BASE_URL = "http://localhost:5173";
const RESULTS_FILE = "/tmp/audit_results_fast.json";
const SCREENSHOTS_DIR = "/tmp/audit_screenshots";

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runAudit() {
  const browser = await chromium.launch({ headless: true });

  const results = {
    timestamp: new Date().toISOString(),
    grid: {},
    errors: [],
  };

  for (const city of CITIES) {
    results.grid[city] = {};
    for (const section of SECTIONS) {
      results.grid[city][section.id] = "unknown";
    }
  }

  for (let cityIndex = 0; cityIndex < CITIES.length; cityIndex++) {
    const city = CITIES[cityIndex];
    console.log(`[${cityIndex + 1}/${CITIES.length}] Testing ${city}...`);
    const cityErrors = [];

    const page = await browser.newPage();

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        cityErrors.push({ city, type: "console", text: msg.text() });
      }
    });

    page.on("pageerror", (error) => {
      cityErrors.push({ city, type: "pageerror", text: error.toString() });
    });

    try {
      // Load app with longer timeout
      console.log("  Loading app...");
      await page.goto(BASE_URL, {
        waitUntil: "networkidle",
        timeout: 25000,
      });

      // Wait for city select to appear
      let selectFound = false;
      for (let i = 0; i < 15; i++) {
        if (await page.$('select[data-tour="city"]')) {
          selectFound = true;
          break;
        }
        await page.waitForTimeout(300);
      }

      if (!selectFound) {
        console.log("  ERROR: City select not found after 4.5 seconds");
        results.errors.push({
          city,
          error: "City select element never appeared",
        });
        await page.close();
        continue;
      }

      console.log("  Selecting city...");
      await page.selectOption('select[data-tour="city"]', city);
      await page.waitForTimeout(2000);

      // Now test each section
      for (let sectionIndex = 0; sectionIndex < SECTIONS.length; sectionIndex++) {
        const section = SECTIONS[sectionIndex];
        process.stdout.write(
          `    [${sectionIndex + 1}/${SECTIONS.length}] ${section.label}... `
        );

        try {
          // Click section button
          const sectionBtn = page.locator(`button:has-text("${section.label}")`);
          const visible = await sectionBtn.first().isVisible({ timeout: 2000 });

          if (!visible) {
            console.log("button not found");
            results.grid[city][section.id] = "button-not-found";
            continue;
          }

          await sectionBtn.first().click();
          await page.waitForTimeout(2000);

          // Check for content
          let status = "no-content";
          let foundChart = false;

          // Look for actual panel content
          const panels = await page.$$(
            "main, [role='main'], [role='region'], .panel"
          );
          if (panels.length > 0) {
            const text = await panels[0].textContent();
            if (text && text.includes("Couldn't load")) {
              status = "error-load";
            } else if (
              text &&
              (text.toLowerCase().includes("no data") ||
                text.toLowerCase().includes("not available") ||
                text.toLowerCase().includes("empty"))
            ) {
              status = "empty-state";
            } else if (text && text.trim().length > 30) {
              status = "ok";
            }
          }

          // Check for charts (SVG)
          const svgCount = await page.$$eval("svg", (svgs) =>
            svgs.filter((svg) => svg.getAttribute("viewBox")).length
          );
          if (svgCount > 3) {
            foundChart = true;
            if (status === "no-content") status = "ok-chart";
          }

          // Take screenshot for forecast
          if (section.id === "forecast") {
            const screenshotPath = path.join(
              SCREENSHOTS_DIR,
              `${city}-forecast.png`
            );
            await page.screenshot({ path: screenshotPath });
            console.log(`ok (screenshot saved)`);
          } else {
            console.log(status);
          }

          results.grid[city][section.id] = status;
        } catch (err) {
          console.log(`error: ${err.message.substring(0, 30)}`);
          results.grid[city][section.id] = `error`;
          cityErrors.push({
            city,
            section: section.id,
            error: err.message.substring(0, 100),
          });
        }
      }
    } catch (err) {
      console.log(`  ERROR: ${err.message.substring(0, 60)}`);
      results.errors.push({
        city,
        error: err.message.substring(0, 200),
      });
    } finally {
      if (cityErrors.length > 0) {
        results.errors.push(...cityErrors);
      }
      await page.close();
    }
  }

  await browser.close();

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\n=== Audit Complete ===`);
  console.log(`Results: ${RESULTS_FILE}`);

  // Print grid
  console.log("\n=== City × Section Grid ===");
  console.log(
    "City        | " +
      SECTIONS.map((s) => s.label.substring(0, 9).padEnd(9))
        .join(" | ")
  );
  console.log("-".repeat(100));
  for (const city of CITIES) {
    const symbols = SECTIONS.map((s) => {
      const status = results.grid[city][s.id];
      if (status === "ok" || status === "ok-chart") return "✓";
      if (status.includes("error")) return "✗";
      if (status === "empty-state") return "∅";
      if (status === "no-content") return "○";
      return "?";
    }).join("  ");
    console.log(city.padEnd(11) + " | " + symbols);
  }

  // Print errors
  if (results.errors.length > 0) {
    console.log(`\n=== Errors (${results.errors.length}) ===`);
    results.errors.slice(0, 20).forEach((err) => {
      if (err.section) {
        console.log(`${err.city}/${err.section}: ${err.error || err.text}`);
      } else {
        console.log(`${err.city}: ${err.error}`);
      }
    });
    if (results.errors.length > 20) {
      console.log(`... and ${results.errors.length - 20} more errors`);
    }
  }
}

runAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
