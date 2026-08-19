"""Agent 1 Attribution runner.  ARCHITECTURE.md §9.1; PLAN §2A/§3A.

Builds each cell's source shares -> writes the `attribution` table (one row per
cell × source_category, the long format the blame map reads).

Primary method: hybrid GBM+SHAP apportionment blended with chemical-signature
priors (ml.attribution.shap_attribution). Falls back to pure signature priors
when a city's history is too thin to train on.

  python -m ml.attribution.attribute --city delhi                 # compute + print
  python -m ml.attribution.attribute --city delhi --write         # also write to Supabase
  python -m ml.attribution.attribute --city delhi --signature-only  # skip the GBM
"""
from __future__ import annotations

import argparse
from datetime import timedelta

import pandas as pd

from core.supa import client, load_measurements

from .signatures import calibrate_references, signature_shares

POLLUTANTS = ["pm25", "pm10", "no2", "so2", "co", "o3", "fire", "no2_sat"]
METHOD = "signature-v1"
METHOD_HYBRID = "hybrid-gbm-shap-v2"
METHOD_SHRUNK = "signature-citymean-v1"
SHRINK_WEIGHT = 0.5   # marker-less cells: 50% city hybrid mean + 50% own signature


def latest_pollutants(long_df: pd.DataFrame) -> tuple[dict[str, dict], pd.Timestamp]:
    """Per-cell dict of the most recent value for each pollutant + the overall window end."""
    df = long_df[long_df["variable"].isin(POLLUTANTS)].copy()
    df["ts"] = pd.to_datetime(df["ts"], utc=True)
    latest = df.sort_values("ts").groupby(["h3_cell", "variable"]).tail(1)
    per_cell = {
        cell: dict(zip(g["variable"], g["value"]))
        for cell, g in latest.groupby("h3_cell")
    }
    return per_cell, df["ts"].max()


def build_rows(
    city_id: str, per_cell: dict[str, dict], window_end: pd.Timestamp, refs: dict | None = None
) -> list[dict]:
    lo = (window_end - timedelta(hours=1)).isoformat()
    ts_window = f"[{lo},{window_end.isoformat()})"   # PostgREST tstzrange literal
    rows: list[dict] = []
    for cell, vals in per_cell.items():
        shares, confidence, evidence = signature_shares(vals, refs)
        for category, share in shares.items():
            rows.append({
                "city_id": city_id, "h3_cell": cell, "ts_window": ts_window,
                "source_category": category, "share": share, "confidence": confidence,
                "method_version": METHOD, "evidence": evidence,
            })
    return rows


def _apply_hybrid(
    rows: list[dict], long_df: pd.DataFrame, per_cell: dict[str, dict], refs: dict
) -> tuple[list[dict], str]:
    """Upgrade signature rows to hybrid GBM+SHAP shares where trainable."""
    from .shap_attribution import apportion_cells, build_wide

    sig_by_cell = {cell: signature_shares(vals, refs)[0] for cell, vals in per_cell.items()}
    wide = build_wide(long_df)
    hybrid, r2 = apportion_cells(wide, sig_by_cell)

    # City-level hybrid mean: the shrinkage target for cells without local markers.
    # A fixed "transported" baseline made every sensor-less cell identical; shrinking
    # toward the city's ML apportionment (modulated by each cell's own satellite/ratio
    # signature) is both more defensible and spatially varied.
    from .signatures import CATEGORIES
    city_mean = {
        c: sum(ap.shares.get(c, 0.0) for ap in hybrid.values()) / len(hybrid)
        for c in CATEGORIES
    }

    upgraded: list[dict] = []
    for row in rows:
        cell = row["h3_cell"]
        ap = hybrid.get(cell)
        if ap is None:
            sig_share = row["share"]
            shrunk = SHRINK_WEIGHT * city_mean.get(row["source_category"], 0.0) + (1 - SHRINK_WEIGHT) * sig_share
            upgraded.append({
                **row,
                "share": round(shrunk, 4),
                "method_version": METHOD_SHRUNK,
                "evidence": {**row["evidence"], "shrunk_toward": "city_hybrid_mean"},
            })
            continue
        upgraded.append({
            **row,
            "share": ap.shares.get(row["source_category"], 0.0),
            "confidence": ap.confidence,
            "method_version": METHOD_HYBRID,
            "evidence": {**row["evidence"], "shap_drivers": ap.shap_drivers, "model_r2": round(r2, 3)},
        })

    # renormalise + recompute confidence for the shrunk cells (signature semantics)
    by_cell: dict[str, list[dict]] = {}
    for r in upgraded:
        if r["method_version"] == METHOD_SHRUNK:
            by_cell.setdefault(r["h3_cell"], []).append(r)
    for cell_rows in by_cell.values():
        total = sum(r["share"] for r in cell_rows) or 1.0
        for r in cell_rows:
            r["share"] = round(r["share"] / total, 4)
        conf = round(min(0.95, max(0.30, max(r["share"] for r in cell_rows))), 3)
        for r in cell_rows:
            r["confidence"] = conf

    n_upgraded = len({r["h3_cell"] for r in upgraded if r["method_version"] == METHOD_HYBRID})
    print(f"  hybrid GBM+SHAP: upgraded {n_upgraded} cells (holdout R2={r2:.2f}); "
          f"{len(by_cell)} marker-less cells shrunk toward city mean")
    return upgraded, METHOD_HYBRID


def run(city_id: str, write: bool = False, signature_only: bool = False) -> None:
    long_df = pd.DataFrame(load_measurements(city_id))
    # data-driven marker scales (p90) so blame tracks current conditions, not a fixed season
    pdf = long_df[long_df["variable"].isin(POLLUTANTS)]
    refs = calibrate_references({var: g["value"].tolist() for var, g in pdf.groupby("variable")})
    per_cell, window_end = latest_pollutants(long_df)
    rows = build_rows(city_id, per_cell, window_end, refs)
    method = METHOD

    if not signature_only:
        try:
            rows, method = _apply_hybrid(rows, long_df, per_cell, refs)
        except Exception as e:  # noqa: BLE001 — thin data / SHAP issues -> honest fallback
            # Record WHY on every row, not just on stdout. The abstain is one of the more defensible
            # things this system does — a model with no out-of-sample skill declining to assign ML
            # blame — but until now the reason lived only in a log line, so a reader seeing
            # "signature-v1" could not tell whether the hybrid was unavailable, untrustworthy, or
            # simply never attempted.
            reason = str(e)
            print(f"  hybrid unavailable ({reason}); using signature priors")
            for r in rows:
                ev = r.get("evidence")
                if isinstance(ev, dict):
                    ev["fallback_reason"] = reason

    print(f"{city_id}: {len(per_cell)} cells -> {len(rows)} attribution rows (method={method})")
    by_cell: dict[str, list[dict]] = {}
    for r in rows:
        by_cell.setdefault(r["h3_cell"], []).append(r)
    for cell, cell_rows in list(by_cell.items())[:3]:
        top = max(cell_rows, key=lambda r: r["share"])
        print(f"  {cell}: dominant={top['source_category']} ({top['share']:.0%}) conf={top['confidence']}")

    if write:
        client().table("attribution").delete().eq("city_id", city_id).execute()
        client().table("attribution").insert(rows).execute()
        print(f"wrote {len(rows)} attribution rows")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="delhi")
    ap.add_argument("--write", action="store_true", help="write to Supabase")
    ap.add_argument("--signature-only", action="store_true", help="skip the GBM+SHAP upgrade")
    args = ap.parse_args()
    run(args.city, write=args.write, signature_only=args.signature_only)


if __name__ == "__main__":
    main()
