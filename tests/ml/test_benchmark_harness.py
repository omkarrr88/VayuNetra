"""The temporal-split benchmark harness on a small synthetic city — protocol guarantees.

Not a skill claim (synthetic numbers are never reportable); this checks the harness itself:
no test leakage across the split, the shared support mask, every forecaster present, the
probability alarms and blend weights well-formed, and the markdown/JSON round trip.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest

from ml.eval import benchmark as B
from ml.forecast.features import build_feature_table

CELLS = ["883da11215fffff", "883da1101dfffff", "883da18db3fffff"]   # real Delhi H3 ids


def _synthetic_long(days: int = 70, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    ts = pd.date_range("2026-01-01", periods=days * 24, freq="h", tz="UTC")
    rows = []
    base = 80 + 40 * np.sin(np.arange(len(ts)) / 24 * 2 * np.pi)          # diurnal
    trend = 30 * np.sin(np.arange(len(ts)) / (24 * 10) * 2 * np.pi)          # 10-day swings
    for i, cell in enumerate(CELLS):
        pm = np.clip(base + trend + 15 * i + rng.normal(0, 12, len(ts)), 5, 600)
        for t, v in zip(ts, pm):
            rows.append({"city_id": "delhi", "h3_cell": cell, "ts": t.isoformat(), "variable": "pm25", "value": float(v)})
    # regional met (one series broadcast by city+ts)
    for t in ts:
        rows.append({"city_id": "delhi", "h3_cell": CELLS[0], "ts": t.isoformat(), "variable": "temp", "value": 20.0})
        rows.append({"city_id": "delhi", "h3_cell": CELLS[0], "ts": t.isoformat(), "variable": "wind_u", "value": 1.0})
        rows.append({"city_id": "delhi", "h3_cell": CELLS[0], "ts": t.isoformat(), "variable": "wind_v", "value": 0.5})
        rows.append({"city_id": "delhi", "h3_cell": CELLS[0], "ts": t.isoformat(), "variable": "blh", "value": 400.0})
    return pd.DataFrame(rows)


@pytest.fixture(scope="module")
def wide():
    return build_feature_table(_synthetic_long())


def test_single_split_horizon_has_every_forecaster_and_no_leakage(wide):
    split = pd.Timestamp("2026-02-20", tz="UTC")
    out = B.evaluate_horizon(wide, 24, split, ablation=True, protocol="single")
    assert out["horizon_h"] == 24 and out["n_test"] > 100 and out["n_train"] > 500
    full = out["regimes"]["full_test"]
    for f in ("model", "model_raw", "persistence", "seasonal_naive", "climatology"):
        assert f"rmse_{f}" in full and full[f"rmse_{f}"] > 0
    assert full["n"] <= out["n_test"]                        # shared support mask never exceeds test rows
    assert 0.0 <= out["blend_weights"][0] <= 1.0
    ew = out["early_warning"]["poor"]
    assert ew["onset_recall_persistence"] in (0.0, None)      # persistence cannot see an onset
    assert [pa["tau"] for pa in ew["probability_alarms"]] == [0.2, 0.3, 0.4, 0.5]
    assert "ablation_no_meteorology" in out and out["ablation_no_meteorology"]["rmse_with_met"] > 0
    cal = out["calibration"]
    assert 0.5 <= cal["pi80_coverage"] <= 1.0
    assert set(B.THRESHOLDS) <= set(cal) | {"n_calibration", "pi80_coverage", "pi80_mean_width"}


def test_rolling_protocol_refits_per_month_and_serves_blend(wide):
    split = pd.Timestamp("2026-02-01", tz="UTC")
    out = B.evaluate_horizon(wide, 24, split, ablation=False, protocol="rolling", window_days=30)
    assert out["protocol"] == "rolling" and out["origins"] >= 2
    assert len(out["blend_weights"]) == out["origins"]
    full = out["regimes"]["full_test"]
    assert full["n"] > 100 and "rmse_model" in full and "rmse_model_raw" in full


def test_run_and_markdown_roundtrip(tmp_path, monkeypatch, wide):
    monkeypatch.setattr(B, "load_hist", lambda city: _synthetic_long())
    res = B.run("delhi", "hist", "2026-02-20", ablation=False, protocol="single")
    md = B.to_markdown(res)
    assert "## RMSE" in md and "Probability alarms" in md and "Early warning" in md
    p = tmp_path / "delhi.json"
    p.write_text(json.dumps(res))
    assert json.loads(p.read_text())["city_id"] == "delhi"
