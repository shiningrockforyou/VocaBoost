# apBoost Playwright Audit — Batch Orchestration

> This document defines how to run the audit. Opus orchestrates, Sonnet agents execute.
> Each batch is a self-contained Sonnet agent with a fresh browser.

---

## Test Account Credentials

See `src/apBoost/TEST_ACCOUNTS.md` for full details. Quick reference:

| Role | Email | Password |
|------|-------|----------|
| Teacher | teacher@apboost.test | Teacher123! |
| Student | student@apboost.test | Student123! |

All batches should use the **Teacher** account unless the scenario specifically requires a student (e.g., T-02 route protection).

---

## Architecture

```
Opus (Orchestrator)
  |
  +-- Runs B0 (Setup & Seed) first
  |
  +-- Then launches B1-B11 in parallel (all independent after B0)
  |     Each Sonnet agent:
  |       1. Reads its batch prompt (this file + AUDIT_PLAN.md scenarios)
  |       2. Reads audit_state.json for test IDs and seed result IDs
  |       3. Logs into the app with provided credentials
  |       4. Executes its scenarios using Playwright MCP
  |       5. Writes findings to findings_BX.md using FINDINGS_TEMPLATE.md format
  |       6. Updates audit_state.json batchResults.BX.status
  |
  +-- Opus reviews all findings, consolidates, prioritizes fixes
```

---

## Batch Definitions

### B0: Setup & Seed
- **Scenarios:** Prerequisite P0
- **Must run first.** All other batches depend on this.
- **Flow:** Login as teacher → `/ap/teacher` → scroll to "Developer Tools" → click "Seed Full Test Data" → wait for success → verify test cards appear
- **Writes:** `audit_state.json` → `seeded: true`
- **Output:** `findings_B0.md`

---

### B1: Student Core Flow
- **Scenarios:** S-01, S-02, S-03, S-04, S-05, S-06, S-07
- **Focus:** Dashboard → Instructions → Start Test → Answer MCQ → Flag → Strikethrough → Navigator
- **Flow:** Login → `/ap` → click Micro test → Begin Test → answer Q1-Q3 → flag Q1/Q2 → strikethrough Q3 options → open navigator → verify grid states
- **Does NOT submit** the test. Tests interaction quality only.
- **Output:** `findings_B1.md`

---

### B2: Student Complete & Report
- **Scenarios:** S-08, S-09, S-10, S-11, S-12, S-13
- **Focus:** Full test completion pipeline — answer all MCQ → Review → Submit Section → FRQ → Submit Test → Report Card
- **Flow:** Login → `/ap` → click Micro test → Begin Test → answer all 15 MCQ → check for MCQ_MULTI → Review Screen → Submit Section 1 → FRQ choice → type FRQ answers → Submit Test → verify Report Card
- **This is a complete end-to-end flow** in one agent.
- **Writes:** Result ID to `audit_state.json` → `batchResults.B2.resultId`
- **Output:** `findings_B2.md`

---

### B3: Report Card Deep Dive
- **Scenarios:** S-14, S-15, S-16, S-17, S-18
- **Focus:** Report card details — MCQ table, flagged questions, FRQ pending, PDF download, dashboard return
- **Flow:** Login → `/ap` → click Micro test → Begin Test → answer all MCQ (flag Q2 specifically) → Submit Section 1 → type FRQ answers → Submit Test → deep-verify Report Card → Download PDF → Back to Dashboard
- **Does its own full test flow** to ensure a fresh report card with known state (Q2 flagged).
- **Output:** `findings_B3.md`

---

### B4: Second Test & Session Edge Cases
- **Scenarios:** S-19, S-20, S-21
- **Focus:** Multiple test attempts, hamburger menu, session resume after refresh
- **Flow:**
  1. Login → `/ap` → click Calc test → Begin Test → answer Q1/Q2, flag Q1 → note timer → **refresh page** → verify resume (S-21)
  2. Open hamburger menu → test "Go to Question" and "Exit Test" with cancel/confirm (S-20)
  3. Navigate to `/ap` → click Macro test → abbreviated flow: answer Q1-Q5, flag Q3/Q4, skip to Q15, submit with unanswered, complete FRQ, verify report card (S-19)
