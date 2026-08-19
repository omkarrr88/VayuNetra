"""IVR / public-display scripts for Agent 4 advisories.

Two directions, one voice:
- Outbound: place a real Twilio call that reads an advisory in a clear
  Indian-English neural voice, slowed slightly and repeated once.
- Inbound: TwiML builders for the hosted webhook (`/ivr/inbound` on the API) —
  callers dial our Twilio number, pick a city on the keypad, and hear that
  city's latest advisory. Point the Twilio number's Voice webhook at the API.
"""
from __future__ import annotations

import argparse
import html
import os

import core.env  # noqa: F401  (loads .env)

# One voice per language, and it must be a voice that actually speaks that language.
#
# This used to be Polly-only: {"en": Raveena, "hi": Kajal}. Everything else fell through to the
# English voice, so a Marathi advisory was Devanagari handed to an Indian-ENGLISH speaker wrapped in
# English framing sentences. It did not sound like poor Marathi; it was not Marathi.
#
# Polly speaks two of the eight languages we write. Twilio also exposes Google's voices through the
# same `voice` attribute, and Google covers all eight
# (https://www.twilio.com/docs/voice/twiml/say/text-speech), so the six Polly cannot reach use
# Google instead.
#
# Wavenet rather than the newer Chirp3-HD deliberately: this script uses <prosody rate="90%"> to
# slow delivery and <break> to pace it, and Chirp3-HD does not accept SSML. A faster-sounding voice
# that ignores the pacing is the wrong trade for a public-health call an elderly listener has to
# follow the first time.
VOICE_BY_LANG = {
    "en": ("Polly.Raveena", "en-IN"),
    "hi": ("Polly.Kajal-Neural", "hi-IN"),
    "mr": ("Google.mr-IN-Wavenet-A", "mr-IN"),
    "kn": ("Google.kn-IN-Wavenet-A", "kn-IN"),
    "ta": ("Google.ta-IN-Wavenet-A", "ta-IN"),
    "te": ("Google.te-IN-Standard-A", "te-IN"),
    "bn": ("Google.bn-IN-Wavenet-A", "bn-IN"),
    "gu": ("Google.gu-IN-Wavenet-A", "gu-IN"),
}
IVR_VOICE, IVR_LANG = VOICE_BY_LANG["en"]
IVR_SPOKEN_LANGS = tuple(VOICE_BY_LANG.keys())

