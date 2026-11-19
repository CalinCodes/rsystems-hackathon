"""Co-located tests for generator.py. No network: these only exercise fill + variants."""

from __future__ import annotations

import json

import generator as g

# Mirror of contracts/types.ts — a template using an unknown flag/type must fail here,
# not silently train a dead class.
VALID_FLAGS = {
    "RF_CODE_REQUEST", "RF_REMOTE_ACCESS", "RF_DATA_REQUEST", "RF_PAYMENT_REQUEST",
    "RF_SUSPICIOUS_CONTACT", "RF_NEW_NUMBER", "RF_SECRECY", "RF_TOO_GOOD",
    "RF_IMPERSONATION", "RF_URGENCY", "RF_THREAT", "RF_EMOTIONAL_PRESSURE",
    "RF_CHANNEL_SWITCH",
}
VALID_TYPES = {
    "BANK_IMPERSONATION", "COURIER_FEE", "AUTHORITY_IMPERSONATION", "FAMILY_EMERGENCY",
    "TECH_SUPPORT", "MARKETPLACE", "ACCOUNT_TAKEOVER", "INVESTMENT", "ROMANCE",
    "JOB_OFFER", "PRIZE_LOTTERY", "OTHER", "NONE",
}


def test_strip_diacritics_matches_engine_map():
    assert g.strip_diacritics("Țară șosea în Ăsta") == "Tara sosea in Asta"


def test_generation_is_deterministic():
    assert g.generate() == g.generate()


def test_every_row_has_valid_flags_and_type():
    for row in g.generate():
        assert row["type"] in VALID_TYPES, row["type"]
        assert set(row["flags"]) <= VALID_FLAGS, row["flags"]
        assert row["text"].strip()
        assert "{" not in row["text"], f"unfilled slot: {row['text']}"


def test_safe_rows_carry_no_flags():
    for row in g.generate():
        if row["type"] == "NONE":
            assert row["flags"] == [], row


def test_rows_are_json_serializable():
    for row in g.generate()[:5]:
        json.loads(json.dumps(row, ensure_ascii=False))
