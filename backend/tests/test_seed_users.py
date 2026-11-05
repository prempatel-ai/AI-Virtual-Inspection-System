"""Unit tests for synthetic users seeding and shop inspector assignments."""

import json

from app.auth.security import verify_password
from app.data.generator import generate_pds_data
from app.data.seed_users import seed_users
from app.db import get_connection


def test_seed_users_creation_and_assignment(tmp_path):
    db_file = tmp_path / "test_seed.db"
    generate_pds_data(num_shops=50, num_weeks=4, seed=42, db_path=db_file)

    demo_pwd = "customDemoPassword99"
    res = seed_users(db_path=db_file, demo_password=demo_pwd)

    assert res["admin"] == 1
    assert res["vigilance"] == 2
    assert res["district_officers"] >= 1
    assert res["mamlatdars"] >= 1
    assert res["inspectors"] >= 1

    # Verify demo_users.json
    demo_file = tmp_path / "demo_users.json"
    assert demo_file.exists()
    with open(demo_file, "r", encoding="utf-8") as f:
        demo_data = json.load(f)

    for role in ("admin", "vigilance", "district_officer", "mamlatdar", "inspector"):
        assert role in demo_data
        assert demo_data[role].endswith("@demo.invalid")
        # Ensure no plaintext passwords leaked
        assert demo_pwd not in json.dumps(demo_data)

    # Verify database state
    conn = get_connection(db_file)
    cursor = conn.cursor()

    # Verify all shops have an assigned inspector
    cursor.execute("SELECT count(*) as unassigned FROM shops WHERE inspector_id IS NULL;")
    assert cursor.fetchone()["unassigned"] == 0

    # Verify password verification works for seeded users
    cursor.execute("SELECT password_hash FROM users WHERE role = 'admin' LIMIT 1;")
    adm_hash = cursor.fetchone()["password_hash"]
    assert verify_password(adm_hash, demo_pwd) is True

    # Verify scope values
    cursor.execute("SELECT district, taluka FROM users WHERE role = 'admin';")
    adm_row = cursor.fetchone()
    assert adm_row["district"] is None
    assert adm_row["taluka"] is None

    cursor.execute("SELECT district, taluka FROM users WHERE role = 'district_officer' LIMIT 1;")
    do_row = cursor.fetchone()
    assert do_row["district"] is not None
    assert do_row["taluka"] is None

    cursor.execute("SELECT district, taluka FROM users WHERE role = 'mamlatdar' LIMIT 1;")
    mam_row = cursor.fetchone()
    assert mam_row["district"] is not None
    assert mam_row["taluka"] is not None

    cursor.execute("SELECT district, taluka FROM users WHERE role = 'inspector' LIMIT 1;")
    insp_row = cursor.fetchone()
    assert insp_row["district"] is not None
    assert insp_row["taluka"] is not None

    conn.close()
