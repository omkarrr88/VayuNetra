"""Agent 5 - Multi-City Comparative Intelligence.

Stage-2 (E7): each city card also carries its annual PM2.5 health burden
(premature deaths/yr + ₹) so cities are comparable by *impact*, not just AQI —
computed from cited long-term CRF × cited city population/PM2.5 (ml.impact).
"""
from __future__ import annotations

from collections import Counter

from ml.impact import city_roi
from ml.impact import factors as impact_factors


def average(rows: list[dict], key: str) -> float:
    vals = [float(r[key]) for r in rows if r.get(key) is not None]
    return round(sum(vals) / len(vals), 2) if vals else 0.0


def dominant_source(rows: list[dict]) -> str:
    if not rows:
        return "unknown"
    counts = Counter(r.get("dominant_source", "unknown") for r in rows)
    return counts.most_common(1)[0][0]


def trend_label(forecast_pm25: float, current_pm25: float) -> str:
    delta = forecast_pm25 - current_pm25
    if delta >= 15:
        return "deteriorating"
    if delta <= -15:
        return "improving"
    return "stable"


def playbook_for(source: str, trend: str) -> list[str]:
    if source == "construction_dust":
        return ["pre-wet exposed soil", "inspect large construction sites", "route debris trucks away from schools"]
    if source == "traffic":
        return ["stagger freight windows", "increase bus priority on high-NO2 corridors", "deploy anti-idling checks"]
    if source == "industrial":
        return ["verify consent-to-operate limits", "inspect stack controls", "schedule night-time SO2 spot checks"]
    if trend == "deteriorating":
        return ["pre-position field team", "push citizen advisory", "refresh source attribution in 1 hour"]
    return ["maintain monitoring", "compare against similar H3 signatures", "keep advisory ready"]


def build_comparison(
    cities: list[dict],
    aqi_rows: list[dict],
    forecast_rows: list[dict],
    rec_status_rows: list[dict] | None = None,
) -> dict:
    cards = []
    status_by_city: dict[str, Counter] = {}
    for r in rec_status_rows or []:
        status_by_city.setdefault(r.get("city_id", ""), Counter())[r.get("status") or "proposed"] += 1
    for city in cities:
        cid = city["city_id"]
        city_aqi = [r for r in aqi_rows if r.get("city_id") == cid]
        city_fc = [r for r in forecast_rows if r.get("city_id") == cid and int(r.get("horizon_h", 24)) == 24]
        current_pm25 = average(city_aqi, "pm25")
        forecast_pm25 = average(city_fc, "value") or current_pm25
        source = dominant_source(city_aqi)
        trend = trend_label(forecast_pm25, current_pm25)
        # E7: annual health burden for this city (cited long-term CRF + population).
        pop = impact_factors.population_for(cid)
        annual = impact_factors.annual_pm25_for(cid)
        roi = city_roi(cid, annual_pm25=annual.value, population=pop.value)
        cards.append({
            "city_id": cid,
            "name": city["name"],
            "current_pm25": current_pm25,
            "forecast_24h_pm25": forecast_pm25,
            "trend": trend,
            "dominant_source": source,
            "signature_match": "construction-winter" if source == "construction_dust" else f"{source}-signature",
            "playbook": playbook_for(source, trend),
            # Compliance posture: real enforcement-rec statuses. Honest zero
            # state — no real-world intervention has been dispatched yet.
            "compliance": {
                "total": sum(status_by_city.get(cid, Counter()).values()),
                **{k: status_by_city.get(cid, Counter()).get(k, 0)
                   for k in ("proposed", "approved", "dispatched", "dismissed")},
            },
            "health": {
                "annual_pm25": roi["annual_pm25"],
                "attributable_deaths_per_year": roi["attributable_deaths_per_year"],
                "annual_health_burden_inr": roi["annual_health_burden_inr"],
            },
        })
    return {
        "summary": {
            "cities_compared": len(cards),
            "highest_risk_city": max(cards, key=lambda r: r["forecast_24h_pm25"])["city_id"] if cards else None,
            "highest_burden_city": max(
                cards, key=lambda r: r["health"]["attributable_deaths_per_year"])["city_id"] if cards else None,
            # computed from the live dominant sources, not a canned line
            "shared_pattern": (
                " · ".join(
                    f"{c['name']}: {str(c['dominant_source']).replace('_', ' ')}" for c in cards
                )
                or "no live attribution yet"
            ),
            "impact_basis": "annual burden via long-term CRF (WHO HRAPIE / Chen & Hoek 2020) "
                            "× cited city population & annual PM2.5 (UN WUP 2018, IQAir 2023)",
        },
        "cities": cards,
    }
