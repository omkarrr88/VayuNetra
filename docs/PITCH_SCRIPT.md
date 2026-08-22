# VayuNetra — finale pitch script (say it as written), ~8½ minutes, three speakers

**Speakers.** **Abhinav** opens — the problem, who it is for, why it matters, the loop, and the
winter replay (slides 1–4). **Sejal** runs the heart of the demo — the officer's loop from the
morning brief to a closed case, and the citizen advisories. **Omkar** finishes the demo — the rest
of the console and the public site in quick strokes — then the measured numbers (slide 5), how it is
built (slide 7), and the close (slide 8). All three say **"we"**, never "I built".

**Deck:** `docs/VayuNetra_Pitch.html` — open in Chrome. It goes full-screen on your first key press
or click, so browser chrome never shows; **F** toggles it by hand. Self-contained, works offline.
Backups: `docs/VayuNetra_Pitch.pptx` / `.pdf` — same slides, static, notes included.

**Keys:** `← →` next/previous · `F` full-screen · `N` notes · `P` presenter window · `D` live app
(**press D again to come back**) · `R` replay the slide's animation.

> **D is the only way in and out of the live app.** Escape is left alone deliberately — it also
> exits full screen. D works even after you have clicked inside the app: the app forwards the key
> back to the deck.

**Which app the demo opens.** The deck looks for a dev server on the presenting laptop
(`localhost:5173`) and uses it if it answers within about a second; otherwise it opens the deployed
site, `vayunetra-aqi.vercel.app`. **We present from the laptop** — local is faster and survives bad
Wi-Fi. The checklist is at the bottom.

**Rebuild the morning of the finale** (fresh numbers on the title map, slide 3, slide 7, A8):
```
.venv/bin/python docs/pitch/build_pitch_data.py     # API on :8000, DEMO_MODE=false, warm cache
.venv/bin/python docs/pitch/build_deck.py
cd web && node scripts/qa/pitch-shots.mjs && node scripts/qa/deck-render.mjs && cd ..
python3 docs/pitch/export_backup.py
```

Every number below is in the artifacts (`docs/benchmarks/*.json`, `docs/BENCHMARKS.md`,
`docs/OUTCOMES.md`, `docs/ATTRIBUTION_VALIDATION.md`, `docs/COVERAGE_VALIDATION.md`, `docs/SCALE.md`).
**Say them as written. Do not round up.**

---

## How this script is built (read this once)

A finalist from last year told us how the judging actually went: ten minutes allotted, but the
judges **stopped the talk at about five minutes** once they understood the product, and then spent
the rest testing **how well the team knew their own product** — who uses it, what it costs, how it
scales, why it is built this way, what breaks. They wanted a product solving a real problem, not a
hackathon project showing off AI features.

So: Abhinav makes the problem and the user concrete and shows the one piece of proof that needs no
explanation (the winter replay); the product is on screen by **2:10**; every screen gets **one
plain sentence about the technology behind it**, said while it is on screen; the numbers and the
architecture come at the end. **If we are cut at five minutes, the judges have seen the problem,
the replay, and the officer's loop through to the draft notice** — and the rest is in the appendix
for questions.

Two handovers. Each is one spoken line, and the next person is already moving on it. Practise the
two handovers more than anything else.

Plain words. Short sentences. Breathe. Look at the judges, not the screen.

---

## Timing at a glance

| clock | slide / screen | who | what happens |
|---|---|---|---|
| 0:00 | 1 Title | **Abhinav** | who we are, what this is; the map behind us is live |
| 0:20 | 2 Problem | Abhinav | who uses it, what is broken today |
| 1:00 | 3 One loop | Abhinav | trace → predict → act → protect, once |
| 1:30 | 4 Delhi's winter | Abhinav | the 9-second replay against the real GRAP orders |
| **2:10** | **live app** | **Sejal** | press **D** — resident page, morning brief, one cell, worklist → dossier → notice, approve → dispatch → close, advisories in two scripts |
| **5:25** | **live app** | **Omkar** | clean air + health, Cities, Simulator, Impact, Pipeline, public site — quick strokes |
| 7:25 | 5 Proof | Omkar | press **D** back, **→** — the measured numbers, including the bad ones |
| 7:55 | 7 Built to deploy | Omkar | how it is built, what it costs, how a city joins |
| 8:20 | 8 Close | Omkar | the ask |
| 8:40 | — | — | stop talking |

