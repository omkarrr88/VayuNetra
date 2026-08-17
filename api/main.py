"""VayuNetra API — FastAPI read-API + agent endpoints.

Every endpoint returns the standard {success, data, error, meta} envelope.
In DEMO_MODE (default), all responses are served from demo/fixtures/* so the
frontend works with zero live dependencies.

Run:
    uvicorn api.main:app --reload          # from repo root
    DEMO_MODE=false uvicorn api.main:app   # live Supabase reads
"""
from __future__ import annotations

import base64
import hmac
import json
import logging
import math
import os
import time
import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qsl

from fastapi import FastAPI, Header, HTTPException, Query, Depends, Request, WebSocket, WebSocketDisconnect, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

import core.env  # noqa: F401  (loads .env)
from core.schemas import err, ok

DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
FIXTURES = Path(__file__).resolve().parent.parent / "demo" / "fixtures"

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "info").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("vayunetra.api")


def _server_error(code: str, exc: Exception, user_message: str) -> dict:
    """Log the real exception server-side; return only a generic message to the
    client. Never leak stack traces or internal state (missing env keys, DB
    errors) into an API response or a demo screen."""
    logger.error("%s: %s", code, exc, exc_info=True)
    return err(code, user_message)


# Shared validated city field — lowercase id, bounded length, no injection chars.
# Not a hard 3-city whitelist, so /admin/cities onboarding keeps working.
_CITY = Field("delhi", min_length=1, max_length=40, pattern=r"^[a-z][a-z0-9_-]*$")

app = FastAPI(
    title="VayuNetra API",
    version="1.0.0",
    description=(
        "AI-powered urban air quality intelligence platform. "
        "Multi-agent system: Attribution · Forecast · Enforcement · Advisory · Multi-City."
    ),
)
# Locked to the deployed frontend + local dev; extend via ALLOWED_ORIGINS (comma-separated).
_DEFAULT_ORIGINS = "https://vayunetra-aqi.vercel.app,http://localhost:5173,http://localhost:4173"
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", _DEFAULT_ORIGINS).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _warm_heavy_imports() -> None:
    """Pre-import the heavy ML modules off the request path.

    The first /coverage call pays ~20 s for `import torch` on a cold process — right at the
    frontend's 25 s read timeout, which then shows the "backend waking up" banner even though
    the backend is up. Importing in a daemon thread at startup makes the first real request
    fast; if torch is not installed (lean deploy) this is a no-op.
    """
    import threading

    def _load() -> None:
        for mod in ("torch", "lightgbm"):
            try:
                __import__(mod)
            except Exception:  # noqa: BLE001 — optional dependency
                pass
        # Then pre-compute the dense field for every city into the read cache (live mode only;
        # WARM_ON_START=0 disables it, e.g. for tests). Failures are logged, never raised.
        if DEMO_MODE or os.getenv("WARM_ON_START", "1") == "0":
            return
        try:
            from core.cities import list_city_ids
            for cid in list_city_ids():
                try:
                    _dense_field_cached(cid)
                except Exception as e:  # noqa: BLE001
                    logger.warning("warm coverage failed for %s: %s", cid, e)
        except Exception as e:  # noqa: BLE001
            logger.warning("warm-up skipped: %s", e)

    threading.Thread(target=_load, name="warm-imports", daemon=True).start()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fixture(name: str, default: Any = None) -> Any:
    """Load demo/fixtures/<name>.json, or return default if missing."""
    p = FIXTURES / f"{name}.json"
    if p.exists():
        return json.loads(p.read_text())
    return default if default is not None else []


security = HTTPBearer(auto_error=False)


def _decode_bearer_payload(token: str) -> dict:
    try:
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
        return json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token format")


