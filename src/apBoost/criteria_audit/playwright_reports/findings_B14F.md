# Batch B14-F Findings: Realistic Student Simulation — The Lost One (Mobile)

**Agent:** Sonnet 4.6
**Date:** 2026-03-11
**Status:** PARTIAL
**Scenarios Covered:** B14-F (The Lost One — Mobile)

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 375x667 (iPhone SE), 375x350 (keyboard-open simulation)
- **Auth:** student9@apboost.test (Student123!)
- **Screenshots:** screenshots_B14F/

---

## Scenario Results

### B14-F: The Lost One — Mobile
- **Status:** PARTIAL
- **Evidence:** Multiple screenshot series taken (FINAL01-17, FRQ3 series). Live test data in `b14f_final_results.json` and `b14f_frq3_results.json`.
- **Notes:** MCQ answer switching PASS. Navigator functional but cells too small. Back button dialog FAIL. FRQ textarea hidden at keyboard viewport. Submission partially tested (got stuck at last FRQ sub-question due to script limitation, not app crash). Console errors observed (IDBDatabase closing).

---

## Detailed Step Results

| Step | Result | Notes |
|------|--------|-------|
| Login (student9) | PASS with caveat | Login succeeds, redirects to `/` not `/ap` (known B4-006) |
| Set viewport 375x667 | PASS | Viewport set successfully |
| Dashboard loads mobile | PASS | "AP Practice Tests" heading, all 3 test cards visible and large enough (343x149) |
| Click Micro test | PASS | Test card clickable, navigates to instruction screen |
| Instruction screen | PASS | "Resume Test" / "Begin Test" button visible |
| Tap wrong answer then correct | PASS | A selected (bg-brand-primary), then B selected, A deselected. selectionChanged: true |
| Navigator toggle visible | PASS | "Question N of N▲" button found |
| Open navigator modal | PASS | Modal opens as bottom sheet slide-up |
| Navigate to Q5 via modal | PASS | Cell tapped, navigated to Q5 |
| Browser Back button | FAIL | No dialog fired. Navigated to /ap without warning |
| FRQ textarea at 375x350 | FAIL | Textarea hidden (top=462, viewport=350) |
| FRQ scrollable to textarea | PASS | scrollIntoViewIfNeeded() works |
| FRQ typing at 350h | PASS | Can type after scrolling |
| Restore viewport 375x667 | PASS | Textarea returns to visible (top=462, vh=667) |
| Submit MCQ Section | PASS | Section 1 submitted successfully |
| FRQ choice screen | PASS | "Type Your Answers" / "Write by Hand" options appear |
| End-to-end submission | PARTIAL | Got through FRQ typing but stuck at last question (script issue, not app crash) |

---

## Findings

### Blockers
> None confirmed. The back button failure is a known architecture limitation (SPA navigation).

---

### High-Priority

#### [FINDING-B14F-001]: FRQ textarea hidden when mobile keyboard is open (375x350 viewport)
- **Severity:** High-Priority
- **Scenario:** B14-F (FRQ with keyboard-open simulation)
- **Criteria Reference:** B14-F acceptance criteria — "FRQ input not hidden by keyboard"
- **What Happened:** At 375x350 viewport height (simulating a mobile keyboard open), the FRQ textarea is positioned at y=462 (bottom of the content area), which is completely below the 350px viewport boundary. The textarea is invisible with `inViewport: false` and `needsScroll: true`. The student cannot see what they are typing without manually scrolling up.
- **Expected:** When the mobile keyboard opens and reduces available viewport to ~350px, the FRQ textarea should either (a) scroll into view automatically on focus/click, or (b) be positioned higher in the layout so it remains visible. At minimum, the page should auto-scroll when the textarea is focused.
- **Screenshot/Evidence:** `FRQ3_350_keyboard.png` — textarea not visible. `FRQ3_350_scrolled.png` — textarea visible at top=100 after scrollIntoViewIfNeeded(). `frqAt350: { top: 462, inVP: false, needsScroll: true }` from `b14f_frq3_results.json`.
- **File(s) to Fix:**
  - `src/apBoost/components/FRQTextInput.jsx`
  - `src/apBoost/pages/APTestSession.jsx`