**Word budgets.** Abhinav ≈ 290 words over 2:10 (incl. 9 s of silence). Sejal ≈ 420 words over
3:15 of clicking. Omkar ≈ 430 words over 3:15. If you are running fast, do not fill it — slow down on
slide 8.

**If the judges cut in at five minutes:** Sejal is at or just past the approve → dispatch → close
loop. She says: *"That's the officer's loop. The rest of the console, the numbers and how it's
built are all in the appendix — happy to take questions."* Press **D** once so the deck is back on
screen. Do not try to finish.

---

# ABHINAV — slides 1 to 4 (0:00 → 2:10)

### Slide 1 · Title (0:00 → 0:20)
*(Stand still. Let the haze clear on screen before the first word.)*

> Good morning. We're Omkar, Sejal and Abhinav — team DaGoats. This is VayuNetra. India measures
> its air very well. What it doesn't have is the layer that acts on it. That's what we built, and
> the map behind us is live.

### Slide 2 · The problem (0:20 → 1:00)
*(Counters animate on entry. Pause one beat, then speak. Point at "31%" when you say it.)*

> Here's the gap. Nine hundred monitoring stations, satellites overhead — the data exists. And 1.67
> million Indians still die early every year. The problem isn't measurement. A reading turns red,
> and then nothing happens. No system tells the officer on duty who is polluting this square
> kilometre right now, what the air will do tomorrow, or where to send the first inspector. The
> national auditor found fewer than a third of monitored cities have *any* response protocol. Delhi
> last winter: thirteen of seventeen GRAP orders were signed *after* the air had already crossed the
> line.
>
> So who is this for? The pollution-control board — the people in that ops room who sign those
> orders and send those inspectors. And the citizens on the other end of it.

### Slide 3 · One loop (1:00 → 1:30)
*(Point at each card as you name it. One breath each.)*

> One loop. **Trace** — who is to blame, square kilometre by square kilometre. **Predict** — the
> next seventy-two hours, with a probability attached, not a guess. **Act** — a ranked list of where
> to send an inspector, with the satellite image, the regulation, and a draft notice. **Protect** —
> the same signal to citizens, in eight languages. Underneath: five AI agents on one graph, and a gate
> that decides whether enforcement needs to run at all.

### Slide 4 · Delhi's winter, replayed (1:30 → 2:10)
*(The replay starts on entry and runs 9 seconds. Say the first sentence, then **stop talking** until
the December marker drops. Press **R** if you need it again.)*

> Before we show you the product — one piece of proof. This is Delhi's last winter, day by day,
> across thirty-nine station cells. Real CPCB data.
>
> *(silence while it plays — do not talk over it)*
>
> The red markers are the government's actual GRAP orders. Under each one: what our forecast said
> twenty-four hours before that order was signed. Stage Three in November and Stage Four in December
> — both flagged a full day ahead, above eighty percent probability, when the simple
> "tomorrow equals today" baseline said 225 and the city measured 407. The two October orders we did
> not foresee — that's on the slide too.
>
> **So it works in hindsight. Sejal will show you it working right now.**

*(Abhinav steps back. **Sejal is already at the laptop** and presses **D** on that line.)*

---

# SEJAL — the live app, the officer's loop and the citizens (2:10 → 5:25)

**Press D.** The app fills the screen, nothing of the deck over it. It opens on the front page —
the same door a judge would walk through.

