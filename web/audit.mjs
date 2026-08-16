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

const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3cWpxcG9oZ2t4ZWtxaWxob3RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NTUwNjMsImV4cCI6MjA5ODEzMTA2M30.TcHTzdlNlUHuFKKeaX2ws8fLqRRZZRmPcDC36ZqnrNo";

const BASE_URL = "http://localhost:5173";
const SCREENSHOTS_DIR = "/tmp/audit_screenshots";
const RESULTS_FILE = "/tmp/audit_results.json";

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runAudit() {
  const browser = await chromium.launch({ headless: true });

  const results = {
    timestamp: new Date().toISOString(),
    grid: {}, // city -> section -> status
    errors: [], // collected console errors
    details: [], // per-city notes
  };

  // Initialize grid
  for (const city of CITIES) {
    results.grid[city] = {};
    for (const section of SECTIONS) {
      results.grid[city][section.id] = "unknown";
    }
  }

  for (const city of CITIES) {
    console.log(`\n=== Testing ${city} ===`);
    const cityErrors = [];
    const cityDetails = {
      city,
      sections: {},
    };

    const page = await browser.newPage();

    // Collect console errors for this city
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        cityErrors.push({
          city,
          message: msg.text(),
          location: msg.location(),
        });
      }
    });

    // Collect unhandled exceptions
    page.on("pageerror", (error) => {
      cityErrors.push({
        city,
        error: error.toString(),
        type: "pageerror",
      });
    });

    try {
      // Load app and wait for full page load
      await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 20000 });

      // Wait for React to render - look for the city select
      let attempts = 0;
      while (attempts < 10) {
        const select = await page.$('select[data-tour="city"]');
        if (select) break;
        await page.waitForTimeout(500);
        attempts++;
      }

      // Select the target city
      await page.selectOption('select[data-tour="city"]', city);
      await page.waitForTimeout(2500); // Let the city change settle

      // Test each section
      for (const section of SECTIONS) {
        try {
          console.log(`  Testing section: ${section.label}`);

          // Click the section button by looking for the button containing the section label
          const sectionBtn = page.locator(
            `button:has-text("${section.label}")`
          );
          if (await sectionBtn.first().isVisible({ timeout: 2000 })) {
            await sectionBtn.first().click();
            await page.waitForTimeout(2000); // Wait for section to load

            // Check for content or error states
            let status = "unknown";
            let hasChart = false;
            let hasError = false;
            let hasEmptyState = false;

            // Generic checks for content
            const mainContent = page.locator("main, [role='main'], .panel");
            if (await mainContent.count() > 0) {
              const text = await mainContent.first().textContent();
              if (text && text.toLowerCase().includes("couldn't load")) {
                status = "error-load";
                hasError = true;
              } else if (
                text &&
                (text.toLowerCase().includes("no data") ||
                  text.toLowerCase().includes("empty") ||
                  text.toLowerCase().includes("not available"))
              ) {
                status = "empty-state";
                hasEmptyState = true;
              } else if (
                text &&
                text.trim().length > 50 &&
                !text.includes("undefined")
              ) {
                status = "ok";
              } else {
                status = "no-content";
              }
            }

            // Check for SVG chart (common pattern)
            const chartCount = await page.locator("svg").count();
            if (chartCount > 5) {
              hasChart = true;
              if (status === "unknown") status = "ok-chart";
            }

            // Take screenshot for Forecast section
            if (section.id === "forecast") {
              const screenshotPath = path.join(
                SCREENSHOTS_DIR,
                `${city}-forecast.png`
              );
              await page.screenshot({ path: screenshotPath });
              cityDetails.sections[section.id] = {
                status,
                hasChart,
                hasError,
                hasEmptyState,
                screenshot: screenshotPath,
              };
            } else {
              cityDetails.sections[section.id] = {
                status,
                hasChart,
                hasError,
                hasEmptyState,
              };
            }

            results.grid[city][section.id] = status;
            console.log(`    ${section.label}: ${status}`);
          } else {
            console.warn(`Section button not visible for ${section.id}`);
            results.grid[city][section.id] = "button-not-found";
          }
        } catch (err) {
          console.error(`Error testing ${section.id}: ${err.message}`);
          results.grid[city][section.id] = `error: ${err.message.substring(0, 40)}`;
          cityErrors.push({
            city,
            section: section.id,
            error: err.toString(),
          });
        }
      }
    } catch (err) {
      console.error(`Error loading city ${city}: ${err.message}`);
      results.details.push({
        city,
        error: err.toString(),
        sections: {},
      });
    } finally {
      if (cityErrors.length > 0) {
        results.errors.push(...cityErrors);
      }
      if (Object.keys(cityDetails.sections).length > 0) {
        results.details.push(cityDetails);
      }
      await page.close();
    }
  }

  await browser.close();

  // Save results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\n=== Audit Complete ===`);
  console.log(`Results saved to: ${RESULTS_FILE}`);
  console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);

  // Print summary grid
  console.log("\n=== City × Section Grid ===");
  console.log("City \\ Section | " + SECTIONS.map((s) => s.label.substring(0, 8)).join(" | "));
  console.log("-".repeat(80));
  for (const city of CITIES) {
    const row = SECTIONS.map((s) => {
      const status = results.grid[city][s.id];
      if (status === "ok" || status === "ok-chart") return "✓";
      if (status.includes("error")) return "✗";
      if (status === "empty-state") return "∅";
      return "?";
    }).join(" | ");
    console.log(`${city.padEnd(15)} | ${row}`);
  }

  // Print errors
  if (results.errors.length > 0) {
    console.log("\n=== Console Errors Found ===");
    results.errors.forEach((err) => {
      console.log(`${err.city}${err.section ? ` (${err.section})` : ""}: ${err.message || err.error}`);
    });
  }
}

runAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
