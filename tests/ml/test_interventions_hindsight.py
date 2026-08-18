"""The intervention-hindsight module: dated orders carry sources, the markdown renders the
artifact, and the deweathering helper builds the expected feature set (no heavy runs here)."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from ml.eval import interventions as I


def test_every_intervention_is_dated_and_sourced():
    for ev in I.INTERVENTIONS:
        assert ev["source"].startswith("http"), ev["key"]
        assert I._ts(ev["end"]) > I._ts(ev["start"]), ev["key"]
        assert ev["kind"] in ("escalation", "event")


def test_deweather_features_include_met_calendar_and_cell():
    wide = pd.DataFrame({
        "ts": pd.date_range("2025-11-01", periods=48, freq="h", tz="UTC"),
        "h3_cell": ["a"] * 24 + ["b"] * 24, "pm25": 100.0,
        "temp": 20.0, "rh": 50.0, "precip": 0.0, "wind_u": 1.0, "wind_v": 0.5, "blh": 300.0,
        "wind_speed": 1.1, "ventilation": 330.0, "hour": 0, "dow": 0,
    })
    df, cols = I._deweather_features(wide)
    assert {"temp", "blh", "wind_speed", "hour", "dow", "doy", "cell_code"} <= set(cols)
    assert df["cell_code"].nunique() == 2


def test_published_delhi_artifact_round_trips_to_markdown():
    p = Path("docs/benchmarks/delhi_interventions.json")
    res = json.loads(p.read_text())
    md = I.to_markdown(res)
    assert "Would VayuNetra have warned" in md and "weather taken out" in md and "## Sources" in md
    assert "GRAP Stage IV invoked" in md
