# PRODUCT.md

## Problem statement (verbatim)

**Name of Industry:** Food, Civil Supplies & Consumer Affairs Department
**Sector:** IT / ITeS
**Problem Statement:** PDS Self-Auditing / AI Virtual Inspection System

**Description of the Problem:** Problem 5: PDS Self-Auditing & Virtual Inspection
1. Limited Inspectors: Around 17,000 FPSs cannot be physically inspected frequently.
2. High-Risk Shops: Financially vulnerable/high-risk shops need priority inspection.
3. Uncombined Signals: Authentication failures, overrides, complaints, stock and transaction patterns are not viewed together.
4. No Inspection Guidance: Officers need clear guidance on what to verify at a flagged FPS.
5. Public Disclosure: Displayed stock and distribution information should be cross-checked with digital transaction data.

Physical inspection cannot continuously cover every Fair Price Shop. A large amount of transaction, stock and authentication data is available, but it needs to be prioritised to support field officers.
The challenge is to build an AI system that continuously analyses available PDS data and tells an officer which FPS requires inspection, why it requires attention and what evidence should be checked, using transparent reasoning.

**Suggested technology areas:** Agentic AI, Anomaly Detection, Continuous Auditing, Explainable AI.
**Users:** Supply inspectors, Mamlatdars and district supply officers; DFCS monitoring and vigilance teams.
**Expected Outcomes:**
- A risk-based, prioritised inspection list with reasons and evidence to check.
- Continuous auditing in place of periodic checks only.
- Transparent evidence so officers can verify before acting.

**Potential Impact:** Lets limited field staff focus on the shops that matter most, moving inspection from routine rounds to targeted, evidence-led visits.

## What we are building
A demo MVP on synthetic data. It scores every shop each week from five signals, ranks shops by inspection priority, explains each flag in plain language with traceable evidence, and gives the officer a checklist.

**Version 2 adds officers, roles and oversight.** Officers sign in. Each flagged shop becomes a case assigned to a responsible officer. Officers act on their cases (start inspection, record findings, escalate, add notes), and every action is stored. Supervisors and the admin see flags, officer activity, access rights and flag rates for their area. Full spec: `docs/V2_SPEC.md`.

## Who uses it
Roles and what each one sees (scope is enforced on the server):
- **Supply inspector:** sees only the cases assigned to them. Starts inspections, follows the checklist, records findings and the action taken, escalates.
- **Mamlatdar:** sees their taluka. Reassigns cases among inspectors, escalates, reviews and closes cases, tracks flag rate and inspector activity.
- **District supply officer:** sees their district. Same powers as the Mamlatdar across the district's talukas.
- **DFCS monitoring and vigilance team:** sees the whole state, read-only, can add notes. Can receive escalated cases.
- **Admin (state level):** sees all flags, all officers' actions, access rights and flag rates by area. Manages users and roles, runs the audit, reads the access log. Does not record inspection findings.

The statement names the first four user groups. The admin role, the exact permissions and the case lifecycle are design choices (see Assumptions in `MEMORY.md`).

## Signals
Authentication failures, unauthenticated (override) sales, complaints, stock gap (stock received vs sold vs remaining), public display board vs transaction data. Definitions and assumptions: `docs/ARCHITECTURE.md`, `MEMORY.md`.

## In scope
- Synthetic data generator with planted problem shops and a false-alarm trap
- Statistical anomaly detection and hard arithmetic checks
- Transparent weighted risk score with exact breakdown
- LLM (Groq) wording of the reason and checklist, validated against computed facts, template fallback
- Dashboard, ranked list, shop detail, checklist
- Evaluation against planted labels (labelled "on synthetic data")
- **V2:** login with role-based access, synthetic officers for every area
- **V2:** cases created from flags and assigned to officers; lifecycle with statuses
- **V2:** officer actions (start inspection, record findings and action taken, escalate, reassign, note, close, reopen), all stored in an append-only history
- **V2:** per-role queue and scoped views of flags, areas and officers
- **V2:** admin plane: all flags, every officer's actions, access rights, flag rate by district and taluka, user management, access log
- **V2:** synthetic activity history so oversight screens have realistic content

## Out of scope
- Real data, real ePoS or Aadhaar integration, government single sign-on (demo uses email and password)
- Visit scheduling calendar, notifications, mobile app
- Trained ML models, automatic weight tuning
- Any action against a shop taken by the system itself. The system recommends where to look; officers decide and act.

## Principles
1. Transparent: every flag shows the numbers behind it.
2. Verify before acting: the system points; the officer decides.
3. Honest: synthetic results are labelled as synthetic.
4. Works without the LLM.
5. Accountable: every officer action is recorded with who, what and when, and cannot be edited or deleted.
6. Least privilege: each role sees only its area. Access is enforced on the server, never only in the UI.

## Success for the demo
- Planted problem shops rank near the top; the outage-trap taluka does not flood the list.
- A first-time viewer can go from dashboard to a shop's evidence and checklist in under a minute.
- The 5-minute walkthrough in `docs/DEMO.md` runs without errors.
- **V2:** an inspector signs in and sees only their own cases. A Mamlatdar reassigns a case. The admin opens an officer and sees their access, their flags and every action they took, plus flag rates by district.
- **V2:** a user cannot read another area's data by changing an ID in the URL.

## Open questions for the real deployment
See Assumptions A-001 to A-008 in `MEMORY.md`: the real definition of override, complaint format, financial vulnerability measure, how board data arrives, refresh frequency, and which state's data formats apply (the statement does not name the state).

Additional open questions for V2: real role names and permissions, the real action types officers take, response-time rules (we assume 7 days), and how officers are authenticated in production.
