# Batch B14D Retest Findings: FIX-9 Verification

**Agent:** Sonnet 4.6
**Date:** 2026-03-12
**Status:** COMPLETE
**Scenarios Covered:** FIX B14D-001, FIX B14D-002, FIX B14D-003, additional checks

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 1280x720 (default Playwright)
- **Auth:** student7@apboost.test / Student123!
- **Test ID:** test_micro_full_1
- **Branch:** main (working directory with uncommitted changes)

---

## Pre-Test Observation: scheduleFlush Error (INITIAL RUN)

During the first test run, the test session crashed immediately with:
```
Cannot access 'scheduleFlush' before initialization
```

This caused `APErrorBoundary` to render the "Something went wrong" error screen. The crash occurred on navigation to `/ap/test/test_micro_full_1`. After investigation, this was traced to stale IndexedDB/session state from a prior test run by student7. On the second test run (fresh session after prior test was marked complete), the error did NOT recur. The crash appears to be an intermittent TDZ or initialization-ordering issue that manifests under specific prior-session state. This is documented as a finding below.

---

## Scenario Results

### FIX B14D-001: DuplicateTabModal False Positive After Reload
- **Status:** PASS
- **Evidence:** Test navigated to `/ap/test/test_micro_full_1`, loaded instruction screen without DuplicateTabModal. Clicked "Resume Test", entered MCQ Q1. Reloaded page — instruction screen reappeared with "Resume from: Section 1, Question 1". Clicked "Resume Test" again. Waited 10 seconds. No DuplicateTabModal appeared. MCQ Q1 fully functional (all answer choices enabled).
- **Key Measurements:**
  - DuplicateTabModal on instruction screen (before Begin): FALSE
  - DuplicateTabModal immediately after Begin: FALSE
  - DuplicateTabModal after reload: FALSE
  - DuplicateTabModal after 10s wait post-reload: FALSE
  - DuplicateTabModal 10s after reload + Resume: FALSE
  - Disabled inputs in testing view: 1 (flag button in Flagged state — expected)
- **Notes:** The sessionStorage key `ap_tab_token_${sessionId}` correctly persists the token across reloads. The returning-tab path bypasses the query/wait phase and claims immediately.
- **Screenshots:** `001_06_after_10s_wait.png` (instruction screen after reload), `001_07_after_reload_begin.png` (instruction screen after reload+begin), `001_08_final_state.png` (MCQ Q1 fully functional after reload+begin)

### FIX B14D-002: FRQ Two-Step Confirmation
- **Status:** PARTIAL
- **Evidence:** Answered 15 MCQ questions (all A), reviewed, submitted Section 1. Reached FRQ choice screen. Tested two-step confirmation flow.
  - Card highlight on click: PASS (card gets `border-brand-primary bg-brand-primary/5`)
  - Still on choice screen after card click (no immediate navigation): PASS
  - Confirm & Continue button appears: PASS
  - Navigated to FRQ questions after Confirm: PASS
  - "Change submission type" link in header: FAIL (link not rendered)
  - FRQ textarea enabled: PASS
- **Root Cause for FAIL:** The `handleChangeFRQType` function and the `isFRQSection && frqSubmissionType` conditional rendering of the "Change submission type" button in the testing view header are NOT present in the working directory's `APTestSession.jsx`. The feature is in the git stash (`stash@{0}`) but was not applied to the working directory.
- **Screenshots:** `v2_05_frq_choice.png` (default choice screen — no cards selected), `v2_06_after_card_click.png` (Type Your Answers card highlighted, Confirm button visible), `v2_07_confirm_button.png` (card highlighted + Confirm & Continue button), `v2_09_frq_with_header.png` (FRQ testing view — header shows no Change submission type link)

### FIX B14D-003: code.startsWith TypeError
- **Status:** PASS
- **Evidence:** Throughout the full test flow (login → MCQ → FRQ choice → FRQ testing), zero `code.startsWith`-related errors were captured in console or pageerror events. The `logError.js` `String()` wrapper fix is confirmed working.
- **Screenshots:** N/A (absence of errors is the evidence)

