"""API integration and specification conformity tests."""

import os

import pytest
from fastapi.testclient import TestClient

from app.auth.security import hash_password
from app.data.generator import generate_pds_data
from app.db import get_connection
from app.main import app
from app.pipeline.run import run_pipeline_for_week


@pytest.fixture(scope="module", autouse=True)
def setup_api_data(tmp_path_factory):
    # Setup test database and generate data
    db_file = tmp_path_factory.mktemp("api_test") / "pds.db"
    os.environ["DB_PATH"] = str(db_file)
    generate_pds_data(num_shops=100, num_weeks=12, seed=42, db_path=db_file)
    run_pipeline_for_week(db_path=db_file)

    conn = get_connection(db_file)
    cursor = conn.cursor()
    # Create test admin user
    cursor.execute(
        """
        INSERT INTO users (user_id, name, email, password_hash, role, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "usr-admin-1",
            "Admin User",
            "admin@demo.invalid",
            hash_password("adminPassword123"),
            "admin",
            1,
            "2026-11-05T00:00:00Z",
        ),
    )
    # Create test inspector in Ahmedabad Taluka 1
    cursor.execute(
        """
        INSERT INTO users (
            user_id, name, email, password_hash, role, district, taluka, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "usr-insp-ahmedabad",
            "Ahmedabad Inspector",
            "inspector.ahm@demo.invalid",
            hash_password("inspectorPassword123"),
            "inspector",
            "Ahmedabad",
            "Ahmedabad Taluka 1",
            1,
            "2026-11-05T00:00:00Z",
        ),
    )
    # Assign first shop to inspector
    cursor.execute(
        "UPDATE shops SET inspector_id = 'usr-insp-ahmedabad' WHERE shop_id = 'FPS-00001'"
    )
    conn.commit()
    conn.close()

    yield
    if "DB_PATH" in os.environ:
        del os.environ["DB_PATH"]


@pytest.fixture
def admin_client() -> TestClient:
    c = TestClient(app)
    c.post(
        "/auth/login",
        json={"email": "admin@demo.invalid", "password": "adminPassword123"},
        headers={"X-Requested-With": "fetch"},
    )
    return c


@pytest.fixture
def inspector_client() -> TestClient:
    c = TestClient(app)
    c.post(
        "/auth/login",
        json={"email": "inspector.ahm@demo.invalid", "password": "inspectorPassword123"},
        headers={"X-Requested-With": "fetch"},
    )
    return c


def test_get_health():
    unauthed_client = TestClient(app)
    res = unauthed_client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_unauthenticated_requests_fail_with_401():
    unauthed_client = TestClient(app)
    assert unauthed_client.get("/meta").status_code == 401
    assert unauthed_client.get("/summary").status_code == 401
    assert unauthed_client.get("/shops/ranked").status_code == 401
    assert unauthed_client.get("/shops/FPS-00001").status_code == 401
    assert unauthed_client.post("/run", headers={"X-Requested-With": "fetch"}).status_code == 401


def test_get_meta(admin_client: TestClient):
    res = admin_client.get("/meta")
    assert res.status_code == 200
    data = res.json()
    assert data["synthetic"] is True
    assert len(data["weeks"]) == 12
    assert data["latest_week"] == "2026-11-02"
    assert "Ahmedabad" in data["districts"]
    assert "Ahmedabad" in data["talukas"]
    assert data["shops_count"] == 100
    assert data["has_run"] is True


def test_get_summary_and_feedback_update(admin_client: TestClient):
    # 1. Summary before feedback
    res = admin_client.get("/summary?week=2026-11-02")
    assert res.status_code == 200
    data = res.json()
    assert data["week"] == "2026-11-02"
    assert data["shops_monitored"] == 100
    assert data["flagged"] >= 0
    assert data["evaluation"]["on_synthetic_data"] is True
    assert data["visits_recorded"] == 0
    assert data["confirmed_rate"] is None

    # 2. Record feedback
    fb_res = admin_client.post(
        "/shops/FPS-00001/feedback",
        json={"week": "2026-11-02", "outcome": "confirmed", "note": "Verified stock gap"},
        headers={"X-Requested-With": "fetch"},
    )
    assert fb_res.status_code == 200
    fb_data = fb_res.json()
    assert fb_data["shop_id"] == "FPS-00001"
    assert fb_data["outcome"] == "confirmed"

    # 3. Summary after feedback
    res_after = admin_client.get("/summary?week=2026-11-02")
    data_after = res_after.json()
    assert data_after["visits_recorded"] == 1
    assert data_after["confirmed_rate"] == 1.0


