# API.md

FastAPI, JSON. Base `http://localhost:8000`. Schemas are Pydantic models in `backend/app/schemas.py`; frontend types are generated via `make types`.
Errors: `{"error": {"code": "string", "message": "string"}}` with appropriate HTTP status codes (401, 403, 404, 409, 422).
All dates are ISO 8601 strings. `week` is a Monday date `YYYY-MM-DD`; default is the latest week.

## Authentication and Security
- All endpoints except `GET /health` and `POST /auth/login` require authentication via HttpOnly `session` cookie.
- State-changing requests (`POST`, `PATCH`, `DELETE`) require header `X-Requested-With: fetch`.
- Out-of-scope requests return **404** to prevent leaking existence of records.

---

## 1. Authentication

### POST /auth/login
Public. Authenticates with email and password. Sets an `HttpOnly`, `SameSite=Lax` cookie named `session`.
- Request: `{"email": "officer@demo.invalid", "password": "..."}`
- Response (200):
```json
{
  "user": {
    "user_id": "usr-001",
    "name": "Arun Patel",
    "email": "arun.patel.1@demo.invalid",
    "role": "inspector",
    "district": "Ahmedabad",
    "taluka": "Ahmedabad City"
  },
  "permissions": ["flags:view", "cases:view", "cases:act", "cases:note", "cases:escalate", "officers:view", "actions:view"],
  "scope": {"role": "inspector", "district": "Ahmedabad", "taluka": "Ahmedabad City"}
}
```
- Error: 401 generic message `"Invalid email or password"`. After 5 consecutive failures, 429 lockout for 15 minutes.

### POST /auth/logout
Clears the session cookie.
- Response (200): `{"status": "ok"}`

### GET /auth/me
Returns the authenticated user's profile, assigned permissions, and scope.
- Response (200): Same shape as login response.

---

## 2. System and Metadata

### GET /health
Public.
- Response (200): `{"status": "ok"}`

### GET /meta
Permission: any authenticated user.
- Response (200):
```json
{
  "synthetic": true,
  "weeks": ["2026-08-17"],
  "latest_week": "2026-11-02",
  "districts": ["Ahmedabad"],
  "talukas": {"Ahmedabad": ["Ahmedabad City"]},
  "shops_count": 500,
  "has_run": true
}
```

### POST /run
Permission: `run:execute` (admin only).
Scores shops, creates/updates cases, evaluates against ground truth, and computes explanations.
- Request: `{"week": "2026-11-02", "top_k": 20}` (optional)
- Response (200): `{"run_id": 1, "week": "2026-11-02", "shops_scored": 500, "explained": 20, "cases_created": 3, "cases_updated": 19, "duration_ms": 120}`

---

## 3. Shops and Overview

### GET /summary?week=
Permission: `flags:view`. Scoped to user's jurisdiction.
- Response (200):
```json
{
  "week": "2026-11-02",
  "shops_monitored": 500,
  "flagged": 24,
  "high": 9,
  "medium": 15,
  "open_cases": 22,
  "overdue_cases": 2,
  "confirmed_rate": 0.85,
  "evaluation": {
    "on_synthetic_data": true,
    "precision_at_k": 0.82,
    "recall_at_2k": 0.94,
    "outage_false_alarm_rate": 0.0,
    "k": 26
  }
}
```

### GET /shops/ranked?week=&district=&taluka=&band=&limit=50&offset=0
Permission: `flags:view`. Scoped to user's jurisdiction.
- Response (200):
```json
{
  "week": "2026-11-02",
  "total": 24,
  "items": [
    {
      "rank": 1,
      "shop_id": "FPS-00012",
      "name": "Shop FPS-00012",
      "district": "Ahmedabad",
      "taluka": "Ahmedabad City",
      "risk_score": 78.4,
      "band": "high",
      "top_signals": [{"key": "stock_gap_pct", "label": "Stock gap", "points": 30.0}],
      "trend": [12.1, 15.0, 22.3, 41.0, 55.2, 61.0, 70.5, 78.4],
      "case": {
        "case_id": "case-001",
        "status": "assigned",
        "assignee_id": "usr-001",
        "assignee_name": "Arun Patel"
      }
    }
  ]
}
```

### GET /shops/{shop_id}?week=
Permission: `flags:view`. Returns 404 if out of user's scope.
- Response (200): Returns shop audit detail (signals, breakdown, reconciliation, explanation) plus `case` object.

---

## 4. Cases and Actions

