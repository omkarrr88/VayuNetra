"""Self-computed forecast exposure: how many people the forecast places in bad air.

    people(T, h) = Σ_cells  pop_cell · P(PM2.5_cell,h > T)

P(·) is the calibrated split-conformal exceedance probability stored on every forecast
(ml.forecast.train), so this is an *expectation*, not a head-count from a point forecast.
Population weights are GPW v4.11 per H3 cell where sampled (connectors.population),
otherwise the cited city population spread uniformly over the forecast cells — the
response says which. Person-hours integrate the outlook 24 → 72 h by trapezoid.

Deliberately NOT computed: attributable deaths for a 3-day window (that needs a
concentration-response function on annual means; see ml.impact.quantify for the annual
figures with citations). Exposure, not mortality — stated plainly.
"""
from __future__ import annotations

from typing import Iterable

BANDS = {"very_poor": ("p_over_120", 120.0), "severe": ("p_over_250", 250.0)}
HORIZONS = (24, 48, 72)


def _weights(cells: Iterable[str], pop_by_cell: dict[str, float], city_population: float) -> tuple[dict[str, float], str]:
    cells = list(cells)
    known = {c: pop_by_cell[c] for c in cells if pop_by_cell.get(c)}
    if known and len(known) >= max(2, len(cells) // 2):
        total_known = sum(known.values())
        # cells without a GPW sample get the mean sampled cell population
        mean = total_known / len(known)
        w = {c: known.get(c, mean) for c in cells}
        return w, "gpw411_cells"
    if not cells:
        return {}, "none"
    return {c: city_population / len(cells) for c in cells}, "uniform_city_population"


def compute_exposure(forecasts: list[dict], pop_by_cell: dict[str, float], city_population: float) -> dict:
    """forecasts: rows with h3_cell, horizon_h, value, p_over_120, p_over_250."""
    by_h: dict[int, list[dict]] = {h: [] for h in HORIZONS}
    for r in forecasts:
        h = int(r.get("horizon_h") or 0)
        if h in by_h and r.get("h3_cell"):
            by_h[h].append(r)
    cells = sorted({r["h3_cell"] for rows in by_h.values() for r in rows})
    w, basis = _weights(cells, pop_by_cell, city_population)
    covered = sum(w.values())
    out_h = []
    for h in HORIZONS:
        rows = by_h[h]
        if not rows:
            out_h.append({"horizon_h": h, "n_cells": 0})
            continue
        entry: dict = {"horizon_h": h, "n_cells": len(rows), "calibrated": all(r.get("p_over_120") is not None for r in rows)}
        for band, (col, thr) in BANDS.items():
            exp_people = 0.0
            point_people = 0.0
            for r in rows:
                wt = w.get(r["h3_cell"], 0.0)
                p = r.get(col)
                if p is None:  # no calibration yet -> fall back to point-forecast indicator
                    p = 1.0 if (r.get("value") or 0) > thr else 0.0
                exp_people += wt * float(p)
                point_people += wt * (1.0 if (r.get("value") or 0) > thr else 0.0)
            entry[f"people_{band}"] = round(exp_people)
            entry[f"people_{band}_point"] = round(point_people)
            share = exp_people / covered if covered else None
            entry[f"share_{band}"] = round(share, 4) if share is not None else None
            # city-scale extrapolation: monitored cells taken as representative of the city
            entry[f"people_{band}_city_scaled"] = round(share * city_population) if share is not None else None
        # population-weighted mean forecast
        num = sum(w.get(r["h3_cell"], 0.0) * float(r.get("value") or 0) for r in rows)
        entry["pop_weighted_pm25"] = round(num / covered, 1) if covered else None
        out_h.append(entry)
    # person-hours in band over the 24→72 h outlook (trapezoid between horizons)
    ph, ph_city = {}, {}
    for band in BANDS:
        for key, store in ((f"people_{band}", ph), (f"people_{band}_city_scaled", ph_city)):
            vals = [(e["horizon_h"], e.get(key)) for e in out_h if e.get(key) is not None]
            total = 0.0
            for (h0, p0), (h1, p1) in zip(vals, vals[1:]):
                total += (p0 + p1) / 2 * (h1 - h0)
            store[band] = round(total) if len(vals) >= 2 else None
    return {
        "population_basis": basis,
        "population_covered": round(covered),
        "horizons": out_h,
        "person_hours_24_to_72h": ph,
        "person_hours_24_to_72h_city_scaled": ph_city,
        "city_population": city_population,
        "method": "expected people = Σ pop_cell × calibrated P(PM2.5 > band) over monitored cells; city-scaled = share × city population (monitored cells taken as representative); person-hours by trapezoid across 24/48/72 h; exposure, not mortality",
    }