def _validated_token(credentials: HTTPAuthorizationCredentials | None) -> str | None:
    if DEMO_MODE:
        return None

    token = credentials.credentials if credentials else None
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    payload = _decode_bearer_payload(token)
    role = payload.get("role", "")
    # "anon" is accepted for public read-only dashboard access; PostgREST RLS
    # still governs exactly which rows an anonymous caller may read.
    if role not in ("anon", "authenticated", "service_role", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient role privileges")
    return token


def get_db(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Supabase client using the caller's JWT so PostgREST enforces RLS."""
    if DEMO_MODE:
        return None

    from core.supa import anon_client
    db = anon_client()
    token = _validated_token(credentials)
    db.postgrest.auth(token)
    return db
def fixture_rows(name: str, city: str | None = None, default: Any = None) -> Any:
    """Load a fixture and filter list rows by city_id when available."""
    rows = fixture(name, default)
    if city and isinstance(rows, list):
        city_rows = [r for r in rows if r.get("city_id") == city]
        return city_rows if city_rows else rows
    return rows


def _db():
    """Supabase client for live reads (DEMO_MODE=false). Service-role, server-side only."""
    from core.supa import client
    return client()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health", tags=["system"])
def health() -> dict:
    """Liveness check — also shows DEMO_MODE status."""
    return ok({"status": "ok", "demo_mode": DEMO_MODE, "version": "1.0.0"})


# ---------------------------------------------------------------------------
# Cities
# ---------------------------------------------------------------------------

@app.get("/cities", tags=["data"])
def cities(db=Depends(get_db)) -> dict:
    """List all active cities."""
    if DEMO_MODE:
        return ok(fixture("cities"))
    rows = db.table("cities").select("*").eq("active", True).execute().data
    return ok(rows)


# ---------------------------------------------------------------------------
# AQI
# ---------------------------------------------------------------------------

@app.get("/aqi/current", tags=["data"])
def aqi_current(
    city: str = Query(..., description="City ID, e.g. 'delhi'"),
    db=Depends(get_db)
) -> dict:
    """Latest per-cell AQI measurements for a city."""
    if DEMO_MODE:
        return ok(fixture_rows("aqi_current", city))
    rows = (
        db.table("measurements")
        .select("h3_cell,ts,value,variable,confidence")
        .eq("city_id", city)
        .eq("variable", "pm25")
        .order("ts", desc=True)
        .limit(5000)
        .execute()
        .data
    )
    latest: dict[str, dict] = {}
    for r in rows:
        latest.setdefault(r["h3_cell"], {
            "h3_cell": r["h3_cell"],
            "pm25": r["value"],
            "ts": r["ts"],
            "confidence": r.get("confidence", 1.0),
        })
    return ok(list(latest.values()))


# Trailing PM2.5 history cache — hourly buckets change once an hour at most.
_HISTORY_TTL_S = 600
_history_cache: dict[str, tuple[float, list]] = {}


@app.get("/history", tags=["data"])
def pm25_history(
    city: str = Query("delhi", description="City ID"),
    hours: int = Query(48, ge=6, le=168),
) -> dict:
    """City-mean PM2.5 per hour over the trailing window (real station rows)."""
    if DEMO_MODE:
        data = fixture("history", default={})
        series = data.get(city) if isinstance(data, dict) else None
        return ok({"city_id": city, "series": series or []})
    key = f"{city}:{hours}"
    now = time.time()
    hit = _history_cache.get(key)
    if hit and now - hit[0] < _HISTORY_TTL_S:
        return ok({"city_id": city, "series": hit[1]})
    try:
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        rows = (
            _db().table("measurements").select("ts,value").eq("city_id", city)
            .eq("variable", "pm25").gte("ts", since)
            .order("ts", desc=True).limit(20000).execute().data
        ) or []
        buckets: dict[str, list[float]] = {}
        for r in rows:
            ts = r.get("ts")
            try:
                v = float(r.get("value"))
            except (TypeError, ValueError):
                continue
            if ts and math.isfinite(v):
                buckets.setdefault(str(ts)[:13], []).append(v)  # bucket = YYYY-MM-DDTHH
        series = [
            {"ts": f"{k}:00:00+00:00", "pm25": round(sum(vs) / len(vs), 1), "n": len(vs)}
            for k, vs in sorted(buckets.items())
        ]
        _history_cache[key] = (now, series)
        return ok({"city_id": city, "series": series})
    except Exception as e:  # noqa: BLE001
        return _server_error("history_failed", e, "Could not load PM2.5 history right now.")


# CPCB PM2.5 breakpoints (µg/m³) — the colour bands a layman already knows
_PM25_BANDS = [(30, "good"), (60, "satisfactory"), (90, "moderate"), (120, "poor"), (250, "very_poor")]


def _band(v: float) -> str:
    for hi, name in _PM25_BANDS:
        if v <= hi:
            return name
    return "severe"


@app.get("/history/trend", tags=["data"])
def pm25_trend(
    city: str = Query("delhi", description="City ID"),
    days: int = Query(90, ge=7, le=365),
    cell: Optional[str] = Query(None, description="H3 cell — omit for the city mean"),
) -> dict:
    """Daily PM2.5 history for a city or a single ~1 km² cell, plus a plain-
    language verdict, so anyone can read whether a place is getting better or
    worse. Real station rows only; days with no readings are simply absent.

    Verdict compares the latest 7-day mean with the 7 days that ended 30 days
    earlier (falls back to the first week of the window when history is short)."""
    if DEMO_MODE:
        # Real daily series captured from production (all 10 cities, 30/90/365d)
        # so the offline fallback shows the genuine history — Delhi's winter
        # smog season included — instead of an empty chart on stage.
        fx = fixture("history_trend", default={})
        per_city = fx.get(city) if isinstance(fx, dict) else None
        best_key = str(min((365, 90, 30), key=lambda k: abs(k - days)))
        entry = (per_city or {}).get(best_key) or {}
        return ok({"city_id": city, "cell": cell, "days": days,
                   "series": entry.get("series") or [], "verdict": entry.get("verdict"),
                   "days_of_history": entry.get("days_of_history", 0),
                   "note": "city-level history (offline snapshot)" if cell and entry else None})
    key = f"trend:{city}:{cell or '*'}:{days}"
    now = time.time()
    hit = _history_cache.get(key)
    if hit and now - hit[0] < _HISTORY_TTL_S:
        return ok(hit[1])
    try:
        # aggregate in SQL — raw rows through PostgREST cap out long before a
        # year of readings and returned only the newest 2 days
        sdb = _db()
        rows = (sdb.rpc("pm25_daily_trend", {"p_city": city, "p_days": days, "p_cell": cell})
                .execute().data) or []
        proxy_cell = None
        if cell and len(rows) < 10:
            # No station inside this ~1 km² cell — use the nearest cell that has
            # one (H3 ring search, ≤3 rings ≈ 3 km) and SAY so, rather than
            # showing an empty chart for a place the model still attributes.
            try:
                import h3 as _h3

                # distinct measured cells for the city (the attribution table is
                # the cheap, complete index of them)
                measured = {r["h3_cell"] for r in (
                    sdb.table("attribution").select("h3_cell").eq("city_id", city)
                    .limit(5000).execute().data or []) if r.get("h3_cell")}
                measured.discard(cell)
                own_rows = rows
                proxy_dist = None
                # nearest first, up to ~12 km — Delhi's monitors are sparse at the fringe
                for dist, cand in sorted((_h3.grid_distance(cell, m), m) for m in measured):
                    if dist > 12:
                        break
                    cand_rows = (sdb.rpc("pm25_daily_trend", {"p_city": city, "p_days": days, "p_cell": cand})
                                 .execute().data) or []
                    if len(cand_rows) >= 10:
                        rows, proxy_cell, proxy_dist = cand_rows, cand, dist
                        break
                if proxy_cell is None:
                    rows = own_rows  # keep whatever little the cell has
            except Exception:  # noqa: BLE001 — fallback is best-effort
                proxy_cell = None
                proxy_dist = None
        else:
            proxy_dist = None
        series = []
        for r in rows:
            try:
                v = float(r.get("pm25"))
            except (TypeError, ValueError):
                continue
            if r.get("day") and math.isfinite(v):
                series.append({"date": str(r["day"])[:10], "pm25": round(v, 1),
                               "n": int(r.get("n") or 0), "band": _band(v)})
        series.sort(key=lambda p: p["date"])
        verdict = None
        if len(series) >= 10:
            recent = [p["pm25"] for p in series[-7:]]
            older_pool = series[:-7]
            # the week ending ~30 days before the latest point, else the first week
            older = [p["pm25"] for p in older_pool[-37:-30]] if len(older_pool) >= 37 else [p["pm25"] for p in older_pool[:7]]
            if recent and older:
                r_mean = sum(recent) / len(recent)
                o_mean = sum(older) / len(older)
                pct = round((r_mean - o_mean) / o_mean * 100) if o_mean else 0
                direction = "worse" if pct > 5 else ("better" if pct < -5 else "about the same")
                bands = [p["band"] for p in series[-30:]]
                mode_band = max(set(bands), key=bands.count) if bands else None
                verdict = {
                    "recent_mean": round(r_mean, 1),
                    "earlier_mean": round(o_mean, 1),
                    "change_pct": pct,
                    "direction": direction,
                    "dominant_band_30d": mode_band,
                    "days_of_history": len(series),
                    "text": (f"{'Worse' if direction=='worse' else 'Better' if direction=='better' else 'About the same'} "
                             f"than a month ago ({'+' if pct>0 else ''}{pct}%) · mostly "
                             f"{(mode_band or 'unknown').replace('_',' ')} over the last 30 days"),
                }
        # Anomaly days: > baseline + 1.5 σ (baseline = trailing 14-day median),
        # each with a one-line, data-backed "why" from what we already know.
        anomalies: list[dict] = []
        if len(series) >= 14:
            import statistics as _st

            vals = [p["pm25"] for p in series]
            fires_by_day: dict[str, int] = {}
            try:
                fjson = json.loads((Path(__file__).resolve().parent.parent / "web" / "public" / "fires" / f"{city}.geojson").read_text())
                for f in fjson.get("features", []):
                    d0 = (f.get("properties") or {}).get("date")
                    if d0:
                        fires_by_day[d0] = fires_by_day.get(d0, 0) + 1
            except Exception:  # noqa: BLE001 — layer file is optional
                pass
            for i in range(14, len(series)):
                window = vals[i - 14:i]
                med = _st.median(window)
                sd = _st.pstdev(window) or 1.0
                v = vals[i]
                if v > med + 1.5 * sd and v > 60:
                    d0 = series[i]["date"]
                    why = []
                    nf = fires_by_day.get(d0, 0)
                    if nf:
                        why.append(f"{nf} fire detection{'s' if nf > 1 else ''} in the city that day")
                    try:
                        wd = datetime.fromisoformat(d0).strftime("%A")
                        if wd in ("Sunday",):
                            why.append("a Sunday — not a traffic peak, so likely burning or a regional plume")
                    except ValueError:
                        wd = ""
                    if not why:
                        why.append(f"{round((v / med - 1) * 100)}% above the trailing two-week norm — check wind and upwind sources")
                    anomalies.append({"date": d0, "pm25": v, "baseline": round(med, 1), "why": " · ".join(why)})
        data = {"city_id": city, "cell": cell, "days": days, "series": series, "verdict": verdict,
                "anomalies": anomalies[-8:],
                "days_of_history": len(series), "proxy_cell": proxy_cell,
                "proxy_km": proxy_dist,
                "note": (f"no long station record inside this cell — showing the nearest monitored "
                         f"cell, ~{proxy_dist} km away") if proxy_cell else None}
        _history_cache[key] = (now, data)
        return ok(data)
    except Exception as e:  # noqa: BLE001
        return _server_error("trend_failed", e, "Could not load PM2.5 trend right now.")


_PATCH_TTL_S = 3600
_patch_cache: dict[str, tuple[float, dict]] = {}


@app.get("/sources/{source_id}/patch", tags=["data"])
def source_patch(source_id: int) -> dict:
    """The real Sentinel-2 patch for one emission source (for the map hover
    card). One image per call, cached — the full patch set is ~30 MB and must
    never ride along with /static-layers."""
    if DEMO_MODE:
        return ok({"source_id": source_id, "image_ref": None, "note": "no patch imagery in the offline snapshot"})
    key = str(source_id)
    now = time.time()
    hit = _patch_cache.get(key)
    if hit and now - hit[0] < _PATCH_TTL_S:
        return ok(hit[1])
    try:
        rows = (_db().table("kb_chunks").select("title,image_ref,metadata")
                .eq("modality", "image").eq("metadata->>source_id", key).limit(1).execute().data) or []
        row = next((r for r in rows if r.get("image_ref")), None)
        meta = (row or {}).get("metadata") or {}
        data = {"source_id": source_id,
                "image_ref": (row or {}).get("image_ref"),
                "title": (row or {}).get("title"),
                "placeholder": bool(meta.get("placeholder")),
                "composite_window": meta.get("composite_window")}
        _patch_cache[key] = (now, data)
        return ok(data)
    except Exception as e:  # noqa: BLE001
        return _server_error("patch_failed", e, "Could not load the satellite patch.")


@app.get("/history/cells", tags=["data"])
def pm25_hourly_by_cell(
    city: str = Query("delhi", description="City ID"),
    hours: int = Query(24, ge=6, le=72),
) -> dict:
    """Hourly PM2.5 per monitored cell over the trailing window — the map
    time-scrub ("play the last 24 hours"). Real station readings, hourly means."""
    if DEMO_MODE:
        return ok({"city_id": city, "hours": hours, "frames": [], "note": "offline snapshot has no hourly cell history"})
    key = f"cells:{city}:{hours}"
    now = time.time()
    hit = _history_cache.get(key)
    if hit and now - hit[0] < _HISTORY_TTL_S:
        return ok(hit[1])
    try:
        rows = _db().rpc("pm25_hourly_cells", {"p_city": city, "p_hours": hours}).execute().data or []
        frames: dict[str, dict[str, float]] = {}
        for r in rows:
            try:
                v = float(r.get("pm25"))
            except (TypeError, ValueError):
                continue
            if r.get("hour") and r.get("h3_cell") and math.isfinite(v):
                frames.setdefault(str(r["hour"])[:13], {})[r["h3_cell"]] = round(v, 1)
        data = {"city_id": city, "hours": hours,
                "frames": [{"hour": f"{h}:00:00+00:00", "cells": cells} for h, cells in sorted(frames.items())]}
        _history_cache[key] = (now, data)
        return ok(data)
    except Exception as e:  # noqa: BLE001
        return _server_error("history_cells_failed", e, "Could not load hourly cell history.")


# ---------------------------------------------------------------------------
# Attribution
# ---------------------------------------------------------------------------

@app.get("/attribution", tags=["data"])
def attribution(
    city: str = Query(..., description="City ID"),
    cell: Optional[str] = Query(None, description="H3 cell ID"),
    ward: Optional[str] = Query(None, description="Ward name/ID"),
    ts: Optional[str] = Query(None, description="Timestamp ISO string"),
    db=Depends(get_db)
) -> dict:
    """Per-cell source attribution (the blame map)."""
    if DEMO_MODE:
        data = fixture_rows("attribution", city)
        if cell:
            data = [r for r in data if r.get("h3_cell") == cell]
        return ok(data)

    q = (
        db.table("attribution")
        .select("h3_cell,source_category,share,confidence,evidence,ts_window")
        .eq("city_id", city)
    )
    if cell:
        q = q.eq("h3_cell", cell)
    rows = q.execute().data

    # Reshape: one record per cell with source_shares dict
    cells: dict[str, dict] = {}
    for r in rows:
        c = cells.setdefault(r["h3_cell"], {
            "h3_cell": r["h3_cell"],
            "ts_window": r.get("ts_window"),
            "shares": {},
            "confidence": r.get("confidence"),
            "evidence": r.get("evidence"),
        })
        c["shares"][r["source_category"]] = r["share"]
    return ok(list(cells.values()))


# ---------------------------------------------------------------------------
# Forecast
# ---------------------------------------------------------------------------

@app.get("/forecast", tags=["data"])
def forecast(
    city: str = Query(..., description="City ID"),
    cell: Optional[str] = Query(None, description="H3 cell ID"),
    horizon: int = Query(24, description="Forecast horizon in hours (24/48/72)"),
    db=Depends(get_db)
) -> dict:
    """AQI forecasts with persistence baseline for comparison."""
    if DEMO_MODE:
        data = fixture_rows("forecast", city)
        if cell:
            data = [r for r in data if r.get("h3_cell") == cell]
        if horizon:
            data = [r for r in data if r.get("horizon_h") == horizon]
        return ok(data)

    q = (
        db.table("forecasts")
        .select("h3_cell,issued_at,horizon_h,target_var,value,pi_low,pi_high,persistence_value,model_version,p_over_120,p_over_250,calibration_n")
        .eq("city_id", city)
    )
    if cell:
        q = q.eq("h3_cell", cell)
    if horizon:
        q = q.eq("horizon_h", int(horizon))
    return ok(q.execute().data)


# ---------------------------------------------------------------------------
# Enforcement
# ---------------------------------------------------------------------------

@app.get("/enforcement", tags=["enforcement"])
def enforcement_list(
    city: str = Query(..., description="City ID"),
    date: Optional[str] = Query(None, description="Date filter YYYY-MM-DD"),
    status: Optional[str] = Query(None, description="Status filter: proposed|approved|dispatched"),
    limit: int = Query(50, description="Max results"),
    db=Depends(get_db)
) -> dict:
    """Ranked enforcement worklist for the city."""
    if DEMO_MODE:
        data = fixture_rows("enforcement", city)
        if status:
            data = [r for r in data if r.get("status") == status]
        return ok(data[:limit])

    q = (
        db.table("enforcement_recs")
        .select(
            "id,city_id,h3_cell,ts,source_id,priority_score,contribution,pop_exposed,"
            "rationale,rag_citations,rubric_score,status"
        )
        .eq("city_id", city)
        .order("priority_score", desc=True)
        .limit(limit)
    )
    if date:
        q = q.gte("ts", f"{date}T00:00:00Z").lte("ts", f"{date}T23:59:59Z")
    if status:
        q = q.eq("status", status)
    return ok(q.execute().data)


@app.get("/enforcement/{rec_id}/dossier", tags=["enforcement"])
def enforcement_dossier(rec_id: int, db=Depends(get_db)) -> dict:
    """Full evidence dossier for an enforcement recommendation, with RAG citations.

    Includes: rationale, regulatory citations, rubric score, suggested notice text,
    and (Stage 2, Sejal E6) satellite patch.
    """
    if DEMO_MODE:
        return ok(fixture("dossier", default={"rec_id": rec_id, "citations": [], "satellite_patch": None}))
    from agents.enforcement import build_dossier
    try:
        dossier = build_dossier(rec_id)
        return ok(dossier)
    except Exception as e:
        return _server_error("dossier_error", e, "Failed to build evidence dossier")


@app.get("/enforcement/{rec_id}/notice.pdf", tags=["enforcement"])
def enforcement_notice_pdf(rec_id: int, db=Depends(get_db)) -> Response:
    """Downloadable PDF of the draft enforcement notice (for officer review)."""
    from agents.notice_pdf import notice_pdf_bytes
    if DEMO_MODE:
        dossier = fixture("dossier", default={})
        text = dossier.get("suggested_notice_text") or "ENFORCEMENT NOTICE\n\n(demo mode)"
    else:
        from agents.enforcement import build_dossier
        dossier = build_dossier(rec_id)
        text = dossier.get("suggested_notice_text") or f"ENFORCEMENT NOTICE\n\nRecommendation #{rec_id}"
    patch_image = (dossier.get("satellite_patch") or {}).get("image_ref")
    return Response(
        content=notice_pdf_bytes(
            text,
            image_data_uri=patch_image,
            impact_chart=dossier.get("impact_projection"),
        ),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="notice_{rec_id}.pdf"'},
    )


class StatusBody(BaseModel):
    status: str = Field(..., pattern=r"^(proposed|approved|dispatched|dismissed)$")


_STATUS_EVENTS: list[float] = []


def _status_rate_ok(limit: int = 60, window_s: int = 60) -> bool:
    """Process-local rate limit for officer status changes (a demo console, not a firehose)."""
    now = time.time()
    while _STATUS_EVENTS and now - _STATUS_EVENTS[0] > window_s:
        _STATUS_EVENTS.pop(0)
    if len(_STATUS_EVENTS) >= limit:
        return False
    _STATUS_EVENTS.append(now)
    return True


@app.post("/enforcement/{rec_id}/status", tags=["enforcement"])
def enforcement_update_status(rec_id: int, body: StatusBody, db=Depends(get_db)) -> dict:
    """Update enforcement rec status (approved / dispatched / dismissed)."""
    if DEMO_MODE:
        return ok({"rec_id": rec_id, "status": body.status, "demo": True})

    # Officer action from the console. The caller still needs a valid token (get_db), but
    # the write itself runs server-side with the service role — the anon role is read-only
    # under RLS by design, and this endpoint is rate-limited below.
    if not _status_rate_ok():
        raise HTTPException(status_code=429, detail="too many status changes — slow down")
    sdb = _db()
    upd = sdb.table("enforcement_recs").update({"status": body.status}).eq("id", rec_id).execute()
    if not (upd.data or []):
        raise HTTPException(status_code=404, detail=f"recommendation {rec_id} not found")

    # First real dispatch arms the before/after effect measurement: freeze the
    # cell's trailing-7-day PM2.5 baseline now, so effectiveness is measurable
    # by design the moment an intervention actually happens in the world.
    if body.status == "dispatched":
        try:
            rec = (sdb.table("enforcement_recs").select("city_id,h3_cell")
                   .eq("id", rec_id).limit(1).execute().data or [None])[0]
            if rec:
                since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
                rows = (sdb.table("measurements").select("value")
                        .eq("city_id", rec["city_id"]).eq("variable", "pm25")
                        .eq("h3_cell", rec["h3_cell"]).gte("ts", since)
                        .limit(2000).execute().data or [])
                from core.interventions import mean
                baseline = mean([r.get("value") for r in rows])
                sdb.table("intervention_tracking").upsert(
                    {"rec_id": rec_id, "city_id": rec["city_id"],
                     "h3_cell": rec["h3_cell"], "baseline_pm25": baseline},
                    on_conflict="rec_id",
                ).execute()
        except Exception as e:  # noqa: BLE001 — tracking must never block the status change
            logger.error("intervention tracking arm failed for rec %s: %s", rec_id, e, exc_info=True)
    return ok({"rec_id": rec_id, "status": body.status})


def _interventions_data(city: str) -> dict:
    """Before/after effect tracking for dispatched recs (shared by /interventions and the brief)."""
    from core.interventions import effect_summary, mean

    sdb = _db()
    tracked = (sdb.table("intervention_tracking").select("*")
               .eq("city_id", city).order("dispatched_at", desc=True)
               .limit(20).execute().data or [])
    if not tracked:
        return {"city_id": city, "tracked": [],
                "note": "No real-world intervention dispatched yet — tracking arms automatically at first dispatch."}

    def city_mean(since: str, until: str | None = None) -> float | None:
        q = (sdb.table("measurements").select("value").eq("city_id", city)
             .eq("variable", "pm25").gte("ts", since).limit(5000))
        if until:
            q = q.lte("ts", until)
        return mean([r.get("value") for r in (q.execute().data or [])])

    out = []
    for t in tracked:
        cell_rows = (sdb.table("measurements").select("value")
                     .eq("city_id", city).eq("variable", "pm25")
                     .eq("h3_cell", t["h3_cell"]).gte("ts", t["dispatched_at"])
                     .limit(2000).execute().data or [])
        before7 = (datetime.fromisoformat(str(t["dispatched_at"]).replace("Z", "+00:00"))
                   - timedelta(days=7)).isoformat()
        summary = effect_summary(
            baseline_pm25=t.get("baseline_pm25"),
            cell_after=mean([r.get("value") for r in cell_rows]),
            city_before=city_mean(before7, t["dispatched_at"]),
            city_after=city_mean(t["dispatched_at"]),
            dispatched_at=t["dispatched_at"],
        )
        out.append({"rec_id": t["rec_id"], "h3_cell": t["h3_cell"],
                    "dispatched_at": t["dispatched_at"], **summary})
    return {"city_id": city, "tracked": out}


@app.get("/interventions", tags=["enforcement"])
def interventions(city: str = Query("delhi", description="City ID")) -> dict:
    """Before/after effect tracking for dispatched enforcement recs.

    Honest empty state until the first real-world dispatch; after that, the
    effect is the cell's PM2.5 change minus the city's drift over the same
    window (crude control, disclosed as such).
    """
    if DEMO_MODE:
        return ok({"city_id": city, "tracked": [],
                   "note": "No real-world intervention dispatched yet — tracking arms automatically at first dispatch."})
    try:
        return ok(_interventions_data(city))
    except Exception as e:  # noqa: BLE001
        return _server_error("interventions_failed", e, "Could not load intervention tracking.")


# NCAP action-plan spending heads, keyed by source category — the export maps
# each measured intervention onto the head a city reports against on PRANA.
_NCAP_HEAD = {
    "construction": "C&D dust control",
    "construction_dust": "C&D dust control",
    "industry": "Industrial emission control",
    "industrial": "Industrial emission control",
    "waste_burn": "Solid waste / open-burning control",
    "biomass_burning": "Solid waste / open-burning control",
    "diesel_corridor": "Vehicular emission control",
    "traffic": "Vehicular emission control",
}


@app.get("/interventions/export", tags=["enforcement"])
def interventions_export(city: str = Query("delhi", description="City ID")) -> Response:
    """PRANA-ready evidence export (CSV).

    Every dispatched intervention with its measured before/after effect,
    mapped to the NCAP action-plan head a city reports against — so the
    platform's output drops straight into official NCAP/PRANA reporting
    instead of competing with it.
    """
    tracked = []
    if not DEMO_MODE:
        payload = interventions(city)
        body = payload.body if isinstance(payload, Response) else None
        data = json.loads(body)["data"] if body else (payload.get("data") or {})
        tracked = data.get("tracked") or []

    sdb = None if DEMO_MODE else _db()
    authority = ""
    try:
        from core.cities import load_city as _load_city_cfg

        authority = (_load_city_cfg(city).get("regulatory") or {}).get("authority", "")
    except Exception:
        pass

    lines = ["city,rec_id,h3_cell,source_name,source_category,ncap_head,dispatched_at,"
             "baseline_pm25,after_pm25,effect_vs_city_drift,provisional,reporting_authority"]
    for t in tracked:
        source_name, category = "", ""
        if sdb is not None:
            try:
                rec_rows = (sdb.table("enforcement_recs").select("source_id,evidence")
                            .eq("id", t["rec_id"]).limit(1).execute().data or [])
                if rec_rows and rec_rows[0].get("source_id"):
                    src = (sdb.table("emission_sources").select("name,type")
                           .eq("id", rec_rows[0]["source_id"]).limit(1).execute().data or [])
                    if src:
                        source_name = (src[0].get("name") or "").replace(",", " ")
                        category = src[0].get("type") or ""
            except Exception:  # noqa: BLE001 — one bad row must not kill the export
                pass
        lines.append(",".join(str(v) for v in [
            city, t.get("rec_id"), t.get("h3_cell"), source_name, category,
            _NCAP_HEAD.get(category, "Other"), t.get("dispatched_at"),
            t.get("baseline_pm25"), t.get("after_pm25"), t.get("effect"),
            t.get("provisional"), authority.replace(",", " "),
        ]))
    csv_body = "\n".join(lines) + "\n"
    return Response(
        content=csv_body, media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="ncap_evidence_{city}.csv"'},
    )


# ---------------------------------------------------------------------------
# Advisory
# ---------------------------------------------------------------------------

@app.get("/advisory", tags=["advisory"])
def advisory(
    city: str = Query(..., description="City ID"),
    ward: Optional[str] = Query(None, description="Ward name/ID"),
    lang: str = Query("en", description="Language code: en|hi|kn|mr|ta|te|bn|gu"),
    db=Depends(get_db)
) -> dict:
    """Ward-level citizen health advisories in specified language."""
    if DEMO_MODE:
        data = fixture_rows("advisory", city)
        if ward:
            data = [r for r in data if r.get("ward_id") == ward]
        if lang:
            data = [r for r in data if not r.get("language") or r.get("language") == lang]
        return ok(data)

    q = (
        db.table("advisories")
        .select("*")
        .eq("city_id", city)
        .order("issued_at", desc=True)
        .limit(100)
    )
    if ward:
        q = q.eq("ward_id", ward)
    if lang:
        q = q.eq("language", lang)
    return ok(q.execute().data)


# In-memory broadcast throttle: the button is on a public page, so cap real-world
# side effects (Telegram messages / phone calls) to one broadcast per window.
_BROADCAST_WINDOW_S = 300
_last_broadcast: dict[str, float] = {}


# ---------------------------------------------------------------------------
# Citizen reports — the complaint loop (photo -> candidate source -> SLA)
# ---------------------------------------------------------------------------

_REPORT_WINDOW_S = 60           # one report per client-IP per minute
_last_report: dict[str, float] = {}
_REPORT_CATEGORIES = {"waste_burning", "construction_dust", "industrial_smoke",
                      "vehicle_smoke", "other"}
# citizen category -> emission_sources type, used when an officer verifies
_REPORT_SOURCE_TYPE = {
    "waste_burning": "waste_burn",
    "construction_dust": "construction",
    "industrial_smoke": "industry",
    "vehicle_smoke": "diesel_corridor",
    "other": "industry",
}
_MAX_PHOTO_BYTES = 4_000_000


@app.post("/report", tags=["citizen"])
async def submit_report(request: Request) -> dict:
    """Citizen pollution report: multipart form with lat/lng/category and an
    optional photo. Public endpoint (rate-limited); the report enters the
    enforcement funnel as a candidate source once an officer verifies it."""
    ip = (request.client.host if request.client else "?")
    now_s = time.time()
    if now_s - _last_report.get(ip, 0) < _REPORT_WINDOW_S:
        return err("rate_limited", "One report per minute — please retry shortly.")

    form = await request.form()
    city = str(form.get("city") or "").strip().lower()
    category = str(form.get("category") or "").strip()
    description = str(form.get("description") or "").strip()[:500]
    try:
        lat, lng = float(form.get("lat")), float(form.get("lng"))
    except (TypeError, ValueError):
        return err("bad_request", "lat and lng are required numbers")
    if category not in _REPORT_CATEGORIES:
        return err("bad_request", f"category must be one of {sorted(_REPORT_CATEGORIES)}")
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return err("bad_request", "coordinates out of range")
    try:
        from core.cities import load_city as _lc
        _lc(city)
    except Exception:
        return err("bad_request", f"unknown city '{city}'")

    from core.spatial.h3_utils import latlng_to_cell
    cell = latlng_to_cell(lat, lng, 8)

    if DEMO_MODE:
        _last_report[ip] = now_s
        return ok({"report_id": 0, "h3_cell": cell, "status": "received",
                   "note": "demo mode — report accepted but not persisted"})

    photo_url = None
    photo = form.get("photo")
    if photo is not None and hasattr(photo, "read"):
        blob = await photo.read()
        if blob and len(blob) <= _MAX_PHOTO_BYTES:
            try:
                sdb = _db()
                name = f"{city}/{int(now_s)}_{cell}.jpg"
                sdb.storage.from_("citizen-reports").upload(
                    name, blob, {"content-type": getattr(photo, "content_type", None) or "image/jpeg"})
                photo_url = sdb.storage.from_("citizen-reports").get_public_url(name)
            except Exception as e:  # noqa: BLE001 — a failed upload must not lose the report
                logger.error("report photo upload failed: %s", e)

    try:
        row = (_db().table("citizen_reports").insert({
            "city_id": city, "h3_cell": cell, "lat": lat, "lng": lng,
            "category": category, "description": description, "photo_url": photo_url,
        }).execute().data or [{}])[0]
        _last_report[ip] = now_s
        return ok({"report_id": row.get("id"), "h3_cell": cell,
                   "status": row.get("status", "received"), "photo_url": photo_url,
                   "sla_hours": row.get("sla_hours", 72)})
    except Exception as e:  # noqa: BLE001
        return _server_error("report_failed", e, "Could not record the report.")


@app.get("/reports", tags=["citizen"])
def list_reports(city: str = Query(..., description="City ID"),
                 limit: int = Query(20, le=100)) -> dict:
    """Public list of citizen reports with SLA state (transparency by design)."""
    if DEMO_MODE:
        return ok({"city_id": city, "reports": [],
                   "note": "no citizen reports in demo fixtures"})
    try:
        rows = (_db().table("citizen_reports")
                .select("id,h3_cell,lat,lng,category,description,photo_url,status,sla_hours,created_at,resolved_at")
                .eq("city_id", city).order("created_at", desc=True)
                .limit(limit).execute().data or [])
        now_dt = datetime.now(timezone.utc)
        for r in rows:
            try:
                created = datetime.fromisoformat(str(r["created_at"]).replace("Z", "+00:00"))
                elapsed_h = (now_dt - created).total_seconds() / 3600
                r["sla_remaining_h"] = round(r.get("sla_hours", 72) - elapsed_h, 1)
                r["sla_breached"] = r["sla_remaining_h"] < 0 and r.get("status") not in ("resolved", "rejected")
            except Exception:  # noqa: BLE001
                r["sla_remaining_h"] = None
                r["sla_breached"] = False
        return ok({"city_id": city, "reports": rows})
    except Exception as e:  # noqa: BLE001
        return _server_error("reports_failed", e, "Could not load citizen reports.")


@app.post("/report/{report_id}/status", tags=["citizen"])
def update_report_status(report_id: int, payload: dict, db=Depends(get_db)) -> dict:
    """Officer transition for a report. 'verified' also registers the location
    as a candidate emission source so the next enforcement run scores it —
    the complaint loop feeding the worklist."""
    status = str(payload.get("status") or "").strip()
    if status not in {"verified", "actioned", "resolved", "rejected"}:
        return err("bad_request", "status must be verified|actioned|resolved|rejected")
    if DEMO_MODE:
        return ok({"report_id": report_id, "status": status, "note": "demo mode"})
    try:
        sdb = _db()
        rows = sdb.table("citizen_reports").select("*").eq("id", report_id).limit(1).execute().data
        if not rows:
            return err("not_found", f"report {report_id} not found")
        report = rows[0]
        update: dict = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}
        if status in ("resolved", "rejected"):
            update["resolved_at"] = datetime.now(timezone.utc).isoformat()

        if status == "verified" and not report.get("source_id"):
            src = (sdb.table("emission_sources").insert({
                "city_id": report["city_id"],
                "geom": f'POINT({report["lng"]} {report["lat"]})',
                "type": _REPORT_SOURCE_TYPE.get(report["category"], "industry"),
                "name": f"Citizen report #{report_id} ({report['category'].replace('_', ' ')})",
                "source_origin": "citizen_report",
                "detection_confidence": 0.5,
                "attributes": {"citizen_report_id": report_id, "photo_url": report.get("photo_url")},
            }).execute().data or [{}])[0]
            if src.get("id"):
                update["source_id"] = src["id"]
        sdb.table("citizen_reports").update(update).eq("id", report_id).execute()
        return ok({"report_id": report_id, **update})
    except Exception as e:  # noqa: BLE001
        return _server_error("report_status_failed", e, "Could not update the report.")


def _latest_advisory(city: str) -> Optional[dict]:
    """Freshest English advisory for a city (fixture rows in DEMO_MODE)."""
    if DEMO_MODE:
        # strict city match — fixture_rows falls back to ALL rows for unknown
        # cities, and speaking another city's advisory is worse than none
        rows = [
            r for r in fixture_rows("advisory", city)
            if (r.get("language") or "en") == "en" and r.get("city_id") == city
        ]
    else:
        rows = (
            _db().table("advisories").select("*").eq("city_id", city)
            .eq("language", "en").order("issued_at", desc=True).limit(1).execute().data
        ) or []
    return rows[0] if rows else None


class BroadcastBody(BaseModel):
    city: str = _CITY
    ivr: bool = False


@app.post("/advisory/broadcast", tags=["advisory"])
def advisory_broadcast(body: BroadcastBody, db=Depends(get_db)) -> dict:
    """Push the latest advisory through the live channels (Telegram + optional IVR).

    Demo-facing: lets the UI trigger a real multi-channel delivery on stage.
    Rate-limited server-side; each channel reports ok / skipped(reason) / error.
    """
    city = body.city
    now = time.time()
    if now - _last_broadcast.get(city, 0.0) < _BROADCAST_WINDOW_S:
        wait = int(_BROADCAST_WINDOW_S - (now - _last_broadcast[city]))
        return err("rate_limited", f"Broadcast already sent recently — retry in {wait}s")
    _last_broadcast[city] = now

    adv = _latest_advisory(city)
    if not adv:
        return err("no_advisory", f"No advisory available for {city}")

    results: dict[str, Any] = {"advisory": {"ward_id": adv.get("ward_id"), "message": adv.get("message")}}

    # Telegram
    if os.getenv("TELEGRAM_BOT_TOKEN"):
        try:
            from channels.telegram import broadcast_telegram_advisory
            r = asyncio.run(broadcast_telegram_advisory(adv, None if DEMO_MODE else _db()))
            results["telegram"] = r
        except Exception as e:  # noqa: BLE001 — never let one channel kill the broadcast
            logger.error("telegram broadcast failed: %s", e, exc_info=True)
            results["telegram"] = {"status": "error", "detail": "Telegram send failed"}
    else:
        results["telegram"] = {"status": "skipped", "detail": "TELEGRAM_BOT_TOKEN not configured"}

    # IVR — only when explicitly requested (it rings real phones).
    # Fans out to every number in TWILIO_TO_NUMBERS (fallback: TWILIO_TO_NUMBER).
    if body.ivr:
        if os.getenv("TWILIO_ACCOUNT_SID") and os.getenv("TWILIO_PHONE_NUMBER") and (
            os.getenv("TWILIO_TO_NUMBERS") or os.getenv("TWILIO_TO_NUMBER")
        ):
            try:
                from channels.ivr import broadcast_ivr_calls
                calls = broadcast_ivr_calls(adv)
                sent = sum(1 for c in calls if c["status"] != "error")
                results["ivr"] = {"status": f"calling {sent}/{len(calls)} numbers", "calls": calls}
            except Exception as e:  # noqa: BLE001
                logger.error("ivr broadcast failed: %s", e, exc_info=True)
                results["ivr"] = {"status": "error", "detail": "IVR call failed"}
        else:
            results["ivr"] = {"status": "skipped", "detail": "Twilio not configured on this server"}

    return ok(results)


def _twiml(xml: str) -> Response:
    return Response(content=xml, media_type="text/xml")


# Inbound IVR (Twilio Voice webhook). No bearer auth — Twilio can't send one, and
# these endpoints only speak the same public advisory text /advisory already serves.
# Both accept GET and POST because the webhook method is configurable in Twilio.
@app.api_route("/ivr/inbound", methods=["GET", "POST"], tags=["advisory"])
def ivr_inbound() -> Response:
    """Welcome menu for callers: pick a city on the keypad."""
    from channels.ivr import render_welcome_twiml

    return _twiml(render_welcome_twiml("/ivr/advisory"))


@app.api_route("/ivr/advisory", methods=["GET", "POST"], tags=["advisory"])
async def ivr_advisory(request: Request) -> Response:
    """Read the chosen city's latest advisory back to the caller.

    Must always return valid TwiML — an exception here becomes a dead phone
    line mid-call, so every failure path degrades to a spoken fallback.
    """
    from channels.ivr import IVR_CITY_MENU, render_twiml, render_unavailable_twiml

    digits = request.query_params.get("Digits", "")
    if request.method == "POST":
        try:
            body = (await request.body()).decode("utf-8", "replace")
            digits = dict(parse_qsl(body)).get("Digits", digits)
        except Exception:  # noqa: BLE001 — malformed body → fall back to default city
            pass
    city_id, city_name = IVR_CITY_MENU.get(digits.strip(), IVR_CITY_MENU["1"])
    try:
        adv = _latest_advisory(city_id)
    except Exception as e:  # noqa: BLE001 — DB down must not kill the call
        logger.error("ivr advisory fetch failed for %s: %s", city_id, e, exc_info=True)
        adv = None
    if not adv:
        return _twiml(render_unavailable_twiml(city_name))
    return _twiml(render_twiml(adv, city_name=city_name))


@app.post("/telegram/webhook", tags=["advisory"])
def telegram_webhook(
    update: dict,
    x_telegram_bot_api_secret_token: Optional[str] = Header(
        None, alias="X-Telegram-Bot-Api-Secret-Token"
    ),
) -> dict:
    """Telegram bot webhook: /start -> city picker -> advisory_subscribers."""
    secret = os.getenv("TELEGRAM_WEBHOOK_SECRET")
    if secret and x_telegram_bot_api_secret_token != secret:
        return err("forbidden", "invalid Telegram webhook secret")
    if DEMO_MODE:
        return ok({"status": "demo_mode", "detail": "subscription writes disabled in DEMO_MODE"})
    try:
        from channels.telegram import handle_subscription_update
        return ok(asyncio.run(handle_subscription_update(update, _db())))
    except Exception as e:  # noqa: BLE001
        return _server_error("telegram_webhook_error", e, "Failed to process update")


@app.get("/alerts/compound", tags=["advisory"])
def compound_alerts(city: str = Query("delhi", description="City ID"), db=Depends(get_db)) -> dict:
    """Heat × pollution compound-risk alert (cross-signal intelligence).

    Heat amplifies pollution mortality and drives ozone formation; a plain AQI
    misses the combination. Tiers (cited): IMD declares heatwave at ≥40°C in
    the plains (watch from 37°C); pollution legs use CPCB PM2.5 bands.
    """
    from core.grap import (CO_OCCURRENCE_CITATION, GRAP_CITATION, dust_traffic_cells,
                           forecast_grap)

    if DEMO_MODE:
        demo_hits = dust_traffic_cells([{"h3_cell": "883da11429fffff",
                                         "shares": {"construction_dust": 0.38, "traffic": 0.32}}])
        return ok({"city_id": city, "level": "watch", "tmax_next24_c": 39.1,
                   "pm25_forecast_max": 96.0, "o3_latest": 71.2,
                   "grap": forecast_grap(96.0),
                   "dust_traffic": {"count": len(demo_hits), "cells": demo_hits},
                   "note": "demo fixture",
                   "citations": [GRAP_CITATION, CO_OCCURRENCE_CITATION]})

    sdb = _db()
    temps = (
        sdb.table("measurements").select("ts,value").eq("city_id", city)
        .eq("variable", "temp").order("ts", desc=True).limit(48).execute().data
    )
    tmax = max((float(r["value"]) for r in temps), default=None)
    fc = (
        sdb.table("forecasts").select("value").eq("city_id", city)
        .eq("horizon_h", 24).execute().data
    )
    pm25_max = max((float(r["value"]) for r in fc if r.get("value") is not None), default=None)
    o3 = (
        sdb.table("measurements").select("value").eq("city_id", city)
        .eq("variable", "o3").order("ts", desc=True).limit(1).execute().data
    )
    o3_latest = float(o3[0]["value"]) if o3 else None

    level = "none"
    if tmax is not None and pm25_max is not None:
        if tmax >= 40.0 and pm25_max >= 91.0:
            level = "alert"
        elif tmax >= 37.0 and pm25_max >= 61.0:
            level = "watch"

    # Dust×traffic co-occurrence: real attribution rows only (no rows -> no flag).
    attr = (
        sdb.table("attribution").select("h3_cell,source_category,share")
        .eq("city_id", city).execute().data
    )
    cells: dict[str, dict] = {}
    for r in attr:
        cells.setdefault(r["h3_cell"], {"h3_cell": r["h3_cell"], "shares": {}})[
            "shares"][r["source_category"]] = r["share"]
    hits = dust_traffic_cells(list(cells.values()))

    return ok({
        "city_id": city,
        "level": level,
        "tmax_next24_c": tmax,
        "pm25_forecast_max": pm25_max,
        "o3_latest": o3_latest,
        "grap": forecast_grap(pm25_max),
        "dust_traffic": {"count": len(hits), "cells": hits[:5]},
        "note": "compound heat x pollution risk: heat amplifies PM mortality and drives ozone formation",
        "citations": [
            {"figure": "heatwave threshold", "value": 40, "unit": "degC (plains)",
             "source": "IMD heatwave criteria (watch tier from 37 degC)"},
            {"figure": "pollution legs", "value": "61 / 91", "unit": "ug/m3 PM2.5",
             "source": "CPCB National AQI bands (Moderate / Poor)"},
            GRAP_CITATION,
            CO_OCCURRENCE_CITATION,
        ],
    })


# ---------------------------------------------------------------------------
# Sejal Stage-1 static layers, mobility, comparison, and latency widgets
# ---------------------------------------------------------------------------

@app.get("/static-layers", tags=["data"])
def static_layers(city: str = Query(..., description="City ID")) -> dict:
    """OSM/WorldPop-style static layers: emission sources, roads, vulnerability."""
    if DEMO_MODE:
        data = fixture_rows("static_layers", city)
        return ok(data[0] if isinstance(data, list) and data else data)
    sdb = _db()
    sources = sdb.table("emission_sources").select("*").eq("city_id", city).execute().data or []
    # Real vulnerability zones (OSM hospitals/schools/elder-care × GPW population,
    # connectors/vulnerability.py). ward_id mirrors zone_id for UI compatibility.
    vuln = (
        sdb.table("vulnerability")
        .select("h3_cell,zone_id,population,hospitals,schools,eldercare,vulnerability_index")
        .eq("city_id", city).order("vulnerability_index", desc=True).limit(1200)
        .execute().data or []
    )
    for v in vuln:
        v["ward_id"] = v["zone_id"]
    return ok({"city_id": city, "emission_sources": sources, "vulnerability": vuln, "roads": []})


@app.get("/mobility", tags=["data"])
def mobility(city: str = Query(..., description="City ID")) -> dict:
    """Traffic proxy rows generated from OSM roads + time-of-day/day-of-week multipliers."""
    if DEMO_MODE:
        return ok(fixture_rows("mobility", city))
    rows = (
        _db().table("measurements")
        .select("city_id,h3_cell,station_id,ts,variable,value,unit,source,confidence")
        .eq("city_id", city)
        .eq("variable", "traffic")
        .order("ts", desc=True)
        .limit(1000)
        .execute()
        .data
    )
    return ok(rows)


# The comparison scans thousands of rows across all cities and its inputs only
# change on the hourly ingest / daily model cron, so cache the built result —
# a cold build measured 6.1 s, which the Cities panel would otherwise pay on
# every open. Same TTL pattern as /plume.
_COMPARISON_TTL_S = 300
_comparison_cache: dict[str, tuple[float, dict]] = {}


@app.get("/comparison", tags=["data"])
def comparison() -> dict:
    """Agent 5 multi-city comparison: trends, signatures, and playbook recommendations.

    Live mode runs the real ``build_comparison`` over current measurements +
    attribution + forecasts so the cards are consistent with the rest of the app
    (was previously always the demo fixture, even live)."""
    if DEMO_MODE:
        return ok(fixture("comparison", default={"summary": {}, "cities": []}))
    now = time.time()
    hit = _comparison_cache.get("all")
    if hit and now - hit[0] < _COMPARISON_TTL_S:
        return ok(hit[1])
    try:
        from agents.multicity import build_comparison

        sdb = _db()
        cities = sdb.table("cities").select("city_id,name").execute().data or []

        # Per city: latest PM2.5 per cell (a global newest-first slice would be swallowed by
        # the big station networks and leave small cities with nothing) and the dominant
        # source per cell from the most recent attribution window (PostgREST caps an
        # unbounded select at 1,000 rows — never rely on it for "all rows").
        aqi_rows: list[dict] = []

        def _city_rows(cid: str) -> tuple[list[dict], list[dict]]:
            m = (
                sdb.table("measurements").select("h3_cell,ts,value")
                .eq("city_id", cid).eq("variable", "pm25")
                .order("ts", desc=True).limit(600).execute().data
            ) or []
            a = (
                sdb.table("attribution").select("h3_cell,source_category,share,ts_window")
                .eq("city_id", cid).order("ts_window", desc=True).limit(600).execute().data
            ) or []
            return m, a

        # 10 cities × 2 reads: fetch concurrently so a cold cache answers in ~2 s, not 25 s
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=min(10, max(1, len(cities)))) as pool:
            fetched = dict(zip([c["city_id"] for c in cities], pool.map(_city_rows, [c["city_id"] for c in cities])))

        for c in cities:
            cid = c["city_id"]
            meas, attr = fetched.get(cid, ([], []))
            best: dict[str, float] = {}
            dom_by_cell: dict[str, str] = {}
            for r in attr:
                cell = r["h3_cell"]
                if cell in best and best[cell] >= 0 and r.get("share") is None:
                    continue
                sh = float(r.get("share") or 0)
                if sh > best.get(cell, -1.0):
                    best[cell] = sh
                    dom_by_cell[cell] = r["source_category"]
            seen: set[str] = set()
            for r in meas:
                cell = r["h3_cell"]
                if cell in seen or r.get("value") is None:
                    continue
                seen.add(cell)
                aqi_rows.append({
                    "city_id": cid,
                    "pm25": r["value"],
                    "dominant_source": dom_by_cell.get(cell, "unknown"),
                })

        fc = sdb.table("forecasts").select("city_id,horizon_h,value").eq("horizon_h", 24).execute().data or []
        forecast_rows = [
            {"city_id": r["city_id"], "horizon_h": r.get("horizon_h", 24), "value": r["value"]}
            for r in fc if r.get("value") is not None
        ]
        rec_statuses = (
            sdb.table("enforcement_recs").select("city_id,status").limit(5000).execute().data
        ) or []
        data = build_comparison(cities, aqi_rows, forecast_rows, rec_statuses)
        _comparison_cache["all"] = (now, data)
        return ok(data)
    except Exception as e:  # noqa: BLE001
        return _server_error("comparison_error", e, "Failed to build multi-city comparison")


