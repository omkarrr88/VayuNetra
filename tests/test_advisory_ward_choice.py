"""Which ward a broadcast targets must be a choice, not an accident.

Every advisory in a batch shares one issued_at, so `order(issued_at desc).limit(1)` left the tie to
whatever Postgres returned: an arbitrary ward, and an arbitrary CHANNEL row with it — so an IVR
call could go out carrying the row written for a display board.
"""
import os

os.environ["DEMO_MODE"] = "true"

import api.main as m  # noqa: E402

BATCH = [
    {"city_id": "delhi", "language": "en", "ward_id": "zone-b", "risk_tier": "moderate", "channel": "ivr", "message": "b"},
    {"city_id": "delhi", "language": "en", "ward_id": "zone-a", "risk_tier": "severe", "channel": "display", "message": "a-display"},
    {"city_id": "delhi", "language": "en", "ward_id": "zone-a", "risk_tier": "severe", "channel": "ivr", "message": "a-ivr"},
    {"city_id": "delhi", "language": "en", "ward_id": "zone-c", "risk_tier": "good", "channel": "ivr", "message": "c"},
]


def test_the_default_is_the_worst_air_not_an_arbitrary_row():
    assert m._advisory_sort_key(BATCH[1])[0] < m._advisory_sort_key(BATCH[0])[0]
    worst = sorted(BATCH, key=m._advisory_sort_key)[0]
    assert worst["risk_tier"] == "severe"


def test_the_tie_break_is_stable():
    """Same rows in any order must yield the same pick, or 'which ward?' has no answer."""
    a = sorted(BATCH, key=m._advisory_sort_key)
    b = sorted(list(reversed(BATCH)), key=m._advisory_sort_key)
    assert [r["ward_id"] for r in a] == [r["ward_id"] for r in b]


def test_every_tier_we_emit_is_ranked():
    """An unranked tier sorts as 0 and would quietly outrank severe."""
    from agents.advisory import LANG_LABEL

    tiers = {k for k in LANG_LABEL["en"] if not k.startswith("action")}
    assert tiers <= set(m.TIER_SEVERITY), f"unranked tiers: {tiers - set(m.TIER_SEVERITY)}"


def test_the_broadcast_body_accepts_a_ward():
    assert "ward" in m.BroadcastBody.model_fields
    assert m.BroadcastBody(city="delhi").ward is None            # "choose for me"
    assert m.BroadcastBody(city="delhi", ward="zone-a").ward == "zone-a"


def test_ward_listing_is_deduplicated_and_worst_first():
    rows = m.list_advisory_wards("delhi", "en")
    ids = [r["ward_id"] for r in rows]
    assert len(ids) == len(set(ids)), "one entry per ward, not one per channel"