- **Output:** `findings_B4.md`

---

### B5: Annotation Tools & Visual Polish
- **Scenarios:** S-22, S-23, S-24, S-25, S-26
- **Focus:** Highlighter, line reader, timer warning colors, section lock, LaTeX rendering
- **Flow:**
  1. Login → `/ap` → click Calc test → Begin Test → verify LaTeX renders (S-26)
  2. Check for text stimulus questions → test Highlighter if available (S-22) → test Line Reader (S-23)
  3. Use `page.evaluate` to manipulate timer state to test warning colors (S-24)
  4. Answer all MCQ → Submit Section 1 → verify lock indicator in Section 2 (S-25)
- **Skip S-22/S-23 if no text stimulus questions exist** in seed data. Document the skip.
- **Output:** `findings_B5.md`

---

### B6: Resilience & Browser Edge Cases
- **Scenarios:** S-27, S-28, S-29, E-05
- **Focus:** Duplicate tab, connection status, seed results, beforeunload
- **Flow:**
  1. Login → navigate to `/ap/results/result_micro_student1` → verify seed report card loads (S-29)
  2. Navigate to `/ap` → click a test → Begin Test → open new tab to same URL → verify DuplicateTabModal (S-27)
  3. Start test session → intercept Firestore network requests → verify disconnected banner → restore → verify reconnected banner (S-28)
  4. Start test → verify beforeunload dialog fires on close attempt (E-05)
- **Output:** `findings_B6.md`

---

### B7: Teacher Dashboard & Gradebook
- **Scenarios:** T-01, T-02, T-03, T-04
- **Focus:** Teacher dashboard sections, route protection, gradebook with filters
- **Flow:**
  1. Login as teacher → `/ap/teacher` → verify all dashboard sections (T-01)
  2. Test route protection: try accessing teacher routes without teacher role (T-02). If no student account, document skip.
  3. Navigate to `/ap/gradebook` → verify pending submissions table (T-03)
  4. Test filter dropdowns: Status, Test, Class → verify table updates (T-04)
- **Output:** `findings_B7.md`

---

### B8: Teacher Grading & Analytics
- **Scenarios:** T-05, T-06, T-07, T-08, T-09
- **Focus:** FRQ grading workflow, exam analytics, student profile, PDF export
- **Uses seed results** — no dependency on student batches completing.
- **Flow:**
  1. Login as teacher → `/ap/gradebook` → filter to Pending
  2. Click "Grade" on a seed result → enter scores → save draft (T-05)
  3. Re-open → mark complete → verify status change (T-06)
  4. Navigate to `/ap/teacher/analytics/test_micro_full_1` → verify analytics (T-07)
  5. Click student name → verify APStudentProfile (T-08)
  6. Export PDF from analytics (T-09)
- **Output:** `findings_B8.md`

---

### B9: Teacher Management & Editor
- **Scenarios:** T-10, T-11, T-12, T-13, T-14, T-15
- **Focus:** Class manager, seed button, test editor, question bank, test assignment
- **Flow:**
  1. Login as teacher → `/ap/teacher/classes` → verify classes and students (T-10)
  2. Navigate to `/ap/teacher` → verify seed button exists (T-11)
  3. Navigate to `/ap/teacher/test/test_micro_full_1/edit` → verify editor loads (T-12)
  4. Navigate to `/ap/teacher/test/new` → verify create mode (T-13)
  5. Navigate to `/ap/teacher/questions` → verify question bank (T-14)
  6. Navigate to `/ap/teacher/test/test_micro_full_1/assign` → verify assignment page (T-15)
- **Output:** `findings_B9.md`

---

### B10: Error Handling
- **Scenarios:** E-01, E-02, E-03, E-04
- **Focus:** Error states, submit timeout, error boundary
- **Flow:**
  1. Login → `/ap/test/nonexistent_id` → verify error state (E-01)
  2. Navigate to `/ap/results/nonexistent_id` → verify error state (E-02)
  3. Start test → answer questions → intercept Firestore → submit → verify timeout modal → restore → retry (E-03)
  4. Use `page.evaluate` to trigger JS error → verify ErrorFallback renders (E-04)