@app.get("/latency", tags=["system"])
def latency_widget(city: Optional[str] = Query(None, description="City ID")) -> dict:
    """Latest signal-to-action telemetry for the top-bar latency widget."""
    if DEMO_MODE:
        rows = fixture_rows("latency", city)
        if city and isinstance(rows, list):
            return ok(rows[0] if rows else {})
        return ok(rows)
    q = _db().table("action_traces").select("*").order("signal_ts", desc=True).limit(20)
    if city:
        q = q.eq("city_id", city)
    rows = q.execute().data
    return ok(rows[0] if city and rows else rows)


BENCHMARKS = Path(__file__).resolve().parent.parent / "docs" / "benchmarks"


def _benchmark_summary(res: dict) -> dict:
    """Headline numbers the UI shows first; the full JSON stays available for the table."""
    heads = []
    for h in res.get("horizons", []):
        full = (h.get("regimes") or {}).get("full_test") or {}
        winter = (h.get("regimes") or {}).get("winter_nov_feb") or {}
        ep = (h.get("episodes") or {}).get("observed_over_120") or {}
        ew = (h.get("early_warning") or {}).get("very_poor") or {}
        cal = h.get("calibration") or {}
        heads.append({
            "horizon_h": h.get("horizon_h"),
            "n_test": h.get("n_test"),
            "skill_vs_persistence": full.get("skill_model_vs_persistence"),
            "skill_vs_seasonal_naive": _skill(full.get("rmse_model"), full.get("rmse_seasonal_naive")),
            "winter_skill_vs_persistence": winter.get("skill_model_vs_persistence") if winter.get("n") else None,
            "very_poor_hours_skill": ep.get("skill_model_vs_persistence") if ep.get("n") else None,
            "very_poor_hours_n": ep.get("n", 0),
            "onset_recall_model": ew.get("onset_recall_model"),
            "onset_recall_persistence": ew.get("onset_recall_persistence"),
            "onsets": ew.get("onsets", 0),
            "pi80_coverage": cal.get("pi80_coverage"),
            "brier_skill_very_poor": ((cal.get("very_poor") or {}).get("brier_skill")),
        })
    return {"city_id": res.get("city_id"), "source": res.get("source"), "window": res.get("window"),
            "stations_cells": res.get("stations_cells"), "generated_at": res.get("generated_at"),
            "headline": heads}


