"""Script validation for localized advisories — reject stray-script LLM output."""
from agents.advisory import LANG_LABEL, foreign_script_chars, render_message, script_ok


def test_templates_pass_their_own_script():
    for lang in ("en", "hi", "kn", "mr", "ta", "te", "bn", "gu"):
        msg = render_message("Delhi", "zone-1a2b", "very_poor", 24, lang)
        assert script_ok(msg, lang), (lang, msg)


def test_foreign_glyph_is_rejected():
    hindi = LANG_LABEL["hi"]["action"]
    assert script_ok(hindi, "hi")
    assert not script_ok(hindi + " 空气", "hi")            # CJK leak
    assert not script_ok(hindi + " বায়ু", "hi")           # Bengali leak
    assert foreign_script_chars(hindi + " 空气", "hi") == "空气"


def test_english_rejects_non_latin_and_untranslated_rejected():
    assert script_ok("Delhi zone-1a2b: air is forecast very poor in +24h. Use an N95 mask.", "en")
    assert not script_ok("Delhi zone-1a2b: हवा बहुत ख़राब", "en")
    # a "Kannada" advisory that never left English is not a translation
    assert not script_ok("Delhi zone-1a2b: air is forecast very poor in +24h.", "kn")


def test_digits_and_symbols_are_allowed_everywhere():
    assert script_ok("ದೆಹಲಿ zone-1a2b: 24 ಗಂಟೆ · N95 — 120 µg/m³ ⚠", "kn")


def test_advice_matches_tier_in_every_language():
    from agents.advisory import LANG_LABEL
    for lang in LANG_LABEL:
        good = render_message("Chennai", "zone-1", "good", 24, lang)
        bad = render_message("Chennai", "zone-1", "very_poor", 24, lang)
        assert script_ok(good, lang) and script_ok(bad, lang)
        assert "N95" not in good, (lang, good)      # never tell people to mask up in clean air
        assert "N95" in bad, (lang, bad)
        assert "good" not in good or lang == "en"    # tier label is localised, not English