- **How to Fix:** Add a `useEffect` in `FRQTextInput.jsx` that scrolls the textarea into view when it receives focus. Inside the existing component (around line 21 after the `textareaRef` declaration), add:
  ```jsx
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const handleFocus = () => {
      // On mobile, when keyboard opens, scroll textarea into view
      setTimeout(() => {
        textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 300) // Delay to allow keyboard animation to complete
    }
    textarea.addEventListener('focus', handleFocus)
    return () => textarea.removeEventListener('focus', handleFocus)
  }, [])
  ```
  Additionally, consider restructuring the FRQ page layout in `APTestSession.jsx` around line 509 (`<main className="flex-1 overflow-auto p-4">`). The `main` element uses `flex-1 overflow-auto` which is correct, but the content inside should be structured so the question prompt is collapsible or the textarea is placed at the top of the visible area. A practical fix is to add `scroll-into-view-on-focus` behavior as described above.
- **Acceptance Test:** Navigate to Micro test → complete MCQ → select "Type Your Answers" → get to Q1 FRQ. At 375x667 viewport, confirm textarea is visible. Resize to 375x350 (keyboard simulation). Click into the textarea. Confirm the page auto-scrolls so the textarea top is visible within the viewport (top < 350px). The student should be able to see what they're typing without manually scrolling.

---

#### [FINDING-B14F-002]: Browser Back button does not fire beforeunload dialog — student can silently leave test
- **Severity:** High-Priority
- **Scenario:** B14-F (press browser back, handle dialog)
- **Criteria Reference:** B14-F acceptance criteria — "Press browser back button and handle the confirmation dialog (stay on page)"
- **What Happened:** Pressing browser back (`page.goBack()`) silently navigated from `/ap/test/test_micro_full_1` to `/ap` with NO dialog shown. The `beforeunload` event fires for full page navigations (e.g., closing the tab) but NOT for React Router SPA in-app navigations. `backButtonTest: { dialogFired: false, urlAfter: "http://localhost:5173/ap", stayedOnTest: false }`. Test progress would be lost silently.
- **Expected:** A confirmation dialog should appear asking "Are you sure you want to leave? Your progress may be lost." The student should be able to cancel and return to the test.
- **Screenshot/Evidence:** `FINAL07_after_back.png` shows the `/ap` dashboard instead of the test. `backButtonTest.dialogFired: false` in `b14f_final_results.json`.
- **File(s) to Fix:** `src/apBoost/hooks/useTestSession.js`
- **How to Fix:** The current `beforeunload` handler at line 311-323 only fires on browser close/refresh, not on SPA back navigation. To intercept back navigation in React Router v7, use the `unstable_usePrompt` hook or `useBlocker` from React Router. In `APTestSession.jsx` or `useTestSession.js`, add:
  ```jsx
  // In APTestSession.jsx, import useBlocker from react-router-dom
  import { useBlocker } from 'react-router-dom'

  // Inside the component where status is available:
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      status === SESSION_STATUS.IN_PROGRESS &&
      currentLocation.pathname !== nextLocation.pathname
  )

  // Show a confirmation modal when blocker is in 'blocked' state
  {blocker.state === 'blocked' && (
    <ExitConfirmationModal
      onConfirm={() => blocker.proceed()}
      onCancel={() => blocker.reset()}
    />
  )}
  ```
  Note: `useBlocker` is available in React Router v6.4+. The app uses React Router v7 which has this API. The existing `TestSessionMenu` exit confirmation flow can be reused for the modal. The key is to block all navigations away from the test URL while `status === IN_PROGRESS`.