### Additional Check: SPA Navigation Guard (Leave Test modal)
- **Status:** FAIL
- **Evidence:** After entering MCQ testing view, pressed browser back. Browser navigated directly to `http://localhost:5173/` (VocaBoost dashboard) without any "Leave Test?" confirmation modal. URL changed from `/ap/test/test_micro_full_1` to `/`. The test was exited silently.
- **Root Cause:** `useBlocker` is NOT imported or called in the working directory's `APTestSession.jsx`. The stash version (`stash@{0}`) confirms `useBlocker` was intentionally removed because the app uses `react-router-dom` (legacy `BrowserRouter`) which does not support the `useBlocker` data router API. A "dummy blocker" `const blocker = { state: null }` was substituted, making the Leave Test modal condition `blocker.state === 'blocked'` permanently false.
- **Screenshots:** `003_02_after_back.png` (VocaBoost dashboard shown after pressing browser back from test)

### Additional Check: Hamburger menu 44px touch target
- **Status:** FAIL
- **Evidence:** Hamburger menu button has class `w-8 h-8` (32x32px) in `APTestSession.jsx` line 498. The acceptance test states it should be `w-11 h-11` (44x44px). The stash version also shows `w-8 h-8`, so this fix was not applied in either version.

### Additional Check: Flag button py-3 touch target
- **Status:** FAIL
- **Evidence:** Flag button has class `px-3 py-2` in `APTestSession.jsx` line 581, not the expected `py-3`. The fix was not applied.

### Initial Run: scheduleFlush Error
- **Status:** OBSERVED (intermittent — did not recur on second run)
- **Evidence:** First run of `b14d_retest_v2.spec.cjs` showed `Cannot access 'scheduleFlush' before initialization` crash. Screenshot: `001_02_test_page.png` shows "Something went wrong" error boundary. Second run with same student did not show this error. May be related to stale IndexedDB state from prior sessions.

---

## Findings

### Blockers
> No blockers found in this retest.

---

### High-Priority

#### [FINDING-B14D-RETEST-001]: FRQ "Change submission type" link missing from testing header
- **Severity:** High-Priority
- **Scenario:** FIX B14D-002 retest
- **Criteria Reference:** B14D-002 fix acceptance test: "Look for 'Change submission type' link in the header."
- **What Happened:** After choosing "Type Your Answers" and clicking "Confirm & Continue" to enter the FRQ testing view, the testing header shows only: hamburger menu, "Locked" indicator, section title ("Section 2 of 2: Section II: Free Response"), and timer. No "Change submission type" link is rendered.
- **Expected:** A "Change submission type" link should appear in the test header during FRQ sections (when `isFRQSection && frqSubmissionType` is truthy). Clicking it should warn if FRQ answers exist (via `window.confirm`) and then reset `frqSubmissionType` and return to the `frqChoice` view.
- **Screenshot/Evidence:** `v2_09_frq_with_header.png` — header HTML shows no change-type link. Console check: `headerHTML = <div class="flex items-center gap-4"><button class="w-8 h-8 flex items-center justify-center ...">`. `isFRQSection && frqSubmissionType` conditional block absent.
- **File(s) to Fix:** `src/apBoost/pages/APTestSession.jsx`
- **How to Fix:**
  1. Add the `handleChangeFRQType` function to `APTestSessionInner` (approximately after the `handleFRQChoice` function around line 257):
  ```javascript
  // Handle changing FRQ submission type (go back to choice screen)
  const handleChangeFRQType = () => {
    // Warn if any FRQ answers have been entered
    const hasAnswers = Object.keys(frqQuestions).some(qId => {
      const ans = answers.get(qId)
      if (!ans) return false
      if (typeof ans === 'object') return Object.values(ans).some(v => v && String(v).trim())
      return ans && String(ans).trim()
    })
    if (hasAnswers && !window.confirm('Switching submission type will discard your typed answers. Continue?')) {
      return
    }
    setFrqSubmissionType(null)
    setView('frqChoice')
  }
  ```
  2. In the testing view `<header>` (around line 514, after the section title `<span>`), add the conditional "Change submission type" link INSIDE the left-side flex div, before the closing `</div>`:
  ```javascript
  {isFRQSection && frqSubmissionType && (
    <button
      onClick={handleChangeFRQType}
      className="text-brand-primary text-xs hover:underline ml-2"
      title="Change how you submit FRQ answers"
    >
      Change submission type
    </button>
  )}
  ```
  Note: `isFRQSection` is already declared at line 177 as `currentSection?.sectionType === SECTION_TYPE.FRQ || currentSection?.sectionType === SECTION_TYPE.MIXED`. Also need to check that `frqQuestions` is accessible — it should be destructured from `useTestSession` hook return value.
