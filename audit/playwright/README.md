# vocaBoost Playwright Audit

End-to-end audit suite for vocaBoost (NOT apBoost — that lives at `src/apBoost/criteria_audit/playwright_reports/`). Designed to be runnable for many hours of unattended testing in a Docker environment, with batches that fail loudly and produce review-ready findings.

## Why this exists

Students will start using the app within days. Recent fixes to test-submission persistence (audit_findings_persistence.md, top 5 items) reordered the submit flow and changed how attempt docs are written. Those fixes are unverified — there is no end-to-end coverage of the test-submission path, and lint cannot catch ordering bugs. This audit closes that gap and also surfaces unrelated brittleness in the surrounding flows before real students see it.

## What's here

```
audit/playwright/
├── README.md                  # this file
├── PLAN.md                    # philosophy, infra, selectors, personas, network matrix
├── BATCH_ORCHESTRATION.md     # batch sequence, dependencies, prioritisation
├── FINDINGS_TEMPLATE.md       # copy this when writing a findings_BXX.md
├── audit_state.json           # shared state populated during the run (test IDs etc.)
├── chat_log_coverage.md     # maps every TA-reported issue (Jan-Feb 2026 winter intensive) to the batch that covers it
├── batches/
│   ├── B00_setup_and_seed.md
│   ├── B01_auth_flows.md
│   ├── B02_mcq_submission_critical.md       ★ verifies recent persistence fixes
│   ├── B03_typed_submission_critical.md     ★ verifies recent persistence fixes
│   ├── B04_session_day1_happy.md
│   ├── B05_session_day2plus_happy.md
│   ├── B06_session_recovery_resume.md       ★ deep
│   ├── B07_network_resilience.md            ★ deep
│   ├── B08_erratic_interaction.md           ★ deep
│   ├── B09_browser_nav_traps.md             ★ deep
│   ├── B10_blind_spot_check.md
│   ├── B11_test_result_and_challenge.md
│   ├── B12_concurrent_multi_tab.md          ★ deep
│   ├── B13_extreme_inputs.md                ★ deep
│   ├── B14_long_running_session.md          ★ deep
│   ├── B15_student_dashboard_variants.md
│   ├── B16_teacher_class_mgmt.md
│   ├── B17_teacher_list_editor.md
│   ├── B18_teacher_gradebook.md
│   ├── B19_teacher_challenge_review.md
│   ├── B20_responsive_viewports.md
│   ├── B21_accessibility.md
│   ├── B22_day_progression_mechanics.md     ★★ P0, longitudinal — the chat-log pattern-1 batch
│   ├── B23_challenge_token_economics.md     ★ chat-log pattern-4
│   ├── B24_class_transfer_multiclass.md     ★ chat-log pattern-6 (민사랑 case)
│   ├── B25_algorithm_pace_adjustment.md     pattern-9 (the "6 words a day" suppression)
│   └── B26_ai_grading_correctness.md        ★ chat-log pattern-8 (안이찬 false negative case)
└── findings/
    └── (populated during run as findings_BXX.md)
```

## Prerequisites (one-time, before any batch runs)

1. **Seed 50 student accounts in Firebase** (out of band — needs Admin SDK creds):
   ```bash
   node scripts/seed-audit-students.js          # dry run, prints plan
   node scripts/seed-audit-students.js --apply  # actually creates
   ```
   Produces `audit/playwright/seeded_accounts.json` (gitignored — contains real passwords). 25 students added to 25WT 2차 TOP OFFLINE, 25 to 25WT 2차 CORE OFFLINE. See PLAN.md "Credentials & accounts" for details.

2. **Cleanup when done**:
   ```bash
   node scripts/cleanup-audit-students.js --apply
   ```
   Cascades through Auth, user docs, subcollections, attempts, and class membership decrement. Safe because all created docs carry `auditAccount: true`.

## How to run a batch

The audit assumes a Docker environment with:
- `npx playwright install chromium` already run
- Vite dev server reachable at `http://localhost:5173`
- Firebase project reachable (production `vocaboost-879c2`, OR a staging clone — set via `VITE_FIREBASE_PROJECT_ID`)
- **`audit/playwright/seeded_accounts.json` present** (produced by step 1 above)

For each batch:

```bash
# Read the batch spec
cat audit/playwright/batches/BXX_<name>.md

# Translate scenarios into Playwright specs under e2e/audit/BXX_*.spec.js
# (use the existing apBoost spec naming pattern as a reference)

# Run only this batch
npx playwright test e2e/audit/BXX_

# When the batch completes, copy FINDINGS_TEMPLATE.md to findings/findings_BXX.md
# and record results
```

Or invoke an agent (recommended for long unattended runs) — see `BATCH_ORCHESTRATION.md` for the prompt shape.

## Conventions

- **Batch IDs are stable.** Renaming or renumbering after the run starts breaks state continuity. Add new batches at the end with the next ID.
- **Each batch reads + writes `audit_state.json`** for cross-batch state (seeded user IDs, test IDs, etc.). Treat it like a session storage between agents.
- **Each batch produces `findings/findings_BXX.md`** from `FINDINGS_TEMPLATE.md` even if everything passes (an empty findings file documents that the batch ran cleanly).
- **Findings carry severities:** BLOCKER / HIGH / MEDIUM / LOW / NITPICK. Definitions in PLAN.md.
- **Selectors must be defensive.** vocaBoost has no `data-testid` attributes today; rely on role/aria/text, never on class names or layout positions. PLAN.md has a selector cheatsheet.
- **Screenshots are evidence, not decoration.** Capture before/after every interaction that mutates state.

## Reading order if you're picking this up cold

1. PLAN.md — the WHY (philosophy, severity rubric, what counts as a real bug)
2. BATCH_ORCHESTRATION.md — the WHAT (batches in priority order with rationale)
3. B00_setup_and_seed.md — the prerequisites
4. B02 and B03 — the highest-stakes batches (verify the recent fixes)
5. Everything else in batch order

## Maintenance

Add new batches when the surface area grows. If a finding turns into a recurring scenario, promote it to its own batch. Don't keep stale batches — delete or merge when a feature is removed.
