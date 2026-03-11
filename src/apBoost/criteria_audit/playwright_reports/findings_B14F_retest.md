# Batch B14F Retest Findings

**Agent:** Sonnet 4.6
**Date:** 2026-03-12
**Status:** COMPLETE
**Fixes Retested:** FIX-12 (B14F-001), FIX-13 (B14F-002), FIX-14 (B14F-003/004/005/006), FIX-15 (B14F-007)

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 375x667 (mobile), 375x350 (keyboard simulation for FRQ test)
- **Auth:** student9@apboost.test (Student123!)
- **Screenshots:** screenshots_B14F_retest/
- **Test scripts:** b14f_retest_v3.cjs (primary), b14f_retest_v5_frq.cjs (FIX-12 targeted), b14f_retest_v3_results.json (measurements)
- **Note on login redirect:** Student login redirects to `/` (VocaBoost dashboard) not `/ap`. Known B4-006. The AP test URL (`/ap/test/test_micro_full_1`) still loads correctly by direct navigation.

---

## Retest Results Summary

| Fix | Original Finding | Retest Result | Status |
|-----|-----------------|---------------|--------|
| FIX-12 | B14F-001: FRQ textarea hidden at 375x350 | scrollIntoView code NOT in source; NOT implemented | FAIL |
| FIX-13 | B14F-002: Browser back navigates silently | useBlocker NOT in source; back still navigates silently to `/` | FAIL |
| FIX-14 | B14F-003/004/005/006: Touch targets below 44px | All 10 measured targets still below 44px minimum; py-2/w-10/h-10 unchanged | FAIL |
| FIX-15 | B14F-007: IDBDatabase closing errors | mountedRef guard + error code 11 suppression IS implemented; 0 IDB errors in live run | PASS |

---

## Detailed Retest Evidence

### FIX-15 (B14F-007): IDB Errors — PASS

**Status: PASS — Fix implemented and verified.**

Source analysis: `src/apBoost/hooks/useOfflineQueue.js` lines 63-65 and 141, 163-165 confirm:
- `mountedRef = useRef(true)` declared at line 63
- Cleanup `() => { mountedRef.current = false }` at line 65
- Guard `if (!mountedRef.current || !dbRef.current || !sessionId) return []` at line 141 in `getPendingItems`
- Catch block at lines 163-165: `if (!mountedRef.current || error?.code === 11 || error?.message?.includes('closing')) { return [] }`

Live test: 0 IDB errors recorded across all test runs (v3 and v5). The `getPendingItems` function gracefully suppresses closing errors.

**Note on early v1 TDZ crash:** The v1 run (b14f_retest.cjs) captured 6 console errors with "ReferenceError: Cannot access 'scheduleFlush' before initialization" — these originated from a stale Vite browser cache serving the committed version of `useOfflineQueue.js` from git HEAD (which had `}, [scheduleFlush])` in the online handler dependency array). The working tree has `}, []` with an eslint-disable comment. By the v3 run, Vite had served the updated file and the TDZ error was gone. The fix as committed in the working tree (staged) is correct.

Screenshot evidence: `v3_11_after_nav_back.png` — no error messages, page loads instruction screen normally.

---

### FIX-13 (B14F-002): Browser Back Blocker — FAIL

**Status: FAIL — Fix not implemented.**

Source analysis: `src/apBoost/pages/APTestSession.jsx` contains NO reference to `useBlocker`. The file imports are confirmed (lines 1-21 read in full) and `useBlocker` is absent. `import { useBlocker } from 'react-router'` is not present.

Live test measurements from `b14f_retest_v3_results.json`:
- `urlAfterBack: "http://localhost:5173/"` — navigated to VocaBoost dashboard root (not even `/ap`)
- `hasLeaveTest: false`, `hasStayBtn: false`, `hasLeaveBtn: false`, `hasFixedOverlay: false`
- `silentNavigation: true`
- Body after back showed VocaBoost main dashboard: "Welcome, Isaac Nguyen / Your personalized vocabulary journey starts here"

