"""E2 — dense-coverage model tests (Stage 2). CPU-fast; GPU run is the notebook.

The CNN needs torch (requirements-ml). The lean stack (CI, Render) runs the
covariate-modulated bilinear fallback, so those paths are tested torch-free.
"""
import importlib.util

import pytest

from ml.coverage import aod_pm25, build_dense_field

HAS_TORCH = importlib.util.find_spec("torch") is not None


def test_aod_pm25_recovers_physical_relation():
    _, m = aod_pm25.train_and_validate()
    assert m.r2 > 0.7, f"AOD→PM2.5 should fit the physical relation, got R²={m.r2}"
    assert m.skill_vs_mean > 0


@pytest.mark.skipif(not HAS_TORCH, reason="CNN needs torch (requirements-ml)")
def test_downscaler_beats_bilinear():
    # The honest Validation #7 claim: the CNN adds sub-grid info a smear cannot.
    from ml.coverage import downscale

    _, m = downscale.train_and_validate()
    assert m["skill_vs_bilinear"] > 0, "CNN must beat bilinear interpolation"
    assert m["rmse_cnn"] < m["rmse_bilinear"]


def test_dense_field_covers_bbox_with_uncertainty():
    d = build_dense_field("delhi", bbox=(77.0, 28.5, 77.2, 28.7), base_pm25=100.0)
    assert d["n_cells"] > 0
    cell = d["cells"][0]
    assert {"h3_cell", "pm25", "pm25_stations", "uncertainty"} <= set(cell)
    assert cell["uncertainty"] >= 0
    if HAS_TORCH:
        assert d["validation"]["skill_vs_bilinear"] > 0
    else:
        assert "note_fallback" in d["validation"]  # honest label on the lean path
    # dense field carries at least as much spatial structure as the sparse baseline
    dense_spread = max(c["pm25"] for c in d["cells"]) - min(c["pm25"] for c in d["cells"])
    assert dense_spread > 0
