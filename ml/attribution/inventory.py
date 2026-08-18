"""Published emission-inventory anchors for attribution validation.

PS5's evaluation focus asks for "source attribution accuracy versus ground-truth
emission inventories". No live speciated ground truth exists in public feeds, so
this module carries the next-best external anchor: sectoral PM2.5 source shares
transcribed from published city studies (SAFAR/IITM for Delhi, CSTEP for
Bengaluru, Urban Emissions/NEERI-style syntheses for Mumbai), each with its
citation, and a comparison of our live attribution against them.

Honesty notes (also surfaced in evaluate.ipynb §10):
- Values are APPROXIMATE transcriptions of published summaries. Apportionment
  studies differ across methods and years — this is an order-of-magnitude
  anchor, not ground truth.
- City emission inventories cover LOCALLY-EMITTED pollution only, so our
  "transported" (regional advection) and "other" shares have no inventory
  analog. The comparison therefore renormalizes both sides over the four
  locally-attributable categories before scoring.
"""
from __future__ import annotations

from dataclasses import dataclass

LOCAL_CATEGORIES = ("traffic", "construction_dust", "industrial", "biomass_burning")


@dataclass(frozen=True)
class InventoryAnchor:
    shares: dict[str, float]   # category -> approximate published share of PM2.5
    source: str                # citation
    caveat: str


CITY_INVENTORY: dict[str, InventoryAnchor] = {
    "delhi": InventoryAnchor(
        shares={
            "traffic": 0.41,
            "construction_dust": 0.215,   # wind-blown + road + construction dust
            "industrial": 0.186,
            "biomass_burning": 0.058,     # domestic solid fuel / open burning
            "other": 0.131,
        },
        source="SAFAR-Delhi Emission Inventory 2018 (IITM / Ministry of Earth Sciences)",
        caveat="approximate transcription; Delhi apportionment studies (SAFAR, TERI-ARAI 2018, IIT-K 2016) vary by season and method",
    ),
    "bengaluru": InventoryAnchor(
        # CSTEP (Feb 2022) §4.3.4 — WRF-CAMx source-off simulations, share of the 2019 annual
        # PM2.5 *concentration* inside BBMP: transport 51.36 %, road + re-suspended dust 30.92 %,
        # DG sets 8.8 %, waste burning 5.67 % (remainder = domestic / eateries / industry).
        # Verified against the primary PDF (docs/sources/EI_Report_Final_04Feb22.pdf).
        shares={
            "traffic": 0.5136,
            "construction_dust": 0.3092,  # road dust + re-suspended road dust
            "industrial": 0.088,          # DG sets — Bengaluru has little in-city heavy industry
            "biomass_burning": 0.0567,    # municipal solid-waste burning
            "other": 0.0325,
        },
        source="CSTEP, Emission Inventory and Pollution Reduction Strategies for Bengaluru (Feb 2022), §4.3.4, base year 2019, BBMP area",
        caveat=("share of modelled annual PM2.5 concentration, not of emissions; the independent Guttikunda et al. (2019, "
                "Atmos. Pollut. Res., Table 5, base year 2015, Greater Bengaluru airshed) study gives transport 28.1 %, dust 22.9 %, "
                "open waste burning 14.4 %, industries + kilns + DG 8.2 %, outside the airshed 17.2 %"),
    ),
    "mumbai": InventoryAnchor(
        shares={
            "traffic": 0.20,
            "construction_dust": 0.23,
            "industrial": 0.36,           # industry + power (Trombay/refinery belt)
            "biomass_burning": 0.07,      # open/waste burning
            "other": 0.14,
        },
        source="Urban Emissions / NEERI-MPCB Mumbai PM2.5 apportionment syntheses (2019-20)",
        caveat="approximate transcription; Mumbai studies differ notably on the industry vs dust split",
    ),
}