Screenshot `v3_05_after_back.png` confirms: VocaBoost dashboard appears immediately after `page.goBack()`, no confirmation dialog or modal.

The `beforeunload` handler in `useTestSession.js` only fires on full page unload (browser close/refresh), not SPA React Router navigation.

---

### FIX-14 (B14F-003/004/005/006): Touch Targets — FAIL

**Status: FAIL — None of the touch target fixes were implemented.**

All 10 measured touch targets remain below the 44px WCAG 2.5.5 minimum. Full measurements from `b14f_retest_v3_results.json`:

| Element | Source Class | Measured Size | Pass 44px? |
|---------|-------------|---------------|------------|
| Begin Test / Resume Test (InstructionScreen) | `py-2` | 295 x **40px** | FAIL |
| Cancel (InstructionScreen) | `py-2` | 295 x **42px** | FAIL |
| Back button (QuestionNavigator) | `py-2` | 79 x **36px** | FAIL |
| Next button (QuestionNavigator) | `py-2` | 80 x **38px** | FAIL |
| Navigator toggle "Question 1 of 15▲" | no min-h | 121 x **20px** | FAIL |
| Flag for Review button (APTestSession) | `py-2` | 140 x **38px** | FAIL |
| Hamburger menu (APTestSession) | `w-8 h-8` | **29 x 32px** | FAIL |
| Strikethrough button (AnswerInput) | `p-2` | **34 x 34px** | FAIL |
| Navigator grid cells 1-9 | `w-10 h-10` | **40 x 40px** | FAIL |
| Navigator close button (✕) | no padding | **13 x 24px** | FAIL |

Screenshots confirming measurements:
- `v3_02_instruction.png` — Begin Test button visible, clearly small
- `v3_03_q1.png` — Q1 testing view shows small Back, Next, Flag, hamburger buttons
- `v3_04_navigator_modal.png` — Navigator grid shows small cells (40x40) and tiny ✕ close button

Source confirms none were updated:
- `InstructionScreen.jsx` line 93 and 99: both buttons still have `py-2`
- `QuestionNavigator.jsx` line 27: still `w-10 h-10` for grid cells
- `QuestionNavigator.jsx` lines 112, 135, 142: Back/Next/Review buttons still `py-2`
- `QuestionNavigator.jsx` line 122: navigator toggle has NO `min-h-[44px]`
- `QuestionNavigator.jsx` lines 165-169: close button has no padding
- `APTestSession.jsx` line 498: hamburger still `w-8 h-8`
- `AnswerInput.jsx` line 132: strikethrough still `p-2`

---

### FIX-12 (B14F-001): FRQ Textarea Scroll-Into-View — FAIL (Source Confirmed)

**Status: FAIL — Fix not implemented. Source analysis confirms.**

Source analysis: `src/apBoost/components/FRQTextInput.jsx` — the `scrollIntoView` useEffect is absent. The file has only one `useEffect` (lines 24-34) for auto-resize behavior. No `handleFocus` listener. No `scrollIntoView` call exists anywhere in the apBoost source tree.

Live test was SKIP for direct measurement (student session state after v3 MCQ submission prevented reaching FRQ in isolation), but the absence of the fix in source is definitive.

The original finding stands: the FRQ textarea at y=462 remains invisible when the viewport is reduced to 350px height (keyboard simulation). Clicking the textarea would not auto-scroll it into view.

Note: The `v5_01_initial.png` screenshot shows the instruction screen correctly loading (no TDZ crash), confirming the FIX-15 stabilized the session component. The MCQ section was already submitted in the v3 run, so student9's session had the MCQ completed and was at the FRQ choice screen — confirming the MCQ navigation is functional.

---

## Findings

### Blockers
None — the TDZ crash observed in v1 was transient (stale Vite cache) and resolved itself. The working tree version of `useOfflineQueue.js` is correct.

---

### High-Priority

#### [FINDING-B14F-R001]: FIX-12 NOT IMPLEMENTED — FRQ textarea still hidden at keyboard viewport

