"""Air Quality Index arithmetic — the Indian National AQI (CPCB, 2014) and the US EPA AQI (2024
PM2.5 revision) from pollutant concentrations, plus the unit normalisation the public feeds need.

Both indices are the *maximum* of per-pollutant sub-indices; the pollutant that sets the
maximum is the "prominent pollutant" (CPCB's term). Sub-indices are linear within each
breakpoint band:  I = (I_hi - I_lo) / (C_hi - C_lo) * (C - C_lo) + I_lo.

Honesty notes, stated in the API and the UI:
* CPCB defines PM/NO2/SO2/NH3 sub-indices on 24-h averages and CO/O3 on 8-h; the US EPA on
  24-h PM, 8-h O3/CO, 1-h NO2/SO2. The console computes the formula on the **latest hourly
  readings** (as aqi.in / IQAir do for their "live" number), so the official *daily* bulletin
  can differ. Every function here takes whatever concentration it is given.
* Only pollutants a cell actually reports enter its index; most station cells carry PM2.5 and
  a subset PM10/NO2/SO2/CO/O3, so per-cell indices are comparable to a station, not to a city
  average.
* Gas units on OpenAQ/CPCB feeds arrive as ppb or µg/m³ (CO sometimes mislabelled). We convert
  ppb → µg/m³ at 25 °C, 1 atm and mg/m³ where CO is expected; CO rows whose declared unit is
  'ppb' are skipped (values on those sensors are ambiguous — a documented data-quality gap
  rather than a guessed conversion).
"""
from __future__ import annotations

from typing import Iterable, Mapping

# --------------------------------------------------------------------------- breakpoints
# CPCB National AQI: (C_lo, C_hi, I_lo, I_hi) — concentrations in µg/m³ except CO in mg/m³.
CPCB: dict[str, list[tuple[float, float, int, int]]] = {
    "pm25": [(0, 30, 0, 50), (31, 60, 51, 100), (61, 90, 101, 200), (91, 120, 201, 300), (121, 250, 301, 400), (251, 500, 401, 500)],
    "pm10": [(0, 50, 0, 50), (51, 100, 51, 100), (101, 250, 101, 200), (251, 350, 201, 300), (351, 430, 301, 400), (431, 600, 401, 500)],
    "no2":  [(0, 40, 0, 50), (41, 80, 51, 100), (81, 180, 101, 200), (181, 280, 201, 300), (281, 400, 301, 400), (401, 600, 401, 500)],
    "so2":  [(0, 40, 0, 50), (41, 80, 51, 100), (81, 380, 101, 200), (381, 800, 201, 300), (801, 1600, 301, 400), (1601, 2400, 401, 500)],
    "co":   [(0, 1.0, 0, 50), (1.1, 2.0, 51, 100), (2.1, 10, 101, 200), (10.1, 17, 201, 300), (17.1, 34, 301, 400), (34.1, 50, 401, 500)],
    "o3":   [(0, 50, 0, 50), (51, 100, 51, 100), (101, 168, 101, 200), (169, 208, 201, 300), (209, 748, 301, 400), (749, 1000, 401, 500)],
    "nh3":  [(0, 200, 0, 50), (201, 400, 51, 100), (401, 800, 101, 200), (801, 1200, 201, 300), (1201, 1800, 301, 400), (1801, 2400, 401, 500)],
}
CPCB_CATEGORIES = [(50, "Good"), (100, "Satisfactory"), (200, "Moderate"), (300, "Poor"), (400, "Very Poor"), (500, "Severe")]

