"""E2 — dense-field assembler.

Bridges the two E2 models into the product the UI shows: a full-city, per-H3-cell
(~1 km) PM2.5 field with uncertainty, plus the sparse "stations-only" field it is
compared against (the map's "stations ↔ dense 1 km" toggle).

Pipeline, per city:
  1. sparse station anchors → IDW raster            ("stations-only" baseline)
  2. land-use proxy raster (source-proximity + texture)   → the high-res covariate
  3. coarse = pool(stations); up = bilinear(coarse); dense = downscaling-CNN(up, land-use)
  4. sample both rasters at each H3-res-8 cell centroid over the city bbox

Everything is deterministic given a seed. In DEMO_MODE the API serves a
precomputed fixture (built by ``scripts``/this module); live mode would feed real
CPCB station values + EE AOD. The downscaler's honest held-out skill travels with
the payload so the UI can state it, never implying more coverage than validated.
"""
from __future__ import annotations

import numpy as np

from core.spatial.h3_utils import cell_to_latlng, cells_in_bbox

Bbox = tuple[float, float, float, float]  # (min_lng, min_lat, max_lng, max_lat)

# Lazily-trained shared downscaler (training is CPU-fast; cached across calls).
# torch is imported lazily: the lean deploy (Render/CI) has no torch, and the
# endpoint must degrade to the covariate-modulated bilinear fallback, not 500.
_MODEL = None
_MODEL_METRICS: dict | None = None


def _get_model():
    global _MODEL, _MODEL_METRICS
    if _MODEL is None:
        from . import downscale as D
        _MODEL, _MODEL_METRICS = D.train_and_validate()
    return _MODEL, _MODEL_METRICS


def _avg_pool_np(fine: np.ndarray, factor: int) -> np.ndarray:
    h = fine.shape[0] // factor
    return fine[: h * factor, : h * factor].reshape(h, factor, h, factor).mean((1, 3))


def _bilinear_np(coarse: np.ndarray, size: int) -> np.ndarray:
    """Pure-numpy bilinear upsample (torch-free path)."""
    h, w = coarse.shape
    yi = np.linspace(0, h - 1, size)
    xi = np.linspace(0, w - 1, size)
    y0 = np.clip(np.floor(yi).astype(int), 0, h - 2)
    x0 = np.clip(np.floor(xi).astype(int), 0, w - 2)
    wy = (yi - y0)[:, None]
    wx = (xi - x0)[None, :]
    c00 = coarse[np.ix_(y0, x0)]
    c01 = coarse[np.ix_(y0, x0 + 1)]
    c10 = coarse[np.ix_(y0 + 1, x0)]
    c11 = coarse[np.ix_(y0 + 1, x0 + 1)]
    return (c00 * (1 - wy) * (1 - wx) + c01 * (1 - wy) * wx
            + c10 * wy * (1 - wx) + c11 * wy * wx)


def _grid(bbox: Bbox, n: int):
    min_lng, min_lat, max_lng, max_lat = bbox
    lngs = np.linspace(min_lng, max_lng, n)
    lats = np.linspace(min_lat, max_lat, n)
    return np.meshgrid(lngs, lats)  # (lng_grid, lat_grid), each (n, n)


def _synth_anchors(bbox: Bbox, base_pm25: float, k: int, seed: int):
    """A handful of station-like anchors when real CPCB values aren't supplied."""
    rng = np.random.default_rng(seed)
    min_lng, min_lat, max_lng, max_lat = bbox
    out = []
    for _ in range(k):
        out.append({
            "lng": float(rng.uniform(min_lng, max_lng)),
            "lat": float(rng.uniform(min_lat, max_lat)),
            "pm25": float(np.clip(base_pm25 * rng.uniform(0.7, 1.35), 8, 900)),
        })
    return out


def _idw(anchors, lng_grid, lat_grid, power: float = 2.0) -> np.ndarray:
    """Inverse-distance-weighted station field — the sparse baseline."""
    num = np.zeros_like(lng_grid, dtype=np.float64)
    den = np.zeros_like(lng_grid, dtype=np.float64)
    for a in anchors:
        d2 = (lng_grid - a["lng"]) ** 2 + (lat_grid - a["lat"]) ** 2 + 1e-9
        w = 1.0 / d2 ** (power / 2)
        num += w * a["pm25"]
        den += w
    return num / den