- **Severity:** High-Priority
- **Scenario:** B14F-retest FIX-12
- **Criteria Reference:** B14F acceptance criteria — "FRQ input not hidden by keyboard"
- **What Happened:** `FRQTextInput.jsx` contains no `scrollIntoView` focus handler. The single `useEffect` in the file (lines 24-34) handles auto-resize only. When the viewport is reduced to 375x350 (keyboard simulation), the textarea at y=462 remains below the 350px viewport boundary — invisible and unreachable without manual scroll.
- **Expected:** A `useEffect` that adds a `focus` event listener on the textarea, calls `textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` after a 300ms delay to allow keyboard animation to complete.
- **Screenshot/Evidence:** `v5_01_initial.png` — app loads correctly. Source grep for `scrollIntoView` returns no matches in `src/apBoost/`. `b14f_retest_v3_results.json`: `fix12_frqScroll: { error: "Could not reach FRQ section via MCQ answering" }` (session state issue from prior run, not app crash).
- **File(s) to Fix:** `src/apBoost/components/FRQTextInput.jsx`
- **How to Fix:** In `FRQTextInput.jsx`, add a second `useEffect` after the auto-resize effect (after line 34), before `handleChange`:
  ```jsx
  // Auto-scroll textarea into view when mobile keyboard opens
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const handleFocus = () => {
      setTimeout(() => {
        textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 300) // Delay for keyboard animation to complete
    }
    textarea.addEventListener('focus', handleFocus)
    return () => textarea.removeEventListener('focus', handleFocus)
  }, [])
  ```
  Place this at line 35, after the auto-resize `useEffect` closes at line 34.
- **Acceptance Test:** Navigate to Micro test on mobile viewport 375x667. Complete MCQ section, select "Type Your Answers", confirm. On first FRQ question, resize viewport to 375x350 (simulating keyboard open). Click the textarea. Wait 500ms. Verify textarea `top` is `< 350` (visible in viewport). No manual scrolling should be required.

---

#### [FINDING-B14F-R002]: FIX-13 NOT IMPLEMENTED — Browser back still navigates silently

- **Severity:** High-Priority
- **Scenario:** B14F-retest FIX-13
- **Criteria Reference:** B14F acceptance criteria — "Press browser back button and handle the confirmation dialog (stay on page)"
- **What Happened:** `APTestSession.jsx` imports are confirmed (lines 1-21); `useBlocker` from `react-router` is absent. `page.goBack()` during an active test session navigated immediately to `http://localhost:5173/` (VocaBoost main dashboard) with no confirmation dialog, no modal overlay, and no blocker. The student loses their test session silently.
- **Expected:** A `useBlocker` hook configured for `status === SESSION_STATUS.IN_PROGRESS && view === 'testing'` should intercept the navigation and render a modal with "Stay" and "Leave Test" buttons.
- **Screenshot/Evidence:** `v3_05_after_back.png` — VocaBoost main dashboard appears immediately. `b14f_retest_v3_results.json`: `urlAfterBack: "http://localhost:5173/"`, `blockerFired: false`, `silentNavigation: true`.
- **File(s) to Fix:** `src/apBoost/pages/APTestSession.jsx`
- **How to Fix:**
  1. Add to imports at line 3: `import { useBlocker } from 'react-router'`
  2. After `useAnnotations` setup (around line 129), add the blocker:
     ```jsx
     // SPA navigation guard — prevent accidental Back button during test
     const blocker = useBlocker(
       ({ currentLocation, nextLocation }) =>
         status === SESSION_STATUS.IN_PROGRESS &&
         view === 'testing' &&
         currentLocation.pathname !== nextLocation.pathname
     )
     ```
  3. In the JSX return (within the `testing` view render path), add the blocker modal before the closing `</div>` of the main container:
     ```jsx
     {blocker.state === 'blocked' && (
       <div className="fixed inset-0 z-50">
         <div className="absolute inset-0 bg-black/50" />
         <div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-[--radius-card-lg] p-6 animate-slide-up">
           <h3 className="text-lg font-semibold text-text-primary mb-2">Leave Test?</h3>
           <p className="text-text-secondary text-sm mb-4">Are you sure you want to leave? Your progress will be saved.</p>
           <div className="flex gap-3">
             <button
               onClick={() => blocker.reset()}
               className="flex-1 py-3 rounded-[--radius-button] border border-border-default text-text-primary font-medium hover:bg-hover"
             >
               Stay
             </button>
             <button
               onClick={() => blocker.proceed()}
               className="flex-1 py-3 rounded-[--radius-button] bg-error text-white font-medium hover:opacity-90"
             >
               Leave Test
             </button>
           </div>
         </div>
       </div>
     )}
     ```
  Note: `useBlocker` is verified available in the project's `react-router` v7.9.6 (`typeof require('react-router').useBlocker === 'function'`). The correct import is from `react-router` not `react-router-dom`.