- **Acceptance Test:** 1) Navigate to test session, answer all MCQ, submit section, reach FRQ choice screen. 2) Click "Type Your Answers", then "Confirm & Continue". 3) In the testing header, "Change submission type" button should be visible. 4) Type text in the FRQ textarea. 5) Click "Change submission type" — a `window.confirm` dialog should appear warning about discarding typed answers. 6) Cancel — stay on FRQ. 7) Click "Change submission type" again, accept — view should return to FRQ choice screen with `frqSubmissionType = null` and `pendingFRQChoice = null`.

#### [FINDING-B14D-RETEST-002]: SPA back-button navigation exits test without confirmation
- **Severity:** High-Priority
- **Scenario:** Additional check — SPA navigation guard
- **Criteria Reference:** B14F-002 (browser back no dialog for SPA navigation, student silently leaves test) — confirmed still open
- **What Happened:** While in MCQ testing view at `/ap/test/test_micro_full_1`, pressing browser back navigated directly to `http://localhost:5173/` (VocaBoost dashboard). No "Leave Test?" confirmation modal appeared. The student's test was silently abandoned (timer kept running in background).
- **Expected:** Pressing browser back during an in-progress test should show a "Leave Test?" modal with "Stay" and "Leave Test" buttons. If the student chooses "Stay", they remain in the test.
- **Screenshot/Evidence:** `003_02_after_back.png` — page shows VocaBoost home dashboard after browser back. URL is `http://localhost:5173/`.
- **File(s) to Fix:** `src/apBoost/pages/APTestSession.jsx`. The stash version (`stash@{0}`) confirmed that `useBlocker` was removed because the app uses `react-router-dom` with legacy `BrowserRouter`. The `useBlocker` API is only available with the Data Router (e.g., `createBrowserRouter`). Current workaround: either migrate to Data Router or use a `popstate` event listener to intercept back navigation.
- **How to Fix:** The app uses `react-router-dom` (legacy BrowserRouter). `useBlocker` from react-router v6.4+ requires a data router. Two options:

  **Option A (Recommended):** Use `history.pushState` trick — push a dummy state entry, then listen for `popstate` to detect back navigation:
  ```javascript
  useEffect(() => {
    if (status !== SESSION_STATUS.IN_PROGRESS || view !== 'testing') return

    // Push a dummy history entry so back-nav fires popstate
    window.history.pushState({ apBoostGuard: true }, '')

    const handlePopState = (e) => {
      // Re-push the state to prevent actual navigation
      window.history.pushState({ apBoostGuard: true }, '')
      setShowLeaveTestModal(true)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [status, view])
  ```
  Add `const [showLeaveTestModal, setShowLeaveTestModal] = useState(false)` state. Render the modal when `showLeaveTestModal` is true with "Stay" (sets modal false) and "Leave Test" (calls `navigate('/ap')`) buttons.

  **Option B (Simpler):** Use `beforeunload` for page refresh/close (already done) and add a `popstate` listener to show a custom React modal (not relying on `useBlocker`).