- **Output:** `findings_B10.md`

---

### B11: Cross-Cutting Quality
- **Scenarios:** X-01, X-02, X-03
- **Focus:** Design token compliance, responsive layout, console errors
- **Flow:**
  1. Login → set up console listeners
  2. Navigate through: `/ap`, `/ap/teacher`, `/ap/gradebook`, `/ap/teacher/classes`
  3. On each page: check for raw Tailwind classes via `page.evaluate` (X-01)
  4. Resize to 375px → screenshot each page (X-02)
  5. Resize to 768px → screenshot each page (X-02)
  6. Collect all console errors/warnings (X-03)
- **Output:** `findings_B11.md`

---

## Dependency Graph

```
B0 (must run first)
 |
 +-- All of B1 through B11 can run in parallel
     (zero cross-batch dependencies)
```

This works because:
- Each agent logs in fresh and starts its own browser session
- Student batches that need a completed test do their own full flow
- Teacher batches use the 13 pre-seeded results (no need to wait for student agents)
- The `audit_state.json` is read-only after B0 for reference data (test IDs, result IDs)

---

## Findings File Convention

Each batch writes its findings to:
```
src/apBoost/criteria_audit/playwright_reports/findings_BX.md
```

Use the template at:
```
src/apBoost/criteria_audit/playwright_reports/FINDINGS_TEMPLATE.md
```

Every finding must include:
1. **Severity** (Blocker / High-Priority / Medium-Priority / Nitpick)
2. **Scenario reference** (S-XX or T-XX)
3. **Criteria audit reference** (section X.X)
4. **What happened** vs **what was expected**
5. **File(s) to fix** (exact paths)
6. **How to fix** (specific instructions)
7. **Acceptance test** (how to verify the fix)

This ensures the next agent working on fixes has everything needed.

### Incremental Writing (IMPORTANT)

**Write findings incrementally, not at the end.** If the agent crashes or runs out of quota mid-run, all findings up to that point are preserved.

1. **Before first scenario:** Write the findings file header (batch name, date, environment, status: `IN_PROGRESS`)
2. **After each scenario:** Append the scenario result (PASS/FAIL/PARTIAL/SKIP) and any findings to the file immediately
3. **After all scenarios:** Update the status to `COMPLETE` and append the Summary table at the bottom

This means the file is always in a valid state. If the agent dies after scenario 4 of 7, you still have findings for scenarios 1-4 with status `IN_PROGRESS`.

---

## After All Batches Complete

Opus (orchestrator) will:
1. Read all `findings_BX.md` files
2. Consolidate findings, deduplicate, re-prioritize
3. Create a master fix list sorted by severity
4. Update `AP_BOOST_TRACKER.md` with new findings
5. Assign fixes to implementation sprints

---

## Estimated Token Cost

| Batch | Complexity | Est. Tokens (Sonnet) |
|-------|------------|---------------------|
| B0 | Simple | ~5K |
| B1 | Complex | ~30K |
| B2 | Complex | ~35K |
| B3 | Medium | ~25K |
| B4 | Complex | ~30K |
| B5 | Medium | ~25K |
| B6 | Medium | ~25K |
| B7 | Medium | ~20K |
| B8 | Complex | ~30K |
| B9 | Medium | ~20K |
| B10 | Simple | ~15K |
| B11 | Medium | ~20K |
| **Total** | | **~280K** |

Running B1-B11 in parallel costs the same in tokens as running them sequentially, but completes ~10x faster.

---

## Phase 2: Advanced Testing (B12–B14)

> Run AFTER B0–B11 are complete and fixes applied. These batches test data correctness, edge-case resilience, and realistic user behavior.

---

### B12: Data Correctness

