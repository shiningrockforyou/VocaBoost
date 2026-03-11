# B14D Retest — All Edits Made

**Date:** 2026-03-12
**Trigger:** B14D-retest audit found 5 issues (RETEST-001 through RETEST-005)
**Files changed:** 3

---

## File 1: `src/apBoost/pages/APTestSession.jsx`

### Edit 1 — Import `useRef`
**Line 1** | Finding: RETEST-002 (SPA back-button guard needs a ref)

```diff
-import { useState, useEffect, useCallback } from 'react'
+import { useState, useEffect, useCallback, useRef } from 'react'
```

---

### Edit 2 — Add `pendingFRQChoice` state
**Line 56** | Finding: B14D-002 (two-step FRQ confirmation)

Added new state variable for tracking which FRQ card is selected before confirmation:

```diff
  const [frqSubmissionType, setFrqSubmissionType] = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState([])
+ const [pendingFRQChoice, setPendingFRQChoice] = useState(null) // For two-step confirmation
```

---

### Edit 3 — Guard `handleBegin` against `isInvalidated`
**Line 194** | Finding: Defensive guard (DuplicateTabModal on instruction screen)

```diff
  const handleBegin = async () => {
+   if (isInvalidated) return // Guard: DuplicateTabModal should block, but defensive
    await startTest()
    setView('testing')
  }
```

---

### Edit 4 — SPA back-button guard (popstate approach)
**After `handleBegin`** | Finding: RETEST-002

Added state, ref, effect, and two handler functions. Uses `popstate` + `history.pushState` instead of `useBlocker` (which requires data router, not legacy `BrowserRouter`).

```jsx
// SPA navigation guard — prevent accidental Back button during test
const [showLeaveModal, setShowLeaveModal] = useState(false)
const blockerPendingRef = useRef(false)

useEffect(() => {
  if (status !== SESSION_STATUS.IN_PROGRESS || view !== 'testing') return

  // Push a dummy history entry so browser back triggers popstate
  window.history.pushState({ apTestGuard: true }, '')

  const handlePopState = (e) => {
    if (blockerPendingRef.current) return
    blockerPendingRef.current = true
    setShowLeaveModal(true)
  }

  window.addEventListener('popstate', handlePopState)
  return () => {
    window.removeEventListener('popstate', handlePopState)
  }
}, [status, view])

const handleLeaveStay = () => {
  // Re-push guard entry and close modal
  window.history.pushState({ apTestGuard: true }, '')
  blockerPendingRef.current = false
  setShowLeaveModal(false)
}

const handleLeaveConfirm = () => {
  blockerPendingRef.current = false
  setShowLeaveModal(false)
  navigate('/ap')
}
```

**How it works:**
1. When `status === IN_PROGRESS && view === 'testing'`, pushes a dummy history entry
2. Browser back pops that entry, triggering `popstate` → shows "Leave Test?" modal
3. "Stay" re-pushes the guard entry; "Leave Test" navigates to `/ap`

---

### Edit 5 — Add `handleChangeFRQType` function
**After `handleFRQChoice`** | Finding: RETEST-001

```jsx
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

**Behavior:**
- Checks if any FRQ answer textarea has content
- If yes, shows `window.confirm` with discard warning
- If user cancels, stays on current view
- If user confirms (or no answers exist), resets to FRQ choice screen

---

### Edit 6 — DuplicateTabModal on instruction screen
**Inside `view === 'instruction'` render** | Finding: Defensive (audit found modal was missing here)

```diff
  if (view === 'instruction') {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
+       {isInvalidated && (
+         <DuplicateTabModal
+           onTakeControl={handleTakeControl}
+           onGoToDashboard={handleGoToDashboard}
+         />
+       )}
        <InstructionScreen .../>
      </div>
    )
  }
```

---

### Edit 7 — FRQ choice screen: two-step confirmation
**Inside `view === 'frqChoice'` render** | Finding: B14D-002

Changed card buttons from directly calling `handleFRQChoice` to setting `pendingFRQChoice` (selection highlight). Added conditional "Confirm & Continue" button.

**Card buttons changed:**
```diff
-onClick={() => handleFRQChoice(FRQ_SUBMISSION_TYPE.TYPED)}
-className="p-6 rounded-[--radius-card] border-2 border-border-default hover:border-brand-primary ..."
+onClick={() => setPendingFRQChoice(FRQ_SUBMISSION_TYPE.TYPED)}
+className={`p-6 rounded-[--radius-card] border-2 ... ${
+  pendingFRQChoice === FRQ_SUBMISSION_TYPE.TYPED
+    ? 'border-brand-primary bg-brand-primary/5'
+    : 'border-border-default hover:border-brand-primary'
+}`}
```

(Same pattern for the Handwritten card.)

**New confirm button added after the grid:**
```jsx
{pendingFRQChoice && (
  <div className="mt-6 text-center">
    <button
      onClick={() => {
        handleFRQChoice(pendingFRQChoice)
        setPendingFRQChoice(null)
      }}
      className="bg-brand-primary text-brand-text px-6 py-2.5 rounded-[--radius-button] font-medium hover:opacity-90 transition-opacity"
    >
      Confirm &amp; Continue
    </button>
  </div>
)}
```

---

### Edit 8 — Pass `timeRemaining` to ReviewScreen
**Inside `view === 'review'` render** | Finding: Already in linter-applied version, was missing

```diff
  <ReviewScreen
    ...
    isFinalSection={...}