- **Acceptance Test:** Start Micro test → answer Q1 → press browser Back button (or click logo/back in browser UI). Confirm a modal dialog appears asking to confirm exit. Click "Stay" → confirm still on test Q1. Click "Back" again → click "Leave" → confirm navigated away from test.

---

### Medium-Priority

#### [FINDING-B14F-003]: Navigator "Question N of N" toggle button is 121x20px — far below 44x44 touch target minimum
- **Severity:** Medium-Priority
- **Scenario:** B14-F (find and use question navigator on mobile)
- **Criteria Reference:** B14-F acceptance criteria — "Navigator is usable on small screen"; WCAG 2.5.5 (44x44 touch target)
- **What Happened:** The "Question 1 of 15▲" button that opens the navigator modal is only 121x20px. A real user's thumb (minimum recommended touch target 44x44px) would struggle to tap this reliably, especially when scrolling. The button has no padding (`className="flex items-center gap-2 text-text-primary hover:text-text-secondary transition-colors"`) — just text with no touch area.
- **Expected:** The navigator toggle should have a minimum touch target of 44x44px (WCAG 2.5.5).
- **Screenshot/Evidence:** `FINAL05_navigator_modal.png` shows the "Question 1 of 15▲" text in the bottom bar. DOM measurement: `navigatorToggle: { w: 121, h: 20, fail44: true }` from `b14f_final_results.json`.
- **File(s) to Fix:** `src/apBoost/components/QuestionNavigator.jsx`
- **How to Fix:** In `QuestionNavigator.jsx` around line 122-130, add `py-3 px-2 min-h-[44px]` to the navigator toggle button's className:
  ```jsx
  <button
    onClick={() => setIsModalOpen(true)}
    className="flex items-center gap-2 text-text-primary hover:text-text-secondary transition-colors py-3 px-2 min-h-[44px]"
  >
  ```
  This gives the button a 44px+ height while maintaining the text-only visual appearance.
- **Acceptance Test:** Navigate to test session on 375x667 viewport. Check that the "Question N of N" button in the bottom bar has a bounding box height >= 44px. Verify it opens the navigator modal when tapped.

---