- **Purpose:** Verify that scores, percentages, AP projections, and aggregations displayed in the UI are mathematically correct.
- **Account:** student@apboost.test / Student123!
- **Depends on:** B2/B3 passing (basic submit→report flow works)
- **Flow:**
  1. Login → start Micro test → answer Q1-Q10 correctly (match answer key), Q11-Q15 incorrectly (pick wrong choice)
  2. Submit MCQ section → complete FRQ with known-length answers
  3. Submit test → navigate to Report Card
  4. **Extract via page.evaluate:**
     - Displayed MCQ score (should be 10/15 = 66.7%)
     - Per-question correct/incorrect indicators (Q1-Q10 green, Q11-Q15 red)
     - AP Score projection (compare against `apTestConfig.js` thresholds)
     - Section subtotals
  5. Login as teacher → open Gradebook
     - Verify this student's result appears with correct score
     - Verify pending count incremented by 1
  6. Navigate to Analytics for Micro test
     - Verify class average updated correctly
     - Verify question difficulty percentages make sense (Q1 should be "easy" if most seed students got it right)
  7. Open Student Profile → verify test history shows correct score
- **Output:** `findings_B12.md`

---

### B13: Chaos / Stress Testing

- **Purpose:** Push the app to its limits — rapid inputs, double-submits, extreme content. Find crashes and data corruption.
- **All accounts use password:** Student123!

#### B13-P1: Speed Clicker (student4@apboost.test)
- Click answer A → B → C → D within 200ms each on every question
- Double-click Next button
- Double-click Submit Section
- Double-click Submit Test
- Complete 15 MCQ in under 10 seconds
- **Verify:** No double-submit, no duplicate results, report card shows last-selected answers

#### B13-P2: Rapid Flagger (student5@apboost.test)
- Flag/unflag Q1 ten times in rapid succession (100ms between clicks)
- Answer Q1-Q15, flagging every other question
- On review screen, verify flag count matches
- **Verify:** Flag state consistent, no orphaned flags, navigator grid correct

#### B13-P3: Navigator Spammer (student6@apboost.test)
- Open navigator → click Q15 → click Q1 → click Q8 → click Q3 → click Q12 (all within 2 seconds)
- Answer current question → open navigator → jump again
- Repeat 20 times
- **Verify:** Always lands on correct question, answer state preserved across jumps

#### B13-P4: Submit Interceptor (student7@apboost.test)
- Answer all MCQ → go to review → click Submit Section
- Immediately intercept Firestore network requests (block them)
- Wait for timeout modal → restore network → click Retry
- **Verify:** SubmitProgressModal appears, retry works, no duplicate submissions

#### B13-P5: XSS / Injection Tester (student8@apboost.test)
- Complete MCQ normally
- On FRQ, type: `<script>alert('xss')</script>`
- On second FRQ, type: `'; DROP TABLE ap_test_results;--`
- On third FRQ, type: 2000 characters of lorem ipsum + emoji + Korean
- **Verify:** No XSS execution, no errors, answers stored and displayed safely, report card renders content as text not HTML

#### B13-P6: Back Button Abuser (student9@apboost.test)
- Start test → answer Q1 → press browser Back (page.goBack())
- Handle beforeunload dialog → click Stay
- Answer Q2 → press Back again → click Stay
- Navigate forward with Next → verify Q1 answer still selected
- **Verify:** beforeunload fires every time, answers persist, no navigation escape

#### B13-P7: Timer Manipulator (student10@apboost.test)
- Start test → use page.evaluate to set timer to 30 seconds
- Watch for yellow warning → red warning color transitions
- Let timer hit 0 → verify auto-submit fires
- Check report card after auto-submit
- **Verify:** Warning colors transition correctly, auto-submit produces valid result, scores correct

#### B13-P8: Concurrent Submitter (student11@apboost.test)
- Answer all MCQ → go to review
- Use page.evaluate to fire submitSection() twice simultaneously
- Check that only one result is created
- **Verify:** No duplicate results in Firestore, no error, report card loads

- **Output:** `findings_B13.md` (one combined file, sections per persona)

---

### B14: Realistic Student Simulation

- **Purpose:** Simulate how real teenagers actually use the app — with hesitation, mistakes, distraction, and confusion. Tests UX gaps, not crashes.
- **All accounts use password:** Student123!
- **Timing:** All actions include realistic human delays (2-15 seconds between interactions)

