# Batch Orchestration

Tells the agent (or human) what to run in what order, what each batch depends on, and how to gracefully skip a batch when prerequisites aren't met.

## Priority groups

**P0 — student rollout gate.** These MUST be clean before any real student touches the app. If any P0 batch has a BLOCKER finding, rollout pauses.

- B00 Setup & Seed
- B02 MCQ Submission (verifies recent persistence fixes)
- B03 Typed Submission (verifies recent persistence fixes)
- B04 Session Day-1 Happy Path
- B05 Session Day-2+ Happy Path
- B06 Session Recovery / Resume
- B07 Network Resilience
- B09 Browser Navigation Traps (refresh, tab close, back button)
- **B22 Day Progression Mechanics** ★ (longitudinal multi-day walks — the chat-log pattern-1 batch; most student-felt issues live here)

**P1 — strongly recommended before rollout.** A HIGH finding here should still block, but a MEDIUM is acceptable to ship and patch.

- B01 Auth Flows
- B08 Erratic Interaction
- B10 Blind Spot Check
- B11 Test Result + Challenge Dispute
- B12 Concurrent Multi-Tab
- B13 Extreme Inputs
- B14 Long-Running Session
- B15 Student Dashboard Variants
- **B23 Challenge Token Economics** (chat-log pattern-4 batch)
- **B24 Class Transfer / Multi-Class Membership** (chat-log pattern-6 batch — the 민사랑 case)
- **B26 AI Grading Correctness Probes** (chat-log pattern-8 batch — the 안이찬 case)

**P2 — teacher-side + algorithm tuning, can patch post-rollout if needed.**

- B16 Teacher Class Management
- B17 Teacher List Editor
- B18 Teacher Gradebook
- B19 Teacher Challenge Review
- **B25 Algorithm Pace Adjustment** (chat-log pattern-9 batch — the "6 words a day" suppression state)

**P3 — polish and a11y.**

- B20 Responsive Viewports
- B21 Accessibility (WCAG 2.1 AA)

## Recommended run order (sequential, fail-soft)

```
B00 → [B02, B03] → B22 → B06 → B07 → B09 → B26 → B04 → B05 → B23 → B24 → B01 → B08 → B25 → B10 → B11 → B12 → B13 → B14 → B15 → B16 → B17 → B18 → B19 → B20 → B21
```

Rationale: get the recent-fix verification (B02/B03) and the chat-log pattern-1 day-progression batch (B22) done FIRST. B22 is longitudinal — it'll catch drift the single-session batches can't see. If B02/B03/B22 surface BLOCKERs, rollout halts. Then resilience (B06/B07/B09) and AI grading correctness (B26) — the patterns students felt most.

If you only have 6 hours, run: **B00, B02, B03, B22, B06, B07, B09, B26.**
If you only have 3 hours, run: **B00, B02, B03, B22.**
If you only have 1 hour, run: **B00, B02, B03.** (B22 needs at least 3 hours to be meaningful.)

## Dependencies

| Batch | Depends on | Why |
| --- | --- | --- |
| B01–B21 | B00 | Seed data (test users, classes, lists) lives in `audit_state.json` after B00. |
| B02 / B03 | B00 + at least one assigned list per test student | Need a real test session to start. |
| B06 | B02 or B03 | Recovery scenarios need a real interrupted-test seed. |
| B11 | B02 or B03 | Need a submitted attempt to challenge. |
| B15 | B16 (optional) | Some variants need multiple classes; can be skipped if teacher batches not run. |
| B17 / B18 / B19 | B16 | Teacher class must exist before list editor / gradebook tests. |
| B19 | B11 | Challenge review needs a pending dispute (created in B11). |

If a dependency is missing or stale, the batch skips gracefully and notes "skipped: missing dependency X" in its findings file. Do not block the whole run.

## How to invoke a batch

### Option A — manually translate scenarios to Playwright

```bash
# 1. Read the spec
cat audit/playwright/batches/B02_mcq_submission_critical.md

# 2. Write Playwright code under e2e/audit/B02_mcq_submission.spec.js
#    Use helpers in e2e/audit/helpers/ for auth, seeding, network shims

# 3. Run
npx playwright test e2e/audit/B02_

# 4. Copy template, fill in findings
cp audit/playwright/FINDINGS_TEMPLATE.md audit/playwright/findings/findings_B02.md
# (edit findings_B02.md)
```

