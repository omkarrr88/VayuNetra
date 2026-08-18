# Scale and cost — measured, not assumed

"₹0 infrastructure" is true for the ten cities running today. This page says exactly where
that stops, with the numbers taken from the production database on 18 Aug 2026, and what the
131 NCAP cities would cost. A judge doing the arithmetic should land on the same figures.

## What one city actually costs to run

| resource | measured (10 cities, Aug 2026) | per city |
|---|---:|---:|
| new readings per day (after de-duplication, all variables) | ~8,000 rows | ~800 rows |
| bytes per stored reading incl. indexes (`measurements`) | 260 B | — |
| database growth per day | ~2.1 MB | ~0.21 MB |
| raw readings kept | 180 days (then archived to Storage, daily PM2.5 per cell kept forever) | — |
| steady-state raw table | ~380 MB | ~38 MB |
| archive growth (gzip CSV in Storage) | ~0.25 MB per city-month | — |
| daily compute (GitHub Actions: ingest, forecast, attribution, enforcement, brief) | one workflow/day, minutes not hours | — |
| API (Render free web service, cold-start on idle) | 1 instance | — |
| web (Vercel hobby) | static + edge | — |

Two things made the free tier survivable and are now enforced by schema, not by hope:

* **One row per reading.** The hourly ingest re-fetches overlapping windows; before
  18 Aug the same reading was stored ~8× on average (up to 42×) and the database stood at
  338 MB of the 500 MB free tier with ~16 days of headroom. `uq_measurements_reading`
  (city, cell, station, variable, ts, source) plus `core.supa.insert_measurements` (upsert,
  duplicates ignored) took the table from 840,636 rows to 451,379 and the database to 198 MB.
* **Rolling retention with an archive.** `scripts/archive_measurements.py` (nightly in CI)
  rolls each cell's daily PM2.5 into `pm25_daily_rollup`, exports whole months older than
  180 days to the private `archive` Storage bucket, verifies the upload by read-back and row
  count, and only then deletes. The trend / "past air" views read raw ∪ rollup, so the
  Delhi winter 2025-26 series is still on screen with its raw rows in the archive.

## Where ₹0 stops

Supabase free: 500 MB database, 1 GB Storage. Everything else in the stack is free at any
city count that matters here (Vercel hobby, Render free, GitHub Actions 2,000 min/month).

The other tables (regulatory corpus with embeddings 61 MB, sources, zones, forecasts,
attribution, logs) are ~85 MB and grow slowly; the raw readings are the only thing that
scales with city count.

| cities | raw table @180 d | database total | fits free 500 MB? | Storage archive after 1 yr | monthly cost |
|---:|---:|---:|:--:|---:|---:|
| 10 (today) | ~380 MB steady state (198 MB now, 3.5 months in) | ~465 MB | yes — the free tier is sized for exactly this deployment | ~30 MB | ₹0 |
| 15 | ~570 MB | ~655 MB | no | ~45 MB | Supabase Pro US$25 (≈ ₹2,100) |
| 50 | ~1.9 GB | ~2.0 GB | no | ~150 MB | Pro US$25 |
| 131 (all NCAP cities) | ~5.0 GB | ~5.1 GB | no | ~390 MB | Pro US$25 (8 GB included) + Render Starter US$7 for an always-on API ≈ **₹2,700 / month** |

Shorter retention moves the free line: at 120 days the free tier holds ~16 cities, at
90 days ~21. Beyond ~130 cities the API should move off a single free instance
(Render Starter above) and the daily job would be split per state to stay inside GitHub's
free minutes; neither changes the architecture — one YAML per city, no per-city code.

## What is *not* on this page

* Field enforcement, officer time and station maintenance are the city's; VayuNetra
  costs the price of one streaming subscription for the whole NCAP list.
* Third-party quotas: OpenAQ (free tier rate limits: ingest is paced per city and
  tolerates skips), Open-Meteo (free, no key), Sentinel-5P / FIRMS via Earth Engine
  (research use), Twilio IVR (trial credit for the demo line — Telegram is the production
  citizen channel; an open-source IVR is the roadmap). These bound *freshness*, not cost.

Reproduce: `select pg_size_pretty(pg_database_size(current_database()))`, the per-day row
counts in `measurements`, and `python scripts/archive_measurements.py` (dry run) print the
inputs above.
