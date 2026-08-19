# VayuNetra AI & Machine Learning Methodology

This document serves as the formal specification for the AI models, Responsible AI guidelines, and MLOps strategies used within VayuNetra. It directly addresses sections **§12.0**, **§12.11**, and **§12.12** of the Product Requirements Document (PRD).

---

## 1. Model & Training Overview (PRD §12.0)

VayuNetra employs a hybrid approach: **physics-informed ML** for explainability, **deep learning** for complex geospatial tasks, and **pre-trained models** where fine-tuning adds no value. 

All custom training is executed on 100% free compute (Google Colab / Kaggle).

| Model Component | Type / Architecture | Training Data | Free Compute | Primary Role |
| :--- | :--- | :--- | :--- | :--- |
| **Forecast (Agent 2)** ⭐ | LightGBM (MVP) → Spatiotemporal GNN / TFT | Historical CAAQMS + Met + Seasonal Calendars | Colab / Kaggle GPU | Predicts AQI 24-72h ahead, **beats persistence baseline**. |
| **Source Attribution (Agent 1)** | Gradient Boosting (Multi-output) + SHAP | Multi-pollutant + Satellite + Land use (Calibrated to SAFAR/TERI) | Colab | Generates the per-ward "Blame Map". |
| **Satellite Source CV (E1)** | CNN / Semantic Segmentation (U-Net) | Labelled Sentinel-2 tiles (Construction, Kilns, Open Burning) | Kaggle GPU | Automatically detects unregulated emission sources. |
| **AOD → PM2.5 (E2)** | Regression (GBM / MLP) | Paired Satellite AOD + Ground PM2.5 | Colab | Creates dense AQI coverage across the city. |
| **1km Downscaling (E2)** | CNN / Learned Interpolation | Sparse Stations + Satellite + Land use | Kaggle GPU | Downscales AQI to hyperlocal 1km resolution. |
| **Spike / Anomaly Detector (E4)**| STL + Isolation Forest / Autoencoder | Historical per-cell AQI series | Colab | Flags abnormal pollution events for proactive enforcement. |
| **RAG Embeddings (Agent 3/4)** | Pre-trained local `bge-small` | NCAP / GRAP / CPCB regulations | N/A (Pre-trained) | Retrieves legal basis for enforcement dossiers. |
| **Advisory Localisation (Agent 4)**| **Deterministic templates — no model** | One authored string per risk tier per language | N/A | Citizen alerts in 8 languages. A language model CANNOT write health advice here: a hallucinated line in an asthma advisory is not a risk we accept. Script validity is checked in code (`script_ok()`). |
| **Advisory fluency polish (optional, off)** | Gemini 2.0 Flash | Template + locked facts | N/A (Free API) | `scripts/llm_polish_advisories.py` — the LLM pathway the brief suggests, built and **fact-gated**: Gemini may only rephrase, and a candidate is rejected unless the zone id, the horizon, "N95" and every digit survive verbatim. Rejected candidates keep the template. **Not wired into any cron** — an operator choice, disclosed. |

---

## 2. Responsible AI & Fairness (PRD §12.11)

Because VayuNetra recommends enforcement actions (Agent 3), it must adhere to strict Responsible AI principles to prevent systemic biases and maintain trust.

### 2.1 Equity Guard (Anti-Bias)
- **The Risk:** Raw emission models might disproportionately flag low-income wards where informal waste burning or localized industries are prevalent, while ignoring affluent high-traffic zones.
- **The Mitigation:** Our priority scoring formula explicitly incorporates an **exposure-weighting**. Furthermore, a Quantified Fairness Audit (Stage 2) continuously monitors the partial correlation between `priority_score` and `ward_income_proxy` (controlling for pollution and exposure) to ensure the correlation remains near zero.
- **Human-in-the-Loop:** The system *recommends* enforcement (generates a draft dossier). It never auto-executes fines or seals sites. A human officer always reviews the RAG citations and evidence before dispatching.

### 2.2 Confidence & Honesty
- **Confidence Scoring:** Every output (attribution share, forecast, CV detection) carries a statistical confidence score. If the attribution model cannot reliably parse a mixed signal, it lowers the confidence, which directly reduces the enforcement priority score.
- **Validation Sanctity:** SAFAR and TERI emission inventories are held out strictly for evaluation. They are **never** used in the training loop, ensuring our accuracy claims (agreement within ±15-20%) are honest and credible.

### 2.3 Privacy
- **Citizen Advisory:** Advisories are aggregated at the **ward level**, not tracked to individual GPS coordinates. Vulnerability targeting relies on broader demographic data (e.g., WorldPop) rather than PII.

---

## 3. Training Compute & MLOps (PRD §12.12)

We achieve state-of-the-art ML operations without spending a single rupee, proving that our solution can scale to all 131 NCAP cities affordably.

### 3.1 Free Compute Strategy
- **Google Colab (T4 GPUs):** Used for iterating on LightGBM forecasts, AOD regressors, and Isolation Forests.
- **Kaggle (P100 / T4x2 GPUs):** Dedicated for heavy deep learning tasks (E1 Satellite CV and E2 Downscaling CNN). Offers 30h/week of free GPU compute, which is more than enough for our batch sizes.

### 3.2 Artifact Versioning
- Trained model weights (`.pth`, `.pkl`) are saved to the `artifacts/` directory and loaded dynamically by the FastAPI backend during inference.
- Datasets are tracked via Kaggle Datasets or Google Drive, maintaining clear lineage from raw Copernicus `.jp2` files to processed 256x256 `.tif` patches.

### 3.3 Complete Reproducibility
- The core validation pipeline is driven by a single Jupyter Notebook: `eval/evaluate.ipynb`.
- This notebook runs the full evaluation harness (RMSE vs persistence, Attribution vs SAFAR, Enforcement Rubric Proxy, Fairness partial correlation) on held-out test data.
- Judges can run this notebook to instantly verify every performance metric claimed in our deck.
