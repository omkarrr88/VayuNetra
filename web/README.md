# web/ — Authority Console + Citizen PWA

> Stack: React + TypeScript + Vite + Tailwind +
> **MapLibre GL + Deck.gl** (`H3HexagonLayer`) on Vercel. Spec: ARCHITECTURE.md §12, PRD §14.

## Getting started
```bash
cd web
npm install
cp ../.env.example .env.local   # set VITE_* vars; keep VITE_DEMO_MODE=true to start offline
npm run dev
```
`package.json` lists the dependency set. Scaffold the Vite app (`index.html`, `src/main.tsx`,
`tailwind.config.js`, `vite.config.ts`) — kept out of the base so you own the app shell.

## Component seams (so teammates' panels plug into your shell)
- **Blame Map** — `H3HexagonLayer` coloured by dominant source + SHAP tooltips.
- **Forecast time-slider** — 24–72h scrub + spike alerts.
- **Enforcement worklist + dossier** — ranked list → cited dossier → Notice/PDF.
- **Yours** — city switcher, comparative tab, latency widget, Citizen PWA, language toggle.

Every panel **reads the API / Supabase** (see `docs/API_CONTRACT.md`) — never a direct call to a
teammate. Build against `VITE_DEMO_MODE=true` + `demo/fixtures/*` until the Integration Window.
