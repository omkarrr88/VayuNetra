"""E2 — 1 km downscaling CNN.

Learned spatial super-resolution (PRD §12.8 / ARCH §9.6): fuse a coarse PM2.5
field (sparse stations + AOD→PM2.5) with a high-resolution land-use covariate to
render a dense H3-res-8 (~1 km) field with uncertainty. "Turns ~40 stations into
a full-city 1 km map."

Why this beats plain interpolation (the thing Validation #7 measures): bilinear
upsampling can only smear the coarse field, so it cannot recover structure finer
than the station spacing. This SRCNN-style net additionally sees a land-use
channel (roads / industry / built-up density) that *is* high-resolution, and
learns to add back the pollution detail that co-varies with it. ``evaluate``
reports the honest **skill vs bilinear** — positive only if the model truly adds
sub-grid information.

Uncertainty is MC-dropout spread (dropout left active at inference, K samples).
Architecture is deliberately small so it trains CPU-fast for tests/fixtures; real
training runs on Kaggle/Colab GPU (see ``notebooks/`` + ``train.py``).
"""
from __future__ import annotations

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

# Reproducibility for CPU training (Date.now/rng seeding kept explicit).
_SEED = 7


class DownscaleCNN(nn.Module):
    """SRCNN-style residual refiner. Input channels: [bilinear(coarse), land_use]."""

    def __init__(self, in_ch: int = 2, hidden: int = 32, p_drop: float = 0.1):
        super().__init__()
        self.body = nn.Sequential(
            nn.Conv2d(in_ch, hidden, 9, padding=4), nn.ReLU(inplace=True), nn.Dropout2d(p_drop),
            nn.Conv2d(hidden, hidden // 2, 5, padding=2), nn.ReLU(inplace=True), nn.Dropout2d(p_drop),
            nn.Conv2d(hidden // 2, 1, 5, padding=2),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # residual on top of the upsampled coarse field (channel 0)
        return x[:, :1] + self.body(x)


# --- synthetic training data (self-contained until real EE/CPCB grids wired) --
def _gaussian_field(size: int, rng: np.random.Generator, n_blobs: int = 6, sharp: float = 1.0) -> np.ndarray:
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    field = np.zeros((size, size), np.float32)
    for _ in range(n_blobs):
        cy, cx = rng.uniform(0, size, 2)
        s = rng.uniform(size / 10, size / 3) / sharp
        field += rng.uniform(0.4, 1.0) * np.exp(-((xs - cx) ** 2 + (ys - cy) ** 2) / (2 * s * s))
    m = field.max()
    return field / m if m > 0 else field


def _avg_pool(fine: np.ndarray, factor: int) -> np.ndarray:
    h = fine.shape[0] // factor
    return fine[: h * factor, : h * factor].reshape(h, factor, h, factor).mean((1, 3))


def _bilinear_up(coarse: np.ndarray, size: int) -> np.ndarray:
    t = torch.tensor(coarse, dtype=torch.float32)[None, None]
    up = F.interpolate(t, size=(size, size), mode="bilinear", align_corners=False)
    return up[0, 0].numpy()


def make_dataset(n: int = 320, fine: int = 32, factor: int = 4, seed: int = _SEED):
    """(X, y) where X=[bilinear(coarse), land_use], y=truth. Land-use carries the
    sub-coarse detail, so a good model beats bilinear; a blind one cannot."""
    rng = np.random.default_rng(seed)
    X, Y = [], []
    for _ in range(n):
        base = _gaussian_field(fine, rng, n_blobs=5, sharp=1.0)          # large-scale
        land_use = _gaussian_field(fine, rng, n_blobs=10, sharp=2.2)     # fine texture
        truth = 40.0 + 160.0 * (0.6 * base + 0.4 * land_use)            # µg/m³
        coarse = _avg_pool(truth, factor)                               # what stations+AOD give
        up = _bilinear_up(coarse, fine)                                 # baseline
        X.append(np.stack([up, land_use * 200.0]))                      # scale LU near PM range
        Y.append(truth[None])
    return torch.tensor(np.array(X), dtype=torch.float32), torch.tensor(np.array(Y), dtype=torch.float32)


def train(X: torch.Tensor, y: torch.Tensor, epochs: int = 60, lr: float = 1e-3) -> DownscaleCNN:
    torch.manual_seed(_SEED)
    model = DownscaleCNN()
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    lossf = nn.MSELoss()
    model.train()
    for _ in range(epochs):
        opt.zero_grad()
        loss = lossf(model(X), y)
        loss.backward()
        opt.step()
    return model


def _rmse(a: torch.Tensor, b: torch.Tensor) -> float:
    return float(torch.sqrt(F.mse_loss(a, b)))


def evaluate(model: DownscaleCNN, X: torch.Tensor, y: torch.Tensor) -> dict:
    """Skill vs the bilinear baseline (channel 0 of X). Positive ⇒ real sub-grid gain."""
    model.eval()
    with torch.no_grad():
        pred = model(X)
    rmse_cnn = _rmse(pred, y)
    rmse_bilinear = _rmse(X[:, :1], y)
    return {
        "rmse_cnn": round(rmse_cnn, 2),
        "rmse_bilinear": round(rmse_bilinear, 2),
        "skill_vs_bilinear": round(1.0 - rmse_cnn / rmse_bilinear, 3) if rmse_bilinear else 0.0,
        "n": int(y.shape[0]),
    }


def mc_downscale(model: DownscaleCNN, X: torch.Tensor, k: int = 20) -> tuple[np.ndarray, np.ndarray]:
    """MC-dropout inference → (mean field, uncertainty=std) as numpy (B,1,H,W)."""
    model.train()  # keep dropout active for the MC estimate
    with torch.no_grad():
        samples = torch.stack([model(X) for _ in range(k)])
    return samples.mean(0).numpy(), samples.std(0).numpy()


def train_and_validate(seed: int = _SEED) -> tuple[DownscaleCNN, dict]:
    X, y = make_dataset(seed=seed)
    cut = int(0.8 * len(X))
    model = train(X[:cut], y[:cut])
    return model, evaluate(model, X[cut:], y[cut:])
