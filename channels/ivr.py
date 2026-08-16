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

# Amazon Polly neural voice via Twilio — clear Indian English, far better than 'alice'.
IVR_VOICE = "Polly.Raveena"
IVR_LANG = "en-IN"
BRAND = "Vayu Netra"


def render_ivr_script(advisory: dict) -> str:
    """Plain-text advisory (for public-display boards / logs)."""
    return (
        f"{BRAND} air quality advisory. {advisory.get('message', '')} "
        "Stay safe and limit outdoor exposure."
    )


def render_twiml(advisory: dict, city_name: str | None = None) -> str:
    """TwiML for a slowed, repeated, clearly-spoken advisory call."""
    msg = html.escape(str(advisory.get("message", "")).strip())
    intro = f"Here is the latest advisory for {html.escape(city_name)}. " if city_name else ""
    body = (
        f"{intro}This is an air quality alert from {BRAND}. "
        f'<break time="600ms"/> {msg} '
        f'<break time="800ms"/> I will now repeat this alert. '
        f'<break time="400ms"/> {msg} '
        f'<break time="700ms"/> Stay safe, and limit outdoor exposure. Goodbye.'
    )
    return (
        "<Response>"
        '<Pause length="1"/>'
        f'<Say voice="{IVR_VOICE}" language="{IVR_LANG}">'
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
