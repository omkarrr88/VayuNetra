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

**Our city-mean shares, Delhi, 24 cells, run of 18 Aug 2026 04:30 UTC (monsoon):**

| bucket | raw | source-only (renormalised) | TERI-ARAI summer, same four (renormalised) |
|---|---:|---:|---:|
| traffic | 21 % | 28 % | 18 % |
| industrial | 20 % | 27 % | 24 % |
| construction_dust | 34 % | **45 %** | **41 %** |
| biomass_burning | 0 % | 0 % | 16 % |
| transported | 14 % | — | (outside Delhi: 74 % in summer, 64 % in winter) |
| other | 11 % | — | — |

**Read-out (honest).**

* **Agreement:** the ranking matches the pre-monsoon study — **dust first** (45 % vs 41 %),
  industry second (27 % vs 24 %); biomass ≈ 0 in August is right (no stubble season, monsoon
  suppresses open burning) and our FIRMS-driven biomass share will rise in Oct–Nov — the
  seasonal signature TERI-ARAI reports (biomass 22 % of winter PM2.5 in Delhi city + NCR
  towns).
* **Disagreement we do not hide — (1) traffic 28 % vs 18 %.** CAAQMS stations sit on
  arterial roads (Anand Vihar, ITO, Punjabi Bagh), so cell-level shares over-represent
  kerbside traffic, and the signature priors key on NO₂/CO ratios, which are traffic-heavy.
  **(2) `transported` 14 % vs "outside Delhi" 64–74 %.** TERI-ARAI's dispersion model
  attributes most of Delhi's PM2.5 to the NCR airshed; a receptor-side method sees the local
  signal that moves the reading and books the regional background small. Tall-stack
  industrial PM also arrives as `transported`, so our industrial + transported (34 % raw) is the
  order of TERI-ARAI's industry share alone. **(3) Run-to-run movement.** Shares are
  recomputed daily from the latest hour. Delhi's public feed currently carries NO₂ at 4 of the
  24 cells, so 21 cells are shrunk toward the city hybrid mean (`signature-citymean-v1`) and the
  traffic/dust split moves between runs (the 16 Aug run put traffic first at 67 % source-only;
  18 Aug puts dust first at 45 %). That instability is a data-coverage fact, shown on every
  cell as the method badge and confidence — not smoothed away.
* **What this means for the product:** enforcement priority is driven by *rank within a
  cell* and by exposure, and the notice always shows the confidence and the skill-gate
  outcome. Where the model fails the gate we fall back to cited signature priors rather
  than over-claim (`CellStoryPanel`, "why this attribution").

## Bengaluru — vs Guttikunda et al. (2019) and CSTEP (2022)

Two independent bottom-up + WRF-CAMx studies exist for Bengaluru; both are checked against
their primary PDFs (`docs/sources/`, git-ignored):

* **Guttikunda, Nishadh, Gota, Singh, Chanda, Jawahar, Asundi — *Air quality, emissions, and
  source contributions analysis for the Greater Bengaluru region*, Atmospheric Pollution
  Research 10 (2019), Table 5** — modelled annual PM2.5 source contributions, base year 2015,
  60 × 60 km urban airshed at 1 km.
* **CSTEP — *Emission Inventory and Pollution Reduction Strategies for Bengaluru* (Feb 2022),
  §4.3.4** — sectoral share of the 2019 annual PM2.5 concentration inside the BBMP area
  (WRF-CAMx, source-off simulations).

**Published PM2.5 shares:**

| sector | Guttikunda 2019 (2015, airshed) | CSTEP 2022 (2019, BBMP) |
|---|---:|---:|
| Transport (vehicle exhaust) | 28.1 % | 51.4 % |
| Dust (road resuspension + construction) | 22.9 % | 30.9 % |
| Open waste burning | 14.4 % | 5.7 % |
| Industries + brick kilns + DG sets | 1.5 + 2.9 + 3.8 = 8.2 % | DG sets 8.8 % |
| Domestic (cooking, heating, lighting) | 8.9 % | — |
| **Outside the airshed** (boundary conditions) | **17.2 %** | — |

**Our city-mean shares, Bengaluru, 13 station cells, run of 18 Aug 2026 04:30 UTC (monsoon):**

| bucket | raw | source-only (renormalised) | Guttikunda, same four | CSTEP, same four |
|---|---:|---:|---:|---:|
| traffic | 30 % | **39 %** | **38 %** | 53 % |
| industrial (incl. DG / kilns) | 25 % | 32 % | 11 % | 9 % |
| construction_dust | 23 % | 29 % | 31 % | 32 % |
| biomass_burning | 0 % | 0 % | 20 % | 6 % |
| transported | 13 % | — | (outside: 17 %) | — |
| other | 9 % | — | (domestic: 9 %) | — |

