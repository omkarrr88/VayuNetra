"""Public health guidance for an air-quality band — templated, cited, LLM-free.

Two products, both keyed on the CPCB National AQI band (and reported on whichever scale the
console displays, since the underlying concentration is the same):

    protection(index)   -> the actions CPCB's own advisory table prescribes at that band
    conditions(index)   -> per-condition risk + do's/don'ts for the six conditions people ask about
    cigarettes(pm25)    -> the widely used cigarette-equivalent of a day's PM2.5 exposure

Sources, quoted on every card:
* CPCB, National Air Quality Index (2014) — the "Associated Health Impacts" column of the AQI
  table, which is the statutory advisory text Indian cities publish.
* WHO, Global Air Quality Guidelines (2021) — the guideline value and the risk framing.
* Berkeley Earth, "Air Pollution and Cigarette Equivalence" (2015): a day at 22 µg/m³ of PM2.5
  ≈ one cigarette. That is a communication device, not a clinical dose — the UI says so.

Nothing here is medical advice, no number is produced by a language model, and every string is a
constant in this file so it can be reviewed line by line.
"""
from __future__ import annotations

CPCB_CITATION = "CPCB, National Air Quality Index (2014) — associated health impacts table"
WHO_CITATION = "WHO Global Air Quality Guidelines (2021)"
CIGARETTE_CITATION = "Berkeley Earth, Air Pollution and Cigarette Equivalence (2015)"
DISCLAIMER = ("General public-health guidance for the current air quality, not medical advice. "
              "If you have symptoms, consult a doctor.")

# CPCB bands by National AQI value
BANDS = [(50, "good"), (100, "satisfactory"), (200, "moderate"), (300, "poor"), (400, "very_poor"), (10_000, "severe")]
BAND_LABEL = {"unknown": "not measured", "good": "Good", "satisfactory": "Satisfactory", "moderate": "Moderate",
              "poor": "Poor", "very_poor": "Very Poor", "severe": "Severe"}

# CPCB's own advisory sentence per band (paraphrased faithfully, one line each)
BAND_ADVICE = {
    "unknown": ("We have no current reading for this city, so there is no advice to give. "
                "This is a gap in coverage, not clean air — check back once its stations report."),
    "good": "Air quality is good — minimal impact. Outdoor activity is fine for everyone.",
    "satisfactory": "Minor breathing discomfort is possible for sensitive people; everyone else is unaffected.",
    "moderate": "Breathing discomfort for people with asthma, and for those with heart or lung disease; the general public is largely unaffected.",
    "poor": "Breathing discomfort for most people on prolonged exposure; heart and lung patients should limit outdoor exertion.",
    "very_poor": "Respiratory illness on prolonged exposure; the effect is more pronounced for people with heart or lung disease.",
    "severe": "Serious respiratory effects even for healthy people, and grave impact for those with existing disease; avoid outdoor activity.",
}

# Protective actions per band: (key, label, prescription)
ACTIONS = {
    # Nothing to prescribe without a measurement. An empty list is the honest answer.
    "unknown": [],
    "good":         [("outdoor", "Outdoor activity", "Go ahead"), ("windows", "Windows", "Open"), ("mask", "N95 mask", "Not needed"), ("purifier", "Air purifier", "Off")],
    "satisfactory": [("outdoor", "Outdoor activity", "Fine"), ("windows", "Windows", "Open"), ("mask", "N95 mask", "Not needed"), ("purifier", "Air purifier", "Off")],
    "moderate":     [("outdoor", "Heavy exertion", "Reduce if sensitive"), ("windows", "Windows", "Open away from traffic"), ("mask", "N95 mask", "If sensitive"), ("purifier", "Air purifier", "Optional")],
    "poor":         [("outdoor", "Outdoor exertion", "Limit"), ("windows", "Windows", "Keep closed at peak hours"), ("mask", "N95 mask", "Recommended outdoors"), ("purifier", "Air purifier", "On")],
    "very_poor":    [("outdoor", "Outdoor exertion", "Avoid"), ("windows", "Windows", "Keep closed"), ("mask", "N95 mask", "Wear outdoors"), ("purifier", "Air purifier", "On")],
    "severe":       [("outdoor", "Going outside", "Only if necessary"), ("windows", "Windows", "Keep closed"), ("mask", "N95 mask", "Wear outdoors"), ("purifier", "Air purifier", "On, run continuously")],
}

