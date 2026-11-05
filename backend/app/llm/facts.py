"""Builds structured facts payload with unique fact_ids for one shop-week."""

import hashlib
import json
from typing import Any, Dict, List, Set


def compute_facts_hash(payload: Dict[str, Any]) -> str:
    """Computes deterministic SHA-256 hash of facts payload."""
    canonical = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


def build_facts_payload(
    shop_meta: Dict[str, Any],
    week_start: str,
    risk_score: float,
    band: str,
    breakdown: List[Dict[str, Any]],
    stock_recon: Dict[str, Any],
    board_check: Dict[str, Any],
    complaints: List[Dict[str, Any]],
    recent_series: Dict[str, Any],
) -> Dict[str, Any]:
    """Builds structured facts payload where every fact has a fact_id and allowed number."""
    facts: List[Dict[str, Any]] = []
    allowed_numbers: Set[float] = set()

    def add_fact(fact_id: str, name: str, val: float | int | None, unit: str = "") -> None:
        if val is None:
            return
        num = round(float(val), 2)
        facts.append({
            "fact_id": fact_id,
            "name": name,
            "value": num,
            "unit": unit,
        })
        allowed_numbers.add(num)
        allowed_numbers.add(round(num, 0))
        allowed_numbers.add(round(num, 1))

    # 1. High-level score facts
    add_fact("risk_score", "Total risk score", risk_score, "points")
    add_fact(
        "vulnerability_index",
        "Vulnerability index",
        shop_meta.get("vulnerability_index"),
        "index",
    )
    add_fact("cards_count", "Cards count", shop_meta.get("cards_count"), "cards")

    # 2. Breakdown points and values
    for item in breakdown:
        key = item["key"]
        pts = item["points"]
        val = item.get("value")
        unit = item.get("unit", "")
        add_fact(f"pts_{key}", f"{item['label']} points", pts, "points")
        if val is not None:
            add_fact(f"val_{key}", f"{item['label']} value", val, unit)
        if item.get("own_median") is not None:
            add_fact(f"own_med_{key}", f"{item['label']} own median", item["own_median"], unit)
        if item.get("peer_median") is not None:
            add_fact(f"peer_med_{key}", f"{item['label']} peer median", item["peer_median"], unit)
        if item.get("z") is not None:
            add_fact(f"z_{key}", f"{item['label']} z-score", item["z"], "z")

    # 3. Stock reconciliation figures
    add_fact("stock_opening_kg", "Opening stock", stock_recon.get("opening_kg"), "kg")
    add_fact("stock_received_kg", "Received stock", stock_recon.get("received_kg"), "kg")
    add_fact("stock_sold_kg", "Sold stock", stock_recon.get("sold_kg"), "kg")
    add_fact("stock_closing_kg", "Closing stock", stock_recon.get("closing_kg"), "kg")
    add_fact("stock_gap_kg", "Stock gap kg", stock_recon.get("gap_kg"), "kg")
    add_fact("stock_gap_pct", "Stock gap percentage", stock_recon.get("gap_pct"), "%")

    # 4. Board check figures
    add_fact("board_kg", "Notice board distributed stock", board_check.get("board_kg"), "kg")
    add_fact(
        "board_mismatch_pct",
        "Notice board mismatch percentage",
        board_check.get("mismatch_pct"),
        "%",
    )

    # 5. Complaints by category
    for c in complaints:
        cat_clean = c["category"].replace(" ", "_")
        add_fact(f"comp_{cat_clean}", f"Complaints: {c['category']}", c["count"], "complaints")

    # 6. Recent weeks series
    for sig_name, series_vals in recent_series.items():
        if isinstance(series_vals, list):
            for idx, s_val in enumerate(series_vals[-4:]):
                add_fact(f"series_{sig_name}_w{idx}", f"{sig_name} week -{3-idx}", s_val, "%")

    payload: Dict[str, Any] = {
        "shop_id": shop_meta.get("shop_id", ""),
        "name": shop_meta.get("name", ""),
        "district": shop_meta.get("district", ""),
        "taluka": shop_meta.get("taluka", ""),
        "week": week_start,
        "band": band,
        "facts": facts,
        "fact_ids": [f["fact_id"] for f in facts],
        "allowed_numbers": sorted(list(allowed_numbers)),
    }
    payload["facts_hash"] = compute_facts_hash(payload)
    return payload