- **Acceptance Test:** Start Micro test, answer Q1. Press browser back. Verify a modal appears with "Stay" and "Leave Test" buttons. Click "Stay" — confirm still on test Q1. Press back again, click "Leave Test" — confirm navigated away from test to `/ap` dashboard. No silent navigation should occur.

---

### Medium-Priority

#### [FINDING-B14F-R003]: FIX-14 NOT IMPLEMENTED — All 10 touch targets remain below 44px minimum

- **Severity:** Medium-Priority
- **Scenario:** B14F-retest FIX-14
- **Criteria Reference:** WCAG 2.5.5 (44x44px touch target minimum); B14F acceptance criteria — "All touch targets reachable (min 44x44px)"
- **What Happened:** All 10 interactive elements measured remain below the 44px minimum. None of the proposed CSS changes (`py-2` → `py-3`, `w-10 h-10` → `w-11 h-11`, adding `min-h-[44px] min-w-[44px]`) were applied to the source files. Measurements are identical to the original B14F findings.
- **Expected:** All interactive touch targets should meet WCAG 2.5.5 minimum of 44x44px.
- **Screenshot/Evidence:**
  - `v3_02_instruction.png` — Begin Test button visually small (measured 40px height)
  - `v3_03_q1.png` — Q1 testing view; small Back (36px), Next (38px), Flag (38px), Hamburger (32px) all visible
  - `v3_04_navigator_modal.png` — Grid cells 40x40, tiny ✕ close button (13x24px)
  - Measurements from `b14f_retest_v3_results.json` (all confirmed FAIL in table above)
- **Files to Fix and Changes Required:**
  1. `src/apBoost/components/InstructionScreen.jsx` line 93: change `py-2` to `py-3` on Cancel button
  2. `src/apBoost/components/InstructionScreen.jsx` line 99: change `py-2` to `py-3` on Begin/Resume button
  3. `src/apBoost/components/QuestionNavigator.jsx` line 27: change `w-10 h-10` to `w-11 h-11`
  4. `src/apBoost/components/QuestionNavigator.jsx` line 112: change `py-2` to `py-3` on Back button
  5. `src/apBoost/components/QuestionNavigator.jsx` line 122: add `py-3 px-2 min-h-[44px]` to navigator toggle button className
  6. `src/apBoost/components/QuestionNavigator.jsx` lines 135, 142: change `py-2` to `py-3` on Next and Review buttons
  7. `src/apBoost/components/QuestionNavigator.jsx` lines 165-169: add `p-2 min-h-[44px] min-w-[44px] flex items-center justify-center` to close button
  8. `src/apBoost/pages/APTestSession.jsx` line 498: change `w-8 h-8` to `w-11 h-11` on hamburger button
  9. `src/apBoost/components/AnswerInput.jsx` line 132: change `p-2` to `p-3` on strikethrough button (NOTE: `p-3` + `h-4 w-4` SVG = 12+16+12 = 40px total — still 4px short. Use `p-[14px]` or add `min-h-[44px] min-w-[44px]` to guarantee 44px)

  **Layout safety (confirmed from B14F findings answers):** `w-11 h-11` cells with 6-column flex-wrap at 327px available width = 6 × (44+8) - 8 = 304px — no overflow. `py-3` on Back/Next adds 8px to bar height (from ~60px to ~68px) — negligible.
