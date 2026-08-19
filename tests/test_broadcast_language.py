"""A broadcast must go out in the language the operator picked, and say so when it cannot.

Deliberately unit-level. Driving POST /advisory/broadcast from a test sends a REAL Telegram
message — DEMO_MODE gates the data sources, not the outbound channels — so the endpoint is
exercised through its parts instead of over the wire.
"""
import os

os.environ["DEMO_MODE"] = "true"

import api.main as m  # noqa: E402


def test_the_body_accepts_a_language():
    """Without this field the server silently ignored the dropdown and read the English row."""
    assert "language" in m.BroadcastBody.model_fields
    assert m.BroadcastBody(city="delhi").language is None            # older clients still parse
    assert m.BroadcastBody(city="delhi", language="hi").language == "hi"


def test_latest_advisory_honours_the_requested_language():
    hi = m._latest_advisory("delhi", "hi")
    assert hi is not None, "the delhi fixture should carry a Hindi advisory"
    assert hi.get("language") == "hi"
    assert any("ऀ" <= ch <= "ॿ" for ch in hi["message"]), "expected Devanagari"


def test_latest_advisory_falls_back_to_english_for_a_language_the_city_lacks():
    """Delhi is configured hi + en. Kannada must not return another city's row, or nothing."""
    kn = m._latest_advisory("delhi", "kn")
    assert kn is not None
    assert kn.get("language") == "en", "fallback is fine; the caller reports it"


def test_the_default_is_english():
    assert (m._latest_advisory("delhi") or {}).get("language") == "en"


def test_every_language_we_write_can_now_be_spoken():
    """This asserted the opposite until 19 Aug, when the six Polly cannot reach moved to Google.

    The endpoint still reports a voice fallback, because a language could be added to the advisory
    templates before a voice exists for it — but today none of them need one.
    """
    from agents.advisory import LANG_LABEL
    from channels.ivr import IVR_SPOKEN_LANGS

    assert set(IVR_SPOKEN_LANGS) == set(LANG_LABEL)
    assert "mr" in IVR_SPOKEN_LANGS and "kn" in IVR_SPOKEN_LANGS