# The sentences wrapped around the advisory. They were English for every language except Hindi, so
# even a correctly-voiced call opened and closed in the wrong one.
#
# NOT NATIVELY REVIEWED for six of the eight — same caveat as the advisory bodies in
# agents/advisory.py, and stated in docs/ADVISORY_REVIEW.md rather than left for a listener to
# discover. Each is script-validated in tests: the framing must be written in the language's own
# script, so an untranslated string cannot ship silently.
IVR_FRAMING = {
    "en": {"intro": "Here is the latest advisory for {city}.", "alert": "This is an air quality alert from {brand}.",
           "repeat": "I will now repeat this alert.", "outro": "Stay safe, and limit outdoor exposure. Goodbye."},
    "hi": {"intro": "{city} के लिए नवीनतम सलाह।", "alert": "यह {brand} की ओर से वायु गुणवत्ता चेतावनी है।",
           "repeat": "मैं यह चेतावनी दोहराती हूँ।", "outro": "सुरक्षित रहें, बाहर कम समय बिताएँ। धन्यवाद।"},
    "mr": {"intro": "{city} साठी नवीनतम सूचना.", "alert": "ही {brand} कडून हवा गुणवत्ता सूचना आहे.",
           "repeat": "मी ही सूचना पुन्हा सांगते.", "outro": "सुरक्षित राहा, बाहेर कमी वेळ घालवा. धन्यवाद."},
    "kn": {"intro": "{city} ಗಾಗಿ ಇತ್ತೀಚಿನ ಸೂಚನೆ.", "alert": "ಇದು {brand} ಕಡೆಯಿಂದ ಗಾಳಿ ಗುಣಮಟ್ಟದ ಎಚ್ಚರಿಕೆ.",
           "repeat": "ನಾನು ಈ ಎಚ್ಚರಿಕೆಯನ್ನು ಮತ್ತೆ ಹೇಳುತ್ತೇನೆ.", "outro": "ಸುರಕ್ಷಿತವಾಗಿರಿ, ಹೊರಗೆ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ. ಧನ್ಯವಾದಗಳು."},
    "ta": {"intro": "{city} க்கான சமீபத்திய அறிவிப்பு.", "alert": "இது {brand} சார்பாக காற்று தர எச்சரிக்கை.",
           "repeat": "இந்த எச்சரிக்கையை மீண்டும் சொல்கிறேன்.", "outro": "பாதுகாப்பாக இருங்கள், வெளியே குறைந்த நேரம் செலவிடுங்கள். நன்றி."},
    "te": {"intro": "{city} కోసం తాజా సూచన.", "alert": "ఇది {brand} నుండి గాలి నాణ్యత హెచ్చరిక.",
           "repeat": "ఈ హెచ్చరికను మళ్లీ చెబుతాను.", "outro": "సురక్షితంగా ఉండండి, బయట తక్కువ సమయం గడపండి. ధన్యవాదాలు."},
    "bn": {"intro": "{city} এর জন্য সাম্প্রতিক পরামর্শ।", "alert": "এটি {brand} থেকে বায়ু মানের সতর্কতা।",
           "repeat": "আমি এই সতর্কতা আবার বলছি।", "outro": "নিরাপদে থাকুন, বাইরে কম সময় কাটান। ধন্যবাদ।"},
    "gu": {"intro": "{city} માટે તાજેતરની સૂચના.", "alert": "આ {brand} તરફથી હવા ગુણવત્તા ચેતવણી છે.",
           "repeat": "હું આ ચેતવણી ફરીથી કહું છું.", "outro": "સુરક્ષિત રહો, બહાર ઓછો સમય વિતાવો. આભાર."},
}

BRAND = "Vayu Netra"


def render_ivr_script(advisory: dict) -> str:
    """Plain-text advisory (for public-display boards / logs)."""
    return (
        f"{BRAND} air quality advisory. {advisory.get('message', '')} "
        "Stay safe and limit outdoor exposure."
    )


def render_twiml(advisory: dict, city_name: str | None = None) -> str:
    """TwiML for a slowed, repeated, clearly-spoken advisory call — wholly in the advisory's
    language: the voice speaks it and so does the framing around it.

    Falls back to English only when we have no voice for the language, and the caller is told that
    happened rather than being left to notice a Marathi advisory being read by an English speaker.
    """
    msg = html.escape(str(advisory.get("message", "")).strip())
    lang = str(advisory.get("language") or "en")
    voice, tts_lang = VOICE_BY_LANG.get(lang, VOICE_BY_LANG["en"])
    f = IVR_FRAMING.get(lang, IVR_FRAMING["en"])
    intro = f["intro"].format(city=html.escape(city_name)) + " " if city_name else ""
    body = (
        f'{intro}{f["alert"].format(brand=BRAND)} '
        f'<break time="600ms"/> {msg} '
        f'<break time="800ms"/> {f["repeat"]} '
        f'<break time="400ms"/> {msg} '
        f'<break time="700ms"/> {f["outro"]}'
    )
    return (
        "<Response>"
        '<Pause length="1"/>'
        f'<Say voice="{voice}" language="{tts_lang}">'
        f'<prosody rate="90%">{body}</prosody></Say>'
        "</Response>"
    )


# Inbound keypad menu: digit → (city_id, spoken name), built from the central
# city registry. Launch cities keep digits 1–3 (existing callers' muscle
# memory); later cities take 4–9 then 0 — ten digits caps the voice menu.
def _build_city_menu() -> dict[str, tuple[str, str]]:
    from core.cities import list_cities

    digits = "1234567890"
    menu: dict[str, tuple[str, str]] = {}
    for i, city in enumerate(list_cities()[: len(digits)]):
        menu[digits[i]] = (city["city_id"], city["name"])
    return menu


IVR_CITY_MENU = _build_city_menu()


