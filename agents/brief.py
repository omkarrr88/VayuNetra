"""Officer morning brief — one page per city, generated from stored model output.

    build_brief(city_id) -> dict            (JSON for the console card / API)
    render_brief_text(brief) -> str         (Telegram / plain text, the PDF renderer's format)

Deliberately LLM-free: every line is a template over rows that already exist — latest
measurements, forecasts (with their calibrated exceedance probabilities), the enforcement
worklist, intervention tracking and advisories. That is the point of the artefact: a
commissioner reads the same numbers the console shows, with the same provenance.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from core.wards import place_for_cell

ONSET_TAU = 0.3          # alarm operating point on the calibrated P(> 120 µg/m³)
BANDS = [(0, 30, "Good"), (30, 60, "Satisfactory"), (60, 90, "Moderate"), (90, 120, "Poor"), (120, 250, "Very Poor"), (250, 1e9, "Severe")]


def _band(pm25: float | None) -> str:
    if pm25 is None:
        return "–"
    for lo, hi, name in BANDS:
        if lo <= pm25 < hi:
            return name
    return "Severe"


def _mean(xs: list[float | None]) -> float | None:
    v = [float(x) for x in xs if x is not None]
    return round(sum(v) / len(v), 1) if v else None


def _place(city_id: str, cell: str | None) -> str:
    if not cell:
        return "–"
    p = place_for_cell(city_id, cell)
    return p["label"] if p else f"cell {cell[-4:]}"


def _short_source(rationale: str) -> str:
    r = (rationale or "").lower()
    if "construction" in r or "dust" in r:
        return "Construction dust"
    if "industr" in r:
        return "Industrial emissions"
    if "burn" in r or "biomass" in r or "waste" in r:
        return "Waste / biomass burning"
    if "traffic" in r or "vehic" in r or "diesel" in r:
        return "Traffic"
    return "Pollution source"


def build_brief(
    city_id: str,
    city_name: str,
    *,
    measurements: list[dict],
    forecasts: list[dict],
    recs: list[dict],
    interventions: list[dict],
    advisories: list[dict],
    now: datetime | None = None,
    notice_url: Callable[[int], str] | None = None,
) -> dict:
    """Pure function over already-loaded rows (the API loads them; tests pass fixtures)."""
    now = now or datetime.now(timezone.utc)
    day = timedelta(days=1)

    # --- air now vs yesterday (city mean of station cells) -------------------------
    def _rows_between(a: datetime, b: datetime) -> list[dict]:
        out = []
        for r in measurements:
            ts = r.get("ts")
            try:
                t = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
            except (TypeError, ValueError):
                continue
            if a <= t < b:
                out.append(r)
        return out

    # anchor the "now" window on the latest reading actually available — smaller cities are
    # ingested less often, and a stale-but-real number with its age beats "no readings"
    t_last = None
    for r in measurements:
        try:
            t = datetime.fromisoformat(str(r.get("ts")).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            continue
        if t_last is None or t > t_last:
            t_last = t
    anchor = t_last if (t_last is not None and t_last < now - timedelta(hours=6)) else now
    stale_h = round((now - t_last).total_seconds() / 3600, 1) if t_last is not None else None
    last6 = _rows_between(anchor - timedelta(hours=6), anchor + timedelta(minutes=1))
    yday6 = _rows_between(anchor - day - timedelta(hours=6), anchor - day + timedelta(minutes=1))
    now_mean = _mean([r.get("value") for r in last6])
    yday_mean = _mean([r.get("value") for r in yday6])
    latest_by_cell: dict[str, float] = {}
    for r in sorted(last6, key=lambda r: str(r.get("ts")), reverse=True):
        if r.get("h3_cell") and r.get("value") is not None:
            latest_by_cell.setdefault(r["h3_cell"], float(r["value"]))
    worst_cell = max(latest_by_cell.items(), key=lambda kv: kv[1]) if latest_by_cell else None
    change = (round(now_mean - yday_mean, 1) if now_mean is not None and yday_mean is not None else None)

    # --- onsets: cells the forecast puts over Very Poor with P >= tau at any horizon -----
    by_cell: dict[str, dict[int, dict]] = defaultdict(dict)
    for f in forecasts:
        if f.get("h3_cell") and f.get("horizon_h"):
            by_cell[f["h3_cell"]][int(f["horizon_h"])] = f
    onsets = []
    for cell, hz in by_cell.items():
        best_h, best_p, best_v = None, 0.0, None
        for h, f in sorted(hz.items()):
            p = f.get("p_over_120")
            if p is not None and float(p) >= ONSET_TAU and float(p) > best_p:
                best_h, best_p, best_v = h, float(p), f.get("value")
        cur = latest_by_cell.get(cell)
        if best_h is not None and (cur is None or cur <= 120):
            onsets.append({"h3_cell": cell, "place": _place(city_id, cell), "horizon_h": best_h,
                           "p_over_120": round(best_p, 2), "forecast_pm25": round(float(best_v), 0) if best_v is not None else None,
                           "now_pm25": cur})
    onsets.sort(key=lambda o: (-o["p_over_120"], o["horizon_h"]))
    fc24 = [f for f in forecasts if int(f.get("horizon_h") or 0) == 24 and f.get("value") is not None]
    outlook24 = _mean([f["value"] for f in fc24])

    # --- top actions: proposed/approved recs by priority ------------------------------
    open_recs = [r for r in recs if (r.get("status") or "proposed") in ("proposed", "approved")]
    open_recs.sort(key=lambda r: float(r.get("priority_score") or 0), reverse=True)
    actions = []
    seen_cells: set[str] = set()
    for r in open_recs:
        cell = r.get("h3_cell")
        if cell in seen_cells:
            continue
        seen_cells.add(cell)
        actions.append({
            "rec_id": r.get("id"),
            "place": _place(city_id, cell),
            "source": _short_source(r.get("rationale") or ""),
            "contribution_pct": round(float(r.get("contribution") or 0) * 100),
            "pop_exposed": int(r.get("pop_exposed") or 0),
            "status": r.get("status") or "proposed",
            "notice_url": notice_url(int(r["id"])) if (notice_url and r.get("id") is not None) else None,
        })
        if len(actions) == 3:
            break

    # --- yesterday's outcomes: dispatched recs and their provisional effect ------------
    outcomes = []
    for t in interventions:
        outcomes.append({
            "rec_id": t.get("rec_id"), "place": _place(city_id, t.get("h3_cell")),
            "days": t.get("days_since_dispatch"), "effect_pm25": t.get("effect_pm25"),
            "status": t.get("status"), "note": t.get("note"),
        })

    # --- advisories: worst tier per language ------------------------------------------
    tiers = defaultdict(set)
    langs = set()
    for a in advisories:
        langs.add(a.get("language") or "en")
        tiers[a.get("risk_tier") or "moderate"].add(a.get("ward_id"))
    order = ["severe", "very_poor", "poor", "moderate", "satisfactory", "good"]
    worst_tier = next((t for t in order if t in tiers), None)

    return {
        "city_id": city_id,
        "city_name": city_name,
        "generated_at": now.replace(microsecond=0).isoformat(),
        "air": {
            "now_pm25": now_mean, "now_band": _band(now_mean),
            "yesterday_pm25": yday_mean, "change_pm25": change,
            "worst_cell": {"h3_cell": worst_cell[0], "place": _place(city_id, worst_cell[0]), "pm25": worst_cell[1]} if worst_cell else None,
            "outlook_24h_pm25": outlook24, "outlook_24h_band": _band(outlook24),
            "n_cells": len(latest_by_cell),
            "as_of": t_last.replace(microsecond=0).isoformat() if t_last else None,
            "stale_hours": stale_h,
        },
        "onsets": onsets[:6],
        "onset_tau": ONSET_TAU,
        "actions": actions,
        "open_actions": len(open_recs),
        "outcomes": outcomes[:5],
        "advisories": {"worst_tier": worst_tier, "wards_at_worst": len(tiers.get(worst_tier, [])) if worst_tier else 0, "languages": sorted(langs)},
        "provenance": (
            "Every number here is read from stored measurements, forecasts (with their calibrated exceedance "
            "probabilities), the enforcement worklist, intervention tracking and advisories by deterministic code; "
            "no line is written by a language model."
        ),
    }


def render_brief_text(b: dict, console_url: str | None = None) -> str:
    """Plain-text brief in the TITLE / meta / HEADING: format the PDF renderer understands
    (also what Telegram receives)."""
    a = b["air"]
    date = b["generated_at"][:10]
    L = [
        f"MORNING AIR BRIEF — {b['city_name'].upper()}",
        f"Date: {date}",
        f"City: {b['city_name']}",
        "Prepared by: VayuNetra decision-support system",
        "",
        "AIR RIGHT NOW:",
        (f"City mean PM2.5 {a['now_pm25']} µg/m³ ({a['now_band']})" + (f" as of {a['stale_hours']:.0f} h ago" if (a.get("stale_hours") or 0) > 6 else "")
         if a["now_pm25"] is not None else "No station readings in the last 36 hours.")
        + (f", {'+' if a['change_pm25'] > 0 else ''}{a['change_pm25']} vs the same hours yesterday." if a.get("change_pm25") is not None else "")
        + (f" Worst place: {a['worst_cell']['place']} at {a['worst_cell']['pm25']:.0f} µg/m³." if a.get("worst_cell") else "")
        + (f" 24 h outlook: {a['outlook_24h_pm25']} µg/m³ ({a['outlook_24h_band']})." if a.get("outlook_24h_pm25") is not None else ""),
        "",
        "WHERE THE AIR IS ABOUT TO TURN:",
    ]
    if b["onsets"]:
        for o in b["onsets"]:
            L.append(f"- {o['place']}: P(Very Poor) {int(o['p_over_120']*100)}% at +{o['horizon_h']} h"
                     + (f", forecast {o['forecast_pm25']:.0f} µg/m³" if o.get("forecast_pm25") is not None else "")
                     + (f", now {o['now_pm25']:.0f}" if o.get("now_pm25") is not None else "") + ".")
    else:
        L.append(f"No cell crosses P(Very Poor) ≥ {int(b['onset_tau']*100)}% in the 72 h outlook.")
    L += ["", "TOP ACTIONS TODAY:"]
    if b["actions"]:
        for i, x in enumerate(b["actions"], 1):
            L.append(f"{i}. {x['source']} · {x['place']} — {x['contribution_pct']}% of local PM2.5, ~{x['pop_exposed']:,} residents exposed"
                     + (f" ({x['status']})" if x["status"] != "proposed" else "")
                     + (f". Draft notice: {x['notice_url']}" if x.get("notice_url") else "."))
        if b["open_actions"] > len(b["actions"]):
            L.append(f"+{b['open_actions'] - len(b['actions'])} more in the ranked worklist.")
    else:
        L.append("No open recommendations — nothing above the 2% contribution floor today.")
    L += ["", "YESTERDAY'S DISPATCHES — MEASURED EFFECT:"]
    if b["outcomes"]:
        for o in b["outcomes"]:
            eff = o.get("effect_pm25")
            L.append(f"- {o['place']}: " + (f"{eff:+.1f} µg/m³ vs city drift" if isinstance(eff, (int, float)) else (o.get("note") or "collecting measurements"))
                     + (f" ({o['days']} d since dispatch)" if o.get("days") is not None else "") + ".")
    else:
        L.append("No dispatched intervention is being tracked yet.")
    adv = b["advisories"]
    L += ["", "CITIZEN ADVISORIES:",
          (f"Worst tier {adv['worst_tier'].replace('_', ' ')} in {adv['wards_at_worst']} zone(s); issued in {len(adv['languages'])} language(s): {', '.join(adv['languages'])}."
           if adv.get("worst_tier") else "No advisories issued yet.")]
    if console_url:
        L += ["", "CONSOLE:", console_url]
    L += ["", "PROVENANCE:", b["provenance"]]
    return "\n".join(L)
