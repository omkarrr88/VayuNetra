"""E7 — health & carbon quantification engine.

Turns a PM2.5 change (from the E3 what-if / forecast / attribution) into the
Business-Impact numbers: premature deaths averted, ₹ health cost avoided, and
CO₂e co-benefit — each computed with the cited factors in `factors.py` and
returned alongside its provenance (`citations`).

Method (standard WHO AirQ+ health-impact assessment):

    ΔCases = y0 · Population · (1 − exp(−β · ΔPM2.5)) · days

where β = ln(RR)/10 (log-linear CRF), y0 = baseline incidence rate, and ΔPM2.5
is the concentration *reduction* (µg/m³). CO₂e = tonnes-PM2.5-avoided ×
source-specific co-emission ratio.

Honesty rules kept from the E3 engine: if an input we cannot defensibly estimate
is missing (e.g. tonnes avoided → CO₂e), the corresponding figure is returned as
`None`, never faked. Every non-null figure ships with a citation.
"""
from __future__ import annotations

import math
from typing import Any, Optional

from . import factors as F

DAYS_PER_YEAR = 365.0


# --- primitives ---------------------------------------------------------------
def attributable_cases(
    delta_pm25: float,
    population: float,
    days: float,
    rr_per_10: float,
    baseline_daily_rate: float,
) -> float:
    """Cases attributable to a PM2.5 change over `days`, via the log-linear CRF.

    `delta_pm25` is the exposure *reduction* in µg/m³ (positive number). Returns
    cases **averted** (>=0). A non-positive reduction averts nothing.
    """
    if delta_pm25 <= 0 or population <= 0 or days <= 0:
        return 0.0
    beta = F.beta_per_ugm3(rr_per_10)
    attributable_fraction = 1.0 - math.exp(-beta * delta_pm25)
    return baseline_daily_rate * population * attributable_fraction * days


def _baseline_daily_death_rate() -> float:
    return F.BASELINE_CRUDE_DEATH_RATE_INDIA.value / 1000.0 / DAYS_PER_YEAR


def co2e_cobenefit(pm25_tonnes_avoided: Optional[float], source_category: str) -> Optional[float]:
    """CO₂e (tonnes) co-avoided, via a cited source-specific co-emission ratio.

    Returns None when tonnes-avoided is unknown or the source has no defensible
    published ratio — we do not invent a co-benefit.
    """
    if pm25_tonnes_avoided is None:
        return None
    ratio = F.CO2_PER_PM25_RATIO.get(source_category)
    if ratio is None:
        return None
    return round(pm25_tonnes_avoided * ratio.value, 1)


def _dominant_reduced_source(intervention: dict | None) -> str:
    """The source category an intervention mainly removes — picks the largest
    reduction in the intervention's `reductions` map; used for the CO₂e ratio."""
    reductions = (intervention or {}).get("reductions") or {}
    if not reductions:
        return "biomass_burning" if not intervention else ""
    return max(reductions, key=reductions.get)


# --- intervention-level (what-if / optimiser package) -------------------------
def quantify_intervention(
    sim_result: dict[str, Any],
    pop_per_cell: Optional[float] = None,
) -> dict[str, Any]:
    """Augment an E3 `apply_reductions` / `simulate_intervention` result with E7.

    Adds: `cases_prevented` (short-term premature deaths averted),
    `health_cost_avoided_inr`, `co2e_tonnes`, and an `impact` block carrying the
    per-figure `citations`. Non-destructive — returns a new merged dict.
    """
    pop = F.POP_PER_CELL.value if pop_per_cell is None else pop_per_cell
    horizon_h = int((sim_result.get("intervention") or {}).get("horizon_h", 24) or 24)
    days = horizon_h / 24.0

    # Per-cell short-term mortality from each cell's PM2.5 reduction.
    delta_by_cell: dict[str, float] = sim_result.get("delta_pm25_by_cell") or {}
    y0 = _baseline_daily_death_rate()
    deaths_averted = sum(
        attributable_cases(
            delta_pm25=abs(d),
            population=pop,
            days=days,
            rr_per_10=F.CRF_MORTALITY_ST.value,
            baseline_daily_rate=y0,
        )
        for d in delta_by_cell.values()
        if d < 0  # only cells whose PM2.5 actually fell
    )

    health_cost = deaths_averted * F.VSL_INDIA_INR.value

    tonnes = sim_result.get("pm25_tonnes_avoided")
    source = _dominant_reduced_source(sim_result.get("intervention"))
    co2e = co2e_cobenefit(tonnes, source)

    citations = [
        {"figure": "premature deaths averted", **F.CRF_MORTALITY_ST.cite()},
        {"figure": "baseline mortality", **F.BASELINE_CRUDE_DEATH_RATE_INDIA.cite()},
        {"figure": "₹ health cost avoided", **F.VSL_INDIA_INR.cite()},
        {"figure": "exposed population", **F.POP_PER_CELL.cite()},
    ]
    if co2e is not None:
        citations.append({"figure": "CO₂e co-benefit", **F.CO2_PER_PM25_RATIO[source].cite()})

    return {
        **sim_result,
        "cases_prevented": round(deaths_averted, 2),
        "health_cost_avoided_inr": round(health_cost),
        "co2e_tonnes": co2e,
        "impact": {
            "method": "WHO AirQ+ log-linear CRF (short-term); ΔCases = y0·Pop·(1−e^(−βΔC))·days",
            "horizon_h": horizon_h,
            "co2e_available": co2e is not None,
            "citations": citations,
        },
    }


