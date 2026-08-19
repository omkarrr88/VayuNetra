"""A call must be spoken in the advisory's language — voice AND framing.

Marathi used to be Devanagari handed to Polly.Raveena, an Indian-ENGLISH voice, wrapped in English
sentences. It did not sound like poor Marathi; it was not Marathi.
"""
from __future__ import annotations

import re

import pytest

from agents.advisory import LANG_LABEL, foreign_script_chars
from channels.ivr import IVR_FRAMING, VOICE_BY_LANG, render_twiml

LANGS = sorted(VOICE_BY_LANG)


def test_every_language_we_write_has_a_voice_that_speaks_it():
    assert set(LANGS) == set(LANG_LABEL), "a language we write advisories in but cannot voice"


@pytest.mark.parametrize("lang", LANGS)
def test_the_voice_locale_matches_the_language(lang):
    """A Marathi advisory on an en-IN voice is the original bug; the locale must track the text."""
    _voice, locale = VOICE_BY_LANG[lang]
    assert locale.split("-")[0] == lang, f"{lang} is voiced as {locale}"


@pytest.mark.parametrize("lang", LANGS)
def test_the_voice_name_is_a_provider_qualified_twilio_string(lang):
    """Twilio needs 'Polly.X' or 'Google.x'; a bare name silently fails the call."""
    voice, _ = VOICE_BY_LANG[lang]
    assert re.match(r"^(Polly|Google)\.", voice), voice


@pytest.mark.parametrize("lang", [l for l in LANGS if l != "en"])
def test_the_framing_is_in_the_language_not_english(lang):
    """The sentences around the advisory were English for seven of eight, so even a correctly
    voiced call opened and closed in the wrong language."""
    for key, text in IVR_FRAMING[lang].items():
        stripped = text.replace("{city}", "").replace("{brand}", "")
        assert not foreign_script_chars(stripped, lang), f"{lang}.{key} carries foreign script: {text}"


@pytest.mark.parametrize("lang", LANGS)
def test_render_twiml_uses_that_language_end_to_end(lang):
    twiml = render_twiml({"message": "x", "language": lang}, "Mumbai")
    voice, locale = VOICE_BY_LANG[lang]
    assert f'voice="{voice}"' in twiml and f'language="{locale}"' in twiml
    # SSML pacing must survive: Chirp3-HD would drop it, which is why Wavenet was chosen
    assert "<prosody" in twiml and "<break" in twiml


def test_an_unknown_language_still_produces_a_call():
    """Falling back is fine; failing to dial during an episode is not."""
    twiml = render_twiml({"message": "x", "language": "xx"}, "Delhi")
    assert 'voice="Polly.Raveena"' in twiml
