"""Validation of LLM-generated explanations against facts payload."""

import re
from typing import Any, Dict, List, Set, Tuple

NUMBER_REGEX = re.compile(r"(?<![a-zA-Z0-9_])-?\d+(?:\.\d+)?")


def extract_numbers_from_text(text: str) -> List[float]:
    """Extracts floating point numbers from a text string, ignoring YYYY-MM-DD dates."""
    clean_text = re.sub(r"\b\d{4}-\d{2}-\d{2}\b", " ", text)
    matches = NUMBER_REGEX.findall(clean_text)
    numbers: List[float] = []
    for m in matches:
        try:
            numbers.append(float(m))
        except ValueError:
            continue
    return numbers


def validate_explanation(
    output: Any,
    payload: Dict[str, Any],
) -> Tuple[bool, str]:
    """Validates LLM output against strict schema and factual accuracy rules.

    Rules:
    1. Output matches schema (reason, evidence, checklist).
    2. Every fact_id cited exists in the payload.
    3. Every number mentioned in any text appears in payload's allowed_numbers.
    4. Checklist has between 1 and 6 items.
    """
    if not isinstance(output, dict):
        return False, "Output is not a dictionary"

    reason = output.get("reason")
    evidence = output.get("evidence")
    checklist = output.get("checklist")

    if not isinstance(reason, str) or not reason.strip():
        return False, "Reason must be a non-empty string"

    if not isinstance(evidence, list):
        return False, "Evidence must be a list"

    if not isinstance(checklist, list) or len(checklist) < 1 or len(checklist) > 6:
        n_items = len(checklist) if isinstance(checklist, list) else 0
        return False, f"Checklist must have between 1 and 6 items (got {n_items})"

    valid_fact_ids: Set[str] = set(payload.get("fact_ids", []))
    allowed_numbers: Set[float] = set(
        round(float(n), 2) for n in payload.get("allowed_numbers", [])
    )
    # Also include 1-decimal and integer roundings
    allowed_roundings: Set[float] = set()
    for n in allowed_numbers:
        allowed_roundings.add(round(n, 1))
        allowed_roundings.add(round(n, 0))
    all_allowed = allowed_numbers.union(allowed_roundings)

    # 1. Validate Evidence items
    all_text = reason + " "
    for idx, ev in enumerate(evidence):
        if not isinstance(ev, dict):
            return False, f"Evidence item {idx} is not a dictionary"
        f_id = ev.get("fact_id")
        stmt = ev.get("statement")
        if not f_id or f_id not in valid_fact_ids:
            return False, f"Evidence item {idx} has unknown fact_id: {f_id}"
        if not isinstance(stmt, str) or not stmt.strip():
            return False, f"Evidence item {idx} has empty statement"
        all_text += stmt + " "

    # 2. Validate Checklist items
    for idx, chk in enumerate(checklist):
        if not isinstance(chk, dict):
            return False, f"Checklist item {idx} is not a dictionary"
        action = chk.get("action")
        why = chk.get("why")
        f_id = chk.get("fact_id")
        if not f_id or f_id not in valid_fact_ids:
            return False, f"Checklist item {idx} has unknown fact_id: {f_id}"
        if not isinstance(action, str) or not action.strip():
            return False, f"Checklist item {idx} has empty action"
        if not isinstance(why, str) or not why.strip():
            return False, f"Checklist item {idx} has empty why"
        all_text += f"{action} {why} "

    # 3. Validate numbers in all text fields
    extracted_nums = extract_numbers_from_text(all_text)
    for num in extracted_nums:
        matched = False
        for allowed in all_allowed:
            if abs(num - allowed) < 0.05:
                matched = True
                break
        if not matched:
            return False, f"Invented number detected in explanation text: {num}"

    return True, "Valid"
