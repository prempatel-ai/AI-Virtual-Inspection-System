"""RBAC Matrix Tests generated from endpoint definitions and the permission table."""

import os
from typing import Any, Dict, Generator, List, Optional, Tuple

import pytest
from fastapi.testclient import TestClient

from app.auth.permissions import has_permission
from app.auth.security import hash_password
from app.data.generator import generate_pds_data
from app.db import get_connection
from app.main import app
from app.pipeline.run import run_pipeline_for_week

ROLES = ["inspector", "mamlatdar", "district_officer", "vigilance", "admin"]

# Endpoint specification table:
# (name, method, path_template, permission_required, is_state_changing, test_payload)
ENDPOINT_SPECS: List[Tuple[str, str, str, Optional[str], bool, Optional[Dict[str, Any]]]] = [
    ("health", "GET", "/health", None, False, None),
    (
        "auth_login",
        "POST",
        "/auth/login",
        None,
        True,
        {"email": "test@demo.invalid", "password": "any"},
    ),
    ("auth_logout", "POST", "/auth/logout", None, True, {}),
    ("auth_me", "GET", "/auth/me", None, False, None),
    ("meta", "GET", "/meta", None, False, None),
    ("summary", "GET", "/summary", "flags:view", False, None),
    ("shops_ranked", "GET", "/shops/ranked", "flags:view", False, None),
    ("shop_detail_in_scope", "GET", "/shops/{own_shop_id}", "flags:view", False, None),
    ("run_pipeline", "POST", "/run", "run:execute", True, {"top_k": 5}),
]


@pytest.fixture(scope="module", autouse=True)
def rbac_test_env(tmp_path_factory) -> Generator[Dict[str, str], None, None]:
    db_file = tmp_path_factory.mktemp("rbac_test") / "pds.db"
    os.environ["DB_PATH"] = str(db_file)
    generate_pds_data(num_shops=60, num_weeks=12, seed=42, db_path=db_file)
    run_pipeline_for_week(db_path=db_file)

    conn = get_connection(db_file)
    cursor = conn.cursor()

    pwd_hash = hash_password("password123")

    # Pick first shop for Ahmedabad Taluka 1
    cursor.execute(
        """
        SELECT shop_id FROM shops
        WHERE district = 'Ahmedabad' AND taluka = 'Ahmedabad Taluka 1'
        LIMIT 1;
        """
    )
    own_shop_id = cursor.fetchone()["shop_id"]

    # Pick shop outside Ahmedabad (e.g. Surat)
    cursor.execute("SELECT shop_id FROM shops WHERE district != 'Ahmedabad' LIMIT 1;")
    foreign_shop_id = cursor.fetchone()["shop_id"]

    # Insert users for each role
    cursor.execute(
        """
        INSERT INTO users (
            user_id, name, email, password_hash, role, district, taluka, is_active, created_at
        ) VALUES
        ('u-insp', 'Insp User', 'insp@demo.invalid', ?, 'inspector',
         'Ahmedabad', 'Ahmedabad Taluka 1', 1, '2026-11-05T00:00:00Z'),
        ('u-mam', 'Mam User', 'mam@demo.invalid', ?, 'mamlatdar',
         'Ahmedabad', 'Ahmedabad Taluka 1', 1, '2026-11-05T00:00:00Z'),
        ('u-do', 'DO User', 'do@demo.invalid', ?, 'district_officer',
         'Ahmedabad', NULL, 1, '2026-11-05T00:00:00Z'),
        ('u-vig', 'Vig User', 'vig@demo.invalid', ?, 'vigilance',
         NULL, NULL, 1, '2026-11-05T00:00:00Z'),
        ('u-adm', 'Adm User', 'adm@demo.invalid', ?, 'admin',
         NULL, NULL, 1, '2026-11-05T00:00:00Z');
        """,
        (pwd_hash, pwd_hash, pwd_hash, pwd_hash, pwd_hash),
    )

    # Assign own_shop_id to inspector
    cursor.execute("UPDATE shops SET inspector_id = 'u-insp' WHERE shop_id = ?;", (own_shop_id,))
    conn.commit()
    conn.close()

    ids = {
        "own_shop_id": own_shop_id,
        "foreign_shop_id": foreign_shop_id,
    }
    yield ids
    if "DB_PATH" in os.environ:
        del os.environ["DB_PATH"]