# US EPA AQI (40 CFR Part 58 App. G; PM2.5 breakpoints revised Feb 2024): PM in µg/m³, O3 ppm (8-h),
# CO ppm (8-h), SO2 ppb (1-h), NO2 ppb (1-h). We accept µg/m³ for gases and convert to ppb/ppm.
EPA: dict[str, list[tuple[float, float, int, int]]] = {
    "pm25": [(0.0, 9.0, 0, 50), (9.1, 35.4, 51, 100), (35.5, 55.4, 101, 150), (55.5, 125.4, 151, 200), (125.5, 225.4, 201, 300), (225.5, 325.4, 301, 500)],
    "pm10": [(0, 54, 0, 50), (55, 154, 51, 100), (155, 254, 101, 150), (255, 354, 151, 200), (355, 424, 201, 300), (425, 604, 301, 500)],
    "no2":  [(0, 53, 0, 50), (54, 100, 51, 100), (101, 360, 101, 150), (361, 649, 151, 200), (650, 1249, 201, 300), (1250, 2049, 301, 500)],   # ppb
    "so2":  [(0, 35, 0, 50), (36, 75, 51, 100), (76, 185, 101, 150), (186, 304, 151, 200), (305, 604, 201, 300), (605, 1004, 301, 500)],       # ppb
    "co":   [(0.0, 4.4, 0, 50), (4.5, 9.4, 51, 100), (9.5, 12.4, 101, 150), (12.5, 15.4, 151, 200), (15.5, 30.4, 201, 300), (30.5, 50.4, 301, 500)],  # ppm
    "o3":   [(0.0, 0.054, 0, 50), (0.055, 0.070, 51, 100), (0.071, 0.085, 101, 150), (0.086, 0.105, 151, 200), (0.106, 0.200, 201, 300), (0.201, 0.604, 301, 500)],  # ppm 8-h
}
EPA_CATEGORIES = [(50, "Good"), (100, "Moderate"), (150, "Unhealthy for Sensitive Groups"), (200, "Unhealthy"), (300, "Very Unhealthy"), (500, "Hazardous")]

# molecular-weight factors at 25 °C, 1 atm: µg/m³ = ppb × MW / 24.45
PPB_TO_UGM3 = {"no2": 1.88, "so2": 2.62, "o3": 1.96, "co": 1.145}

# Ambient CO is never below ~0.1 mg/m³ (≈90 ppb) in a city, so a "ppb"-labelled CO of a fraction of
# a unit is not a reading in ppb — it is a mg/m³ reading with the wrong label. CPCB / CAAQMS
# publishes every gas in µg/m³ (CO in mg/m³); when an aggregator re-labels that feed as ppb, taking
# the label at face value multiplies NO2 by 1.88 and SO2 by 2.62 and can hand the city index to a
# pollutant that was never driving it. This threshold is the tell.
CO_PPB_FLOOR = 50.0

# physical-plausibility caps in CPCB units (µg/m³; CO mg/m³) — a single glitched sensor row must not
# set a city's headline index (the same guard the forecast features use for PM2.5)
PLAUSIBLE_MAX = {"pm25": 1000.0, "pm10": 2000.0, "no2": 500.0, "so2": 1000.0, "o3": 500.0, "co": 50.0, "nh3": 2000.0}


def _sub_index(table: list[tuple[float, float, int, int]], c: float) -> int | None:
    if c is None or c < 0:
        return None
    for lo, hi, ilo, ihi in table:
        if c <= hi:
            lo_c = lo
            return int(round((ihi - ilo) / (hi - lo_c) * (max(c, lo_c) - lo_c) + ilo))
    return table[-1][3]   # capped at the top of the scale


def normalise(pollutant: str, value: float, unit: str | None) -> dict[str, float | None]:
    """Return the value in the units each index expects: {'cpcb': ..., 'epa': ...}, or None where
    the declared unit cannot be trusted."""
    u = (unit or "").lower().replace(" ", "")
    p = pollutant.lower()
    if p in ("pm25", "pm10", "nh3"):
        return {"cpcb": value, "epa": value}          # µg/m³ on both feeds
    if p in ("no2", "so2"):
        ugm3 = value * PPB_TO_UGM3[p] if u == "ppb" else value
        ppb = value if u == "ppb" else value / PPB_TO_UGM3[p]
        return {"cpcb": ugm3, "epa": ppb}
    if p == "o3":
        ugm3 = value * PPB_TO_UGM3["o3"] if u == "ppb" else value
        ppm = (value if u == "ppb" else value / PPB_TO_UGM3["o3"]) / 1000.0
        return {"cpcb": ugm3, "epa": ppm}
    if p == "co":
        if u in ("mg/m³", "mg/m3"):
            mgm3 = value
        elif u in ("µg/m³", "ug/m3", "µg/m3"):
            mgm3 = value / 1000.0
        elif u == "ppm":
            mgm3 = value * 1.145
        else:                                            # 'ppb'-labelled CPCB CO is ambiguous — skip
            return {"cpcb": None, "epa": None}
        return {"cpcb": mgm3, "epa": mgm3 / 1.145}       # EPA wants ppm
    return {"cpcb": None, "epa": None}


