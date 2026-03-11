# B14 Retest — Consolidated Fix Plan

> Generated 2026-03-12 from retest findings: B14B-retest, B14C-retest, B14C-retest-v2, B14D-retest, B14E-retest, B14F-retest, B14H-retest.
> Cross-referenced against original `findings_B14_consolidated_fixes.md` (FIX-1 through FIX-15).

---

## Verified Fixed (Confirmed by Retest Agents)

These fixes from the original plan have been **verified working** by retest agents:

| Original Fix | Description | Verified By | Status |
|-------------|-------------|-------------|--------|
| FIX-3 | DuplicateTabModal on instruction screen | B14H-retest | CONFIRMED FIXED |
| FIX-4 | handleBegin `isInvalidated` guard | B14H-retest | CONFIRMED FIXED |
| FIX-6 | submitTest uses `getPendingItems()` not stale `queueLength` | B14C-retest-v2 | CONFIRMED FIXED |
| FIX-15 | IDB `mountedRef` guard + closing error suppression | B14F-retest | CONFIRMED FIXED |
| B14D-001 | DuplicateTabModal false positive after reload (sessionStorage token) | B14D-retest | CONFIRMED FIXED |
| B14D-003 / B14E-002 | `code.startsWith` TypeError (`String()` coercion) | B14B/D/E retests | CONFIRMED FIXED |
| B14B-LIVE-001 | MCQ letter badge contrast | B14B-retest | CONFIRMED FIXED |
| B14B-003 | FRQ navigator "Question 1 of X" | B14B-retest | CONFIRMED FIXED |
| B14B-006 | Timer urgency cues (bold 5min, pulse 1min) | B14B-retest | CONFIRMED FIXED |
| FRQ two-step | Card highlight → Confirm & Continue flow | B14B/D retests | CONFIRMED FIXED |
| Nav dedup | Navigator no duplicate entries | B14B-retest | CONFIRMED FIXED |

---

### RFIX-11: AnswerInput letter badge contrast (B14A-RETEST-001) — APPLIED

**File:** `src/apBoost/components/AnswerInput.jsx` line 104
**Change:** `bg-white/20 text-white` → `bg-white text-brand-primary font-semibold`

### RFIX-12: AnswerInput ARIA roles (B14A-RETEST-002) — APPLIED

**File:** `src/apBoost/components/AnswerInput.jsx`
**Changes:** Added `role="radio"/"checkbox"`, `aria-checked`, `aria-label` on answer buttons; `radiogroup`/`group` wrapper on container.

---

## Deferred (Not Fixing Now)

| Finding | Description | Reason |
|---------|-------------|--------|
| B14C-002 | Review grid answer letter badges | Design Overhaul — UX enhancement |
| B14E-RETEST-002 / B4-006 | Login redirects to `/` not `/ap` | Separate issue, tracked in AP_BOOST_TRACKER |
| B14E-RETEST-001 | scheduleFlush TDZ under Vite HMR only | Dev-environment artifact only; production builds unaffected. RFIX-1 (declaration reorder) resolves this as a side-effect |

---

## FIX NOW — Fixes Still Needed

### RFIX-1: Move `scheduleFlush` declaration before first reference (declaration ordering hazard)

**Sources:** B14C-RETEST-001 (Blocker), B14D-RETEST-005 (Medium), B14E-RETEST-001 (Medium), B14H-RETEST-003 (Medium)

**Root Cause:** `scheduleFlush` is declared via `useCallback` at line ~186, but referenced inside the `handleOnline` closure at line ~96 (inside a `useEffect` at line ~89 with `[]` deps). The empty deps + closure capture means this works at runtime — `scheduleFlush` is initialized by the time `handleOnline` fires. However, the declaration order is a **latent hazard**: any linter auto-fix or future dev adding `scheduleFlush` to the deps array will cause an instant TDZ `ReferenceError` crash during render. Multiple agents hit this when Vite HMR triggered re-evaluation with stale cached versions that had `[scheduleFlush]` in the deps.

**Impact:** Not actively crashing in production or normal dev. But structurally fragile — a one-character edit to the deps array causes a Blocker-level crash. 4 of 7 retest agents observed it at least once due to Vite HMR cache artifacts.

**File:** `src/apBoost/hooks/useOfflineQueue.js`

**Solution:** Move `scheduleFlush` declaration to immediately after the `mountedRef` block, BEFORE any `useEffect` that references it. Also add `scheduleFlush` to `addToQueue`'s dependency array (safe once declaration order is fixed):

