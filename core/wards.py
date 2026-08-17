"""Ward lookup for a cell — the server-side twin of web/src/placeName.ts.

Reads the same shipped polygons (web/public/wards/<city>.geojson, Datameet / OSM) so the
officer brief, notices and Telegram messages can name a place ("Punjabi Bagh") instead of an
H3 id. Pure Python ray-casting; files are cached per process.
"""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

WARDS_DIR = Path(__file__).resolve().parent.parent / "web" / "public" / "wards"


@lru_cache(maxsize=32)
def _load(city_id: str) -> list[tuple[str, list[list[tuple[float, float]]], tuple[float, float]]]:
    """[(name, rings, centroid)] for a city, or [] when no file ships."""
    p = WARDS_DIR / f"{city_id}.geojson"
    if not p.exists():
        return []
    try:
        gj = json.loads(p.read_text())
    except (OSError, ValueError):
        return []
    out = []
    for f in gj.get("features", []):
        props = f.get("properties") or {}
        name = str(props.get("name") or props.get("ward_id") or "").strip()
        geom = f.get("geometry") or {}
        polys = []
        if geom.get("type") == "Polygon":
            polys = [geom["coordinates"]]
        elif geom.get("type") == "MultiPolygon":
            polys = geom["coordinates"]
        rings = [[(float(x), float(y)) for x, y, *_ in poly[0]] for poly in polys if poly]
        if not name or not rings:
            continue
        pts = [pt for r in rings for pt in r]
        cx = sum(x for x, _ in pts) / len(pts)
        cy = sum(y for _, y in pts) / len(pts)
        out.append((name, rings, (cx, cy)))
    return out


def _inside(x: float, y: float, ring: list[tuple[float, float]]) -> bool:
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def _label(name: str) -> str:
    # "48 RAMOL HATHIJAN" -> "Ramol Hathijan"; "Ward 76 HAWA MAHAL" -> "Hawa Mahal"; keep short ids
    words = [w for w in name.replace("_", " ").split() if w]
    if len(words) > 1 and words[0].isdigit():
        words = words[1:]
    if len(words) > 2 and words[0].lower() == "ward" and words[1].isdigit():
        words = words[2:]
    all_caps = all(w.isupper() for w in words if w.isalpha())
    return " ".join(w if (w.isupper() and len(w) <= 3 and not all_caps) else w.capitalize() for w in words)


def place_for_latlng(city_id: str, lat: float, lng: float) -> dict | None:
    """{'label': str, 'approx': bool} or None. Exact polygon hit first, else nearest ward
    centroid within ~15 km labelled 'near …' (bboxes are metro regions; wards cover the core)."""
    wards = _load(city_id)
    if not wards:
        return None
    for name, rings, _ in wards:
        if any(_inside(lng, lat, r) for r in rings):
            return {"label": _label(name), "approx": False}
    best = None
    for name, _, (cx, cy) in wards:
        dx = (cx - lng) * math.cos(math.radians(lat))
        dy = cy - lat
        d = math.hypot(dx, dy) * 111.0
        if best is None or d < best[1]:
            best = (name, d)
    if best and best[1] <= 15:
        return {"label": f"near {_label(best[0])}", "approx": True}
    return None


def place_for_cell(city_id: str, h3_cell: str) -> dict | None:
    try:
        from core.spatial.h3_utils import cell_to_latlng

        lat, lng = cell_to_latlng(h3_cell)
    except Exception:  # noqa: BLE001 — malformed id
        return None
    return place_for_latlng(city_id, lat, lng)