def _skill(rm, rb):
    try:
        return round(1 - float(rm) / float(rb), 3) if rb else None
    except (TypeError, ValueError):
        return None


@app.get("/metrics/benchmark", tags=["system"])
def metrics_benchmark(
    city: str = Query(..., description="City ID"),
    full: bool = Query(False, description="include the complete per-regime tables"),
) -> dict:
    """Temporal-split forecast benchmark for a city — recomputed artifacts, not typed-in numbers.

    Serves docs/benchmarks/<city>.json (multi-season history run) and <city>_live.json
    (last-quarter split on the live 90-day window) when present. Every figure comes from
    `python -m ml.eval.benchmark`; the API only reads the files.
    """
    out: dict[str, Any] = {"city_id": city, "history": None, "live": None}
    for key, name in (("history", f"{city}.json"), ("live", f"{city}_live.json")):
        p = BENCHMARKS / name
        if p.exists():
            try:
                res = json.loads(p.read_text())
            except json.JSONDecodeError:
                continue
            out[key] = res if full else _benchmark_summary(res)
    if out["history"] is None and out["live"] is None:
        raise HTTPException(status_code=404, detail=f"no benchmark artifact for {city}")
    return ok(out)


@app.get("/exposure", tags=["stage2"])
def exposure(city: str = Query(..., description="City ID"), db=Depends(get_db)) -> dict:
    """Who the forecast puts in bad air: expected people in Very Poor (>120) / Severe (>250)
    at +24/48/72 h, population-weighted over calibrated exceedance probabilities, plus
    person-hours across the outlook. Self-computed from this city's forecasts; the response
    states the population basis (GPW cells vs uniform cited city population)."""
    from ml.impact.exposure import compute_exposure
    from ml.impact.factors import population_for

    if DEMO_MODE:
        rows = fixture_rows("forecast", city)
        pop_rows = []
    else:
        rows = (
            db.table("forecasts").select("h3_cell,horizon_h,value,p_over_120,p_over_250")
            .eq("city_id", city).execute().data
        ) or []
        pop_rows = (
            db.table("measurements").select("h3_cell,value")
            .eq("city_id", city).eq("variable", "population").execute().data
        ) or []
    pop_by_cell = {r["h3_cell"]: float(r["value"]) for r in pop_rows if r.get("value")}
    pop = population_for(city)
    res = compute_exposure(rows, pop_by_cell, float(pop.value))
    res.update({"city_id": city, "city_population": pop.value, "population_citation": pop.cite()})
    return ok(res)


