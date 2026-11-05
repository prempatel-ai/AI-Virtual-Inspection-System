"""Tests for admin endpoints: user management, password reset, and access log."""

import os

import pytest
from fastapi.testclient import TestClient

from app.auth.security import hash_password, verify_password
from app.db import get_connection
from app.main import app


@pytest.fixture
def admin_api_db(tmp_path):
    db_file = tmp_path / "admin_test.db"
    old_db = os.environ.get("DB_PATH")
    os.environ["DB_PATH"] = str(db_file)

    conn = get_connection(db_file)
    with open("backend/app/schema.sql", "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    pwd_hash = hash_password("adminPass123")
    conn.execute(
        """
        INSERT INTO users (user_id, name, email, password_hash, role, is_active, created_at)
        VALUES
            ('adm-1', 'Admin User', 'admin@admin.test', ?, 'admin', 1, '2026-01-01T00:00:00Z'),
            ('insp-1', 'Inspector', 'insp@admin.test', ?, 'inspector', 1, '2026-01-01T00:00:00Z');
        """,
        (pwd_hash, hash_password("inspPass123")),
    )
    conn.commit()
    conn.close()

    yield db_file

    if old_db:
        os.environ["DB_PATH"] = old_db
    else:
        del os.environ["DB_PATH"]


def test_admin_users_crud_and_audit(admin_api_db):
    admin_client = TestClient(app)
    admin_client.post(
        "/auth/login",
        json={"email": "admin@admin.test", "password": "adminPass123"},
        headers={"X-Requested-With": "fetch"},
    )

    # 1. List users
    res = admin_client.get("/admin/users")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) >= 2
    # Ensure password_hash is never present
    for u in data["items"]:
        assert "password_hash" not in u

    # 2. Create new user
    create_res = admin_client.post(
        "/admin/users",
        json={
            "name": "New Mamlatdar",
            "email": "new.mam@admin.test",
            "role": "mamlatdar",
            "district": "Ahmedabad",
            "taluka": "Ahmedabad Taluka 1",
        },
        headers={"X-Requested-With": "fetch"},
    )
    assert create_res.status_code == 200
    created = create_res.json()
    new_user_id = created["user"]["user_id"]
    temp_pw = created["temporary_password"]
    assert len(temp_pw) >= 10
    assert created["user"]["email"] == "new.mam@admin.test"

    # Verify temp password verifies with hash in database
    conn = get_connection(admin_api_db)
    u_row = conn.execute(
        "SELECT password_hash FROM users WHERE user_id = ?;", (new_user_id,)
    ).fetchone()
    assert verify_password(u_row["password_hash"], temp_pw)
    conn.close()

    # 3. Update user (deactivate)
    patch_res = admin_client.patch(
        f"/admin/users/{new_user_id}",
        json={"is_active": False},
        headers={"X-Requested-With": "fetch"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["is_active"] is False

    # 4. Reset password
    reset_res = admin_client.post(
        f"/admin/users/{new_user_id}/reset-password",
        headers={"X-Requested-With": "fetch"},
    )
    assert reset_res.status_code == 200
    new_temp_pw = reset_res.json()["temporary_password"]
    assert len(new_temp_pw) >= 10

    # 5. Access audit log
    audit_res = admin_client.get("/admin/audit")
    assert audit_res.status_code == 200
    events = [a["event"] for a in audit_res.json()["items"]]
    assert "user_created" in events
    assert "user_deactivated" in events
    assert "password_reset" in events


def test_non_admin_forbidden_on_admin_routes(admin_api_db):
    insp_client = TestClient(app)
    insp_client.post(
        "/auth/login",
        json={"email": "insp@admin.test", "password": "inspPass123"},
        headers={"X-Requested-With": "fetch"},
    )

    assert insp_client.get("/admin/users").status_code == 403
    assert (
        insp_client.post(
            "/admin/users",
            json={"name": "A", "email": "a@a.com", "role": "admin"},
            headers={"X-Requested-With": "fetch"},
        ).status_code
        == 403
    )
    assert insp_client.get("/admin/audit").status_code == 403
