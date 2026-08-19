"""Ward lookup for a cell — the server-side twin of web/src/placeName.ts.

Reads the same shipped polygons (web/public/wards/<city>.geojson, Datameet / OSM) so the
officer brief, notices and Telegram messages can name a place ("Punjabi Bagh") instead of an
H3 id. Pure Python ray-casting; files are cached per process.
"""
from __future__ import annotations

import json
import math
from functools import lru_cache
import re
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


# Mumbai's file ships BMC ward LETTERS and nothing else, so a cell there resolved to "near T",
# which is not a place any resident would recognise. Chennai's names every ward "Ward N" with no
# locality at all. Both mappings are the ones already vetted in web/src/placeName.ts — this module
# is that file's server-side twin, and the two drifted: the browser has been naming Mumbai wards
# properly while every advisory, IVR call and Telegram message said "near T".
BMC_WARD_AREAS = {
    "A": "Colaba & Fort", "B": "Dongri & Sandhurst Road", "C": "Kalbadevi & Marine Lines",
    "D": "Malabar Hill & Grant Road", "E": "Byculla",
    "F/S": "Parel & Sewri", "F/N": "Matunga & Sion",
    "G/S": "Worli & Prabhadevi", "G/N": "Dadar & Mahim",
    "H/E": "Bandra East & Khar", "H/W": "Bandra West & Santacruz West",
    "K/E": "Andheri East & Vile Parle East", "K/W": "Andheri West & Juhu",
    "P/S": "Goregaon", "P/N": "Malad",
    "R/S": "Kandivali", "R/C": "Borivali", "R/N": "Dahisar",
    "L": "Kurla", "M/E": "Govandi & Mankhurd", "M/W": "Chembur",
    "N": "Ghatkopar", "S": "Bhandup & Vikhroli", "T": "Mulund",
}

# The GCC's fifteen zones are named places, each covering a documented contiguous block of ward
# numbers, so a ward number resolves to the zone it sits in.
CHENNAI_ZONES = [
    (1, 14, "Thiruvottiyur"), (15, 21, "Manali"), (22, 33, "Madhavaram"), (34, 48, "Tondiarpet"),
    (49, 63, "Royapuram"), (64, 78, "Thiru-Vi-Ka Nagar"), (79, 93, "Ambattur"), (94, 108, "Anna Nagar"),
    (109, 126, "Teynampet"), (127, 142, "Kodambakkam"), (143, 155, "Valasaravakkam"), (156, 167, "Alandur"),
    (168, 182, "Adyar"), (183, 191, "Perungudi"), (192, 200, "Sholinganallur"),
]


def _title(n: str) -> str:
    return re.sub(r"(^|[\s.\-/(])([a-z])", lambda m: m.group(1) + m.group(2).upper(), n.lower())


def _label(name: str, city_id: str | None = None) -> str:
    """A ward's display name — the LOCALITY first, in every city.

    The boundary files disagree about where the name lives. Eight of the ten carry a real locality
    buried behind a ward number ("Ward 91 Khairatabad", "48 RAMOL HATHIJAN") or trailing
    boilerplate ("Kempegowda Ward"); digging it out is cleaning, not invention. Mumbai and Chennai
    carry no locality at all and use the mappings above. Kolkata's file carries nothing but a
    number, and a number is what it keeps — a confident wrong name on something a citizen acts on
    is worse than an honest ward id.
    """
    n = name.strip()

    if city_id == "mumbai":
        area = BMC_WARD_AREAS.get(n.upper())
        if area:
            return f"{area} (Ward {n})"

    if city_id == "chennai":
        m = re.search(r"(\d+)", n)
        if m:
            num = int(m.group(1))
            for lo, hi, zone in CHENNAI_ZONES:
                if lo <= num <= hi:
                    return f"{zone} (Ward {num})"

    m = re.match(r"^Ward\s+(\d+)\s+(.+)$", n, re.I)
    if m:
        return f"{_title(m.group(2))} (Ward {m.group(1)})"

    m = re.match(r"^(\d+)\s+(.+)$", n)
    if m:
        return f"{_title(m.group(2))} (Ward {int(m.group(1))})"

    m = re.match(r"^(.+?)\s+Ward$", n, re.I)
    if m:
        return _title(m.group(1))

    if re.match(r"^Ward\s+\d+$", n, re.I):
        return n
    if len(n) <= 4:
        return f"Ward {n}"

    return _title(n) if n == n.upper() else n


def place_for_latlng(city_id: str, lat: float, lng: float) -> dict | None:
    """{'label': str, 'approx': bool} or None. Exact polygon hit first, else nearest ward
    centroid within ~15 km labelled 'near …' (bboxes are metro regions; wards cover the core)."""
    wards = _load(city_id)
    if not wards:
        return None
    for name, rings, _ in wards:
        if any(_inside(lng, lat, r) for r in rings):
            return {"label": _label(name, city_id), "approx": False}
    best = None
    for name, _, (cx, cy) in wards:
        dx = (cx - lng) * math.cos(math.radians(lat))
        dy = cy - lat
        d = math.hypot(dx, dy) * 111.0
        if best is None or d < best[1]:
            best = (name, d)
    if best and best[1] <= 15:
        return {"label": f"near {_label(best[0], city_id)}", "approx": True}
    return None


def place_for_cell(city_id: str, h3_cell: str) -> dict | None:
    try:
        from core.spatial.h3_utils import cell_to_latlng

        lat, lng = cell_to_latlng(h3_cell)
    except Exception:  # noqa: BLE001 — malformed id
        return None
    return place_for_latlng(city_id, lat, lng)
