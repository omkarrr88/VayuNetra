"""H3 spatial helpers — the universal spatial key (ARCHITECTURE.md §6).

Primary resolution = res 8 (≈ 0.74 km², edge ≈ 0.46 km) → the brief's "~1 km grid".
This is a working starting point; extend with ward<->H3 mapping.
"""
from __future__ import annotations

from typing import Iterable

import h3  # pip install h3

DEFAULT_RES = 8


def latlng_to_cell(lat: float, lng: float, res: int = DEFAULT_RES) -> str:
    """Point -> H3 cell id at the given resolution."""
    return h3.latlng_to_cell(lat, lng, res)


def cell_to_latlng(cell: str) -> tuple[float, float]:
    """H3 cell id -> (lat, lng) of its center."""
    return h3.cell_to_latlng(cell)


def cells_in_bbox(bbox: tuple[float, float, float, float], res: int = DEFAULT_RES) -> list[str]:
    """All H3 cells covering a [min_lng, min_lat, max_lng, max_lat] bbox."""
    min_lng, min_lat, max_lng, max_lat = bbox
    poly = h3.LatLngPoly(
        [(min_lat, min_lng), (min_lat, max_lng), (max_lat, max_lng), (max_lat, min_lng)]
    )
    return list(h3.polygon_to_cells(poly, res))


def parent(cell: str, res: int) -> str:
    """Aggregate a cell up to a coarser resolution (e.g. res 8 -> res 6 zone)."""
    return h3.cell_to_parent(cell, res)


def k_ring(cell: str, k: int = 1) -> list[str]:
    """Neighbouring cells within distance k (spatial smoothing / neighbours feature)."""
    return list(h3.grid_disk(cell, k))


def cells_for_iterable_points(points: Iterable[tuple[float, float]], res: int = DEFAULT_RES) -> set[str]:
    return {latlng_to_cell(lat, lng, res) for lat, lng in points}


# --- ward <-> H3 mapping (present results at ward level; compute on H3) -------
def cells_for_geojson(geometry: dict, res: int = DEFAULT_RES) -> list[str]:
    """All H3 cells covering a GeoJSON Polygon/MultiPolygon geometry."""
    shape = h3.geo_to_h3shape(geometry)
    return list(h3.h3shape_to_cells(shape, res))


def ward_to_cells(wards_geojson: dict, res: int = DEFAULT_RES) -> dict[str, list[str]]:
    """Ward GeoJSON FeatureCollection -> {ward_id: [covering H3 cells]}.

    Ward id is taken from properties.ward_id / properties.name / feature.id.
    """
    mapping: dict[str, list[str]] = {}
    for feat in wards_geojson.get("features", []):
        props = feat.get("properties") or {}
        ward_id = props.get("ward_id") or props.get("name") or feat.get("id")
        if ward_id is None or "geometry" not in feat:
            continue
        mapping[str(ward_id)] = cells_for_geojson(feat["geometry"], res)
    return mapping


def cell_to_ward(ward_cells: dict[str, list[str]]) -> dict[str, str]:
    """Invert ward_to_cells() -> {h3_cell: ward_id} for cell-level ward lookup."""
    return {cell: ward for ward, cells in ward_cells.items() for cell in cells}
