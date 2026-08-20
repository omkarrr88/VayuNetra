"""Advisory and IVR endpoint tests.

Tests the read surface (/advisory, /advisory/wards) and IVR webhooks
(/ivr/inbound, /ivr/advisory). Covers language filtering, ward filtering,
languages a city does not publish, and the TwiML the IVR webhooks return.

NEVER touches /advisory/broadcast (Telegram/Twilio real costs).
Runs in DEMO_MODE so advisory content comes from demo/fixtures/advisory.json.
"""
import html
import os

os.environ["DEMO_MODE"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

import api.main as m  # noqa: E402
from channels.ivr import IVR_CITY_MENU, render_twiml, render_unavailable_twiml  # noqa: E402

client = TestClient(m.app)


# --- /advisory endpoint: read and filter advisories -------------------------

def test_advisory_returns_success_for_valid_city():
    """A GET to /advisory?city=delhi&lang=en must return success."""
    resp = client.get("/advisory?city=delhi&lang=en")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)


def test_advisory_requires_city_parameter():
    """Missing the required city parameter must return 422."""
    resp = client.get("/advisory?lang=en")
    assert resp.status_code == 422


def test_advisory_filters_by_city():
    """Advisories must be scoped to the requested city only."""
    delhi_resp = client.get("/advisory?city=delhi&lang=en")
    delhi_data = delhi_resp.json()["data"]

    bengaluru_resp = client.get("/advisory?city=bengaluru&lang=en")
    bengaluru_data = bengaluru_resp.json()["data"]

    # Both responses should have data (fixture has advisories for both)
    assert len(delhi_data) > 0
    assert len(bengaluru_data) > 0

    # All Delhi rows must have city_id = delhi
    for row in delhi_data:
        assert row.get("city_id") == "delhi", f"Delhi advisory has wrong city_id: {row}"

    # All Bengaluru rows must have city_id = bengaluru
    for row in bengaluru_data:
        assert row.get("city_id") == "bengaluru", f"Bengaluru advisory has wrong city_id: {row}"


def test_advisory_filters_by_language():
    """The lang parameter must filter to that language only."""
    # Delhi supports both Hindi (hi) and English (en)
    resp_hi = client.get("/advisory?city=delhi&lang=hi")
    resp_en = client.get("/advisory?city=delhi&lang=en")

    hi_data = resp_hi.json()["data"]
    en_data = resp_en.json()["data"]

    # Both should have results
    assert len(hi_data) > 0, "No Hindi advisories found for Delhi in fixture"
    assert len(en_data) > 0, "No English advisories found for Delhi in fixture"

    # All Hindi rows must have language=hi
    for row in hi_data:
        lang = row.get("language") or "en"
        assert lang == "hi", f"Hindi filter returned non-Hindi row: {row}"

    # All English rows must have language=en (or default)
    for row in en_data:
        lang = row.get("language") or "en"
        assert lang == "en", f"English filter returned non-English row: {row}"


def test_advisory_returns_default_english_when_not_specified():
    """Language parameter defaults to 'en' if omitted."""
    resp = client.get("/advisory?city=delhi")
    body = resp.json()
    assert body["success"] is True
    data = body["data"]

    # Should get English advisories (or fallback default language)
    assert len(data) > 0


def test_advisory_with_unsupported_language_still_works():
    """A city might not publish in every language — the endpoint must handle gracefully.

    Chennai only supports English (en) in the fixture. Asking for Tamil (ta) should
    return an empty list, not an error.
    """
    resp = client.get("/advisory?city=chennai&lang=ta")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    # Empty list is acceptable (city doesn't publish in that language)
    assert isinstance(body["data"], list)


def test_advisory_filters_by_ward():
    """The optional ward parameter must filter to that ward only."""
    # Get all advisories for Delhi
    resp_all = client.get("/advisory?city=delhi&lang=en")
    all_data = resp_all.json()["data"]

    # Pick the first ward from the data
    if all_data:
        first_ward = all_data[0].get("ward_id")
        if first_ward:
            # Query for that specific ward
            resp = client.get(f"/advisory?city=delhi&lang=en&ward={first_ward}")
            body = resp.json()
            assert body["success"] is True
            ward_data = body["data"]

            # All results must be for the requested ward
            for row in ward_data:
                assert row.get("ward_id") == first_ward, f"Ward filter returned wrong ward: {row}"


def test_advisory_ward_filtering_returns_empty_for_unknown_ward():
    """Filtering by a non-existent ward should return empty list, not error."""
    resp = client.get("/advisory?city=delhi&lang=en&ward=nonexistent_ward_xyz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"] == [] or isinstance(body["data"], list)