```js
// AFTER mountedRef block (~line 66), BEFORE initDB useEffect:

// Schedule a flush with debounce
// Uses flushQueueRef to always call the latest flushQueue (avoids stale closure)
const scheduleFlush = useCallback((delay) => {
  if (flushTimeoutRef.current) {
    clearTimeout(flushTimeoutRef.current)
  }
  flushTimeoutRef.current = setTimeout(() => {
    flushQueueRef.current?.()
  }, delay)
}, [])
```

Then in `addToQueue`'s dependency array, add `scheduleFlush`:
```js
}, [sessionId, isOnline, isOpportunistic, updateQueueLength, scheduleFlush])
```

And the online/offline `useEffect` can safely use `[scheduleFlush]` instead of `[]` with eslint-disable.

**Verify:** Navigate to any test URL — no error boundary. Check console — no `scheduleFlush` TDZ error. Trigger Vite HMR by saving a file — no crash.

---

### RFIX-2: Wire `onSessionQuery: flushQueue` in useTestSession (FIX-5 incomplete)

**Source:** B14H-RETEST-001 (High)

**Root Cause:** `useDuplicateTabGuard` correctly has the fire-and-forget `onSessionQueryRef.current?.()` call on SESSION_QUERY. But `useTestSession.js` line 66 calls `useDuplicateTabGuard(session?.id)` without passing the callback. `onSessionQueryRef.current` is always `undefined`.

**Impact:** When Tab 2 opens, Tab 1 does NOT flush its IndexedDB queue to Firestore. Tab 2 reads stale session data, potentially losing Tab 1's recent answers.

**File:** `src/apBoost/hooks/useTestSession.js` — line 66

**Solution:** Single line change:
```js
// BEFORE (broken):
const { instanceToken, isInvalidated, takeControl } = useDuplicateTabGuard(session?.id)

// AFTER (fixed):
const { instanceToken, isInvalidated, takeControl } = useDuplicateTabGuard(session?.id, { onSessionQuery: flushQueue })
```

`flushQueue` is already destructured from `useOfflineQueue` at line 65. `useDuplicateTabGuard` stores it in a ref, so stale closures are not a concern.

**Verify:** Tab 1 answers Q1-Q3 → Tab 2 opens same URL → Check Tab 1 console for flush log after "Responding to query from new tab" → Tab 2 takes control → Q1-Q3 answers present in Firestore.

---

### RFIX-3: SPA navigation guard — use `popstate` approach (NOT `useBlocker`)

**Sources:** B14D-RETEST-002 (High), B14F-R002 (High), B14H-RETEST-002 (Medium)

**Root Cause:** The app uses `BrowserRouter` (legacy). `useBlocker` from `react-router` v7 requires a data router (`createBrowserRouter`). Using `useBlocker` with `BrowserRouter` throws `"useBlocker must be used within a data router"` and crashes the component.

**CRITICAL:** The original FIX-13 spec used `useBlocker`. This is WRONG for this app. Must use `popstate` + `history.pushState` instead. If `useBlocker` is currently imported, it must be REMOVED.

**Impact:** Pressing browser Back during an in-progress test silently navigates to `/` (VocaBoost dashboard). No confirmation, no recovery.

**File:** `src/apBoost/pages/APTestSession.jsx`

**Solution:**
1. **Remove** any `import { useBlocker } from 'react-router'`
2. **Remove** any `const blocker = useBlocker(...)` call
3. **Add** state and popstate listener:

```jsx
const [showLeaveTestModal, setShowLeaveTestModal] = useState(false)

// SPA navigation guard — popstate approach (works with BrowserRouter)
useEffect(() => {
  if (status !== SESSION_STATUS.IN_PROGRESS || view !== 'testing') return

  // Push a dummy history entry so back-nav fires popstate instead of leaving
  window.history.pushState({ apBoostGuard: true }, '')

  const handlePopState = () => {
    // Re-push to prevent actual navigation
    window.history.pushState({ apBoostGuard: true }, '')
    setShowLeaveTestModal(true)
  }

  window.addEventListener('popstate', handlePopState)
  return () => window.removeEventListener('popstate', handlePopState)
}, [status, view])
```

4. **Add** modal JSX (replace any `blocker.state === 'blocked'` modal):

