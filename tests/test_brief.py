"""Officer morning brief — pure builder over stored rows; text render is PDF-parseable."""
from datetime import datetime, timedelta, timezone

from agents.brief import build_brief, render_brief_text

NOW = datetime(2026, 8, 17, 6, 0, tzinfo=timezone.utc)


def _meas():
    rows = []
    for h in (1, 2, 3):
        rows.append({"h3_cell": "a", "ts": (NOW - timedelta(hours=h)).isoformat(), "value": 40 + h})
        rows.append({"h3_cell": "b", "ts": (NOW - timedelta(hours=h)).isoformat(), "value": 130})
        rows.append({"h3_cell": "a", "ts": (NOW - timedelta(days=1, hours=h)).isoformat(), "value": 60})
    return rows


def _fc():
    return [
        {"h3_cell": "a", "horizon_h": 24, "value": 55, "p_over_120": 0.05, "p_over_250": 0.0},
        {"h3_cell": "a", "horizon_h": 48, "value": 140, "p_over_120": 0.62, "p_over_250": 0.1},
        {"h3_cell": "b", "horizon_h": 24, "value": 150, "p_over_120": 0.9, "p_over_250": 0.2},  # already bad now -> not an onset
    ]


def test_brief_numbers_and_onsets():
    recs = [
        {"id": 1, "h3_cell": "a", "priority_score": 0.9, "contribution": 0.4, "pop_exposed": 15000, "rationale": "Construction dust contributes", "status": "proposed"},
        {"id": 2, "h3_cell": "a", "priority_score": 0.8, "contribution": 0.3, "pop_exposed": 9000, "rationale": "Construction dust", "status": "proposed"},
        {"id": 3, "h3_cell": "c", "priority_score": 0.7, "contribution": 0.2, "pop_exposed": 5000, "rationale": "Industrial stack", "status": "dispatched"},
    ]
    b = build_brief("delhi", "Delhi", measurements=_meas(), forecasts=_fc(), recs=recs,
                    interventions=[{"rec_id": 3, "h3_cell": "c", "days_since_dispatch": 1.0, "effect_pm25": -4.2, "status": "measuring"}],
                    advisories=[{"ward_id": "w1", "risk_tier": "poor", "language": "hi"}, {"ward_id": "w1", "risk_tier": "poor", "language": "en"}],
                    now=NOW, notice_url=lambda rid: f"https://api.example/enforcement/{rid}/notice.pdf")
    air = b["air"]
    assert air["now_pm25"] == round((41 + 42 + 43 + 130 * 3) / 6, 1)
    assert air["yesterday_pm25"] == 60.0 and air["change_pm25"] == round(air["now_pm25"] - 60.0, 1)
    assert air["worst_cell"]["pm25"] == 130
    # onsets: cell a crosses at +48h with P=0.62; cell b is already >120 now so it is not an onset
    assert [o["h3_cell"] for o in b["onsets"]] == ["a"]
    assert b["onsets"][0]["horizon_h"] == 48 and b["onsets"][0]["p_over_120"] == 0.62
    # top actions: one per cell, open statuses only, notice link built
    assert [x["rec_id"] for x in b["actions"]] == [1]
    assert b["actions"][0]["notice_url"].endswith("/enforcement/1/notice.pdf")
    assert b["outcomes"][0]["effect_pm25"] == -4.2
    assert b["advisories"]["worst_tier"] == "poor" and b["advisories"]["languages"] == ["en", "hi"]


def test_render_text_is_pdf_parseable_and_llm_free():
    b = build_brief("delhi", "Delhi", measurements=[], forecasts=[], recs=[], interventions=[], advisories=[], now=NOW)
    txt = render_brief_text(b, console_url="https://vayunetra.example/console?city=delhi")
    assert txt.startswith("MORNING AIR BRIEF — DELHI")
    for heading in ("AIR RIGHT NOW:", "WHERE THE AIR IS ABOUT TO TURN:", "TOP ACTIONS TODAY:", "PROVENANCE:"):
        assert heading in txt
    assert "No station readings" in txt and "No open recommendations" in txt
    from agents.notice_pdf import notice_pdf_bytes
    pdf = notice_pdf_bytes(txt, subtitle="Officer Morning Brief", tag="BRIEF", watermark=None)
    assert pdf[:4] == b"%PDF"