#### B14-A: The Careful One (student4@apboost.test)
- Read each question 8-15 seconds before answering
- Select answer, wait 2s, change answer 30% of the time
- Flag 3-4 uncertain questions
- After Q15, navigate back to each flagged question via navigator, re-read 10-20s each
- Change 1 of 3 flagged answers
- Open review screen, scroll through slowly (5s), check summary text
- Submit after reviewing
- **Verify:** Report card reflects final answers (not original ones). Flagged questions noted. Time spent is reasonable.

#### B14-B: The Rusher (student5@apboost.test)
- 1-3 seconds per question, pick first instinct
- Never flag anything
- Don't read review screen — submit immediately
- On FRQ, type 1-2 sentences (10-15 words each)
- Total test time under 3 minutes
- **Verify:** Fast completion works. Timer still visible throughout. Report card loads instantly. No "in progress" stale state.

#### B14-C: The Second-Guesser (student6@apboost.test)
- Answer Q1-Q15 in order (3-5s each)
- Go back to Q3 via navigator, change answer (5s deliberation)
- Go to Q11, change answer
- Go to Q7, look for 5s, keep same answer
- Open review → click "Return to Questions"
- Go to Q14, change answer
- Return to review → click "Return to Questions" again
- Go to Q2, keep same answer
- Submit on third visit to review
- **Verify:** Final answers correct after 3 changes. Review screen updated each time. Navigator shows all answered. No stale state.

#### B14-D: The Confused One (student7@apboost.test)
- Complete MCQ section normally (3-5s per question)
- Submit Section 1 → see FRQ Choice screen
- Click a topic → read for 5s → try to go back/cancel if possible
- Pick a different topic
- Start typing FRQ → delete half → retype differently
- Submit with an incomplete sentence ("I think the answer involves...")
- **Verify:** FRQ topic selection works. Partial answers save. Report card shows FRQ as submitted (not missing). Can navigate FRQ choice screen without getting stuck.

#### B14-E: The Distracted One (student8@apboost.test)
- Answer Q1-Q5 (normal pace)
- Open new browser tab (page.context().newPage()), switch to it, wait 45 seconds
- Switch back to test tab — is test still there? Timer correct?
- Answer Q6-Q10
- Trigger page blur via page.evaluate (simulate minimize), wait 30 seconds
- Trigger page focus — any issues?
- Answer Q11-Q15, submit normally
- **Verify:** Tab switching doesn't break session. Timer continues during blur (or pauses and resumes correctly). All answers persist after distraction.

#### B14-F: The Lost One — Mobile (student9@apboost.test)
- Set viewport to 375x667 (iPhone SE)
- Scroll through answer choices — accidentally tap wrong one
- Tap correct answer — verify first selection cleared
- Try to find and open navigator — is it discoverable?
- Tap navigator grid cell — does it navigate correctly?
- Press browser back (page.goBack()) — handle dialog
- On FRQ, type with viewport simulating keyboard open (375x350)
- Scroll to verify typed content
- Submit from mobile
- **Verify:** All touch targets reachable. Navigator usable on small screen. FRQ input not hidden by keyboard. Review screen scrollable. Submission works.

#### B14-G: The Technical Difficulties (student10@apboost.test)
- Answer Q1-Q5 normally
- Intercept and fail all Firestore network requests for 10 seconds
- Answer Q6-Q8 while "offline" — does UI still respond?
- Restore network — do queued answers sync?
- Answer Q9-Q12
- Close the page (page.close()), open new page, navigate back to test URL
- Resume session — are all 12 answers restored?
- Answer Q13-Q15, submit
- **Verify:** Offline answers queue in IndexedDB. Sync on reconnect. Session resume restores all state. No data loss. Report card correct.

#### B14-H: The Group Chat Student (student11@apboost.test)
- Start test in Tab 1, answer Q1-Q3
- Open same test URL in Tab 2 (context.newPage())
- DuplicateTabModal should appear in Tab 2 — click Take Control
- Answer Q4-Q6 in Tab 2
- Close Tab 2, go back to Tab 1
- Tab 1 should show DuplicateTabModal — click Take Control
- Verify Q1-Q6 all present (answers from both tabs merged)
- Answer Q7-Q15 in Tab 1, submit
- **Verify:** Session handoff works both directions. Answers persist across takeovers. No answer loss. Report card shows all 15 answers.

