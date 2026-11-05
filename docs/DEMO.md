# PDS Self-Auditing & AI Virtual Inspection System - V2 Multi-User Walkthrough

This document guides presenters and government evaluators through the V2 multi-user inspection management system, role-based workflows, and security oversight.

---

## 1. Quickstart

To launch the full system (data generation, user seeding, 4-week historical activity simulation, FastAPI backend, and Next.js frontend):

```bash
make demo
```

Once running:
- **Web Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Interactive API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)

> **Notice:** Default demo password for all accounts is `demoPassword123` (or set via `DEMO_PASSWORD` in `.env`). The platform operates completely offline without external cloud dependencies.

---

## 2. Seeded User Accounts & Roles

The system is seeded with representative administrative personnel, supervisors, and field inspectors:

| Role | Email Account | Geographic Scope | Primary Authority |
|---|---|---|---|
| **Inspector** | `ananya.patel.13@demo.invalid` | Ahmedabad • Taluka 1 | Works assigned cases, conducts virtual/field checks, records findings |
| **Mamlatdar** | `saanvi.patel.12@demo.invalid` | Ahmedabad • Taluka 1 | Supervises taluka cases, reassigns inspectors, reviews & closes cases |
| **District Officer** | `vihaan.patel.4@demo.invalid` | Ahmedabad District | District-wide oversight, cross-taluka metrics, escalations |
| **Vigilance** | `vivaan.patel.2@demo.invalid` | State-wide (Gujarat) | State audit oversight, read-only inspection review, notes |
| **Admin** | `aarav.patel.1@demo.invalid` | State-wide (Gujarat) | User provisioning, credential management, access log audit |

---

## 3. End-to-End Walkthrough Script (7 Minutes)

### Phase 1: Field Inspector Workflow (`ananya.patel.13@demo.invalid`)

