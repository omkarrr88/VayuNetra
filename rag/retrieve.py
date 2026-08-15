"""RAG subsystem — cited retrieval.

Given a query string, retrieves the top-k most relevant chunks from the
``kb_chunks`` table (or from the demo fixture in DEMO_MODE) via cosine
similarity on pgvector embeddings.

Returns a list of CitedChunk objects ready for use in agent dossiers.
"""
from __future__ import annotations

import json
import os
import hashlib
import ast
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Optional

import core.env  # noqa: F401

DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "384"))
TOP_K_DEFAULT = 5

DEMO_FIXTURE = Path(__file__).resolve().parent.parent / "demo" / "fixtures" / "kb_chunks.json"


@dataclass
class CitedChunk:
    """A retrieved knowledge chunk with provenance for citations in dossiers."""
    chunk_id: int
    doc_id: str
    title: str
    source_url: str
    chunk_text: str
    similarity: float
    metadata: dict = field(default_factory=dict)

    def as_citation(self) -> dict:
        """Compact citation dict for enforcement dossiers and advisories."""
        return {
            "rule": self.title,
            "url": self.source_url,
            "excerpt": self.chunk_text[:300] + ("..." if len(self.chunk_text) > 300 else ""),
            "similarity": round(self.similarity, 4),
        }


# ---------------------------------------------------------------------------
# Embedding helper (same model as ingest)
# ---------------------------------------------------------------------------

_embed_model = None


def _get_embed_model():
    global _embed_model
    if _embed_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embed_model = SentenceTransformer("BAAI/bge-small-en-v1.5")
        except ImportError:
            _embed_model = False
    return _embed_model


def _hash_embed(text: str, dim: int = EMBEDDING_DIM) -> list[float]:
    """Small deterministic embedding fallback for CI and lean deployments."""
    import math

    vec = [0.0] * dim
    for token in text.lower().split():
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        idx = int.from_bytes(digest[:4], "little") % dim
        sign = 1.0 if digest[4] & 1 else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def _embed_query(query: str) -> list[float]:
    model = _get_embed_model()
    if model is False:
        return _hash_embed(query)
    vec = model.encode(query, normalize_embeddings=True)
    return vec.tolist()


# ---------------------------------------------------------------------------
# Demo retrieval — keyword match over cached fixture JSON
# ---------------------------------------------------------------------------

_demo_chunks: Optional[list[dict]] = None


