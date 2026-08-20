# VayuNetra — finale pitch script (verbatim), 8 minutes, three speakers

**Deck:** `docs/VayuNetra_Pitch.html` — open in Chrome. It goes full-screen on your first key press
or click, so browser chrome never shows; **F** toggles it by hand. Self-contained, works offline.
Backups: `docs/VayuNetra_Pitch.pptx` / `.pdf` — same slides, static, notes included.

**Keys:** `← →` next/previous · `F` full-screen · `N` notes · `P` presenter window · `D` live app
(**press D again to come back**) · `R` replay the slide's animation.

> **D is the only way in and out of the live app.** Escape is left alone deliberately — it also
> exits full screen, and one press used to do both. D works even after you have clicked inside the
> app: the app forwards the key back to the deck.

**Which app the demo opens.** The deck looks for a dev server on the presenting laptop
(`localhost:5173`) and uses it if it answers within about a second; otherwise it opens the deployed
site, `vayunetra-aqi.vercel.app`. Local is faster and survives a dead network.

**Rebuild the morning of the finale** (fresh numbers on the title map, slide 3, slide 7, A8):
```
.venv/bin/python docs/pitch/build_pitch_data.py     # API on :8000, DEMO_MODE=false, warm cache
.venv/bin/python docs/pitch/build_deck.py
cd web && node scripts/qa/deck-render.mjs && cd ..
python3 docs/pitch/export_backup.py
```

Every number below is in the artifacts (`docs/benchmarks/*.json`, `docs/BENCHMARKS.md`,
`docs/OUTCOMES.md`, `docs/ATTRIBUTION_VALIDATION.md`). **Say them as written. Do not round up.**

---

## Timing at a glance

| clock | slide / screen | who | what happens |
|---|---|---|---|
| 0:00 | 1 Title | **A** | hook; the map is live |
| 0:25 | 2 Problem | A | the gap between measuring and acting |
| 0:55 | 3 One loop | A | four verbs, named once |
| 1:35 | 4 Delhi's winter | A | the replay runs 9 s — stay silent through it |
| 2:20 | 5 Proof | A | the measured numbers, including the bad ones |
| **3:00** | **live app** | **B** | press **D** — resident view, brief, cell story, worklist, the officer loop |
| **5:45** | **live app** | **C** | advisories, validation, ten cities — then **D** back to the deck |
| 7:15 | 7 Built to deploy | C | cost, one config per city, PRANA |
| 7:40 | 8 Close | C | the ask |
| 8:00 | — | — | stop talking |

**Word budgets, measured.** A speaks 439 words (≈2:56 at 150 wpm, plus the 9-second replay silence).
B speaks 367 words over 2:27 of clicking. C speaks 344 words over 2:18, demo and close together.
**Spoken total 7:49**, which leaves about ten seconds of headroom across the two handovers. If you
are running fast, do not fill it — slow down on slide 8.

All three say **"we"**, never "I built".

**Handovers are spoken, not mimed.** Each speaker ends on a line that names what comes next, and
the next speaker starts moving on that line. Practise the three handovers more than anything else —
they are where a three-person pitch usually loses ten seconds.

---

# SPEAKER A — slides 1 to 5 (0:00 → 3:00)

### Slide 1 · Title (0:00 → 0:25)
*(Stand still. Let the haze clear on screen before the first word.)*

> Good morning. Every Indian metro measures its air. Several forecast it. Almost nothing acts on it.
> VayuNetra is the operations layer: it traces who is polluting each square kilometre, predicts the
> next seventy-two hours with honest probabilities, ranks where to send an inspector with cited
> evidence, and tells citizens in their own script — live in ten cities, at zero infrastructure
> cost. The map behind me is live.

### Slide 2 · The problem (0:25 → 0:55)
*(Counters animate on entry. Pause one beat, then speak.)*

> The data already exists — nine hundred monitoring stations, satellites overhead — and 1.67 million
> Indians still die early each year. The gap is not measurement. A reading turns red, and nothing
> happens: nothing tells an officer who is polluting this square kilometre, what the air does
> tomorrow, or where to send the first inspector. The national auditor found fewer than a third of
> monitored cities have any response protocol at all. Cities do not need another dashboard.

### Slide 3 · One loop (0:55 → 1:35)
*(Point at each card as you name it.)*

> One loop, four verbs. **Trace** — who is to blame in each square kilometre, and it says so where it
> lacks the skill to know. **Predict** — the next seventy-two hours, with each cell's probability of
> turning Very Poor. **Act** — sites ranked by contribution, people exposed and confidence; a real
> satellite image, the regulation itself, a draft notice, approved and dispatched and closed on an
> audit trail. **Protect** — advisories in eight scripts over four channels. Five agents on one
> graph, and a gate that decides whether enforcement runs at all.

