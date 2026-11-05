"""Unit tests for authentication, session handling, lockout, and CSRF enforcement."""

import os
from typing import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.security import hash_password, verify_password
from app.db import get_connection, init_db
from app.main import app


@pytest.fixture
def test_db(tmp_path) -> Generator[str, None, None]:
    """Creates a fresh test database with schema and a test inspector user."""
    db_file = str(tmp_path / "test_auth.db")
    os.environ["DB_PATH"] = db_file
    init_db(db_file)

    conn = get_connection(db_file)
    cursor = conn.cursor()
    # Insert test inspector
    hashed = hash_password("validPassword123")
    cursor.execute(
        """
        INSERT INTO users (
            user_id, name, email, password_hash, role, district, taluka, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "usr-insp-1",
            "Inspector Test",
            "inspector.1@demo.invalid",
            hashed,
            "inspector",
            "Ahmedabad",
            "Ahmedabad Taluka 1",
            1,
            "2026-11-05T10:00:00Z",
        ),
    )
    # Insert inactive user
    cursor.execute(
        """
        INSERT INTO users (
            user_id, name, email, password_hash, role, district, taluka, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "usr-inactive-1",
            "Inactive User",
            "inactive@demo.invalid",
            hashed,
            "inspector",
            "Ahmedabad",
            "Ahmedabad Taluka 1",
            0,
            "2026-11-05T10:00:00Z",
        ),
    )
    conn.commit()
    conn.close()

    yield db_file


@pytest.fixture
def client(test_db) -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


def test_argon2_hashing():
    pwd = "mySecurePassword!9"
    h = hash_password(pwd)
    assert h != pwd
    assert h.startswith("$argon2")
    assert verify_password(h, pwd) is True
    assert verify_password(h, "wrongPassword") is False


def test_csrf_header_required_on_login(client: TestClient):
    # Without X-Requested-With header
    res = client.post(
        "/auth/login",
        json={"email": "inspector.1@demo.invalid", "password": "validPassword123"},
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "CSRF_REQUIRED"


def test_login_invalid_credentials_generic_message(client: TestClient, test_db: str):
    headers = {"X-Requested-With": "fetch"}

    # Non-existent email
    res = client.post(
        "/auth/login",
        json={"email": "nonexistent@demo.invalid", "password": "validPassword123"},
        headers=headers,
    )
    assert res.status_code == 401
    assert res.json()["error"]["message"] == "Invalid email or password"

    # Existing email, wrong password
    res = client.post(
        "/auth/login",
        json={"email": "inspector.1@demo.invalid", "password": "wrongPassword123"},
        headers=headers,
    )
    assert res.status_code == 401
    assert res.json()["error"]["message"] == "Invalid email or password"

    # Inactive user
    res = client.post(
        "/auth/login",
        json={"email": "inactive@demo.invalid", "password": "validPassword123"},
        headers=headers,
    )
    assert res.status_code == 401
    assert res.json()["error"]["message"] == "Invalid email or password"

    # Check audit log entries
    conn = get_connection(test_db)
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) as cnt FROM audit_log WHERE event = 'login_failed'")
    assert cursor.fetchone()["cnt"] == 3
    conn.close()


def test_login_success_cookie_and_me(client: TestClient, test_db: str):
    headers = {"X-Requested-With": "fetch"}
    res = client.post(
        "/auth/login",
        json={"email": "inspector.1@demo.invalid", "password": "validPassword123"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()

    # Verify no password_hash leaks
    assert "password_hash" not in str(data)
    assert data["user"]["user_id"] == "usr-insp-1"
    assert data["user"]["role"] == "inspector"
    assert "flags:view" in data["permissions"]
    assert data["scope"]["level"] == "inspector"

    # Verify cookie flags
    cookie_header = res.headers.get("set-cookie", "")
    assert "session=" in cookie_header
    assert "HttpOnly" in cookie_header
    assert "samesite=lax" in cookie_header.lower()

    # GET /auth/me using the session cookie
    me_res = client.get("/auth/me")
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["user"]["user_id"] == "usr-insp-1"
    assert "password_hash" not in str(me_data)

    # Verify audit log recorded login_success
    conn = get_connection(test_db)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_log WHERE event = 'login_success'")
    row = cursor.fetchone()
    assert row is not None
    assert row["actor_id"] == "usr-insp-1"
    conn.close()


def test_session_revalidation_immediate_revocation(client: TestClient, test_db: str):
    headers = {"X-Requested-With": "fetch"}
    # Login
    res = client.post(
        "/auth/login",
        json={"email": "inspector.1@demo.invalid", "password": "validPassword123"},
        headers=headers,
    )
    assert res.status_code == 200

    # Verify /auth/me works
    assert client.get("/auth/me").status_code == 200

    # Deactivate the user in DB
    conn = get_connection(test_db)
    conn.execute("UPDATE users SET is_active = 0 WHERE user_id = 'usr-insp-1'")
    conn.commit()
    conn.close()

    # Next request immediately rejected
    revoked_res = client.get("/auth/me")
    assert revoked_res.status_code == 401
    assert revoked_res.json()["error"]["code"] == "UNAUTHENTICATED"


def test_account_lockout_after_max_failed_logins(client: TestClient, test_db: str):
    headers = {"X-Requested-With": "fetch"}
    email = "inspector.1@demo.invalid"

    # 5 failed attempts
    for _ in range(5):
        res = client.post(
            "/auth/login",
            json={"email": email, "password": "wrongPassword"},
            headers=headers,
        )
        assert res.status_code == 401

    # 6th attempt should be locked (429)
    locked_res = client.post(
        "/auth/login",
        json={"email": email, "password": "validPassword123"},
        headers=headers,
    )
    assert locked_res.status_code == 429
    assert locked_res.json()["error"]["code"] == "ACCOUNT_LOCKED"


def test_logout(client: TestClient, test_db: str):
    headers = {"X-Requested-With": "fetch"}
    # Login
    client.post(
        "/auth/login",
        json={"email": "inspector.1@demo.invalid", "password": "validPassword123"},
        headers=headers,
    )

    # Logout
    logout_res = client.post("/auth/logout", headers=headers)
    assert logout_res.status_code == 200
    assert logout_res.json()["status"] == "ok"

    # GET /auth/me now returns 401
    assert client.get("/auth/me").status_code == 401

    # Verify audit log recorded logout
    conn = get_connection(test_db)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_log WHERE event = 'logout'")
    assert cursor.fetchone() is not None
    conn.close()


def test_startup_fails_without_jwt_secret():
    old_secret = os.environ.pop("JWT_SECRET", None)
    try:
        with pytest.raises(RuntimeError, match="JWT_SECRET environment variable is required"):
            with TestClient(app):
                pass
    finally:
        if old_secret:
            os.environ["JWT_SECRET"] = old_secret