+   timeRemaining={timeRemaining}
  />
```

---

### Edit 9 — SPA leave modal in main test interface
**After `<SubmitProgressModal>`, before `<header>`** | Finding: RETEST-002

```jsx
{showLeaveModal && (
  <div className="fixed inset-0 z-50">
    <div className="absolute inset-0 bg-black/50" />
    <div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-[--radius-card] p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-2">Leave Test?</h3>
      <p className="text-text-secondary mb-4">Your progress is saved, but the timer will keep running.</p>
      <div className="flex gap-3">
        <button onClick={handleLeaveStay} className="flex-1 py-3 rounded-[--radius-button] border ...">
          Stay
        </button>
        <button onClick={handleLeaveConfirm} className="flex-1 py-3 rounded-[--radius-button] bg-error text-white ...">
          Leave Test
        </button>
      </div>
    </div>
  </div>
)}
```

---

### Edit 10 — Hamburger menu touch target
**Header hamburger button** | Finding: RETEST-003

```diff
-className="w-8 h-8 flex items-center justify-center ..."
+className="w-11 h-11 flex items-center justify-center ..."
```

32px → 44px (WCAG 2.5.8 minimum touch target)

---

### Edit 11 — "Change submission type" link in header
**After section label `<span>`** | Finding: RETEST-001

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

Only visible when in FRQ section and a submission type has been chosen.

---

### Edit 12 — Flag button touch target
**Flag for Review button** | Finding: RETEST-004

```diff
-className={`flex items-center gap-2 px-3 py-2 rounded-[--radius-button] ...`}
+className={`flex items-center gap-2 px-3 py-3 rounded-[--radius-button] ...`}
```

~37px → ~44px height

---

## File 2: `src/apBoost/hooks/useOfflineQueue.js`

### Edit 1 — Reorder `scheduleFlush` before `addToQueue` + add to deps
**Lines 195–254** | Finding: RETEST-005

**Before (abbreviated):**
```js
const addToQueue = useCallback(async (action) => {
  // ... uses scheduleFlush(...)
}, [sessionId, isOnline, isOpportunistic, updateQueueLength])

const scheduleFlush = useCallback((delay) => {
  // ...
}, [])
```

**After:**
```js
const scheduleFlush = useCallback((delay) => {
  // ...
}, [])

const addToQueue = useCallback(async (action) => {
  // ... uses scheduleFlush(...)
}, [sessionId, isOnline, isOpportunistic, updateQueueLength, scheduleFlush])
```

**Why:** `scheduleFlush` was a `const` declared after `addToQueue`. While this works at runtime (callback body isn't executed during render), having it in `addToQueue`'s dependency array would cause a TDZ error since deps are evaluated eagerly. Moving it before `addToQueue` fixes the forward reference and allows it to be a proper dependency.

---

## File 3: `change_action_log_ap.md`

Added 5 new log entries at the top of the table documenting all changes above.

---

## Summary

| # | File | Edit | Finding |
|---|------|------|---------|
| 1 | APTestSession.jsx | Import `useRef` | RETEST-002 |
| 2 | APTestSession.jsx | `pendingFRQChoice` state | B14D-002 |
| 3 | APTestSession.jsx | `isInvalidated` guard on `handleBegin` | Defensive |
| 4 | APTestSession.jsx | SPA back-button guard (popstate) | RETEST-002 |
| 5 | APTestSession.jsx | `handleChangeFRQType` function | RETEST-001 |
| 6 | APTestSession.jsx | DuplicateTabModal on instruction screen | Defensive |
| 7 | APTestSession.jsx | FRQ choice two-step confirmation | B14D-002 |
| 8 | APTestSession.jsx | `timeRemaining` prop to ReviewScreen | Parity |
| 9 | APTestSession.jsx | Leave Test modal markup | RETEST-002 |
| 10 | APTestSession.jsx | Hamburger w-8→w-11 | RETEST-003 |
| 11 | APTestSession.jsx | "Change submission type" link | RETEST-001 |
| 12 | APTestSession.jsx | Flag py-2→py-3 | RETEST-004 |
| 13 | useOfflineQueue.js | Reorder scheduleFlush + add to deps | RETEST-005 |
| 14 | change_action_log_ap.md | 5 new log entries | Bookkeeping |