# --- city-level (ROI dashboard) ----------------------------------------------
def city_roi(
    city_id: str,
    annual_pm25: float,
    population: float,
    counterfactual_pm25: float = 5.0,
    reduction_pct: float = 0.30,
) -> dict[str, Any]:
    """Annual PM2.5 health burden + the NCAP-target improvement, for the ROI card.

    `counterfactual_pm25` defaults to the WHO 2021 AQG annual guideline (5 µg/m³) —
    the burden is "deaths attributable to PM2.5 above the guideline". `reduction_pct`
    is the modelled NCAP-style improvement (default 30%). Long-term CRF is used.
    """
    y0_annual = F.BASELINE_CRUDE_DEATH_RATE_INDIA.value / 1000.0
    excess = max(0.0, annual_pm25 - counterfactual_pm25)

    attributable_deaths_yr = attributable_cases(
        delta_pm25=excess, population=population, days=DAYS_PER_YEAR,
        rr_per_10=F.CRF_MORTALITY_LT.value, baseline_daily_rate=y0_annual / DAYS_PER_YEAR,
    )
    # Deaths avertable by a `reduction_pct` cut (marginal, at current exposure).
    reduced_pm25 = annual_pm25 * (1.0 - reduction_pct)
    excess_after = max(0.0, reduced_pm25 - counterfactual_pm25)
    deaths_after = attributable_cases(
        delta_pm25=excess_after, population=population, days=DAYS_PER_YEAR,
        rr_per_10=F.CRF_MORTALITY_LT.value, baseline_daily_rate=y0_annual / DAYS_PER_YEAR,
    )
    deaths_avertable = max(0.0, attributable_deaths_yr - deaths_after)

    annual_burden_inr = attributable_deaths_yr * F.VSL_INDIA_INR.value
    annual_savings_inr = deaths_avertable * F.VSL_INDIA_INR.value

    return {
        "city_id": city_id,
        "annual_pm25": round(annual_pm25, 1),
        "who_guideline_pm25": counterfactual_pm25,
        "population": int(population),
        "attributable_deaths_per_year": round(attributable_deaths_yr),
        "annual_health_burden_inr": round(annual_burden_inr),
        "ncap_target_reduction_pct": round(reduction_pct * 100),
        "deaths_avertable_per_year": round(deaths_avertable),
        "annual_savings_inr": round(annual_savings_inr),
        "narrative": (
            f"At {annual_pm25:.0f} µg/m³ annual PM2.5, ~{round(attributable_deaths_yr):,} "
            f"premature deaths/yr are attributable to pollution above the WHO guideline "
            f"(₹{annual_burden_inr/1e7:,.0f} cr/yr). A {round(reduction_pct*100)}% NCAP-style "
            f"cut would avert ~{round(deaths_avertable):,} deaths/yr "
            f"(₹{annual_savings_inr/1e7:,.0f} cr/yr) — the funding case."
        ),
        "citations": [
            {"figure": "attributable deaths", **F.CRF_MORTALITY_LT.cite()},
            {"figure": "baseline mortality", **F.BASELINE_CRUDE_DEATH_RATE_INDIA.cite()},
            {"figure": "WHO annual guideline", **F.Factor(
                5.0, "µg/m³", "WHO Global Air Quality Guidelines (2021), annual PM2.5").cite()},
            {"figure": "₹ valuation", **F.VSL_INDIA_INR.cite()},
            {"figure": "national context", **F.INDIA_ANNUAL_DEATHS_AIR_POLLUTION.cite()},
        ],
    }