- **Output:** `findings_B14.md` (one combined file, sections per persona)

---

## Phase 2 Dependency Graph

```
B0-B11 complete (all fixes applied)
 |
 +-- B12 (Data Correctness) — can run independently
 |
 +-- B13-P1 through B13-P8 — all 8 in parallel (different accounts)
 |
 +-- B14-A through B14-H — all 8 in parallel (different accounts)
```

B13 and B14 use the SAME accounts but different tests:
- B14 uses Micro test (student takes it fresh)
- B13 uses Macro test (so no session conflict with B14)

If running B13 + B14 simultaneously, ensure each persona pair uses a different test:

| Account | B14 (Realistic) | B13 (Chaos) |
|---------|-----------------|-------------|
| student4 | Micro test | Macro test |
| student5 | Micro test | Macro test |
| student6 | Micro test | Macro test |
| student7 | Micro test | Macro test |
| student8 | Micro test | Calc test |
| student9 | Micro test | Calc test |
| student10 | Micro test | Calc test |
| student11 | Micro test | Calc test |

---

## Phase 2 Estimated Token Cost

| Batch | Complexity | Est. Tokens (Sonnet) |
|-------|------------|---------------------|
| B12 | Complex | ~35K |
| B13 (×8 personas) | Complex | ~30K each = ~240K |
| B14 (×8 personas) | Complex | ~35K each = ~280K |
| **Phase 2 Total** | | **~555K** |

---

## Phase 3: B14 Retest (Fix Verification)

> Run AFTER B14 consolidated fixes are applied. Each agent re-runs its original B14 persona scenario AND verifies the specific fixes from `findings_B14_consolidated_fixes.md`.

**Instructions for ALL B14 retest agents:**
1. Read your previous findings file to know what was found last time
2. Read `findings_B14_consolidated_fixes.md` for the specific fixes and verification steps assigned to you
3. Re-run your full original B14 persona scenario from this file (same flow as Phase 2 B14)
4. After the full scenario, run each targeted fix verification step
5. Report: (a) original scenario pass/fail, (b) each previous finding as FIXED or STILL OPEN, (c) any new regressions
6. Save results to `findings_B14X_retest.md`

---

### B14A-retest: The Careful One (student4@apboost.test / Student123!)

- **Previous findings:** `findings_B14A.md`
- **Fixes to verify:** None directly (all B14A findings were already fixed before this round)
- **Focus:** Regression testing — verify session lifecycle, answer changes, flagging, navigator, and review still work correctly
- **Full scenario:** Re-run B14-A persona flow (read questions 8-15s, change answers 30%, flag 3-4, revisit flags via navigator, change 1, review, submit)
- **Extra checks:**
  - Verify NAVIGATION reconciliation still works (refresh mid-test, resume, position correct)
  - Verify flatNavigationItems has no duplicate entries
  - Verify DuplicateTabModal does NOT appear on fresh session start (suppressTakeoverRef)
- **Output:** `findings_B14A_retest.md`

---

### B14B-retest: The Rusher (student5@apboost.test / Student123!)

- **Previous findings:** `findings_B14B.md`
- **Fixes to verify:**
  - **FIX-7 (B14B-LIVE-002):** Timer visible on review screen — after answering all MCQ, click "Review", verify TestTimer component renders with time remaining
  - **FIX-8 (B14B-LIVE-007):** Submit confirmation — on final section review, click "Submit Test", verify confirmation dialog appears before actual submission
- **Full scenario:** Re-run B14-B persona flow (1-3s per question, no flags, immediate submit, short FRQ, under 3 minutes)
- **Extra checks:**
  - Verify letter badge is visible when answer selected (bg-white text-brand-primary, not bg-white/20)
  - Verify FRQ sub-question answer ordering is correct on report card
  - Verify no `code.startsWith` errors in console
- **Output:** `findings_B14B_retest.md`

---

### B14C-retest: The Second-Guesser (student6@apboost.test / Student123!)