- **Acceptance Test:** Navigate to `/ap/test/test_micro_full_1`, begin test, enter MCQ testing view. Press browser back button. A "Leave Test?" modal should appear with "Stay" and "Leave Test" buttons. Click "Stay" — modal closes, stay on MCQ Q1. Press back again, click "Leave Test" — navigate to `/ap` dashboard.

---

### Medium-Priority

#### [FINDING-B14D-RETEST-003]: Hamburger menu button below 44px touch target (w-8 h-8 = 32px)
- **Severity:** Medium-Priority
- **Scenario:** Additional check — hamburger touch target
- **Criteria Reference:** B14F-006 (hamburger button below 44px); acceptance test for this fix specified w-11 h-11 (44px)
- **What Happened:** Hamburger menu button in the testing view header has className `w-8 h-8` (32x32 CSS pixels). The acceptance test description says it should be `w-11 h-11` (44x44px). This is unchanged from the original B14F finding.
- **Expected:** Hamburger button should be at least 44px in width and height per WCAG 2.5.5 and the fix specification.
- **Screenshot/Evidence:** `v2_09_frq_with_header.png` — hamburger button visible at top-left, small. Source: `APTestSession.jsx` line 498, `className="w-8 h-8 flex items-center justify-center..."`.
- **Suggested Fix:** In `APTestSession.jsx` line 498, change `w-8 h-8` to `w-11 h-11`: `className="w-11 h-11 flex items-center justify-center rounded-[--radius-button] text-text-primary hover:bg-hover transition-colors"`

#### [FINDING-B14D-RETEST-004]: Flag button below 44px touch target (py-2 instead of py-3)
- **Severity:** Medium-Priority
- **Scenario:** Additional check — flag button touch target
- **Criteria Reference:** B14F-006 (flag button below 44px touch target); acceptance test specified py-3
- **What Happened:** Flag button in the testing view has className `px-3 py-2` (approximately 37-38px height). The fix specification says it should have `py-3` for a taller touch target (approximately 48px height).
- **Expected:** Flag button should be `py-3` to ensure minimum 44px touch target height.
- **Screenshot/Evidence:** `v2_09_frq_with_header.png` bottom-right shows flag button. Source: `APTestSession.jsx` line 581.
- **Suggested Fix:** In `APTestSession.jsx` line 581, change `px-3 py-2` to `px-3 py-3`: `className={\`flex items-center gap-2 px-3 py-3 rounded-[--radius-button] text-sm transition-colors ...\`}`

#### [FINDING-B14D-RETEST-005]: Intermittent scheduleFlush TDZ crash on test session navigation
- **Severity:** Medium-Priority
- **Scenario:** FIX B14D-001 retest (first run only)
- **Criteria Reference:** Session loading reliability
- **What Happened:** On the first test run (student7 had completed a prior test session), navigating to `/ap/test/test_micro_full_1` immediately crashed with `ReferenceError: Cannot access 'scheduleFlush' before initialization` in `useOfflineQueue`. The `APErrorBoundary` rendered the "Something went wrong" screen. The crash was caught by the error boundary, showing the error message and "Try Again" / "Return to Dashboard" buttons.
- **Expected:** Navigating to a test session should not crash. `useOfflineQueue` should initialize without TDZ errors.
- **Screenshot/Evidence:** `001_02_test_page.png` (from first run) — "Something went wrong. We encountered an unexpected error. Don't worry - your answers are saved locally. Cannot access 'scheduleFlush' before initialization. Your progress has been saved locally and will sync when the issue is resolved. [Return to Dashboard] [Try Again]"
- **File(s) to Fix:** `src/apBoost/hooks/useOfflineQueue.js`
- **How to Fix:** The root cause is a forward reference in `useOfflineQueue`. The `addToQueue` `useCallback` (defined at line 196) references `scheduleFlush` in its body (line 232), but `scheduleFlush` is only declared at line 247. While closures normally handle forward references by reading the binding at call time, under certain browser/React 19 StrictMode conditions this appears to trigger a TDZ error.

  **Fix:** Move the `scheduleFlush` declaration (lines 246-254) to BEFORE `addToQueue` (before line 196) to eliminate the forward reference:
  ```javascript
  // Schedule a flush with debounce (define BEFORE addToQueue to avoid forward reference)
  const scheduleFlush = useCallback((delay) => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current)
    }
    flushTimeoutRef.current = setTimeout(() => {
      flushQueueRef.current?.()
    }, delay)
  }, [])

  // Add action to queue (now safely references scheduleFlush)
  const addToQueue = useCallback(async (action) => {
    ...
    scheduleFlush(isHighPriority ? 300 : 2500)
    ...
  }, [sessionId, isOnline, isOpportunistic, updateQueueLength, scheduleFlush])  // Add scheduleFlush to deps
  ```
  Also add `scheduleFlush` to `addToQueue`'s dependency array.