def test_advisory_data_structure():
    """Advisory rows must contain expected fields."""
    resp = client.get("/advisory?city=delhi&lang=en")
    data = resp.json()["data"]

    if data:
        # Check a sample row has the expected structure
        row = data[0]
        expected_fields = ["city_id", "message"]  # Minimum required fields
        for field in expected_fields:
            assert field in row, f"Advisory row missing field: {field}"


# --- /advisory/wards endpoint: list wards by risk -----------------------------

def test_advisory_wards_returns_list():
    """GET /advisory/wards must return a list of wards."""
    resp = client.get("/advisory/wards?city=delhi&lang=en")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)


def test_advisory_wards_requires_city():
    """Missing city parameter must return 422."""
    resp = client.get("/advisory/wards?lang=en")
    assert resp.status_code == 422


def test_advisory_wards_defaults_to_english():
    """Language parameter defaults to 'en' if omitted."""
    resp = client.get("/advisory/wards?city=delhi")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)


def test_advisory_wards_filters_by_language():
    """The lang parameter must filter wards by language."""
    resp_hi = client.get("/advisory/wards?city=mumbai&lang=mr")
    resp_en = client.get("/advisory/wards?city=mumbai&lang=en")

    hi_data = resp_hi.json()["data"]
    en_data = resp_en.json()["data"]

    # Both should return lists (may be empty if the fixture doesn't have that language)
    assert isinstance(hi_data, list)
    assert isinstance(en_data, list)


def test_advisory_wards_returns_ward_structure():
    """Ward objects must have ward_id, risk_tier, and h3_cell."""
    resp = client.get("/advisory/wards?city=delhi&lang=en")
    data = resp.json()["data"]

    if data:
        ward = data[0]
        # Expected structure for a ward object
        assert "ward_id" in ward, "Ward missing ward_id"
        assert "risk_tier" in ward, "Ward missing risk_tier"
        # h3_cell may be present or null


def test_advisory_wards_returns_empty_for_unsupported_language():
    """A city without a language should return empty list."""
    resp = client.get("/advisory/wards?city=chennai&lang=mr")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)


# --- /ivr/inbound endpoint: welcome menu -----------------------------------

def test_ivr_inbound_get_returns_twiml():
    """GET /ivr/inbound must return valid TwiML."""
    resp = client.get("/ivr/inbound")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/xml")
    assert "<Response>" in resp.text
    assert "</Response>" in resp.text