def _load_demo_chunks() -> list[dict]:
    global _demo_chunks
    if _demo_chunks is None:
        if DEMO_FIXTURE.exists():
            _demo_chunks = json.loads(DEMO_FIXTURE.read_text(encoding="utf-8"))
        else:
            # Fallback inline demo stubs
            _demo_chunks = [
                {
                    "id": 1,
                    "doc_id": "CPCB-DUST-NORMS-2016",
                    "title": "CPCB Dust Control Norms for Construction Sites",
                    "source_url": "Central Pollution Control Board",
                    "chunk_text": (
                        "All construction projects with a built-up area ≥5,000 sq.m must obtain "
                        "prior Environmental Clearance (EC) or register with the State SPCB. "
                        "Anti-smog guns mandatory for sites ≥20,000 sq.m. "
                        "Water sprinkling at least twice daily at all active excavation areas. "
                        "Penalty for non-compliance: ₹5,000 to ₹1,00,000 per instance."
                    ),
                    "similarity": 0.92,
                    "metadata": {"chunk_index": 0},
                },
                {
                    "id": 2,
                    "doc_id": "GRAP-2023-CONSOLIDATED",
                    "title": "Graded Response Action Plan (GRAP)",
                    "source_url": "Commission for Air Quality Management (CAQM)",
                    "chunk_text": (
                        "STAGE 1 — AQI 201–300: All construction sites must register on the CAQM portal. "
                        "Demolition activities banned during Stage 2 (AQI 301–400). "
                        "Violation penalty: ₹5,000 to ₹1,00,000 per instance. "
                        "Enhanced enforcement at known pollution hotspots required."
                    ),
                    "similarity": 0.88,
                    "metadata": {"chunk_index": 1},
                },
                {
                    "id": 3,
                    "doc_id": "NCAP-2019-GUIDELINES",
                    "title": "National Clean Air Programme (NCAP) Guidelines",
                    "source_url": "Ministry of Environment, Forest and Climate Change (MoEFCC)",
                    "chunk_text": (
                        "Priority 1: Identify top 5 source categories contributing >60% of PM2.5 locally. "
                        "Concentrate 80% of enforcement resources on those source categories. "
                        "Document inspections with GPS-tagged photographs and meter readings. "
                        "Deploy dedicated enforcement teams to each hotspot for 30-day intensive campaigns."
                    ),
                    "similarity": 0.85,
                    "metadata": {"chunk_index": 2},
                },
                {
                    "id": 4,
                    "doc_id": "CPCB-AQI-BREAKPOINTS-2024",
                    "title": "CPCB AQI Health Breakpoints and SOPs",
                    "source_url": "Central Pollution Control Board",
                    "chunk_text": (
                        "AQI 201–300 (Poor): Breathing discomfort to most people on prolonged exposure. "
                        "AQI 301–400 (Very Poor): Respiratory illness on prolonged exposure; serious impact on people with heart/lung disease. "
                        "Level 1 trigger (AQI >200 for 3 consecutive days): Enhanced enforcement at known pollution hotspots."
                    ),
                    "similarity": 0.82,
                    "metadata": {"chunk_index": 3},
                },
                {
                    "id": 5,
                    "doc_id": "GRAP-2023-CONSOLIDATED",
                    "title": "GRAP — Enforcement Actions and Penalties",
                    "source_url": "Commission for Air Quality Management (CAQM)",
                    "chunk_text": (
                        "Inspection Checklist for Field Inspectors: "
                        "Valid registration on CAQM portal visible at site. "
                        "Anti-smog gun/water sprinkler operational and in use. "
                        "Green net coverage of all exposed structures (≥70% coverage). "
                        "No open burning of construction waste on site. "
                        "Issue on-the-spot notice with fine of ₹5,000 for open burning."
                    ),
                    "similarity": 0.79,
                    "metadata": {"chunk_index": 4},
                },
            ]
    return _demo_chunks


def _demo_retrieve(query: str, top_k: int, source_filter: Optional[str]) -> list[CitedChunk]:
    """Simple keyword-based retrieval for DEMO_MODE (no embedding needed)."""
    chunks = _load_demo_chunks()
    query_lower = query.lower()
    query_words = set(query_lower.split())

    scored = []
    for c in chunks:
        text = (c.get("chunk_text", "") + " " + c.get("title", "")).lower()
        text_words = set(text.split())
        overlap = len(query_words & text_words)
        base_sim = c.get("similarity", 0.8)
        score = base_sim * (1 + 0.05 * overlap)

        if source_filter and source_filter.lower() not in c.get("doc_id", "").lower():
            continue

        scored.append((score, c))

    scored.sort(key=lambda x: x[0], reverse=True)
    results = []
    for sim, c in scored[:top_k]:
        results.append(
            CitedChunk(
                chunk_id=c.get("id", 0),
                doc_id=c.get("doc_id", ""),
                title=c.get("title", ""),
                source_url=c.get("source_url", ""),
                chunk_text=c.get("chunk_text", ""),
                similarity=round(sim, 4),
                metadata=c.get("metadata", {}),
            )
        )
    return results


# ---------------------------------------------------------------------------
# Live retrieval via pgvector
# ---------------------------------------------------------------------------

