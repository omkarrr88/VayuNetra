# Expert review — outreach kit

The brief scores *"enforcement recommendation quality rated by domain experts"*. The protocol
exists (`docs/EXPERT_RATING_SHEET.md` / `.docx`, ~20 minutes, 1–5 scale on actionability,
evidence, regulatory grounding, prioritisation). What is missing is **n > 0**. This kit is
what the team sends; the results go back into the submission verbatim — every score,
including low ones.

## Who to ask (2–3 is enough; independence matters more than seniority)

* An air-quality academic — IIT Delhi / IIT Bombay / IISc / IIT Kanpur atmospheric-science
  or civil-environmental faculty, or a CSTEP / TERI / UrbanEmissions.info researcher.
* A regulator or ex-regulator — anyone who has worked at a State PCB (DPCC, MPCB, KSPCB,
  TSPCB), CPCB, or a municipal environment cell.
* A public-health or urban-planning professional (WRI India, CEEW, a district health officer).

Ask each for the same 20 minutes on the live app. Do not coach; do not pre-select the
recommendations they see — the sheet tells them to open the worklist and rate the top items.

## The email (edit the brackets; keep it short)

> Subject: 20-minute independent review of an air-quality enforcement tool (student team, ET AI Hackathon finale 25 Aug)
>
> Dear [Dr / Mr / Ms Name],
>
> We are a three-person student team (DaGoats) building VayuNetra, an open-source
> decision-support system for city air-quality officers: per-km² source attribution,
> a 72-hour PM2.5 forecast with calibrated probabilities, and a ranked enforcement worklist
> with cited evidence dossiers. It runs live for ten Indian cities on public data.
>
> The hackathon brief asks for enforcement recommendations "rated by domain experts". We
> would rather show honest scores from an independent reviewer than none. Could you spare
> ~20 minutes to open the live console and fill a one-page rating sheet (1–5 on
> actionability, evidence quality, regulatory grounding and prioritisation, plus free-text)?
>
> Live app: https://vayunetra-aqi.vercel.app → *Open console* (no login).
> Rating sheet: [attach docs/EXPERT_RATING_SHEET.docx].
> How it works, one page: [attach docs/USER_GUIDE.pdf, or link the README].
>
> We will quote your scores and comments exactly as written, with your role and
> organisation (or anonymised as "[air-quality researcher]" if you prefer). Low scores are
> as useful to us as high ones — the point is an honest measurement.
>
> Thank you for considering it.
> [Name], for team DaGoats — VayuNetra

## What to do with the replies

1. Save each filled sheet as `docs/expert_reviews/<role>_<date>.pdf` (do not commit
   personal contact details; role + organisation only, or anonymised on request).
2. Add one row per reviewer to the table below and to `docs/SUBMISSION.md` ("Numbers we can
   defend"): mean of B1–B4 across the recommendations they rated, n recommendations, and one
   verbatim comment — the most critical one, not the kindest.
3. If a reviewer flags a wrong instrument or an unactionable item, fix it and note the fix
   under the row. That is the loop the brief is asking for.

| reviewer (role, org) | date | recs rated | B1 actionability | B2 evidence | B3 regulatory | B4 priority | most critical comment |
|---|---|---:|---:|---:|---:|---:|---|
| — | — | — | — | — | — | — | (none yet — say so on stage rather than imply otherwise) |