def get_client_for_role(role: Optional[str]) -> TestClient:
    c = TestClient(app)
    if role is None:
        return c

    role_email_map = {
        "inspector": "insp@demo.invalid",
        "mamlatdar": "mam@demo.invalid",
        "district_officer": "do@demo.invalid",
        "vigilance": "vig@demo.invalid",
        "admin": "adm@demo.invalid",
    }
    email = role_email_map[role]
    login_res = c.post(
        "/auth/login",
        json={"email": email, "password": "password123"},
        headers={"X-Requested-With": "fetch"},
    )
    assert login_res.status_code == 200
    return c


@pytest.mark.parametrize("spec", ENDPOINT_SPECS, ids=[s[0] for s in ENDPOINT_SPECS])
def test_rbac_unauthenticated_matrix(spec, rbac_test_env: Dict[str, str]):
    name, method, path_template, permission_required, is_state_changing, payload = spec
    path = path_template.format(**rbac_test_env)

    client = get_client_for_role(None)
    headers = {"X-Requested-With": "fetch"} if is_state_changing else {}

    if method == "GET":
        res = client.get(path, headers=headers)
    else:
        res = client.post(path, json=payload or {}, headers=headers)

    # Health is public (200). Login is public (validates credentials without session cookie)
    if name == "health":
        assert res.status_code == 200
    elif name == "auth_login":
        assert res.json().get("error", {}).get("code") != "UNAUTHENTICATED"
    else:
        # Every other endpoint requires session cookie
        assert res.status_code == 401, (
            f"Expected 401 for unauthenticated {method} {path}, got {res.status_code}"
        )
        assert res.json()["error"]["code"] == "UNAUTHENTICATED"


@pytest.mark.parametrize("role", ROLES)
@pytest.mark.parametrize("spec", ENDPOINT_SPECS, ids=[s[0] for s in ENDPOINT_SPECS])
def test_rbac_role_permission_matrix(role: str, spec, rbac_test_env: Dict[str, str]):
    name, method, path_template, permission_required, is_state_changing, payload = spec
    path = path_template.format(**rbac_test_env)

    # Public or login tests handled separately
    if name in ("health", "auth_login"):
        return

    client = get_client_for_role(role)
    headers = {"X-Requested-With": "fetch"} if is_state_changing else {}

    if method == "GET":
        res = client.get(path, headers=headers)
    else:
        res = client.post(path, json=payload or {}, headers=headers)

    if permission_required is None:
        # Authenticated user without specific permission required
        assert res.status_code == 200, f"Role {role} failed on {path} with {res.status_code}"
    else:
        permitted = has_permission(role, permission_required)
        if permitted:
            assert res.status_code == 200, (
                f"Role {role} should have {permission_required} for {path}, got {res.status_code}"
            )
        else:
            assert res.status_code == 403, (
                f"Role {role} should be 403 for {path}, got {res.status_code}"
            )


def test_scope_isolation_matrix(rbac_test_env: Dict[str, str]):
    foreign_shop = rbac_test_env["foreign_shop_id"]

    # Inspector cannot access foreign shop (outside inspector's assigned shops) -> 404
    insp_client = get_client_for_role("inspector")
    res_insp = insp_client.get(f"/shops/{foreign_shop}")
    assert res_insp.status_code == 404

    # Mamlatdar cannot access foreign shop (outside taluka) -> 404
    mam_client = get_client_for_role("mamlatdar")
    res_mam = mam_client.get(f"/shops/{foreign_shop}")
    assert res_mam.status_code == 404

    # District officer cannot access foreign shop (outside district) -> 404
    do_client = get_client_for_role("district_officer")
    res_do = do_client.get(f"/shops/{foreign_shop}")
    assert res_do.status_code == 404

    # Vigilance and Admin have state scope -> 200
    vig_client = get_client_for_role("vigilance")
    assert vig_client.get(f"/shops/{foreign_shop}").status_code == 200

    adm_client = get_client_for_role("admin")
    assert adm_client.get(f"/shops/{foreign_shop}").status_code == 200
