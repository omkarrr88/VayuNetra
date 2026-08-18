"""Plume footprint polygons for the map overlay.

Turns the Gaussian plume physics (plume.py, Briggs urban) into per-source
teardrop polygons oriented by the real wind vector. Intensity is RELATIVE
(0-1, normalized within the returned set) — we know source category and
detection confidence, not absolute emission rates, and we say so honestly.

Pure functions over plain dicts — no DB, no HTTP — so the whole geometry
pipeline is unit-testable.
"""
from __future__ import annotations

import math

import numpy as np

from ml.dispersion.plume import pasquill_stability, sigma_y, sigma_z

# Relative emission weight by source category (registry/OSM types in emission_sources).
# Industry/power stacks dominate; construction is diffuse dust at ground level.
TYPE_WEIGHT = {
    "industry": 1.0,
    "power": 1.0,
    "brick_kiln": 0.9,
    "waste_burn": 0.85,
    "construction": 0.55,
}
DEFAULT_WEIGHT = 0.5

_MIN_WIND_MS = 0.5      # Gaussian plume is undefined for calm air — clamp, flag as calm
_NOSE_M = 60.0          # polygon starts just off the source point
_MAX_REACH_M = 12_000.0
_EDGE_SIGMAS = 2.15     # ±2.15·sigma_y ≈ 95% of lateral mass
# Footprint ends at the 0.1% relative-concentration contour. This is a display
# contour choice, not an exposure claim: it yields ~1-2 km reach in unstable
# daytime air and 4-6 km under stable night inversions — the physics story
# (longer plumes when dispersion is suppressed) stays visible at city zoom.
_FADE_RATIO = 0.001
_METERS_PER_DEG_LAT = 111_320.0


def wind_bearing_deg(u: float, v: float) -> float:
    """Compass bearing the wind blows TOWARD (u eastward, v northward, m/s)."""
    return math.degrees(math.atan2(u, v)) % 360.0


def plume_reach_m(stability: str) -> float:
    """Downwind distance where centerline concentration decays to _FADE_RATIO."""
    xs = np.geomspace(_NOSE_M, _MAX_REACH_M, 120)
    near = sigma_y(xs[0], stability) * sigma_z(xs[0], stability)
    ratio = near / (sigma_y(xs, stability) * sigma_z(xs, stability))
    inside = xs[ratio >= _FADE_RATIO]
    return float(inside[-1]) if inside.size else float(xs[0])


def footprint_polygon(
    lon: float, lat: float, bearing_deg: float, stability: str, reach_m: float
) -> list[list[float]]:
    """Closed teardrop polygon ([lon, lat] ring) from a source, downwind."""
    xs = np.linspace(_NOSE_M, reach_m, 16)
    half_w = _EDGE_SIGMAS * sigma_y(xs, stability)
    # local frame: x downwind, y crosswind → rotate into east/north
    theta = math.radians(bearing_deg)
    sin_t, cos_t = math.sin(theta), math.cos(theta)
    m_per_deg_lon = _METERS_PER_DEG_LAT * max(0.2, math.cos(math.radians(lat)))

    def to_lonlat(x: float, y: float) -> list[float]:
        # y > 0 is meteorological LEFT of downwind (90° CCW): l̂ = (-cosθ, sinθ)
        east = x * sin_t - y * cos_t
        north = x * cos_t + y * sin_t
        return [round(lon + east / m_per_deg_lon, 5), round(lat + north / _METERS_PER_DEG_LAT, 5)]

    left = [to_lonlat(x, w) for x, w in zip(xs, half_w)]
    right = [to_lonlat(x, -w) for x, w in zip(xs[::-1], half_w[::-1])]
    ring = [to_lonlat(0.0, 0.0), *left, *right]
    ring.append(ring[0])
    return ring


def plume_footprints(
    sources: list[dict],
    wind_u: float,
    wind_v: float,
    is_day: bool = True,
    top: int = 12,
) -> dict:
    """Build the /plume payload: wind summary + top-N source footprints.

    Each source dict needs: id, name, type, lon, lat and optionally
    detection_confidence (0-1). Returns plumes ranked by relative intensity.
    """
    speed = math.hypot(wind_u, wind_v)
    calm = speed < _MIN_WIND_MS
    eff_speed = max(speed, _MIN_WIND_MS)
    bearing = wind_bearing_deg(wind_u, wind_v)
    stability = pasquill_stability(eff_speed, is_day)
    reach = plume_reach_m(stability)
    if calm:
        reach = min(reach, 1_500.0)  # near-stagnant air: pollution pools locally

    ranked = []
    for s in sources:
        lon, lat = s.get("lon"), s.get("lat")
        if lon is None or lat is None:
            continue
        weight = TYPE_WEIGHT.get(str(s.get("type", "")), DEFAULT_WEIGHT)
        conf = float(s.get("detection_confidence") or 0.5)
        ranked.append((weight * (0.5 + 0.5 * conf), s))
    ranked.sort(key=lambda t: (-t[0], str(t[1].get("id"))))
    ranked = ranked[: max(0, top)]

    peak = ranked[0][0] if ranked else 1.0
    plumes = [
        {
            "id": s.get("id"),
            "name": s.get("name") or str(s.get("type", "source")).replace("_", " "),
            "type": s.get("type"),
            "origin": [round(float(s["lon"]), 5), round(float(s["lat"]), 5)],
            "intensity": round(raw / peak, 3),
            "polygon": footprint_polygon(float(s["lon"]), float(s["lat"]), bearing, stability, reach),
        }
        for raw, s in ranked
    ]
    return {
        "wind": {
            "u_ms": round(wind_u, 2),
            "v_ms": round(wind_v, 2),
            "speed_ms": round(speed, 2),
            "bearing_deg": round(bearing, 1),
            "calm": calm,
            "stability": stability,
            "is_day": is_day,
        },
        "reach_m": round(reach),
        "model": "gaussian-plume, Briggs urban coefficients",
        "note": "intensity is relative (source category x detection confidence), not measured emission rate",
        "plumes": plumes,
    }