# ---------------------------------------------------------------------------
# Officer morning brief — one page per city, from stored model output (LLM-free)
# ---------------------------------------------------------------------------

def _public_base() -> str:
    return os.getenv("PUBLIC_API_BASE_URL", "").rstrip("/")


def _brief_data(city: str) -> dict:
    from agents.brief import build_brief
    from core.cities import load_city

    cfg = load_city(city)
    if DEMO_MODE:
        meas = fixture_rows("aqi_current", city) or []
        fc = fixture_rows("forecast", city) or []
        recs = fixture_rows("enforcement", city) or []
        adv = fixture_rows("advisory", city) or []
        inter: list[dict] = []
        # aqi_current fixture rows carry pm25 as `value` under `ts`? normalise to measurements shape
        meas = [{"h3_cell": r.get("h3_cell"), "ts": r.get("ts"), "value": r.get("pm25", r.get("value"))} for r in meas]
    else:
        sdb = _db()
        since = (datetime.now(timezone.utc) - timedelta(hours=36)).isoformat()
        # PostgREST caps a single response at 1,000 rows — page explicitly (36 h of a big
        # station network is several thousand rows)
        meas: list[dict] = []
        start = 0
        while True:
            batch = (sdb.table("measurements").select("h3_cell,ts,value").eq("city_id", city)
                     .eq("variable", "pm25").gte("ts", since).order("ts", desc=True)
                     .range(start, start + 999).execute().data) or []
            meas.extend(batch)
            if len(batch) < 1000 or len(meas) >= 20000:
                break
            start += 1000
        fc = (sdb.table("forecasts").select("h3_cell,horizon_h,value,p_over_120,p_over_250")
              .eq("city_id", city).execute().data) or []
        recs = (sdb.table("enforcement_recs").select("id,h3_cell,priority_score,contribution,pop_exposed,rationale,status")
                .eq("city_id", city).order("priority_score", desc=True).limit(50).execute().data) or []
        adv = (sdb.table("advisories").select("ward_id,risk_tier,language").eq("city_id", city).limit(500).execute().data) or []
        try:
            inter = _interventions_data(city).get("tracked", [])
        except Exception:  # noqa: BLE001 — the brief must still render
            inter = []
    base = _public_base()
    return build_brief(
        city, cfg.get("name", city.title()),
        measurements=meas, forecasts=fc, recs=recs, interventions=inter, advisories=adv,
        notice_url=(lambda rid: f"{base}/enforcement/{rid}/notice.pdf") if base else None,
    )


