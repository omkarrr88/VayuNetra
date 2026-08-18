"""Optional LLM fluency polish for advisories — facts locked, validation-gated.

The PS suggests "LLMs for multi-language citizen communication". Our default
stays deterministic templates (they cannot hallucinate medical advice); this
script demonstrates the LLM pathway SAFELY: Gemini may only rephrase for
fluency, and every candidate is rejected unless the locked facts survive:

  - the zone id appears verbatim
  - the horizon ("24") appears verbatim
  - "N95" appears verbatim
  - no digits appear that weren't in the original
  - length within 0.6-1.6x of the template

Rejected candidates keep the template. Dry-run by default; --push writes the
accepted rows back. Not wired into any cron — an operator choice, disclosed.

  python -m scripts.llm_polish_advisories --city delhi --lang kn          # dry-run
  python -m scripts.llm_polish_advisories --city delhi --lang kn --push
"""
from __future__ import annotations

import argparse
import os
import re

import requests

import core.env  # noqa: F401
from agents.advisory import foreign_script_chars, script_ok

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

LANG_NAME = {"en": "English", "hi": "Hindi (Devanagari)", "kn": "Kannada (Kannada script)", "mr": "Marathi (Devanagari)",
             "ta": "Tamil (Tamil script)", "te": "Telugu (Telugu script)", "bn": "Bengali (Bengali script)", "gu": "Gujarati (Gujarati script)"}


def polish(message: str, lang: str, api_key: str) -> str | None:
    prompt = (
        f"Rewrite this air-quality advisory in natural, simple {LANG_NAME.get(lang, lang)} "
        "for a citizen SMS. Keep EXACTLY the same meaning, the same zone code, the same "
        "hour number and the token N95. Do not add numbers, health claims or advice that "
        "is not already present. Reply with only the rewritten sentence.\n\n"
        f"Advisory: {message}"
    )
    try:
        resp = requests.post(
            f"{GEMINI_URL}?key={api_key}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=30,
        )
        if resp.status_code != 200:
            return None
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:  # noqa: BLE001 — any failure keeps the safe template
        return None


def facts_survive(original: str, candidate: str, lang: str | None = None) -> bool:
    """The non-negotiable gate: locked facts intact, nothing numeric invented, right script."""
    if lang and not script_ok(candidate, lang):
        return False
    zone = re.search(r"zone-[0-9a-f]+", original)
    if zone and zone.group(0) not in candidate:
        return False
    for num in re.findall(r"\d+", original):
        if num not in candidate:
            return False
    if set(re.findall(r"\d+", candidate)) - set(re.findall(r"\d+", original)):
        return False
    if "N95" in original and "N95" not in candidate:
        return False
    if not (0.6 * len(original) <= len(candidate) <= 1.6 * len(original)):
        return False
    return True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--lang", default="kn")
    ap.add_argument("--limit", type=int, default=8)
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not set — templates stay as-is (that is the safe default).")
        return

    from core.supa import client

    db = client()
    rows = (
        db.table("advisories").select("id,ward_id,message")
        .eq("city_id", args.city).eq("language", args.lang)
        .limit(args.limit).execute().data or []
    )
    accepted = 0
    for r in rows:
        candidate = polish(r["message"], args.lang, api_key)
        # one retry with explicit feedback if the script check failed (LLMs occasionally leak
        # a glyph from another script); after that the template is kept — never a garbled SMS.
        if candidate and not script_ok(candidate, args.lang):
            bad = foreign_script_chars(candidate, args.lang)
            print(f"  script check failed for {r['ward_id']} (foreign chars: {bad!r}) — retrying once")
            candidate = polish(r["message"], args.lang, api_key)
        if candidate and facts_survive(r["message"], candidate, args.lang):
            accepted += 1
            print(f"ACCEPT {r['ward_id']}:\n  tmpl : {r['message']}\n  llm  : {candidate}")
            if args.push:
                db.table("advisories").update({"message": candidate}).eq("id", r["id"]).execute()
        else:
            print(f"REJECT {r['ward_id']} (facts gate) — template kept")
    print(f"\n{accepted}/{len(rows)} candidates passed the facts gate"
          + ("" if args.push else " (dry-run — nothing written)"))


if __name__ == "__main__":
    main()