#### [FINDING-B14F-004]: All 15 navigator grid cells are 40x40px — below 44x44 touch target minimum
- **Severity:** Medium-Priority
- **Scenario:** B14-F (find and use question navigator on mobile)
- **Criteria Reference:** B14-F acceptance criteria — "All touch targets reachable (min 44x44px)"; WCAG 2.5.5
- **What Happened:** When the navigator modal is open, all 15 question number cells measure 40x40px (`w-10 h-10` CSS). All 16 cells (15 Q-cells + close button ✕ at 13x24px) fail the 44x44 minimum. The navigator close button (✕) is especially small at 13x24px.
- **Expected:** Each navigator grid cell should be at minimum 44x44px to be reliably tappable on mobile.
- **Screenshot/Evidence:** `FINAL05_navigator_modal.png` shows the grid. `navigatorDetails.smallCellCount: 16` — all cells fail. Cell data: `{ w: 40, h: 40, fail44: true }` for Q1-Q9, `{ w: 48, h: 40, fail44: true }` for Q10-Q15 (wider but still 40px tall). `b14f_final_results.json`.
- **File(s) to Fix:** `src/apBoost/components/QuestionNavigator.jsx`
- **How to Fix:** In `QuestionNavigator.jsx` at the `QuestionBox` component (line 26-34), change `w-10 h-10` (40px) to `w-11 h-11` (44px) and `w-12` to `w-12` (48px stays sufficient). Update line 27:
  ```jsx
  className={`
    ${hasSubLabel ? 'w-12' : 'w-11'} h-11 rounded-[--radius-button-sm] border flex items-center justify-center
  ```
  Also fix the close button at line 165-170 by adding `p-2 min-h-[44px] min-w-[44px]`:
  ```jsx
  <button
    onClick={() => setIsModalOpen(false)}
    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
  >
    ✕
  </button>
  ```
- **Acceptance Test:** Open navigator modal on 375x667 viewport. Measure each grid cell — all should have bounding box height >= 44px and width >= 44px. Verify tapping Q5 navigates to question 5.

---

#### [FINDING-B14F-005]: Begin Test / Resume Test button is 295x40px — below 44px minimum height
- **Severity:** Medium-Priority
- **Scenario:** B14-F (start Micro test on mobile)
- **Criteria Reference:** B14-F acceptance criteria — "All touch targets reachable (min 44x44px)"; WCAG 2.5.5
- **What Happened:** The "Begin Test" / "Resume Test" primary action button on the InstructionScreen has a measured height of only 40px (`px-6 py-2 rounded-[--radius-button]` where `py-2` = 8px padding + ~14-16px line-height text = ~30-32px, but CSS box is 40px). Below the 44px minimum.
- **Expected:** The primary action button should be at minimum 44px tall.
- **Screenshot/Evidence:** `FINAL01_instruction.png` shows the instruction screen with Resume Test button. `beginOrResumeBtnSize: { h: 40, fail44: true }` from `b14f_final_results.json`.
- **File(s) to Fix:** `src/apBoost/components/InstructionScreen.jsx`
- **How to Fix:** In `InstructionScreen.jsx` around line 97-103, change `py-2` to `py-3` on the Begin Test button:
  ```jsx
  <button
    onClick={onBegin}
    className="px-6 py-3 rounded-[--radius-button] bg-brand-primary text-white hover:opacity-90 transition-opacity font-medium"
  >
  ```
  The Cancel button at the same location also has `py-2` and should similarly be changed to `py-3`.
- **Acceptance Test:** Navigate to AP Micro test instruction screen on 375x667 viewport. Measure "Begin Test"/"Resume Test" button height — should be >= 44px. Verify button is easily tappable.

---

#### [FINDING-B14F-006]: Navigation bar buttons (Back, Next, Flag, Hamburger) below 44px touch target minimum
- **Severity:** Medium-Priority
- **Scenario:** B14-F (all touch targets reachable on mobile)
- **Criteria Reference:** B14-F acceptance criteria — "All touch targets reachable (min 44x44px)"
- **What Happened:** Multiple buttons in the test session navigation bar are below the 44x44 touch target minimum:
  - Hamburger menu button: 29x32px (`w-8 h-8` = 32px but rendered at 29x32 with no touch area padding)
  - Strikethrough buttons: 33x33px (`p-2` + 16px SVG = ~32px)
  - "Flag for Review" button: 139x37px (height 37px, below 44px)
  - "← Back" button: 79x36px (height 36px)
  - "Next →" button: 79x37px (height 37px)

  All of these are in the question navigation area at the bottom of the screen and are primary interaction targets for mobile users.
- **Expected:** All interactive buttons should meet WCAG 2.5.5 minimum of 44x44px.
- **Screenshot/Evidence:** `FINAL02_q1.png` shows the bottom bar. Touch target measurements in `q1TouchFailures` array from `b14f_final_results.json`.
- **File(s) to Fix:**
  - `src/apBoost/pages/APTestSession.jsx` (hamburger button at line 507; flag button at line 599)
  - `src/apBoost/components/QuestionNavigator.jsx` (Back and Next buttons at lines 108-138)
  - `src/apBoost/components/AnswerInput.jsx` (strikethrough button at line 127)
- **How to Fix:**
  1. **Hamburger** (`APTestSession.jsx` line 507): Change `w-8 h-8` to `w-11 h-11` or add `min-w-[44px] min-h-[44px]`:
     ```jsx
     className="w-11 h-11 flex items-center justify-center rounded-[--radius-button] text-text-primary hover:bg-hover transition-colors"
     ```
  2. **Flag button** (`APTestSession.jsx` line 599): Change `py-2` to `py-3`:
     ```jsx
     className={`flex items-center gap-2 px-3 py-3 rounded-[--radius-button] text-sm transition-colors ...`}
     ```
  3. **Back/Next buttons** (`QuestionNavigator.jsx` lines 112, 135): Change `py-2` to `py-3` on both Back and Next/Review buttons.
  4. **Strikethrough button** (`AnswerInput.jsx` line 132): Change `p-2` to `p-3`:
     ```jsx
     className={`p-3 rounded-[--radius-button-sm] border transition-colors shrink-0 ...`}
     ```
- **Acceptance Test:** On 375x667 viewport in test session, measure all toolbar buttons. Confirm hamburger, flag, back, next, and strikethrough buttons all have bounding box height >= 44px.

---

#### [FINDING-B14F-007]: IDBDatabase "connection is closing" console errors during session navigation
- **Severity:** Medium-Priority
- **Scenario:** B14-F (all steps, especially after back navigation)
- **Criteria Reference:** B14-F acceptance criteria — "No console errors"
- **What Happened:** After navigating away from the test session (via browser back or page.goBack()), and then returning to the test, the following console error fires 2-4 times:
  ```
  [APBoost:useOfflineQueue.getPendingItems] {function: useOfflineQueue.getPendingItems, context: Object, type: unknown, message: Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing., code: 11}
  ```
  This occurs because when navigating away, the IndexedDB connection is being closed mid-flight as the component unmounts while `getPendingItems` is still executing.
- **Expected:** No console errors during normal navigation. IndexedDB operations should be cancelled gracefully when the component unmounts.
- **Screenshot/Evidence:** `b14f_final_results.json` and `b14f_frq3_results.json` both show `consoleErrors` with this IDBDatabase error. Occurs at `http://localhost:5173/ap/test/test_micro_full_1` URL.
- **File(s) to Fix:** `src/apBoost/hooks/useOfflineQueue.js`
- **How to Fix:** In `useOfflineQueue.js`, find the `getPendingItems` function and add an abort/cleanup mechanism. The pattern is to check if the component is still mounted before resolving the IndexedDB transaction:
  ```js
  // Add a mounted ref at the top of the hook
  const mountedRef = useRef(true)
  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  // In getPendingItems, wrap the IDB transaction in a try-catch and check mounted:
  const getPendingItems = useCallback(async () => {
    if (!mountedRef.current) return []
    try {
      // ... existing IDB transaction code ...
    } catch (err) {
      if (err.code === 11 || err.message.includes('closing')) {
        // Silently ignore - connection closed due to component unmount
        return []
      }
      logError('useOfflineQueue.getPendingItems', err)
    }
  }, [...])
  ```
  Alternatively, use an AbortController or check the database state before opening a transaction.
