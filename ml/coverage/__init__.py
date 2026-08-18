"""E2 — dense-coverage models (Stage 2).

Two models turn ~40 stations into a full-city 1 km field:
  - ``aod_pm25``   — AOD + met → surface PM2.5 (LightGBM; established RS approach)
  - ``downscale``  — learned super-resolution CNN → dense field + uncertainty
and ``dense_field.build_dense_field`` assembles them into the per-H3-cell payload
the "stations ↔ dense 1 km" toggle renders.
"""
from .dense_field import build_dense_field

__all__ = ["build_dense_field"]