1. **Sign In:**
   - Navigate to [http://localhost:3000/login](http://localhost:3000/login).
   - Click the quick button **"Inspector"** (or enter `ananya.patel.13@demo.invalid` / `demoPassword123`).
   - Click **Sign In to System**.
2. **Review My Queue (`/queue`):**
   - Notice the automatic landing on **Inspection Queue**.
   - Review KPIs: **Open Cases**, **Overdue Inspection (>7d)**, **High Risk Cases**, and **Inspected / Closed**.
   - Notice that the table displays **only shops assigned to this inspector** within their taluka.
3. **Open an Assigned Case (`/cases/[id]`):**
   - Click on the first flagged case (e.g., `CASE-FPS-00497` or `CASE-FPS-00167`).
   - **Header Card:** Displays case status, days open, risk score, and current assignee.
   - **Available Officer Actions:** Action buttons are dynamically generated strictly from `allowed_actions`:
     - Click **Start Inspection**: The case transitions from `assigned` to `in_progress`.
     - Click **Record Inspection Findings**: Opens the comprehensive inspection outcome form.
4. **Conduct Inspection & Record Findings:**
   - Fill the **Verification Checklist**: Physical stock count, scale calibration seal, beneficiary slip cross-check.
   - Select **Outcome Finding:** `Irregularities Confirmed`.
   - Select **Enforcement Action:** `Warning issued to FPS dealer` (or `Formal physical stock audit ordered`).
   - Enter note: `Physical stock count revealed 437 kg grain deficit. Show-cause notice served.`
   - Click **Submit Inspection Outcome**.
5. **Verify Immutable Activity Log:**
   - Scroll to **Case Activity Log** on the right column.
   - Observe the new action appended chronologically showing: actor name, timestamp, action type, and findings.
   - Verify that attempts to access out-of-scope cases by tampering with the URL return `404 Not Found` (never leaking information).

---

### Phase 2: Taluka Supervisor / Mamlatdar Workflow (`saanvi.patel.12@demo.invalid`)

1. **Sign In as Mamlatdar:**
   - Sign out via top right, then sign in with `saanvi.patel.12@demo.invalid` / `demoPassword123`.
2. **Review Executive Oversight (`/overview`):**
   - Lands on **Executive Oversight** displaying taluka workload metrics.
   - Review total shops monitored, flagged count, open workload, and field confirmed rate.
3. **Reassign a Case:**
   - Navigate to **My Queue** (`/queue`).
   - Open a case in `assigned` or `in_progress` status.
   - In **Available Officer Actions**, click **Reassign Officer**.
   - Select a different inspector from the taluka roster.
   - Click **Confirm Reassignment**. Observe the case immediately reassigned and logged in the immutable timeline.
4. **Close a Completed Case:**
   - Open a case with `inspected` status.
   - Click **Close Case** and enter closing notes: `Enforcement penalty paid and corrective action verified. Case concluded.`
   - Confirm closing with inline confirmation. Case status transitions to `closed`.

---

### Phase 3: State Vigilance Workflow (`vivaan.patel.2@demo.invalid`)

1. **Sign In as Vigilance:**
   - Sign in with `vivaan.patel.2@demo.invalid` / `demoPassword123`.
2. **State-Wide Oversight:**
   - Lands on `/overview` showing all 5 districts and state-wide flag rates.
3. **Read-Only Case Access:**
   - Open any case across the state.
   - Notice that Vigilance officers **have no action buttons** to start inspections, reassign, or record outcomes.
   - Only **Add Case Note** is permitted, maintaining strict separation of powers between oversight and field enforcement.

---

### Phase 4: System Administrator Workflow (`aarav.patel.1@demo.invalid`)

1. **Sign In as Admin:**
   - Sign in with `aarav.patel.1@demo.invalid` / `demoPassword123`.
2. **Inspect Officer Roster & Profiles (`/officers`):**
   - Navigate to **Officers**.
   - Review field officers, active cases, overdue rates, and median response times.
   - Click on any officer (e.g., `U-INSP-1` or `Inspector Dave`).
   - In **Officer Detail**:
     - Review their **Access Rights & Security Scope** (`PermissionList`).
     - Review their assigned cases and lifetime case activity timeline.
     - Review their taluka's flag rate compared to state benchmarks.
3. **Comparative Area Analysis (`/areas`):**
   - Navigate to **Areas**.
   - Switch between **Districts** and **Talukas**.
   - Compare flag rates, open cases, and field confirmed rates across administrative jurisdictions.
4. **User Management & Provisioning (`/admin/users`):**
   - Navigate to **Users**.
   - Click **+ Provision New User**:
     - Name: `Vikram Solanki`
     - Email: `v.solanki@pds.gujarat.gov.in`
     - Role: `Inspector`
     - District: `Ahmedabad`, Taluka: `Ahmedabad Taluka 2`
     - Click **Provision Account**.
     - Observe the temporary password notice generated for secure handover.
   - Test **Reset Password** on any user using the inline confirmation button.
5. **Security Access & Audit Log (`/admin/audit`):**
   - Navigate to **Audit Log**.
   - Review the append-only security log tracking:
     - Authentication successes and failed login attempts.
     - Account lockouts and unauthorized access attempts.
     - Administrative user updates and credential resets.
     - Client IP address and timestamp metadata.

---

## 4. Architectural & Security Guarantees

1. **Zero Client-Side Authorization:** Buttons and actions are generated strictly from `allowed_actions` computed on the server. Out-of-scope requests return `404 Not Found` rather than `403` to prevent leaking existence.
2. **Append-Only Immutability:** SQLite triggers prevent any `UPDATE` or `DELETE` operations on `case_actions` and `audit_log`. Every action taken by an officer or administrator is permanently recorded.
3. **Cryptographic Authentication:** Passwords hashed with `Argon2id`. Sessions maintained via signed `JWT` cookies configured with `HttpOnly`, `SameSite=Lax`, and `Secure` attributes.
4. **Automated Lockout:** 5 consecutive failed login attempts trigger an automatic 15-minute lockout period.
5. **Universal WCAG AA Compliance:** Validated contrast ratios across all semantic color tokens, complete keyboard navigability, and responsive layouts tested at 1280px and 768px breakpoints.