@app.get("/brief", tags=["enforcement"])
def brief(city: str = Query(..., description="City ID")) -> dict:
    """Officer morning brief as JSON: air now vs yesterday, cells about to cross Very Poor
    (calibrated P ≥ 0.3), top 3 actions with notice links, yesterday's measured outcomes,
    advisory summary. Every line comes from stored rows; nothing from a language model."""
    try:
        return ok(_brief_data(city))
    except Exception as e:  # noqa: BLE001
        return _server_error("brief_failed", e, "Could not build the morning brief.")


@app.get("/brief.pdf", tags=["enforcement"])
def brief_pdf(city: str = Query(..., description="City ID")) -> Response:
    """The same brief as a one-page PDF (same renderer as the enforcement notice)."""
    from agents.brief import render_brief_text
    from agents.notice_pdf import notice_pdf_bytes

    b = _brief_data(city)
    text = render_brief_text(b, console_url=os.getenv("PUBLIC_WEB_URL"))
    pdf = notice_pdf_bytes(text, subtitle="Urban Air Quality Intelligence - Officer Morning Brief",
                           tag=f"BRIEF · {b['generated_at'][:10]}", watermark=None)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="brief_{city}_{b["generated_at"][:10]}.pdf"'})


class BriefSendBody(BaseModel):
    city: str = _CITY


