"""Tests for LLM explanation generation, validation, and template fallback."""

import json
from unittest.mock import MagicMock

import pytest

from app.db import get_connection, init_db
from app.llm.explain import get_or_generate_explanation
from app.llm.facts import build_facts_payload
from app.llm.validate import validate_explanation


@pytest.fixture
def sample_payload():
    shop_meta = {
        "shop_id": "FPS-00001",
        "name": "Shop FPS-00001",
        "district": "Ahmedabad",
        "taluka": "Ahmedabad Taluka 1",
        "cards_count": 300,
        "vulnerability_index": 0.25,
    }
    breakdown = [
        {"key": "stock_gap_pct", "label": "Stock gap", "points": 25.0, "value": 10.5, "unit": "%"},
        {
            "key": "unauth_share",
            "label": "Unauthenticated sales",
            "points": 20.0,
            "value": 30.0,
            "unit": "%",
        },
    ]
    stock_recon = {
        "opening_kg": 1000.0, "received_kg": 500.0, "sold_kg": 400.0,
        "closing_kg": 950.0, "gap_kg": 150.0, "gap_pct": 10.5, "direction": "shortfall",
    }
    board_check = {"board_kg": 400.0, "sold_kg": 400.0, "mismatch_pct": 0.0}

    return build_facts_payload(
        shop_meta=shop_meta,
        week_start="2026-11-02",
        risk_score=45.0,
        band="medium",
        breakdown=breakdown,
        stock_recon=stock_recon,
        board_check=board_check,
        complaints=[],
        recent_series={},
    )


def test_valid_llm_output_accepted(sample_payload):
    valid_output = {
        "reason": "Shop flagged with score of 45.0 points due to stock gap and overrides.",
        "evidence": [
            {
                "fact_id": "val_stock_gap_pct",
                "statement": "Recorded stock gap of 10.5% with shortfall of 150.0 kg.",
            },
            {
                "fact_id": "val_unauth_share",
                "statement": "Unauthenticated sales reached 30.0% of transactions.",
            },
        ],
        "checklist": [
            {
                "action": "Check godown physical inventory",
                "why": "Stock gap of 10.5% requires physical verification",
                "fact_id": "val_stock_gap_pct",
            },
            {
                "action": "Audit override log register",
                "why": "Override rate of 30.0% needs verification",
                "fact_id": "val_unauth_share",
            },
        ],
    }

    is_valid, msg = validate_explanation(valid_output, sample_payload)
    assert is_valid is True, msg


def test_unknown_fact_id_rejected(sample_payload):
    invalid_output = {
        "reason": "Shop has high stock gap.",
        "evidence": [
            {"fact_id": "UNKNOWN_FACT_123", "statement": "Fabricated statement."},
        ],
        "checklist": [
            {"action": "Inspect godown", "why": "Check", "fact_id": "val_stock_gap_pct"},
        ],
    }

    is_valid, msg = validate_explanation(invalid_output, sample_payload)
    assert is_valid is False
    assert "unknown fact_id" in msg.lower()


def test_invented_number_rejected(sample_payload):
    # Number 99.9 does not appear in allowed_numbers
    invented_num_output = {
        "reason": "Shop showed an anomaly of 99.9 percent which was not measured.",
        "evidence": [
            {"fact_id": "val_stock_gap_pct", "statement": "Stock gap of 10.5% recorded."},
        ],
        "checklist": [
            {"action": "Inspect godown", "why": "Check stock", "fact_id": "val_stock_gap_pct"},
        ],
    }

    is_valid, msg = validate_explanation(invented_num_output, sample_payload)
    assert is_valid is False
    assert "invented number" in msg.lower()


def test_empty_checklist_rejected(sample_payload):
    empty_chk_output = {
        "reason": "Valid reason without checklist.",
        "evidence": [
            {"fact_id": "val_stock_gap_pct", "statement": "Stock gap of 10.5% recorded."},
        ],
        "checklist": [],
    }

    is_valid, msg = validate_explanation(empty_chk_output, sample_payload)
    assert is_valid is False
    assert "checklist" in msg.lower()