### GET /cases?status=&assignee_id=&district=&taluka=&band=&overdue=&limit=50&offset=0
Permission: `cases:view`. Scoped list of cases. Default sort: `risk_score_latest` descending.
- Response (200):
```json
{
  "total": 22,
  "items": [
    {
      "case_id": "case-001",
      "shop_id": "FPS-00012",
      "shop_name": "Shop FPS-00012",
      "district": "Ahmedabad",
      "taluka": "Ahmedabad City",
      "status": "assigned",
      "risk_score_latest": 78.4,
      "band_latest": "high",
      "opened_week": "2026-10-12",
      "last_flagged_week": "2026-11-02",
      "assignee_id": "usr-001",
      "assignee_name": "Arun Patel",
      "is_overdue": false,
      "last_action_at": "2026-11-02T10:00:00Z",
      "created_at": "2026-10-12T08:00:00Z"
    }
  ]
}
```

### GET /cases/{id}
Permission: `cases:view`. Returns 404 if out of scope.
- Response (200): Case metadata, linked shop summary, action timeline, and `allowed_actions` for the calling user.
```json
{
  "case": {
    "case_id": "case-001",
    "shop_id": "FPS-00012",
    "shop_name": "Shop FPS-00012",
    "district": "Ahmedabad",
    "taluka": "Ahmedabad City",
    "status": "assigned",
    "risk_score_latest": 78.4,
    "band_latest": "high",
    "opened_week": "2026-10-12",
    "last_flagged_week": "2026-11-02",
    "assignee_id": "usr-001",
    "assignee_name": "Arun Patel",
    "is_overdue": false,
    "closed_at": null,
    "created_at": "2026-10-12T08:00:00Z"
  },
  "allowed_actions": ["start_inspection", "add_note", "escalate"],
  "actions": [
    {
      "id": 1,
      "case_id": "case-001",
      "actor_id": null,
      "actor_name": null,
      "actor_role": "system",
      "type": "create",
      "payload": {},
      "risk_score_at_action": 78.4,
      "created_at": "2026-10-12T08:00:00Z"
    }
  ]
}
```

### POST /cases/{id}/actions
Permission: Per permission table and `allowed_actions`.
- Valid actions:
  - `start_inspection`: payload `{note?: string}`
  - `record_outcome`: payload `{outcome: "confirmed" | "not_confirmed", checklist_results: [...], action_taken: string, note?: string}`
  - `add_note`: payload `{note: string}` (1..500 chars)
  - `escalate`: payload `{reason: string}`
  - `reassign`: payload `{to_user_id: string, reason?: string}`
  - `close`: payload `{reason: string}`
  - `reopen`: payload `{reason: string}`
- Responses:
  - 200: stored action row.
  - 403: user not permitted for this action or not assignee.
  - 404: case out of scope or nonexistent.
  - 409: invalid state transition.
  - 422: malformed payload.

---

## 5. Oversight (Officers, Areas, Actions)

### GET /officers?role=&district=&taluka=&active=
Permission: `officers:view`. Returns scoped officers list with aggregate performance stats.
- Response (200):
```json
{
  "items": [
    {
      "user_id": "usr-001",
      "name": "Arun Patel",
      "role": "inspector",
      "district": "Ahmedabad",
      "taluka": "Ahmedabad City",
      "is_active": true,
      "stats": {
        "assigned_cases": 8,
        "open_cases": 3,
        "overdue_cases": 1,
        "inspected_cases": 5,
        "closed_cases": 5,
        "confirmed_rate": 0.80,
        "median_time_to_first_action_hours": 24.5,
        "last_action_at": "2026-11-04T14:20:00Z"
      }
    }
  ]
}
```

### GET /officers/{id}
Permission: `officers:view`. Returns detailed profile, permissions, assigned cases, action timeline, and area flag rate.
- Response (200): Returns 404 if officer is out of scope.

### GET /areas?level=district|taluka&parent=
Permission: `areas:view`. Returns area metrics for jurisdiction.
- Response (200):
```json
{
  "items": [
    {
      "name": "Ahmedabad",
      "level": "district",
      "shops_count": 120,
      "flagged_count": 8,
      "flag_rate": 0.067,
      "high_band_count": 3,
      "open_cases": 7,
      "overdue_cases": 1,
      "confirmed_rate": 0.83
    }
  ]
}
```

### GET /actions?officer_id=&type=&case_id=&from=&to=&limit=50&offset=0
Permission: `actions:view`. Scoped audit feed of all case actions.

---

## 6. Admin Plane

### GET /admin/users
Permission: `users:manage` (admin only). List all users.

### POST /admin/users
Permission: `users:manage`. Create user `{name, email, role, district?, taluka?}`. Returns user and generated temporary password.

### PATCH /admin/users/{id}
Permission: `users:manage`. Update role, scope, or `is_active`.

### POST /admin/users/{id}/reset-password
Permission: `users:manage`. Resets password and returns temporary password.

### GET /admin/audit?event=&user_id=&from=&to=&limit=50&offset=0
Permission: `audit:view` (admin only). Query append-only audit log events (`login_success`, `login_failed`, `access_denied`, `user_created`, `user_updated`, etc.).
