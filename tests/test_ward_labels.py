"""core/wards.py is the server-side twin of web/src/placeName.ts — they must agree.

They drifted: the browser named Mumbai's wards properly while every advisory, IVR call and
Telegram message said "near T", because only the TypeScript side carried the BMC mapping.
"""
from __future__ import annotations

import pytest

from core.wards import _label


@pytest.mark.parametrize("city,raw,expected", [
    # Mumbai and Chennai ship no locality at all — the mappings supply it
    ("mumbai", "T", "Mulund (Ward T)"),
    ("mumbai", "H/W", "Bandra West & Santacruz West (Ward H/W)"),
    ("chennai", "Ward 100", "Anna Nagar (Ward 100)"),
    ("chennai", "Ward 1", "Thiruvottiyur (Ward 1)"),
    # eight of ten bury a real locality behind a number or boilerplate
    ("hyderabad", "Ward 91 Khairatabad", "Khairatabad (Ward 91)"),
    ("ahmedabad", "48 RAMOL HATHIJAN", "Ramol Hathijan (Ward 48)"),
    ("bengaluru", "Kempegowda Ward", "Kempegowda"),
    ("delhi", "R. K. PURAM", "R. K. Puram"),
])
def test_the_locality_comes_first(city, raw, expected):
    assert _label(raw, city) == expected


def test_a_bare_number_stays_a_bare_number():
    """Kolkata's file carries nothing but a number. Inventing a name for it would be worse."""
    assert _label("Ward 93", "kolkata") == "Ward 93"


def test_an_unmapped_short_code_is_labelled_not_dressed_up():
    """A stray letter with no mapping reads as a ward, never as a place."""
    assert _label("Z", "mumbai") == "Ward Z"
    assert _label("Q", "kolkata") == "Ward Q"


def test_mumbai_mapping_covers_every_ward_in_the_shipped_file():
    """If the boundary file gains a ward the mapping lacks, this fails rather than saying "near T"."""
    import json
    from pathlib import Path

    f = Path("web/public/wards/mumbai.geojson")
    if not f.exists():
        pytest.skip("mumbai boundary file not shipped")
    from core.wards import BMC_WARD_AREAS

    names = {ft["properties"]["name"].upper() for ft in json.loads(f.read_text())["features"]
             if ft.get("properties", {}).get("name")}
    assert not (names - set(BMC_WARD_AREAS)), f"unmapped BMC wards: {sorted(names - set(BMC_WARD_AREAS))}"
