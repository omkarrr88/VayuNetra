"""Tests for rag.retrieve — RAG subsystem."""
from __future__ import annotations

import os
import pytest

os.environ["DEMO_MODE"] = "true"


def test_retrieve_returns_chunks():
    """retrieve() should return CitedChunk objects."""
    from rag.retrieve import retrieve
    chunks = retrieve("construction dust penalty regulations CPCB", top_k=3)
    assert len(chunks) > 0, "Should return at least one chunk"


def test_retrieve_chunk_structure():
    """CitedChunk objects should have required attributes."""
    from rag.retrieve import retrieve
    chunks = retrieve("GRAP enforcement stage 1 construction site", top_k=3)
    for chunk in chunks:
        assert hasattr(chunk, "doc_id")
        assert hasattr(chunk, "title")
        assert hasattr(chunk, "chunk_text")
        assert hasattr(chunk, "similarity")
        assert 0.0 <= chunk.similarity <= 2.0  # cosine can be up to 1, we boost by keyword


def test_retrieve_as_citation():
    """as_citation() should return a dict with 'rule' key."""
    from rag.retrieve import retrieve
    chunks = retrieve("industrial emission norms SO2 enforcement", top_k=2)
    for chunk in chunks:
        cit = chunk.as_citation()
        assert isinstance(cit, dict)
        assert "rule" in cit
        assert "excerpt" in cit


def test_retrieve_for_enforcement_construction():
    """retrieve_for_enforcement('construction_dust') should return relevant chunks."""
    from rag.retrieve import retrieve_for_enforcement
    chunks = retrieve_for_enforcement("construction_dust", top_k=3)
    assert len(chunks) > 0
    # At least one should mention construction or CPCB
    texts = " ".join(c.chunk_text.lower() + c.title.lower() for c in chunks)
    assert any(kw in texts for kw in ["construction", "dust", "cpcb", "grap"])


def test_retrieve_for_enforcement_industrial():
    """retrieve_for_enforcement('industrial') should return relevant chunks."""
    from rag.retrieve import retrieve_for_enforcement
    chunks = retrieve_for_enforcement("industrial", top_k=3)
    assert len(chunks) > 0


def test_retrieve_top_k_respected():
    """retrieve() should not return more chunks than top_k."""
    from rag.retrieve import retrieve
    chunks = retrieve("open burning ban penalty", top_k=2)
    assert len(chunks) <= 2


def test_retrieve_empty_result_graceful():
    """retrieve() with a very specific filter should not raise errors."""
    from rag.retrieve import retrieve
    # Very unlikely to match the source filter — should return empty gracefully
    chunks = retrieve("construction dust", top_k=3, source_filter="NONEXISTENT_DOC_ID_XYZ")
    assert isinstance(chunks, list)