@app.post("/brief/send", tags=["enforcement"])
def brief_send(body: BriefSendBody, db=Depends(get_db)) -> dict:
    """Push today's brief to the city's Telegram subscribers (real send; rate-limited)."""
    from agents.brief import render_brief_text

    if not _status_rate_ok(limit=10, window_s=600):
        raise HTTPException(status_code=429, detail="brief already sent recently — slow down")
    b = _brief_data(body.city)
    text = render_brief_text(b, console_url=os.getenv("PUBLIC_WEB_URL"))
    if DEMO_MODE or not os.getenv("TELEGRAM_BOT_TOKEN"):
        return ok({"status": "skipped", "detail": "Telegram not configured (or DEMO_MODE)", "chars": len(text)})
    try:
        from channels.telegram import broadcast_telegram_text
        r = asyncio.run(broadcast_telegram_text(body.city, text, _db()))
        return ok(r)
    except Exception as e:  # noqa: BLE001
        return _server_error("brief_send_failed", e, "Telegram send failed")


# ---------------------------------------------------------------------------
# Agent query (orchestrator entry point)
# ---------------------------------------------------------------------------

class AgentQueryBody(BaseModel):
    city: str = _CITY
    query: str = Field("", max_length=2000)
    focus_cells: Optional[list[str]] = Field(None, max_length=2000)


@app.post("/agent/query", tags=["agent"])
def agent_query(body: AgentQueryBody, db=Depends(get_db)) -> dict:
    """Route a natural-language or programmatic query to the LangGraph orchestrator.

    Returns: answer, trace (per-node timing), enforcement recs, advisories, citations.
    """
    t0 = time.time()
    try:
        from agents.graph import run_query
        result = run_query(
            city_id=body.city,
            query=body.query,
            focus_cells=body.focus_cells,
        )
        elapsed_ms = int((time.time() - t0) * 1000)
        return ok({
            "answer": f"Multi-agent pipeline complete for {body.city}.",
            "city_id": body.city,
            "query": body.query,
            "enforcement": result.get("enforcement") or [],
            "advisories": result.get("advisories") or [],
            "citations": result.get("citations") or [],
            "trace": result.get("trace") or [],
            "latency_ms": result.get("latency_ms") or elapsed_ms,
        })
    except Exception as e:
        return _server_error("agent_error", e, "Agent pipeline failed to complete")


# ---------------------------------------------------------------------------
# What-if simulator (E3 engine, live) + E7 health/carbon quantification
# ---------------------------------------------------------------------------

class SimulateBody(BaseModel):
    city: str = _CITY
    intervention_type: str = Field("construction_halt", min_length=1, max_length=60)
    target_cells: Optional[list[str]] = Field(None, max_length=2000)
    target_source_ids: Optional[list[int]] = Field(None, max_length=2000)
    horizon_h: int = Field(24, ge=1, le=72)


@app.post("/simulate", tags=["stage2"])
def simulate(body: SimulateBody, db=Depends(get_db)) -> dict:
    """What-if intervention simulator: live E3 counterfactual over attribution
    shares × forecasts (ml.simulator), with E7 cited health ₹ + CO₂e layered on.
    DEMO_MODE serves the fixture, re-run through the E7 engine so the ₹/cases/CO₂e
    cards (and their citations) are always present and self-consistent."""
    if DEMO_MODE:
        from ml.impact import quantify_intervention
        fx = fixture("simulate", default={
            "delta_aqi_by_cell": {},
            "delta_pm25_by_cell": {},
            "people_protected": 0,
            "pm25_tonnes_avoided": None,
            "confidence": 0,
        })
        return ok(quantify_intervention(fx))
    from ml.simulator import simulate_intervention
    try:
        return ok(simulate_intervention(
            city_id=body.city,
            intervention_type=body.intervention_type,
            target_cells=body.target_cells,
            horizon_h=body.horizon_h,
        ))
    except ValueError as e:
        return err("bad_request", str(e))  # our own validation messages — safe to surface
    except Exception as e:  # noqa: BLE001
        return _server_error("simulate_error", e, "Simulation failed")


@app.get("/roi", tags=["stage2"])
def city_roi_dashboard(city: str = Query("delhi", description="City ID")) -> dict:
    """E7 City ROI dashboard: annual PM2.5 health burden + NCAP-target savings.

    Pure computation from cited factor tables (ml.impact) — deterministic, so it
    works identically live or in DEMO_MODE with no DB dependency."""
    from ml.impact import city_roi
    from ml.impact import factors as impact_factors
    pop = impact_factors.population_for(city)
    annual = impact_factors.annual_pm25_for(city)
    data = city_roi(city, annual_pm25=annual.value, population=pop.value)
    data["population_source"] = pop.source
    data["annual_pm25_source"] = annual.source
    return ok(data)


def _city_bbox(city_id: str):
    """[min_lng,min_lat,max_lng,max_lat] from the city config yml, for live coverage."""
    import yaml
    p = FIXTURES.parent.parent / "core" / "config" / "cities" / f"{city_id}.yml"
    if p.exists():
        cfg = yaml.safe_load(p.read_text()) or {}
        bb = cfg.get("bbox")
        if isinstance(bb, list) and len(bb) == 4:
            return tuple(float(x) for x in bb)
    return None


@app.get("/coverage", tags=["stage2"])
def coverage(city: str = Query("delhi", description="City ID")) -> dict:
    """E2 dense-coverage field: full-city per-H3-cell PM2.5 (downscaled ~1 km) +
    the sparse stations-only baseline, for the 'stations ↔ dense 1 km' map toggle.
    DEMO_MODE serves a precomputed fixture; live computes via ml.coverage."""
    if DEMO_MODE:
        data = fixture("coverage", default={})
        picked = data.get(city) if isinstance(data, dict) else None
        return ok(picked or {"cells": [], "city_id": city})
    try:
        return ok(_dense_field_cached(city))
    except ValueError as e:
        return err("bad_request", str(e))
    except Exception as e:  # noqa: BLE001
        return _server_error("coverage_error", e, "Failed to compute coverage field")


_DENSE_TTL_S = 600
_dense_cache: dict[str, tuple[float, dict]] = {}


def _dense_field_cached(city: str) -> dict:
    """/coverage is the heaviest read (downscaler over the whole city grid) and its inputs
    change hourly at most — serve a 10-minute in-process cache; the warm-up thread fills it
    for every city right after start so the first click on stage is instant."""
    now = time.time()
    hit = _dense_cache.get(city)
    if hit and now - hit[0] < _DENSE_TTL_S:
        return hit[1]
    data = _live_dense_field(city)
    _dense_cache[city] = (now, data)
    return data


def _live_dense_field(city: str) -> dict:
    """E2 dense PM2.5 field anchored on REAL data (latest per-cell PM2.5 +
    the live source registry). Shared by /coverage and /clean-zones. Without
    real anchors the assembler falls back to synthetic ones — acceptable for
    fixtures only, so the response labels which basis was used."""
    bbox = _city_bbox(city)
    if not bbox:
        raise ValueError(f"unknown city bbox: {city}")
    from core.spatial.h3_utils import cell_to_latlng
    from ml.coverage import build_dense_field

    db = _db()
    rows = (
        db.table("measurements").select("h3_cell,ts,value")
        .eq("city_id", city).eq("variable", "pm25")
        .order("ts", desc=True).limit(3000).execute().data
    ) or []
    latest: dict[str, float] = {}
    for r in rows:
        if r.get("value") is not None:
            latest.setdefault(r["h3_cell"], float(r["value"]))
    anchors = []
    for cell_id, val in latest.items():
        try:
            lat, lng = cell_to_latlng(cell_id)
            anchors.append({"lat": lat, "lng": lng, "pm25": val})
        except Exception:  # noqa: BLE001 — malformed cell id
            continue
    src_rows = (
        db.table("emission_sources").select("geom,detection_confidence")
        .eq("city_id", city).execute().data
    ) or []
    sources = [
        {"coordinates": (s.get("geom") or {}).get("coordinates"),
         "detection_confidence": s.get("detection_confidence")}
        for s in src_rows if (s.get("geom") or {}).get("coordinates")
    ]
    base = sum(latest.values()) / len(latest) if latest else 95.0
    data = build_dense_field(
        city, bbox,
        anchors=anchors or None,
        sources=sources or None,
        base_pm25=base,
    )
    data["anchors_from"] = "live_measurements" if anchors else "synthetic_fallback"
    return data


def _zones_from_field(city: str, field: dict, top: int) -> list[dict]:
    """Lowest-PM2.5 cells of a dense field -> 'cleanest zones' cards."""
    from core.spatial.h3_utils import cell_to_latlng
    from ml.simulator.counterfactual import pm25_to_aqi

    cells = [c for c in (field.get("cells") or []) if c.get("pm25") is not None]
    cells.sort(key=lambda c: float(c["pm25"]))
    zones = []
    for c in cells[:top]:
        try:
            lat, lng = cell_to_latlng(c["h3_cell"])
        except Exception:  # noqa: BLE001 — malformed cell id
            continue
        pm25 = round(float(c["pm25"]), 1)
        zones.append({
            "h3_cell": c["h3_cell"],
            "zone_id": f"zone-{c['h3_cell'].replace('f', '')[-4:]}",
            "pm25": pm25,
            "aqi": pm25_to_aqi(pm25),
            "lat": round(lat, 5),
            "lng": round(lng, 5),
            "maps_url": f"https://www.google.com/maps?q={round(lat, 5)},{round(lng, 5)}",
        })
    return zones


