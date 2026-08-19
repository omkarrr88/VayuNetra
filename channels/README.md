# channels/ — citizen delivery

Spec: ARCHITECTURE.md §13, PRD §14.2.

- **Primary (free):** Telegram bot. The web app is an installable PWA (offline shell + bundled
  snapshot); **push notifications are not wired** — there is no subscription flow or VAPID key, so
  do not claim push delivery.
- **IVR — outbound:** Twilio call reads the advisory (Polly.Raveena, repeated once) to
  numbers in `TWILIO_TO_NUMBERS` — trial accounts can only call **verified** numbers.
- **IVR — inbound (judges can call us):** point the Twilio number's **Voice webhook**
  (Twilio Console → Phone Numbers → your number → Voice → "A call comes in") at
  `https://<api-host>/ivr/inbound` (HTTP POST). Caller hears a menu — press 1 Delhi,
  2 Bengaluru, 3 Mumbai — then that city's latest live advisory. No input → Delhi.
  Trial-account note: inbound callers first hear Twilio's short trial preamble; that's
  expected and free.
- **Public display mode:** big-screen ward board rendering — `web/src/CitizenPanel.tsx` renders the
  same advisory in high-contrast display type as one of the four channel previews. It is a rendering
  mode inside the console, not a standalone kiosk endpoint you can point a screen at.
- **Localization:** short **deterministic templates**, one per risk tier per language, rendered by
  `agents/advisory.py::render_message` and checked by `script_ok()`. **No language model is involved
  anywhere** — an earlier draft of this file claimed "LLM (Gemini) translation", which was never
  true. Health and advisory text is templated by design: a hallucinated line in an asthma advisory
  is not a risk worth taking. Native-speaker review status per language is in
  `docs/ADVISORY_REVIEW.md` (currently **hi** and **mr** reviewed; the other five pending).

Reads `advisories` (Agent 4 output). WhatsApp = production upgrade (has cost) — Telegram is the default.