def _live_retrieve(query: str, top_k: int, source_filter: Optional[str]) -> list[CitedChunk]:
    """Embed query → cosine top-k search in Supabase kb_chunks."""
    vec = _embed_query(query)

    from core.supa import client
    db = client()

    # Use Supabase rpc for vector similarity (requires a stored procedure)
    # Fallback: fetch all and sort in Python (acceptable for small corpora <5000 chunks)
    q = db.table("kb_chunks").select("id,doc_id,title,source_url,chunk_text,metadata,embedding")
    if source_filter:
        q = q.ilike("doc_id", f"%{source_filter}%")
    rows = q.execute().data
    if not rows:
        return _demo_retrieve(query, top_k, source_filter)

    # Cosine similarity (vectors are already normalized)
    import numpy as np
    qvec = np.array(vec)
    scored = []
    for row in rows:
        emb = row.get("embedding")
        if not emb:
            continue
        if isinstance(emb, str):
            try:
                emb = json.loads(emb)
            except json.JSONDecodeError:
                try:
                    emb = ast.literal_eval(emb)
                except (ValueError, SyntaxError):
                    continue
        rvec = np.array([float(x) for x in emb])
        if rvec.shape != qvec.shape:
            continue
        sim = float(np.dot(qvec, rvec))
        scored.append((sim, row))

    scored.sort(key=lambda x: x[0], reverse=True)
    results = []
    for sim, row in scored[:top_k]:
        results.append(
            CitedChunk(
                chunk_id=row.get("id", 0),
                doc_id=row.get("doc_id", ""),
                title=row.get("title", ""),
                source_url=row.get("source_url", ""),
                chunk_text=row.get("chunk_text", ""),
                similarity=round(sim, 4),
                metadata=row.get("metadata") or {},
            )
        )
    return results


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def retrieve(
    query: str,
    top_k: int = TOP_K_DEFAULT,
    source_filter: Optional[str] = None,
) -> list[CitedChunk]:
    """Retrieve the top-k most relevant knowledge chunks for a query.

    Args:
        query: Natural-language query (e.g. "construction dust penalty regulations").
        top_k: Number of results to return.
        source_filter: Optional doc_id substring to filter by source document.

    Returns:
        List of CitedChunk objects, sorted by descending similarity.
    """
    if DEMO_MODE:
        return _demo_retrieve(query, top_k, source_filter)
    return _live_retrieve(query, top_k, source_filter)


@lru_cache(maxsize=64)
def _retrieve_for_enforcement_cached(query: str, top_k: int) -> tuple[CitedChunk, ...]:
    """One live retrieval per distinct (query, top_k) per process.

    run_enforcement calls the wrapper once per emission source, but there are
    only ~6 distinct category queries over a static regulatory corpus — without
    this cache a spiking city paid a full embed + kb_chunks scan per source
    (measured: 94 s of a 95 s pipeline run). Tuple return so callers can't
    mutate the shared result.
    """
    return tuple(retrieve(query, top_k=top_k))


def retrieve_for_enforcement(source_category: str, city_id: str = "delhi", top_k: int = 3) -> tuple[CitedChunk, ...]:
    """Convenience wrapper — builds a focused enforcement query from source category."""
    category_queries = {
        "construction_dust": "construction site dust suppression norms penalty enforcement CPCB GRAP",
        "industrial": "industrial emission stack norms consent-to-operate SPCB enforcement penalty",
        "biomass_burning": "open burning biomass agricultural waste ban penalty enforcement GRAP NCAP",
        "traffic": "vehicular emission PUC diesel smoke enforcement penalty",
        "transported": "regional transported pollution enforcement coordination",
        "other": "air quality enforcement NCAP CPCB penalty",
    }
    query = category_queries.get(source_category, f"{source_category} air quality enforcement regulation CPCB")
    return _retrieve_for_enforcement_cached(query, top_k)


if __name__ == "__main__":
    # Quick smoke test
    print("--- Retrieving for construction_dust ---")
    chunks = retrieve_for_enforcement("construction_dust")
    for c in chunks:
        print(f"  [{c.similarity:.3f}] {c.title[:60]}:  {c.chunk_text[:100]}...")