@app.get("/clean-zones", tags=["advisory"])
def clean_zones(
    city: str = Query("delhi", description="City ID"),
    top: int = Query(5, ge=1, le=20),
    db=Depends(get_db),
) -> dict:
    """Cleanest-air zones RIGHT NOW — the lowest-PM2.5 ~1km cells of the E2
    dense field (anchored on live station data). The citizen-facing flip side
    of the blame map: not just where the air is bad, but where to go instead.
    Honest basis: model-estimated field, labeled with its anchor source."""
    if DEMO_MODE:
        data = fixture("coverage", default={})
        field = data.get(city) if isinstance(data, dict) else None
        field = field or {"cells": [], "anchors_from": "demo_fixture"}
        return ok({"city_id": city, "basis": "demo_fixture",
                   "zones": _zones_from_field(city, field, top)})
    try:
        field = _dense_field_cached(city)
        return ok({
            "city_id": city,
            "basis": f"E2 dense 1km field, anchors: {field.get('anchors_from')}",
            "zones": _zones_from_field(city, field, top),
        })
    except ValueError as e:
        return err("bad_request", str(e))
    except Exception as e:  # noqa: BLE001
        return _server_error("clean_zones_error", e, "Failed to compute clean zones")


# Plume layer cache — wind + registry change hourly at most; keep the map snappy.
_PLUME_TTL_S = 600
_plume_cache: dict[str, tuple[float, dict]] = {}


@app.get("/plume", tags=["data"])
def plume_layer(
    city: str = Query("delhi", description="City ID"),
    top: int = Query(12, ge=1, le=30),
) -> dict:
    """Wind-oriented Gaussian plume footprints for the top emission sources.

    Physics: ml/dispersion/plume.py (Briggs urban), driven by the latest real
    wind_u/wind_v measurements. Intensity is RELATIVE (category x detection
    confidence) — we don't know absolute emission rates and say so in `note`.
    """
    if DEMO_MODE:
        data = fixture("plume", default={})
        payload = data.get(city) if isinstance(data, dict) else None
        # unknown city → empty layer, not an error (consistent with /coverage;
        # keeps /admin/cities onboarding graceful)
        return ok(payload or {"city_id": city, "wind": None, "plumes": [],
                              "note": "no plume snapshot for this city"})
    now = time.time()
    hit = _plume_cache.get(f"{city}:{top}")
    if hit and now - hit[0] < _PLUME_TTL_S:
        return ok(hit[1])
    try:
        sdb = _db()
        ts_rows = (
            sdb.table("measurements").select("ts").eq("city_id", city)
            .eq("variable", "wind_u").order("ts", desc=True).limit(1).execute().data
        ) or []
        if not ts_rows:
            return err("no_wind", f"No wind data available for {city}")
        ts0 = ts_rows[0]["ts"]

        def _mean_wind(var: str) -> float:
            rows = (
                sdb.table("measurements").select("value").eq("city_id", city)
                .eq("variable", var).eq("ts", ts0).limit(2000).execute().data
            ) or []
            vals = []
            for r in rows:
                try:
                    v = float(r["value"])
                except (TypeError, ValueError, KeyError):
                    continue  # one malformed row must not kill the whole layer
                if math.isfinite(v):
                    vals.append(v)
            return sum(vals) / len(vals) if vals else 0.0

        raw_sources = (
            sdb.table("emission_sources")
            .select("id,name,type,detection_confidence,geom")
            .eq("city_id", city).limit(1000).execute().data
        ) or []
        sources = []
        for s in raw_sources:
            g = s.get("geom")
            coords = g.get("coordinates") if isinstance(g, dict) else None
            if (
                isinstance(coords, list) and len(coords) == 2
                and isinstance(coords[0], (int, float)) and isinstance(coords[1], (int, float))
                and -180 <= coords[0] <= 180 and -90 <= coords[1] <= 90
                and (coords[0], coords[1]) != (0, 0)  # null-island = broken geocode
            ):
                sources.append({
                    "id": s.get("id"), "name": s.get("name"), "type": s.get("type"),
                    "detection_confidence": s.get("detection_confidence"),
                    "lon": coords[0], "lat": coords[1],
                })

        from ml.dispersion.footprint import plume_footprints

        # Day/night (Pasquill stability) must follow the WIND SNAPSHOT's clock,
        # not the request clock — same wind must always yield the same plume.
        try:
            wind_dt = datetime.fromisoformat(str(ts0).replace("Z", "+00:00"))
            if wind_dt.tzinfo is None:
                wind_dt = wind_dt.replace(tzinfo=timezone.utc)
        except ValueError:
            wind_dt = datetime.now(timezone.utc)
        ist_hour = (wind_dt.astimezone(timezone.utc) + timedelta(hours=5, minutes=30)).hour
        data = {
            "city_id": city, "wind_ts": ts0,
            **plume_footprints(
                sources, _mean_wind("wind_u"), _mean_wind("wind_v"),
                is_day=6 <= ist_hour < 18, top=top,
            ),
        }
        _plume_cache[f"{city}:{top}"] = (now, data)
        return ok(data)
    except Exception as e:  # noqa: BLE001
        return _server_error("plume_failed", e, "Could not compute the plume layer right now.")


# ---------------------------------------------------------------------------
# Prescriptive optimiser (E5 — Abhinav Stage 2; stub with demo fixture)
# ---------------------------------------------------------------------------

class OptimizeBody(BaseModel):
    city: str = _CITY
    budget_inspector_hours: int = Field(20, gt=0, le=1000)
    target_cells: Optional[list[str]] = Field(None, max_length=2000)
    horizon_h: int = Field(24, ge=1, le=72)


@app.post("/optimize", tags=["stage2"])
def optimize(body: OptimizeBody, db=Depends(get_db)) -> dict:
    """Prescriptive intervention optimiser (E5 — Stage 2 engine)."""
    if DEMO_MODE:
        return ok(fixture("optimize", default={"packages": []}))
    
    from ml.simulator import optimize_interventions
    try:
        return ok(optimize_interventions(
            city_id=body.city,
            budget_inspector_hours=body.budget_inspector_hours,
            horizon_h=body.horizon_h,
            target_cells=body.target_cells
        ))
    except Exception as e:
        return _server_error("optimize_error", e, "Optimiser failed")


# ---------------------------------------------------------------------------
# City onboarding (admin)
# ---------------------------------------------------------------------------

class CityBody(BaseModel):
    city_id: str
    name: str
    state: str = ""
    languages: list[str] = ["en"]
    center: Optional[list[float]] = None
    bbox: Optional[list[float]] = None


@app.post("/admin/cities", tags=["admin"])
def admin_onboard_city(
    body: CityBody,
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    db=Depends(get_db),
) -> dict:
    """Onboard a new city (config-driven, zero code change).

    Admin path: the anon token can't INSERT into cities (RLS blocks it — the
    live demo 500'd), so this runs with the service-role client, guarded by an
    X-Admin-Key header matched against the ADMIN_KEY env var.
    """
    if not body.city_id:
        return err("bad_request", "city_id is required")
    if DEMO_MODE:
        return ok({"onboarded": body.city_id, "demo": True})
    admin_key = os.getenv("ADMIN_KEY", "")
    if not admin_key:
        return err("not_configured", "ADMIN_KEY is not set on this server")
    if not hmac.compare_digest(x_admin_key or "", admin_key):
        return err("forbidden", "invalid or missing X-Admin-Key header")
    db = _db()  # service-role: bypasses RLS for this authenticated admin action

    # Upsert city row
    db.table("cities").upsert({
        "city_id": body.city_id,
        "name": body.name,
        "state": body.state,
        "languages": body.languages,
        "active": True,
    }).execute()
    return ok({"onboarded": body.city_id})


# ---------------------------------------------------------------------------
# Live action trace telemetry
# ---------------------------------------------------------------------------

@app.get("/traces", tags=["system"])
def get_traces(
    city: str = Query(..., description="City ID"),
    limit: int = Query(20, description="Max traces"),
    db=Depends(get_db)
) -> dict:
    """Retrieve recent signal-to-action latency traces (North-Star metric)."""
    if DEMO_MODE:
        return ok([
            {
                "city_id": city,
                "signal_ts": "2026-06-27T08:00:00Z",
                "attribution_ts": "2026-06-27T08:01:12Z",
                "forecast_ts": "2026-06-27T08:02:05Z",
                "enforcement_ts": "2026-06-27T08:03:30Z",
                "advisory_ts": "2026-06-27T08:04:15Z",
                "total_latency_ms": 255000,
                "trace": {"nodes": ["orchestrator", "attribution", "forecast", "enforcement", "advisory"]},
            }
        ])
    rows = (
        db.table("action_traces")
        .select("*")
        .eq("city_id", city)
        .order("signal_ts", desc=True)
        .limit(limit)
        .execute()
        .data
    )
    return ok(rows)


# ---------------------------------------------------------------------------
# WebSocket — /live
# ---------------------------------------------------------------------------

@app.websocket("/live")
async def websocket_live(ws: WebSocket, city: str = "delhi"):
    """WebSocket push of attribution/forecast/alert updates."""
    token = None
    if not DEMO_MODE:
        token = ws.query_params.get("token")
        if not token:
            auth_header = ws.headers.get("authorization", "")
            if auth_header.lower().startswith("bearer "):
                token = auth_header.split(" ", 1)[1]
        if not token:
            await ws.close(code=1008, reason="Missing authorization token")
            return
        try:
            payload = _decode_bearer_payload(token)
        except HTTPException:
            await ws.close(code=1008, reason="Invalid token format")
            return
        role = payload.get("role", "")
        # "anon" allowed: /live only pushes public read-only data (RLS still applies).
        if role not in ("anon", "authenticated", "service_role", "admin"):
            await ws.close(code=1008, reason="Insufficient role privileges")
            return

    await ws.accept()
    if DEMO_MODE:
        db = None
    else:
        from core.supa import anon_client
        db = anon_client()
        db.postgrest.auth(token)

    try:
        while True:
            if DEMO_MODE:
                payload = {
                    "city": city,
                    "aqi": fixture("aqi_current"),
                    "attribution": fixture("attribution"),
                    "forecast": fixture("forecast"),
                }
            else:
                try:
                    # In a real app we'd query the DB or use Supabase Realtime
                    # Here we poll latest data to push
                    measurements = db.table("measurements").select("h3_cell,ts,value").eq("city_id", city).eq("variable", "pm25").order("ts", desc=True).limit(50).execute().data
                    payload = {
                        "city": city,
                        "aqi": measurements,
                        "ts": datetime.now(timezone.utc).isoformat()
                    }
                except Exception:
                    payload = {"error": "Failed to fetch live data"}

            await ws.send_json(ok(payload))
            await asyncio.sleep(60)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("websocket stream error: %s", e, exc_info=True)
        try:
            await ws.close()
        except Exception:
            pass
