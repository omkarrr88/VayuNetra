# VayuNetra — finale pitch script (say it as written), ~7 minutes, three speakers

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
cd web && node scripts/qa/deck-render.mjs && cd ..
python3 docs/pitch/export_backup.py
```

Every number below is in the artifacts (`docs/benchmarks/*.json`, `docs/BENCHMARKS.md`,
`docs/OUTCOMES.md`, `docs/ATTRIBUTION_VALIDATION.md`, `docs/COVERAGE_VALIDATION.md`). **Say them as
written. Do not round up.**

---

## How this script is built (read this once)

Last year's finalists told us two things: judges often **stop the talk at about five minutes** once
they understand the product and go straight to questions, and they then test **how well you know
your own product** — scale, cost, reliability, why you built it this way, what breaks.

So the order is: the problem and who it is for → the loop in one breath → **the live product by
1:30** → then the proof, the cost and the close. If we are cut at five minutes, the judges have
already seen everything that matters, and the numbers are on slide 5 and in the appendix for
questions. **Nothing after the 5-minute mark is something we would be sad to lose.**

Three speakers, two handovers. Each handover is one spoken line, and the next person is already
moving on it. Practise the two handovers more than anything else.

All three say **"we"**, never "I built". Plain words. Short sentences. Breathe.

---

## Timing at a glance

| clock | slide / screen | who | what happens |
|---|---|---|---|
| 0:00 | 1 Title | **A** | who we are, what this is; the map behind us is live |
| 0:20 | 2 Problem | A | who uses it, what is broken today |
| 1:00 | 3 One loop | A | trace → predict → act → protect, once |
| **1:30** | **live app** | **B** | press **D** — resident page, morning brief, one cell, dossier + notice, approve → dispatch → close |
| **4:10** | **live app** | **C** | advisories in Hindi and Tamil, then Mumbai — **5-minute core ends at 5:05** |
| 5:05 | 4 Delhi's winter | C | press **D** back, **→** — the 9-second replay, stay silent through it |
| 5:45 | 5 Proof | C | the measured numbers, including the bad ones |
| 6:20 | 6 Recap | C | ten seconds: what you just saw, in four lines |
| 6:30 | 7 Built to deploy | C | cost, one config per city, PRANA |
| 6:55 | 8 Close | C | the ask |
| 7:15 | — | — | stop talking |

**Word budgets.** A ≈ 200 words. B ≈ 330 words over 2:40 of clicking. C ≈ 400 words over 3:05,
including the 9-second silence. If you are running fast, do not fill it — slow down on slide 8.

**If the judges cut in at five minutes:** you are on Mumbai or just past it. Say: *"That's the
loop. The benchmark numbers are on slide 5 and in the appendix — happy to take questions."* Then
press **D** once so the deck is back on screen. Do not try to finish the slides.

---

# SPEAKER A — slides 1 to 3 (0:00 → 1:30)

### Slide 1 · Title (0:00 → 0:20)
*(Stand still. Let the haze clear on screen before the first word.)*

> Good morning. We're Omkar, Sejal and Abhinav — team DaGoats. This is VayuNetra. India measures
> its air very well. What it doesn't have is the layer that acts on it. That's what we built. The
> map behind us is live.

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
*(Point at each card as you name it. Keep it to one breath each.)*

> One loop. **Trace** — who is to blame, square kilometre by square kilometre. **Predict** — the
> next seventy-two hours, with a probability attached, not a guess. **Act** — a ranked list of where
> to send an inspector, with the satellite image, the regulation, and a draft notice. **Protect** —
> the same signal to citizens, in eight languages. Five agents on one graph, and a gate that decides
> whether enforcement needs to run at all.
>
> **Enough slides. Here it is, live.**

*(A steps back. **B is already at the laptop** and presses **D** on that line.)*

---

# SPEAKER B — the live app, first half (1:30 → 4:10)

**Press D.** The app fills the screen, nothing of the deck over it. It opens on the front page —
the same door a judge would walk through.

### Stop 0 · What a resident sees (1:30 → 1:50)
*(Click **Check your city's air**. Let the index count up. Point at the "set by" line.)*

> Before the officer, the citizen. This is Delhi's air right now, on India's own National AQI — and
> the pollutant that's setting it today, which is PM10, not PM2.5. Every reading comes from the
> city's own CPCB stations. We own no hardware.

### Stop 1 · The morning brief (1:50 → 2:25)
*(Open the console. The brief is the first card.)*

> This is the one page a commissioner reads at eight in the morning. The city mean against
> yesterday. Where the air is about to turn — with the probability. The three actions worth taking
> today, each linked to its notice. And yesterday's dispatches. One click gives the PDF, one click
> sends it to every Telegram subscriber. And nothing on this page is written by a language model —
> every line is a template over stored numbers, so it cannot invent a health instruction.

### Stop 2 · One square kilometre (2:25 → 2:55)
*(Click a hexagon on the map. Let the cell story open.)*

> Every hexagon is one square kilometre. This one: who is to blame — the sources, and what moved the
> number. Where our local model hasn't earned the right to explain itself, it says so, in amber, and
> falls back to cited chemical-signature priors. That amber is a feature, not a bug. Below it, the
> seventy-two hour forecast for this cell, with its probability of turning Very Poor. Click any other
> cell — same story, its own numbers.

### Stop 3 · Evidence, then a notice (2:55 → 3:35)
*(Open the worklist, then the dossier, then the draft notice.)*

> The worklist ranks sources by how much they contribute, how many people are exposed, how
> actionable they are, and how confident we are. Open the dossier: a real satellite image of this
> site, the regulation retrieved word for word — GRAP only where it legally applies, CPCB norms and
> the national programme everywhere else — and a draft notice with the projected effect of
> compliance. It's stamped *pending officer authorisation*. Nothing is ever sent automatically.

### Stop 4 · The loop closes (3:35 → 4:10)
*(Approve. Dispatch. Close with a finding. Then open History.)*

> Now the officer approves — it lands in the ward's field queue. Dispatches — the cell's seven-day
> baseline freezes, and the before-and-after measurement starts. Closes the case with what the team
> actually found. And History: who did what, when, from what state to what state. That trail
> survives the nightly run, and it survives deleting the record itself. This is the audit trail a
> court would ask for.
>
> **That's the officer's half. The other half is telling three crore people what to do about it
> today.**

*(**C takes the laptop on that line.** B steps back.)*

---

# SPEAKER C — the live app, second half, then the proof and the close (4:10 → 7:15)

### Stop 5 · Eight languages, four channels (4:10 → 4:45)
*(Advisories. Switch the language to Hindi, then Tamil. Then the channel tabs: App, Telegram, IVR.)*

> The same advisory in the reader's own script — Hindi, then Tamil. Templated on purpose, so it can
> never hallucinate medical advice, and checked in code so an untranslated line can't slip out. It
> goes out over the app, a live Telegram bot, a phone line that speaks it in that language, and
> public display boards — aimed at the places that need it first: hospitals, schools, elder care,
> outdoor work.

### Stop 6 · Ten cities, one engine (4:45 → 5:05)
*(Cities. Click Mumbai and let the whole console follow.)*

> Ten cities on one scoreboard. One engine, one configuration file per city. Click Mumbai and the
> entire console follows — its own sources, its own forecast, its own worklist, its own languages.
>
> **That's the loop. Now — does it actually work? Let me show you the numbers.**

*— — — the 5-minute core ends here. If the judges stop you, go to Q&A from here — — —*

*(**Press D.** The deck returns on slide 3. Press **→** to slide 4.)*

### Slide 4 · Delhi's winter, replayed (5:05 → 5:45)
*(The replay starts on entry and runs 9 seconds. Say the first sentence, then **stop talking** until
the December marker drops. Press **R** if you need it again.)*

> This is Delhi's last winter, day by day, across thirty-nine station cells — real CPCB data.
>
> *(silence while it plays — do not talk over it)*
>
> The red markers are the government's actual GRAP orders. Under each one: what our forecast said
> twenty-four hours before that order was signed. Stage Three in November and Stage Four in December
> — both flagged a full day ahead, across essentially the whole network, above eighty percent
> probability — when the simple "tomorrow equals today" baseline said 225 and the city measured 407.
> The two October orders we did not foresee. That's on the slide too.

### Slide 5 · Proof (5:45 → 6:20)
*(Left chart, middle chart, right chart. Slow down here.)*

> Every number here is measured, including the ones that don't flatter us. Against persistence, on a
> strict time split: Delhi plus nine, thirteen and twelve percent at one, two and three days. Our
> alarm catches fifty-four percent of clean-to-Very-Poor turns, days ahead; persistence catches
> none. The eighty percent band really covers seventy-eight. Attribution agrees with the published
> studies. Nine of ten cities beat persistence with the interval clear of zero; the tenth we can't
> separate from it — and we say so.

### Slide 6 · Recap (6:20 → 6:30)
*(Ten seconds. Don't read the slide.)*

> That's what you just saw, in four lines: brief, blame map, worklist to notice, advisories in eight
> scripts.

### Slide 7 · Built to deploy (6:30 → 6:55)

> Built to deploy, not to demo. Ten cities live, one config file each, no per-city code — we brought
> seven metros on in a week. We measured what a city costs: about a fifth of a megabyte of readings a
> day. The free tier carries everything you saw, and all hundred and thirty-one national-programme
> cities would run for roughly two thousand seven hundred rupees a month. Every dispatched action is
> tracked against its own cell and exports in the format the official reporting portal takes — we
> feed that system, we don't compete with it.

### Slide 8 · Close (6:55 → 7:15)
*(Stand still. Say it slower than feels natural.)*

> We didn't build a prettier dashboard. We built the layer that turns a reading into a traced, cited,
> delivered, closed action. And we ran the tests that could embarrass us — our one-kilometre field
> beats a flat city average in one city out of ten, and we published that, with the script that
> produced it. It's live in ten cities right now, on infrastructure that costs nothing. The one thing
> it has never had is an afternoon of a real officer's time. That's all that stands between this and
> a working pilot. Thank you.

---

## Before the session — on the presenting laptop

1. `make dev` — API on :8000 and the web app on :5173. Wait for both.
2. Open `http://localhost:5173/console?city=delhi` in Chrome once. Dismiss the tour. Click through
   Enforcement → Forecast → Advisories → Cities → Simulator → Pipeline so nothing cold-starts. Leave
   **Delhi** selected. Open one cell story so the map has painted.
3. Open `docs/VayuNetra_Pitch.html` in a new tab, press **D** once and check the overlay shows
   `localhost:5173` (bottom-right of the deck shows which target it picked). Press **D** to come back.
4. Close every other tab and window. Notifications off. Plug the charger in. Brightness 100%.
5. If the laptop will be on a projector: set it to **mirror**, not extend — the deck goes full-screen
   on the laptop, the room sees the same thing.
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
| You are running long | Cut **Slide 6** (ten seconds) and the last sentence of **Slide 7**. Never cut the close. |
| You are cut at five minutes | Say the line above, press **D**, take questions. The numbers are on slide 5; A1–A14 are for questions. |

---

## Questions we should expect — and the short, true answers

Last year the judges spent the second half on these. Answer in two or three sentences, then stop.
The long answers live in the user guide (220 Q&As) and the appendix slides A1–A14 — pull one up
if they want depth.

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
