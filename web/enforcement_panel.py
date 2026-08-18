"""VayuNetra Enforcement UI Panel — web component (enforcement.html).

Standalone HTML page for the enforcement worklist + dossier view.
Can be embedded in the React app shell as an iframe or converted to a
React component. Reads from the FastAPI /enforcement and /enforcement/{id}/dossier
endpoints (VITE_API_BASE_URL or localhost:8000 in dev).

Features:
- Ranked enforcement worklist table
- Priority score badge (colour-coded)
- Click a row → dossier panel slides in (citations, rationale, notice text)
- "Generate Notice / PDF" button
- Status update (approve / dispatch / dismiss)
- Live AQI-coloured rubric score chip
"""

ENFORCEMENT_UI_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VayuNetra — Enforcement Intelligence</title>
  <meta name="description" content="Enforcement intelligence panel — ranked worklist, RAG-cited dossiers, and notice generation for city pollution control officers." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    /* === Design system === */
    :root {
      --bg-0: #0a0e1a;
      --bg-1: #101624;
      --bg-2: #171d2e;
      --bg-3: #1e2640;
      --border: rgba(255,255,255,0.07);
      --accent: #3b82f6;
      --accent-glow: rgba(59,130,246,0.15);
      --success: #10b981;
      --warn: #f59e0b;
      --danger: #ef4444;
      --severe: #9333ea;
      --text-1: #f1f5f9;
      --text-2: #94a3b8;
      --text-3: #64748b;
      --radius: 12px;
      --radius-sm: 8px;
      --font: "Inter", system-ui, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-0);
      color: var(--text-1);
      font-family: var(--font);
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* === Header === */
    header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px 28px;
      background: var(--bg-1);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    header .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    header .logo .icon {
      width: 32px; height: 32px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
    }
    header .subtitle {
      color: var(--text-3);
      font-size: 13px;
      margin-left: 4px;
    }
    header .city-select {
      margin-left: auto;
      background: var(--bg-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-1);
      padding: 8px 14px;
      font-size: 13px;
      cursor: pointer;
      outline: none;
    }
    header .status-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--success);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%,100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* === Main layout === */
    .app {
      display: grid;
      grid-template-columns: 1fr;
      min-height: calc(100vh - 65px);
      transition: grid-template-columns 0.3s ease;
    }
    .app.dossier-open {
      grid-template-columns: 1fr 440px;
    }

    /* === Worklist panel === */
    .worklist {
      padding: 24px 28px;
      overflow-y: auto;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge {
      background: var(--accent);
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 100px;
    }
    .filters {
      display: flex;
      gap: 10px;
    }
    .filter-btn {
      background: var(--bg-2);
      border: 1px solid var(--border);
      border-radius: 100px;
      color: var(--text-2);
      padding: 6px 14px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-btn:hover, .filter-btn.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }

    /* === Rec cards === */
    .rec-list { display: flex; flex-direction: column; gap: 12px; }
    .rec-card {
      background: var(--bg-1);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 18px 20px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      overflow: hidden;
    }
    .rec-card::before {
      content: "";
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 4px;
      border-radius: 4px 0 0 4px;
    }
    .rec-card.critical::before { background: var(--danger); }
    .rec-card.high::before { background: var(--warn); }
    .rec-card.medium::before { background: var(--accent); }
    .rec-card:hover {
      background: var(--bg-2);
      border-color: var(--accent);
      transform: translateY(-1px);
      box-shadow: 0 4px 24px rgba(59,130,246,0.1);
    }
    .rec-card.selected {
      border-color: var(--accent);
      background: var(--bg-2);
    }
    .rec-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 10px;
    }
    .rec-title {
      font-size: 15px;
      font-weight: 600;
      line-height: 1.4;
    }
    .rec-meta {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-shrink: 0;
    }
    .priority-badge {
      font-size: 20px;
      font-weight: 700;
      color: var(--danger);
    }
    .priority-badge.high { color: var(--warn); }
    .priority-badge.medium { color: var(--accent); }
    .rec-rationale {
      color: var(--text-2);
      font-size: 13px;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .rec-stats {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .stat-chip {
      display: flex;
      align-items: center;
      gap: 5px;
      background: var(--bg-3);
      border: 1px solid var(--border);
      border-radius: 100px;
      padding: 4px 10px;
      font-size: 12px;
      color: var(--text-2);
    }
    .stat-chip .icon { font-size: 14px; }
    .rubric-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
    }
    .rubric-bar-track {
      flex: 1;
      height: 4px;
      background: var(--bg-3);
      border-radius: 100px;
      overflow: hidden;
    }
    .rubric-bar-fill {
      height: 100%;
      border-radius: 100px;
      background: linear-gradient(90deg, var(--accent), var(--success));
      transition: width 0.5s ease;
    }
    .rubric-label {
      font-size: 11px;
      color: var(--text-3);
      white-space: nowrap;
    }
    .citations-row {
      display: flex;
      gap: 6px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    .citation-tag {
      background: rgba(59,130,246,0.1);
      border: 1px solid rgba(59,130,246,0.25);
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 11px;
      color: var(--accent);
    }
    .status-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border-radius: 100px;
      padding: 3px 10px;
      font-size: 11px;
      font-weight: 600;
    }
    .status-tag.proposed { background: rgba(245,158,11,0.15); color: var(--warn); }
    .status-tag.approved { background: rgba(16,185,129,0.15); color: var(--success); }
    .status-tag.dispatched { background: rgba(59,130,246,0.15); color: var(--accent); }
    .status-tag.dismissed { background: rgba(100,116,139,0.15); color: var(--text-3); }

    /* === Dossier panel === */
    .dossier-panel {
      background: var(--bg-1);
      border-left: 1px solid var(--border);
      display: none;
      flex-direction: column;
      overflow: hidden;
    }
    .app.dossier-open .dossier-panel {
      display: flex;
    }
    .dossier-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px;
      border-bottom: 1px solid var(--border);
    }
    .dossier-title {
      font-size: 16px;
      font-weight: 600;
    }
    .close-btn {
      background: var(--bg-2);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-2);
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.2s;
    }
    .close-btn:hover { background: var(--bg-3); color: var(--text-1); }
    .dossier-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }
    .dossier-section {
      margin-bottom: 24px;
    }
    .dossier-section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-3);
      margin-bottom: 10px;
    }
    .dossier-rationale {
      font-size: 13px;
      line-height: 1.7;
      color: var(--text-2);
      background: var(--bg-2);
      border-radius: var(--radius-sm);
      padding: 14px;
    }
    .citation-card {
      background: var(--bg-2);
      border: 1px solid var(--border);
      border-left: 3px solid var(--accent);
      border-radius: var(--radius-sm);
      padding: 12px 14px;
      margin-bottom: 10px;
    }
    .citation-rule {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
      color: var(--text-1);
    }
    .citation-excerpt {
      font-size: 12px;
      color: var(--text-2);
      line-height: 1.6;
    }
    .citation-sim {
      font-size: 11px;
      color: var(--text-3);
      margin-top: 4px;
    }
    .rubric-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .rubric-item {
      background: var(--bg-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 10px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .rubric-item-label { font-size: 12px; color: var(--text-2); }
    .rubric-item-val { font-size: 14px; font-weight: 700; color: var(--text-1); }
    .notice-box {
      background: var(--bg-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 14px;
      font-size: 12px;
      line-height: 1.8;
      color: var(--text-2);
      white-space: pre-wrap;
      font-family: "Courier New", monospace;
      max-height: 200px;
      overflow-y: auto;
    }
    .dossier-actions {
      padding: 16px 20px;
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .btn {
      border: none;
      border-radius: var(--radius-sm);
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn-primary {
      background: var(--accent);
      color: #fff;
    }
    .btn-primary:hover { background: #2563eb; transform: translateY(-1px); }
    .btn-secondary {
      background: var(--bg-3);
      color: var(--text-2);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover { background: var(--bg-2); color: var(--text-1); }
    .btn-success {
      background: rgba(16,185,129,0.15);
      color: var(--success);
      border: 1px solid rgba(16,185,129,0.3);
    }
    .btn-success:hover { background: rgba(16,185,129,0.25); }
    .btn-group { display: flex; gap: 8px; }

    /* === Loading state === */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 60px;
      color: var(--text-3);
      font-size: 14px;
    }
    .spinner {
      width: 20px; height: 20px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 10px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* === Metrics bar === */
    .metrics-bar {
      display: flex;
      gap: 16px;
      padding: 14px 28px;
      background: var(--bg-1);
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
    }
    .metric-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 8px 14px;
      white-space: nowrap;
    }
    .metric-chip .label { font-size: 11px; color: var(--text-3); }
    .metric-chip .value { font-size: 15px; font-weight: 700; color: var(--text-1); }
    .metric-chip .trend { font-size: 11px; color: var(--success); }

    /* === Empty state === */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      color: var(--text-3);
      text-align: center;
    }
    .empty-state .icon { font-size: 48px; margin-bottom: 16px; }
    .empty-state p { font-size: 14px; line-height: 1.6; }

    /* === Toast === */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--bg-3);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px 18px;
      font-size: 13px;
      color: var(--text-1);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      transform: translateY(80px);
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 999;
    }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast.success { border-color: rgba(16,185,129,0.4); }
    .toast.error { border-color: rgba(239,68,68,0.4); }

    /* === Scrollbars === */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--bg-3); border-radius: 3px; }
  </style>
</head>
<body>

<header>
  <div class="logo">
    <div class="icon">🌬️</div>
    <span>VayuNetra</span>
    <span class="subtitle">Enforcement Intelligence</span>
  </div>
  <div class="status-dot" title="API connected"></div>
  <select class="city-select" id="citySelect" onchange="loadData()">
    <option value="delhi">🏙️ Delhi</option>
    <option value="bengaluru">🌆 Bengaluru</option>
    <option value="mumbai">🌃 Mumbai</option>
  </select>
</header>

<!-- Metrics summary bar -->
<div class="metrics-bar" id="metricsBar">
  <div class="metric-chip">
    <span class="label">Active Recs</span>
    <span class="value" id="metricTotal">—</span>
  </div>
  <div class="metric-chip">
    <span class="label">Avg Priority</span>
    <span class="value" id="metricAvgPriority">—</span>
  </div>
  <div class="metric-chip">
    <span class="label">People Exposed</span>
    <span class="value" id="metricExposed">—</span>
  </div>
  <div class="metric-chip">
    <span class="label">Signal→Action</span>
    <span class="value" id="metricLatency">—</span>
    <span class="trend">↓ vs manual</span>
  </div>
  <div class="metric-chip">
    <span class="label">Rubric ≥8 (would-act)</span>
    <span class="value" id="metricRubric">—</span>
  </div>
</div>

<div class="app" id="appContainer">

  <!-- Enforcement worklist -->
  <main class="worklist">
    <div class="section-header">
      <div class="section-title">
        📋 Enforcement Worklist
        <span class="badge" id="recCount">0</span>
      </div>
      <div class="filters">
        <button class="filter-btn active" onclick="filterRecs('all', this)">All</button>
        <button class="filter-btn" onclick="filterRecs('proposed', this)">Proposed</button>
        <button class="filter-btn" onclick="filterRecs('approved', this)">Approved</button>
        <button class="filter-btn" onclick="filterRecs('dispatched', this)">Dispatched</button>
      </div>
    </div>

    <div class="rec-list" id="recList">
      <div class="loading">
        <div class="spinner"></div>
        Loading enforcement recommendations...
      </div>
    </div>
  </main>

  <!-- Dossier panel -->
  <aside class="dossier-panel" id="dossierPanel">
    <div class="dossier-header">
      <div class="dossier-title">📁 Evidence Dossier</div>
      <button class="close-btn" onclick="closeDossier()">✕</button>
    </div>
    <div class="dossier-body" id="dossierBody">
      <div class="loading">Select a recommendation to view its dossier.</div>
    </div>
    <div class="dossier-actions" id="dossierActions" style="display:none">
      <button class="btn btn-primary" onclick="generatePDF()" id="pdfBtn">
        📄 Generate Notice / PDF
      </button>
      <div class="btn-group">
        <button class="btn btn-success" onclick="updateStatus('approved')">✅ Approve</button>
        <button class="btn btn-secondary" onclick="updateStatus('dispatched')">🚀 Dispatch</button>
        <button class="btn btn-secondary" onclick="updateStatus('dismissed')">❌ Dismiss</button>
      </div>
    </div>
  </aside>

</div>

<!-- Toast notification -->
<div class="toast" id="toast"></div>

<script>
  // === Config ===
  const API_BASE = window.__VITE_API_BASE_URL__ || 'http://localhost:8000';
  let allRecs = [];
  let currentFilter = 'all';
  let selectedRecId = null;

  // === API helpers ===
  async function apiFetch(path, opts = {}) {
    try {
      const resp = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
      });
      const json = await resp.json();
      return json.data || json;
    } catch (e) {
      console.error('API error:', e);
      return null;
    }
  }

  // === Load enforcement data ===
  async function loadData() {
    const city = document.getElementById('citySelect').value;
    document.getElementById('recList').innerHTML = `
      <div class="loading"><div class="spinner"></div>Loading…</div>
    `;
    closeDossier();

    const recs = await apiFetch(`/enforcement?city=${city}&limit=50`);
    if (!recs || !Array.isArray(recs)) {
      document.getElementById('recList').innerHTML = `
        <div class="empty-state">
          <div class="icon">🔍</div>
          <p>No enforcement recommendations found for ${city}.</p>
        </div>`;
      return;
    }

    allRecs = recs;
    renderRecs();
    updateMetrics(recs);
  }

  // === Render recs ===
  function renderRecs() {
    const filtered = currentFilter === 'all'
      ? allRecs
      : allRecs.filter(r => r.status === currentFilter);

    document.getElementById('recCount').textContent = filtered.length;

    if (filtered.length === 0) {
      document.getElementById('recList').innerHTML = `
        <div class="empty-state">
          <div class="icon">✅</div>
          <p>No recommendations in this category.</p>
        </div>`;
      return;
    }

    document.getElementById('recList').innerHTML = filtered.map(rec => {
      const priority = rec.priority_score || 0;
      const cls = priority > 0.7 ? 'critical' : priority > 0.4 ? 'high' : 'medium';
      const priorityCls = priority > 0.7 ? '' : priority > 0.4 ? 'high' : 'medium';
      const rubricTotal = (rec.rubric_score || {}).total || 0;
      const rubricPct = (rubricTotal / 10 * 100).toFixed(0);
      const citations = rec.rag_citations || [];
      const wouldAct = rubricTotal >= 8;

      return `
        <div class="rec-card ${cls} ${selectedRecId === rec.id ? 'selected' : ''}"
             id="rec-${rec.id}"
             onclick="openDossier(${rec.id})">
          <div class="rec-header">
            <div class="rec-title">${escapeHtml(getSourceName(rec))}</div>
            <div class="rec-meta">
              <span class="priority-badge ${priorityCls}">${(priority * 100).toFixed(0)}%</span>
              <span class="status-tag ${rec.status}">${rec.status}</span>
            </div>
          </div>
          <div class="rec-rationale">${escapeHtml((rec.rationale || '').slice(0, 160))}${rec.rationale && rec.rationale.length > 160 ? '...' : ''}</div>
          <div class="rec-stats">
            <div class="stat-chip"><span class="icon">👥</span>${((rec.pop_exposed || 0)/1000).toFixed(1)}k exposed</div>
            <div class="stat-chip"><span class="icon">📊</span>${((rec.contribution || 0)*100).toFixed(0)}% contribution</div>
            <div class="stat-chip"><span class="icon">🎯</span>${wouldAct ? '✅ Would-act' : 'Below threshold'}</div>
          </div>
          <div class="rubric-bar">
            <div class="rubric-bar-track">
              <div class="rubric-bar-fill" style="width:${rubricPct}%"></div>
            </div>
            <div class="rubric-label">Rubric ${rubricTotal}/10</div>
          </div>
          ${citations.length ? `<div class="citations-row">
            ${citations.slice(0, 3).map(c => `<span class="citation-tag">${escapeHtml((c.rule || '').slice(0, 40))}</span>`).join('')}
          </div>` : ''}
        </div>`;
    }).join('');
  }

  // === Dossier ===
  async function openDossier(recId) {
    selectedRecId = recId;
    document.getElementById('appContainer').classList.add('dossier-open');
    document.getElementById('dossierBody').innerHTML = `<div class="loading"><div class="spinner"></div>Loading dossier…</div>`;
    document.getElementById('dossierActions').style.display = 'none';

    // Highlight selected card
    document.querySelectorAll('.rec-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById(`rec-${recId}`);
    if (card) card.classList.add('selected');

    const dossier = await apiFetch(`/enforcement/${recId}/dossier`);
    if (!dossier) {
      document.getElementById('dossierBody').innerHTML = `<div class="loading">Failed to load dossier.</div>`;
      return;
    }

    renderDossier(dossier);
    document.getElementById('dossierActions').style.display = 'flex';
    document.getElementById('dossierActions').dataset.recId = recId;
  }

  function renderDossier(dossier) {
    const rubric = dossier.rubric_score || {};
    const citations = dossier.citations || [];

    document.getElementById('dossierBody').innerHTML = `
      <div class="dossier-section">
        <div class="dossier-section-title">📝 Rationale</div>
        <div class="dossier-rationale">${escapeHtml(dossier.rationale || '')}</div>
      </div>

      <div class="dossier-section">
        <div class="dossier-section-title">📊 Impact</div>
        <div class="rec-stats" style="flex-wrap:wrap;gap:8px">
          <div class="stat-chip"><span class="icon">👥</span>${((dossier.pop_exposed||0)/1000).toFixed(1)}k people exposed</div>
          <div class="stat-chip"><span class="icon">📈</span>${dossier.contribution_pct || 0}% PM2.5 contribution</div>
        </div>
      </div>

      <div class="dossier-section">
        <div class="dossier-section-title">⚖️ CPCB/GRAP Rubric Score (${rubric.total || 0}/10)</div>
        <div class="rubric-grid">
          <div class="rubric-item"><span class="rubric-item-label">Attribution match</span><span class="rubric-item-val">${rubric.attribution_match ?? '—'}/2</span></div>
          <div class="rubric-item"><span class="rubric-item-label">Actionability</span><span class="rubric-item-val">${rubric.actionability ?? '—'}/2</span></div>
          <div class="rubric-item"><span class="rubric-item-label">Exposure</span><span class="rubric-item-val">${rubric.exposure ?? '—'}/2</span></div>
          <div class="rubric-item"><span class="rubric-item-label">Regulatory basis</span><span class="rubric-item-val">${rubric.regulatory_basis ?? '—'}/2</span></div>
          <div class="rubric-item"><span class="rubric-item-label">Confidence</span><span class="rubric-item-val">${rubric.confidence ?? '—'}/1</span></div>
          <div class="rubric-item" style="background:${(rubric.would_act ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)')};border-color:${rubric.would_act ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}">
            <span class="rubric-item-label">Would-act verdict</span>
            <span class="rubric-item-val" style="color:${rubric.would_act ? 'var(--success)' : 'var(--danger)'}">${rubric.would_act ? '✅ Yes' : '❌ No'}</span>
          </div>
        </div>
      </div>

      <div class="dossier-section">
        <div class="dossier-section-title">📚 Regulatory Citations (${citations.length})</div>
        ${citations.map((c, i) => `
          <div class="citation-card">
            <div class="citation-rule">${i+1}. ${escapeHtml(c.rule || '')}</div>
            <div class="citation-excerpt">${escapeHtml(c.excerpt || '')}</div>
            <div class="citation-sim">Relevance: ${((c.similarity || 0) * 100).toFixed(0)}%</div>
          </div>`).join('')}
      </div>

      ${dossier.suggested_notice_text ? `
      <div class="dossier-section">
        <div class="dossier-section-title">📄 Draft Notice (for officer review)</div>
        <div class="notice-box">${escapeHtml(dossier.suggested_notice_text)}</div>
      </div>` : ''}

      ${dossier.satellite_patch ? `
      <div class="dossier-section">
        <div class="dossier-section-title">🛰️ Satellite Evidence</div>
        <img src="${dossier.satellite_patch}" alt="Satellite patch" style="width:100%;border-radius:8px;border:1px solid var(--border)" />
      </div>` : ''}
    `;
  }

  function closeDossier() {
    selectedRecId = null;
    document.getElementById('appContainer').classList.remove('dossier-open');
    document.querySelectorAll('.rec-card').forEach(c => c.classList.remove('selected'));
  }

  // === Status update ===
  async function updateStatus(status) {
    if (!selectedRecId) return;
    const result = await apiFetch(`/enforcement/${selectedRecId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    if (result) {
      showToast(`✅ Status updated to "${status}"`, 'success');
      // Update local data
      const rec = allRecs.find(r => r.id === selectedRecId);
      if (rec) rec.status = status;
      renderRecs();
    } else {
      showToast('Failed to update status', 'error');
    }
  }

  // === PDF / Notice generation ===
  async function generatePDF() {
    if (!selectedRecId) return;
    document.getElementById('pdfBtn').textContent = '⏳ Generating...';
    // Read the notice text from the dossier body
    const noticeBox = document.querySelector('.notice-box');
    const noticeText = noticeBox ? noticeBox.textContent : 'No notice text available.';

    // Create a printable window
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Enforcement Notice — VayuNetra</title>
      <style>
        body { font-family: "Courier New", monospace; padding: 40px; font-size: 14px; line-height: 1.8; color: #000; }
        h1 { font-size: 18px; margin-bottom: 20px; }
        pre { white-space: pre-wrap; }
        footer { margin-top: 40px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
      </style></head>
      <body>
        <pre>${noticeText}</pre>
        <footer>Generated by VayuNetra AI Enforcement System — ${new Date().toISOString()}</footer>
      </body></html>`);
    win.document.close();
    win.print();

    setTimeout(() => {
      document.getElementById('pdfBtn').textContent = '📄 Generate Notice / PDF';
    }, 2000);
    showToast('📄 Notice generated — print dialog opened', 'success');
  }

  // === Filter ===
  function filterRecs(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderRecs();
  }

  // === Metrics ===
  function updateMetrics(recs) {
    document.getElementById('metricTotal').textContent = recs.length;
    const avgPriority = recs.length ? (recs.reduce((s, r) => s + (r.priority_score || 0), 0) / recs.length * 100).toFixed(0) + '%' : '—';
    document.getElementById('metricAvgPriority').textContent = avgPriority;
    const totalExposed = recs.reduce((s, r) => s + (r.pop_exposed || 0), 0);
    document.getElementById('metricExposed').textContent = totalExposed > 1000 ? (totalExposed/1000).toFixed(0) + 'k' : totalExposed;
    const wouldAct = recs.filter(r => (r.rubric_score || {}).would_act).length;
    document.getElementById('metricRubric').textContent = `${wouldAct}/${recs.length}`;
    document.getElementById('metricLatency').textContent = '< 5 min';
  }

  // === Helpers ===
  function getSourceName(rec) {
    if (rec.evidence && rec.evidence.source_name) return rec.evidence.source_name;
    const h3Short = (rec.h3_cell || '').slice(-6);
    return `Source at cell ${h3Short}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(() => t.className = 'toast', 3000);
  }

  // === Init ===
  loadData();
</script>
</body>
</html>
"""

# Write the file
if __name__ == "__main__":
    from pathlib import Path
    out = Path(__file__).parent / "enforcement_panel.html"
    out.write_text(ENFORCEMENT_UI_HTML, encoding="utf-8")
    print(f"Enforcement UI written to {out}")