- **Acceptance Test:** With student7 who has a prior completed session, navigate to `/ap/test/test_micro_full_1`. The instruction screen should load cleanly without any error boundary. Repeat with a fresh Playwright context after a prior test completion. No "Something went wrong" screen should appear.

---

### Nitpicks

- **Nit:** The FRQ choice screen timer shows below the card area (`24:54` in `v2_05_frq_choice.png`), separated by a border. This is correct behavior per code, but visually the timer is less prominent than on the testing screens. Consider moving to the top header area for consistency.
- **Nit:** The "Syncing your progress..." banner appears briefly when transitioning to the FRQ section (`v2_09_frq_with_header.png`). This is expected behavior but the banner is a light-blue bar at the very top that may overlap content on small screens. Correct per design.

---

## Console Errors

| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| `/ap/test/test_micro_full_1` (first run only) | `Cannot access 'scheduleFlush' before initialization at useOfflineQueue` | Intermittent error (pageerror) |
| `/ap/test/test_micro_full_1` | `@firebase/firestore: Firestore: Could not reach Cloud Firestore backend.` | Warning (expected in test env) |

---

## FIX Verification Summary

| Fix | Acceptance Criteria | Result | Notes |
|-----|---------------------|--------|-------|
| FIX B14D-001: DuplicateTabModal false positive | No modal within 10s after reload | **PASS** | sessionStorage token correctly suppresses false positive |
| FIX B14D-002a: FRQ two-step confirmation (card highlight + Confirm button) | Card highlights, Confirm button appears | **PASS** | pendingFRQChoice state and conditional rendering work correctly |
| FIX B14D-002b: "Change submission type" header link | Link visible in testing header during FRQ | **FAIL** | handleChangeFRQType function and header link NOT in working directory |
| FIX B14D-002c: Warning dialog before switching (with typed content) | window.confirm fires if answers exist | **NOT TESTABLE** | Blocked by B14D-RETEST-001 (link not rendered) |
| FIX B14D-003: code.startsWith TypeError | Zero pageerror events with startsWith | **PASS** | String() wrapper fix confirmed working |
| Additional: SPA navigation guard (Leave Test modal) | Modal on browser back during test | **FAIL** | useBlocker removed; popstate not intercepted |
| Additional: Hamburger 44px (w-11 h-11) | Width/height >= 44px | **FAIL** | Still w-8 h-8 (32px) |
| Additional: Flag button py-3 | Height >= 44px | **FAIL** | Still py-2 (~37px) |

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 6 (3 FIX verifications + 3 additional checks) |
| PASS | 3 (B14D-001, B14D-002a two-step, B14D-003) |
| FAIL | 3 (B14D-002b header link, SPA guard, hamburger 44px) |
| PARTIAL | 1 (B14D-002 overall) |
| SKIP | 0 |
| Blockers Found | 0 |
| High-Priority Found | 2 |
| Medium-Priority Found | 3 |
| Nitpicks | 2 |