# Approximate annual PM2.5 emissions (tonnes/yr) per locally-attributable
# category, from the same published inventories as the shares above (city total
# × sector share). Order-of-magnitude anchors for tonnes-avoided estimates —
# EDGAR v8.1 (JRC) provides the consistent national frame these city studies
# refine. Explicitly approximate; carried with citations, never silently.
SECTOR_EMISSIONS_TPY: dict[str, dict] = {
    "delhi": {
        "tonnes": {"traffic": 27_900, "construction_dust": 14_600, "industrial": 12_600, "biomass_burning": 3_900},
        "source": "SAFAR-Delhi Emission Inventory 2018 (~68 kt PM2.5/yr total × sector shares)",
    },
    "bengaluru": {
        # CSTEP 2022 executive summary + §4: 14,700 t PM2.5/yr emitted in BBMP in 2019; DG sets 1,601 t,
        # MSW burning 1,412 t, construction 450 t; transport (tail-pipe + re-suspended road dust, reported
        # together for PM2.5) ≈ 70 % of the load. Verified against the primary PDF.
        "tonnes": {"traffic": 10_300, "construction_dust": 450, "industrial": 1_600, "biomass_burning": 1_400},
        "source": "CSTEP Bengaluru emission inventory (2022; 14,700 t PM2.5/yr in BBMP, 2019): transport incl. re-suspended road dust ~70 %, DG sets 1,601 t, MSW burning 1,412 t, construction 450 t",
    },
    "mumbai": {
        "tonnes": {"traffic": 9_000, "construction_dust": 10_300, "industrial": 16_200, "biomass_burning": 3_200},
        "source": "Urban Emissions / NEERI-MPCB syntheses (~45 kt PM2.5/yr total × sector shares)",
    },
}


def _renormalize_local(shares: dict[str, float]) -> dict[str, float]:
    """Keep only locally-attributable categories, renormalized to sum 1."""
    local = {c: max(0.0, shares.get(c, 0.0)) for c in LOCAL_CATEGORIES}
    total = sum(local.values()) or 1.0
    return {c: v / total for c, v in local.items()}


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    import math

    dot = sum(a[c] * b[c] for c in LOCAL_CATEGORIES)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def city_mean_attribution(city_id: str) -> dict[str, float]:
    """Live attribution rows -> city-mean share per category (server-side)."""
    from core.supa import client

    rows = (
        client().table("attribution")
        .select("h3_cell,source_category,share")
        .eq("city_id", city_id)
        .execute()
        .data
    )
    sums: dict[str, float] = {}
    counts: dict[str, int] = {}
    for r in rows:
        c = r["source_category"]
        sums[c] = sums.get(c, 0.0) + float(r["share"])
        counts[c] = counts.get(c, 0) + 1
    return {c: sums[c] / counts[c] for c in sums}


def compare_with_inventory(city_id: str, attribution_means: dict[str, float] | None = None) -> dict:
    """Our live attribution vs the published inventory anchor (local categories).

    Returns per-category side-by-side shares, cosine similarity, and the mean
    absolute share difference — plus the citation and caveats.
    """
    anchor = CITY_INVENTORY.get(city_id)
    if anchor is None:
        raise ValueError(f"no published inventory anchor for '{city_id}'")
    ours_raw = attribution_means if attribution_means is not None else city_mean_attribution(city_id)

    ours = _renormalize_local(ours_raw)
    ref = _renormalize_local(anchor.shares)
    mad = sum(abs(ours[c] - ref[c]) for c in LOCAL_CATEGORIES) / len(LOCAL_CATEGORIES)

    return {
        "city_id": city_id,
        "categories": {
            c: {"attribution": round(ours[c], 3), "inventory": round(ref[c], 3)}
            for c in LOCAL_CATEGORIES
        },
        "cosine_similarity": round(_cosine(ours, ref), 3),
        "mean_abs_diff": round(mad, 3),
        "inventory_source": anchor.source,
        "caveat": anchor.caveat,
        "method_note": "renormalized over locally-attributable categories; "
                       "'transported'/'other' have no analog in a city emission inventory",
    }
