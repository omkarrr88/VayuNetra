/**
 * Deep audit: data integrity, envelope structure, latency, and edge cases.
 */

import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:8000';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3cWpxcG9oZ2t4ZWtxaWxob3RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NTUwNjMsImV4cCI6MjA5ODEzMTA2M30.TcHTzdlNlUHuFKKeaX2ws8fLqRRZZRmPcDC36ZqnrNo';

const findings = [];
const checks = [];

async function call(path, queryParams = {}, bodyData = null) {
  const url = new URL(path, API_BASE);
  Object.entries(queryParams).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.append(k, v);
  });

  const headers = { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };
  const opts = { headers };

  if (bodyData) {
    headers['Content-Type'] = 'application/json';
    opts.method = 'POST';
    opts.body = JSON.stringify(bodyData);
  }

  const t0 = performance.now();
  const response = await fetch(url.toString(), opts);
  const latency_ms = Math.round(performance.now() - t0);
  const data = await response.json();
  return { status: response.status, data, latency_ms };
}

function check(name, passed, severity = 'HIGH', details = '') {
  checks.push({ name, passed, severity, details });
  if (!passed) {
    findings.push({ severity, category: name, message: details });
  }
}

async function runAudit() {
  console.log('=== Deep API Audit: Integrity & Latency ===\n');

  // 1. Envelope structure validation
  console.log('Testing envelope structure...');
  const resp1 = await call('/aqi/current', { city: 'delhi' });
  check(
    'Envelope has success field',
    typeof resp1.data.success === 'boolean',
    'CRITICAL',
    resp1.data.success === undefined ? 'Missing success field' : ''
  );
  check(
    'Envelope has data field',
    'data' in resp1.data,
    'CRITICAL',
    !('data' in resp1.data) ? 'Missing data field' : ''
  );
  check(
    'Envelope has error field (even if null)',
    'error' in resp1.data,
    'HIGH',
    !('error' in resp1.data) ? 'Missing error field' : ''
  );
  check(
    'Envelope has meta field (optional but recommended)',
    'meta' in resp1.data,
    'MEDIUM',
    !('meta' in resp1.data) ? 'Missing meta field' : ''
  );
  check(
    'error is null on success',
    resp1.data.success === true && resp1.data.error === null,
    'HIGH',
    resp1.data.success && resp1.data.error ? `error should be null on success, got: ${resp1.data.error}` : ''
  );

  // 2. Data type consistency
  console.log('Testing data types...');
  const aqi = await call('/aqi/current', { city: 'delhi' });
  if (Array.isArray(aqi.data.data)) {
    const sample = aqi.data.data[0];
    if (sample) {
      check('AQI cells have h3_cell', !!sample.h3_cell, 'MEDIUM');
      check('AQI cells have pm25 numeric', typeof sample.pm25 === 'number', 'MEDIUM');
      check('AQI cells have ts timestamp', !!sample.ts, 'MEDIUM');
      check('AQI cells have confidence', sample.confidence !== undefined, 'LOW');
    }
  }

  const forecast = await call('/forecast', { city: 'delhi' });
  if (Array.isArray(forecast.data.data) && forecast.data.data[0]) {
    const sample = forecast.data.data[0];
    check('Forecast has h3_cell', !!sample.h3_cell, 'MEDIUM');
    check('Forecast has value numeric', typeof sample.value === 'number', 'MEDIUM');
    check('Forecast has horizon_h', sample.horizon_h !== undefined, 'MEDIUM');
    check('Forecast has model_version', !!sample.model_version, 'LOW');
  }

  // 3. Latency check
  console.log('Testing latency...');
  const latencies = {};
  for (const city of ['delhi', 'hyderabad', 'chennai', 'lucknow']) {
    const resp = await call('/aqi/current', { city });
    latencies[city] = resp.latency_ms;
  }
  const avgLatency = Object.values(latencies).reduce((a, b) => a + b, 0) / Object.keys(latencies).length;
  check(
    'Average latency < 1000ms',
    avgLatency < 1000,
    'MEDIUM',
    `Average: ${Math.round(avgLatency)}ms, range: ${Math.min(...Object.values(latencies))}-${Math.max(...Object.values(latencies))}ms`
  );
  for (const [city, lat] of Object.entries(latencies)) {
    check(
      `${city} latency < 2000ms`,
      lat < 2000,
      'MEDIUM',
      lat >= 2000 ? `${city}: ${lat}ms` : ''
    );
  }

  // 4. Empty state handling
  console.log('Testing edge cases...');
  const emptyReports = await call('/reports', { city: 'lucknow', limit: 1 });
  check(
    'Empty reports returns valid envelope',
    emptyReports.status === 200 && emptyReports.data.success === true,
    'HIGH'
  );

  // 5. Multi-city consistency
  console.log('Testing multi-city consistency...');
  const cities = await call('/cities', {});
  if (Array.isArray(cities.data.data)) {
    check(
      'Cities has at least 10 entries',
      cities.data.data.length >= 10,
      'HIGH',
      `Found ${cities.data.data.length} cities`
    );

    // Check each city config is valid
    for (const city of cities.data.data.slice(0, 5)) {
      const id = city.city_id || city.name;
      if (!id) {
        findings.push({
          severity: 'MEDIUM',
          category: 'city_structure',
          message: 'City entry missing city_id or name',
        });
      }
    }
  }

  // 6. Comparison multi-city integrity
  console.log('Testing comparison endpoint...');
  const comp = await call('/comparison', {});
  if (comp.data.data?.cities) {
    check(
      'Comparison includes 10 cities',
      comp.data.data.cities.length >= 10,
      'HIGH',
      `Found ${comp.data.data.cities.length} cities in comparison`
    );
  }

  // 7. Language support
  console.log('Testing language variants...');
  const advisoryEn = await call('/advisory', { city: 'delhi', lang: 'en' });
  const advisoryHi = await call('/advisory', { city: 'delhi', lang: 'hi' });
  check(
    'Advisory exists in English',
    Array.isArray(advisoryEn.data.data) && advisoryEn.data.data.length >= 0,
    'HIGH'
  );
  check(
    'Advisory exists in Hindi',
    Array.isArray(advisoryHi.data.data) && advisoryHi.data.data.length >= 0,
    'HIGH'
  );

  // 8. POST endpoints return valid responses
  console.log('Testing POST endpoints...');
  const simulate = await call('/simulate', {}, { city: 'delhi', intervention_type: 'construction_halt', horizon_h: 24 });
  check(
    'Simulate returns envelope',
    simulate.status < 400 && simulate.data.success === true,
    'CRITICAL'
  );

  const optimize = await call('/optimize', {}, { city: 'delhi', budget_inspector_hours: 20, horizon_h: 24 });
  check(
    'Optimize returns envelope',
    optimize.status < 400 && optimize.data.success === true,
    'CRITICAL'
  );

  // 9. Agent query endpoint
  console.log('Testing agent query...');
  const agent = await call('/agent/query', {}, { city: 'delhi', query: 'test' });
  check(
    'Agent query returns envelope',
    agent.status < 400 && agent.data.success === true,
    'HIGH',
    agent.status >= 400 ? `HTTP ${agent.status}` : ''
  );

  // 10. CSV export format
  console.log('Testing CSV export...');
  const exportUrl = `${API_BASE}/interventions/export?city=delhi`;
  try {
    const resp = await fetch(exportUrl, {
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const csv = await resp.text();
    const isCSV = csv.includes('city,') && csv.includes('\n');
    check(
      'CSV export has correct format',
      isCSV,
      'HIGH',
      !isCSV ? 'CSV missing expected header or newlines' : ''
    );
  } catch (err) {
    findings.push({
      severity: 'HIGH',
      category: 'csv_export',
      message: `Export fetch failed: ${err.message}`,
    });
  }

  // Print results
  console.log('\n=== CHECK RESULTS ===\n');
  const passed = checks.filter(c => c.passed).length;
  const total = checks.length;
  console.log(`Passed: ${passed}/${total} checks\n`);

  const byPassed = { true: [], false: [] };
  for (const c of checks) {
    byPassed[c.passed].push(c);
  }

  if (byPassed[false].length > 0) {
    console.log('Failed checks:\n');
    for (const c of byPassed[false]) {
      console.log(`  [${c.severity}] ${c.name}`);
      if (c.details) console.log(`    ${c.details}`);
    }
  }

  console.log('\n=== FINDINGS ===\n');
  if (findings.length === 0) {
    console.log('✓ No critical issues.');
  } else {
    const bySeverity = {};
    for (const f of findings) {
      if (!bySeverity[f.severity]) bySeverity[f.severity] = [];
      bySeverity[f.severity].push(f);
    }
    for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
      if (!bySeverity[severity]) continue;
      console.log(`[${severity}] ${bySeverity[severity].length} issues\n`);
      for (const f of bySeverity[severity]) {
        console.log(`  ${f.category}: ${f.message}`);
      }
      console.log();
    }
  }

  // Save
  const reportDir = '/tmp/claude-1000/-home-omkar-kadam-Desktop-VayuNetra/82517b60-1549-4f2d-9b8e-cf0e3c4d1f0e/scratchpad';
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'audit_deep.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    checks,
    findings,
    latencies,
  }, null, 2));

  console.log(`✓ Deep audit report: ${reportPath}`);
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