- **Previous findings:** `findings_B14C.md`
- **Fixes to verify:**
  - **FIX-6 (B14C-003):** Submit hardening — answer Q14, immediately navigate to Review and click Submit within 2 seconds. After submission, verify Firestore result contains Q14's final answer (check report card)
- **Full scenario:** Re-run B14-C persona flow (answer all, go back and change Q3/Q11/Q14, review 3 times, submit on third visit)
- **Extra checks:**
  - Verify answer changes persist across navigator jumps
  - Verify review screen updates answered count after each change
  - Run `mcp__playwright__browser_console_messages` — zero errors
- **Output:** `findings_B14C_retest.md`

---

### B14D-retest: The Confused One (student7@apboost.test / Student123!)

- **Previous findings:** `findings_B14D.md`
- **Fixes to verify:**
  - **FIX-9 (B14D-002):** FRQ discard warning — complete MCQ, enter FRQ section, type answers in FRQ textarea, then click "Change submission type" link in header. Verify: (a) confirmation dialog appears warning about discarding answers, (b) Cancel keeps answers, (c) Confirm returns to choice screen
- **Full scenario:** Re-run B14-D persona flow (MCQ normally, FRQ choice confusion, type/delete/retype, submit incomplete)
- **Extra checks:**
  - Verify two-step FRQ confirmation (select card → "Confirm & Continue")
  - Verify "Change submission type" link visible in test header during FRQ
  - Verify partial FRQ answers save and appear on report card
- **Output:** `findings_B14D_retest.md`

---

### B14E-retest: The Distracted One (student8@apboost.test / Student123!)

- **Previous findings:** `findings_B14E.md`
- **Fixes to verify:** None directly (B14E findings were already fixed or not actionable)
- **Focus:** Regression testing — verify tab switching, visibility changes, and focus/blur don't break session
- **Full scenario:** Re-run B14-E persona flow (answer Q1-Q5, switch tab 45s, answer Q6-Q10, blur 30s, focus, answer Q11-Q15, submit)
- **Extra checks:**
  - Verify no `code.startsWith` errors in console
  - Verify timer correct after tab switch and blur periods
  - Verify all 15 answers present on report card
- **Output:** `findings_B14E_retest.md`

---

### B14F-retest: The Lost One — Mobile (student9@apboost.test / Student123!)

- **Previous findings:** `findings_B14F.md`
- **Fixes to verify:**
  - **FIX-12 (B14F-001):** FRQ textarea auto-scroll — set viewport to 375x667, navigate to FRQ question, resize to 375x350 (simulate keyboard), tap/focus textarea, verify page scrolls so textarea is visible (take screenshot)
  - **FIX-13 (B14F-002):** SPA navigation guard — start test, answer Q1, press browser Back (`page.goBack()`), verify confirmation modal appears with "Stay"/"Leave Test" buttons. Click "Stay" → still on test. Press Back again → click "Leave Test" → navigates away
  - **FIX-14 (B14F-003/004/005/006):** Touch targets — at 375x667 viewport, measure these elements via `page.evaluate` (getBoundingClientRect):
    - Hamburger menu button: must be ≥44x44px
    - Navigator toggle (center button in bottom bar): must be ≥44px height
    - Navigator grid cells: must be ≥44x44px
    - Navigator close button (✕): must be ≥44x44px
    - Back/Next buttons: must be ≥44px height
    - Flag button: must be ≥44px height
    - Begin/Resume button on instruction screen: must be ≥44px height
    - Strikethrough button (X next to answer choices): must be ≥44x44px
  - **FIX-15 (B14F-007):** IDB error suppression — navigate to test, answer Q1, press Back (proceed through modal), navigate back to test. Run `mcp__playwright__browser_console_messages` — zero IDBDatabase "connection closing" errors
- **Full scenario:** Re-run B14-F persona flow (375x667 viewport, tap wrong answer then correct, find navigator, tap grid cell, browser back, FRQ with keyboard, submit from mobile)
- **Output:** `findings_B14F_retest.md`

---

### B14G-retest: The Technical Difficulties (student10@apboost.test / Student123!)

