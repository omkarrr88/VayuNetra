"""Agent 4 - Citizen Health Risk Advisory.

Numbers come from forecasts and vulnerability layers; text is templated and localized.
The LLM can polish translations later, but Stage 1 has deterministic output that is safe
for DEMO_MODE, Telegram, IVR, and public-display surfaces.
"""
from __future__ import annotations

from datetime import datetime, timezone

from core.wards import place_for_cell

RISK_ORDER = ["good", "satisfactory", "moderate", "poor", "very_poor", "severe"]
CHANNELS = ("pwa", "telegram", "ivr", "display")

BREAKPOINTS_PM25 = [
    (30, "good"),
    (60, "satisfactory"),
    (90, "moderate"),
    (120, "poor"),
    (250, "very_poor"),
    (10_000, "severe"),
]

# Native scripts (Devanagari / Kannada), deliberately short and formulaic so
# the templates stay unambiguous. Still worth a native speaker's read-through.
LANG_LABEL = {
    "en": {
        "very_poor": "very poor",
        "poor": "poor",
        "moderate": "moderate",
        "severe": "severe",
        "good": "good",
        "satisfactory": "satisfactory",
        "action_ok": "Air is fine — normal outdoor activity is safe.",
        "action_moderate": "Sensitive people (children, elderly, asthma) should limit long outdoor exertion.",
        "action": "Keep outdoor activity short, use an N95 mask, and move heavy work outside the peak window.",
    },
    "hi": {
        "very_poor": "बहुत ख़राब",
        "poor": "ख़राब",
        "moderate": "मध्यम",
        "severe": "गंभीर",
        "good": "अच्छी",
        "satisfactory": "संतोषजनक",
        "action_ok": "हवा ठीक है — सामान्य बाहरी गतिविधि सुरक्षित है.",
        "action_moderate": "संवेदनशील लोग (बच्चे, बुज़ुर्ग, दमा रोगी) लंबी बाहरी मेहनत कम करें.",
        "action": "बाहर की गतिविधि कम रखें, N95 मास्क पहनें, और भारी काम पीक समय के बाद करें.",
    },
    "kn": {
        "very_poor": "ತುಂಬಾ ಕಳಪೆ",
        "poor": "ಕಳಪೆ",
        "moderate": "ಮಧ್ಯಮ",
        "severe": "ತೀವ್ರ",
        "good": "ಉತ್ತಮ",
        "satisfactory": "ತೃಪ್ತಿಕರ",
        "action_ok": "ಗಾಳಿ ಚೆನ್ನಾಗಿದೆ — ಸಾಮಾನ್ಯ ಹೊರಾಂಗಣ ಚಟುವಟಿಕೆ ಸುರಕ್ಷಿತ.",
        "action_moderate": "ಸೂಕ್ಷ್ಮ ವ್ಯಕ್ತಿಗಳು (ಮಕ್ಕಳು, ವೃದ್ಧರು, ಅಸ್ತಮಾ ರೋಗಿಗಳು) ದೀರ್ಘ ಹೊರಾಂಗಣ ಶ್ರಮವನ್ನು ಕಡಿಮೆ ಮಾಡಿ.",
        "action": "ಹೊರಗಿನ ಚಟುವಟಿಕೆ ಕಡಿಮೆ ಮಾಡಿ, N95 ಮಾಸ್ಕ್ ಬಳಸಿ, ಮತ್ತು ಭಾರೀ ಕೆಲಸವನ್ನು ಪೀಕ್ ಸಮಯದ ನಂತರ ಮಾಡಿ.",
    },
    "mr": {
        "very_poor": "खूप खराब",
        "poor": "खराब",
        "moderate": "मध्यम",
        "severe": "गंभीर",
        "good": "चांगली",
        "satisfactory": "समाधानकारक",
        "action_ok": "हवा चांगली आहे — नेहमीची बाहेरील हालचाल सुरक्षित आहे.",
        "action_moderate": "संवेदनशील व्यक्तींनी (लहान मुले, वृद्ध, दमा) दीर्घ बाहेरील श्रम कमी करावेत.",
        "action": "बाहेरील हालचाल कमी ठेवा, N95 मास्क वापरा, आणि जड काम पीक वेळेनंतर करा.",
    },
    # Tamil (Chennai), Telugu (Hyderabad), Bengali (Kolkata), Gujarati (Ahmedabad) — same
    # short, formulaic sentence; validated by script_ok(); flagged for native-speaker review.
    "ta": {
        "very_poor": "மிக மோசம்",
        "poor": "மோசம்",
        "moderate": "மிதமான",
        "severe": "தீவிரம்",
        "good": "நல்லது",
        "satisfactory": "திருப்திகரம்",
        "action_ok": "காற்று நன்றாக உள்ளது — வழக்கமான வெளிப்புற செயல்பாடு பாதுகாப்பானது.",
        "action_moderate": "உணர்திறன் உள்ளவர்கள் (குழந்தைகள், முதியோர், ஆஸ்துமா) நீண்ட வெளிப்புற உழைப்பைக் குறைக்கவும்.",
        "action": "வெளியில் செல்வதைக் குறைக்கவும், N95 முகக்கவசம் அணியவும், கடின வேலைகளை உச்ச நேரத்திற்குப் பிறகு செய்யவும்.",
    },
    "te": {
        "very_poor": "చాలా చెడ్డది",
        "poor": "చెడ్డది",
        "moderate": "మధ్యస్థం",
        "severe": "తీవ్రం",
        "good": "మంచిది",
        "satisfactory": "సంతృప్తికరం",
        "action_ok": "గాలి బాగుంది — సాధారణ బయటి కార్యకలాపాలు సురక్షితం.",
        "action_moderate": "సున్నితమైన వారు (పిల్లలు, వృద్ధులు, ఆస్తమా) ఎక్కువసేపు బయటి శ్రమను తగ్గించండి.",
        "action": "బయటి కార్యకలాపాలు తగ్గించండి, N95 మాస్క్ ధరించండి, భారీ పనిని పీక్ సమయం తర్వాత చేయండి.",
    },
    "bn": {
        "very_poor": "খুব খারাপ",
        "poor": "খারাপ",
        "moderate": "মাঝারি",
        "severe": "গুরুতর",
        "good": "ভালো",
        "satisfactory": "সন্তোষজনক",
        "action_ok": "বাতাস ভালো — স্বাভাবিক বাইরের কাজ নিরাপদ।",
        "action_moderate": "সংবেদনশীল ব্যক্তিরা (শিশু, বয়স্ক, হাঁপানি) দীর্ঘ বাইরের পরিশ্রম কমান।",
        "action": "বাইরে কম সময় থাকুন, N95 মাস্ক পরুন এবং ভারী কাজ পিক সময়ের পরে করুন।",
    },
    "gu": {
        "very_poor": "ખૂબ ખરાબ",
        "poor": "ખરાબ",
        "moderate": "મધ્યમ",
        "severe": "ગંભીર",
        "good": "સારી",
        "satisfactory": "સંતોષકારક",
        "action_ok": "હવા સારી છે — સામાન્ય બહારની પ્રવૃત્તિ સલામત છે.",
        "action_moderate": "સંવેદનશીલ લોકો (બાળકો, વૃદ્ધો, દમના દર્દીઓ) લાંબો બહારનો શ્રમ ઓછો કરો.",
        "action": "બહારની પ્રવૃત્તિ ઓછી રાખો, N95 માસ્ક પહેરો અને ભારે કામ પીક સમય પછી કરો.",
    },
}

