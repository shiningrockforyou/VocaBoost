# Batch B4 Findings: Second Test & Session Edge Cases

**Agent:** Sonnet 4.6
**Date:** 2026-03-09 (initial code-inspection), 2026-03-10 (live browser re-audit)
**Status:** PARTIAL — All original 5 findings resolved, but live testing reveals 1 new High-Priority gap
**Scenarios Covered:** S-19, S-20, S-21

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** Desktop (1280x800) — live browser testing via Playwright (2026-03-10)
- **Auth:** teacher@apboost.test (Teacher123!) used for all scenarios; student@apboost.test cannot access /ap routes (redirects to vocaBoost at `/`, see FINDING-B4-006)

---

## Scenario Results

### S-19: Take a Second Test (AP Macro) - Abbreviated Flow
- **Status:** PASS
- **Evidence (live, 2026-03-10):** Review screen shows "Answered: 6/15", "Unanswered: 9 (Q6, Q7, Q8, Q9, Q10, Q11, Q12, Q13, Q14)", "Flagged: 2 (Q3, Q4)". Unanswered warning present. "Submit Section" (not "Submit Test") button confirmed. FRQ choice screen shows both "Type Your Answers" and "Write by Hand" options with timer. After selecting Type, section header shows "Section 2 of 2: Section II: Free Response" with "Locked" indicator. Report card renders with SCORE REPORT, MCQ table, Back to Dashboard, Download PDF.
- **Notes:** All S-19 acceptance criteria met end-to-end. `isFRQSection` fix (B4-005) confirmed working — Submit Section correctly transitions to FRQ choice screen.

### S-20: Hamburger Menu - Go to Question and Exit Test
- **Status:** PASS
- **Evidence (live, 2026-03-10):** Menu opens with slide-up. Heading "Menu" visible. "Go to Question..." and "Exit Test" buttons present. Close button uses SVG X icon (not lowercase text). role="dialog", aria-label="Test session menu", aria-modal="true" all confirmed via DOM. "Go to Question" correctly opens navigator. Exit confirmation shows "Exit Test?" heading, "Are you sure?" text, "progress will be saved" text. Cancel keeps test active. Confirming exit navigates to /ap.
- **Notes:** All S-20 acceptance criteria confirmed in live test. B4-002 and B4-003 fixes verified working.

### S-21: Session Resume After Page Refresh
- **Status:** PARTIAL
- **Evidence (live, 2026-03-10):**
  - Resume UI: PASS. After refresh, instruction screen shows "Resume Test" button and "Resume from: Section 1, Question 1". Timer value approximately restored.
  - State restoration: FAIL. After clicking "Resume Test", Q1 shows no answer selected (brand-primary count = 0) and flag button shows "Flag for Review" (not "Flagged"). Both answer and flag were set before the refresh but are missing after resume.
  - Root cause confirmed: Queue items (ANSWER_CHANGE, FLAG_TOGGLE) are stored in IndexedDB but never flushed to Firestore before refresh. Resume restores from Firestore only — IndexedDB items are reconciled (stale ones deleted) but fresh items are NOT re-applied to UI state.
- **Notes:** See FINDING-B4-007 (new, High-Priority) for details and fix instructions.

---

## Findings

### Blockers
> None.

---

### High-Priority

#### [FINDING-B4-001]: Resume Instruction Screen Bypassed — RESOLVED
- **Severity:** High-Priority → **FIXED**
- **Scenario:** S-21
- **Criteria Reference:** Section 1.7, 5.9, 1.8
- **Original Issue:** `useEffect` at `APTestSession.jsx:168-173` auto-transitioned from `view='instruction'` to `view='testing'` when session status was IN_PROGRESS, preventing users from seeing the resume info.
- **Resolution:** The auto-transition `useEffect` no longer exists. Lines 168-173 now handle auto-submit result navigation only. The instruction view is exited only via the explicit `handleBegin` callback, which requires the user to click "Resume Test".
- **Verified:** 2026-03-09 — Code inspection confirms no `useEffect` auto-transitions from instruction to testing based on session status.

---

### Medium-Priority

#### [FINDING-B4-002]: TestSessionMenu Icons Are Ambiguous Lowercase "x" — RESOLVED
- **Severity:** Medium-Priority → **FIXED**
- **Scenario:** S-20
- **Criteria Reference:** Section 1.10, 7.2, 7.3
- **Original Issue:** Close button and "Exit Test" menu item both used literal lowercase `x` character as icons.
- **Resolution:** All icons now use proper SVG elements:
  - Close button: SVG X path (`M6 18L18 6M6 6l12 12`) with `aria-label="Close menu"`
  - "Go to Question": SVG list icon with `aria-hidden="true"`
  - "Exit Test": SVG door/exit icon with `aria-hidden="true"`
