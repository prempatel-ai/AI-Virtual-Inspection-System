"""Seeds synthetic users and assigns shops to inspectors."""

import argparse
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from app.auth.security import hash_password
from app.config import get_db_path, load_config
from app.db import get_connection, init_db

# Fixed deterministic list of fictional Indian names
FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan",
    "Krishna", "Ishaan", "Diya", "Saanvi", "Ananya", "Aadhya", "Pari", "Riya",
    "Anushka", "Myra", "Avani", "Kavita", "Rajesh", "Amit", "Pooja", "Vikram",
    "Sneha", "Karan", "Meera", "Rohit", "Tanvi", "Suresh", "Bhavna", "Deepak"
]

LAST_NAMES = [
    "Patel", "Shah", "Mehta", "Desai", "Joshi", "Parekh", "Trivedi", "Pandya",
    "Vora", "Bhatt", "Chauhan", "Solanki", "Parmar", "Gohil", "Rathod", "Makwana",
    "Thakur", "Dave", "Modi", "Barot", "Ravalo", "Pandit", "Nair", "Iyer"
]


def _get_fictional_name(idx: int) -> Tuple[str, str]:
    """Deterministically returns (full_name, email_slug) based on an index."""
    first = FIRST_NAMES[idx % len(FIRST_NAMES)]
    last = LAST_NAMES[(idx // len(FIRST_NAMES)) % len(LAST_NAMES)]
    slug = f"{first.lower()}.{last.lower()}.{idx + 1}"
    return f"{first} {last}", slug


def seed_users(
    db_path: Optional[Union[str, Path]] = None,
    demo_password: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Seeds synthetic users according to docs/V2_SPEC.md:
    - 1 admin (state scope)
    - 2 vigilance (state scope)
    - 1 district_officer per district
    - 1 mamlatdar per taluka
    - inspectors per taluka = ceil(shops_in_taluka / inspector_load), shops split across them
    """
    target_path = Path(db_path) if db_path else get_db_path()
    init_db(target_path)
    conn = get_connection(target_path)

    config = load_config()
    seeding_cfg = config.get("seeding", {})
    inspector_load = seeding_cfg.get("inspector_load", 25)

    password: str = demo_password or os.getenv("DEMO_PASSWORD") or "demoPassword123"
    hashed_password = hash_password(password)
    now_str = datetime.now(timezone.utc).isoformat()

    name_idx = 0
    users_to_insert: List[Tuple[Any, ...]] = []
    demo_examples: Dict[str, str] = {}

    try:
        # 1. Admin (1 user)
        adm_name, adm_slug = _get_fictional_name(name_idx)
        name_idx += 1
        adm_email = f"{adm_slug}@demo.invalid"
        adm_id = "usr-adm-001"
        users_to_insert.append((
            adm_id, adm_name, adm_email, hashed_password, "admin",
            None, None, 1, None, now_str,
        ))
        demo_examples["admin"] = adm_email

        # 2. Vigilance (2 users)
        for v_num in (1, 2):
            vig_name, vig_slug = _get_fictional_name(name_idx)
            name_idx += 1
            vig_email = f"{vig_slug}@demo.invalid"
            vig_id = f"usr-vig-{v_num:03d}"
            users_to_insert.append((
                vig_id, vig_name, vig_email, hashed_password, "vigilance",
                None, None, 1, None, now_str,
            ))
            if "vigilance" not in demo_examples:
                demo_examples["vigilance"] = vig_email

        # 3. District Officers (1 per district)
        districts = [
            r[0] for r in conn.execute(
                "SELECT DISTINCT district FROM shops ORDER BY district;"
            ).fetchall()
        ]
        for d_idx, dist in enumerate(districts, start=1):
            d_name, d_slug = _get_fictional_name(name_idx)
            name_idx += 1
            d_email = f"{d_slug}@demo.invalid"
            d_id = f"usr-do-{d_idx:03d}"
            users_to_insert.append((
                d_id, d_name, d_email, hashed_password, "district_officer",
                dist, None, 1, None, now_str,
            ))
            if "district_officer" not in demo_examples:
                demo_examples["district_officer"] = d_email

        # 4. Mamlatdars & 5. Inspectors (per taluka)
        taluka_rows = conn.execute(
            "SELECT DISTINCT district, taluka FROM shops ORDER BY district, taluka;"
        ).fetchall()

        m_idx = 1
        insp_idx = 1

        for row in taluka_rows:
            dist = row["district"]
            tal = row["taluka"]

            # Mamlatdar for this taluka
            m_name, m_slug = _get_fictional_name(name_idx)
            name_idx += 1
            m_email = f"{m_slug}@demo.invalid"
            m_id = f"usr-mam-{m_idx:03d}"
            m_idx += 1
            users_to_insert.append((
                m_id, m_name, m_email, hashed_password, "mamlatdar",
                dist, tal, 1, None, now_str,
            ))
            if "mamlatdar" not in demo_examples:
                demo_examples["mamlatdar"] = m_email

            # Shops in this taluka
            shops_in_taluka = [
                r[0] for r in conn.execute(
                    "SELECT shop_id FROM shops WHERE district = ? AND taluka = ? ORDER BY shop_id;",
                    (dist, tal),
                ).fetchall()
            ]
            num_shops = len(shops_in_taluka)
            num_inspectors = max(1, math.ceil(num_shops / inspector_load))

            taluka_inspectors = []
            for _ in range(num_inspectors):
                i_name, i_slug = _get_fictional_name(name_idx)
                name_idx += 1
                i_email = f"{i_slug}@demo.invalid"
                i_id = f"usr-insp-{insp_idx:03d}"
                insp_idx += 1
                users_to_insert.append((
                    i_id, i_name, i_email, hashed_password, "inspector",
                    dist, tal, 1, None, now_str,
                ))
                taluka_inspectors.append(i_id)
                if "inspector" not in demo_examples:
                    demo_examples["inspector"] = i_email

        # 1. Clear existing references and users first (satisfying FK constraints)
        conn.execute("UPDATE shops SET inspector_id = NULL;")
        cursor = conn.cursor()
        cursor.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='cases';")
        if cursor.fetchone()[0] > 0:
            conn.execute("UPDATE cases SET assignee_id = NULL;")
        conn.execute("DELETE FROM users;")
        cursor.executemany(
            """
            INSERT INTO users (
                user_id, name, email, password_hash, role, district, taluka,
                is_active, last_login_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            users_to_insert,
        )
        conn.commit()

        # 2. Now assign shops to inspectors
        insp_cursor = 1
        for row in taluka_rows:
            dist = row["district"]
            tal = row["taluka"]
            shops_in_taluka = [
                r[0] for r in conn.execute(
                    "SELECT shop_id FROM shops WHERE district = ? AND taluka = ? ORDER BY shop_id;",
                    (dist, tal),
                ).fetchall()
            ]
            num_shops = len(shops_in_taluka)
            num_inspectors = max(1, math.ceil(num_shops / inspector_load))
            taluka_inspectors = [
                f"usr-insp-{i:03d}" for i in range(insp_cursor, insp_cursor + num_inspectors)
            ]
            insp_cursor += num_inspectors

            for s_idx, s_id in enumerate(shops_in_taluka):
                assigned_inspector = taluka_inspectors[s_idx % len(taluka_inspectors)]
                conn.execute(
                    "UPDATE shops SET inspector_id = ? WHERE shop_id = ?;",
                    (assigned_inspector, s_id),
                )
        conn.commit()

        # Write data/demo_users.json (without passwords)
        demo_users_path = target_path.parent / "demo_users.json"
        demo_users_path.parent.mkdir(parents=True, exist_ok=True)
        with open(demo_users_path, "w", encoding="utf-8") as f:
            json.dump(demo_examples, f, indent=2)

        result = {
            "total_users": len(users_to_insert),
            "admin": 1,
            "vigilance": 2,
            "district_officers": len(districts),
            "mamlatdars": len(taluka_rows),
            "inspectors": insp_idx - 1,
            "demo_users_file": str(demo_users_path),
            "demo_examples": demo_examples,
        }
        return result
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Seed synthetic users for PDS Virtual Inspection System."
    )
    parser.add_argument("--db-path", type=str, default=None, help="Path to SQLite database file.")
    args = parser.parse_args()

    res = seed_users(db_path=args.db_path)
    print("=" * 60)
    print("PDS SYNTHETIC USER SEEDING COMPLETED")
    print("=" * 60)
    print(f"Total synthetic users created: {res['total_users']}")
    print(f"  Admin:             {res['admin']}")
    print(f"  Vigilance:         {res['vigilance']}")
    print(f"  District Officers: {res['district_officers']}")
    print(f"  Mamlatdars:        {res['mamlatdars']}")
    print(f"  Inspectors:        {res['inspectors']}")
    print(f"Demo credentials file: {res['demo_users_file']}")
    print("Example logins per role (use env DEMO_PASSWORD):")
    for role, email in res["demo_examples"].items():
        print(f"  {role:18}: {email}")
    print("=" * 60)


if __name__ == "__main__":
    main()
