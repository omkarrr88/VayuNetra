"""E7 — cited factor tables for health & carbon quantification.

PRD §12.15 / ARCH §9.13 / Validation #12: *every* ₹ / health / CO₂e figure must
trace to a published WHO / CPCB / emission-factor source — **never an invented
constant**. So this module is the single source of truth: one `Factor` per number,
each carrying its `value`, `unit`, a `source` citation, and (where the literature
is uncertain) an honest `caveat`. Downstream code may read only `Factor.value`,
but must surface `Factor.cite()` so the UI/dossier can show the provenance.

Nothing here is tuned to make the demo look good — the values are the standard
concentration-response / valuation / emission constants used in air-quality
health-impact assessment (WHO AirQ+ methodology). Swap a value only by swapping
its citation.
"""
from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Factor:
    """A single citable constant."""
    value: float
    unit: str
    source: str
    caveat: str = ""

    def cite(self) -> dict:
        d = {"value": self.value, "unit": self.unit, "source": self.source}
        if self.caveat:
            d["caveat"] = self.caveat
        return d


# --- Concentration–response functions (relative risk per 10 µg/m³ PM2.5) ------
# Short-term (daily-exposure) coefficients — the correct frame for a what-if that
# reduces PM2.5 for a few hours/days. Values are WHO HRAPIE recommendations.
CRF_MORTALITY_ST = Factor(
    1.0123, "RR per 10 µg/m³",
    "WHO HRAPIE (2013), all-cause (natural) mortality, short-term PM2.5, all ages — "
    "as operationalised in WHO AirQ+",
    "95% CI 1.0045–1.0201",
)

# India-scale anchor: the burden figure PS5 itself quotes traces to this work.
INDIA_ANNUAL_DEATHS_AIR_POLLUTION = Factor(
    1_670_000, "premature deaths per year (India, 2017)",
    "Balakrishnan et al., India State-Level Disease Burden Initiative — "
    "Lancet Planetary Health 2019 (GBD 2017)",
    "all air pollution (ambient + household); our city figures use the same "
    "attributable-fraction methodology at city scale",
)
CRF_RESP_ADMISSIONS_ST = Factor(
    1.0190, "RR per 10 µg/m³",
    "WHO HRAPIE (2013), respiratory hospital admissions, short-term PM2.5, all ages",
    "95% CI 1.0089–1.0297; baseline admission rate is region-specific",
)
CRF_CARDIO_ADMISSIONS_ST = Factor(
    1.0091, "RR per 10 µg/m³",
    "WHO HRAPIE (2013), cardiovascular hospital admissions, short-term PM2.5",
    "95% CI 1.0017–1.0166; baseline admission rate is region-specific",
)
# Long-term (annual-exposure) coefficient — used for the City ROI / NCAP burden.
CRF_MORTALITY_LT = Factor(
    1.08, "HR per 10 µg/m³",
    "Chen & Hoek (2020), Environ. Int. — meta-analysis, all-cause mortality, long-term PM2.5",
    "95% CI 1.06–1.09",
)

# --- Baseline incidence (India) ----------------------------------------------
BASELINE_CRUDE_DEATH_RATE_INDIA = Factor(
    7.3, "deaths per 1,000 population per year",
    "World Bank / SRS — India crude death rate, ~2021",
)

# --- Economic valuation -------------------------------------------------------
# VSL is inherently uncertain and value-laden; we expose it as a swappable factor
# and always show the source + caveat rather than presenting a single hard number.
VSL_INDIA_INR = Factor(
    5.0e7, "₹ per premature death (Value of a Statistical Life)",
    "Benefit transfer from OECD (2012) base VSL (USD 3.0M, 2005) via income "
    "elasticity 0.8; consistent with World Bank (2016) 'The Cost of Air Pollution'",
    "VSL estimates for India span ~₹3–12 crore; ₹5 crore is a conservative "
    "mid-point — treat the ₹ figure as order-of-magnitude, not precise",
)
COST_PER_RESP_ADMISSION_INR = Factor(
    35_000.0, "₹ per respiratory hospital admission (cost of illness)",
    "Indian cost-of-illness literature (direct + indirect), order-of-magnitude",
    "varies widely by facility/city; used only if a baseline admission rate is supplied",
)

# --- Emission factors → CO₂e co-benefit --------------------------------------
# CO₂e co-benefit is derived from PM2.5 tonnes avoided via a source-specific
# co-emission ratio (mass CO₂ emitted per unit PM2.5). Only sources with a
# defensible published ratio are included; others return None (honest).
CO2_PER_PM25_RATIO = {
    "biomass_burning": Factor(
        166.0, "t CO₂ per t PM2.5",
        "Derived from Andreae (2019), Atmos. Chem. Phys. — agricultural-residue "
        "burning EFs (CO₂ ≈ 1515 g/kg, PM2.5 ≈ 9.1 g/kg)",
        "field-burning average; real ratio varies with crop & combustion efficiency",
    ),
    "traffic": Factor(
        900.0, "t CO₂ per t PM2.5",
        "Derived from EEA/IPCC road-diesel EFs (CO₂ ≈ 3.17 kg/kg fuel; PM2.5 a "
        "small combustion fraction)",
        "highly fleet-dependent; first-order co-benefit estimate only",
    ),
}

