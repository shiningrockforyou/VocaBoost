# Batch B14-D Findings: The Confused One — Realistic Simulation

**Agent:** Sonnet 4.6
**Date:** 2026-03-10
**Status:** COMPLETE
**Scenario:** B14-D (Realistic Simulation — The Confused One)
**Account:** student7@apboost.test / Student123!
**Test Target:** test_micro_full_1 (AP Microeconomics, 15 MCQ + 2 FRQ)

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 1440x900
- **Auth:** student7@apboost.test
- **Test runs:** 7 automated Playwright script iterations (b14d_test.cjs v1-v7)
- **Result URL:** http://localhost:5173/ap/results/A3ckAxH2OCP2MQhUqZmY9Cm6kzv1_test_micro_full_1_1

---

## Scenario Results

### B14-D: The Confused One
- **Status:** PARTIAL
- **Overall narrative:** Login succeeds (with B4-006 redirect to `/` not `/ap`). Resume Test works — existing session resumed, MCQ Q1-Q15 navigated and answered (9/15 answered in final successful run; prior test runs pre-filled some answers). FRQ section reached — the "FRQ choice" screen in this app is the submission TYPE choice (Typed vs. Handwritten), NOT a question topic selector. The confused user behavior was exercised: clicked "Type Your Answers", read for 5 seconds, found no enabled back button. FRQ answer typed (300 chars), half deleted, retyped to 213 chars ending with incomplete sentence "I think the answer involves". Answer persists after 1 second. Navigated through 7 FRQ sub-questions (filling empty ones with stub text). Submitted test. Report card reached showing FRQ as "Pending" and MCQ score. DuplicateTabModal appeared mid-session (FRQ question screen) during earlier test run iterations due to session token conflicts from multiple automated runs.

---

## Findings

### Blockers

*(None — core test submission pipeline works. Confused user can complete and submit a test.)*

---

### High-Priority

#### [FINDING-B14D-001]: DuplicateTabModal appears on FRQ question screen — disables all FRQ inputs

- **Severity:** High-Priority
- **Scenario:** B14-D (Step 5 — FRQ section after selecting "Type Your Answers")
- **Criteria Reference:** B14-D acceptance criteria: "Can navigate FRQ choice screen without getting stuck." Also B6-001 (existing finding about duplicate tab modal on wrong tab).
- **What Happened:** After clicking "Type Your Answers" and landing on the FRQ question screen, the `DuplicateTabModal` ("Session Active Elsewhere") appeared, disabling the FRQ textarea (`disabled` attribute, `bg-muted cursor-not-allowed opacity-60` classes applied) and all answer buttons. The Back and Flag buttons were also disabled. Only "Go to Dashboard" and "Use This Tab" remained enabled. This occurred because prior test-run sessions had claimed the session token via BroadcastChannel, and the new session attempt conflicted.
- **Expected:** The FRQ question screen should be fully interactive after the user selects their FRQ type. DuplicateTabModal should only appear when there are actually two live tabs with the test open simultaneously, not due to stale session tokens from prior browser sessions.
- **Screenshot/Evidence:** v6 run console log shows: `"Buttons after type click: [{idx:0,text:'',disabled:false},{idx:1,text:'⚐Flag for Review',disabled:true},{idx:2,text:'← Back',disabled:true},{idx:3,text:'Question 1 of 7▲',disabled:false},{idx:4,text:'Next →',disabled:false}]"` — textarea disabled, flag/back disabled. The DuplicateTabModal is the root cause.
- **File(s) to Fix:**
  - `src/apBoost/hooks/useDuplicateTabGuard.js`
  - `src/apBoost/hooks/useHeartbeat.js`
- **How to Fix:** The BroadcastChannel session detection is too aggressive when a prior browser session claimed the token. Two specific fixes:
  1. In `useDuplicateTabGuard.js` `useEffect` (line 80-152): After the 1-second claim timeout fires (line 124), before calling `claimSession()`, check if the `channelRef.current` is still open and the session is still valid. The current implementation broadcasts `SESSION_CLAIMED` which triggers any lingering same-tab listeners from prior runs. Consider adding a `sessionStorage`-based "current session" marker so that page reloads within the same tab always get priority without needing BroadcastChannel confirmation.
  2. In `src/apBoost/pages/APTestSession.jsx` `handleTakeControl` (line 263-265): After calling `takeControl()`, explicitly re-enable any disabled UI elements by ensuring `isInvalidated` resets to `false`. The `takeControl()` function in `useDuplicateTabGuard.js` already calls `setIsInvalidated(false)` (line 61), but verify that `isSessionInvalidated` (computed from `isInvalidated || sessionTakenOver`) also resets — `sessionTakenOver` in `useHeartbeat.js` may not clear. Call `clearSessionTakenOver()` from `handleTakeControl` as well.
- **Acceptance Test:** Navigate to a test session URL, then immediately reload the page. After reload, click Resume Test. The FRQ section should have a fully enabled textarea and all buttons enabled — no DuplicateTabModal should appear within 10 seconds of starting.

---

