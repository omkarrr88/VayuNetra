"""E7 — health & carbon quantification (Stage 2).

Cited factor tables (`factors`) + a quantification engine (`quantify`) that turns
a PM2.5 change into premature-deaths-averted, ₹ health cost, and CO₂e co-benefit,
each with its source. Feeds `/simulate`, the City ROI dashboard, and advisory cards.
"""
from .factors import all_citations
from .quantify import (
    attributable_cases,
    city_roi,
    co2e_cobenefit,
    quantify_intervention,
)

__all__ = [
    "quantify_intervention",
    "city_roi",
    "attributable_cases",
    "co2e_cobenefit",
    "all_citations",
]