```jsx
{showLeaveTestModal && (
  <div className="fixed inset-0 z-50">
    <div className="absolute inset-0 bg-black/50" onClick={() => setShowLeaveTestModal(false)} />
    <div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-[--radius-card] p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-2">Leave Test?</h3>
      <p className="text-text-secondary text-sm mb-4">Your progress will be saved, but the timer will keep running.</p>
      <div className="flex gap-3">
        <button
          onClick={() => setShowLeaveTestModal(false)}
          className="flex-1 py-3 rounded-[--radius-button] border border-border-default text-text-primary font-medium hover:bg-hover transition-colors"
        >
          Stay
        </button>
        <button
          onClick={() => { setShowLeaveTestModal(false); navigate('/ap') }}
          className="flex-1 py-3 rounded-[--radius-button] bg-error text-white font-medium hover:opacity-90 transition-opacity"
        >
          Leave Test
        </button>
      </div>
    </div>
  </div>
)}
```

**Verify:** Start test → answer Q1 → press browser Back → modal appears → "Stay" keeps test → Back again → "Leave Test" navigates to `/ap`. No `useBlocker` crash in console.

---

### RFIX-4: FRQ "Change submission type" link + discard warning (FIX-9 incomplete)

**Source:** B14D-RETEST-001 (High)

**Root Cause:** The two-step FRQ choice (card highlight → Confirm) is implemented and working. But the "Change submission type" link in the testing header during FRQ sections is missing — `handleChangeFRQType` function and conditional button are not present.

**Impact:** Once a student confirms their FRQ submission type, they cannot change it. If they chose wrong, they're stuck.

**File:** `src/apBoost/pages/APTestSession.jsx`

**Solution:**

1. Add handler (after `handleFRQChoice`):
```js
const handleChangeFRQType = () => {
  const hasAnswers = Object.keys(frqQuestions || {}).some(qId => {
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

2. Add button in testing header (after section title span, inside the left-side flex div):
```jsx
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