def test_fallback_to_template_when_no_api_key(tmp_path, sample_payload):
    db_file = tmp_path / "test_expl.db"
    init_db(db_file)
    conn = get_connection(db_file)
    conn.execute(
        """
        INSERT INTO shops (shop_id, name, district, taluka, cards_count, vulnerability_index)
        VALUES ('FPS-00001', 'Shop 1', 'Ahmedabad', 'Taluka 1', 300, 0.25);
        """
    )
    conn.commit()

    expl = get_or_generate_explanation(
        payload=sample_payload,
        stock_recon={"gap_kg": 150.0, "direction": "shortfall"},
        board_check={"board_kg": 400.0, "mismatch_pct": 0.0},
        breakdown=[{
            "key": "stock_gap_pct", "label": "Stock gap",
            "points": 25.0, "value": 10.5, "unit": "%",
        }],
        conn=conn,
        use_llm=True,
        groq_client=None,
    )

    assert expl["source"] == "template"
    assert len(expl["checklist"]) > 0
    assert len(expl["evidence"]) > 0
    conn.close()


def test_fake_client_success_and_cache_hit(tmp_path, sample_payload):
    db_file = tmp_path / "test_cache.db"
    init_db(db_file)
    conn = get_connection(db_file)
    conn.execute(
        """
        INSERT INTO shops (shop_id, name, district, taluka, cards_count, vulnerability_index)
        VALUES ('FPS-00001', 'Shop 1', 'Ahmedabad', 'Taluka 1', 300, 0.25);
        """
    )
    conn.commit()

    fake_response = {
        "reason": "Possible irregularity noted with risk score of 45.0 points.",
        "evidence": [{"fact_id": "risk_score", "statement": "Total score is 45.0 points."}],
        "checklist": [
            {
                "action": "Verify shop records",
                "why": "Score of 45.0 needs review",
                "fact_id": "risk_score",
            }
        ],
    }

    mock_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps(fake_response)
    mock_client.chat.completions.create.return_value.choices = [mock_choice]

    expl1 = get_or_generate_explanation(
        payload=sample_payload,
        stock_recon={},
        board_check={},
        breakdown=[],
        conn=conn,
        use_llm=True,
        groq_client=mock_client,
    )
    assert expl1["source"] == "groq"
    assert mock_client.chat.completions.create.call_count == 1

    expl2 = get_or_generate_explanation(
        payload=sample_payload,
        stock_recon={},
        board_check={},
        breakdown=[],
        conn=conn,
        use_llm=True,
        groq_client=mock_client,
    )
    assert expl2["source"] == "groq"
    assert mock_client.chat.completions.create.call_count == 1  # Cache hit!
    conn.close()


def test_client_error_falls_back_to_template(tmp_path, sample_payload):
    db_file = tmp_path / "test_err.db"
    init_db(db_file)
    conn = get_connection(db_file)
    conn.execute(
        """
        INSERT INTO shops (shop_id, name, district, taluka, cards_count, vulnerability_index)
        VALUES ('FPS-00001', 'Shop 1', 'Ahmedabad', 'Taluka 1', 300, 0.25);
        """
    )
    conn.commit()

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = RuntimeError("Groq rate limit or timeout")

    expl = get_or_generate_explanation(
        payload=sample_payload,
        stock_recon={"gap_kg": 150.0, "direction": "shortfall"},
        board_check={"board_kg": 400.0, "mismatch_pct": 0.0},
        breakdown=[{
            "key": "stock_gap_pct", "label": "Stock gap",
            "points": 25.0, "value": 10.5, "unit": "%",
        }],
        conn=conn,
        use_llm=True,
        groq_client=mock_client,
    )

    assert expl["source"] == "template"
    conn.close()