### Slide 4 · Delhi's winter, replayed (1:35 → 2:20)
*(The replay starts on entry and runs 9 seconds. Say the first sentence, then **stop talking** until
the December marker drops. Then continue. Press **R** if you need it again.)*

> This is Delhi's last winter, day by day, across thirty-nine station cells — real CPCB data.
>
> *(silence while it plays — do not narrate over it)*
>
> The markers are the government's actual GRAP orders. Under each: what our forecast said twenty-four
> hours before that order was signed. Stage Three in November and Stage Four in December — both
> flagged a full day ahead across essentially the whole network, above eighty percent probability,
> when persistence said 225 and the city measured 407. The two October orders we did not foresee.
> That is on the slide too.

### Slide 5 · Proof (2:20 → 3:00)
*(Left chart, middle chart, right chart. Then the bridge line — and B starts moving on it.)*

> Every number here is measured, including the ones that do not flatter us. Skill over persistence on
> a strict temporal split: Delhi plus nine, thirteen and twelve percent at one, two and three days.
> Our calibrated alarm catches fifty-four percent of clean-to-Very-Poor transitions days ahead;
> persistence catches none. The eighty percent band measures seventy-eight percent real coverage.
> Attribution agrees with the published studies to four percentage points. Nine of our ten cities
> beat persistence with the interval clear of zero; the tenth we cannot separate from it, and we
> publish that rather than round it away.
>
> **Others forecast the air. Nothing turns a forecast into a traced, cited, delivered, closed
> action. Here it is, live.**

*(A presses **→** to slide 6 and steps back. **B is already at the laptop.**)*

---

# SPEAKER B — the live app, first half (3:00 → 5:45)

**Before the session, on this laptop, in this browser.** If presenting from the local build, run
`make dev` first — the deck detects the dev server and uses it, which is faster and survives a dead
network. Otherwise open `vayunetra-aqi.vercel.app` once and run `make prewarm` so the API is awake.
Either way: open the console once, dismiss the tour, click through Enforcement → Forecast →
Advisories → Cities so nothing cold-starts, and leave **Delhi** selected.

If the network dies mid-demo, the deck falls back to the last screenshot, labelled. Narrate the same
words over it and keep going.

**Press D.** The app fills the screen edge to edge with nothing of the deck over it. It opens on the
front page — the same door a judge would walk through.