def _landuse(lng_grid, lat_grid, sources, seed: int) -> np.ndarray:
    """High-res covariate: built-up/emission-source proximity + fine texture.
    This is what lets the CNN add detail the sparse stations cannot see."""
    rng = np.random.default_rng(seed + 1)
    field = 0.25 + 0.15 * rng.standard_normal(lng_grid.shape)  # texture floor
    pts = [(s["coordinates"][0], s["coordinates"][1], s.get("detection_confidence", 0.8))
           for s in (sources or []) if s.get("coordinates")]
    if not pts:  # fall back to a couple of synthetic hotspots
        min_lng, min_lat = lng_grid.min(), lat_grid.min()
        max_lng, max_lat = lng_grid.max(), lat_grid.max()
        pts = [((min_lng + max_lng) / 2, (min_lat + max_lat) / 2, 0.9)]
    span = max(lng_grid.max() - lng_grid.min(), 1e-3)
    for lng, lat, conf in pts:
        s = span / 6.0
        field += conf * np.exp(-((lng_grid - lng) ** 2 + (lat_grid - lat) ** 2) / (2 * s * s))
    return np.clip(field, 0, None) / max(field.max(), 1e-6)


def build_dense_field(
    city_id: str,
    bbox: Bbox,
    anchors: list[dict] | None = None,
    sources: list[dict] | None = None,
    base_pm25: float = 95.0,
    n: int = 32,
    factor: int = 4,
    res: int = 8,
    seed: int = 11,
) -> dict:
    """Full-city dense PM2.5 field + the stations-only baseline, per H3 cell."""
    lng_grid, lat_grid = _grid(bbox, n)
    anchors = anchors or _synth_anchors(bbox, base_pm25, k=8, seed=seed)

    stations = _idw(anchors, lng_grid, lat_grid)                    # sparse baseline
    land_use = _landuse(lng_grid, lat_grid, sources, seed)          # hi-res covariate
    coarse = _avg_pool_np(stations.astype(np.float32), factor)      # what a coarse net sees
    up = _bilinear_np(coarse, n)

    try:
        import torch
        from . import downscale as D

        model, metrics = _get_model()
        X = torch.tensor(np.stack([up, land_use * 200.0])[None], dtype=torch.float32)
        mean, std = D.mc_downscale(model, X, k=16)
        dense = mean[0, 0]
        uncert = std[0, 0]
    except ImportError:
        # Lean deploy (no torch): covariate-modulated bilinear — honest fallback
        # that still uses the hi-res land-use signal, with a spread-based
        # uncertainty proxy. The CNN + MC-dropout path needs requirements-ml.
        mod = 0.85 + 0.30 * land_use
        dense = up * mod * (up.mean() / max((up * mod).mean(), 1e-6))  # preserve city mean
        uncert = np.abs(dense - up) * 0.5 + 0.05 * up
        metrics = {
            "skill_vs_bilinear": None,
            "note_fallback": "no-torch fallback: covariate-modulated bilinear "
                             "(install requirements-ml for the CNN + MC-dropout uncertainty)",
        }

    # Sample both rasters at each H3-cell centroid over the bbox.
    min_lng, min_lat, max_lng, max_lat = bbox
    cells = []
    for cell in cells_in_bbox(bbox, res):
        lat, lng = cell_to_latlng(cell)
        j = int(round((lng - min_lng) / (max_lng - min_lng + 1e-9) * (n - 1)))
        i = int(round((lat - min_lat) / (max_lat - min_lat + 1e-9) * (n - 1)))
        if not (0 <= i < n and 0 <= j < n):
            continue
        cells.append({
            "h3_cell": cell,
            "pm25": round(float(dense[i, j]), 1),              # dense 1 km estimate
            "pm25_stations": round(float(stations[i, j]), 1),  # sparse baseline
            "uncertainty": round(float(uncert[i, j]), 2),
        })

    vals = np.array([c["pm25"] for c in cells]) if cells else np.array([0.0])
    return {
        "city_id": city_id,
        "resolution": f"h3-res-{res}",
        "n_cells": len(cells),
        "n_stations": len(anchors),
        "cells": cells,
        "stats": {
            "pm25_min": round(float(vals.min()), 1),
            "pm25_max": round(float(vals.max()), 1),
            "pm25_mean": round(float(vals.mean()), 1),
            "mean_uncertainty": round(float(np.mean([c["uncertainty"] for c in cells]) if cells else 0.0), 2),
        },
        "validation": {
            **(metrics or {}),
            "note": "downscaler skill vs bilinear on held-out synthetic fields; "
                    "real held-out-station RMSE runs on Kaggle with EE AOD × CPCB",
        },
    }