- **Acceptance Test:** Navigate to test session → answer Q1 → press browser back → navigate back to test (resume). Check browser console — no IDBDatabase "connection is closing" errors should appear.

---

### Nitpicks

- **Nit:** The navigator modal close button "✕" has only 13px width at 375px viewport, making it extremely hard to tap. Even with the 44px fix for cells, the close button should be re-evaluated — consider making it a full-width "Close" button row or a larger icon button at the top-right with explicit min-w/min-h.

- **Nit:** The instruction screen layout uses `flex-col sm:flex-row gap-3 justify-center` for the Cancel/Begin button row. On mobile at 375px, the buttons stack vertically which is correct, but the Cancel button appears first (top) while the primary action (Begin) is below. Convention is primary action first (top or right). Consider reordering so Begin/Resume appears first visually on mobile.

- **Nit:** The navigator bottom bar (`bg-surface border-t border-border-default px-4 py-3`) is only `py-3` (12px) padding on each side, making the total bar height about 52-56px. This passes at the bar level, but the individual buttons inside have their own smaller hit areas. The bar height does not compensate for the small button touch targets.

- **Nit:** When the test is resumed from the `/ap` dashboard and the student navigates back to Q1 (because the session reset), there is no visual indication that a previous session exists or what question they were on before. The "Resume Test" label with no progress indicator may confuse mobile users.

