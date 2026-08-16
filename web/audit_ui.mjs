/**
 * UI audit using Playwright — checks for errors, data loading issues, city switching.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const FRONTEND_URL = 'http://localhost:5173';
const findings = [];
const checks = [];

function check(name, passed, severity = 'HIGH', details = '') {
  checks.push({ name, passed, severity, details });
  if (!passed) {
    findings.push({ severity, category: name, message: details });
  }
}

async function runAudit() {
  console.log('=== VayuNetra UI Audit: Error Detection & City Switching ===\n');

  const browser = await chromium.launch();

  // Capture console messages
  const logs = { error: [], warn: [], info: [] };
  const errors = [];

  try {
    const page = await browser.newPage();

    page.on('console', msg => {
      const args = msg.args();
      const type = msg.type();
      logs[type]?.push(msg.text());

      if (type === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('response', async response => {
      if (response.status() >= 500) {
        findings.push({
          severity: 'CRITICAL',
          category: 'server_error',
          message: `HTTP ${response.status()} from ${response.url()}`,
        });
      }
    });

    console.log('Loading home page...');
    await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'networkidle', timeout: 10000 });

    // Wait for initial data load
    await page.waitForTimeout(2000);

    // Check for console errors
    if (errors.length > 0) {
      console.log(`  ✗ ${errors.length} console errors detected`);
      for (const err of errors.slice(0, 3)) {
        findings.push({
          severity: 'HIGH',
          category: 'console_error',
          message: err.slice(0, 100),
        });
      }
    } else {
      console.log('  ✓ No console errors on load');
    }

    check('No console errors on load', errors.length === 0, 'HIGH', `${errors.length} errors`);

    // Try to navigate to different cities
    console.log('\nTesting city switching...');
    const cities = ['hyderabad', 'chennai', 'lucknow'];

    for (const city of cities) {
      console.log(`  Testing ${city}...`);
      const beforeErrors = errors.length;

      try {
        await page.goto(`${FRONTEND_URL}/?city=${city}`, { waitUntil: 'networkidle', timeout: 10000 });
        await page.waitForTimeout(1500);

        const newErrors = errors.length - beforeErrors;
        if (newErrors > 0) {
          console.log(`    ✗ ${newErrors} new errors`);
          check(`${city} loads without errors`, false, 'HIGH', `${newErrors} errors`);
        } else {
          console.log(`    ✓ Loaded without errors`);
          check(`${city} loads without errors`, true, 'HIGH');
        }
      } catch (err) {
        console.log(`    ✗ Navigation failed: ${err.message}`);
        findings.push({
          severity: 'HIGH',
          category: 'navigation_error',
          message: `${city}: ${err.message}`,
        });
      }
    }

    // Check if data appears on the page
    console.log('\nChecking data on page...');
    try {
      const hasAQIData = await page.locator('[data-testid="aqi"], .aqi, [class*="aqi"]').count() > 0
        || await page.textContent('body').then(t => /\d+/.test(t) && t.length > 500);

      check('Page contains data', hasAQIData, 'HIGH');
      if (hasAQIData) {
        console.log('  ✓ Data visible on page');
      } else {
        console.log('  ⚠ No obvious data elements found (might be rendered dynamically)');
      }
    } catch (err) {
      console.log(`  ⚠ Could not verify data: ${err.message}`);
    }

    // Check main layout elements
    console.log('\nVerifying UI structure...');
    const bodyContent = await page.textContent('body');
    check('Page has content', bodyContent.length > 100, 'HIGH');

    // Check for specific expected text
    const expectedTexts = ['Air Quality', 'aqi', 'delhi', 'advisory'];
    for (const text of expectedTexts) {
      const found = bodyContent.toLowerCase().includes(text.toLowerCase());
      check(`Page mentions "${text}"`, found, 'MEDIUM');
    }

    // Test API calls from browser
    console.log('\nMonitoring API calls...');
    const apiCalls = [];
    page.on('request', req => {
      if (req.url().includes('localhost:8000')) {
        apiCalls.push({ url: req.url(), method: req.method() });
      }
    });

    // Navigate back to home
    await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    if (apiCalls.length > 0) {
      console.log(`  ✓ ${apiCalls.length} API calls made from frontend`);
      check('Frontend makes API calls', true, 'HIGH');

      // Group by endpoint
      const byEndpoint = {};
      for (const call of apiCalls) {
        const url = new URL(call.url);
        const path = url.pathname;
        byEndpoint[path] = (byEndpoint[path] || 0) + 1;
      }

      console.log('  Endpoints called:');
      for (const [endpoint, count] of Object.entries(byEndpoint).sort()) {
        console.log(`    ${endpoint}: ${count}x`);
      }
    } else {
      console.log('  ✗ No API calls detected from frontend');
      findings.push({
        severity: 'HIGH',
        category: 'no_api_calls',
        message: 'Frontend did not make any API calls',
      });
    }

    await page.close();
  } catch (err) {
    console.error('Audit error:', err);
    findings.push({
      severity: 'HIGH',
      category: 'audit_error',
      message: err.message,
    });
  } finally {
    await browser.close();
  }

  // Results
  console.log('\n=== CHECK RESULTS ===\n');
  const passed = checks.filter(c => c.passed).length;
  const total = checks.length;
  console.log(`Passed: ${passed}/${total} checks`);

  if (checks.filter(c => !c.passed).length > 0) {
    console.log('\nFailed checks:\n');
    for (const c of checks.filter(c => !c.passed)) {
      console.log(`  [${c.severity}] ${c.name}`);
      if (c.details) console.log(`    ${c.details}`);
    }
  }

  console.log('\n=== FINDINGS ===\n');
  if (findings.length === 0) {
    console.log('✓ No critical issues detected.');
  } else {
    const bySeverity = {};
    for (const f of findings) {
      if (!bySeverity[f.severity]) bySeverity[f.severity] = [];
      bySeverity[f.severity].push(f);
    }
    for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
      if (!bySeverity[severity]?.length) continue;
      console.log(`[${severity}] ${bySeverity[severity].length} issues\n`);
      for (const f of bySeverity[severity]) {
        console.log(`  ${f.category}: ${f.message}`);
      }
      console.log();
    }
  }

  // Log analysis
  console.log('=== LOG SUMMARY ===\n');
  console.log(`Console errors: ${logs.error.length}`);
  console.log(`Console warnings: ${logs.warn.length}`);
  if (logs.error.length > 0) {
    console.log('\nFirst 3 errors:');
    for (const err of logs.error.slice(0, 3)) {
      console.log(`  - ${err.slice(0, 80)}`);
    }
  }

  // Save report
  const reportDir = '/tmp/claude-1000/-home-omkar-kadam-Desktop-VayuNetra/82517b60-1549-4f2d-9b8e-cf0e3c4d1f0e/scratchpad';
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'audit_ui.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    checks,
    findings,
    logs,
  }, null, 2));

  console.log(`\n✓ UI audit report: ${reportPath}`);
}

runAudit().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
