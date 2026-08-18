# VayuNetra — finale pitch, 7½ minutes, two speakers

**Deck:** `docs/VayuNetra_Pitch.html` — open in Chrome/Edge, press **F** (full-screen).
Self-contained (works offline); the live console embeds on slide 6 with **D**, **Esc** returns.
Backups: `docs/VayuNetra_Pitch.pptx` / `.pdf` (static renders of the same slides, notes included).

Keys: `← →` navigate · `F` full-screen · `N` notes drawer · `P` presenter window (timer +
notes, syncs with the main window) · `D` live console · `R` replay the slide's animation · `Esc`.

Rebuild after any data change: `.venv/bin/python docs/pitch/build_pitch_data.py` (API on :8000,
DEMO_MODE=false) → `.venv/bin/python docs/pitch/build_deck.py` → `cd web && node scripts/qa/deck-render.mjs` →
`python3 docs/pitch/export_backup.py`.

## Timing

| clock | slide | who | beat |
|---|---|---|---|
| 0:00 | 1 Title | A | one line: "we don't measure the air — we trace, predict and act on it" (map is live) |
| 0:25 | 2 Problem | A | 1.67 M · 900+ · 31 % — "a reading turns red, then nothing happens" |
| 0:55 | 3 The loop | A | trace → predict → act → protect, six agents, seconds of compute, human steps timestamped |
| 1:35 | 4 Winter replay | A | let it play; point at Stage III/IV badges; **say the October misses out loud** |
| 2:20 | 5 Proof | A | skill · onset recall · calibration — "including our failures" — the SAFAR/DSS bridge line — hand over |
| 3:00 | 6 Live demo | **B** | press **D** — 4 minutes on the console (path below) |
| 7:00 | 7 Built to deploy | B | ₹0 today, ₹2,700/month for all 131, one YAML per city, closed loop, PRANA export |
| 7:30 | 8 Close | B | "India measures. India forecasts. VayuNetra operates." — QR — the ask: the first city that says yes |
| 7:45 | — | — | stop; appendix A1–A14 for Q&A |

Speaker A owns slides 1–5 (three minutes, tight). Speaker B owns the demo and the close.
No owner attribution on any slide; both speakers say "we".

## Speaker A — slides 1–5 (say it roughly like this)

**1 (0:00)** "Good morning. Every Indian metro measures its air; several forecast it. Nothing acts on it. VayuNetra is the operations layer: it traces who is polluting each square kilometre, predicts the next 72 hours with honest probabilities, ranks where to send an inspector with cited evidence, and tells citizens in their own script — live in ten cities, at zero infrastructure cost. The map behind me is live."

**2 (0:25)** "The data exists — nine hundred CAAQMS stations, satellites overhead — and 1.67 million
Indians still die early each year. Why? A reading turns red and nothing happens: no system tells
an officer who is polluting this square kilometre now, what the air does tomorrow, where to send
inspectors first. The CAG found 31 percent of monitored cities have any response protocol.
Cities don't need another dashboard; they need the layer that turns a reading into an intervention."

**3 (0:55)** "One loop, four verbs. Trace: who is to blame in each square kilometre — and it says so where it lacks skill. Predict: the next 72 hours, with each cell's chance of turning Very Poor. Act: sites ranked by contribution, people exposed and confidence — real satellite image, the regulation, a draft notice; the officer approves, dispatches, closes the case on an audit trail. Protect: advisories in eight scripts. Six agents, one graph, seconds of compute — every human step timestamped."

**4 (1:35)** "This is Delhi's last winter, day by day, on 39 station cells — real CPCB data. The
markers are the government's actual GRAP orders. Under each: what our forecast said 24 hours
before the order was signed. Stage III on 11 November and Stage IV on 13 December — flagged a full
day ahead across essentially the whole network, probability above 80 percent, when persistence
said 225 and the city measured 407. The two October orders we did not foresee — and it says so on
the slide."

