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
A demo MVP on synthetic data. It scores every shop each week from five signals, ranks shops by inspection priority, explains each flag in plain language with traceable evidence, and gives the officer a checklist. Officers record the visit outcome; the dashboard shows how often flags were confirmed.

## Who uses it
- **Supply inspector:** opens the ranked list, picks a shop, follows the checklist, records the outcome.
- **Mamlatdar / district supply officer:** filters by taluka or district, reviews the top shops, assigns visits (assignment itself is out of scope).
- **Monitoring and vigilance team:** reviews trends and confirmed rate.

## Signals
Authentication failures, unauthenticated (override) sales, complaints, stock gap (stock received vs sold vs remaining), public display board vs transaction data. Definitions and assumptions: `docs/ARCHITECTURE.md`, `MEMORY.md`.

## In scope
- Synthetic data generator with planted problem shops and a false-alarm trap
- Statistical anomaly detection and hard arithmetic checks
- Transparent weighted risk score with exact breakdown
- LLM (Groq) wording of the reason and checklist, validated against computed facts, template fallback
- Dashboard, ranked list, shop detail, checklist, visit outcome
- Evaluation against planted labels (labelled "on synthetic data")

## Out of scope
- Real data, real ePoS or Aadhaar integration, login and roles
- Assigning or scheduling inspectors, notifications, mobile app
- Trained ML models, automatic weight tuning
- Any action against a shop. The system only recommends where to look.

## Principles
1. Transparent: every flag shows the numbers behind it.
2. Verify before acting: the system points; the officer decides.
3. Honest: synthetic results are labelled as synthetic.
4. Works without the LLM.

## Success for the demo
- Planted problem shops rank near the top; the outage-trap taluka does not flood the list.
- A first-time viewer can go from dashboard to a shop's evidence and checklist in under a minute.
- The 5-minute walkthrough in `docs/DEMO.md` runs without errors.

## Open questions for the real deployment
See Assumptions A-001 to A-008 in `MEMORY.md`: the real definition of override, complaint format, financial vulnerability measure, how board data arrives, refresh frequency, and which state's data formats apply (the statement does not name the state).