---

## Console Errors

| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| `/ap/test/test_micro_full_1` | `[APBoost:useOfflineQueue.getPendingItems] ... Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing. code: 11` | error |
| `/ap/test/test_micro_full_1` | Same error, fires 2-4 times per navigation away/back | error |

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 1 (B14-F: The Lost One — Mobile) |
| PASS | 1 (partial — most steps pass) |
| FAIL | 0 (full blocker) |
| PARTIAL | 1 (FRQ viewport hidden, back dialog missing) |
| SKIP | 0 |
| Blockers Found | 0 |
| High-Priority Found | 2 |
| Medium-Priority Found | 5 |
| Nitpicks | 4 |

---

## Key Mobile Usability Summary

| Check | Result | Detail |
|-------|--------|--------|
| Dashboard test cards | PASS | 343x149px — easily tappable |
| MCQ answer rows | PASS | 269x49px — meets 44px minimum |
| Answer switching (tap wrong then correct) | PASS | Selection changes correctly, bg-brand-primary applied/removed |
| Navigator toggle button | FAIL | 121x20px — far below 44px minimum |
| Navigator grid cells | FAIL | 40x40px — 4px short of 44px minimum |
| Navigator modal fits 375px viewport | PASS | 375x336px — fits within 667px height |
| Browser back dialog | FAIL | No dialog fires; silent navigation to /ap |
| FRQ textarea at 375x667 | PASS | Top=462, visible in 667px viewport |
| FRQ textarea at 375x350 (keyboard) | FAIL | Top=462 — HIDDEN below 350px viewport |
| FRQ scrollable to see textarea | PASS | scrollIntoView works |
| Hamburger menu button | FAIL | 29x32px — below 44px |
| Flag button | FAIL | 37px height — below 44px |
| Back/Next buttons | FAIL | 36-37px height — below 44px |
| Begin/Resume button | FAIL | 40px height — below 44px |
| Console errors | FAIL | IDBDatabase closing errors (4 per session) |
| Submission end-to-end | PARTIAL | MCQ section submits OK; FRQ completion partially tested |

---

## Questions from Consolidated Fix Review (2026-03-11)

> These questions are from the lead developer reviewing all B14 findings. Please answer in a follow-up section below.

**Q1 (re: FIX-13 / B14F-002):** The proposed fix uses `useBlocker` from `react-router-dom`. The app uses React Router v7 — does v7 expose `useBlocker` directly from `react-router-dom`, or is it under a different import path (e.g., `react-router`)? Please confirm the exact import statement that works with the project's current React Router version.

**Q2 (re: FIX-13 / B14F-002):** Does the existing `TestSessionMenu` exit flow (hamburger → "Exit Test") already have a confirmation modal component we can reuse for the `useBlocker` confirmation? If so, what's the component name and file path? We want to avoid creating a duplicate modal.

**Q3 (re: FIX-14 / B14F-003/004/005/006):** The touch target fixes are simple padding changes across 8 components. Did you check whether increasing these sizes causes any layout overflow or overlapping on the 375px viewport? Specifically: (a) does `w-11 h-11` on navigator grid cells cause the 15-cell grid to overflow horizontally, and (b) does `py-3` on Back/Next buttons cause the bottom navigation bar to become too tall?

---

## Answers to Consolidated Fix Review Questions

### A1 (re: Q1 — `useBlocker` import path for React Router v7)

**Confirmed: `useBlocker` is exported directly from `react-router` (NOT `react-router-dom`) in v7.9.6.**