### Medium-Priority

#### [FINDING-B14D-002]: FRQ submission type selection is immediately final — no way to change from Typed to Handwritten after clicking

- **Severity:** Medium-Priority
- **Scenario:** B14-D (Step 5 — FRQ Choice: Confused user clicks Type, reads 5s, tries to go back)
- **Criteria Reference:** B14-D acceptance criteria: "FRQ topic selection works. Can navigate FRQ choice screen without getting stuck."
- **What Happened:** After clicking "Type Your Answers" on the FRQ choice screen, the app immediately called `handleFRQChoice(FRQ_SUBMISSION_TYPE.TYPED)` which: (1) set `frqSubmissionType = 'typed'`, (2) called `goToFlatIndex(0)`, (3) set `view = 'testing'`. The user was immediately taken to the FRQ question screen (Question 1 of 7). The Back button (`← Back`) was present but **disabled** (grayed out, `cursor-not-allowed`) because it represents the previous FRQ sub-question, and there is no preceding sub-question. There is no "Change Submission Type" button anywhere on the FRQ question screen. A confused student who clicks the wrong submission type (e.g., Typed when they intended Handwritten) has no way to correct this without navigating away from the test and losing their place.
- **Expected:** The FRQ choice screen should either: (a) keep both cards visible and allow clicking either to preview the mode without committing, requiring an explicit "Start [Type/Handwrite]" confirmation button, OR (b) show a "Change submission type" link on the FRQ question/handwritten screens so users can switch before they start answering.
- **Screenshot/Evidence:** Screenshot `10_frq_type_after_5s.png` shows the FRQ question screen with disabled Back button and no change-type button. Console log: `"Buttons after type click: [{idx:2, text:'← Back', disabled:true}]"`. No enabled back/cancel/change button found.
- **File(s) to Fix:** `src/apBoost/pages/APTestSession.jsx`
- **How to Fix:** In the `frqChoice` view render block (lines 316-369), the current implementation immediately navigates away on click via `handleFRQChoice`. Two options:

  Option A (Two-step confirmation — recommended): Add a `selectedFrqType` local state. On first card click, set `selectedFrqType` but do not call `handleFRQChoice`. Show a confirmation button: "Start [Type/Handwriting]". On confirmation, call `handleFRQChoice(selectedFrqType)`. This matches the UX pattern of most online testing platforms.

  Option B (Change button on FRQ question screen): In the FRQ question view portion of the `testing` case (in the main render), add a small "Change submission type" link that sets `frqSubmissionType = null` and `setView('frqChoice')`. Ensure calling `goToFlatIndex(0)` resets position when re-entering. The `frqSubmissionType` setter is already available. Add: `<button onClick={() => { setFrqSubmissionType(null); setView('frqChoice') }}>Change submission type</button>` in the FRQ section toolbar.

  Option A is preferred as it prevents accidental clicks. Option B is simpler to implement.
- **Acceptance Test:** Navigate to the FRQ choice screen. Click "Write by Hand". Read for 5 seconds. A back/cancel button or change-type option should be available. Click it. The FRQ choice screen should re-appear. Click "Type Your Answers". Test should proceed to the FRQ question screen.

---

#### [FINDING-B14D-003]: `code.startsWith is not a function` — recurring uncaught TypeError on test page

- **Severity:** Medium-Priority
- **Scenario:** B14-D (observed on every test page navigation)
- **Criteria Reference:** Cross-cutting quality — no uncaught JavaScript errors during normal test operation.
- **What Happened:** Two `pageerror` events fired: `code.startsWith is not a function`. This error occurs in `src/apBoost/utils/logError.js` line 16 when `error.code` is a non-string value (number or object) from a Firestore error during session operations.
- **Expected:** No uncaught JavaScript errors during normal test page navigation and session resume.
- **Screenshot/Evidence:** `results.consoleErrors` array shows 2 entries with type `pageerror` and text `code.startsWith is not a function`. Already documented in B14G-003.
- **File(s) to Fix:** `src/apBoost/utils/logError.js`
- **How to Fix:** On line 16 of `logError.js`, change: `if (code.startsWith('auth/') || message.includes('auth')) return 'auth'` to `if (String(code).startsWith('auth/') || message.includes('auth')) return 'auth'`. This is already documented as B14G-003 with the same fix. This finding confirms the issue persists.
- **Acceptance Test:** Navigate to `/ap/test/test_micro_full_1`, click Resume Test, proceed through MCQ. Zero `pageerror` events in console containing `code.startsWith`.

---

### Nitpicks

- **Nit:** The FRQ choice screen ("Type Your Answers" / "Write by Hand") shows the timer running (`⏱ 24:52`) but the section hasn't started yet from the student's perspective. A confused student may feel time pressure before they've even made a choice. Consider pausing the FRQ section timer while the choice screen is displayed, or showing a note that "The timer starts after you make your selection."

- **Nit:** The FRQ choice screen title is "Free Response Section" — the word "Section" could be confused with the MCQ "Section 1" wording. Consider "Free Response: Choose Format" or "How would you like to answer?" for clarity.