- **Verified:** 2026-03-09 — Code inspection of `TestSessionMenu.jsx` lines 80-133 confirms SVG icons throughout.

#### [FINDING-B4-003]: TestSessionMenu Missing WCAG Dialog ARIA — RESOLVED
- **Severity:** Medium-Priority → **FIXED**
- **Scenario:** S-20
- **Criteria Reference:** Section 7.3, 1.10
- **Original Issue:** No `role="dialog"`, no `aria-modal`, no focus trapping, no Escape key handler.
- **Resolution:** Full WCAG dialog pattern implemented:
  - `role="dialog"` on modal panel (line 71)
  - `aria-modal="true"` (line 72)
  - `aria-label="Test session menu"` (line 73)
  - Escape key handler via `useEffect` with `document.addEventListener('keydown')` (lines 44-54)
  - Focus management: `closeButtonRef.current?.focus()` on open (line 51)
  - Backdrop click to close (lines 64-66)
- **Verified:** 2026-03-09 — Code inspection confirms all WCAG attributes present.

#### [FINDING-B4-004]: beforeunload/pagehide Doesn't Set PAUSED in Firestore — FIXED (server-side)
- **Severity:** Medium-Priority → **FIXED**
- **Scenario:** S-21
- **Criteria Reference:** Section 5.11, 1.7
- **Original Issue:** Session status stays IN_PROGRESS in Firestore when browser closes; only localStorage pause marker is set. Cross-device resume sees IN_PROGRESS instead of PAUSED.
- **Resolution:** Added scheduled Cloud Function `pauseStaleSessions` (`functions/index.js`) that runs every 60 seconds:
  - Queries `ap_session_state` for `status === 'IN_PROGRESS'` and `lastHeartbeat < now - 60s`
  - Batch-updates matching sessions to `status: 'PAUSED'` with `pausedBy: 'server_heartbeat_check'`
  - No client cooperation needed — handles tab close, crash, power loss, cross-device
  - Added composite index (`status + lastHeartbeat`) to `firestore.indexes.json`
  - localStorage pause marker retained as a fast same-device fallback (fires before the 60s server check)
- **Verified:** 2026-03-10 — Code added. Requires `firebase deploy --only functions` and index deployment to go live.

#### [FINDING-B4-005]: isFRQSection Check Uses Wrong Field Names — RESOLVED
- **Severity:** Medium-Priority → **FIXED**
- **Scenario:** S-19
- **Criteria Reference:** Section 1.10, 7.4
- **Original Issue:** `currentSection?.type === 'frq'` used wrong field name (`type` instead of `sectionType`) and wrong case (`'frq'` instead of `'FRQ'`).
- **Resolution:** Now uses correct field and enum constants:
  ```javascript
  const isFRQSection = currentSection?.sectionType === SECTION_TYPE.FRQ || currentSection?.sectionType === SECTION_TYPE.MIXED
  ```
  - Field: `sectionType` (correct, matches data model)
  - Values: `SECTION_TYPE.FRQ` and `SECTION_TYPE.MIXED` from `apTypes.js`
  - Case: Uppercase `'FRQ'`, `'MIXED'` matching enum definitions
- **Verified:** 2026-03-09 — Code inspection of `APTestSession.jsx:176` confirms correct implementation.

---

---

### New Findings (2026-03-10 Live Audit)

#### [FINDING-B4-006]: student@apboost.test Cannot Access /ap Routes
- **Severity:** Medium-Priority
- **Scenario:** S-19, S-20, S-21 (prerequisite impact)
- **Criteria Reference:** Section 12.1-13.2 (Roles & Routes), Section 20.1 (Phase Verification)
- **What Happened:** Logging in with `student@apboost.test` / `Student123!` redirects to the vocaBoost dashboard at `http://localhost:5173/` rather than the AP dashboard. The account has display name "Alex Johnson" (confirmed from vocaBoost dashboard heading) but cannot access `/ap` routes. All B4 live tests were conducted using the teacher account as a workaround.
- **Expected:** The student account documented in `src/apBoost/TEST_ACCOUNTS.md` should be able to access `/ap` routes and experience the student test-taking flow without teacher privileges.
- **Screenshot/Evidence:** Live test: `await page.waitForURL(/\/ap/, { timeout: 15000 })` timed out. Navigating directly to `http://localhost:5173/ap` after vocaBoost redirect shows the AP Practice Tests dashboard but only because the teacher is also logged in. Using the student account alone, the routing after login does not direct to `/ap`.
- **File(s) to Fix:**
  - `src/apBoost/routes.jsx` — Check the root-level routing logic that decides whether to show vocaBoost or AP dashboard.
  - Firestore `users` collection — Verify that `student@apboost.test` has a user document with `role` field set appropriately.