SUPPORTED_LANGS = tuple(LANG_LABEL.keys())   # en hi kn mr ta te bn gu


def risk_tier(pm25: float) -> str:
    for limit, tier in BREAKPOINTS_PM25:
        if pm25 <= limit:
            return tier
    return "severe"


def vulnerability_adjusted_tier(base_tier: str, vulnerability_index: float) -> str:
    idx = RISK_ORDER.index(base_tier)
    if vulnerability_index >= 0.75:
        idx += 1
    elif vulnerability_index >= 0.55 and base_tier in {"moderate", "poor"}:
        idx += 1
    return RISK_ORDER[min(idx, len(RISK_ORDER) - 1)]


def audience_segment(vulnerability: dict) -> str:
    if vulnerability.get("outdoor_worker_share", 0) >= 0.28:
        return "outdoor_worker"
    if vulnerability.get("schools", 0) >= 4:
        return "school"
    if vulnerability.get("hospitals", 0) >= 2:
        return "respiratory"
    return "general"


# Unicode block per language — the script an advisory in that language must be written in.
# Used to reject LLM output that leaks glyphs from another script (a stray CJK or Bengali
# character inside a Hindi SMS is a real failure mode) or that never switched script at all.
_SCRIPT_BLOCK = {
    "hi": (0x0900, 0x097F),   # Devanagari
    "mr": (0x0900, 0x097F),   # Devanagari
    "kn": (0x0C80, 0x0CFF),   # Kannada
    "ta": (0x0B80, 0x0BFF),   # Tamil
    "te": (0x0C00, 0x0C7F),   # Telugu
    "bn": (0x0980, 0x09FF),   # Bengali
    "gu": (0x0A80, 0x0AFF),   # Gujarati
    "pa": (0x0A00, 0x0A7F),   # Gurmukhi
}
_ALLOWED_ANY = {(0x0000, 0x024F), (0x2000, 0x206F), (0x20A0, 0x20CF), (0x2190, 0x21FF), (0x2600, 0x27BF),
                (0x1F300, 0x1FAFF), (0xFE00, 0xFE0F), (0x0964, 0x0965)}  # Latin+punct, symbols, emoji, danda


def _in(cp: int, block: tuple[int, int]) -> bool:
    return block[0] <= cp <= block[1]


def foreign_script_chars(text: str, lang: str) -> str:
    """Characters that belong to neither the target script nor the always-allowed set."""
    target = _SCRIPT_BLOCK.get(lang)
    bad = []
    for ch in text:
        cp = ord(ch)
        if ch.isspace() or ch.isdigit() or any(_in(cp, b) for b in _ALLOWED_ANY):
            continue
        if target and _in(cp, target):
            continue
        bad.append(ch)
    return "".join(bad)


