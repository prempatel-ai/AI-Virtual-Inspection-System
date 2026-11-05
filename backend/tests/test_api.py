"""API integration and specification conformity tests."""

import pytest
from fastapi.testclient import TestClient

from app.data.generator import generate_pds_data
from app.main import app
from app.pipeline.run import run_pipeline_for_week


@pytest.fixture(scope="module", autouse=True)
def setup_api_data(tmp_path_factory):
    # Setup test database and generate data
    db_file = tmp_path_factory.mktemp("api_test") / "pds.db"
    generate_pds_data(num_shops=100, num_weeks=12, seed=42, db_path=db_file)
    run_pipeline_for_week(db_path=db_file)
    # Configure app env or default
    import os
    os.environ["DB_PATH"] = str(db_file)
    yield
    if "DB_PATH" in os.environ:
        del os.environ["DB_PATH"]


client = TestClient(app)


def test_get_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_get_meta():
    res = client.get("/meta")
    assert res.status_code == 200
    data = res.json()
    assert data["synthetic"] is True
    assert len(data["weeks"]) == 12
    assert data["latest_week"] == "2026-11-02"
    assert "Ahmedabad" in data["districts"]
    assert "Ahmedabad" in data["talukas"]
    assert data["shops_count"] == 100
    assert data["has_run"] is True


def test_get_summary_and_feedback_update():
    # 1. Summary before feedback
    res = client.get("/summary?week=2026-11-02")
    assert res.status_code == 200
    data = res.json()
    assert data["week"] == "2026-11-02"
    assert data["shops_monitored"] == 100
    assert data["flagged"] >= 0
    assert data["evaluation"]["on_synthetic_data"] is True
    assert data["visits_recorded"] == 0
    assert data["confirmed_rate"] is None

    # 2. Record feedback
    fb_res = client.post(
        "/shops/FPS-00001/feedback",
        json={"week": "2026-11-02", "outcome": "confirmed", "note": "Verified stock gap"},
    )
    assert fb_res.status_code == 200
    fb_data = fb_res.json()
    assert fb_data["shop_id"] == "FPS-00001"
    assert fb_data["outcome"] == "confirmed"

    # 3. Summary after feedback
    res_after = client.get("/summary?week=2026-11-02")
    data_after = res_after.json()
    assert data_after["visits_recorded"] == 1
    assert data_after["confirmed_rate"] == 1.0


def test_ranked_shops_filters_and_pagination():
    # Ranked default (only medium and high band)
    res = client.get("/shops/ranked?week=2026-11-02")
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
    res_low = client.get("/shops/ranked?week=2026-11-02&band=low")
    assert res_low.status_code == 200
    low_data = res_low.json()
    for item in low_data["items"]:
        assert item["band"] == "low"

    # Pagination
    res_page = client.get("/shops/ranked?week=2026-11-02&limit=5&offset=0")
    assert res_page.status_code == 200
    assert len(res_page.json()["items"]) <= 5


def test_shop_detail_no_ground_truth_leak_and_404():
    # Unknown shop returns 404 with error detail
    res_404 = client.get("/shops/NON_EXISTENT?week=2026-11-02")
    assert res_404.status_code == 404
    assert res_404.json()["error"]["code"] == "SHOP_NOT_FOUND"

    # Real shop
    res = client.get("/shops/FPS-00001?week=2026-11-02")
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


def test_feedback_validation_and_404():
    # Unknown shop feedback
    res_404 = client.post(
        "/shops/FPS-99999/feedback",
        json={"week": "2026-11-02", "outcome": "confirmed"},
    )
    assert res_404.status_code == 404
    assert res_404.json()["error"]["code"] == "SHOP_NOT_FOUND"

    # Invalid outcome returns 422
    res_422 = client.post(
        "/shops/FPS-00001/feedback",
        json={"week": "2026-11-02", "outcome": "invalid_outcome"},
    )
    assert res_422.status_code == 422
    assert "error" in res_422.json()


def test_post_run():
    res = client.post("/run", json={"week": "2026-11-02", "top_k": 10})
    assert res.status_code == 200
    data = res.json()
    assert data["week"] == "2026-11-02"
    assert data["shops_scored"] == 100
    assert data["duration_ms"] >= 0
