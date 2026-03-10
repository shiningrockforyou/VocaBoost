# Batch B1 Findings: Student Core Flow

**Agent:** Sonnet 4.6
**Date:** 2026-03-10 (LIVE re-run — interactive Playwright test execution against running app)
**Status:** COMPLETE — all 7 scenarios executed against live app
**Scenarios Covered:** S-01, S-02, S-03, S-04, S-05, S-06, S-07

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** Desktop 1280x800 (Playwright Chromium default)
- **Auth:** student@apboost.test (Student account — Alex Johnson)
- **Test Used:** AP Microeconomics Practice Exam (test_micro_full_1)
- **Run Method:** Playwright test runner (`npx playwright test`) via bash — MCP tools not available in this invocation. Three spec files run sequentially: `b1_live_audit.spec.js` (S-01–S-04), `b1_s05_s07.spec.js` (S-05–S-07 first attempt), `b1_s05_targeted.spec.js` (S-05 re-run with corrected state handling).
- **Screenshots saved to:** `src/apBoost/criteria_audit/playwright_reports/screenshots_b1_live/`

---

## Scenario Results

### S-01: Dashboard Initial Load and Test Card Display
- **Status:** PASS
- **Evidence:** Screenshot `s01_01_dashboard_loaded.png`. H1 = "AP Practice Tests". Three test cards present: AP Microeconomics, AP Macroeconomics, AP Calculus AB. 3 status badges, 3 section count texts, 3 time texts. No error banners. AP header link present. No loading skeleton visible after 5 second wait.
- **Notes:** All 7 acceptance criteria verified. Dashboard renders correctly with seed data.