**5 (2:20)** "Every number is measured — including the ones that hurt. Skill over persistence on a strict temporal split: Delhi plus 9, 13, 12 percent at one, two, three days. Of the clean-to-Very-Poor onsets, our calibrated alarm catches about half, days ahead — persistence catches none. The probabilities are honest: the reliability curve sits on the diagonal. Attribution is checked against the published studies — disagreements on the record. SAFAR and the DSS forecast the air; nothing turns a forecast into a traced, cited, delivered, closed action. We do — here it is." *(hand over)*

## Speaker B — live demo (3:00 → 7:00), press D

Before the session: open vayunetra-aqi.vercel.app/console once in the same browser, dismiss the
tour, run `make prewarm` (or click through the sections) so nothing cold-starts on stage. Keep
Delhi selected. If the network dies, the deck shows the last screenshot, labelled — narrate over it.

| min | do | say |
|---|---|---|
| 3:00 | **Morning brief** (top card): PDF · Send to Telegram | "The one page a commissioner reads: city mean vs yesterday, where the air is about to turn with the probability, the top three actions. PDF, or one click to every Telegram subscriber." |
| 3:35 | Click the **worst hexagon** on the map → cell story | "Who is to blame in this square kilometre: sources, the SHAP drivers, the model's own R² gate — where it lacks skill it says so and falls back to cited priors — and the 72-hour forecast with the probability of Very Poor." |
| 4:15 | **Worklist** card → **Evidence dossier** → **Notice PDF** | "Ranked by contribution × exposed × actionable × confidence. Real Sentinel-2 image of the site, the regulation retrieved verbatim, and a draft notice — stamped pending authorisation, never auto-sent." |
| 4:55 | **Approve → Dispatch team → Close case** (finding) → **History** | "Approve, dispatch — the cell's baseline freezes and tracking arms — close with the field finding. History: who did what, when. This survives the nightly run; it's the audit trail a court asks for." |
| 5:35 | **Advisories**: switch Hindi → Tamil; Telegram tab | "The same advisory in the reader's own script — templated, so it cannot hallucinate medical advice — over app, Telegram, an IVR line, public displays." |
| 6:05 | **Forecast**: validation card, then **Real interventions, in hindsight** | "Measured skill, negatives kept — and the replay you just saw, with every order linked to its government release." |
| 6:35 | **Cities**: scoreboard → click **Mumbai** | "Ten cities, one engine, one YAML each — the whole console follows." |
| 6:55 | **Esc** | back to slide 7 |

**7 (7:00)** "Built to deploy, not to demo. Ten cities live, one YAML per city, no per-city code;
seven metros onboarded in a week. We measured what a city costs — 0.2 megabytes of readings a day,
one row per reading, 180-day retention with an archive: the free tier is sized for this
deployment; all 131 NCAP cities would run for about ₹2,700 a month. Every dispatched action is
tracked against its own cell and exported PRANA-ready — we feed the official system, we don't
compete with it."

**8 (7:30)** "India measures. India forecasts. VayuNetra operates — traced, predicted, cited, delivered, closed. In seconds, in eight scripts, for zero rupees today and 2,700 a month for every NCAP city. It is live now — the QR takes you there. We are ready to run it for the first city that says yes. Thank you."

## Q&A — where the answer lives

| likely question | slide | honest answer in one line |
|---|---|---|
| Who rated your recommendations? | A6 / sheet | Nobody outside the team yet — n = 0, and we say so. The protocol is published (`EXPERT_RATING_SHEET`), recommendations are scored on a transparent CPCB/GRAP-derived rubric, and the strongest external check we have is the winter replay: Stage III/IV flagged a day ahead against the government's own orders. |
| Did any intervention actually clean the air? | A13 | No VayuNetra dispatch has closed yet in a real city; the method is live and already showed its power (Diwali) and its blind spots. |
| ₹0 forever? | 7 / A7 | No — ₹0 to ~10 cities at 180-day retention; ₹2,700/month for 131; measured. |
| Attribution accuracy? | A12 | Cosine 0.88/0.90/0.93 vs anchors; bucket tables vs primary studies; instability with thin NO₂ coverage stated. |
| Severe tail? | A11 | Weak — blended forecast only matches persistence above 250; the product speaks in calibrated probability. |
| Why not WRF-Chem? | A10 | We don't out-model it; we add the operational layer and feed PRANA. |
