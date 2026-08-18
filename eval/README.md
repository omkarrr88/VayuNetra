# eval/ — validation & evaluation harness

Each model supplies its own metrics to a shared harness.
Spec: ARCHITECTURE.md §14, PRD §13. One `evaluate.ipynb` regenerates **every** number live for judges.

| # | Validates | Metric |
|---|---|---|
| 1 | Attribution accuracy (vs held-out SAFAR/TERI) | per-category agreement |
| 2 | **Forecast skill** | `1 − RMSE_model/RMSE_persistence` ≥ 0.25 |
| 3 | Enforcement quality | CPCB/GRAP rubric proxy, top-10 precision |
| 4 | Advisory relevance & coverage | ≥4 languages |
| 5 | Signal-to-action latency | median < 5 min |
| 6–8 | E1 CV mAP/F1 · E2 RMSE · E3 plausibility | held-out |
| 9 | Fairness / equity | partial corr ≈ 0 |
| 10–12 | E5 optimiser · E6 precision@k · E7 100%-sourced | — |

Discipline: strict temporal splits, no leakage, fixed seeds, inventories never trained on.