- **Acceptance Test:** On 375x667 viewport, navigate to Micro test instruction screen. Measure Begin Test/Cancel button height (should be >= 44px). Start test. Measure Back, Next, Flag, Hamburger buttons (all >= 44px). Open navigator modal — measure all grid cells (>= 44px) and close button (>= 44px).

---

### Nitpicks

- **Nit:** The Cancel button on the instruction screen measured 42px (just 2px below 44px minimum). The InstructionScreen.jsx flex layout stacks buttons vertically on mobile. A simpler fix would be `py-3` for both buttons uniformly rather than `py-2` for Cancel and `py-3` for Begin — makes both buttons the same height and avoids inconsistency.

- **Nit:** The navigator toggle button text "Question 1 of 15▲" is at 20px height with no padding at all. This is the smallest element measured. The `min-h-[44px]` approach is valid, but also consider wrapping the entire bottom nav bar content in `items-stretch` so the button fills the bar height naturally.

- **Nit:** The v1 Vite cache TDZ error is worth noting for future runs: if the dev server is started after a fresh git checkout, Vite may serve an older cached bundle. Adding a Vite config `server.warmup` or using `vite --force` during dev startup would prevent stale module caching. Not a code issue, operational concern.

---

## Console Errors

| Run | Page/Route | Error | Severity |
|-----|------------|-------|----------|
| v1 (stale cache) | `/ap/test/test_micro_full_1` | `ReferenceError: Cannot access 'scheduleFlush' before initialization` (6x) | error (transient, cache-related) |
| v3 | all routes | 0 errors | — |
| v5 | all routes | 0 errors | — |

---

## Summary

| Metric | Count |
|--------|-------|
| Fixes Retested | 4 |
| PASS | 1 (FIX-15) |
| FAIL | 3 (FIX-12, FIX-13, FIX-14) |
| PARTIAL | 0 |
| SKIP | 0 |
| Blockers Found | 0 |
| High-Priority Found | 2 (FIX-12 not implemented, FIX-13 not implemented) |
| Medium-Priority Found | 1 (FIX-14 not implemented — all 10 touch targets) |
| Nitpicks | 3 |

---

## Fix Implementation Status

| Fix ID | Description | Files to Change | Status |
|--------|-------------|-----------------|--------|
| FIX-12 | Add scrollIntoView focus handler to FRQTextInput | `FRQTextInput.jsx` | NOT DONE |
| FIX-13 | Add useBlocker confirmation modal to APTestSession | `APTestSession.jsx` | NOT DONE |
| FIX-14 | Increase touch target padding/size on 9 elements | `InstructionScreen.jsx`, `QuestionNavigator.jsx`, `APTestSession.jsx`, `AnswerInput.jsx` | NOT DONE |
| FIX-15 | Suppress IDB closing errors via mountedRef guard | `useOfflineQueue.js` | DONE — PASS |

---

## Key Screenshots

| Screenshot | Description |
|------------|-------------|
| `screenshots_B14F_retest/v3_02_instruction.png` | Instruction screen — Begin Test button (40px, below 44px minimum) |
| `screenshots_B14F_retest/v3_03_q1.png` | Q1 testing view — small toolbar buttons (Back 36px, Next 38px, Flag 38px, Hamburger 32px) |
| `screenshots_B14F_retest/v3_04_navigator_modal.png` | Navigator modal — grid cells 40x40 (4px short), ✕ close button 13x24 (critically small) |
| `screenshots_B14F_retest/v3_05_after_back.png` | After browser back — VocaBoost main dashboard, no blocker modal fired |
| `screenshots_B14F_retest/01_after_login.png` (v1) / `v3_01_dashboard.png` (v3) | Login confirmed successful |
| `screenshots_B14F_retest/03_instruction_screen.png` (v1) | Vite cache TDZ crash — error boundary: "Cannot access 'scheduleFlush' before initialization" |
