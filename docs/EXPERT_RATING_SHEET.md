# VayuNetra — Independent Domain Expert Review

> **Purpose.** The ET AI Hackathon 2026 PS-5 brief evaluates *"enforcement recommendation
> quality rated by domain experts"* along with *"citizen advisory relevance and language
> coverage"* and *"source attribution accuracy."* This document lets a qualified reviewer
> (PCB officer, environmental engineer, air-quality researcher, urban-health professional)
> independently review the live system in **~20 minutes** and record a structured
> assessment the team may attach to its submission.
>
> Live app: **https://vayunetra-aqi.vercel.app** → *Open console*.
> The printed excerpts below were generated verbatim by the production system on
> **20 July 2026** (refresh anytime in the app; recommendation IDs are shown so the live
> record can be pulled up).
>
> A print-ready version with fill-in spaces is at `docs/EXPERT_RATING_SHEET.docx`.

## Reviewer

| | |
|---|---|
| Name | |
| Designation / organisation | |
| Domain expertise | |
| Years of experience | |
| Date of review | |
| Reviewed via | ☐ live app ☐ guided walkthrough ☐ printed excerpts only |

## Scoring scale (used throughout)

**1** — Not credible / would not act · **2** — Weak, major gaps · **3** — Adequate ·
**4** — Good, minor changes needed · **5** — Excellent, would act as-is

---

## Part A — Source attribution (the blame map) · ~5 min

*In the app: pick a city, click 2–3 coloured hexagons. Each opens a "Cell Story":
source shares, model evidence (SHAP drivers + the model's own out-of-sample R²), and —
where the model lacks skill — an explicit fallback to chemical-signature priors.*

| # | Question | Score 1–5 |
|---|---|---|
| A1 | Is the source mix shown for this city plausible against your field understanding? | |
| A2 | Is the evidence presentation (drivers, confidence, honest abstention) appropriate for official use? | |

Comments (what looks right / wrong, per city if applicable):

> _________________________________________________________________
> _________________________________________________________________

---

## Part B — Enforcement recommendations · ~8 min (the core of this review)

*Rate each recommendation on four dimensions, 1–5 each:*

- **B1 Actionability** — could a field inspector act on this tomorrow?
- **B2 Evidence quality** — do the attribution %, population exposure and satellite patch justify the visit?
- **B3 Regulatory grounding** — is the cited basis (GRAP / CPCB dust norms) the right instrument?
- **B4 Prioritisation** — genuinely worth the inspector-hours vs alternatives?

### R1 · Mumbai — rec #494
Construction dust ≈ **67.4%** of PM2.5 in the cell, **26,884 residents** exposed;
EE-heuristic-detected construction source. Inspection: verify dust suppression
(anti-smog gun, water sprinkling, green-net coverage). Basis: GRAP + CPCB dust-control norms.
`B1 ___  B2 ___  B3 ___  B4 ___`  · Comment: ______________________________

### R2 · Mumbai — rec #495
Construction dust ≈ **66.4%**, **18,786 residents** exposed; *Marathon Millenia* is the
registered construction source at the location. Same inspection protocol; dossier carries
a Sentinel-2 patch and a projected-impact chart in the draft notice PDF.
`B1 ___  B2 ___  B3 ___  B4 ___`  · Comment: ______________________________

### R3 · Delhi — rec #334
Construction dust ≈ **43.6%**, **~15,000 residents** exposed; satellite-detected
(Earth-Engine heuristic #43) construction source. Site inspection: dust-suppression
norms compliance. Basis: GRAP.
`B1 ___  B2 ___  B3 ___  B4 ___`  · Comment: ______________________________

### R4 · Bengaluru — rec #433
Construction dust ≈ **25.7%**, **~15,000 residents** exposed; satellite-detected
(Earth-Engine heuristic #52) construction source; same inspection protocol.
`B1 ___  B2 ___  B3 ___  B4 ___`  · Comment: ______________________________

### R5 · Reviewer's pick — any live recommendation
*(Open any city's Enforcement worklist, pick a card — ideally a type not covered above,
e.g. industrial — note its ID, open its Evidence dossier and Notice PDF.)*
Rec ID: ________  City: ____________
`B1 ___  B2 ___  B3 ___  B4 ___`  · Comment: ______________________________

---

## Part C — Citizen advisories · ~5 min

*In the app: Advisories section. Switch the language dropdown (English / Hindi / Kannada /
Marathi) and the channel tabs (App / Telegram / IVR call / Big screen). Advisories are
deliberately template-generated (no LLM) so health guidance cannot be hallucinated, and
are targeted using 5,495 vulnerability-scored zones (hospitals, schools, outdoor work).*

| # | Question | Score 1–5 |
|---|---|---|
| C1 | Relevance and actionability of the advisory content for a lay citizen | |
| C2 | Channel fit — would app + Telegram + IVR + public displays reach the people who need it? | |
| C3 | Is vulnerability-based targeting (hospitals, schools, outdoor workers) the right escalation logic? | |

Language quality — rate only the languages you can read (leave others blank):
`English ___ · Hindi ___ · Kannada ___ · Marathi ___`

Comments: _________________________________________________________________

---

## Part D — Overall assessment · ~2 min

- **D1.** Would you act on the top recommendation this week? **☐ Yes ☐ With changes ☐ No**
  If "with changes": ______________________________________________________
- **D2.** In your experience, would this platform reduce the time from pollution signal to
  field intervention compared with current practice? **☐ Yes ☐ No ☐ Unsure** —
  Comment: ______________________________________________________
- **D3.** The strongest aspect of the system: ______________________________________
- **D4.** What must change before a PCB / municipal deployment: ____________________
  __________________________________________________________________________
- **D5.** Overall platform rating (circle): `1  2  3  4  5  6  7  8  9  10`

## Sign-off

☐ I consent to this review being included in the team's hackathon submission and quoted
with my name and designation.
☐ Include my review anonymously (role only).

Signature: ____________________  Date: ____________

---

*Context for the reviewer: recommendations are generated by scoring every registered +
satellite-detected emission source against per-km² source attribution (contribution ×
population exposed × actionability × model confidence), with RAG-retrieved regulatory
citations and a draft notice PDF (always officer-in-the-loop; nothing is auto-sent). The
system's own CPCB/GRAP-derived rubric proxy scores the worklist 7–8/10 "would-act" —
this review exists to replace that proxy with real expert judgment.*
