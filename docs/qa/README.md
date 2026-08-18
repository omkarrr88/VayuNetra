# QA evidence (regenerated 18 Aug 2026)

- `axe/axe-summary.txt` — axe-core audit of the landing page and every console section
  (`node web/scripts/qa/axe-audit.mjs`, dev server on :5173, API on :8000): **0 violation types on all 8 pages**.
- `mobile/` — 390-px viewport screenshots of the landing and console sections plus the check log
  (`node web/scripts/qa/mobile-check.mjs`): no horizontal overflow, tap targets ≥ 24 px, bottom nav present.

Both scripts are read-only and rerunnable; the CI e2e job runs the smoke suite on every push.
