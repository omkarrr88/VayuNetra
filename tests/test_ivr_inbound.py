"""Inbound IVR webhook tests (Twilio Voice → /ivr/inbound → /ivr/advisory).

A phone caller can never see an error page: every path must answer HTTP 200
with valid TwiML, including bad digits, missing input, and malformed bodies.
Runs in DEMO_MODE so the advisory content comes from demo/fixtures/advisory.json.
"""
import html
import os

os.environ["DEMO_MODE"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

import api.main as m  # noqa: E402
from channels.ivr import IVR_CITY_MENU, render_twiml, render_welcome_twiml  # noqa: E402

client = TestClient(m.app)


def _fixture_message(city: str) -> str:
    """The advisory a caller hears: the city's first configured language, which every one of the
    eight now has a voice for — mirrors api.main._ivr_language."""
    lang = m._ivr_language(city)
    rows = [r for r in m.fixture_rows("advisory", city) if (r.get("language") or "en") == lang and r.get("city_id") == city]
    if not rows:
        rows = [r for r in m.fixture_rows("advisory", city) if (r.get("language") or "en") == "en"]
    assert rows, f"fixture must contain an advisory for {city}"
    return str(rows[0]["message"]).strip()


def test_hindi_city_calls_are_spoken_in_hindi_by_kajal():
    r = client.post("/ivr/advisory", data={"Digits": "1"})   # Delhi: languages [hi, en]
    assert r.status_code == 200
    assert 'voice="Polly.Kajal-Neural" language="hi-IN"' in r.text
    assert "वायु गुणवत्ता" in r.text


def test_a_city_is_answered_in_its_own_language_not_english():
    """Chennai used to fall back to Polly.Raveena / en-IN because Polly has no Tamil voice.

    Twilio also exposes Google's voices, which cover all eight languages we write, so the fallback
    was never necessary — a Tamil caller was hearing an English speaker read Tamil script.
    """
    digit = next(d for d, (cid, _) in IVR_CITY_MENU.items() if cid == "chennai")
    r = client.post("/ivr/advisory", data={"Digits": digit})
    assert r.status_code == 200
    assert 'language="ta-IN"' in r.text
    assert 'voice="Google.ta-IN' in r.text


# --- welcome menu -------------------------------------------------------------

def test_inbound_menu_is_twiml_and_lists_all_cities():
    r = client.get("/ivr/inbound")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/xml")
    assert "<Gather" in r.text
    for _, (_, name) in IVR_CITY_MENU.items():
        assert name in r.text


def test_inbound_menu_accepts_post_too():
    r = client.post("/ivr/inbound", data={"CallSid": "CAtest", "From": "+911234567890"})
    assert r.status_code == 200
    assert "<Gather" in r.text


def test_welcome_twiml_has_default_redirect():
    xml = render_welcome_twiml("/ivr/advisory")
    assert "<Redirect" in xml and "Digits=1" in xml


# --- advisory playback --------------------------------------------------------

def test_advisory_reads_chosen_city_fixture():
    r = client.post("/ivr/advisory", data={"Digits": "2", "CallSid": "CAtest"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/xml")
    assert html.escape(_fixture_message("bengaluru")) in r.text
    assert "Bengaluru" in r.text


def test_advisory_get_with_query_digits():
    r = client.get("/ivr/advisory", params={"Digits": "3"})
    assert r.status_code == 200
    assert html.escape(_fixture_message("mumbai")) in r.text


def test_advisory_unknown_digits_defaults_to_delhi():
    # ten cities now fill digits 1-9 and 0, so only a non-digit key is unmapped
    r = client.post("/ivr/advisory", data={"Digits": "#"})
    assert r.status_code == 200
    assert html.escape(_fixture_message("delhi")) in r.text


def test_advisory_digit_9_is_a_real_city_now():
    # regression guard for the 10-city menu: 9 must NOT silently fall back to Delhi
    r = client.post("/ivr/advisory", data={"Digits": "9"})
    assert r.status_code == 200
    assert "Lucknow" in r.text


def test_advisory_no_input_defaults_to_delhi():
    r = client.post("/ivr/advisory")
    assert r.status_code == 200
    assert html.escape(_fixture_message("delhi")) in r.text


def test_advisory_malformed_body_still_speaks():
    r = client.post(
        "/ivr/advisory",
        content=b"\xff\xfe not-a-form",
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200
    assert "<Response>" in r.text


# --- TwiML injection safety ---------------------------------------------------

def test_advisory_message_is_xml_escaped():
    xml = render_twiml({"message": 'Alert <Say>evil</Say> & "quotes"'}, city_name="Delhi")
    assert "<Say>evil</Say>" not in xml
    assert "&lt;Say&gt;evil&lt;/Say&gt;" in xml


def test_latest_advisory_never_returns_wrong_city():
    # fixture_rows falls back to ALL rows for unknown cities; _latest_advisory
    # must return None rather than another city's advisory (spoken as the wrong city).
    # (Kolkata used to be the example here — it is a live city since Aug 2026.)
    assert m._latest_advisory("atlantis") is None
