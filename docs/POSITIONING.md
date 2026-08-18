# Positioning — what VayuNetra adds to what Indian cities already have

The judge question most teams never answer: **India already runs official air-quality
forecast and reporting systems.** Being honest about them is our strongest argument, not a
weakness — because the documented gaps are exactly the gaps this product closes.

## The status quo

| System | Owner | What it is | Reach | What it does not do |
|---|---|---|---|---|
| **SAFAR** (2018–) | IITM Pune / MoES | City forecast bulletin, ~72 h, station/city level | Delhi, Mumbai, Pune, Ahmedabad | No hyperlocal grid, no source-level action, no enforcement loop |
| **AQEWS / DSS** (2018 / 2021–) | IITM Pune for CAQM | WRF-Chem chemical-transport model, 5-day forecast, 400 m grid (days 1–3), 29-source apportionment | Delhi-NCR; **DSS is for CAQM/government users, not public** | Static 2016 emission inventory; no ward/site attribution; no citizen channel; no outcome tracking |
| **PRANA** (2021–) | CPCB / NCAP | Portal where 131 NCAP cities *report* actions and spending | national | Reports what was done — does not tell a city what to do next, or whether it worked |
| **NCAP Tracker** (2021–) | Climate Trends / Respirer | Public dashboard of city PM trends & NCAP fund utilisation | national | Descriptive; no forecast, no attribution, no enforcement |
| **CAAQMS / SAMEER** | CPCB | Real-time station AQI + app | ~560 stations, 130+ cities | A reading, not a decision |

## The documented gaps (cited, not asserted)

**CEEW, *How Well can Delhi Predict Air Quality? Insights for India's Decision Support
Systems* (Ignatious & Rafiuddin, Oct 2025)** — an independent audit of Delhi's AQEWS/DSS,
peer-reviewed by IIT-Delhi, WRI India and CSTEP:

1. **Severe episodes are the weak point.** The AQEWS forecast 'severe and above' (AQI > 400)
   correctly for **1 of 15** episodes in winter 2023-24 and **5 of 14** in winter 2024-25
   (probability of detection 36 %, up from ~7 %). 'Very poor and above' is caught ~80 % of
   the time — the *onset of the worst days* is what the official system misses.
2. **Systematic under-prediction.** Mean bias error for PM2.5 was **−18 µg/m³ (winter 2023-24)
   and −24 µg/m³ (winter 2024-25)**; PM10 −34 → −59 µg/m³. The model runs on a static
   emission inventory.
3. **The forecast → action gap.** "The CAQM imposed the GRAP based on the observed AQI rather
   than forecasts in winter 2023-24 and 2024-25… GRAP Stages III and IV based on the observed
   AQI." Stage III was invoked six times and Stage IV twice in 2024-25 — *after* the AQI
   crossed the threshold. GRAP has no revocation criteria; stages were lifted only when the
   observed AQI fell.
4. **No outcome monitoring, no actionable pathways.** The DSS "lacks outcome monitoring and
   does not provide actionable short-term pathways for air pollution reduction… [nor] the
   potential impact of medium and long-term policy measures." CEEW's recommendations:
   scenario display of GRAP impact, sectoral pathways, updated inventories, and making the
   AQEWS/DSS public.

Sources: CEEW issue brief (ceew.in, Oct 2025); AQEWS/DSS description — Ghude et al.,
*Geosci. Model Dev.* 17, 2024; SAFAR portal (safar.tropmet.res.in); PRANA (prana.cpcb.gov.in);
NCAP Tracker (ncaptracker.in).

## Where VayuNetra fits — and what we do not claim

**We do not claim to out-model WRF-Chem.** A national chemical-transport simulation is not
what a hackathon team replaces, and our per-cell source shares are a statistical
attribution, not a 29-source causal inventory (see `docs/ATTRIBUTION_VALIDATION.md`).

We built for the four documented gaps:

| CEEW gap | VayuNetra |
|---|---|
| Severe-episode onset missed | Calibrated **P(> 120 / > 250 µg/m³)** on every cell forecast; onset-recall reported vs persistence (`docs/EARLY_WARNING.md`, `docs/benchmarks/`) |
| Under-prediction, static inventory | Live station + satellite + fire + community data every hour; per-cell attribution refreshed with the data, not a 2016 table |
| Forecast → action gap | Forecast-driven ranked worklist → authority-named notice with legal citations → dispatch queues → intervention tracker with measured before/after |
| No outcome monitoring / pathways | What-if simulator with ΔPM and health/₹ impact, ROI & NCAP fund guidance, PRANA-ready export, citizen loop — and everything public, in 6 languages, on IVR/Telegram/web |

**Deployment framing:** zero new hardware. India has already paid for ~560 CAAQMS stations
(₹1.5–17.5 crore each to set up, ~₹1.5 crore/yr to run). VayuNetra is the software
intelligence layer on top of that sunk investment, running on a ₹0 free-tier stack, and it
*feeds* PRANA rather than competing with it.

## One-line framing for the deck

> "Delhi's official early-warning system caught 5 of 14 severe days last winter, and every
> GRAP Stage III/IV was triggered on *observed* air. VayuNetra turns each forecast into a
> calibrated probability, a named notice, and a measured outcome — for 10 cities, today."
