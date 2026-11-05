"""Orchestrates explanation generation with Groq, validation, caching, and template fallback."""

import json
import logging
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.llm.facts import compute_facts_hash
from app.llm.groq_client import generate_llm_explanation
from app.llm.templates import generate_template_explanation
from app.llm.validate import validate_explanation

logger = logging.getLogger(__name__)


def get_or_generate_explanation(
    payload: Dict[str, Any],
    stock_recon: Dict[str, Any],
    board_check: Dict[str, Any],
    breakdown: List[Dict[str, Any]],
    conn: sqlite3.Connection,
    use_llm: bool = True,
    groq_client: Any = None,
) -> Dict[str, Any]:
    """Retrieves cached explanation or generates new one via LLM (with template fallback)."""
    shop_id = payload["shop_id"]
    week_start = payload["week"]
    facts_hash = payload.get("facts_hash") or compute_facts_hash(payload)

    # 1. Check Cache
    cursor = conn.cursor()
    cached = cursor.execute(
        """
        SELECT source, payload_json
        FROM explanations
        WHERE shop_id = ? AND week_start = ? AND facts_hash = ?;
        """,
        (shop_id, week_start, facts_hash),
    ).fetchone()

    if cached:
        data = json.loads(cached["payload_json"])
        data["source"] = cached["source"]
        return data

    # 2. Try LLM if enabled
    expl_data: Optional[Dict[str, Any]] = None
    source = "template"

    if use_llm:
        try:
            raw_llm = generate_llm_explanation(payload, client=groq_client)
            if raw_llm:
                is_valid, reason = validate_explanation(raw_llm, payload)
                if is_valid:
                    expl_data = raw_llm
                    source = "groq"
                else:
                    logger.info(f"LLM validation failed for {shop_id}: {reason}. Using template.")
        except Exception as e:
            logger.warning(f"Error generating LLM explanation for {shop_id}: {e}")

    # 3. Fallback to deterministic template
    if not expl_data:
        expl_data = generate_template_explanation(breakdown, stock_recon, board_check, payload)
        source = "template"

    expl_data["source"] = source

    # 4. Save to explanations cache table
    created_at = datetime.now(timezone.utc).isoformat()
    cursor.execute(
        """
        INSERT OR REPLACE INTO explanations
            (shop_id, week_start, source, payload_json, facts_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?);
        """,
        (
            shop_id,
            week_start,
            source,
            json.dumps(expl_data),
            facts_hash,
            created_at,
        ),
    )
    conn.commit()

    return expl_data