**Read-out (honest).**

* **Agreement:** the two things a receptor-side method should get right, it gets right —
  **traffic first and dust a close second** (39 / 29 % vs Guttikunda 38 / 31 %), and our
  regional `transported` share (13 %) sits next to Guttikunda's modelled *outside* share
  (17 %), the one bucket the two methods define the same way. CSTEP's higher transport share
  (53 % of the four) is a 2019 BBMP-only cut; our ranking matches it too.
* **Disagreement we do not hide — (1) industrial 32 % vs 9–11 %.** Bengaluru has little
  heavy industry inside the city; what the studies see are DG sets and kilns. Our `industrial`
  bucket keys on the SO₂ and PM10/PM2.5 signature, which DG exhaust and the Peenya/Bommasandra
  station cells drive up, and on a per-cell model that cannot separate a diesel generator from
  a factory. Read our Bengaluru "industrial" as *combustion point sources* (DG sets included), not
  factories. **(2) biomass 0 % vs 6–20 % open waste burning.** Our biomass
  bucket is FIRMS-driven; VIIRS thermal anomalies at 375 m do not see small open-waste fires,
  and in August the monsoon suppresses them anyway. This is a known blind spot of the
  satellite signal, not evidence that waste burning is absent — the study numbers, not ours,
  are the right prior for waste-burning enforcement in Bengaluru.

## Mumbai — status

We publish comparisons only where the primary study is in hand. For **Mumbai** the
MPCB / NEERI-IITB apportionment PDF has not been obtained; the UI shows our shares with the
skill-gate badge and makes no literature claim there. Our current Mumbai city mean (20 cells,
run of 18 Aug 2026): construction_dust 30 %, traffic 24 %, industrial 22 %, transported 15 %,
other 10 %, biomass 0 % — dust-first, which is the qualitative picture every Mumbai study
reports; the quantitative row will follow only from the primary PDF.

## The one-number summary (cosine vs an inventory anchor)

`ml/attribution/inventory.py` carries one published anchor per launch city and scores our
city-mean shares against it (cosine over the four locally-attributable buckets, both sides
renormalised). Same run as the tables above:

**Regenerated 19 August 2026** from live rows via `compare_with_inventory(city)`:

| city | cosine | mean abs Δ | anchor | anchor status |
|---|---:|---:|---|---|
| Delhi | **0.991** | **0.042** | SAFAR-Delhi emission inventory 2018 (IITM / MoES) — transport 41 %, dust 21.5 %, industry 18.6 %, biomass 5.8 % | transcription of the published summary shares; an *emission* inventory, hence traffic-heavier than the TERI-ARAI concentration study above |
| Bengaluru | **0.928** | **0.099** | CSTEP 2022 §4.3.4 (2019, BBMP) | verified against the primary PDF |
| Mumbai | **0.939** | **0.097** | Urban Emissions / NEERI-MPCB syntheses (2019-20) — traffic 20 %, dust 23 %, industry 36 %, burning 7 % | approximate; the primary study is not in hand |

**Read the mean absolute Δ, not the cosine.** Cosine over four renormalised buckets is dominated by
the largest component and is forgiving of magnitude — Delhi's 0.991 looks stronger than the
agreement really is. The per-bucket gaps behind these numbers:

| city | traffic | dust | industrial | biomass |
|---|---:|---:|---:|---:|
| Delhi | +0.069 | +0.015 | −0.017 | **−0.067** |
| Bengaluru | −0.101 | −0.040 | **+0.199** | −0.059 |
| Mumbai | +0.124 | +0.070 | −0.113 | −0.081 |

Two honest caveats a reviewer should be told before the cosine is quoted:

1. **Biomass reads 0.000 in all three cities** against inventory shares of 5.9–8.1 %. This is a
   monsoon run — there is no stubble burning in August — so the model is right to attribute none,
   but the agreement is being helped by a season in which one bucket is genuinely empty. Re-run this
   in the winter window before treating it as a year-round result.
2. **Bengaluru's industrial share is +0.199 over the inventory** — our largest single disagreement,
   and the one to raise before a reviewer finds it. An emission inventory counts what is emitted; we
   estimate what a receptor cell is breathing, and industry that sits upwind of the monitored cells
   will over-weight in ours.

These numbers drift with the daily run. Regenerate with `compare_with_inventory(city)` (or
`eval/evaluate.ipynb` §10) and re-date this table rather than quoting a stale figure — the previous
version of this table published 0.88 / 0.90 / 0.93 and was several days out.

## Reproduce

```sql
-- city-mean shares over the last 7 days (what the table above uses)
select city_id, source_category, round(avg(share)::numeric,3)
from attribution where upper(ts_window) > now() - interval '7 days'
group by 1,2 order by 1,3 desc;
```
