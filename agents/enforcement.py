"""Agent 3 — Enforcement Intelligence & Prioritisation Agent.

Reads attribution + forecast data and the emission source registry, computes an
exposure-weighted priority score for each candidate source, retrieves regulatory
citations via the RAG subsystem, and generates a ranked enforcement worklist with
cited evidence dossiers.

Priority score formula (PRD §12.4):
    priority = source_contribution × population_exposed_norm × actionability × confidence

Each recommendation is written to the ``enforcement_recs`` table (or DEMO fixture).
Owner: Abhinav.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import core.env  # noqa: F401

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
    """Return mock emission sources for DEMO_MODE (substitutes Sejal's registry)."""
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

        rationale = _generate_rationale(source, best_share, pop_exposed, source_category, citations)

        rec = EnforcementRec(
            city_id=city_id,
            h3_cell=h3_cell,
            source_id=source.get("id", 0),
            priority_score=priority,
            contribution=best_share,
            pop_exposed=pop_exposed,
            rationale=rationale,
            evidence={**evidence, "source_name": source.get("name", ""), "source_type": source_type},
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
        rows = [r.to_dict() for r in recs]
        # idempotent: replace this city's worklist instead of appending duplicates
        db.table("enforcement_recs").delete().eq("city_id", city_id).execute()
        if rows:
            db.table("enforcement_recs").insert(rows).execute()
        print(f"[enforcement] Wrote {len(rows)} recommendations to Supabase.")

    return recs


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
        "This is a system-generated draft for officer review before issuance."
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
