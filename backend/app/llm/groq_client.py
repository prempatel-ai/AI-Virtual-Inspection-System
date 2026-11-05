"""Groq client for generating wording explanations with timeout and retries."""

import json
import logging
import os
import time
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an objective auditor assistant for the Public Distribution System (PDS).
You receive a verified facts payload for one Fair Price Shop.
Your task is to word an explanation and verification checklist based on the numbers provided.

Rules:
1. Use ONLY numbers and facts explicitly present in the payload. Do not invent any numbers.
2. Say 'possible' and 'requires physical verification', never accuse the shop keeper.
3. Every evidence and checklist item MUST cite a valid 'fact_id' from the payload.
4. Output MUST be valid JSON only, matching this schema:
{
  "reason": "2 to 3 sentences explaining the priority signals",
  "evidence": [{"fact_id": "string", "statement": "string"}],
  "checklist": [{"action": "string", "why": "string", "fact_id": "string"}]
}
"""


def generate_llm_explanation(
    payload: Dict[str, Any],
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    client: Any = None,
) -> Optional[Dict[str, Any]]:
    """Calls Groq API to generate worded explanation from facts payload.

    Returns None if GROQ_API_KEY is not set or on any client failure.
    """
    key = api_key or os.getenv("GROQ_API_KEY")
    if not key and client is None:
        return None

    model_name = model or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    groq_client = client
    if groq_client is None:
        try:
            from groq import Groq
            groq_client = Groq(api_key=key, timeout=10.0)
        except Exception as e:
            logger.warning(f"Could not initialize Groq client: {e}")
            return None

    user_message = f"Facts payload:\n{json.dumps(payload, indent=2)}"

    for attempt in range(3):
        try:
            response = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.0,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            if not content:
                continue
            parsed = json.loads(content)
            return parsed
        except Exception as e:
            logger.warning(f"Groq API call attempt {attempt+1} failed: {e}")
            time.sleep(0.5)

    return None
