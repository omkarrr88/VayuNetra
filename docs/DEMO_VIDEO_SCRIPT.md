# VayuNetra — 3-Minute Demo Video Script

**Total runtime: 3:00 · three speakers · one minute each**
Three presenters, one minute each. The split below (Omkar → Abhinav → Sejal) is a suggested order that follows the product loop *trace → act → protect* — any of the three can take any segment.

Every beat below has a timestamp, the exact screen to show, and the exact words to say. The spoken lines are written for natural Indian-English delivery at ~140 words/minute — read them aloud twice before recording; if a line feels stiff in your mouth, reword it, but **keep every number exactly as written** (they are all verified against the live app).

---

## Recording setup (do this once, before anyone records)

| Item | Setting |
|---|---|
| Screen capture | 1920×1080, browser full-screen (F11), 100% zoom, hide bookmarks bar |
| Camera | Each speaker records a webcam clip; editor overlays it as a small circle, bottom-left (never cover the right panel — that's where the content lives) |
| Audio | Quiet room, phone/headset mic 15 cm from mouth, record a 5-second silence first for noise removal |
| Browser prep | Open `vayunetra-aqi.vercel.app` once and complete/skip the tour so it never pops up on camera. City = **Delhi**. |
| Backend prep | Run `make prewarm` ~15 min before recording and confirm **GO**. If Render misbehaves, record against local `make dev` — the app looks identical. |
| Cursor | Move slowly, click deliberately. Every click in this script is rehearsed — no hunting on camera. |

**Pre-record checklist (2 min):** ① tour dismissed ② Delhi selected ③ a hexagon click opens Cell Story instantly ④ Enforcement list is populated ⑤ "Run agents live" completes in a few seconds ⑥ Advisories shows Hindi text ⑦ Sejal's phone has Telegram open on @aqivayu_bot for the pickup shot.

---

## MINUTE 1 — OMKAR · "Who is to blame, per square kilometre" (0:00–1:00)

| Time | Screen / action | Say exactly |
|---|---|---|
| 0:00–0:10 | **Landing page** (`vayunetra-aqi.vercel.app`), slow scroll over the hero and live AQI line | "India already measures its air — nine hundred monitoring stations. Yet only thirty-one percent of monitored cities have any response protocol. Data is not the problem. The missing loop is." |
| 0:10–0:22 | Click **Open console** → map of Delhi loads with coloured hexagons. Sweep cursor across the map | "This is VayuNetra. Every hexagon is one square kilometre of Delhi, coloured by *who is to blame* for its PM2.5 right now — red is traffic, yellow is construction dust, purple is industry." |
| 0:22–0:40 | **Click a hexagon** → Cell Story panel opens (place name, e.g. R. K. Puram). Point at the source bars, then the green SHAP box, then scroll to **This place — past air** | "Click any cell — this is R. K. Puram. Traffic: sixty-one percent. The model shows its evidence — SHAP drivers in micrograms, with its own out-of-sample R-squared. And here is this place's own history: worse than a month ago, in plain words, over a year of readings. Where the model has no skill, it *abstains* and falls back to cited chemical signatures. It never over-claims." |
| 0:40–0:55 | Point at **"Where it's heading"** (+24/48/72h numbers in the Cell Story), then press **2** (or click **Forecast** in the top nav); hover the uncertainty band | "The same cell carries a seventy-two-hour forecast with calibrated eighty-percent uncertainty bands. Our attribution is checked bucket by bucket against the published apportionment studies, and the forecast beats persistence in every launch city — we validated everything, including our failures." |
| 0:55–1:00 | Hold on the Forecast chart | "So we know who is to blame, and what's coming. Abhinav turns that into action." |

*~150 words of speech. If running long, drop the sentence "we validated everything, including our failures."*

---

## MINUTE 2 — ABHINAV · "From blame to a signed notice" (1:00–2:00)

| Time | Screen / action | Say exactly |
|---|---|---|
| 1:00–1:15 | Press **7** (or click **Pipeline** in the top nav) → click **"Run agents live"** → the trace fills in node by node | "Six AI agents on one LangGraph run this city. Watch them live: orchestrator, attribution, forecast — a spike gate decides if the air needs enforcement — then advisory. Zero-point-six seconds end to end, and every node is traced and auditable." |
| 1:15–1:32 | Press **1** (or click **Enforcement** in the top nav). Slowly scroll the worklist; point at the contribution + exposed line on the top card | "The enforcement worklist ranks every polluting source by contribution, people exposed, and actionability. Top of this list: a registered construction site putting eighteen percent of this cell's PM2.5 onto fifteen thousand residents." |
| 1:32–1:50 | Click **Evidence dossier** on that card → point at the Sentinel-2 patch and the citations. Then click **Notice PDF** → open the downloaded PDF, scroll to the impact chart | "One click — the evidence dossier: a Sentinel-2 satellite patch of the site, and regulatory citations retrieved from GRAP and the Air Act. And here's the draft notice PDF — with a projected-impact chart: the forecast if nothing is done, versus the air after compliance. An officer signs it. We never auto-send." |
| 1:50–2:00 | Back in the app, show the **Intervention tracking** card under the worklist | "The moment it's dispatched, the system freezes a baseline and starts measuring before-versus-after, corrected for city drift. And Sejal takes the same intelligence to citizens." |

*~150 words. The Notice PDF must be pre-downloaded once so the second download is instant on camera.*

> **Numbers on record day:** "eighteen percent … fifteen thousand residents" matches the live top card when a cell is focused (re-check on record day — the worklist re-ranks with live data — before recording, read your actual top card and, if it differs, swap in its contribution % and exposed count. The sentence structure stays the same; never speak a number that isn't on screen.

---

## MINUTE 3 — SEJAL · "Reach, rupees, and the close" (2:00–3:00)

| Time | Screen / action | Say exactly |
|---|---|---|
| 2:00–2:18 | Click **Advisories**. Switch language dropdown **English → Hindi** (Devanagari text appears). Click through channel tabs **App → Telegram → IVR call** | "The same intelligence reaches people who will never open a dashboard. Health advisories in eight languages — Hindi, Kannada, Marathi, Tamil, Telugu, Bengali, Gujarati and English — targeted using five and a half thousand vulnerability-scored zones: hospitals, schools, outdoor workers." |
| 2:18–2:32 | On the **Telegram** tab, show the QR; cut to Sejal's phone receiving the bot message. Then the **IVR** tab | "Four channels. A live Telegram bot — scan and subscribe right now. Public display boards. And real IVR phone calls: citizens dial in, press one for Delhi, and the phone reads them today's advisory." |
| 2:32–2:48 | Click **Simulator** → intervention "Halt construction dust" → **Run simulation** → point at the impact cards. Then click **Impact** and point at the ₹ figures | "Officers can ask *what if*: halt construction dust, and the counterfactual returns the AQI change, people protected, rupees saved and CO2 avoided — every figure cited, nothing invented. The City ROI view makes Delhi's funding case: eighty-eight thousand crore avertable every year." |
| 2:48–3:00 | Click **Cities** (ten-city ranking on screen) — then cut to the landing page hero, hold two seconds | "Ten cities run today — seven of them onboarded from config in a single week — on zero-rupee infrastructure. India's air stack can measure and forecast. VayuNetra makes it *operate*. Thank you." |

*~145 words. The phone-pickup shot is the single most memorable moment — rehearse it.*

---

## Coverage check (nothing missed)

Landing ✓ (0:00) · Blame map + layers ✓ (0:10) · Cell Story: attribution, SHAP, abstention, forecast ✓ (0:22–0:55) · Forecast panel ✓ (0:40) · Pipeline, 6 agents, spike gate, latency ✓ (1:00) · Enforcement worklist ✓ (1:15) · Dossier: satellite + RAG citations ✓ (1:32) · Notice PDF + impact chart ✓ (1:32) · Intervention tracking ✓ (1:50) · Advisories: 8 languages ✓ (2:00) · 4 channels + live Telegram + IVR ✓ (2:18) · Simulator + cited impact ✓ (2:32) · Impact / City ROI ✓ (2:32) · Cities comparison ✓ (2:48) · Scalability + ₹0 close ✓ (2:48).

Not shown (deliberate, no time): guided tour, map layer toggles (plumes/wards/freight/fires are visible in the hero landing image), the 24-hour map replay, satellite hover cards, ward heat, share card, clean-air zones, optimizer, broadcast button. All are live — and every screen in this script is a deep link, so bookmark them for the recording. If a judge asks, all are live in the app.

## Editing notes

- Hard cuts on every speaker change; no transitions/music under speech (light music bed at −25 dB is fine).
- Overlay small text chips when a number is spoken: "61% traffic" (0:25), "1.4 s signal → recommendation" (1:10; read the live widget), "18% · 15,000 residents" (1:25), "8 languages · own scripts" (2:05), "₹0.88 L cr / yr" (2:45).
- End-card (2 s, after 3:00 if the rules allow a title card): logo + `vayunetra-aqi.vercel.app` + team names.
- Export 1080p, H.264, target ≤ 500 MB.