### Stop 0 · What a resident sees (3:00 → 3:20)
*(Click **Check your city's air**. Let the index count up. Point at the prominent-pollutant line.)*

> Before the officer, the citizen. Delhi's air right now on India's own National AQI — and the
> pollutant setting it, which today is PM10, not PM2.5. Every reading here comes from that city's own
> CPCB stations. No hardware of ours anywhere.

### Stop 1 · The morning brief (3:20 → 3:55)
*(Open the console. The brief is the first card.)*

> This is the one page a commissioner reads. The city mean against yesterday. Where the air is about
> to turn — with the probability, not a guess. The three actions worth taking today, each linked to
> its notice. And yesterday's dispatches. One click gives the PDF; one click sends it to every
> Telegram subscriber. Nothing on this page is written by a language model — every line is a
> template over stored numbers, so it cannot invent a health instruction.

### Stop 2 · One square kilometre (3:55 → 4:30)
*(Click a hexagon on the map.)*

> Every hexagon is a square kilometre. This one: who is to blame — the sources, and the drivers that
> moved the number. Where the local model has not earned the right to explain itself, it says so and
> falls back to cited chemical-signature priors, in amber. That amber is the feature. Below it, the
> seventy-two hour forecast for this cell with its calibrated probability of Very Poor. Click any
> other cell and you get the same story with its own numbers.

### Stop 3 · Evidence, then a notice (4:30 → 5:10)
*(Open the worklist, then the dossier, then the draft notice.)*

> The worklist ranks sources by contribution, people exposed, how actionable it is, and confidence.
> Nothing under two percent gets in. Open the dossier: the real satellite image of this site, the
> regulation retrieved word for word — GRAP only where it legally binds, CPCB norms and the national
> programme elsewhere — and a draft notice with the projected effect of compliance. It is stamped
> pending officer authorisation. It is never sent automatically.

### Stop 4 · The loop closes (5:10 → 5:45)
*(Approve. Dispatch. Close with a finding. Then open History.)*

> The officer approves — it lands in the ward's field queue. Dispatches — the cell's seven-day
> baseline freezes and the before-and-after measurement arms itself. Closes the case with what the
> team actually found. And History: who did what, when, and from what state to what state. That
> trail survives the nightly run, and it survives the deletion of the record itself. This is the
> audit trail a court would ask for.
>
> **That is the officer's loop. The other half of the job is telling three crore people what to do
> about it today.**

*(**C takes the laptop on that line.** B steps back.)*

---

# SPEAKER C — the live app, second half, and the close (5:45 → 8:00)

### Stop 5 · Eight scripts, four channels (5:45 → 6:20)
*(Advisories. Switch the language to Hindi, then to Tamil. Then the channel tabs.)*

> The same advisory in the reader's own script — Hindi, then Tamil. Templated by design, so it
> cannot hallucinate medical advice, and script-validated in code so an untranslated string cannot
> ship silently. It goes out over the app, a live Telegram bot, an interactive phone line that
> speaks the advisory in that language, and public display boards — targeted at vulnerability-scored
> zones: hospitals, schools, elder care, outdoor work.

### Stop 6 · The numbers, in the product (6:20 → 6:50)
*(Forecast → the validation panel. Then the winter replay.)*

> The benchmark you saw on the slide lives inside the product, per city, recomputed from the
> artifact — negatives included. And the winter replay: every GRAP order links to the government's
> own release, with what we carried a day before, and a weather-normalised check of whether the air
> actually changed. Where the honest answer is "no detectable change", it says no.

### Stop 7 · Ten cities, one engine (6:50 → 7:15)
*(Cities. Click Mumbai and let the whole console follow.)*

> Ten cities on one scoreboard. One engine, one configuration file each. Click Mumbai and the entire
> console follows it — its own sources, its own forecast, its own worklist, its own languages.
>
> **Now — what it takes to run this.**

*(**Press D.** The deck returns on slide 6. Press **→** to slide 7.)*

### Slide 7 · Built to deploy (7:15 → 7:40)

> Built to deploy, not to demo. Ten cities live, one config file per city, no per-city code — we
> onboarded seven metros in a week. We measured what a city costs: about a fifth of a megabyte of
> readings a day. The free tier carries this deployment, and all hundred and thirty-one national
> programme cities would run for roughly two thousand seven hundred rupees a month. Every dispatched
> action is tracked against its own cell and exports in the format the official reporting portal
> takes — we feed that system, we do not compete with it.

### Slide 8 · Close (7:40 → 8:00)
*(Stand still. Say it slower than feels natural.)*

> We did not build a prettier dashboard. We built the layer that turns a reading into a traced,
> cited, delivered, closed action — and we measured it honestly enough to tell you where it is
> weak. It is live in ten cities right now, on infrastructure that costs nothing. What it has never
> had is one afternoon of a real pollution control board officer's time. That is the only thing
> standing between this and a working pilot. Thank you.

---

## If something goes wrong

| what happens | what to say, without stopping |
|---|---|
| Amber "backend waking up" banner | "That is our demo insurance — the free-tier host sleeps, and the app falls back to a labelled snapshot rather than showing you a blank screen." Keep narrating; it clears on the first live call. |
| A panel is empty | "That city has thin data in this window — here is one with more." Switch to Delhi. |
| The map does not paint | Press **D** to return to the deck; the same screenshot is on the slide, labelled. Narrate the same words. |
| A judge asks something mid-demo | Answer in one sentence and say "there is more on that in a moment" — do not lose the loop. |
| You are running long | Cut **Stop 6** entirely. It is the only stop whose content is also on slide 5. |

## The three questions most likely to come

**"Has a real officer used this?"** — No. Say it in one sentence, then say what exists instead: the
audit trail that would record their actions, and the rating rubric we built for them. Do not pad. The
worst version of this answer is a long one.

**"Your forecast loses to persistence in a city — why trust it?"** — One city, Hyderabad, and its
interval spans zero, so the honest answer is that we cannot separate it from the baseline there,
not that it loses. Jaipur *was* genuinely negative until we found the cause: station discovery was
searching a circle around the map's centre point rather than the city's extent, so a third of each
city was never sampled. Fixing that moved Jaipur from minus sixteen percent to plus ten. We can
tell you which cities are weak, with intervals, which most cannot.

**"Is this really AI, or a dashboard?"** — Two model families with measured skill, a conformal
calibration layer, SHAP-based apportionment with a gate that makes it abstain, and a state machine
that routes on a detected condition. Then volunteer the counterweight: no language model writes
anything a citizen reads, and that is deliberate — a hallucinated medical instruction reaching a
phone line in Marathi is not a risk we will take.