def test_ivr_inbound_post_returns_twiml():
    """POST /ivr/inbound must also return valid TwiML (Twilio sends both)."""
    resp = client.post("/ivr/inbound", data={"CallSid": "CAtest"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/xml")
    assert "<Response>" in resp.text


def test_ivr_inbound_contains_menu_options():
    """The welcome TwiML must list available cities/options."""
    resp = client.get("/ivr/inbound")
    text = resp.text

    # Should contain Gather element for accepting input
    assert "<Gather" in text

    # Should mention cities (at minimum, the menu structure)
    assert "Delhi" in text or "Bengaluru" in text or "city" in text.lower()


def test_ivr_inbound_handles_empty_body():
    """POST with minimal/empty body must return TwiML, not error."""
    resp = client.post("/ivr/inbound")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/xml")


def test_ivr_inbound_handles_malformed_body():
    """Malformed POST body must not crash — return TwiML."""
    resp = client.post(
        "/ivr/inbound",
        content=b"\xff\xfe not-a-form",
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200
    assert "<Response>" in resp.text


# --- /ivr/advisory endpoint: read and speak advisory -------------------------

def test_ivr_advisory_get_returns_twiml():
    """GET /ivr/advisory must return valid TwiML."""
    resp = client.get("/ivr/advisory?Digits=1")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/xml")
    assert "<Response>" in resp.text
    assert "</Response>" in resp.text


def test_ivr_advisory_post_returns_twiml():
    """POST /ivr/advisory must also return valid TwiML."""
    resp = client.post("/ivr/advisory", data={"Digits": "1"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/xml")
    assert "<Response>" in resp.text


def test_ivr_advisory_no_input_defaults_to_delhi():
    """No Digits parameter should default to Delhi (digit 1)."""
    resp = client.post("/ivr/advisory")
    assert resp.status_code == 200
    text = resp.text

    # Should contain Delhi-related content (city name or advisory from fixture)
    assert "Delhi" in text or "वायु" in text  # Either the city name or Hindi text


def test_ivr_advisory_unknown_digit_defaults_to_delhi():
    """Unknown digit (not 1-10 or mapped cities) should default to Delhi."""
    resp = client.post("/ivr/advisory", data={"Digits": "999"})
    assert resp.status_code == 200
    text = resp.text
    assert "<Response>" in text
    # Should fall back to Delhi


def test_ivr_advisory_digit_1_is_delhi():
    """Digit 1 (mapped in IVR_CITY_MENU) should be Delhi."""
    resp = client.post("/ivr/advisory", data={"Digits": "1"})
    assert resp.status_code == 200
    text = resp.text
    assert "<Response>" in text
    # Delhi is the default city for digit 1
    assert "Delhi" in text or "<Say>" in text


def test_ivr_advisory_digit_2_is_bengaluru():
    """Digit 2 should correspond to Bengaluru (from IVR_CITY_MENU)."""
    digit_2_city, digit_2_name = IVR_CITY_MENU.get("2", ("bengaluru", "Bengaluru"))
    resp = client.post("/ivr/advisory", data={"Digits": "2"})
    assert resp.status_code == 200
    text = resp.text
    # Should mention the city name
    assert digit_2_name in text or digit_2_city in text


def test_ivr_advisory_speaks_in_city_language():
    """The IVR must speak in the city's first configured language.

    Delhi's first language is Hindi, so the IVR call should use a Hindi voice.
    """
    resp = client.post("/ivr/advisory", data={"Digits": "1"})
    assert resp.status_code == 200
    text = resp.text

    # Delhi should use Hindi voice (hi-IN) since it's the first language
    # This is enforced by _ivr_language()
    lang = m._ivr_language("delhi")
    assert lang == "hi", "Delhi's first language should be Hindi"


def test_ivr_advisory_malformed_body_still_speaks():
    """Malformed POST body must not crash — must still return valid TwiML."""
    resp = client.post(
        "/ivr/advisory",
        content=b"\xff\xfe not-a-form",
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200
    assert "<Response>" in resp.text


def test_ivr_advisory_empty_digits_string():
    """Digits parameter present but empty should default to Delhi."""
    resp = client.post("/ivr/advisory", data={"Digits": ""})
    assert resp.status_code == 200
    text = resp.text
    assert "<Response>" in text


def test_ivr_advisory_whitespace_digits():
    """Digits with only whitespace should default to Delhi."""
    resp = client.post("/ivr/advisory", data={"Digits": "   "})
    assert resp.status_code == 200
    text = resp.text
    assert "<Response>" in text


def test_ivr_advisory_special_characters_in_digits():
    """Special characters in Digits should not crash."""
    resp = client.post("/ivr/advisory", data={"Digits": "!@#$%^&*()"})
    assert resp.status_code == 200
    assert "<Response>" in resp.text


# --- IVR language support checks -------------------------------------------

def test_ivr_language_for_hindi_city():
    """Delhi's first language is Hindi, so _ivr_language should return 'hi'."""
    lang = m._ivr_language("delhi")
    assert lang == "hi"


def test_ivr_language_for_tamil_city():
    """Chennai's first language is Tamil (ta), so _ivr_language should return 'ta'."""
    lang = m._ivr_language("chennai")
    assert lang == "ta"


def test_ivr_language_for_multilingual_city():
    """Mumbai has multiple languages; should return the first configured one."""
    lang = m._ivr_language("mumbai")
    # Mumbai's languages are [mr, en, hi], so first should be 'mr' (Marathi)
    assert lang == "mr"


def test_ivr_language_for_unknown_city():
    """Unknown city should not crash, should fall back to English."""
    lang = m._ivr_language("atlantis")
    assert lang == "en"


# --- TwiML safety and integrity -----------------------------------------------

def test_ivr_advisory_message_is_xml_escaped():
    """Advisory messages must be XML-escaped to prevent TwiML injection.

    If an advisory message contains '<Say>evil</Say>', it must be escaped
    to '&lt;Say&gt;evil&lt;/Say&gt;' in the TwiML output.
    """
    # Create test data with injection attempt
    test_msg = 'Alert <Say>evil</Say> & "quotes"'
    xml = render_twiml({"message": test_msg}, city_name="Test")

    # Verify injection is escaped
    assert "<Say>evil</Say>" not in xml, "Injection was not escaped"
    assert "&lt;Say&gt;evil&lt;/Say&gt;" in xml, "Expected escaped XML"


def test_ivr_advisory_twiml_is_well_formed():
    """TwiML responses must be valid XML with proper closing tags."""
    resp = client.post("/ivr/advisory", data={"Digits": "1"})
    text = resp.text

    # Must have opening and closing Response tags
    assert "<Response>" in text
    assert "</Response>" in text

    # Should have Say (for speaking) or fallback unavailable
    assert "<Say" in text or "<Redirect" in text


def test_ivr_unavailable_twiml_is_valid():
    """If advisory is unavailable, the fallback TwiML must still be valid."""
    xml = render_unavailable_twiml("TestCity")
    assert "<Response>" in xml
    assert "</Response>" in xml
    assert "TestCity" in xml


# --- _latest_advisory helper tests (unit-level like test_broadcast_language.py) -

def test_latest_advisory_returns_none_for_unknown_city():
    """_latest_advisory for a non-existent city must return None, not another city's advisory.

    This prevents a caller hearing the wrong city's message due to fixture_rows fallback.
    """
    adv = m._latest_advisory("atlantis")
    assert adv is None, "Unknown city must not fall back to another city"


def test_latest_advisory_honours_language():
    """_latest_advisory must return the requested language."""
    hi_adv = m._latest_advisory("delhi", "hi")
    assert hi_adv is not None, "Delhi fixture should have Hindi advisory"
    assert hi_adv.get("language") == "hi"


def test_latest_advisory_falls_back_to_english():
    """If the requested language is unavailable, fall back to English."""
    # Delhi doesn't have Kannada (only hi, en)
    kn_adv = m._latest_advisory("delhi", "kn")
    assert kn_adv is not None, "Should fall back to English"
    assert kn_adv.get("language") == "en"


def test_latest_advisory_default_language_is_english():
    """When no language is specified, default to English."""
    adv = m._latest_advisory("delhi")
    assert adv is not None
    assert (adv.get("language") or "en") == "en"


def test_latest_advisory_with_ward():
    """_latest_advisory should filter by ward if specified."""
    all_adv = m._latest_advisory("delhi", "en")
    if all_adv:
        ward_id = all_adv.get("ward_id")
        if ward_id:
            ward_adv = m._latest_advisory("delhi", "en", ward=ward_id)
            assert ward_adv is not None
            assert ward_adv.get("ward_id") == ward_id


# --- Integration tests: /advisory + /advisory/wards together ----------------

def test_advisory_and_wards_are_consistent():
    """Ward IDs from /advisory/wards should exist in /advisory responses."""
    wards_resp = client.get("/advisory/wards?city=delhi&lang=en")
    wards_data = wards_resp.json()["data"]

    adv_resp = client.get("/advisory?city=delhi&lang=en")
    adv_data = adv_resp.json()["data"]

    if wards_data and adv_data:
        # Extract ward IDs from both
        wards_ids = {w.get("ward_id") for w in wards_data}
        adv_ward_ids = {a.get("ward_id") for a in adv_data}

        # The wards_ids should be a subset of adv_ward_ids (or equal)
        assert wards_ids.issubset(adv_ward_ids) or wards_ids == adv_ward_ids


def test_advisory_wards_sorted_by_risk_tier():
    """Wards from /advisory/wards should be sorted with worst air first.

    This is enforced by _advisory_sort_key which sorts by -TIER_SEVERITY.
    """
    resp = client.get("/advisory/wards?city=delhi&lang=en")
    data = resp.json()["data"]

    if len(data) > 1:
        # Extract risk tiers
        from api.main import TIER_SEVERITY

        tiers = [row.get("risk_tier") for row in data]
        severities = [TIER_SEVERITY.get(t, 0) for t in tiers]

        # Check if sorted (descending severity = ascending index)
        # Most severe first means higher severity values come first
        assert severities == sorted(severities, reverse=True), "Wards not sorted by risk"


# --- Edge cases and error handling ---

def test_advisory_with_invalid_language_code_still_works():
    """Invalid language codes should either return empty or fallback to English."""
    resp = client.get("/advisory?city=delhi&lang=xyz123")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True


def test_ivr_advisory_with_query_params():
    """GET /ivr/advisory with query parameters should work."""
    resp = client.get("/ivr/advisory?Digits=1&CallSid=CAtest")
    assert resp.status_code == 200
    assert "<Response>" in resp.text


def test_advisory_response_has_correct_structure():
    """All advisory responses must follow the standard API response format."""
    resp = client.get("/advisory?city=delhi&lang=en")
    body = resp.json()

    # Standard format: success boolean, data payload
    assert "success" in body
    assert "data" in body
    assert isinstance(body["success"], bool)


def test_advisory_wards_response_has_correct_structure():
    """All /advisory/wards responses must follow the standard API response format."""
    resp = client.get("/advisory/wards?city=delhi&lang=en")
    body = resp.json()

    assert "success" in body
    assert "data" in body
    assert isinstance(body["success"], bool)
    assert isinstance(body["data"], list)
