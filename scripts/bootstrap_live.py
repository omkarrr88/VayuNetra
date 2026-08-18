"""Populate the live Supabase project with the core Stage-1 tables.

This is the operational step that fills the remaining Stage-1 tables:
- ingest the RAG corpus into ``kb_chunks``
- run the live enforcement graph so ``enforcement_recs`` is written
- persist ``action_traces`` by exercising the orchestrator on live Supabase

Usage:
    python scripts/bootstrap_live.py
    python scripts/bootstrap_live.py --cities delhi bengaluru mumbai
    python scripts/bootstrap_live.py --skip-kb

The command expects real Supabase credentials in ``.env`` or the environment.
It intentionally forces ``DEMO_MODE=false`` so the live write paths are used.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parent.parent
CORPUS_DIR = REPO_ROOT / "rag" / "corpus"

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import core.env  # noqa: F401

os.environ["DEMO_MODE"] = "false"


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Missing required environment variable: {name}. Set it in .env or the current shell before running bootstrap_live.py."
        )
    return value


def _chunks(items: list[str], size: int) -> Iterable[list[str]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


def _service_db():
    from core.supa import client

    return client()


def _delete_existing_kb_rows(doc_ids: list[str]) -> int:
    if not doc_ids:
        return 0

    db = _service_db()
    deleted = 0
    for batch in _chunks(doc_ids, 50):
        db.table("kb_chunks").delete().in_("doc_id", batch).execute()
        deleted += len(batch)
    return deleted


def _best_focus_cell(city_id: str) -> str:
    db = _service_db()
    try:
        rows = (
            db.table("attribution")
            .select("h3_cell,share")
            .eq("city_id", city_id)
            .order("share", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if rows and rows[0].get("h3_cell"):
            return rows[0]["h3_cell"]
    except Exception as exc:
        print(f"[bootstrap] {city_id}: attribution lookup failed ({exc}); falling back to demo hotspot")

    fixture_path = REPO_ROOT / "demo" / "fixtures" / "attribution.json"
    if fixture_path.exists():
        try:
            data = __import__("json").loads(fixture_path.read_text())
            for row in data:
                if row.get("city_id") == city_id and row.get("h3_cell"):
                    return row["h3_cell"]
            for row in data:
                if row.get("h3_cell"):
                    return row["h3_cell"]
        except Exception:
            pass

    return "883da18eabfffff"


def bootstrap_kb() -> None:
    from rag.ingest import ingest

    doc_ids = sorted(path.stem for path in CORPUS_DIR.glob("*.txt"))
    deleted = _delete_existing_kb_rows(doc_ids)
    if deleted:
        print(f"[bootstrap] cleared {deleted} existing kb_chunks rows for the corpus docs")
    ingest(dry_run=False)


def bootstrap_live_graph(cities: list[str], query: str) -> None:
    from agents.graph import run_query

    for city_id in cities:
        focus_cell = _best_focus_cell(city_id)
        state = run_query(city_id=city_id, query=query, focus_cells=[focus_cell])
        enforcement = state.get("enforcement") or []
        trace = state.get("trace") or []
        print(
            f"[bootstrap] {city_id}: enforcement_recs={len(enforcement)} "
            f"trace_nodes={len(trace)} focus_cell={focus_cell}"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap live Supabase tables for VayuNetra")
    parser.add_argument(
        "--cities",
        nargs="+",
        default=["delhi", "bengaluru", "mumbai"],
        help="City IDs to run through the live orchestrator",
    )
    parser.add_argument(
        "--query",
        default="bootstrap live enforcement run",
        help="Query string sent through the orchestrator",
    )
    parser.add_argument(
        "--skip-kb",
        action="store_true",
        help="Skip RAG corpus ingestion",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    print("[bootstrap] DEMO_MODE forced to false")

    _require_env("SUPABASE_URL")
    _require_env("SUPABASE_SERVICE_ROLE_KEY")
    _require_env("SUPABASE_ANON_KEY")

    if not args.skip_kb:
        bootstrap_kb()

    bootstrap_live_graph(args.cities, args.query)
    print("[bootstrap] live bootstrap complete")


if __name__ == "__main__":
    main()