def units_are_trustworthy(readings: Iterable[Mapping]) -> bool:
    """False when this feed's unit labels are provably wrong, so 'ppb' must not be believed.

    The test is a physical impossibility, not a guess: a CO value labelled ppb but below
    CO_PPB_FLOOR cannot be ambient air (50 ppb ≈ 0.06 mg/m³, an order of magnitude under the
    cleanest urban background). A feed that mislabels CO is mislabelling its other gases too — in
    practice it is a CPCB µg/m³ feed re-labelled as ppb by an aggregator. A feed that declares
    different unit systems for gases from the same station in the same hour is equally unreliable.
    """
    gases_ppb, gases_mass = set(), set()
    for r in readings:
        p = str(r.get("pollutant") or r.get("variable") or "").lower()
        if p not in ("no2", "so2", "o3", "co"):
            continue
        u = (str(r.get("unit") or "")).lower().replace(" ", "")
        try:
            v = float(r.get("value"))
        except (TypeError, ValueError):
            continue
        if u == "ppb":
            gases_ppb.add(p)
            if p == "co" and v < CO_PPB_FLOOR:
                return False                              # impossible as ppb — the label is wrong
        elif u in ("µg/m³", "ug/m3", "µg/m3", "mg/m³", "mg/m3"):
            gases_mass.add(p)
    # one station cannot be reporting some gases in ppb and others by mass in the same breath
    return not (gases_ppb and gases_mass)


def composite(readings: Iterable[Mapping]) -> dict:
    """readings: iterable of {'pollutant': 'pm25', 'value': 48.0, 'unit': 'µg/m³'} for ONE cell/station.
    Returns both indices with their prominent pollutant and every sub-index used."""
    readings = list(readings)
    # Decide once, for the whole station, whether its declared units can be believed. Deciding per
    # reading would let one mislabelled gas through while catching another.
    trust = units_are_trustworthy(readings)
    sub_in: dict[str, int] = {}
    sub_us: dict[str, int] = {}
    # the unit each value was actually indexed in, so a card can never show "38 ppb" beside a
    # sub-index computed from 38 µg/m³
    units: dict[str, str | None] = {}
    for r in readings:
        p = str(r.get("pollutant") or r.get("variable") or "").lower()
        try:
            v = float(r.get("value"))
        except (TypeError, ValueError):
            continue
        unit = r.get("unit")
        if not trust and (str(unit or "").lower().replace(" ", "") == "ppb"):
            # fall back to what the network actually publishes: µg/m³, CO in mg/m³
            unit = "mg/m3" if p == "co" else "µg/m³"
        units[p] = unit
        n = normalise(p, v, unit)
        if n["cpcb"] is not None and n["cpcb"] > PLAUSIBLE_MAX.get(p, float("inf")):
            continue                                     # glitch, not air
        if p in CPCB and n["cpcb"] is not None:
            si = _sub_index(CPCB[p], n["cpcb"])
            if si is not None:
                sub_in[p] = si
        if p in EPA and n["epa"] is not None:
            si = _sub_index(EPA[p], n["epa"])
            if si is not None:
                sub_us[p] = si
    out = {"sub_in": sub_in, "sub_us": sub_us, "aqi_in": None, "prominent_in": None, "aqi_us": None,
           "prominent_us": None, "units": units, "units_trusted": trust}
    if sub_in:
        p, v = max(sub_in.items(), key=lambda kv: kv[1])
        out.update(aqi_in=v, prominent_in=p, category_in=category(v, "in"))
    if sub_us:
        p, v = max(sub_us.items(), key=lambda kv: kv[1])
        out.update(aqi_us=v, prominent_us=p, category_us=category(v, "us"))
    return out


def category(index: int, scale: str = "in") -> str:
    table = CPCB_CATEGORIES if scale == "in" else EPA_CATEGORIES
    for hi, name in table:
        if index <= hi:
            return name
    return table[-1][1]