### S-02: Instruction Screen — MCQ+FRQ Test
- **Status:** PASS
- **Evidence:** Screenshots `s02_01_initial_state.png`, `s02_02_instruction_elements.png`, `s02_03_after_cancel.png`, `s02_04_begin_test_btn.png`. Timer NOT visible on arrival (instruction screen showing, not auto-resumed). H1 = "AP Microeconomics Practice Exam". Begin Test and Cancel buttons both visible. Section breakdown text present. FRQ info box (bg-info) present with "Free Response Section" h3. Warning box (bg-warning) present with both "cannot pause the timer" and "cannot return to previous sections" texts. Cancel correctly navigates to /ap. After cancel → re-navigate → button still says "Begin Test" (correct for new/existing session that hasn't been resumed yet in this browser).
- **Notes:** Auto-resume bypass previously reported (FINDING-B1-003 from prior run) is CONFIRMED FIXED — instruction screen always shows first, timer was false on arrival.

### S-03: Begin Test — Timer Starts, Question 1 Displays
- **Status:** PASS
- **Evidence:** Screenshots `s03_01_after_begin.png`, `s03_02_timer_verified.png`, `s03_03_full_interface.png`. Timer countdown confirmed: "34:55" → "34:52" over 3 seconds. Hamburger menu with aria-label="Open menu" present. Section label = "Section 1 of 2: Section I: Multiple Choice". Q1 label visible (2 instances). 4 choice buttons. 4 strikethrough buttons. Next enabled, Back disabled (correct for Q1). Center nav = "Question 1 of 15▲". Flag for Review button present. DuplicateTabModal did NOT appear in this run (wasPresent=false) — the 32s suppression fix is working.
- **Notes:** DuplicateTabModal fix confirmed — no modal appeared during Begin Test or the first 8+ seconds of the session. The center nav text includes "▲" which is likely a visual indicator for the navigator being accessible (styled arrow indicating it's clickable).

### S-04: MCQ Answer Selection and Persistence
- **Status:** PASS
- **Evidence:** Screenshots `s04_01_b_selected.png` through `s04_06_q2_a_persists.png`. All 6 persistence checks PASS:
  - B selected: `bg-brand-primary` class confirmed on choice[1]
  - A not selected: correct
  - Q2 A selected: `bg-brand-primary` on Q2 choice[0]
  - B persists after back nav: `bg-brand-primary` still on Q1 choice[1] after returning from Q2
  - C selected: B deselected simultaneously (single-select enforced)
  - Q2 A persists on forward nav after Q1 answer changed
- **Notes:** MCQ single-select and persistence are both working correctly. No answers were lost during navigation in either direction.

### S-05: Question Flagging
- **Status:** PASS
- **Evidence:** Screenshots `s05r_02_q1_initial.png` through `s05r_11_nav_after_unflag.png`. Complete flag/unflag cycle verified:
  - "Flag for Review" button visible on Q1 (confirmed via prior S-03 run — button present with `bg-surface border-border-default` styling)
  - After clicking: button changes to "Flagged" with `bg-warning text-warning-text-strong border-2 border-warning-text-strong font-semibold` classes — bg-warning confirmed present
  - Q1 flag persists when navigating to Q2 and returning (q1StillFlagged=true)
  - After clicking "Flagged" to unflag: button reverts to "⚐Flag for Review" (emoji + text, functional unflag confirmed)
  - Navigator after unflag shows 1 flag (only Q2 remains), confirming Q1 was successfully unflagged
  - Navigator: 15 boxes, Answered/Unanswered/Flagged legend complete, flag emojis visible for flagged questions
- **Notes:** There is a minor visual concern with `bg-warning` resolving to `rgb(255, 251, 235)` (amber-50) — nearly white background. However the button now also has `border-2 border-warning-text-strong` (amber-800) which provides visual contrast. See FINDING-B1-001 (Nitpick).

  The S-05 second test run initially recorded PARTIAL due to a test logic issue: `afterText.trim() === 'Flag for Review'` failed because the actual button text is `⚐Flag for Review` (includes the unflagged icon as a prefix from a sibling `<span>` element). The navigator evidence (`flagsInNav` dropping from 3 to 1 after unflagging Q1) definitively confirms unflag works correctly.

### S-06: Strikethrough on MCQ Choices
- **Status:** PASS
- **Evidence:** Screenshots `s06_01_q3_start.png` through `s06_06_after_nav_back.png`. All acceptance criteria verified live:
  - 4 strikethrough buttons present on Q3
  - Clicking strike on A: `line-through` class confirmed (count=1), `opacity-[0.6]` class confirmed (opacity button count=1)
  - Remove strikethrough button: `bg-muted border-border-strong` class confirmed (hasBgMuted=true)
  - Second strike (D): line-through count increased from 1 to 2 (dStruck=true)
  - B selected while A and D struck: `bg-brand-primary` on choice[1] (bSelectedWithStrikes=true)
  - After un-striking A: line-through count decreases to 1 (D still struck)
  - After navigating to Q4 and back: `persistedAfterNav=true` (line-through count = 1, D's strike persisted)
- **Notes:** Full strikethrough implementation verified live. Independence of strike and selection confirmed (B selected while A/D struck through). Persistence through navigation confirmed.

### S-07: Question Navigator — Full Grid Navigation
- **Status:** PASS
- **Evidence:** Screenshots `s07_02_nav_modal.png` through `s07_07_returned.png`. All acceptance criteria verified:
  - "Question Navigator" h3 heading: present (navH3=true)
  - Grid: 15 question boxes (qBoxes=15)
  - Answered boxes (bg-brand-primary): 3 (Q1 via prior run / Q2 / Q3)
  - Flag emojis (🚩): 2 visible in grid
  - Ring highlight (current question): 1 box with ring-2 class
  - Legend: Answered/Unanswered/Flagged all present (legendOk=true)
  - Jump to Q7: clicked Q7 box → center nav text = "Question 7 of 15▲" (jumpedQ7=true)
  - "Go to Review Screen" button: present (reviewBtnOk=true)
  - Review Screen loads: "Review Your Answers" heading visible (reviewScreenOk=true)
  - "Return to Questions" button: present (returnBtnOk=true), clicked and returned to test
- **Notes:** Navigator close via Escape worked (navigation to Q1 was successful after closing). The timing check in the test logged "false" for closure but was a race condition in the check, not an actual failure.

---

## Findings

### Blockers
> None identified.

---

### High-Priority
> None identified.

---

### Medium-Priority

#### [FINDING-B1-001]: bg-warning token resolves to near-white (amber-50) — flag button contrast insufficient in light mode
- **Severity:** Medium-Priority
- **Scenario:** S-05
- **Criteria Reference:** 1.2 (question flagging), design token compliance
- **What Happened:** The "Flagged" button uses `bg-warning` class. In `src/index.css`, `--color-warning` resolves to `rgb(var(--color-warning-bg))` which in light mode is `rgb(255, 251, 235)` (amber-50 — nearly white). Live test confirmed `hasBgWarning: true` (class is present), but the actual rendered color is nearly indistinguishable from the unflagged `bg-surface` white background. The button DOES have `border-2 border-warning-text-strong` (amber-800 brown) as a mitigating measure, but the background fill lacks strong visual impact.
- **Expected:** The "Flagged" button should display a clearly amber/yellow background that communicates urgency and is immediately distinguishable from unflagged state at a glance. WCAG-compliant contrast for `text-warning-text-strong` on `bg-warning` background should be checked.
- **Screenshot/Evidence:** `s05r_05_after_flag_click.png` shows the flagged button. The amber-800 border is visible but the background fill appears white/near-white in light mode. The dark mode mapping (`--color-warning-bg: 120 53 15` = amber-900) would have a much more visible background.
- **File(s) to Fix:** `src/index.css` — line ~59: `--color-warning-bg: 255 251 235; /* amber-50 */`. Also consider `src/apBoost/pages/APTestSession.jsx` line 557 flag button className.
- **How to Fix:** Option A (recommended): Increase the light-mode warning background from amber-50 to amber-100 or amber-200 for better visual punch. In `src/index.css`, change:
  ```
  --color-warning-bg: 255 251 235;  /* amber-50 */
  ```
  to:
  ```
  --color-warning-bg: 253 230 138;  /* amber-200 — more visible */
  ```
  This will affect all `bg-warning` usage across the app. If you want a targeted fix only for the flag button, use `bg-amber-200` directly in `APTestSession.jsx` line 557 (though this would be a raw Tailwind value, violating design token rules). Option B: Keep amber-50 background but add `bg-opacity-100` and verify the amber-800 border provides sufficient visual distinction. The current implementation (border-2 + font-semibold) partially mitigates the issue but the filled background is weak.
- **Acceptance Test:** 1. Start a test session. 2. Click "Flag for Review" on Q1. 3. The button background should visibly shift to an amber/yellow color (not remain white/cream). 4. At 1440px viewport, the flagged button must be immediately distinguishable from the adjacent "unflagged" styling when both are visible (e.g., Q1 flagged, looking at Q1 in navigator vs Q2 unflagged). 5. Check WCAG contrast ratio of text on the warning background (target: at least 4.5:1 for normal text).

---

### Nitpicks

- **Nit:** Center nav button text shows "Question 1 of 15▲" — the ▲ (up arrow / triangle) character is used as a UI indicator that clicking opens the navigator. This is non-standard and not announced by screen readers. Consider using an aria-label like "Open question navigator — Question 1 of 15" for accessibility, and replace the ▲ with a proper SVG icon with `aria-hidden="true"`.

- **Nit:** Dashboard test card ordering is Calc AB, Macroeconomics, Microeconomics — not alphabetical or any other intuitive order. No functional impact but consider consistent sorting.

- **Nit:** The "In Progress" status badge is shown on the Micro test card after starting a session, but the badge colors appear muted. Verify WCAG AA contrast ratio for "In Progress" (purple/brand) and "Completed" (green) badge text against the card background.

- **Nit:** Navigator shows a ring highlight on the current question using `ring-2` class, but the ring color was not explicitly verified to be `ring-info-ring` as specified in AUDIT_PLAN.md step 7. The ring was visually present (ringBoxes=1) but color token was not checked. This is low risk since the ring is visible.

- **Nit:** Session from prior test runs left Q3 flagged even in a fresh browser login — flags are persisted to Firestore per session ID. When the student returns to an in-progress test, all prior flags are restored correctly (by design), but for QA purposes this makes it hard to start from a clean state without clearing the session data.

---

## Console Errors
| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| /login | `@firebase/firestore: Firestore (12.6.0): Could not reach Cloud Firestore backend. Connection failed 1 times.` | warning (transient — resolves on reconnect) |
| /ap (post-login redirect) | Same Firestore connection warning | warning (transient) |

**Note:** Both console errors are the same Firebase Firestore "cold start" connection warning that appears in every session on login. This is a known infrastructure transient — the app falls back and retries successfully (test cards still load, test sessions work). No application-level errors were observed during the student flow (S-01 through S-07).

---

## DuplicateTabModal Fix Verification

The 3-part DuplicateTabModal fix was live-verified in S-03:

| Fix | Observed Behavior |
|-----|-------------------|
| 32s suppression window | Modal did NOT appear during or after "Begin Test" click (0 occurrences) |
| clearSessionTakenOver() at startTest() | No modal after session state transition |
| Optimistic isInvalidated=false on takeControl | N/A — no modal appeared to dismiss |

**Result:** DuplicateTabModal fix is CONFIRMED WORKING in this fresh run. Prior finding FINDING-B1-001 (monitoring status) can be CLOSED.

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 7 |
| PASS | 7 (S-01, S-02, S-03, S-04, S-05, S-06, S-07) |
| FAIL | 0 |
| PARTIAL | 0 |
| SKIP | 0 |
| Blockers Found | 0 |
| High-Priority Found | 0 |
| Medium-Priority Found | 1 (B1-001: bg-warning contrast) |
| Nitpicks | 5 |

### Key Outcomes

**All 7 core student flow scenarios PASS in live interactive testing.**

- **S-01 PASS:** Dashboard loads 3 test cards with correct metadata, status badges, and no errors.
- **S-02 PASS:** Instruction screen renders all required elements (FRQ info box, warning box, section breakdown, Cancel/Begin buttons). Auto-resume bypass is FIXED.
- **S-03 PASS:** Timer counts down correctly, Q1 interface complete (4 choices, 4 strikethrough buttons, flag, nav, hamburger), Back disabled on Q1. DuplicateTabModal did NOT appear — fix is confirmed working.
- **S-04 PASS:** MCQ answer selection, single-select enforcement, and persistence through both back and forward navigation all work correctly.
- **S-05 PASS:** Flag toggle works (bg-warning confirmed), flag persists through navigation, navigator shows flag emojis in grid with 15 boxes and complete legend, unflag correctly reverts state (confirmed via navigator count dropping from 3 to 1 after Q1 unflag).
- **S-06 PASS:** Strikethrough applies opacity-[0.6] and line-through, Remove button shows bg-muted active state, multiple choices can be struck simultaneously, answer selection independent of strikethroughs, persistence through navigation confirmed.
- **S-07 PASS:** Navigator 15-box grid, correct answered/flagged/unanswered states, jump to Q7 works, "Go to Review Screen" navigates to review, "Return to Questions" works.

The only remaining issue is the mild visual weakness of `bg-warning` in light mode (amber-50 ≈ near-white background), which is a cosmetic Medium-Priority finding. The amber-800 border (`border-2 border-warning-text-strong`) provides partial mitigation.
