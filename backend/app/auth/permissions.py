"""Central role-based permissions matrix and scope definitions."""

from typing import Any, Dict, List

ROLE_PERMISSIONS: Dict[str, List[str]] = {
    "inspector": [
        "flags:view",
        "cases:view",
        "cases:act",
        "cases:note",
        "cases:escalate",
        "officers:view",
        "actions:view",
    ],
    "mamlatdar": [
        "flags:view",
        "cases:view",
        "cases:act",
        "cases:note",
        "cases:escalate",
        "cases:reassign",
        "cases:close",
        "cases:reopen",
        "officers:view",
        "areas:view",
        "actions:view",
    ],
    "district_officer": [
        "flags:view",
        "cases:view",
        "cases:act",
        "cases:note",
        "cases:escalate",
        "cases:reassign",
        "cases:close",
        "cases:reopen",
        "officers:view",
        "areas:view",
        "actions:view",
    ],
    "vigilance": [
        "flags:view",
        "cases:view",
        "cases:act",
        "cases:note",
        "officers:view",
        "areas:view",
        "actions:view",
    ],
    "admin": [
        "flags:view",
        "cases:view",
        "cases:note",
        "cases:reassign",
        "cases:close",
        "cases:reopen",
        "officers:view",
        "areas:view",
        "actions:view",
        "users:manage",
        "audit:view",
        "run:execute",
    ],
}


def get_user_permissions(role: str) -> List[str]:
    """Returns the list of permitted actions for the given role."""
    return ROLE_PERMISSIONS.get(role, [])


def has_permission(role: str, permission: str) -> bool:
    """Checks whether the role has a given permission."""
    return permission in get_user_permissions(role)


def get_user_scope(user: Dict[str, Any]) -> Dict[str, Any]:
    """Returns the scope dictionary for the user."""
    role = user.get("role", "")
    if role in ("admin", "vigilance"):
        return {"level": "state"}
    if role == "district_officer":
        return {"level": "district", "district": user.get("district")}
    if role == "mamlatdar":
        return {
            "level": "taluka",
            "district": user.get("district"),
            "taluka": user.get("taluka"),
        }
    if role == "inspector":
        return {
            "level": "inspector",
            "district": user.get("district"),
            "taluka": user.get("taluka"),
            "inspector_id": user.get("user_id"),
        }
    return {"level": "none"}
