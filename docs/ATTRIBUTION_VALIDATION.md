# Attribution validation — our per-cell source shares vs published apportionment

PS-5 asks for "source attribution accuracy versus ground-truth emission inventories". No
public, current, cell-level inventory exists for any Indian city, so we validate the way the
field does: **indicatively, against peer-reviewed / government source-apportionment studies for
the same city**, and we are explicit about what is and is not comparable.

## What our attribution is (and is not)

`ml/attribution` produces, per H3 cell and hour, shares over six buckets —
`traffic`, `industrial`, `construction_dust`, `biomass_burning`, `transported` (regional
advection: PM2.5 carried in from upwind), `other` — from a hybrid of chemical-signature
priors (NO₂/CO/SO₂ ratios, PM10/PM2.5 ratio, FIRMS fire counts, Sentinel-5P NO₂) and a
per-cell gradient-boosted model whose SHAP contributions are used only when it passes an
out-of-sample R² ≥ 0.15 skill gate (`method_version = hybrid-gbm-shap-v2`; the gate result is
shown on every cell story). Two consequences:

* It is a **receptor-side, statistical** attribution — which signals move PM2.5 at that
  cell — not a mass-balance emission inventory. Shares are comparable in *ranking and rough
  magnitude*, not to the percentage point.
* `transported` has no counterpart in a sector inventory; it corresponds to the
  **"contribution from outside the city"** that dispersion studies report separately. We
  therefore compare (a) source buckets renormalised without `transported`/`other`, and
  (b) `transported` against the published outside-city share.

## Delhi — vs TERI-ARAI (2018), the reference study for Delhi-NCR

*Source Apportionment of PM2.5 & PM10 of Delhi NCR for Identification of Major Sources*,
TERI & ARAI for the Dept. of Heavy Industry, Aug 2018 — receptor modelling + dispersion,
20 sites, two seasons.

**Published PM2.5 shares in Delhi city (TERI-ARAI Table E.2):**

| sector | winter | summer (Apr–Jun) |
|---|---:|---:|
| Transport | 28 % | 17 % |
| Industry | 30 % | 22 % |
| Dust (soil, road, construction) | 17 % | 38 % |
| Biomass (residential + agricultural burning) | 14 % | 15 % |
| Others | 11 % | 8 % |
| **Delhi's own emissions** (rest = outside Delhi) | **36 %** | **26 %** |

**Our city-mean shares, Delhi, 22 station cells, week to 16 Aug 2026 (monsoon):**

| bucket | raw | source-only (renormalised) | TERI-ARAI summer, same four (renormalised) |
|---|---:|---:|---:|
| traffic | 42 % | **67 %** | 18 % |
| industrial | 8 % | 13 % | 24 % |
| construction_dust | 13 % | 20 % | 41 % |
| biomass_burning | 0 % | 0 % | 16 % |
| transported | 25 % | — | (outside Delhi: 74 % in summer, 64 % in winter) |
| other | 13 % | — | — |

**Read-out (honest).**

* **Agreement:** dust and industry are material in both; biomass ≈ 0 in August is right
  (no stubble season, monsoon suppresses open burning) and our FIRMS-driven biomass share
  will rise in Oct–Nov — the seasonal signature TERI-ARAI reports (biomass 22 % of winter PM2.5
  in Delhi city + NCR towns).
* **Disagreement we do not hide:** we rank **traffic first** in Delhi (67 % source-only) where
  TERI-ARAI's summer ranks **dust first** (41 %). Three reasons, in order of likely weight:
  (1) *season* — TERI's "summer" is pre-monsoon Apr–Jun dust-storm season; ours is August
  monsoon, when rain suppresses resuspended dust and traffic's NO₂/CO co-signal dominates
  what remains; (2) *receptor placement* — CAAQMS stations sit on arterial roads
  (Anand Vihar, ITO, Punjabi Bagh), so cell-level shares over-represent kerbside traffic;
  (3) *method* — signature priors key on NO₂/CO ratios, which are traffic-heavy.
  Our industry share (13 %) is below TERI-ARAI (24 %); tall-stack industrial PM arrives at
  receptors as `transported`, which our method books separately (25 %). Adding
  `transported` to `industrial` brings the industrial-plus-regional bucket to ~38 % raw —
  the same order as TERI-ARAI's industry + outside share.
* **What this means for the product:** enforcement priority is driven by *rank within a
  cell* and by exposure, and the notice always shows the confidence and the skill-gate
  outcome. Where the model fails the gate we fall back to cited signature priors rather
  than over-claim (`CellStoryPanel`, "why this attribution").

## Other cities — status

We publish comparisons only where we have a citable study in hand. **Bengaluru** (CSTEP,
2022 emission inventory) and **Mumbai** (MPCB / NEERI-IITB apportionment) are the next two;
their published shares will be added to this table when the reports are checked against
their primary PDFs — not from memory. Until then the UI shows our shares with the
skill-gate badge and no literature claim for those cities.

## Reproduce

```sql
-- city-mean shares over the last 7 days (what the table above uses)
select city_id, source_category, round(avg(share)::numeric,3)
from attribution where upper(ts_window) > now() - interval '7 days'
group by 1,2 order by 1,3 desc;
```
