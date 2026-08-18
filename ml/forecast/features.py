"""Forecast feature engineering.  ARCHITECTURE.md §9.2.

Turns long-format `measurements` into a supervised table: per (cell, t) features
(pollutant levels, broadcast met, calendar, lags) -> target pm25 at t+horizon.
Met is regional (joined by city+ts); pollutants are per H3 cell.
"""
from __future__ import annotations

import pandas as pd

from core.spatial.h3_utils import cell_to_latlng
from ml.dispersion import upwind_origin

from .seasonal import add_calendar_features

POLLUTANTS = ["pm25", "pm10", "no2", "so2", "co", "o3"]
MET = ["temp", "rh", "precip", "wind_u", "wind_v", "blh"]
LAGS = (1, 24)
# Upper bound per pollutant (µg/m³; CO in mg/m³) — anything above is a sensor glitch, not air.
PLAUSIBLE_MAX = {"pm25": 1500.0, "pm10": 3000.0, "no2": 1000.0, "so2": 1000.0, "co": 100.0, "o3": 1000.0}


def add_advected_pm25(wide: pd.DataFrame, hours: float = 6.0) -> pd.DataFrame:
    """Dispersion feature: PM2.5 advected in from the upwind cell (physics-informed transport).

    For each (cell, ts), trace `hours` upwind via the wind field (ml.dispersion.upwind_origin),
    find the nearest data cell to that origin, and take its PM2.5 — the pollution heading toward
    this cell. Captures transport that persistence/local features miss.
    """
    if not {"wind_u", "wind_v", "pm25"} <= set(wide.columns):
        return wide
    cells = list(wide["h3_cell"].unique())
    try:
        centers = {c: cell_to_latlng(c) for c in cells}
    except (ValueError, Exception):  # noqa: BLE001 — non-H3 cell ids (e.g. in unit tests) -> skip feature
        return wide
    pm_by_ts = {ts: dict(zip(g["h3_cell"], g["pm25"])) for ts, g in wide.groupby("ts")}

    def _adv(row) -> float:
        u, v = row.get("wind_u"), row.get("wind_v")
        if pd.isna(u) or pd.isna(v):
            return float("nan")
        lat, lng = centers[row["h3_cell"]]
        ulat, ulng = upwind_origin(lat, lng, float(u), float(v), hours)
        nearest = min(cells, key=lambda c: (centers[c][0] - ulat) ** 2 + (centers[c][1] - ulng) ** 2)
        return pm_by_ts.get(row["ts"], {}).get(nearest, float("nan"))

    wide["advected_pm25"] = wide.apply(_adv, axis=1)
    return wide


def build_feature_table(long_df: pd.DataFrame) -> pd.DataFrame:
    """Long measurements -> wide per (city_id, h3_cell, ts) + met broadcast + calendar + lags."""
    df = long_df.copy()
    # floor to the hour so sources on different sub-hour offsets align
    # (OpenAQ hourly lands at :30, Open-Meteo at :00) — otherwise the met join misses entirely.
    df["ts"] = pd.to_datetime(df["ts"], utc=True).dt.floor("h")

    poll = df[df["variable"].isin(POLLUTANTS)]
    # Physical-plausibility guard: CPCB/OpenAQ feeds carry sentinel and glitch values
    # (negatives, 100000, 418000). A single 418,000 µg/m³ row would dominate every RMSE
    # and every quantile; drop values outside the instrument range before pivoting.
    cap = poll["variable"].map(PLAUSIBLE_MAX).fillna(1e9)
    poll = poll[(poll["value"] > 0) & (poll["value"] <= cap)]
    poll_wide = poll.pivot_table(
        index=["city_id", "h3_cell", "ts"], columns="variable", values="value"
    ).reset_index()

    met = df[df["variable"].isin(MET)]
    met_wide = met.pivot_table(
        index=["city_id", "ts"], columns="variable", values="value"
    ).reset_index()

    wide = poll_wide.merge(met_wide, on=["city_id", "ts"], how="left")
    wide = wide.sort_values(["h3_cell", "ts"]).reset_index(drop=True)

    # physics-informed feature: ventilation coefficient = transport wind speed x mixing height.
    # Low ventilation (calm + shallow boundary layer) => pollution accumulates. (ARCH §9.2)
    if {"wind_u", "wind_v", "blh"} <= set(wide.columns):
        wide["wind_speed"] = (wide["wind_u"] ** 2 + wide["wind_v"] ** 2) ** 0.5
        wide["ventilation"] = wide["wind_speed"] * wide["blh"]

    wide["hour"] = wide["ts"].dt.hour
    wide["dow"] = wide["ts"].dt.dayofweek
    wide = add_calendar_features(wide)   # stubble / Diwali / winter-inversion flags
    wide = add_advected_pm25(wide)       # dispersion: pollution advected in from upwind
    for lag in LAGS:
        wide[f"pm25_lag{lag}"] = wide.groupby("h3_cell")["pm25"].shift(lag)
    return wide


def make_supervised(wide: pd.DataFrame, horizon_h: int, target: str = "pm25"):
    """Return (X, y, meta, feature_cols); y = target at t+horizon within each cell.

    Assumes hourly-contiguous rows per cell (true for our connectors).
    """
    wide = wide.sort_values(["h3_cell", "ts"]).reset_index(drop=True).copy()
    wide["y"] = wide.groupby("h3_cell")[target].shift(-horizon_h)
    drop = {"city_id", "h3_cell", "ts", "y"}
    feature_cols = [c for c in wide.columns if c not in drop]
    # reset index on the whole sample frame so X / y / meta stay aligned (used by .loc in backtest)
    samples = wide.dropna(subset=["y", target]).reset_index(drop=True)
    return (
        samples[feature_cols],
        samples["y"],
        samples[["city_id", "h3_cell", "ts"]],
        feature_cols,
    )