# Per-condition guidance. `risk` is the band-indexed risk word; do/dont lists are constant text.
CONDITIONS: list[dict] = [
    {
        "key": "asthma", "label": "Asthma",
        "symptoms": "Wheezing, shortness of breath, chest tightness and cough become more frequent as PM2.5 rises.",
        "do": ["Keep your reliever inhaler with you and use it as prescribed.",
               "Move exercise indoors or to the cleanest hours (usually early afternoon).",
               "Run an air purifier in the room you sleep in and keep windows shut at peak hours."],
        "dont": ["Don't exercise outdoors without a mask when the air is Poor or worse.",
                 "Don't stay near idling traffic, burning waste or construction dust.",
                 "Don't skip preventive medication because you feel fine today."],
    },
    {
        "key": "heart", "label": "Heart conditions",
        "symptoms": "Fine particles enter the bloodstream; chest pain, palpitations and breathlessness can worsen within hours of a spike.",
        "do": ["Keep outdoor exertion light and short on Poor-or-worse days.",
               "Take prescribed medication on schedule and monitor blood pressure.",
               "Seek care immediately for chest pain or sudden breathlessness."],
        "dont": ["Don't do heavy outdoor work or long walks during evening peaks.",
                 "Don't smoke or sit in smoky rooms — it compounds the same exposure.",
                 "Don't ignore new symptoms on a high-pollution day."],
    },
    {
        "key": "allergies", "label": "Allergies",
        "symptoms": "Sneezing, runny nose, itchy eyes and throat irritation increase as particles and pollen combine.",
        "do": ["Keep indoor air clean with a HEPA purifier; wash bedding regularly.",
               "Rinse nose and eyes after coming indoors.",
               "Wear a well-fitted mask outdoors on high-particle days."],
        "dont": ["Don't dry laundry outdoors when particles are high.",
                 "Don't burn incense, candles or waste indoors.",
                 "Don't leave windows open through the night at peak hours."],
    },
    {
        "key": "sinus", "label": "Sinus",
        "symptoms": "Congestion, facial pressure and headaches worsen when dust and dry air combine.",
        "do": ["Use saline nasal irrigation and stay hydrated.",
               "Humidify dry indoor air moderately.",
               "Cover nose and mouth in dusty corridors and near construction."],
        "dont": ["Don't use decongestant sprays for more than a few days without advice.",
                 "Don't cycle or walk beside heavy traffic when the air is Poor or worse."],
    },
    {
        "key": "coldflu", "label": "Cold / flu",
        "symptoms": "Polluted air irritates already inflamed airways, so coughs last longer and recovery is slower.",
        "do": ["Rest indoors with clean air and drink warm fluids.",
               "Keep the sick room's air filtered and smoke-free.",
               "Wear a mask outdoors to protect irritated airways."],
        "dont": ["Don't exercise outdoors while recovering on a high-pollution day.",
                 "Don't expose children and elderly household members to smoke or dust."],
    },
    {
        "key": "copd", "label": "Chronic (COPD)",
        "symptoms": "Exacerbations — worsening breathlessness, sputum and cough — track closely with PM2.5 spikes.",
        "do": ["Follow your action plan and keep rescue medication ready.",
               "Stay indoors with filtered air on Poor-or-worse days.",
               "Keep vaccinations current and arrange care before the winter season."],
        "dont": ["Don't go outdoors unprotected when the air is Very Poor or Severe.",
                 "Don't use biomass or kerosene indoors for cooking or heating.",
                 "Don't delay medical help when breathlessness changes."],
    },
]

RISK_BY_BAND = {"unknown": "not measured", "good": "minimal", "satisfactory": "low", "moderate": "mild", "poor": "moderate",
                "very_poor": "high", "severe": "very high"}


def band_for_index(index: float | int | None) -> str:
    """CPCB band for an index, or "unknown" when there is no reading.

    This used to return "moderate" for a null index, which made /city/overview render "What to do
    now — air is Moderate" with a full set of prescriptions for a city we had measured nothing in.
    Everywhere else this product shows a gap as a gap; inventing a band here was the one place it
    did not.
    """
    if index is None:
        return "unknown"
    for hi, name in BANDS:
        if index <= hi:
            return name
    return "severe"


def cigarettes(pm25_24h: float | None) -> dict:
    """Cigarette-equivalent of a day at this PM2.5 (Berkeley Earth: 22 µg/m³ ≈ 1 cigarette/day)."""
    if pm25_24h is None:
        return {"per_day": None, "per_week": None, "per_month": None, "source": CIGARETTE_CITATION}
    per_day = round(pm25_24h / 22.0, 1)
    return {
        "per_day": per_day, "per_week": round(per_day * 7, 1), "per_month": round(per_day * 30, 1),
        "pm25_basis": round(pm25_24h, 1), "source": CIGARETTE_CITATION,
        "note": "Communication device, not a clinical dose: it converts the last 24 h mean PM2.5 assuming continuous exposure.",
    }


def advice(index: float | int | None, pm25_24h: float | None = None) -> dict:
    """Everything the health card needs for one city at one moment."""
    band = band_for_index(index)
    return {
        "band": band, "band_label": BAND_LABEL[band], "index": index,
        "headline": BAND_ADVICE[band],
        "actions": [{"key": k, "label": lb, "prescription": pr} for k, lb, pr in ACTIONS[band]],
        "conditions": [{**c, "risk": RISK_BY_BAND[band]} for c in CONDITIONS],
        "cigarettes": cigarettes(pm25_24h),
        "sources": [CPCB_CITATION, WHO_CITATION, CIGARETTE_CITATION],
        "disclaimer": DISCLAIMER,
    }
