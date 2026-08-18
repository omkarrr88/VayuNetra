# rag/ — Retrieval-Augmented Generation

Text RAG + E6 multimodal image patches (Stage 2).
Spec: ARCHITECTURE.md §10, PRD §12.14.

- **Corpus:** NCAP, GRAP action matrices, CPCB/SPCB regulations, CPCB/WHO AQI health breakpoints, SOPs.
- **Pipeline:** PDF/HTML → clean text → semantic chunk → embed (**local `bge-small`**, 384-dim) → `kb_chunks` (pgvector).
- **Retrieval:** cosine top-k + metadata filters → LLM synthesises **cited** answers.
- **Used by:** A3 (enforcement legal basis) + A4 (health thresholds).
- **E6 (Stage 2):** CLIP-embed Sentinel-2 patches into the same store (`modality='image'`).

> ⚠️ Embedding dim must match the `kb_chunks.embedding vector(N)` column. Default 384 (bge-small).
> Switching to Gemini embeddings (768) means a migration + re-embed.
