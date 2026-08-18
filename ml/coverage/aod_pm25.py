"""E2 — AOD→PM2.5 regressor.

The established remote-sensing approach (PRD §12.8 / ARCH §9.6): map satellite
Aerosol Optical Depth + meteorology → *surface* PM2.5, calibrated on
station↔satellite pairs. This fills the gaps between the ~40 ground stations so
the downscaler (see ``downscale.py``) can render a full-city 1 km field.

Physics the model must learn (and the synthetic generator below encodes, so the
demo/tests are self-contained until real EE/CPCB pairs are wired in):
  - AOD is a *column* integral; surface PM2.5 scales with AOD / boundary-layer
    height (a shallow, stable layer concentrates the same column near the ground);
  - relative humidity inflates AOD via hygroscopic growth without adding surface
    mass, so the model must discount AOD when RH is high;
  - a seasonal/temperature term captures winter accumulation.

Honest validation: ``evaluate`` reports RMSE / MAE / R² and a **skill score vs a
mean-PM2.5 baseline** — the number to show judges, never a cherry-picked fit.
Real training runs on Kaggle/Colab from EE AOD × CPCB stations; the same code
runs CPU-only here.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

FEATURES = ["aod", "blh_km", "rh", "temp_c", "wind_ms", "winter"]


class _NumpyAodModel:
    """Lean fallback when LightGBM/sklearn wheels are unavailable."""

    def __init__(self, coef: np.ndarray):
        self.coef = coef

    @staticmethod
    def design(X: np.ndarray) -> np.ndarray:
        aod, blh_km, rh, temp_c, wind_ms, winter = X.T
        dry_aod = aod * np.sqrt(1.0 - np.clip(rh, 0, 0.95))
        surface_column = dry_aod / np.clip(blh_km, 0.2, None)
        return np.column_stack([
            np.ones(len(X)),
            surface_column,
            winter,
            temp_c,
            wind_ms,
            rh,
            aod,
        ])

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.design(X) @ self.coef


@dataclass
class Metrics:
    rmse: float
    mae: float
    r2: float
    skill_vs_mean: float          # 1 − RMSE_model / RMSE_mean-baseline
    n: int

    def as_dict(self) -> dict:
        return {"rmse": round(self.rmse, 2), "mae": round(self.mae, 2),
                "r2": round(self.r2, 3), "skill_vs_mean": round(self.skill_vs_mean, 3), "n": self.n}


def _surface_pm25(aod, blh_km, rh, temp_c, winter, rng):
    """Physically-motivated ground truth for synthetic station pairs."""
    # hygroscopic correction: divide AOD by a growth factor f(RH)
    f_rh = 1.0 / (1.0 - np.clip(rh, 0, 0.95)) ** 0.5
    dry_aod = aod / f_rh
    # surface concentration ∝ column / mixing height
    pm = 120.0 * dry_aod / np.clip(blh_km, 0.2, None)
    pm += 18.0 * winter - 0.6 * (temp_c - 20.0)          # winter accumulation
    pm += rng.normal(0, 6.0, size=np.shape(aod))          # measurement noise
    return np.clip(pm, 3.0, 900.0)


def synth_pairs(n: int = 4000, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """Synthetic station↔satellite pairs with a realistic AOD→PM2.5 structure."""
    rng = np.random.default_rng(seed)
    aod = rng.gamma(2.0, 0.25, n)                          # 0..~2, right-skewed
    blh_km = rng.uniform(0.3, 2.5, n)
    rh = rng.uniform(0.2, 0.9, n)
    temp_c = rng.uniform(8, 40, n)
    wind_ms = rng.uniform(0.5, 6.0, n)
    winter = (temp_c < 18).astype(float)
    y = _surface_pm25(aod, blh_km, rh, temp_c, winter, rng)
    X = np.column_stack([aod, blh_km, rh, temp_c, wind_ms, winter])
    return X, y


def train(X: np.ndarray, y: np.ndarray):
    """Fit the AOD→PM2.5 regressor (LightGBM; CPU, no CUDA)."""
    try:
        from lightgbm import LGBMRegressor

        model = LGBMRegressor(
            n_estimators=300, num_leaves=31, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, min_child_samples=20, verbosity=-1,
        )
        model.fit(X, y)
        return model
    except Exception:
        design = _NumpyAodModel.design(X)
        coef, *_ = np.linalg.lstsq(design, y, rcond=None)
        return _NumpyAodModel(coef)


def predict(model, X: np.ndarray) -> np.ndarray:
    return np.clip(model.predict(X), 0.0, None)


def evaluate(model, X: np.ndarray, y: np.ndarray) -> Metrics:
    pred = predict(model, X)
    rmse = float(np.sqrt(np.mean((y - pred) ** 2)))
    mae = float(np.mean(np.abs(y - pred)))
    rmse_mean = float(np.sqrt(np.mean((y - np.full_like(y, y.mean())) ** 2)))
    ss_res = float(np.sum((y - pred) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2)) or 1.0
    return Metrics(
        rmse=rmse, mae=mae, r2=1.0 - ss_res / ss_tot,
        skill_vs_mean=1.0 - rmse / rmse_mean if rmse_mean else 0.0, n=len(y),
    )


def train_and_validate(seed: int = 42) -> tuple[object, Metrics]:
    """Convenience: synth pairs → temporal-agnostic 80/20 split → (model, held-out metrics)."""
    X, y = synth_pairs(seed=seed)
    cut = int(0.8 * len(X))
    model = train(X[:cut], y[:cut])
    return model, evaluate(model, X[cut:], y[cut:])