### Stop 1 · What a resident sees (2:10 → 2:30)
*(Click **Check your city's air**. Let the index count up. Point at the "set by" line.)*

> Before the officer, the citizen. This is Delhi's air right now, on India's own National AQI, and the
> pollutant that's setting it today. Every reading comes from the city's own CPCB stations — we pull
> them through OpenAQ every hour. We own no hardware. *(tech: the scale toggle at the top switches
> the same readings to US-EPA or WHO — one formula, three scales.)*

### Stop 2 · The morning brief (2:30 → 3:00)
*(Open the console. The brief is the first card.)*

> This is the one page a commissioner reads at eight in the morning. The city mean against
> yesterday. Where the air is about to turn — with the probability. The three actions worth taking
> today, each linked to its notice. And yesterday's dispatches. One click gives the PDF, one click
> sends it to every Telegram subscriber. *(tech:)* Nothing on this page is written by a language model
> — every line is a template over stored numbers, so it cannot invent a health instruction.

### Stop 3 · One square kilometre (3:00 → 3:35)
*(Click a hexagon on the map. Let the cell story open. Point at the amber block if it is there.)*

> Every hexagon is one square kilometre — an H3 cell; the faint green underneath is our modelled
> PM2.5 field for the whole city, and the sharp cells on top are where we know who is to blame. This
> one: the sources, and what moved the number. *(tech:)* That's a gradient-boosted model with SHAP
> explanations per cell — and where the local model hasn't earned the right to explain itself, it
> says so, in amber, and falls back to cited chemical-signature priors. That amber is a feature.
> Below: the seventy-two hour forecast for this cell, with its probability of turning Very Poor —
> *(tech:)* LightGBM quantile models, blended with persistence, and an eighty percent band calibrated
> with conformal prediction, so eighty really means eighty.

### Stop 4 · Evidence, then a notice (3:35 → 4:20)
*(Open the worklist, then the dossier, then the draft notice.)*

> The worklist ranks sources by how much they contribute, how many people live in that cell — that's
> the GPW population grid, not a guess — how actionable it is, and how confident we are. The sources
> themselves come from OpenStreetMap and from Sentinel-2 satellite detections, and each card says
> which. Open the dossier: a real satellite image of this site, pulled from Earth Engine; the
> regulation retrieved word for word — *(tech:)* that's retrieval over the actual GRAP and CPCB text
> with vector search, not a language model writing law — GRAP only where it legally applies; and a
> draft notice with the projected effect of compliance. It's stamped *pending officer authorisation*.
> Nothing is ever sent automatically.

### Stop 5 · The loop closes (4:20 → 4:55)
*(Approve. Dispatch. Close with a finding. Then open History.)*

> Now the officer approves — it lands in the ward's field queue. Dispatches — the cell's seven-day
> baseline freezes and the before-and-after measurement starts, from the cell's own readings. Closes
> the case with what the team actually found. And History: who did what, when, from what state to
> what state. *(tech:)* That's an append-only log in Postgres — it survives the nightly run, and it
> survives deleting the record itself. This is the audit trail a court would ask for.

### Stop 6 · Eight languages, four channels (4:55 → 5:25)
*(Advisories. Switch the language to Hindi, then Tamil. Then the channel tabs: App, Telegram, IVR.)*

> The other half of the job is telling three crore people what to do about it today. The same
> advisory in the reader's own script — Hindi, then Tamil. *(tech:)* Templated on purpose, so it
> can never hallucinate medical advice, and checked in code so an untranslated line can't slip out.
> It goes out over the app, a live Telegram bot you can subscribe to right now, a phone line that
> speaks it in that language, and public display boards — aimed at the places that need it first:
> hospitals, schools, elder care, outdoor work, scored from OpenStreetMap and population.
>
> **That's the citizens covered. Omkar — the rest of the console, and how the whole thing runs.**

*(**Omkar takes the laptop on that line.** Sejal steps back.)*

---

# OMKAR — the rest of the product in quick strokes, the numbers, how it is built, the close (5:25 → 8:40)

*(Short sentences here. Every page gets named, none gets a speech.)*

### Stop 7 · Clean air and health — same section (5:25 → 5:40)
*(Scroll down in Advisories: Cleanest air, then "What today's air does to people".)*

> Two more things for citizens, same page. The cleanest air in the city right now — the cleanest
> kilometre cells from that modelled field, with directions. And what today's air does to people:
> cigarettes-a-day equivalence, and do's and don'ts by condition — every line from CPCB and WHO
> tables, with the sources printed underneath.

### Stop 8 · Cities (5:40 → 6:00)
*(Cities. Click Mumbai and let the whole console follow. Come back to Delhi if there is time.)*

> Ten cities on one scoreboard, ranked by the same number the badge uses, with each city's dominant
> source and what worked elsewhere. One engine, one configuration file per city — *(tech:)* a
> bounding box, the languages, the authority. Click Mumbai and the entire console follows: its own
> sources, its own forecast, its own worklist, its own languages.

### Stop 9 · Simulator (6:00 → 6:25)
*(Simulator. Point at the catalogue — the card tagged "matches the dominant source". Run it once only
if the result is already cached; otherwise just describe.)*

> Before spending money: the simulator. Five levers, and for each one the share of today's PM2.5 it
> can actually touch — so a ban on something that isn't in the air says "little effect" before you
> press the button. *(tech:)* Run one and it's a counterfactual over attribution and forecast, with
> people protected and the health cost avoided priced from WHO dose-response — and an optimiser that
> ranks bundles of levers per inspector-hour.

### Stop 10 · Impact (6:25 → 6:50)
*(Impact. Point at the funding case, then the fairness audit.)*

> Impact is the funding case a commissioner takes upstairs: this city's annual health burden in lives
> and rupees, and what the NCAP target would avert — *(tech:)* long-term dose-response from the
> published literature times the population grid; every figure has its source, five of them, listed.
> Where the funds should go follows the live attribution. And the fairness audit: the ranking has
> no income or land-value input by construction, and we measure that on every live recommendation.

### Stop 11 · Pipeline (6:50 → 7:10)
*(Pipeline. The graph is on screen. Press "Run agents live" only if the room is patient — it takes a
few seconds; otherwise point at the last run's timings.)*

> And the part judges usually ask about: is the multi-agent claim real? This is the graph — five
> agents and a gate, *(tech:)* LangGraph, every node stamped — and the last run's timings on it. The
> gate decided there was no spike this morning, so enforcement was skipped — honestly drawn, not
> hidden. Signal to cited recommendation in about a second. It runs on GitHub Actions: ingest every
> hour, models and enforcement every night.

### Stop 12 · The public site, ten seconds (7:10 → 7:25)
*(Click **Public site**. Flick through: Live map, Rankings, How it works. Do not linger.)*

> The same engine has a public face — the live map, the ten-city ranking, and a "how it works" page
> that tells citizens exactly what's a measurement and what's a model. It installs as an app on a
> phone.
>
> **Now — does it actually work, and what does it take to run?**

*(**Press D.** The deck returns on slide 4. Press **→** to slide 5.)*

### Slide 5 · Proof (7:25 → 7:55)
*(Left chart, middle chart, right chart. Slow down.)*

> Every number here is measured, including the ones that don't flatter us. Against persistence, on a
> strict time split: Delhi plus nine, thirteen and twelve percent at one, two and three days. Our
> alarm catches fifty-four percent of clean-to-Very-Poor turns, days ahead; persistence catches
> none. The eighty percent band really covers seventy-eight. Attribution agrees with the published
> studies. Nine of ten cities beat persistence with the interval clear of zero; the tenth we can't
> separate from it — and we say so.

*(Press **→** past slide 6 — it is the recap of what you just showed; say nothing on it — to slide 7.)*

### Slide 7 · Built to deploy (7:55 → 8:20)

> Built to deploy, not to demo. *(tech, one breath:)* FastAPI on Render, React with MapLibre and
> deck.gl on Vercel, Postgres with PostGIS and pgvector on Supabase, LightGBM on CPU, LangGraph for
> the agents, GitHub Actions for the crons — every one of them on a free tier, which is what this
> whole deployment costs today. Ten cities, one config file each, no per-city code — we brought
> seven metros on in a week. We measured what a city costs: about a fifth of a megabyte of readings a
> day; all hundred and thirty-one national-programme cities would run for roughly two thousand seven
> hundred rupees a month. And every dispatched action exports in the format the official reporting
> portal takes — we feed that system, we don't compete with it.

### Slide 8 · Close (8:20 → 8:40)
*(Stand still. Say it slower than feels natural.)*

> We didn't build a prettier dashboard. We built the layer that turns a reading into a traced, cited,
> delivered, closed action. It runs live in ten cities, every hour, and we ran
> the tests that could embarrass us — our one-kilometre field beats a flat city average in one city
> out of ten, and we published that, with the script that produced it. The one thing it has never had
> is an afternoon of a real officer's time. That's all that stands between this and a working pilot.
> Thank you.

---

## Before the session — on the presenting laptop

1. `make dev` — API on :8000 and the web app on :5173. Wait for both.
2. Open `http://localhost:5173/console?city=delhi` in Chrome once. Dismiss the tour. Click through
   Enforcement → Forecast → Advisories → Cities → Simulator → Impact → Pipeline so nothing
   cold-starts. Leave **Delhi** selected. Open one cell story so the map has painted. Open one
   dossier so the satellite patch is cached. Run one simulation so the result is cached.
3. Open `docs/VayuNetra_Pitch.html` in a new tab, press **D** once and check the overlay shows
   `localhost:5173` (bottom-right of the deck shows which target it picked). Press **D** to come back.
4. Close every other tab and window. Notifications off. Plug the charger in. Brightness 100%.
5. If the laptop will be on a projector: set it to **mirror**, not extend — the deck goes full-screen
   on the laptop, the room sees the same thing. Test the projector once with the deck at slide 4.
6. If for any reason you present from the deployed site instead: open `vayunetra-aqi.vercel.app`
   ten minutes before and run `make prewarm` so the Render API is awake — and remember the deck
   only uses the deployed site when `localhost:5173` is not answering.

## If something goes wrong

| what happens | what to say, without stopping |
|---|---|
| Amber "backend waking up" banner | "That's our demo insurance — the free-tier host sleeps, and the app shows a labelled snapshot rather than a blank screen." Keep going; it clears on the first live call. |
| A panel is empty | "That city has thin data in this window — here's one with more." Switch to Delhi. |
| The map does not paint | Press **D** to return to the deck; the same screenshot is on the slide, labelled. Say the same words. |
| A judge asks something mid-demo | Answer in one sentence and say "there's more on that in a moment" — don't lose the loop. |
| You are running long | Omkar cuts Stop 12 (public site) and the last sentence of slide 7. Never cut the close. |
| You are cut at five minutes | Sejal says the line above, presses **D**, takes questions. Slide 5 and A1–A14 are for questions. |

---

## Questions we should expect — and the short, true answers

Last year the judges spent the second half on these. Answer in two or three sentences, then stop.
Whoever knows the number best takes the question; the others add one line at most. The long answers
live in the user guide (220 Q&As) and the appendix slides A1–A14 — pull one up if they want depth.

**Who actually uses this? Is it research or a product?** — A product for the pollution-control
board's operations room: the people who sign GRAP-type orders and send inspectors — in Delhi that's
CAQM and DPCC; in other states the board and the municipal corporation. Citizens are the second
user, on the receiving end. It runs live in ten cities today.

**Has a real officer used it?** — No. Say it in one sentence, then what exists instead: the audit
trail that records what they'd do, the notice they'd sign, and the rating rubric we built for the
advisories. One afternoon of an officer's time is the next step, and the ask.

**How does it scale?** — One city is one YAML file: bounding box, languages, the authority. We
brought seven metros on in one week. All 131 NCAP cities would cost about ₹2,700 a month on
measured numbers (docs/SCALE.md): one row per reading, about a fifth of a megabyte a day per city,
180-day raw retention with an archive. Nothing is per-city code.

**What does inference cost? How fast is it?** — The models are LightGBM on CPU — no GPU anywhere.
Signal to cited recommendation runs in about a second, measured live and stamped per node. The
whole deployment sits on free tiers today. (If asked about TFT: we trained one on a GPU and rejected
it — LightGBM won every city on held-out skill.)

**What happens when the free tier sleeps, or the network dies?** — Keep-alive pings keep the API
warm; if it still sleeps, the app shows the last captured snapshot, labelled, and swaps to live data
on the first answer. The deck falls back to a labelled screenshot. Ingest runs on GitHub Actions,
hourly; the enforcement worklist regenerates nightly and keeps acted-upon items by id.

**Why these technical choices?** — H3 hexagons at about one kilometre because that's the unit an
inspector is sent to; LightGBM with conformal calibration because it won on held-out skill and gives
honest bands; SHAP attribution with a gate that abstains below a skill threshold, falling back to
cited chemical-signature priors; LangGraph for the five agents with a conditional gate, so a
clean-air city doesn't run enforcement at all; templates instead of an LLM for anything a citizen or
officer reads; Supabase + Render + Vercel because they're free and have done the job for ten cities.

**Where do the satellite-detected sources come from? Is that a real model?** — Sentinel-2 through
Earth Engine, with a heuristic detector (bare-soil and brightness rules) — we call it a heuristic on
the card and in the notice, with its confidence. The registered sources come from OpenStreetMap. We
have a CNN path in the code; the heuristic is what runs in production today because it is explainable and needs no GPU.

**Is this AI, or a dashboard?** — Two model families with measured skill, a conformal calibration
layer, SHAP-based source apportionment that knows when to abstain, and a state machine that routes on
a detected condition. And the counterweight, on purpose: no language model writes anything a citizen
reads — a hallucinated medical instruction reaching a phone line in Marathi is not a risk we'll take.

**Your forecast loses to persistence somewhere — why trust it?** — One city, Hyderabad, and the
interval spans zero, so the honest answer is "we can't separate it from the baseline there", not
"it loses". Jaipur *was* genuinely negative until we found the cause: station discovery searched a
circle around the map centre instead of the city's extent, so a third of the city was never
sampled. Fixing that moved Jaipur from minus sixteen to plus ten. We can tell you which cities are
weak, with intervals — most systems cannot.

**You said your 1 km field fails — so why show it?** — Because the grid is how everything is
organised: attribution, forecasts and the worklist are all per cell, and those we can measure. The
test is narrower than it sounds: a cell *without* a monitor carries a spatial prior, not a
measurement, and we label it that way. These are monsoon readings — flat — the regime a constant is
hardest to beat. We re-run it in winter.

**Most of your Delhi cells show "priors-based share". Isn't that the model failing?** — Yes, in
monsoon Delhi the local model fails the skill gate in most cells, and we print that on every card
rather than hide it. The share then comes from published chemical-signature inventories, cited. The
alternative — a confident number from a model with zero held-out skill — is the thing we refuse to
ship.

**What are the limits? What would you fix with more time?** — No officer pilot yet. SHAP is off in
cells where the data is thin (the amber fallback). The Severe tail of the forecast is weak — we say
so. Mumbai's primary apportionment study isn't in hand, so its anchor is a synthesis. With more time:
the pilot, the winter re-run, an expert review of the advisories, and denser NO₂ so SHAP covers more
of each city.

**Where does the data come from? Who owns it?** — CPCB stations via OpenAQ, Open-Meteo and ERA5
weather, Sentinel-5P and Sentinel-2 via Earth Engine, OpenStreetMap, the GPW population grid — all
open. No personal data. Telegram subscribers are a chat id. Row-level security; the API holds the
only write key.

**How does it get adopted? Who pays?** — It feeds the official reporting portal (PRANA) rather than
competing with it — every tracked action exports in that format. Adoption is one YAML plus a
backfill run. Infrastructure is ₹0 to ₹2,700 a month; the cost is an officer's time, which is why
the ask is a pilot, not a contract. Procurement routes: the state board, a smart-city SPV, or CSR.

**Market — why now?** — NCAP covers 131 cities with targets and money; GRAP is statutory in Delhi-NCR
and already staged; the CAG audit says the response layer is missing. The data and the mandate exist;
the operations layer doesn't. That's the gap.

**What did each of you do?** — We say "we" on purpose: all three of us touched every layer. If
pressed, one line each on what you spent the most time in, then back to "we".
