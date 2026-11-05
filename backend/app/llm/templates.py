"""Deterministic fallback explanation templates generated from computed facts."""

from typing import Any, Dict, List

from app.config import load_checklists


def generate_template_explanation(
    breakdown: List[Dict[str, Any]],
    stock_recon: Dict[str, Any],
    board_check: Dict[str, Any],
    facts_payload: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Generates standard template explanation matching the LLM output schema."""
    checklists_cfg = load_checklists().get("signals", {})

    # Top signals sorted by points (excluding vulnerability_uplift)
    signals = [
        item for item in breakdown
        if item["key"] != "vulnerability_uplift" and item["points"] > 0
    ]
    signals.sort(key=lambda x: x["points"], reverse=True)
    top_signals = signals[:3]

    if not top_signals:
        reason = "Shop operations conform to peer baselines with low risk indicators."
        evidence: List[Dict[str, str]] = []
        checklist: List[Dict[str, str]] = [{
            "action": "Routine annual compliance audit",
            "why": "Shop is operating within normal variance parameters",
            "fact_id": "risk_score",
        }]
    else:
        sig_names = ", ".join(f"{s['label'].lower()} ({s['points']:.1f} pts)" for s in top_signals)
        reason = (
            f"Shop was prioritized due to elevated risk points in {sig_names}. "
            "Physical verification of registers and stock records is recommended."
        )

        evidence = []
        checklist = []

        for s in top_signals:
            key = s["key"]
            pts = s["points"]
            val = s["value"]
            unit = s["unit"]
            fact_id = f"val_{key}"

            # Evidence text
            if key == "stock_gap_pct":
                gap_kg = stock_recon.get("gap_kg", 0)
                direction = stock_recon.get("direction", "shortfall")
                stmt = f"Stock records show a {direction} of {gap_kg:.1f} kg ({val:.1f}% gap)."
            elif key == "board_mismatch_pct":
                stmt = f"Notice board distribution differs from sales volume by {val:.1f}%."
            elif key == "unauth_share":
                stmt = f"Unauthenticated override sales account for {val:.1f}% of transactions."
            elif key == "auth_fail_rate":
                stmt = f"Biometric auth failure rate reached {val:.1f}%."
            elif key == "complaints_rate":
                stmt = f"Complaint rate reached {val:.1f} per 100 transactions."
            else:
                stmt = f"{s['label']} value recorded at {val:.1f} {unit}."

            evidence.append({"fact_id": fact_id, "statement": stmt})

            # Checklist item from checklists.yaml
            chk = checklists_cfg.get(key, {
                "action": f"Verify {s['label'].lower()}",
                "why": f"Score points ({pts:.1f}) indicate anomalous pattern",
            })
            checklist.append({
                "action": chk["action"],
                "why": chk["why"],
                "fact_id": fact_id,
            })

    return {
        "source": "template",
        "reason": reason,
        "evidence": evidence,
        "checklist": checklist,
    }