The project uses `react-router` v7.9.6. Verified via:
- `node -e "const rr = require('react-router'); console.log(typeof rr.useBlocker)"` → `function`
- The export exists in `node_modules/react-router/dist/production/index.d.ts` at line 1382

The correct import statement is:
```jsx
import { useBlocker } from 'react-router'
```

**Do NOT use** `import { useBlocker } from 'react-router-dom'` — React Router v7 consolidated exports under `react-router`. The `react-router-dom` package still exists for backward compat but the canonical import is `react-router`.

### A2 (re: Q2 — Reusable exit confirmation modal)

**Yes, `TestSessionMenu` at `src/apBoost/components/TestSessionMenu.jsx` already has a built-in exit confirmation flow that can be reused as a pattern.**

The component has:
- `showExitConfirm` state (line 16)
- A confirmation UI with "Are you sure you want to exit? Your progress will be saved." message (line 96)
- Cancel + Exit buttons styled with design tokens (lines 99-111)
- `onExit` callback prop that navigates away

However, `TestSessionMenu` is tightly coupled to its slide-up menu modal — the exit confirmation is rendered *inside* the menu panel, not as a standalone modal. **You cannot directly reuse the component as-is for `useBlocker`.**

**Recommended approach:** Extract the exit confirmation markup (lines 92-112) into a standalone `ExitConfirmationModal` component, or more practically, build a simple inline confirmation directly in `APTestSession.jsx` when `blocker.state === 'blocked'`:

```jsx
{blocker.state === 'blocked' && (
  <div className="fixed inset-0 z-50">
    <div className="absolute inset-0 bg-black/50" />
    <div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-[--radius-card-lg] p-6 animate-slide-up">
      <h3 className="text-lg font-semibold text-text-primary mb-4">Leave Test?</h3>
      <p className="text-text-secondary mb-4">Are you sure you want to leave? Your progress will be saved.</p>
      <div className="flex gap-3">
        <button onClick={() => blocker.reset()} className="flex-1 py-3 rounded-[--radius-button] border border-border-default text-text-primary font-medium hover:bg-hover">
          Stay
        </button>
        <button onClick={() => blocker.proceed()} className="flex-1 py-3 rounded-[--radius-button] bg-error text-white font-medium hover:opacity-90">
          Leave Test
        </button>
      </div>
    </div>
  </div>
)}
```

This reuses the same visual pattern (slide-up modal, same button styles, same messaging) without coupling to `TestSessionMenu`'s internal state. Approximately 15 lines of JSX — not worth a separate component file.

### A3 (re: Q3 — Layout overflow check for touch target size increases)

**No overflow or layout issues. Both changes are safe at 375px.**

**(a) Navigator grid cells `w-11 h-11` (44px):**

Layout math at 375px viewport with `p-6` (24px) container padding:
- Available width: 375 - 24 - 24 = **327px**
- Current `w-10` (40px) + `gap-2` (8px) = 48px/cell → **6 cells/row**, 3 rows for 15 cells
- Proposed `w-11` (44px) + `gap-2` (8px) = 52px/cell → **still 6 cells/row** (6×52 - 8 = 304px < 327px), still 3 rows

Grid layout is identical — no overflow, no row change.

For `w-12` sub-label cells (48px + 8px = 56px): fits 5 per row, which is already the current behavior for those cells. No change.

**(b) Bottom nav bar with `py-3` on Back/Next buttons:**

- Current: `py-2` (8px×2) + ~20px text = **36px** button → bar total ~**60px** (with `py-3` bar padding)
- Proposed: `py-3` (12px×2) + ~20px text = **44px** button → bar total ~**68px**
- Content area shrinks from ~559px to ~551px — a **delta of only 8px**, negligible

The bar fits comfortably at 68px. The three buttons (Back, "Question N of N", Next) sit in a `flex justify-between` row — horizontal space is unchanged since only vertical padding increased. No horizontal overflow possible.
