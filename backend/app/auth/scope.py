"""Scope filtering utilities to enforce geographic and role boundaries at the database level."""

import sqlite3
from typing import Any, Dict, List, Optional, Tuple

from fastapi import Depends, HTTPException, status

from app.auth.dependencies import get_current_user


class ScopeFilter:
    """Encapsulates a user's geographic and assignment scope."""

    def __init__(self, user: Dict[str, Any]):
        self.user = user
        self.role: str = user.get("role", "")
        self.user_id: str = user.get("user_id", "")
        self.district: Optional[str] = user.get("district")
        self.taluka: Optional[str] = user.get("taluka")

    @property
    def is_state_level(self) -> bool:
        return self.role in ("admin", "vigilance")

    def sql_filter(self, table_alias: str = "s") -> Tuple[str, List[Any]]:
        """
        Returns SQL WHERE clause and parameter list for filtering shops or cases.
        table_alias should reference a table (or JOIN) with district, taluka, inspector_id.
        """
        prefix = f"{table_alias}." if table_alias else ""
        if self.role in ("admin", "vigilance"):
            return "1=1", []
        if self.role == "district_officer":
            return f"{prefix}district = ?", [self.district]
        if self.role == "mamlatdar":
            return f"{prefix}district = ? AND {prefix}taluka = ?", [self.district, self.taluka]
        if self.role == "inspector":
            return f"{prefix}inspector_id = ?", [self.user_id]
        return "1=0", []

    def validate_requested_area(
        self,
        district: Optional[str] = None,
        taluka: Optional[str] = None,
    ) -> None:
        """
        Raises 404 if the client queries for an area outside their scope.
        Returning 404 prevents leaking whether out-of-scope areas or records exist.
        """
        if self.role in ("admin", "vigilance"):
            return

        if self.role == "district_officer":
            if district and district != self.district:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={
                        "code": "AREA_NOT_FOUND",
                        "message": f"District '{district}' not found",
                    },
                )

        if self.role in ("mamlatdar", "inspector"):
            if district and district != self.district:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={
                        "code": "AREA_NOT_FOUND",
                        "message": f"District '{district}' not found",
                    },
                )
            if taluka and taluka != self.taluka:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "AREA_NOT_FOUND", "message": f"Taluka '{taluka}' not found"},
                )

    def is_shop_in_scope(self, conn: sqlite3.Connection, shop_id: str) -> bool:
        """Checks if a shop_id is within the user's scope."""
        cursor = conn.cursor()
        cursor.execute(
            "SELECT district, taluka, inspector_id FROM shops WHERE shop_id = ?",
            (shop_id,),
        )
        row = cursor.fetchone()
        if not row:
            return False
        if self.role in ("admin", "vigilance"):
            return True
        if self.role == "district_officer":
            return row["district"] == self.district
        if self.role == "mamlatdar":
            return row["district"] == self.district and row["taluka"] == self.taluka
        if self.role == "inspector":
            return row["inspector_id"] == self.user_id
        return False

    def require_shop_in_scope(self, conn: sqlite3.Connection, shop_id: str) -> None:
        """Raises 404 if shop does not exist or is out of user scope."""
        if not self.is_shop_in_scope(conn, shop_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "SHOP_NOT_FOUND", "message": f"Shop {shop_id} not found"},
            )


def get_scope_filter(current_user: Dict[str, Any] = Depends(get_current_user)) -> ScopeFilter:
    """Dependency producing a ScopeFilter for the authenticated user."""
    return ScopeFilter(current_user)
