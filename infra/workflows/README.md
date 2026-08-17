# infra/workflows/ — pipeline definitions (doc home)

> ⚠️ GitHub Actions **only** executes workflows from [`.github/workflows/`](../../.github/workflows/).
> This folder is the documented home (ARCHITECTURE.md §20); the live YAML lives in `.github/workflows/`.

Pipelines (cron) — (ARCHITECTURE.md §7.4):

| Job | Schedule | Output |
|---|---|---|
| `ingest_ground` | hourly | CAAQMS/OpenAQ → `measurements` |
| `ingest_weather` | hourly | Open-Meteo → `measurements` |
| `ee_satellite_features` | daily | Earth Engine → feature grids → Storage + `measurements` |
| `run_attribution` | hourly | Agent 1 → `attribution` |
| `run_forecast` | 6-hourly | Agent 2 → `forecasts` (+ persistence) |
| `refresh_enforcement` | 6-hourly | Agent 3 → `enforcement_recs` |
| `rollup_archive` | nightly | aggregate + purge to stay in free limits |
| `keepalive` | daily | ping Supabase so it never idles out |

Public repo → unlimited free Actions minutes.
