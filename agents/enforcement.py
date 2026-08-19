"""Agent 3 — Enforcement Intelligence & Prioritisation Agent.

Reads attribution + forecast data and the emission source registry, computes an
exposure-weighted priority score for each candidate source, retrieves regulatory
citations via the RAG subsystem, and generates a ranked enforcement worklist with
cited evidence dossiers.

Priority score formula (PRD §12.4):
    priority = source_contribution × population_exposed_norm × actionability × confidence

Each recommendation is written to the ``enforcement_recs`` table (or DEMO fixture).
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import core.env  # noqa: F401

logger = logging.getLogger(__name__)

DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
FIXTURES = Path(__file__).resolve().parent.parent / "demo" / "fixtures"

# CPCB/GRAP rubric scoring weights (total = 10):
# attribution_match (0–2), actionability (0–2), exposure (0–2),
# regulatory_basis (0–2), confidence (0–1), novelty (0–1)
RUBRIC_MAX = 10


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class AttributionRecord:
    h3_cell: str
    city_id: str
    source_category: str
    share: float            # 0..1
    confidence: float       # 0..1
    evidence: dict = field(default_factory=dict)
    ts_window: Optional[tuple] = None


@dataclass
class EmissionSource:
    id: int
    city_id: str
    name: str
    type: str               # industry, construction, waste_burn, diesel_corridor
    source_origin: str      # registry | cv_detected
    detection_confidence: float = 1.0
    attributes: dict = field(default_factory=dict)
    pop_exposed: int = 0    # derived from spatial join with WorldPop


@dataclass
class EnforcementRec:
    city_id: str
    h3_cell: str
    source_id: int
    priority_score: float
    contribution: float
    pop_exposed: int
    rationale: str
    evidence: dict
    rag_citations: list[dict]
    rubric_score: dict
    status: str = "proposed"
    ts: str = ""

    def to_dict(self) -> dict:
        return {
            "city_id": self.city_id,
            "h3_cell": self.h3_cell,
            "source_id": self.source_id,
            "priority_score": round(self.priority_score, 4),
            "contribution": round(self.contribution, 4),
            "pop_exposed": self.pop_exposed,
            "rationale": self.rationale,
            "evidence": self.evidence,
            "rag_citations": self.rag_citations,
            "rubric_score": self.rubric_score,
            "status": self.status,
            "ts": self.ts or datetime.now(timezone.utc).isoformat(),
        }


# ---------------------------------------------------------------------------
# Demo data loaders (DEMO_MODE)
# ---------------------------------------------------------------------------

def _load_demo_attribution(city_id: str) -> list[dict]:
    p = FIXTURES / "attribution.json"
    if p.exists():
        data = json.loads(p.read_text())
        # inject city_id
        for row in data:
            row.setdefault("city_id", city_id)
        return data
    return []


def _load_demo_emission_sources(city_id: str) -> list[dict]:
    """Return mock emission sources for DEMO_MODE (substitutes the source registry)."""
    return [
        {
            "id": 101,
            "city_id": city_id,
            "name": "Sarai Kale Khan Construction Site",
            "type": "construction",
            "source_origin": "registry",
            "detection_confidence": 1.0,
            "pop_exposed_estimate": 18400,
            "attributes": {"permit": "DMRC-2025-4421", "area_sqm": 45000},
        },
        {
            "id": 102,
            "city_id": city_id,
            "name": "Mayapuri Industrial Cluster",
            "type": "industry",
            "source_origin": "registry",
            "detection_confidence": 1.0,
            "pop_exposed_estimate": 9200,
            "attributes": {"consent_id": "DPCC-2024-IND-1102", "sector": "metal_recycling"},
        },
        {
            "id": 103,
            "city_id": city_id,
            "name": "Timarpur Waste Burning Site",
            "type": "waste_burn",
            "source_origin": "registry",
            "detection_confidence": 0.85,
            "pop_exposed_estimate": 6500,
            "attributes": {"ward": "Timarpur Ward 12"},
        },
    ]


# ---------------------------------------------------------------------------
# Priority score computation
# ---------------------------------------------------------------------------

_ACTIONABILITY = {
    "construction_dust": 0.95,    # inspectors can verify and fine immediately
    "industrial": 0.85,           # requires more process (stack tests, CTO check)
    "biomass_burning": 0.90,      # immediate cessation possible
    "traffic": 0.55,              # harder to act on — diffuse
    "transported": 0.20,          # largely unactionable locally
    "other": 0.40,
}


# ---------------------------------------------------------------------------- value per inspector-hour
#
# The priority score answers "how big is this source". It does not answer the question an officer
# with four site visits in a day actually has: "where is my next hour best spent?" That needs three
# things the priority score leaves out — what an inspection COSTS, whether the cell is even heading
# for trouble, and how much of the estimate we are willing to bet on.
#
# ASSUMPTION, stated because it is not measured: inspector-hours per source category. These are the
# team's estimates of what each action actually requires, not observed figures from any board. They
# are surfaced on the card and in the API so a reviewer can disagree with the number rather than
# with a hidden constant, and an officer can replace them with their own.
INSPECTOR_HOURS: dict[str, float] = {
    "biomass_burning": 1.0,     # visit, order cessation, done
    "construction_dust": 2.0,   # site visit; visual check against the dust-suppression norms
    "other": 4.0,
    "traffic": 6.0,             # corridor survey, and needs traffic-police coordination
    "industrial": 8.0,          # stack test, consent-to-operate check, a follow-up visit
    "transported": 12.0,        # largely outside local jurisdiction — inter-state coordination
}

# The pessimistic share is simply the share the model is confident in: share x confidence. No tuning
# constant, and one sentence explains it — "we count only the part of the estimate we would bet on".
# That makes the ranking RISK-AVERSE: at confidence 0.4 a 60% share counts for 24%, so a 30% share we
# are 95% sure of outranks it. Spending a calibrated confidence this way is the point of having one.

# The band the urgency weight is about: P(PM2.5 > 120 µg/m³) is the calibrated exceedance probability
# stored on every cell forecast (split-conformal, held-out residuals).
EXCEEDANCE_HORIZONS = (24, 48)

# Urgency is a MULTIPLIER on baseline benefit, not the whole of it.
#
# Multiplying benefit by P(exceed) outright would say pollution matters only above 120 µg/m³ — which
# contradicts the health science this product quotes everywhere else (WHO 2021: no threshold below
# which PM2.5 is known to be safe), and in the monsoon, when P(>120) is ~0.001 across Delhi, it
# collapses every score to nearly zero and the ranking stops discriminating at all.
#
# So: reducing exposure always has value, linear in µg/m³ x people, and a cell heading for Very Poor
# is worth up to four times as much — because that is where the acute health risk and the officer's
# statutory obligation both spike.
URGENCY_WEIGHT = 3.0


def _compute_value(
    share: float,
    confidence: float,
    pop_exposed: int,
    source_category: str,
    pm25_low: float | None,
    p_exceed: float | None,
) -> dict:
    """Conservative exposure reduction per inspector-hour, with every term exposed.

    benefit = (share x confidence) x pm25_low x people x (1 + 3 x P(exceed))
    value   = benefit / inspector_hours          [person-µg/m³ avoided per inspector-hour]

    `pm25_low` is the conformal LOWER bound of the cell's +24 h forecast — a calibrated bound, not a
    guess — so the benefit is what acting is worth even if the forecast lands at the bottom of its
    interval. `p_exceed` is the calibrated probability the cell crosses Very Poor within two days:
    a big source in a cell that will be fine anyway is not where the hour should go.

    Returns None-valued fields rather than substituting numbers when the forecast is missing, so the
    card can say the ranking fell back instead of showing a figure with nothing behind it.
    """
    hours = INSPECTOR_HOURS.get(source_category, 4.0)
    share_low = max(0.0, share * min(max(confidence, 0.0), 1.0))
    if pm25_low is None or p_exceed is None:
        return {
            "value_per_hour": None,
            "share_low": round(share_low, 4),
            "inspector_hours": hours,
            "basis": "no cell forecast — ranked by priority score",
            "assumption": "inspector-hours are the team's estimate, not a measured figure",
        }
    delta_low = share_low * float(pm25_low)                  # µg/m³ this source is conservatively due
    urgency = 1.0 + URGENCY_WEIGHT * min(max(float(p_exceed), 0.0), 1.0)
    benefit = delta_low * max(pop_exposed, 0) * urgency
    return {
        "value_per_hour": round(benefit / hours, 2),
        "urgency_x": round(urgency, 2),
        "benefit_person_ugm3": round(benefit, 1),
        "delta_pm25_low": round(delta_low, 2),
        "share_low": round(share_low, 4),
        "pm25_low": round(float(pm25_low), 1),
        "p_exceed": round(float(p_exceed), 3),
        "inspector_hours": hours,
        "basis": "conformal lower bound of the +24 h forecast, scaled by 1 + 3 x calibrated P(>120 µg/m³)",
        "assumption": "inspector-hours are the team's estimate, not a measured figure",
    }


def _cell_forecast_index(rows: list[dict]) -> dict[str, dict]:
    """Newest forecast per (cell, horizon): the +24 h conformal lower bound, and the worst
    exceedance probability across the horizons we act on.

    Keyed per HORIZON, not per cell. The forecast writer stamps each horizon's batch a few seconds
    apart, so a cell's three horizons carry three different `issued_at` values — taking "the newest
    issue for this cell" selected only the +72 h batch and then discarded it for being the wrong
    horizon, which silently left every recommendation without a value. Per-horizon is also the
    correct semantic: the latest forecast for this cell at this horizon.
    """
    newest: dict[tuple[str, int], tuple[str, dict]] = {}
    for r in rows:
        cell = r.get("h3_cell")
        if not cell:
            continue
        try:
            h = int(r.get("horizon_h") or 0)
        except (TypeError, ValueError):
            continue
        if h not in EXCEEDANCE_HORIZONS:
            continue
        issued = str(r.get("issued_at") or "")
        key = (cell, h)
        if key not in newest or issued > newest[key][0]:
            newest[key] = (issued, r)

    out: dict[str, dict] = {}
    for (cell, h), (_issued, r) in newest.items():
        slot = out.setdefault(cell, {"pm25_low": None, "p_exceed": None})
        if h == 24 and r.get("pi_low") is not None:
            try:
                slot["pm25_low"] = max(0.0, float(r["pi_low"]))
            except (TypeError, ValueError):
                pass
        if r.get("p_over_120") is not None:
            try:
                p = float(r["p_over_120"])
                slot["p_exceed"] = p if slot["p_exceed"] is None else max(slot["p_exceed"], p)
            except (TypeError, ValueError):
                pass
    return out


def _compute_priority(
    share: float,
    pop_exposed: int,
    source_category: str,
    confidence: float,
    max_pop: int = 50_000,
) -> float:
    """Exposure-weighted priority score in [0, 1]."""
    pop_norm = min(pop_exposed / max_pop, 1.0) if max_pop > 0 else 0.0
    actionability = _ACTIONABILITY.get(source_category, 0.5)
    score = share * pop_norm * actionability * confidence
    return round(min(score, 1.0), 4)


def _compute_rubric(
    share: float,
    pop_exposed: int,
    source_category: str,
    confidence: float,
    num_citations: int,
) -> dict:
    """CPCB/GRAP rubric proxy (total 10 points; ≥8 = 'would-act')."""
    attribution_match = 2 if share > 0.3 else (1 if share > 0.1 else 0)
    actionability_score = 2 if _ACTIONABILITY.get(source_category, 0) > 0.7 else (
        1 if _ACTIONABILITY.get(source_category, 0) > 0.4 else 0
    )
    exposure_score = 2 if pop_exposed > 10_000 else (1 if pop_exposed > 3_000 else 0)
    regulatory_score = min(num_citations, 2)
    confidence_score = 1 if confidence > 0.7 else 0
    total = attribution_match + actionability_score + exposure_score + regulatory_score + confidence_score
    return {
        "attribution_match": attribution_match,
        "actionability": actionability_score,
        "exposure": exposure_score,
        "regulatory_basis": regulatory_score,
        "confidence": confidence_score,
        "total": total,
        "would_act": total >= 8,
    }


# ---------------------------------------------------------------------------
# Dossier generation
# ---------------------------------------------------------------------------

def _generate_rationale(
    source: dict,
    share: float,
    pop_exposed: int,
    source_category: str,
    citations: list[dict],
) -> str:
    """Generate a human-readable enforcement rationale string.

    Careful claim: the attribution share belongs to the CATEGORY at that cell
    (e.g. "construction dust: 28.6%"), and the site is the registered source of
    that category there — saying "Site X contributes 28.6%" would over-attribute
    a whole category to one facility.
    """
    pct = round(share * 100, 1)
    source_name = source.get("name", "Unknown source")
    source_type = source.get("type", source_category)
    cat_label = {
        "construction_dust": "Construction dust",
        "industrial": "Industrial emissions",
        "biomass_burning": "Waste/biomass burning",
        "traffic": "Traffic",
    }.get(source_category, source_category.replace("_", " ").capitalize())

    rationale_parts = [
        f"{cat_label} contributes approximately {pct}% of PM2.5 in this cell "
        f"(~{pop_exposed:,} residents exposed);",
        f"{source_name} is the registered {source_type.replace('_', ' ')} source at this location.",
    ]

    if source_type == "construction":
        rationale_parts.append(
            "Site inspection required: verify dust suppression norms compliance "
            "(anti-smog gun, water sprinkling, green net coverage)."
        )
    elif source_type == "industry":
        rationale_parts.append(
            "Industrial inspection required: verify stack emission norms, "
            "Consent-to-Operate (CTO) compliance, and OCEMS data."
        )
    elif source_type == "waste_burn":
        rationale_parts.append(
            "Immediate cessation of open burning required; "
            "issue on-the-spot fine under GRAP/SWM Rules 2016."
        )
    elif source_type == "diesel_corridor":
        rationale_parts.append(
            "Enforce PUC certificate checks; restrict pre-BS-IV vehicles during peak hours."
        )

    rules = _pretty_rules([c.get("rule", "") for c in citations or []])
    if rules:
        rationale_parts.append(f"Regulatory basis: {'; '.join(rules)}.")

    return " ".join(rationale_parts)


_RULE_ACRONYMS = ("GRAP", "CPCB", "CAQM", "SWM", "NCAP", "PUC", "CTO", "OCEMS", "AQI")


def _pretty_rules(raw: list[str], limit: int = 2) -> list[str]:
    """Readable, deduped rule names from kb-chunk titles.

    Chunk titles arrive SHOUTING with a "— FULL TEXT" suffix, and two chunks of
    the same document produce the same title twice — both leaked into stored
    rationales before this cleanup.
    """
    out: list[str] = []
    seen: set[str] = set()
    for r in raw:
        rule = re.sub(r"\s*[—–-]\s*full text\.?\s*$", "", (r or "").strip(), flags=re.IGNORECASE)
        if len(rule) > 6 and rule.isupper():
            rule = rule.title()
            for a in _RULE_ACRONYMS:
                rule = re.sub(rf"\b{a.title()}\b", a, rule)
        key = rule.lower()
        if rule and key not in seen:
            seen.add(key)
            out.append(rule)
        if len(out) >= limit:
            break
    return out


# ---------------------------------------------------------------------------
# Main enforcement agent function
# ---------------------------------------------------------------------------

def run_enforcement(
    city_id: str,
    attribution_data: Optional[list[dict]] = None,
    emission_sources: Optional[list[dict]] = None,
    write_to_db: bool = False,
) -> list[EnforcementRec]:
    """Run the enforcement scoring + RAG citation pipeline.

    Args:
        city_id: City to process.
        attribution_data: Pre-loaded attribution rows (or None → load from DB/fixtures).
        emission_sources: Pre-loaded emission source registry (or None → load from DB/fixtures).
        write_to_db: If True and DEMO_MODE=False, upsert recs to Supabase.

    Returns:
        List of EnforcementRec sorted by descending priority_score.
    """
    from rag.retrieve import retrieve_for_enforcement

    # Load data
    if attribution_data is None:
        if DEMO_MODE:
            attribution_data = _load_demo_attribution(city_id)
        else:
            from core.supa import client
            db = client()
            rows = (
                db.table("attribution")
                .select("h3_cell,source_category,share,confidence,evidence,ts_window")
                .eq("city_id", city_id)
                .order("share", desc=True)
                .limit(200)
                .execute()
                .data
            )
            attribution_data = rows

    # Cell forecasts feed the value-per-inspector-hour ranking: the conformal lower bound of the
    # +24 h prediction, and the calibrated probability the cell crosses Very Poor. Absent (demo
    # fixtures, a city with no forecast yet) the ranking falls back to the priority score and says so.
    forecast_index: dict[str, dict] = {}
    if not DEMO_MODE:
        try:
            from core.supa import client as _fc_client
            fc_rows = (
                _fc_client().table("forecasts")
                .select("h3_cell,horizon_h,value,pi_low,p_over_120,issued_at")
                .eq("city_id", city_id).eq("target_var", "pm25")
                .order("issued_at", desc=True).limit(4000).execute().data
            ) or []
            forecast_index = _cell_forecast_index(fc_rows)
        except Exception as e:  # noqa: BLE001 — the worklist must render without forecasts
            logger.warning("enforcement: no cell forecasts for %s (%s); value ranking falls back", city_id, e)

    if emission_sources is None:
        if DEMO_MODE:
            emission_sources = _load_demo_emission_sources(city_id)
        else:
            from core.supa import client
            db = client()
            emission_sources = (
                db.table("emission_sources")
                .select("id,city_id,name,type,source_origin,detection_confidence,attributes")
                .eq("city_id", city_id)
                .execute()
                .data
            )
            if not emission_sources:
                emission_sources = _load_demo_emission_sources(city_id)

    # Build a cell→attribution lookup (dominant source per cell)
    cell_dominant: dict[str, dict] = {}
    for row in attribution_data:
        h3 = row.get("h3_cell", "")
        share = row.get("share", 0.0)
        existing = cell_dominant.get(h3)
        if existing is None or share > existing.get("share", 0):
            cell_dominant[h3] = {**row, "city_id": city_id}

    # Per-category rows indexed by cell, for spatial (nearest-cell) matching
    rows_by_cat_cell: dict[str, dict[str, dict]] = {}
    for row in attribution_data:
        cat, h3 = row.get("source_category"), row.get("h3_cell", "")
        if cat and h3:
            rows_by_cat_cell.setdefault(cat, {})[h3] = row

    def _nearest_attr(source_cell: str | None, category: str) -> Optional[dict]:
        """The attribution row for this category at the source's OWN nearest cell.

        Previously every source inherited the city-wide dominant share for its
        category, so unrelated sites all claimed the same (often huge) number.
        """
        cat_rows = rows_by_cat_cell.get(category) or {}
        if not cat_rows:
            return None
        if source_cell in cat_rows:
            return cat_rows[source_cell]
        if not source_cell:
            return None
        try:
            from core.spatial.h3_utils import cell_to_latlng
            slat, slng = cell_to_latlng(source_cell)
            return min(
                cat_rows.values(),
                key=lambda r: (lambda la, ln: (la - slat) ** 2 + (ln - slng) ** 2)(*cell_to_latlng(r["h3_cell"])),
            )
        except Exception:  # noqa: BLE001 — malformed cell id -> no spatial match
            return None

    # Real per-cell population (GPW v4.11) where available — the source's cell
    # population replaces the hand-set exposure estimates.
    pop_by_cell: dict[str, float] = {}
    if not DEMO_MODE:
        try:
            from connectors.population import load_population
            pop_by_cell = load_population(city_id)
        except Exception:  # noqa: BLE001 — layer optional
            pop_by_cell = {}

    # Match sources to cells
    recs: list[EnforcementRec] = []

    for source in emission_sources:
        source_type = source.get("type", "other")
        attrs = source.get("attributes") or {}
        gpw = pop_by_cell.get(attrs.get("h3_cell") or "")
        pop_exposed = round(gpw) if gpw else (
            source.get("pop_exposed_estimate") or attrs.get("pop_exposed_estimate") or 5000
        )

        # Map source type to attribution category
        cat_map = {
            "construction": "construction_dust",
            "industry": "industrial",
            "waste_burn": "biomass_burning",
            "diesel_corridor": "traffic",
        }
        source_category = cat_map.get(source_type, "other")

        # Prefer the attribution at the source's own location (OSM rows carry h3_cell);
        # fall back to the city-wide dominant row for the category.
        best_attr = _nearest_attr(attrs.get("h3_cell"), source_category)
        if best_attr is None:
            best_share = 0.0
            for row in attribution_data:
                if row.get("source_category") == source_category and row.get("share", 0) > best_share:
                    best_attr = row
                    best_share = row["share"]
        if best_attr is None:
            best_attr = attribution_data[0] if attribution_data else {}
        best_share = best_attr.get("share", 0.1)

        # A source whose category contributes ~nothing at its location is not
        # an enforcement candidate — emitting "contributes 0%" destroys trust.
        if best_share < 0.02:
            continue

        h3_cell = best_attr.get("h3_cell", "")
        confidence = best_attr.get("confidence", 0.7)
        evidence = best_attr.get("evidence", {})

        # RAG citations
        citations_obj = retrieve_for_enforcement(source_category, city_id, top_k=3)
        citations = [c.as_citation() for c in citations_obj]

        # Priority + rubric
        priority = _compute_priority(best_share, pop_exposed, source_category, confidence)
        rubric = _compute_rubric(best_share, pop_exposed, source_category, confidence, len(citations))
        fc = forecast_index.get(h3_cell) or {}
        value = _compute_value(best_share, confidence, pop_exposed, source_category,
                               fc.get("pm25_low"), fc.get("p_exceed"))

        rationale = _generate_rationale(source, best_share, pop_exposed, source_category, citations)

        rec = EnforcementRec(
            city_id=city_id,
            h3_cell=h3_cell,
            source_id=source.get("id", 0),
            priority_score=priority,
            contribution=best_share,
            pop_exposed=pop_exposed,
            rationale=rationale,
            evidence={**evidence, "source_name": source.get("name", ""), "source_type": source_type, "value": value},
            rag_citations=citations,
            rubric_score=rubric,
            ts=datetime.now(timezone.utc).isoformat(),
        )
        recs.append(rec)

    # Sort by priority descending
    recs.sort(key=lambda r: r.priority_score, reverse=True)

    if write_to_db and not DEMO_MODE:
        from core.supa import client
        db = client()
        written = write_worklist(db, city_id, [r.to_dict() for r in recs])
        print(f"[enforcement] Wrote {written['inserted']} new recommendations, refreshed {written['refreshed']} "
              f"acted-upon ones (kept their id, status and audit trail), dropped {written['deleted']} stale proposed.")

    return recs


def write_worklist(db, city_id: str, rows: list[dict]) -> dict:
    """Replace the city's *proposed* worklist without touching what an officer has acted on.

    A daily run used to delete-and-reinsert every rec, which silently reset approvals,
    dispatches and closures overnight and orphaned the intervention tracker and audit log
    (rec ids changed). Now: recs an officer moved (approved / dispatched / dismissed / closed)
    keep their id and status — their evidence, priority and contribution are refreshed in
    place when the same source is still ranked; still-proposed recs are replaced by the new
    ranking. Returns counts for the log line.
    """
    keep = (db.table("enforcement_recs").select("id,h3_cell,source_id,status")
            .eq("city_id", city_id).neq("status", "proposed").limit(5000).execute().data or [])
    keep_by_key = {(r.get("h3_cell"), r.get("source_id")): r for r in keep}
    refreshed = 0
    to_insert = []
    for row in rows:
        k = (row.get("h3_cell"), row.get("source_id"))
        hit = keep_by_key.get(k)
        if hit:
            patch = {f: row[f] for f in ("priority_score", "contribution", "pop_exposed", "rationale",
                                          "evidence", "rag_citations", "rubric_score", "ts") if f in row}
            if patch:
                db.table("enforcement_recs").update(patch).eq("id", hit["id"]).execute()
            refreshed += 1
        else:
            to_insert.append(row)
    deleted = db.table("enforcement_recs").delete().eq("city_id", city_id).eq("status", "proposed").execute()
    if to_insert:
        db.table("enforcement_recs").insert(to_insert).execute()
    return {"inserted": len(to_insert), "refreshed": refreshed, "deleted": len(deleted.data or [])}


def build_dossier(rec_id: int, city_id: str = "delhi") -> dict:
    """Generate a full evidence dossier for a single enforcement recommendation.

    In DEMO_MODE, returns a canned dossier from fixtures or generates one inline.
    In live mode, queries enforcement_recs + RAG for a full cited packet.
    """
    from rag.retrieve import retrieve_for_enforcement
    from rag.multimodal import find_image_patch

    if DEMO_MODE:
        # Use fixture enforcement data to build a rich dossier
        enforcement_data = json.loads((FIXTURES / "enforcement.json").read_text()) if (FIXTURES / "enforcement.json").exists() else []
        rec = next((r for r in enforcement_data if r.get("id") == rec_id), None)
        if rec is None and enforcement_data:
            rec = enforcement_data[0]
            rec["id"] = rec_id

        if rec is None:
            rec = {
                "id": rec_id, "city_id": city_id,
                "rationale": "Construction site driving elevated PM2.5.",
                "contribution": 0.41, "pop_exposed": 18400,
            }

        # Enhance citations via RAG
        cat = "construction_dust"
        chunks = retrieve_for_enforcement(cat, city_id, top_k=5)
        full_citations = [c.as_citation() for c in chunks]
        demo_source = {
            "id": rec.get("source_id") or rec_id,
            "city_id": rec.get("city_id", city_id),
            "name": (rec.get("evidence") or {}).get("source_name") or "Demo CV-detected source",
            "type": (rec.get("evidence") or {}).get("source_type") or "construction",
            "source_origin": "cv_detected",
            "detection_confidence": 0.86,
            "attributes": {},
        }
        satellite_patch = find_image_patch(type("_NoDb", (), {"table": lambda *_: _NoRows()})(), rec, demo_source)

        fc_all = json.loads((FIXTURES / "forecast.json").read_text()) if (FIXTURES / "forecast.json").exists() else []
        fc_rows = [r for r in fc_all if r.get("h3_cell") == rec.get("h3_cell")] or fc_all[:3]
        projection = _impact_projection(rec, fc_rows)

        return {
            "rec_id": rec_id,
            "city_id": city_id,
            "rationale": rec.get("rationale", ""),
            "contribution_pct": round(rec.get("contribution", 0) * 100, 1),
            "pop_exposed": rec.get("pop_exposed", 0),
            "rubric_score": rec.get("rubric_score", {}),
            "status": rec.get("status", "proposed"),
            "citations": full_citations,
            "satellite_patch": satellite_patch,
            "impact_projection": projection,
            "suggested_notice_text": _build_notice_text(rec, full_citations, satellite_patch, demo_source, projection),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    # Live mode — query DB
    from core.supa import client
    db = client()
    rows = db.table("enforcement_recs").select("*").eq("id", rec_id).limit(1).execute().data
    if not rows:
        return {"rec_id": rec_id, "error": "not_found"}
    rec = rows[0]
    source = None
    if rec.get("source_id"):
        src_rows = (
            db.table("emission_sources")
            .select("id,city_id,geom,type,name,source_origin,detection_confidence,attributes")
            .eq("id", rec["source_id"])
            .limit(1)
            .execute()
            .data
        )
        source = src_rows[0] if src_rows else None
    _CATEGORY = {"construction": "construction_dust", "industry": "industrial",
                 "power": "industrial", "waste_burn": "biomass_burning"}
    source_category = _CATEGORY.get(str((source or {}).get("type") or ""), "construction_dust")
    # cite for the rec's actual city, not the caller's default
    chunks = retrieve_for_enforcement(source_category, rec["city_id"], top_k=5)
    full_citations = [c.as_citation() for c in chunks]
    # Live dossiers may only show REAL ingested image evidence — never a
    # generated placeholder dressed up as satellite imagery.
    satellite_patch = find_image_patch(db, rec, source, allow_placeholder=False)
    fc_rows = (
        db.table("forecasts").select("horizon_h,value,issued_at")
        .eq("city_id", rec["city_id"]).eq("h3_cell", rec["h3_cell"])
        .order("issued_at", desc=True).limit(30).execute().data
    ) or []
    projection = _impact_projection(rec, fc_rows)
    return {
        "rec_id": rec_id,
        "city_id": rec["city_id"],
        "rationale": rec["rationale"],
        "contribution_pct": round((rec.get("contribution") or 0) * 100, 1),
        "pop_exposed": rec.get("pop_exposed", 0),
        "rubric_score": rec.get("rubric_score", {}),
        "status": rec.get("status", "proposed"),
        "citations": full_citations,
        "satellite_patch": satellite_patch,
        "impact_projection": projection,
        "suggested_notice_text": _build_notice_text(rec, full_citations, satellite_patch, source, projection),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


class _NoRows:
    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return type("_Resp", (), {"data": []})()


_TYPE_LABEL = {
    "construction": "construction dust",
    "industry": "industrial emissions",
    "power": "industrial emissions",
    "waste_burn": "open waste burning",
    "brick_kiln": "brick-kiln emissions",
}


def _clean_provision_quote(excerpt: str, max_len: int = 220) -> str:
    """First quotable sentence of a kb excerpt — or nothing.

    kb chunks carry markdown separators (`====`), list markers and mid-section
    fragments; a garbled quote on an officer notice is worse than no quote, so
    only a clean, capitalised sentence of reasonable length gets through.
    """
    text = re.sub(r"[=_*#]{2,}", " ", excerpt)
    text = re.sub(r"\s+", " ", text).strip()
    for part in re.split(r"(?<=[.;])\s+", text):
        part = part.strip(" -••")
        if not (40 <= len(part) <= max_len and part[0].isupper()):
            continue
        if "|" in part:  # table debris
            continue
        letters = [c for c in part if c.isalpha()]
        if letters and sum(c.isupper() for c in letters) / len(letters) > 0.4:
            continue  # SHOUTING section header, not a provision
        return part.rstrip(".;") + "."
    return ""


def _impact_projection(rec: dict, forecast_rows: list[dict]) -> dict | None:
    """Modeled compliance impact for the notice chart: the cell's central
    forecast vs the same forecast with this source's share rolled back — the
    exact linear-rollback model /simulate uses, labeled as modeled."""
    try:
        contrib = float(rec.get("contribution") or 0)
    except (TypeError, ValueError):
        return None
    if contrib <= 0.02 or not forecast_rows:
        return None
    by_h: dict[int, float] = {}
    for r in forecast_rows:
        try:
            h = int(r.get("horizon_h") or 0)
            v = float(r.get("value"))
        except (TypeError, ValueError):
            continue
        if h in (24, 48, 72) and h not in by_h:
            by_h[h] = v
    if not by_h:
        return None
    return {
        "contribution_pct": round(contrib * 100, 1),
        "horizons": [
            {"h": h, "base": round(v, 1), "with_compliance": round(v * (1 - contrib), 1)}
            for h, v in sorted(by_h.items())
        ],
    }


def _projection_section(projection: dict | None) -> str:
    if not projection or not projection.get("horizons"):
        return ""
    parts = " · ".join(
        f"+{h['h']}h: {h['base']} → {h['with_compliance']}" for h in projection["horizons"]
    )
    return (
        "\n"
        "PROJECTED IMPACT OF COMPLIANCE:\n"
        f"Modeled linear rollback of this source's {projection['contribution_pct']}% share "
        "on the cell's central PM2.5 forecast (ug/m3) — a screening estimate, not a guarantee.\n"
        "[[IMPACT_CHART]]\n"
        f"{parts}\n"
    )


def _build_notice_text(
    rec: dict,
    citations: list[dict],
    satellite_patch: dict | None = None,
    source: dict | None = None,
    projection: dict | None = None,
) -> str:
    """Generate a draft enforcement notice.

    Structured as `TITLE`, `Label: value` metadata, then `HEADING:`-delimited
    sections — a format the PDF renderer (agents.notice_pdf) styles into a
    professional document, and which also reads cleanly as plain text. The
    `[[SATELLITE_IMAGE]]` marker is where the renderer embeds the actual
    Sentinel-2 patch (never the raw data URI — that is not notice content).
    """
    pct = round((rec.get("contribution", 0) * 100), 1)
    pop = rec.get("pop_exposed", 0)
    cell = rec.get("h3_cell", "n/a")
    city = str(rec.get("city_id", "")).title() or "the city"
    rationale = rec.get("rationale", "Pollution violation detected.")

    # Addressee — a notice is served on someone, not on the void.
    src_name = (source or {}).get("name") or ""
    src_type = str((source or {}).get("type") or "")
    type_label = _TYPE_LABEL.get(src_type, "")
    to_line = (
        f"The Occupier / Site Manager, {src_name}, {city} (grid cell {cell})"
        if src_name
        else f"The Occupier / Site Manager of the identified premises, {city} (grid cell {cell})"
    )
    subject = "Non-compliance with air pollution control norms" + (
        f" - {type_label}" if type_label else ""
    )

    # Citations: dedupe + de-SHOUT registry titles; quote the leading provision
    # so the notice cites substance, not just a document name.
    rules = _pretty_rules([c.get("rule", "") for c in citations], limit=3)
    reg_lines = [f"- {r}" for r in rules] or ["- As per applicable CPCB / GRAP dust-control norms."]
    quote = _clean_provision_quote(next((c.get("excerpt") or "" for c in citations if c.get("excerpt")), ""))
    if quote:
        reg_lines.append(f'Relevant provision (extract): "{quote}"')
    reg = "\n".join(reg_lines)

    visual = ""
    if satellite_patch:
        meta = satellite_patch.get("metadata") or {}
        conf = meta.get("detection_confidence")
        conf_str = f"{round(float(conf) * 100)}% detection confidence" if isinstance(conf, (int, float)) else ""
        title = satellite_patch.get("title", "satellite image patch")
        visual = (
            "\n"
            "SATELLITE EVIDENCE:\n"
            f"{title}" + (f" ({conf_str})" if conf_str else "") + "\n"
            "[[SATELLITE_IMAGE]]\n"
            "The image above forms part of the digital evidence dossier for this "
            "recommendation and is available in the VayuNetra console.\n"
        )

    ref = f"VN-ENF-{str(rec.get('id', '0000')).zfill(4)}"
    now = datetime.now(timezone.utc)
    date = now.strftime("%d %B %Y")
    ist = timezone(timedelta(hours=5, minutes=30))
    deadline = (now + timedelta(hours=24)).astimezone(ist).strftime("%d %B %Y, %H:%M IST")

    return (
        "ENFORCEMENT NOTICE\n"
        f"Reference: {ref}\n"
        f"Date: {date}\n"
        "Status: DRAFT - pending officer authorisation\n"
        "Prepared by: VayuNetra decision-support system\n"
        "\n"
        "TO:\n"
        f"{to_line}\n"
        "\n"
        "SUBJECT:\n"
        f"{subject}\n"
        "\n"
        "FINDINGS:\n"
        f"{rationale}\n"
        "\n"
        "EXPOSURE ASSESSMENT:\n"
        f"An estimated {pop:,} residents live within the affected ~1 sq. km grid cell "
        f"({cell}). VayuNetra source attribution assigns approximately {pct}% of the "
        "local PM2.5 concentration to this source (GPW v4 population x model attribution).\n"
        "\n"
        "APPLICABLE REGULATIONS:\n"
        f"{reg}\n"
        f"{visual}"
        f"{_projection_section(projection)}"
        "\n"
        "REQUIRED ACTION:\n"
        "The occupier shall undertake immediate corrective measures and demonstrate "
        f"compliance by {deadline} (24 hours from issue). Continued non-compliance "
        "may attract penalties and/or site sealing under the applicable provisions.\n"
        "\n"
        "REPRESENTATION:\n"
        "A written representation, with supporting documents, may be submitted to the "
        "authorising officer within the compliance window.\n"
        "\n"
        "AUTHORISATION:\n"
        f"{_authority_line(rec)}"
        "Name: ______________________________  Designation: ______________________________\n"
        "Signature: ______________________________  Date: ______________________________\n"
        "\n"
        "This is a system-generated draft for officer review before issuance.\n"
        "\n"
        "PROVENANCE:\n"
        f"{_provenance_line(rec)}"
    )


def _provenance_line(rec: dict) -> str:
    """Every number traceable: the notice is assembled from structured model output.

    Ranking, shares, exposure and forecast come from stored attribution/forecast rows
    (deterministic code); retrieval supplies the cited provisions; no figure in this
    document is generated by a language model.
    """
    parts = []
    if rec.get("attribution_method") or rec.get("method_version"):
        parts.append(f"attribution {rec.get('attribution_method') or rec.get('method_version')}")
    if rec.get("attribution_window"):
        parts.append(f"window {rec['attribution_window']}")
    if rec.get("model_confidence") is not None:
        try:
            parts.append(f"model confidence {float(rec['model_confidence']):.2f}")
        except (TypeError, ValueError):
            pass
    if rec.get("id") is not None:
        parts.append(f"recommendation #{rec['id']}")
    ref = "; ".join(parts) if parts else "stored attribution + forecast rows"
    return (
        "Every figure in this notice (share, residents exposed, forecast, priority) is read "
        f"from VayuNetra's structured model output ({ref}) by deterministic code; regulatory "
        "text is retrieved verbatim from the cited instruments; no number here is produced "
        "by a language model.\n"
    )


def _authority_line(rec: dict) -> str:
    """'Issuing authority' line from the city's regulatory config, if declared."""
    try:
        from core.cities import load_city

        authority = (load_city(rec.get("city_id", "")).get("regulatory") or {}).get("authority")
    except Exception:
        authority = None
    return f"Issuing authority: {authority}\n" if authority else ""


if __name__ == "__main__":
    print("[enforcement] Running demo enforcement scoring for Delhi...")
    recs = run_enforcement("delhi")
    for r in recs:
        d = r.to_dict()
        print(f"\n  Priority {d['priority_score']:.3f} | {d['rationale'][:80]}...")
        print(f"  Rubric: {d['rubric_score']}")
        print(f"  Citations: {[c['rule'] for c in d['rag_citations']]}")
