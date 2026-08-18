# channels/ — citizen delivery

Spec: ARCHITECTURE.md §13, PRD §14.2.

- **Primary (free):** Telegram bot + PWA push.
- **IVR — outbound:** Twilio call reads the advisory (Polly.Raveena, repeated once) to
  numbers in `TWILIO_TO_NUMBERS` — trial accounts can only call **verified** numbers.
- **IVR — inbound (judges can call us):** point the Twilio number's **Voice webhook**
  (Twilio Console → Phone Numbers → your number → Voice → "A call comes in") at
  `https://<api-host>/ivr/inbound` (HTTP POST). Caller hears a menu — press 1 Delhi,
  2 Bengaluru, 3 Mumbai — then that city's latest live advisory. No input → Delhi.
  Trial-account note: inbound callers first hear Twilio's short trial preamble; that's
  expected and free.
- **Public display mode:** big-screen ward board.
- **Localization:** short templated messages + LLM (Gemini) translation, native-speaker reviewed
  for **hi / en / kn / mr**.

Reads `advisories` (Agent 4 output). WhatsApp = production upgrade (has cost) — Telegram is the default.