- **Previous findings:** `findings_B14.md` (B14G findings were stored in the base findings file)
- **Fixes to verify:**
  - **FIX-1 (B14G-001):** Stale closure fix — answer Q1-Q5 normally. Intercept/block ALL Firestore network requests. Answer Q6-Q8 while "offline" (UI should still respond). Restore network. Wait 5 seconds. Use `page.evaluate` to check IndexedDB pending count: `const db = await indexedDB.open('ap_boost_queue'); ...count pending items for session` — must be 0. All 8 answers must appear in Firestore.
  - **FIX-2 (B14G-002):** Content-based reconciliation — answer Q1-Q5 normally. Block Firestore. Answer Q6-Q8 offline. Restore network briefly (allow partial flush of Q6 only if timing works). Close the page. Open new page, navigate back to test URL. Resume session. Verify ALL answers Q1-Q8 are present (review screen shows "Answered: 8/15"). No answers should be lost due to timestamp-based staleness.
  - **FIX-10 (B14G-004):** Heartbeat recovery speed — start test, answer Q1. Block Firestore requests for 20 seconds (enough for 2 heartbeat failures at 15s interval). Restore network. Measure time from restore to "Reconnected" banner appearing — should be under 5 seconds (immediate heartbeat on online event).
- **Full scenario:** Re-run B14-G persona flow (answer Q1-Q5, go offline 10s, answer Q6-Q8, restore, answer Q9-Q12, close/reopen, resume, answer Q13-Q15, submit)
- **Extra checks:**
  - Verify ConnectionStatus banner shows "Connection lost" during offline period
  - Verify queue length indicator updates correctly
  - Verify report card has all 15 correct answers after full flow
- **Output:** `findings_B14G_retest.md`

---

### B14H-retest: The Group Chat Student (student11@apboost.test / Student123!)

- **Previous findings:** `findings_B14H.md`
- **Fixes to verify:**
  - **FIX-3 (B14H-001):** DuplicateTabModal on instruction screen — start test in Tab 1, answer Q1-Q3. Open same test URL in Tab 2 (new page). Tab 2 should be on instruction screen. Verify DuplicateTabModal appears OVERLAYING the instruction screen (take screenshot). Tab 2 should NOT be able to click "Resume Test" while modal is visible.
  - **FIX-4 (B14H-002):** handleBegin guard — if somehow Tab 2 bypasses modal (shouldn't be possible after FIX-3), verify that "Resume Test" click does nothing when isInvalidated is true. Test by checking: after Tab 2 takes control and Tab 1 shows modal, Tab 1 cannot click its own "Resume Test" or interact with the test.
  - **FIX-5 (B14H-003):** Fire-and-forget flush — Tab 1 answers Q1-Q3 quickly (don't wait for sync). Immediately open Tab 2 to same URL. Tab 2 clicks "Use This Tab" (Take Control). Tab 2 clicks "Resume Test". Verify: Q1-Q3 answers are present in Tab 2's session (navigate to Q1, Q2, Q3 and check selections). This confirms Tab 1 flushed its queue when it received SESSION_QUERY.
- **Full scenario:** Re-run B14-H persona flow (Tab 1 answer Q1-Q3, Tab 2 take control, answer Q4-Q6, close Tab 2, Tab 1 take control, verify Q1-Q6, answer Q7-Q15, submit)
- **Extra checks:**
  - Verify session handoff works both directions
  - Verify no answer loss across takeovers
  - Verify report card shows all 15 answers
- **Output:** `findings_B14H_retest.md`

---

### B14 Retest Dependency Graph

```
No setup needed (B0 data still seeded)
 |
 +-- All 8 B14X-retest agents run in parallel (different accounts)
```

### B14 Retest Estimated Token Cost

| Batch | Complexity | Est. Tokens |
|-------|------------|------------|
| B14A-retest | Medium | ~30K |
| B14B-retest | Medium | ~30K |
| B14C-retest | Medium | ~30K |
| B14D-retest | Medium | ~30K |
| B14E-retest | Medium | ~25K |
| B14F-retest | Complex | ~40K |
| B14G-retest | Complex | ~40K |
| B14H-retest | Complex | ~40K |
| **Total** | | **~265K** |