### Option B — agent-driven (recommended for hours-long runs)

Invoke a general-purpose agent (or a new vocaboost-audit agent if you create one) with a prompt like:

```
Run vocaBoost audit batch B02 (MCQ Submission Critical Path).

Context:
- App target URL is the live Netlify deploy at https://vocaboostone.netlify.app/ (configured in audit_state.json.environment.vocaboostUrl).
- Read /app/audit/playwright/PLAN.md first for selector strategy, persona definitions, and severity rubric.
- Read /app/audit/playwright/batches/B02_mcq_submission_critical.md for the scenarios.
- Read /app/audit/playwright/audit_state.json for seeded users and test IDs.
- Use Playwright MCP browser tools to execute (browser_navigate, browser_click, browser_take_screenshot, browser_console_messages, browser_network_requests, browser_evaluate).

Output:
- /app/audit/playwright/findings/findings_B02.md (from FINDINGS_TEMPLATE.md).
- Evidence under /app/audit/playwright/findings/evidence/B02/.
- Update audit_state.json with any new IDs created during the run.

Time budget: 30–60 minutes per batch. If a scenario blocks beyond 5 minutes, mark it as "blocked: <reason>" and move on — do not lose the rest of the batch.
```

The agent description should mirror the existing apboost-audit agent. Consider creating a `vocaboost-audit` agent type if you'll run this often.

## Inter-batch state — `audit_state.json`

This file is the contract between batches. Read at batch start, write at batch end. Each batch should APPEND, not OVERWRITE, unless explicitly resetting test data.

Expected shape after B00:

```json
{
  "version": 1,
  "seededAt": "2026-05-30T18:00:00Z",
  "users": {
    "careful": { "uid": "...", "email": "...", "password": "..." },
    "rushed": { ... },
    "distracted": { ... },
    "lazy": { ... },
    "anxious": { ... },
    "hostile": { ... },
    "noviceTeacher": { ... },
    "powerTeacher": { ... },
    "anxiousTeacher": { ... }
  },
  "classes": {
    "primaryClass": { "id": "...", "joinCode": "...", "teacherUid": "..." },
    "secondaryClass": { ... },
    "emptyClass": { ... },
    "fullClass": { ... }
  },
  "lists": {
    "tinyList": { "id": "...", "wordCount": 5, "classId": "..." },
    "standardList": { "id": "...", "wordCount": 50, "classId": "..." },
    "largeList": { "id": "...", "wordCount": 500, "classId": "..." }
  },
  "attempts": {},
  "sessions": {}
}
```

Subsequent batches add to `attempts` (each test submission) and `sessions` (each interrupted/resumed session). Do not delete anything created by earlier batches; lateral batches (e.g. B11 challenge review) need the artefacts.

## Stop conditions

- **BLOCKER in B02 or B03** → halt; the persistence fixes I just made are wrong. File a P0 ticket, do not proceed.
- **BLOCKER in B22** → halt; the chat-log's most-reported pattern (day didn't advance) has regressed. This is the highest signal that something just broke in production paths.
- **BLOCKER in B06 / B07 / B09** → halt; resilience is broken in a way students will hit immediately.
- **BLOCKER in B26** → halt; AI grading is too strict and will force every Korean / ESL student to dispute.
- **BLOCKER in any P1 batch** → continue audit but flag for fix-before-rollout.
- **>10 HIGH findings cumulatively** → stop and triage before continuing; the audit may be uncovering a class of bug that needs a different approach.

## Reporting

After all chosen batches complete, an aggregator step (could be agent-driven) reads all `findings_BXX.md` files and produces:

- `audit/playwright/findings/SUMMARY.md` — top 10 most severe findings, grouped by area.
- `audit/playwright/findings/RECOMMENDATIONS.md` — fix order for the top 10.
- `audit/playwright/findings/EVIDENCE_INDEX.md` — pointer to all screenshots / HARs / Firestore dumps.

This summary is what the team reviews to make the rollout go/no-go call.
