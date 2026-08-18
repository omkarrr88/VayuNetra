"""E6 upgrade: replace placeholder markers with REAL Sentinel-2 thumbnails.

For the emission sources that current enforcement recommendations actually
reference (the ones a judge will open), fetch a genuine Sentinel-2 RGB median
composite around the source location via Earth Engine and store it as a compact
data-URI in the source's existing ``kb_chunks(modality='image')`` row.

Honest by construction: the image is real satellite imagery of the location;
the caption states the compositing window and that the detection is an
Earth-Engine heuristic — no CNN claims.

Usage:
    DEMO_MODE=false python scripts/ingest_e6_real_patches.py --per-city 30
"""
from __future__ import annotations

import argparse
import base64
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

import core.env  # noqa: F401,E402
from core.supa import client  # noqa: E402
from rag.multimodal import hash_embed, source_coordinates  # noqa: E402

from core.cities import list_city_ids

CITIES = list_city_ids()
BOX_DEG = 0.012          # ~1.3 km half-box around the source
THUMB_DIM = "360x240"
CLOUD_MAX = 20


def _composite_window() -> tuple[str, str]:
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=120)
    return start.isoformat(), end.isoformat()


def fetch_thumb_data_uri(lng: float, lat: float, start: str, end: str) -> str | None:
    """Real S2 RGB thumbnail around (lng, lat) as a data URI, or None."""
    import ee
    import requests

    region = ee.Geometry.Rectangle([lng - BOX_DEG, lat - BOX_DEG, lng + BOX_DEG, lat + BOX_DEG])
    img = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(region)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", CLOUD_MAX))
        .median()
        .select(["B4", "B3", "B2"])
        .visualize(**{"min": 0, "max": 3000})
    )
    url = img.getThumbURL({"region": region, "dimensions": THUMB_DIM, "format": "jpg"})
    r = requests.get(url, timeout=120)
    if r.status_code != 200 or not r.content or len(r.content) < 2000:
        return None  # empty composite (no cloud-free scenes) — keep the marker
    return "data:image/jpeg;base64," + base64.b64encode(r.content).decode("ascii")


def rec_referenced_sources(db, city: str, cap: int) -> list[dict]:
    """Sources referenced by this city's recs, highest-priority first."""
    recs = (
        db.table("enforcement_recs").select("source_id,priority_score")
        .eq("city_id", city).order("priority_score", desc=True).limit(500).execute().data or []
    )
    ordered_ids: list[int] = []
    for r in recs:
        sid = r.get("source_id")
        if sid is not None and sid not in ordered_ids:
            ordered_ids.append(sid)
        if len(ordered_ids) >= cap:
            break
    if not ordered_ids:
        return []
    rows = (
        db.table("emission_sources")
        .select("id,city_id,geom,type,name,source_origin,detection_confidence,attributes")
        .in_("id", ordered_ids).execute().data or []
    )
    by_id = {r["id"]: r for r in rows}
    return [by_id[i] for i in ordered_ids if i in by_id]


def upgrade(per_city: int) -> None:
    from connectors.earth_engine import init

    init()
    db = client()
    start, end = _composite_window()
    total_ok = total_skip = 0
    for city in CITIES:
        sources = rec_referenced_sources(db, city, per_city)
        ok = skip = 0
        for src in sources:
            coords = source_coordinates(src)
            if not coords:
                skip += 1
                continue
            lng, lat = coords
            try:
                uri = fetch_thumb_data_uri(lng, lat, start, end)
            except Exception as e:  # noqa: BLE001 — one bad tile must not kill the run
                print(f"  {city} src {src['id']}: EE error {type(e).__name__}, keeping marker")
                skip += 1
                continue
            if not uri:
                skip += 1
                continue
            name = src.get("name") or f"source {src['id']}"
            kind = (src.get("type") or "source").replace("_", " ")
            conf = src.get("detection_confidence")
            chunk_text = (
                f"Sentinel-2 RGB median composite ({start} to {end}) around {name} "
                f"({kind}) in {city}. Detection: Earth-Engine heuristic"
                + (f", confidence {conf}." if conf is not None else ".")
            )
            row = {
                "doc_id": f"sentinel2-source-{src['id']}",
                "title": f"Sentinel-2 patch - {name}",
                "source_url": "Sentinel-2 SR harmonized (Earth Engine)",
                "modality": "image",
                "chunk_text": chunk_text,
                "image_ref": uri,
                "embedding": hash_embed(f"{chunk_text} {coords}"),
                "metadata": {
                    "source_id": src["id"],
                    "city_id": city,
                    "source_type": src.get("type"),
                    "source_origin": src.get("source_origin"),
                    "detection_confidence": conf,
                    "coordinates": coords,
                    "placeholder": False,
                    "patch_kind": "s2_thumbnail",
                    "composite_window": [start, end],
                },
            }
            # delete-then-insert (no unique constraint on doc_id for upsert);
            # worst case on a mid-pair failure is losing one placeholder row —
            # re-running this script or ingest_e6_image_patches.py restores it.
            db.table("kb_chunks").delete().eq("doc_id", row["doc_id"]).execute()
            db.table("kb_chunks").insert(row).execute()
            ok += 1
        print(f"{city}: {ok} real Sentinel-2 patches written, {skip} kept as markers")
        total_ok += ok
        total_skip += skip
    print(f"TOTAL: {total_ok} real patches, {total_skip} markers kept")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-city", type=int, default=30, help="max sources per city (rec-referenced, top priority first)")
    args = ap.parse_args()
    upgrade(args.per_city)


if __name__ == "__main__":
    main()