# --- Population heuristic (shared with the E3 engine) -------------------------
# Kept here so health math and the simulator agree on the exposed-population basis.
POP_PER_CELL = Factor(
    40_000, "people per res-8 H3 cell (metro)",
    "VayuNetra metro-cell heuristic; WorldPop-refined population is Stage-2 E2",
    "flat heuristic — refine with WorldPop for ward-accurate counts",
)

# --- Per-city population & annual PM2.5 (for the City ROI / burden) -----------
# Annual figures drive the *annual* health burden (ROI dashboard, city comparison);
# the live snapshot PM2.5 drives the map/AQI. Both are cited.
CITY_POPULATION = {
    "delhi": Factor(20_600_000, "people (urban agglomeration)",
                    "UN World Urbanization Prospects (2018) — Delhi"),
    "bengaluru": Factor(13_200_000, "people (urban agglomeration)",
                        "UN World Urbanization Prospects (2018) — Bengaluru"),
    "mumbai": Factor(21_700_000, "people (urban agglomeration)",
                     "UN World Urbanization Prospects (2018) — Mumbai"),
    "hyderabad": Factor(10_800_000, "people (urban agglomeration)",
                        "UN World Urbanization Prospects (2018) — Hyderabad"),
    "chennai": Factor(11_800_000, "people (urban agglomeration)",
                      "UN World Urbanization Prospects (2018) — Chennai"),
    "kolkata": Factor(15_600_000, "people (urban agglomeration)",
                      "UN World Urbanization Prospects (2018) — Kolkata"),
    "pune": Factor(7_100_000, "people (urban agglomeration)",
                   "UN World Urbanization Prospects (2018) — Pune"),
    "ahmedabad": Factor(8_800_000, "people (urban agglomeration)",
                        "UN World Urbanization Prospects (2018) — Ahmedabad"),
    "jaipur": Factor(4_100_000, "people (urban agglomeration)",
                     "UN World Urbanization Prospects (2018) — Jaipur"),
    "lucknow": Factor(4_000_000, "people (urban agglomeration)",
                      "UN World Urbanization Prospects (2018) — Lucknow"),
}
CITY_ANNUAL_PM25 = {
    "delhi": Factor(92.0, "µg/m³ annual mean",
                    "IQAir World Air Quality Report (2023) — Delhi annual PM2.5"),
    "bengaluru": Factor(35.0, "µg/m³ annual mean",
                        "IQAir World Air Quality Report (2023) — Bengaluru annual PM2.5"),
    "mumbai": Factor(43.0, "µg/m³ annual mean",
                     "IQAir World Air Quality Report (2023) — Mumbai annual PM2.5"),
    "hyderabad": Factor(40.1, "µg/m³ annual mean",
                        "IQAir World Air Quality Report (2023) — Hyderabad annual PM2.5"),
    "chennai": Factor(31.4, "µg/m³ annual mean",
                      "IQAir World Air Quality Report (2023) — Chennai annual PM2.5"),
    "kolkata": Factor(51.6, "µg/m³ annual mean",
                      "IQAir World Air Quality Report (2023) — Kolkata annual PM2.5"),
    "pune": Factor(41.5, "µg/m³ annual mean",
                   "IQAir World Air Quality Report (2023) — Pune annual PM2.5"),
    "ahmedabad": Factor(50.6, "µg/m³ annual mean",
                        "IQAir World Air Quality Report (2023) — Ahmedabad annual PM2.5"),
    "jaipur": Factor(52.4, "µg/m³ annual mean",
                     "IQAir World Air Quality Report (2023) — Jaipur annual PM2.5"),
    "lucknow": Factor(65.4, "µg/m³ annual mean",
                      "IQAir World Air Quality Report (2023) — Lucknow annual PM2.5"),
}
_FALLBACK_POP = Factor(5_000_000, "people (assumed)", "VayuNetra default when a city is unlisted")
_FALLBACK_PM25 = Factor(60.0, "µg/m³ annual mean (assumed)", "VayuNetra Indian-metro default")


def population_for(city_id: str) -> Factor:
    return CITY_POPULATION.get(city_id, _FALLBACK_POP)


def annual_pm25_for(city_id: str) -> Factor:
    return CITY_ANNUAL_PM25.get(city_id, _FALLBACK_PM25)


def beta_per_ugm3(rr_per_10: float) -> float:
    """Log-linear CRF slope β (per µg/m³) from a relative risk quoted per 10 µg/m³."""
    return math.log(rr_per_10) / 10.0


def all_citations() -> list[dict]:
    """Flat list of every factor's citation — for the UI 'sources' drawer."""
    named = [
        ("short-term mortality CRF", CRF_MORTALITY_ST),
        ("respiratory-admission CRF", CRF_RESP_ADMISSIONS_ST),
        ("cardiovascular-admission CRF", CRF_CARDIO_ADMISSIONS_ST),
        ("long-term mortality CRF", CRF_MORTALITY_LT),
        ("India baseline death rate", BASELINE_CRUDE_DEATH_RATE_INDIA),
        ("value of statistical life (India)", VSL_INDIA_INR),
        ("cost per respiratory admission", COST_PER_RESP_ADMISSION_INR),
        ("population per cell", POP_PER_CELL),
    ]
    out = [{"figure": name, **f.cite()} for name, f in named]
    for src, f in CO2_PER_PM25_RATIO.items():
        out.append({"figure": f"CO₂:PM2.5 ratio ({src})", **f.cite()})
    return out