def render_welcome_twiml(action_url: str) -> str:
    """TwiML greeting for inbound callers: gather one digit to pick a city.

    No input → redirect to the action URL with Delhi as the default, so every
    caller always hears an advisory. Twilio resolves relative action URLs
    against the webhook URL, so a bare path like `/ivr/advisory` works.
    """
    menu = " ".join(
        f"Press {digit} for {name}." for digit, (_, name) in sorted(IVR_CITY_MENU.items())
    )
    action = html.escape(action_url)
    return (
        "<Response>"
        '<Pause length="1"/>'
        f'<Gather action="{action}" method="POST" numDigits="1" timeout="7">'
        f'<Say voice="{IVR_VOICE}" language="{IVR_LANG}"><prosody rate="90%">'
        f"Welcome to {BRAND}, your city's air quality intelligence line. "
        f'<break time="400ms"/> {menu}'
        "</prosody></Say>"
        "</Gather>"
        f'<Say voice="{IVR_VOICE}" language="{IVR_LANG}">'
        "No input received. Playing the Delhi advisory.</Say>"
        f'<Redirect method="POST">{action}?Digits=1</Redirect>'
        "</Response>"
    )


def render_unavailable_twiml(city_name: str) -> str:
    """Honest fallback when no advisory exists for the chosen city."""
    safe = html.escape(city_name)
    return (
        "<Response>"
        f'<Say voice="{IVR_VOICE}" language="{IVR_LANG}"><prosody rate="90%">'
        f"There is no active air quality advisory for {safe} right now. "
        "Conditions are being monitored around the clock, and alerts are issued "
        "the moment a risk is forecast. Stay safe. Goodbye."
        "</prosody></Say>"
        "</Response>"
    )


def _recipients() -> list[str]:
    """All configured recipients: TWILIO_TO_NUMBERS (comma-separated) or TWILIO_TO_NUMBER."""
    many = os.getenv("TWILIO_TO_NUMBERS", "")
    nums = [n.strip() for n in many.split(",") if n.strip()]
    if not nums:
        single = os.getenv("TWILIO_TO_NUMBER", "").strip()
        if single:
            nums = [single]
    return nums


def broadcast_ivr_calls(advisory: dict) -> list[dict]:
    """Place the advisory call to every configured recipient; never let one failure stop the rest."""
    results: list[dict] = []
    for num in _recipients():
        try:
            r = make_ivr_call(advisory, num)
            results.append({"to": num, "status": r.get("status", "queued"), "sid": r.get("sid")})
        except Exception as e:  # noqa: BLE001 — report per-number, keep calling the others
            results.append({"to": num, "status": "error", "detail": str(e)[:200]})
    return results


def make_ivr_call(advisory: dict, to_number: str | None = None) -> dict:
    """Place a real Twilio voice call for one advisory.

    Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and either
    TWILIO_TO_NUMBER or --to. Trial accounts can call only verified recipient numbers.
    """
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_PHONE_NUMBER")
    to_number = to_number or os.getenv("TWILIO_TO_NUMBER")
    missing = [
        name for name, value in {
            "TWILIO_ACCOUNT_SID": sid,
            "TWILIO_AUTH_TOKEN": token,
            "TWILIO_PHONE_NUMBER": from_number,
            "TWILIO_TO_NUMBER": to_number,
        }.items() if not value
    ]
    if missing:
        raise RuntimeError(f"Missing Twilio settings: {', '.join(missing)}")

    from twilio.rest import Client

    client = Client(sid, token)
    call = client.calls.create(to=to_number, from_=from_number, twiml=render_twiml(advisory))
    return {"sid": call.sid, "status": call.status}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--to", help="Recipient phone number; defaults to TWILIO_TO_NUMBER")
    ap.add_argument(
        "--message",
        default="Air quality is expected to be poor over the next 24 hours. Please limit outdoor activity.",
    )
    args = ap.parse_args()

    result = make_ivr_call({"message": args.message}, args.to)
    print(f"started IVR call sid={result['sid']} status={result['status']}")


if __name__ == "__main__":
    main()