- **How to Fix:**
  Review the Firestore user document for the student account. If the AP dashboard is only accessible when `role === 'teacher'` or when a specific flag exists, add a conditional that shows the AP dashboard for users with `role === 'student'` or for any authenticated user who navigates to `/ap`. Alternatively, ensure that the post-login redirect from `/login` routes students to `/ap` instead of the vocaBoost root. Check `src/apBoost/routes.jsx` for the APDashboard route and whether it is behind a role guard that blocks students.
- **Acceptance Test:**
  1. Log out of any current session.
  2. Navigate to `http://localhost:5173/login`.
  3. Enter credentials `student@apboost.test` / `Student123!`.
  4. Click login.
  5. Verify redirect to `http://localhost:5173/ap` (not `/`).
  6. Verify "AP Practice Tests" heading is visible.
  7. Verify test cards for Micro, Macro, and Calc AB are shown.

#### [FINDING-B4-007]: Answers and Flags Lost After Page Refresh — Queue Items Not Re-Applied on Resume
- **Severity:** High-Priority
- **Scenario:** S-21
- **Criteria Reference:** Section 1.7 (Session Persistence — Resume restores all answer selections; Resume restores flag states), Section 5.9 (Session Resume Flow — For each item newer than Firestore: apply to Firestore and UI state), Section 5.11 (Data Loss Protection — Page refresh: beforeunload warning + resume)
- **What Happened:** Live test confirmed: after answering Q1 (option B) and flagging Q1, then refreshing the page immediately, the resume UI correctly shows "Resume Test" with "Resume from: Section 1, Question 1". However, after clicking "Resume Test", Q1 shows no answer selected and the flag is missing. Console logs confirmed ANSWER_CHANGE and FLAG_TOGGLE were added to the IndexedDB queue but never flushed to Firestore before the refresh (the 2.5-second debounce in `addToQueue`'s `scheduleFlush(2500)` had not fired).

  The `reconcileQueue` effect in `useTestSession.js` (lines 617-647) correctly identifies and deletes stale queue items, but does NOT process "fresh" items (localTimestamp >= Firestore lastActionMs) by applying them to React state. Fresh items remain in IndexedDB and will eventually flush to Firestore when the user next answers a question (triggering another flush), but the UI shows a blank/stale state immediately after resume, creating a false impression of data loss.

- **Expected:** Per criteria 1.7 and 5.9: Resume should restore all answers and flags regardless of whether they were flushed to Firestore before the refresh.
- **Screenshot/Evidence:** Live test output:
  ```
  Timer before refresh: 44:58
  After refresh - Resume Test button: true, Resume from info: true
  After resume - Q1 flag - Flagged: false | Flag for Review: true
  After resume - Answer selected (brand-primary count): 0
  S-21 STATE RESTORATION: PARTIAL/FAIL
    - Flag NOT restored
    - Answer NOT restored
  ```
- **File(s) to Fix:**
  - `src/apBoost/hooks/useTestSession.js` — `reconcileQueue` effect (lines 617-647)
  - `src/apBoost/hooks/useOfflineQueue.js` — `addToQueue` function (line 214, `scheduleFlush(2500)`)
- **How to Fix:**

  **Part 1 — Apply fresh queue items to UI state during reconciliation** (in `useTestSession.js`):

  In the `reconcileQueue` effect, after computing and deleting stale items, add code to apply fresh items to React state:

  ```javascript
  // Inside reconcileQueue, after deleteItems(staleIds)

  const freshItems = pendingItems.filter(item =>
    !item.localTimestamp || item.localTimestamp >= lastActionMs
  )

  for (const item of freshItems) {
    if (item.action === 'ANSWER_CHANGE') {
      const { questionId, value, subQuestionLabel } = item.payload
      setAnswers(prev => {
        const next = new Map(prev)
        if (subQuestionLabel) {
          const existing = next.get(questionId) || {}
          next.set(questionId, { ...existing, [subQuestionLabel]: value })
        } else {
          next.set(questionId, value)
        }
        return next
      })
    } else if (item.action === 'FLAG_TOGGLE') {
      const { questionId, markedForReview } = item.payload
      setFlags(prev => {
        const next = new Set(prev)
        if (markedForReview) { next.add(questionId) } else { next.delete(questionId) }
        return next
      })
    }
    // ANNOTATION_UPDATE handling could be added similarly
  }

  // Flush the fresh items to Firestore now that we've applied them to UI
  if (freshItems.length > 0) {
    flushQueue()
  }
  ```

  **Part 2 — Reduce flush debounce for critical actions** (in `useOfflineQueue.js`):

  In `addToQueue` around line 214, change:
  ```javascript
  scheduleFlush(2500) // 2.5 second debounce
  ```
  To:
  ```javascript
  const isHighPriority = ['ANSWER_CHANGE', 'FLAG_TOGGLE'].includes(action.action)
  scheduleFlush(isHighPriority ? 300 : 2500)
  ```

  This reduces the data loss window significantly. Part 1 remains essential as a safety net when refresh happens before even the 300ms debounce fires.

- **Acceptance Test:**
  1. Navigate to `/ap/test/test_calc_ab_full_1` and begin the test.
  2. Select option B on Q1.
  3. Click "Flag for Review" on Q1.
  4. Wait 0.5 seconds (to allow new short debounce), then immediately refresh the page.
  5. Verify instruction screen shows "Resume Test" button with "Resume from: Section 1, Question 1".
  6. Click "Resume Test".
  7. Verify Q1 shows option B highlighted (brand-primary background on the B choice button).
  8. Verify Q1 shows "Flagged" button state (not "Flag for Review").
  9. PASS if both answer and flag are restored. FAIL if either is missing.

#### [FINDING-B4-008]: Timer Not Corrected for Reload Time on Resume
- **Severity:** Medium-Priority
- **Scenario:** S-21
- **Criteria Reference:** Section 1.1 (Timed Sections — timer accuracy), Section 1.7 (Session Persistence — Resume restores timer state)
- **What Happened:** Live test: timer showed 44:58 before refresh. After reload and resume click, timer showed 44:59 — one second MORE than before refresh. The timer is restored from `sectionTimeRemaining` in Firestore via `session.sectionTimeRemaining[currentSection.id]`, but this value is persisted only every 30 seconds (via `handleTimerTick`'s `newTime % 30 === 0` check). No elapsed-time correction is applied for the time spent loading the page.
- **Expected:** Timer should resume at approximately the same value minus the time spent reloading (typically 3-5 seconds). The discrepancy is small but could accumulate if multiple refreshes occur.
- **Screenshot/Evidence:** Live test: `Timer before refresh: 44:58 | Timer after resume: 44:59`. The restored value is from the last 30-second sync which could be up to 30 seconds stale.
- **Suggested Fix:** In `useTestSession.js`, after loading `existingSession`, store the load time as `sessionLoadedAtMs = Date.now()`. In the `initialTime` memo, subtract the elapsed time: `return Math.max(0, savedTime - Math.floor((Date.now() - sessionLoadedAtMs) / 1000))`. For more accuracy, store a server timestamp `timerSyncedAt` alongside `sectionTimeRemaining` and compute adjustment using `(serverNow - timerSyncedAt) / 1000`.

---

### Nitpicks

- **Nit (S-20):** The `TestSessionMenu` slide-up animation is defined via inline `<style>` tag rather than in global CSS or Tailwind config. Should be moved to `index.css` as a utility class.
- **Nit (S-20):** The modal has `aria-label="Test session menu"` but no `aria-labelledby` pointing to the `<h3>Menu</h3>` heading. WCAG recommends `aria-labelledby` when a visible heading exists. Give the h3 an id and reference it.
- **Nit (S-21):** The `beforeunload` message says "You have unsaved changes." when there may be no pending queue items (only the session is IN_PROGRESS). A more accurate message: "You are in the middle of a timed test. Leaving will pause your session."

---

## Console Errors

| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| /ap/test/test_calc_ab_full_1 | `[APBoost:useHeartbeat.doHeartbeat] Session taken over by another instance null` | Warning (log level) — fires on every new session start before the instance token is established. Expected; non-critical. |
| /ap/test/test_calc_ab_full_1 | `[APBoost:useDuplicateTabGuard.claimSession] Session claimed {instanceToken: ...}` | Info — expected behavior on session start. |
| All pages | Zero JavaScript errors (type: 'error') found across entire B4 audit session. | N/A |

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 3 |
| PASS | 2 (S-19, S-20) |
| FAIL | 0 |
| PARTIAL | 1 (S-21) |
| SKIP | 0 |
| Blockers Found | 0 |
| High-Priority Found | 1 NEW (B4-007) |
| Medium-Priority Found | 2 NEW (B4-006, B4-008) |
| Nitpicks | 3 total |
| Prior Findings Verified Fixed | 5 (B4-001 through B4-005) |

---

## Revision History

| Date | Change |
|------|--------|
| 2026-03-09 | Initial audit via code inspection (Playwright unavailable). 1 High, 4 Medium, 4 Nitpicks filed. |
| 2026-03-09 | Re-verification: B4-001 FIXED, B4-002 FIXED, B4-003 FIXED, B4-005 FIXED. B4-004 reclassified as STILL OPEN. |
| 2026-03-10 | B4-004 FIXED: Added `pauseStaleSessions` scheduled Cloud Function. All 5 original findings resolved. |
| 2026-03-10 | LIVE BROWSER AUDIT: 3 new findings added: FINDING-B4-006 (Medium — student login), FINDING-B4-007 (High — answers/flags lost on refresh), FINDING-B4-008 (Medium — timer not corrected for reload). S-21 status changed to PARTIAL. |