def script_ok(text: str, lang: str) -> bool:
    """Cheap, deterministic sanity check for a localized advisory.

    English: no non-Latin script at all. Other languages: the target script must be
    present and no character may come from a different script. Never edits the text —
    a failing candidate is rejected and the template is kept (omitting beats shipping
    garbage to a citizen's phone).
    """
    if not text or not text.strip():
        return False
    if lang == "en":
        return not any(ord(ch) > 0x024F and not any(_in(ord(ch), b) for b in _ALLOWED_ANY) for ch in text)
    target = _SCRIPT_BLOCK.get(lang)
    if target is None:          # unknown language code -> only enforce "no foreign script" against Latin
        return True
    has_target = any(_in(ord(ch), target) for ch in text)
    return has_target and not foreign_script_chars(text, lang)


def render_message(city_name: str, place: str, tier: str, horizon_h: int, lang: str) -> str:
    """`place` is the locality this advisory is for — "Karol Bagh", or "zone-0e3d" as a last resort.

    It used to be the zone id unconditionally, which is a truncation of an H3 index. On screen that
    told a reader nothing; read aloud down an IVR line it became "zone zero-e-three-d", which is
    worse than saying nothing at all.
    """
    labels = LANG_LABEL.get(lang, LANG_LABEL["en"])
    tier_label = labels.get(tier, tier.replace("_", " "))
    # advice matches the tier: clean air gets reassurance, moderate protects sensitive
    # groups, poor and above gets the mask / limit-exertion instruction
    if tier in ("good", "satisfactory"):
        action = labels["action_ok"]
    elif tier == "moderate":
        action = labels["action_moderate"]
    else:
        action = labels["action"]
    if lang == "en":
        return f"{city_name}, {place}: air is forecast {tier_label} in +{horizon_h}h. {action}"
    if lang == "hi":
        return f"{city_name}, {place}: अगले {horizon_h} घंटों में हवा {tier_label} रहने का अनुमान है. {action}"
    if lang == "kn":
        return f"{city_name}, {place}: ಮುಂದಿನ {horizon_h} ಗಂಟೆಗಳಲ್ಲಿ ಗಾಳಿಯ ಗುಣಮಟ್ಟ {tier_label} ಇರಲಿದೆ ಎಂದು ಅಂದಾಜಿಸಲಾಗಿದೆ. {action}"
    if lang == "mr":
        return f"{city_name}, {place}: पुढील {horizon_h} तासांत हवा {tier_label} राहण्याचा अंदाज आहे. {action}"
    if lang == "ta":
        return f"{city_name}, {place}: அடுத்த {horizon_h} மணி நேரத்தில் காற்றின் தரம் {tier_label} இருக்கும் என எதிர்பார்க்கப்படுகிறது. {action}"
    if lang == "te":
        return f"{city_name}, {place}: రాబోయే {horizon_h} గంటల్లో గాలి నాణ్యత {tier_label}గా ఉండవచ్చు. {action}"
    if lang == "bn":
        return f"{city_name}, {place}: আগামী {horizon_h} ঘণ্টায় বাতাস {tier_label} থাকার পূর্বাভাস। {action}"
    if lang == "gu":
        return f"{city_name}, {place}: આગામી {horizon_h} કલાકમાં હવા {tier_label} રહેવાની આગાહી છે. {action}"
    return f"{city_name}, {place}: air is forecast {tier_label} in +{horizon_h}h. {action}"


def build_advisories(
    city_id: str,
    city_name: str,
    forecasts: list[dict],
    vulnerability_rows: list[dict],
    languages: list[str],
    horizon_h: int = 24,
    issued_at: str | None = None,
) -> list[dict]:
    issued_at = issued_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    values = [float(r["value"]) for r in forecasts if int(r.get("horizon_h", horizon_h)) == horizon_h]
    city_pm25 = sum(values) / len(values) if values else 95.0

    advisories: list[dict] = []
    for vuln in vulnerability_rows:
        # Name the place, not the hash. Falls back to the zone id when no ward polygon ships for
        # this city or the cell sits outside every one of them — an opaque id beats a wrong name.
        cell = vuln.get("h3_cell")
        place = vuln["ward_id"]
        if cell:
            hit = place_for_cell(city_id, cell)
            if hit and hit.get("label"):
                place = hit["label"]
        base = risk_tier(city_pm25)
        tier = vulnerability_adjusted_tier(base, float(vuln.get("vulnerability_index", 0)))
        segment = audience_segment(vuln)
        for lang in languages:
            for channel in CHANNELS:
                advisories.append({
                    "city_id": city_id,
                    "ward_id": vuln["ward_id"],
                    # carried so every channel can name the place without re-deriving it
                    "h3_cell": cell,
                    "issued_at": issued_at,
                    "horizon_h": horizon_h,
                    "risk_tier": tier,
                    "audience_segment": segment,
                    "language": lang,
                    "channel": channel,
                    "message": render_message(city_name, place, tier, horizon_h, lang),
                })
    return advisories