Note: `isFRQSection` is already computed. `frqQuestions` must be accessible (verify it's destructured from `useTestSession` or derived from test data).

**Verify:** Complete MCQ → FRQ choice → select Type → Confirm → "Change submission type" visible in header → type some text → click it → warning dialog → Cancel keeps answers → Confirm returns to choice screen.

---

### RFIX-5: FRQ textarea scrollIntoView on mobile keyboard (FIX-12 not implemented)

**Source:** B14F-R001 (High)

**Root Cause:** `FRQTextInput.jsx` has no `scrollIntoView` focus handler. On mobile, when the keyboard opens (viewport shrinks to ~350px), the textarea at y=462 is completely below the viewport.

**Impact:** Mobile students can't see what they're typing in FRQ textareas without manual scrolling.

**File:** `src/apBoost/components/FRQTextInput.jsx`

**Solution:** Add a second `useEffect` after the existing auto-resize effect:
```jsx
// Auto-scroll textarea into view when mobile keyboard opens
useEffect(() => {
  const textarea = textareaRef.current
  if (!textarea) return
  const handleFocus = () => {
    setTimeout(() => {
      textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 300) // Delay for keyboard animation
  }
  textarea.addEventListener('focus', handleFocus)
  return () => textarea.removeEventListener('focus', handleFocus)
}, [])
```

**Verify:** Mobile viewport 375x667 → FRQ question → resize to 375x350 → tap textarea → page auto-scrolls so textarea visible.

---

### RFIX-6: Submit confirmation modal for final section (FIX-8 not implemented)

**Source:** B14B-RETEST-002 (Medium)

**Root Cause:** `handleSubmit` in `APTestSession.jsx` calls `submitTest(frqData)` directly with no confirmation. The MCQ section has review + "Submit Section", but the final "Submit Test" has no "Are you sure?" step.

**Impact:** Students can accidentally submit the entire test by fast-tapping. No undo.

**File:** `src/apBoost/pages/APTestSession.jsx`

**Solution:**

1. Add state: `const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)`

2. Add handler: `const handleSubmitRequest = () => setShowSubmitConfirm(true)`

3. In `ReviewScreen` call, change `onSubmit` prop for final section:
```jsx
onSubmit={position.sectionIndex === (test?.sections?.length || 1) - 1
  ? handleSubmitRequest
  : handleSubmitSection}
```

4. Add modal JSX:
```jsx
{showSubmitConfirm && (
  <div className="fixed inset-0 z-50">
    <div className="absolute inset-0 bg-black/50" onClick={() => setShowSubmitConfirm(false)} />
    <div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-[--radius-card] p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-2">Submit Test?</h3>
      <p className="text-text-secondary text-sm mb-4">This action cannot be undone. Make sure you have reviewed all your answers.</p>
      <div className="flex gap-3">
        <button
          onClick={() => setShowSubmitConfirm(false)}
          className="flex-1 py-3 rounded-[--radius-button] border border-border-default text-text-primary font-medium hover:bg-hover transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => { setShowSubmitConfirm(false); handleSubmit() }}
          className="flex-1 py-3 rounded-[--radius-button] bg-brand-primary text-brand-text font-medium hover:opacity-90 transition-opacity"
        >
          Submit Test
        </button>
      </div>
    </div>
  </div>
)}
```

**Verify:** Complete FRQ → Review → "Submit Test" → modal appears → Cancel returns to review → Confirm submits.

---

### RFIX-7: ReviewScreen timer display (FIX-7 — partially applied)

**Source:** B14B-RETEST-001 (Medium)

**Root Cause:** `APTestSession.jsx` passes `timeRemaining` prop to `ReviewScreen`, but `ReviewScreen.jsx` was never updated to accept it or render `TestTimer`.

**Note:** B14B retest agent claims it applied this fix during its session. Verify before re-applying.

**File:** `src/apBoost/components/ReviewScreen.jsx`

**Solution:**
1. Add import: `import TestTimer from './TestTimer'`
2. Add `timeRemaining = null` to destructured props
3. After the `<h1>Review Your Answers</h1>` heading, add:
```jsx
{timeRemaining != null && (
  <div className="flex justify-center mb-6">
    <TestTimer timeRemaining={timeRemaining} />
  </div>
)}
```

**Verify:** Start test → answer some questions → Review → timer visible and counting down.

---

### RFIX-8: Touch targets ≥ 44px (FIX-14 not implemented)

**Sources:** B14F-R003 (Medium), B14D-RETEST-003 (Medium), B14D-RETEST-004 (Medium)

**Root Cause:** All 10 measured interactive elements remain below WCAG 2.5.5 44px minimum. None of the padding/size changes were applied.

**Impact:** Mobile users struggle to reliably tap small targets, especially the 20px navigator toggle and 13x24px close button.

**Files:** `QuestionNavigator.jsx`, `InstructionScreen.jsx`, `APTestSession.jsx`, `AnswerInput.jsx`

**Solution — batch changes:**

| Component | File | Current | Change To |
|-----------|------|---------|-----------|
| Navigator grid cells | `QuestionNavigator.jsx:~27` | `w-10 h-10` | `w-11 h-11` |
| Navigator toggle | `QuestionNavigator.jsx:~122` | no min-h | add `py-3 px-2 min-h-[44px]` |
| Navigator close (x) | `QuestionNavigator.jsx:~165` | no padding | add `p-2 min-h-[44px] min-w-[44px] flex items-center justify-center` |
| Back button | `QuestionNavigator.jsx:~112` | `py-2` | `py-3` |
| Next button | `QuestionNavigator.jsx:~135` | `py-2` | `py-3` |
| Review button | `QuestionNavigator.jsx:~142` | `py-2` | `py-3` |
| Begin/Resume button | `InstructionScreen.jsx:~99` | `py-2` | `py-3` |
| Cancel button | `InstructionScreen.jsx:~93` | `py-2` | `py-3` |
| Flag button | `APTestSession.jsx:~581` | `py-2` | `py-3` |
| Hamburger menu | `APTestSession.jsx:~498` | `w-8 h-8` | `w-11 h-11` |
| Strikethrough button | `AnswerInput.jsx:~132` | `p-2` | `p-3` (or `min-h-[44px] min-w-[44px]`) |

**Layout safety (confirmed):** `w-11` cells × 6-col grid at 327px = 304px, no overflow. `py-3` on nav bar adds 8px total height — negligible.

**Verify:** On 375x667 viewport, all interactive buttons ≥ 44px in both dimensions.

---

### RFIX-9: "Return to Questions" landing position (new finding)

**Source:** B14C-RETEST-v2 FINDING-B14C-001 (Medium)

**Root Cause:** `handleReturnFromReview()` sets `setView('testing')` without resetting question position. The student always lands on Q15 (last question before Review) regardless of what they were working on.

**Impact:** Confusing UX — student expects to return to their last-worked question, but always lands on Q15.

**File:** `src/apBoost/pages/APTestSession.jsx`

**Solution:**
```jsx
// Add state:
const [preReviewQuestionIndex, setPreReviewQuestionIndex] = useState(0)

// In handleGoToReview:
const handleGoToReview = () => {
  setPreReviewQuestionIndex(position.questionIndex)
  setView('review')
}

// In handleReturnFromReview:
const handleReturnFromReview = () => {
  setView('testing')
  goToQuestion(preReviewQuestionIndex)
}
```

**Verify:** Answer Q1-Q15 → navigate to Q7 → open Review → "Return to Questions" → should land on Q7 (not Q15).

---

### RFIX-10: DuplicateTabModal on reload after browser crash (timing issue)

**Source:** B14C-RETEST-v2 FINDING-B14C-003 (Medium)

**Root Cause:** After an unexpected browser close, the next browser opening the same test shows `DuplicateTabModal` because the heartbeat takeover check fires before the BroadcastChannel 1-second auto-claim timeout completes. No other tab is actually open — the previous session is orphaned.

**Impact:** Unnecessary friction for students resuming after a crash. Modal is dismissable but shouldn't appear.

**File:** `src/apBoost/hooks/useHeartbeat.js`

**Solution:** The `suppressTakeoverRef` mechanism should suppress takeover detection for the first 2 seconds after mount, giving the BroadcastChannel auto-claim flow time to complete:
```js
// At top of hook:
const suppressTakeoverRef = useRef(true)

useEffect(() => {
  const timer = setTimeout(() => {
    suppressTakeoverRef.current = false
  }, 2000)
  return () => clearTimeout(timer)
}, [])

// In heartbeat check, guard takeover detection:
if (suppressTakeoverRef.current) return // Skip takeover check during startup
```

Also consider: if `lastHeartbeat` is older than heartbeat interval (e.g., >30s stale), treat as abandoned and skip takeover modal.

**Verify:** Start test, wait 30s → close browser entirely → open new browser to same URL → no DuplicateTabModal → test resumes cleanly.

---

## Summary Table

| ID | Priority | Description | File(s) | Source Findings |
|----|----------|-------------|---------|-----------------|
| RFIX-1 | HIGH | Move `scheduleFlush` declaration before first reference (latent hazard) | `useOfflineQueue.js` | B14C-R001, B14D-R005, B14E-R001, B14H-R003 |
| RFIX-2 | HIGH | Wire `onSessionQuery: flushQueue` in useTestSession | `useTestSession.js` | B14H-R001 |
| RFIX-3 | HIGH | SPA nav guard via popstate (remove useBlocker) | `APTestSession.jsx` | B14D-R002, B14F-R002, B14H-R002 |
| RFIX-4 | HIGH | FRQ "Change submission type" link + discard warning | `APTestSession.jsx` | B14D-R001 |
| RFIX-5 | HIGH | FRQ textarea scrollIntoView on mobile keyboard | `FRQTextInput.jsx` | B14F-R001 |
| RFIX-6 | MEDIUM | Submit confirmation modal for final section | `APTestSession.jsx` | B14B-R002 |
| RFIX-7 | MEDIUM | ReviewScreen timer display | `ReviewScreen.jsx` | B14B-R001 |
| RFIX-8 | MEDIUM | Touch targets ≥ 44px (batch — 11 elements) | 4 files | B14F-R003, B14D-R003/R004 |
| RFIX-9 | MEDIUM | "Return to Questions" landing position | `APTestSession.jsx` | B14C-v2-001 |
| RFIX-10 | MEDIUM | DuplicateTabModal on reload after crash (timing) | `useHeartbeat.js` | B14C-v2-003 |

---

## Recommended Implementation Order

**Phase 1 — Blockers & structural fixes:**
1. **RFIX-1** (scheduleFlush reorder — eliminates TDZ crash risk)

**Phase 2 — Data integrity & session safety:**
2. **RFIX-2** (wire flush-on-query — 1 line)
3. **RFIX-3** (popstate nav guard — replaces broken useBlocker)

**Phase 3 — Feature completions:**
4. **RFIX-4** (FRQ change submission type)
5. **RFIX-5** (FRQ textarea scroll)
6. **RFIX-6** (submit confirmation modal)
7. **RFIX-7** (ReviewScreen timer)

**Phase 4 — Mobile & UX polish:**
8. **RFIX-8** (touch targets batch)
9. **RFIX-9** (review return position)
10. **RFIX-10** (heartbeat startup suppression)

---

## Key Technical Notes

1. **`useBlocker` is INCOMPATIBLE with this app.** The app uses `BrowserRouter` from `react-router-dom`. `useBlocker` requires `createBrowserRouter` (data router API). Any existing `useBlocker` import MUST be removed. Use `popstate` + `history.pushState` instead.

2. **`scheduleFlush` declaration order matters.** JavaScript `const` via `useCallback` is NOT hoisted. Any reference in a dependency array before the declaration causes a TDZ error. Moving the declaration before all references is the permanent fix.

3. **Commit fixes before running audit agents.** The previous round's fixes were lost because agents modified files with uncommitted changes. Always commit after applying fixes.
