# VayuNetra — finale pitch script (verbatim), 7 min 45 s, two speakers

**Deck:** `docs/VayuNetra_Pitch.html` — open in Chrome. It goes full-screen on your first key
press or click, so browser chrome never shows; **F** toggles it by hand. Self-contained; works
offline. **D** on slide 6 embeds the live app, full screen and bare — no bar over it; **Esc** returns. It prefers a dev server on the presenting laptop when one is running, else the deployed link. Backups: `docs/VayuNetra_Pitch.pptx`
/ `.pdf` (same slides, static, notes included). Speaker notes = these lines; press **N** to see them
on the laptop, or **P** for the presenter window (timer + notes).

Keys: `← →` next/previous · `F` full-screen · `N` notes · `P` presenter window · `D` live app ·
`R` replay the slide's animation · `Esc` close overlay / notes.

**Rebuild the morning of the finale** (fresh live numbers on the title map, slide 3, slide 7, A8):
```
.venv/bin/python docs/pitch/build_pitch_data.py     # API on :8000, DEMO_MODE=false, warm cache
.venv/bin/python docs/pitch/build_deck.py
cd web && node scripts/qa/deck-render.mjs && cd ..
python3 docs/pitch/export_backup.py
```

Every number below is the one in the artifacts (docs/benchmarks/*.json, docs/OUTCOMES.md,
docs/SCALE.md, docs/ATTRIBUTION_VALIDATION.md). Say them as written; do not round up.

---

## Timing at a glance

| clock | slide | who | what happens |
|---|---|---|---|
| 0:00 | 1 Title | **A** | hook; the map is live |
| 0:25 | 2 Problem | A | three counters; "a reading turns red, then nothing happens" |
| 0:55 | 3 The loop | A | trace → predict → act → protect |
| 1:35 | 4 Winter replay | A | **let it play 9 s in silence**, then the two green orders and the two red ones |
| 2:20 | 5 Proof | A | skill · onset recall · calibration · the SAFAR/DSS bridge line · hand over |
| 3:00 | 6 Live demo | **B** | press **D**; the public app, then seven stops on the console, 4 minutes |
| 7:00 | 7 Built to deploy | B | cost curve, one YAML per city, closed loop, PRANA |
| 7:30 | 8 Close | B | the line, the QR, the ask |
| 7:45 | — | — | stop. Appendix A1–A14 stays for Q&A |

Speaker A: 396 words for 3:00 (≈150 wpm with the 9-second replay pause). Speaker B: ~430 words over
4:00 of clicking, then 130 words for the close. Both speakers say "we", never "I built".

---

## SPEAKER A — slides 1–5

### Slide 1 · Title (0:00 → 0:25)
*(Stand still. Let the haze clear on screen before the first word.)*

> Good morning. Every Indian metro measures its air; several forecast it. Nothing acts on it.
> VayuNetra is the operations layer: it traces who is polluting each square kilometre, predicts
> the next 72 hours with honest probabilities, ranks where to send an inspector with cited
> evidence, and tells citizens in their own script — live in ten cities, at zero infrastructure
> cost. The map behind me is live.

### Slide 2 · The problem (0:25 → 0:55)
*(Counters animate on entry — pause one beat, then speak.)*

> The data exists — nine hundred CAAQMS stations, satellites overhead — and 1.67 million Indians
> still die early each year. Why? A reading turns red and nothing happens: no system tells an
> officer who is polluting this square kilometre now, what the air does tomorrow, where to send
> inspectors first. The CAG found 31 percent of monitored cities have any response protocol at all.
> Cities don't need another dashboard; they need the layer that turns a reading into an intervention.

### Slide 3 · One loop (0:55 → 1:35)
*(Point at each card as you name it.)*

> One loop, four verbs. **Trace**: who is to blame in each square kilometre — and it says so where it
> lacks skill. **Predict**: the next 72 hours, with each cell's chance of turning Very Poor.
> **Act**: sites ranked by contribution, people exposed and confidence — real satellite image, the
> regulation, a draft notice; the officer approves, dispatches, closes the case on an audit trail.
> **Protect**: advisories in eight scripts. Five agents and a gate, one graph, seconds of compute — every human
> step timestamped.

### Slide 4 · Delhi's winter, replayed (1:35 → 2:20)
*(The replay starts on entry and runs 9 seconds. Say the first sentence, then STOP TALKING until the
December marker drops. Then continue. Press R if you need it again.)*

> This is Delhi's last winter, day by day, on 39 station cells — real CPCB data.
>
> *(silence while it plays)*
>
> The markers are the government's actual GRAP orders. Under each: what our forecast said 24 hours
> before the order was signed. Stage III on 11 November and Stage IV on 13 December — flagged a full
> day ahead across essentially the whole network, probability above 80 percent, when persistence
> said 225 and the city measured 407. The two October orders we did not foresee — and it says so on
> the slide.

### Slide 5 · Proof (2:20 → 3:00)
*(Left chart, middle chart, right chart — then the bridge line, then hand over.)*

> Every number is measured — including the ones that hurt. Skill over persistence on a strict
> temporal split: Delhi plus 9, 13, 12 percent at one, two, three days. Of the clean-to-Very-Poor
> onsets, our calibrated alarm catches about half, days ahead — persistence catches none. The
> probabilities are honest: the reliability curve sits on the diagonal. Attribution is checked
> against the published studies — disagreements on the record.
> SAFAR and the DSS forecast the air; nothing turns a forecast into a traced, cited, delivered,
> closed action. We do — here it is.

*(Speaker B steps forward. Speaker A presses → to slide 6.)*

---

## SPEAKER B — live demo (3:00 → 7:00)

**Before the session** (same laptop, same browser): if you are presenting from the local build, run
`make dev` first — the deck detects the dev server and uses it, which is faster and survives a dead
network. Otherwise open vayunetra-aqi.vercel.app once and `make prewarm` so Render is awake. Either
way: open the console once, dismiss the tour, click through Enforcement → Forecast → Advisories →
Cities so nothing cold-starts, and leave **Delhi** selected. If the network dies mid-demo, the deck
falls back to the last screenshot, labelled — narrate the same words over it.

**Press D.** The app fills the screen, edge to edge, with nothing of the deck over it. It opens on
the **front page**. Esc returns to the slides at any moment.

### Stop 0 · What a resident sees (3:00 → 3:20)
*(Click **Check your city's air**. Let the index count up. Point at the prominent-pollutant line,
then scroll once to the pollutant cards.)*

> Before the officer, the citizen. This is Delhi's air right now on India's own National AQI — and
> the pollutant setting it, which today is PM10, not PM2.5. Every pollutant its CPCB stations
> publish, each with its own sub-index. Same engine, same numbers as the console — one product.
> Now the other half of it.

*(Click **Operations →**.)*

### Stop 1 · Morning brief (3:20 → 3:50)
*(Point at the card. Click **PDF** — the file downloads. Do NOT click Send to Telegram unless the
subscriber count is real; say it instead.)*

> This is Delhi, right now. The Morning brief is the one page a commissioner reads: the city mean
> against yesterday, where the air is about to turn — with the probability, not a guess — the top
> three actions with their notice links, and yesterday's dispatches. One click gives the PDF; one
> click sends it to every Telegram subscriber. Nothing on this page is written by a language model —
> every line is a template over stored numbers.

### Stop 2 · Cell story on the map (3:50 → 4:25)
*(The worst cell is already open. Point at the source bars, then the "Why" box, then the forecast tiles.
Click one other hexagon to show it changes.)*

> Every hexagon is a square kilometre. This one: who is to blame — the sources, the SHAP drivers
> that moved the number, and the model's own out-of-sample R². Where it lacks skill it says so and
> falls back to cited chemical-signature priors, in amber. Below: the 72-hour forecast for this cell
> with the calibrated probability of Very Poor. Click any other cell — same story, its own numbers.

### Stop 3 · Worklist → evidence → notice (4:25 → 5:05)
*(Scroll to Enforcement Worklist. On the top card click **Evidence dossier**; point at the satellite
patch and the citations. Click **Notice PDF** — it downloads.)*

> The worklist ranks sources by contribution, people exposed, actionability and confidence — nothing
> under two percent gets in. Open the dossier: the real Sentinel-2 image of this site, the regulation
> retrieved verbatim — GRAP only where it legally binds, CPCB norms and NCAP elsewhere — and a draft
> notice with the projected effect of compliance. Stamped pending officer authorisation. Never auto-sent.

### Stop 4 · Approve → dispatch → close → history (5:05 → 5:40)
*(Type a name in **acting as**. On the same card: **Approve** → **Dispatch team** → **Close case** →
pick a finding → **Record & close** → **History**.)*

> The officer approves — it lands in the ward's field queue. Dispatches — the cell's seven-day
> baseline freezes and the before/after measurement is armed automatically. Closes the case with the
> field finding. And History: who did what, when, from what to what. That trail survives the nightly
> run and even the deletion of the record. This is the audit trail a court asks for.

### Stop 5 · Advisories in eight scripts (5:40 → 6:10)
*(Sidebar → **Advisories**. In the language dropdown pick Hindi, then Tamil. Click the **Telegram** tab.)*

> The same advisory in the reader's own script — Hindi, then Tamil — templated by design, so it
> cannot hallucinate medical advice. It goes out over the app, a live Telegram bot, an IVR line with a
> Hindi voice, and public display boards, targeted at five and a half thousand vulnerability-scored
> zones: hospitals, schools, elder care, outdoor work.

### Stop 6 · Proof, in the product (6:10 → 6:38)
*(Sidebar → **Forecast**. Scroll to **Forecast validation**, then **Real interventions, in hindsight**;
click "did the air change?" once.)*

> The benchmark you saw on the slide lives here, per city, recomputed from the artifact — negatives
> included. And the winter replay: every GRAP order links to its government release, with what we
> carried a day before, and a weather-normalised check of whether the air changed. Where the honest
> answer is "no detectable change", it says no.

### Stop 7 · Ten cities (6:38 → 6:55)
*(Sidebar → **Cities**. Click **Mumbai** on the scoreboard; the whole console follows.)*

> Ten cities on one scoreboard, one engine, one configuration file each — click Mumbai and the whole
> console follows: its own sources, its own forecast, its own worklist, its own languages.

*(Press **Esc**. Back on slide 6. Press → to slide 7.)*

---

## SPEAKER B — slides 7–8

### Slide 7 · Built to deploy (7:00 → 7:30)
> Built to deploy, not to demo. Ten cities live, one YAML per city, no per-city code; seven metros
> onboarded in a week. We measured what a city costs — 0.2 megabytes of readings a day, one row per
> reading, 180-day retention with an archive: the free tier is sized for this deployment; all 131
> NCAP cities would run for about ₹2,700 a month. Every dispatched action is tracked against its own
> cell and exported PRANA-ready — we feed the official system, we don't compete with it.

### Slide 8 · Close (7:30 → 7:45)
> India measures. India forecasts. VayuNetra operates — traced, predicted, cited, delivered, closed.
> In seconds, in eight scripts, for zero rupees today and 2,700 a month for every NCAP city. It is
> live now — the QR takes you there. We are ready to run it for the first city that says yes.
> Thank you.

*(Stop. Do not add "any questions". Stay on slide 8; move to the appendix only when asked.)*

---

## Q&A — verbatim answers (appendix slide in brackets)

**"Who rated your enforcement recommendations?"** [A6, EXPERT_RATING_SHEET]
> Nobody outside the team yet — n is zero, and we say so. The protocol is published, the ranking is a
> transparent CPCB/GRAP-derived rubric, and the strongest external check we have is the winter
> replay: Stage III and IV flagged a day ahead against the government's own orders.

**"Has any intervention actually cleaned the air?"** [A13]
> Not through VayuNetra yet — no city has dispatched through it. The measurement is live and armed at
> every dispatch. On last winter's real GRAP windows, weather-normalised, we found no detectable
> reduction — and the same method saw Diwali night at plus 182, so it can see a real signal. That is
> exactly why we track each action against its own cell, not city-wide stages.

**"₹0 forever?"** [7, A7]
> No. Zero for the ten cities running today; measured at 0.2 megabytes per city per day, all 131 NCAP
> cities cost about ₹2,700 a month. The curve is published.

**"How accurate is the attribution?"** [A12]
> Checked bucket by bucket against TERI-ARAI for Delhi and Guttikunda and CSTEP for Bengaluru — read
> from the primary PDFs. Rankings agree; we over-read kerbside traffic and under-see small waste
> fires, and where NO₂ coverage is thin the split moves between runs. All of that is written down.

**"What about Severe episodes?"** [A11]
> That is our weak spot and it is on the slide: above 250 the blended forecast only matches
> persistence. The product speaks in calibrated probability — P(>250) Brier skill plus 31 percent at
> 24 hours — rather than pretending to a point forecast it cannot make.

**"Why not just use the IITM DSS / WRF-Chem?"** [A10]
> We don't out-model WRF-Chem and don't claim to. The DSS is for government users, on a 2016
> inventory, with no per-site attribution, no notice, no outcome tracking. We are the operational
> layer on top of what India already measures — and we export to PRANA.

**"Why LightGBM and not a deep model?"** [A5]
> We trained a Temporal Fusion Transformer on GPU and rejected it: LightGBM won held-out skill in every
> launch city at this data scale. The notebook is in the repo.

**"What happens when the CPCB/OpenAQ feed dies?"** [A2]
> The console says so instead of inventing: the brief shows the age of the last reading, the map
> shows the demo snapshot with a banner, and nothing is written. Last January the public feed carried
> one Delhi station for a week — our replay flags those rows as low coverage rather than hiding them.

**"Liability — you 'blame' a site."**
> The system never sends a notice; the officer does, and the notice carries the confidence, the
> drivers and the skill gate so it can be defended. Every step is on an immutable trail. Where the
> model lacks skill it abstains to cited priors.

**"Which city is using it?"**
> None yet. Ten cities run on it live from public data; the first pilot conversation is what we are
> asking for today.
