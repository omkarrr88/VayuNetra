# ml/ — models & training

Numbers come from ML/physics; the LLM only explains/cites/localises. Train free on
Colab/Kaggle; version artifacts to R2/Storage; `eval/evaluate.ipynb` regenerates every metric.
Spec: ARCHITECTURE.md §9, PRD §12.

| Folder | Model | Stage |
|---|---|---|
| `attribution/` | gradient-boosting apportionment + SHAP (A1) | 1 |
| `forecast/` | LightGBM (quantile) → GNN/TFT; persistence+climatology baselines (A2) | 1 (GNN: 2) |
| `dispersion/` | Gaussian plume + wind advection (physics prior) | 1 |
| `vision/` | E1 Sentinel-2 CV source detection + E6 CLIP patch embeddings | 2 |
| `coverage/` | E2 AOD→PM2.5 + 1km downscaling CNN | 2 |
| `simulator/` | E3 what-if + E5 prescriptive optimiser | 2 |
| `impact/` | E7 health (dose-response) + carbon (emission-factor) | 2 |
| `anomaly/` | E4 spike detector (stretch) | 2 |

**Discipline:** strict temporal splits, no leakage, fixed seeds, SAFAR/TERI held out.