def test_ranked_shops_filters_and_pagination(admin_client: TestClient):
    # Ranked default (only medium and high band)
    res = admin_client.get("/shops/ranked?week=2026-11-02")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "items" in data
    items = data["items"]
    if items:
        # Check sorted descending
        scores = [item["risk_score"] for item in items]
        assert scores == sorted(scores, reverse=True)
        # Default includes only high and medium
        for item in items:
            assert item["band"] in ("high", "medium")

    # Filter by band=low
    res_low = admin_client.get("/shops/ranked?week=2026-11-02&band=low")
    assert res_low.status_code == 200
    low_data = res_low.json()
    for item in low_data["items"]:
        assert item["band"] == "low"

    # Pagination
    res_page = admin_client.get("/shops/ranked?week=2026-11-02&limit=5&offset=0")
    assert res_page.status_code == 200
    assert len(res_page.json()["items"]) <= 5


def test_shop_detail_no_ground_truth_leak_and_404(admin_client: TestClient):
    # Unknown shop returns 404 with error detail
    res_404 = admin_client.get("/shops/NON_EXISTENT?week=2026-11-02")
    assert res_404.status_code == 404
    assert res_404.json()["error"]["code"] == "SHOP_NOT_FOUND"

    # Real shop
    res = admin_client.get("/shops/FPS-00001?week=2026-11-02")
    assert res.status_code == 200
    data = res.json()
    assert data["shop"]["shop_id"] == "FPS-00001"
    assert "risk_score" in data
    assert "breakdown" in data
    assert "history" in data
    assert "stock_reconciliation" in data
    assert "board_check" in data
    assert "complaints" in data
    assert "explanation" in data
    assert "feedback" in data

    # Ground truth leak test: ground_truth, scenario, planted_label must NOT exist
    raw_str = res.text.lower()
    assert "planted" not in raw_str
    assert "ground_truth" not in raw_str
    assert "scenario" not in raw_str


def test_scope_isolation_inspector_404(inspector_client: TestClient):
    # Inspector is assigned to FPS-00001 only.
    # Can access FPS-00001
    res_own = inspector_client.get("/shops/FPS-00001")
    assert res_own.status_code == 200

    # Cannot access FPS-00002 (assigned to someone else or unassigned) -> Returns 404!
    res_other = inspector_client.get("/shops/FPS-00002")
    assert res_other.status_code == 404
    assert res_other.json()["error"]["code"] == "SHOP_NOT_FOUND"

    # Querying outside their district / taluka returns 404
    res_area = inspector_client.get("/shops/ranked?district=Surat")
    assert res_area.status_code == 404


def test_feedback_validation_and_404(admin_client: TestClient):
    headers = {"X-Requested-With": "fetch"}
    # Unknown shop feedback
    res_404 = admin_client.post(
        "/shops/FPS-99999/feedback",
        json={"week": "2026-11-02", "outcome": "confirmed"},
        headers=headers,
    )
    assert res_404.status_code == 404
    assert res_404.json()["error"]["code"] == "SHOP_NOT_FOUND"

    # Invalid outcome returns 422
    res_422 = admin_client.post(
        "/shops/FPS-00001/feedback",
        json={"week": "2026-11-02", "outcome": "invalid_outcome"},
        headers=headers,
    )
    assert res_422.status_code == 422
    assert "error" in res_422.json()


def test_post_run(admin_client: TestClient, inspector_client: TestClient):
    headers = {"X-Requested-With": "fetch"}
    # Inspector cannot run pipeline (forbidden)
    insp_res = inspector_client.post(
        "/run", json={"week": "2026-11-02", "top_k": 10}, headers=headers
    )
    assert insp_res.status_code == 403

    # Admin can run pipeline
    res = admin_client.post("/run", json={"week": "2026-11-02", "top_k": 10}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["week"] == "2026-11-02"
    assert data["shops_scored"] == 100
    assert data["duration_ms"] >= 0