- **Nit:** The `← Back` button on Question 1 of the FRQ section appears disabled (grayed out) with no tooltip explaining why. A confused user may try clicking it multiple times thinking it will let them go back to the choice screen. Add a `title` attribute: `title="You cannot go back to a previous section"` to clarify why the button is disabled.

---

## Console Errors

| Page/Route | Error Message | Severity | When |
|------------|---------------|----------|------|
| /ap/test/test_micro_full_1 | `code.startsWith is not a function` | pageerror | Session load (×2) |

---

## Key Behavioral Observations

### What Worked
1. **Login + Resume**: student7 authentication succeeds. Prior session detected and "Resume Test" presented. Clicking Resume correctly resumes from Section 1, Q1.
2. **MCQ Answering**: Answer buttons clickable and functional. "Next →" navigates forward. "Review →" on Q15 leads to review screen.
3. **MCQ Review + Submit Section**: Review screen appears correctly. "Submit Section" button present. Confirmation modal works. MCQ section submitted successfully.
4. **FRQ Section Entry**: After MCQ submit, FRQ type choice screen appears correctly with two large card buttons.
5. **FRQ Type Selection**: Clicking "Type Your Answers" transitions immediately to FRQ question screen (view changes from `frqChoice` to `testing`).
6. **FRQ Typing**: Textarea is enabled and functional. Initial text (300 chars) typed, second half deleted, retyped. Answer persisted 1 second after final keystroke.
7. **Partial Answer Submission**: FRQ submitted with incomplete sentence ("I think the answer involves"). Report card reached.
8. **Report Card**: Correctly shows FRQ as "Pending" (`⏳ Free Response section is awaiting teacher grading`). MCQ score displayed (2/15 = 13% in final run — reflects prior session answers). No data corruption observed.
9. **Zero errors during submission**: No console errors during the final successful submission run.

### What Did Not Work
1. **FRQ type selection irreversibility** (B14D-002): No back button after selecting submission type.
2. **DuplicateTabModal mid-session** (B14D-001): Session token conflicts from multiple automated test runs triggered the modal on the FRQ question screen, temporarily disabling all inputs.
3. **Login redirect** (B4-006, known): student7 redirects to `/` not `/ap` after login.

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 1 (B14-D) |
| PASS | 0 (core submit pipeline works but confusion flow has gaps) |
| PARTIAL | 1 |
| FAIL | 0 |
| SKIP | 0 |
| Blockers Found | 0 |
| High-Priority Found | 1 (B14D-001 DuplicateTabModal disabling FRQ inputs) |
| Medium-Priority Found | 2 (B14D-002 FRQ type lock; B14D-003 code.startsWith known) |
| Nitpicks | 3 |

**Verification evidence:** Result URL `A3ckAxH2OCP2MQhUqZmY9Cm6kzv1_test_micro_full_1_1` reached. Report card shows `⏳ Free Response section is awaiting teacher grading`. MCQ score present. No data loss. Test is submittable with partial/incomplete FRQ answers.

---

## Questions from Consolidated Fix Review (2026-03-11)

> These questions are from the lead developer reviewing all B14 findings. Please answer in a follow-up section below.

**Q1 (re: FIX-9 / B14D-002):** The proposed fix adds a "Change submission type" link on the FRQ question screen. Should we only allow changing submission type BEFORE the student starts typing/uploading? Once they've entered text in a FRQ textarea, switching to "Write by Hand" would lose that text. Two options: (a) warn "Switching will discard your typed answers" with confirm, or (b) disable the change link once any FRQ answer is non-empty. Which approach fits the confused-student persona better?

**Q2:** Is there an existing "Back to previous section" concept in the app's section model, or is section progression strictly one-way? If sections are one-way by design, the FRQ type change would need to be an exception (reset within the current section) rather than a navigation back.

---

## Responses (2026-03-11)

**A1 (re: FIX-9 / B14D-002):** We implemented **both Option A and Option B together**. The FRQ choice screen now has a two-step confirmation (select card to highlight it, then click "Confirm & Continue") to prevent accidental clicks. Additionally, a "Change submission type" link appears in the test header during FRQ sections. For the typed-answers-loss concern: **option (a) — warn with confirm** fits the confused-student persona better. A confused student is likely to click things accidentally, so a discard warning is safer than silently disabling the link (which they might not understand). However, the current implementation does NOT yet have a discard warning — it resets `frqSubmissionType` to null and returns to the choice screen unconditionally. A follow-up enhancement could add `window.confirm("Switching will discard your typed answers. Continue?")` in `handleChangeFRQType` if any FRQ answer is non-empty.

**A2:** Section progression is **strictly one-way** by design — once MCQ is submitted, you cannot go back. The FRQ type change is indeed an **exception within the current section**, not a section-level back navigation. The implementation handles this correctly: `handleChangeFRQType` resets `frqSubmissionType` to null and sets `view` back to `frqChoice`, which is a view state within the FRQ section — not a section transition. The section index does not change. This is consistent with the section model since the student never leaves the FRQ section.
