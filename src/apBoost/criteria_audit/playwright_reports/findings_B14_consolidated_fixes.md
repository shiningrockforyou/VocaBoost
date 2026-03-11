# B14 Consolidated Fix Plan

> Generated 2026-03-11 from findings B14A through B14H (excluding B14F — still running).
> Cross-referenced against `AP_BOOST_TRACKER.md` deferred items.

---

## Already Fixed (This Session or Prior)

These findings have been verified as resolved in the current codebase:

| Finding | Description | Fix Evidence |
|---------|-------------|--------------|
| B14A-001 | NAVIGATION reconciliation in reconcileQueue | `useTestSession.js` — NAVIGATION item handling added |
| B14A-002 | DuplicateTabModal on new session (heartbeat race) | `useHeartbeat.js` — suppressTakeoverRef starts true, clears after 2s |
| B14A-003 | Flagged questions missing from result doc / report card | `apScoringService.js:248` saves flaggedQuestions; `APReportCard.jsx:575` renders section |
| B14A-004 | Login redirect to / not /ap for AP students | `Login.jsx` — email domain check for @apboost.test redirect |
| B14A-005 | AnswerInput missing ARIA roles | `AnswerInput.jsx` — role="radio"/"checkbox", aria-checked added |
| B14A-007 | flatNavigationItems duplicate entries | `useTestSession.js` — seenQuestionIds + seenLabels dedup |
| B14B-LIVE-001 | Letter badge invisible when selected (bg-white/20) | `AnswerInput.jsx:107` — now uses `bg-white text-brand-primary` |
| B14G-003 / B14B-NEW-001 / B14D-003 / B14E-002 | `code.startsWith is not a function` | `logError.js:13` — now uses `String(error?.code \|\| '')` |
| B14A-006 | Review screen regex mismatch | Not an app bug — test script regex issue |
| B14B-LIVE-004 | FRQ max points shows 0 | Resolved — shows --/18 correctly in live run |
| B14B-LIVE-006 | Timer not visible on report card | Not a bug — timer correctly absent after submission |
| B14B-LIVE-008 | FRQ sub-question answer ordering | Resolved — correct order in live run |
| B14H-005 | Login redirect (duplicate of B4-006) | Covered by B14A-004 fix |

---

## Deferred (Per AP_BOOST_TRACKER.md)

These findings fall under existing deferred categories and should NOT be fixed now:

| Finding | Description | Deferred Category | Reason |
|---------|-------------|-------------------|--------|
| B14B-LIVE-003 | FRQ nav shows "Question X of 7" — should say "Part X of 7" | Design Overhaul | Label change is part of broader UX polish pass |
| B14B-LIVE-005 | Domain bar colors — 0% domains have no visual bar | Design Overhaul | Color semantics part of design token audit |
| B14C-001 | "Return to Questions" lands at Q15 (not first unanswered) | Review Screen Layout Unification | Entire review screen navigation is deferred |
| B14C-002 | No visual indicator of changed answers in review grid | Review Screen Layout Unification | Review grid enhancement is deferred |
| B14G-007 | FRQ "Review →" label ambiguity | Design Overhaul | Button label polish |
| B14H-004 | DuplicateTabModal shows after Resume not before | Resolved by B14H-001 | Fix B14H-001 and this resolves automatically |

---

## FIX NOW — High Priority

### FIX-1: Stale closure in useOfflineQueue.js (B14G-001)

**Root Cause:** `scheduleFlush` has `[]` deps and captures the initial `flushQueue` reference. After `isOnline` changes, `scheduleFlush` still calls the stale `flushQueue` with `isOnline=false` baked in.

**Impact:** Offline answers partially fail to sync after network restore. 2 of 8 items stuck in IndexedDB after 8 seconds in audit.

**File:** `src/apBoost/hooks/useOfflineQueue.js`

**Solution:**
```js
// Add ref that always points to latest flushQueue
const flushQueueRef = useRef(flushQueue)
useEffect(() => { flushQueueRef.current = flushQueue }, [flushQueue])

// Modify scheduleFlush to use ref indirection
const scheduleFlush = useCallback((delay) => {
  if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current)
  flushTimeoutRef.current = setTimeout(() => {
    flushQueueRef.current()  // always calls latest version
  }, delay)
}, [])  // [] is now correct — ref breaks the stale capture

// Also fix handleOnline to clear pending timeout before scheduling:
const handleOnline = () => {
  setIsOnline(true)
  retryCountRef.current = 0
  setIsOpportunistic(false)
  if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current)
  flushTimeoutRef.current = null
  scheduleFlush(500)
}
```

**Verify:** Block Firestore, answer Q6-Q8, restore network, wait 5s — IndexedDB pending count must reach 0.

---

### FIX-2: reconcileQueue uses timestamps instead of content comparison (B14G-002)

**Root Cause:** `reconcileQueue` compares `item.localTimestamp` against `session.lastAction`. A partial flush updates `lastAction` but doesn't delete all items. On resume, items created before `lastAction` but NOT actually flushed are incorrectly classified as stale and deleted — permanent data loss.

**Impact:** Q7-Q12 answers permanently lost after offline+resume cycle. Review screen shows "Answered: 9/15" when all 15 were answered.

**File:** `src/apBoost/hooks/useTestSession.js` — `reconcileQueue` function

**Solution:** Replace timestamp-based staleness with content-based comparison:
```js
const firestoreAnswers = existingSession.answers || {}
const firestoreFlags = new Set(existingSession.flaggedQuestions || [])

const staleItems = pendingItems.filter(item => {
  if (item.action === 'ANSWER_CHANGE') {
    const { questionId, value, subQuestionLabel } = item.payload
    const fsValue = subQuestionLabel
      ? firestoreAnswers[questionId]?.[subQuestionLabel]
      : firestoreAnswers[questionId]
    // Stale ONLY if Firestore already has this exact value
    return fsValue !== undefined && JSON.stringify(fsValue) === JSON.stringify(value)
  }
  if (item.action === 'FLAG_TOGGLE') {
    const { questionId, markedForReview } = item.payload
    return firestoreFlags.has(questionId) === markedForReview
  }
  // NAVIGATION, TIMER_SYNC — safe to discard if older than server
  return item.localTimestamp && item.localTimestamp < lastActionMs
})

// Fresh items = everything NOT stale
const freshItems = pendingItems.filter(item => !staleItems.includes(item))

// Apply fresh ANSWER_CHANGE items to local answers Map
freshItems.forEach(item => {
  if (item.action === 'ANSWER_CHANGE') {
    const { questionId, value, subQuestionLabel } = item.payload
    if (subQuestionLabel) {
      const existing = answers.get(questionId) || {}
      answers.set(questionId, { ...existing, [subQuestionLabel]: value })
    } else {
      answers.set(questionId, value)
    }
  }
})

// Delete stale items from IndexedDB, keep fresh for re-flush
await deleteItems(staleItems.map(i => i.id))
```

**Verify:** Block Firestore, answer Q6-Q8, partial flush, close page, reopen, Resume Test — all answers present. Review: "Answered: 15/15".

**Note:** This fix supersedes the B14A-001 partial fix (NAVIGATION handling) — the content-based approach handles all action types correctly.

---

### FIX-3: DuplicateTabModal not rendered on instruction screen (B14H-001)

**Root Cause:** `APTestSession.jsx` only renders `DuplicateTabModal` in the `view === 'testing'` branch. When Tab 2 loads and `view === 'instruction'`, the BroadcastChannel correctly sets `isInvalidated = true`, but no modal is rendered.

**Impact:** Tab 2 can click "Resume Test" and enter testing mode without any warning, creating a dual-tab session with answer race conditions.

**File:** `src/apBoost/pages/APTestSession.jsx`

**Solution:** Add DuplicateTabModal to the instruction view render block:
```jsx
// In the view === 'instruction' render block:
if (view === 'instruction') {
  return (
    <div className="min-h-screen bg-base">
      <APHeader />
      {isSessionInvalidated && (
        <DuplicateTabModal
          onTakeControl={handleTakeControl}
          onGoToDashboard={handleGoToDashboard}
        />
      )}
      <InstructionScreen
        test={test}
        existingSession={session}
        onBegin={handleBegin}
        onCancel={handleCancel}
      />
    </div>
  )
}
```

**Verify:** Tab 1 active test → Tab 2 same URL → Tab 2 shows DuplicateTabModal overlaying instruction screen. "Use This Tab" dismisses and allows interaction.

---

### FIX-4: Tab 1 not invalidated when Tab 2 enters testing (B14H-002)

**Root Cause:** When Tab 2 clicks "Resume Test" (bypassing modal due to B14H-001), `startTest()` is called but `takeControl()` is NOT called. `SESSION_CLAIMED` is never broadcast, so Tab 1 remains active.

**Impact:** Both tabs simultaneously active in testing mode — answer writes from both tabs race on the same Firestore document.

**File:** `src/apBoost/pages/APTestSession.jsx`

**Solution:** After fixing B14H-001, the modal blocks "Resume Test" interaction. As a **defensive guard** (per Agent H recommendation), add an early return — NOT a `takeControl()` call — to `handleBegin`:
```jsx
const handleBegin = async () => {
  if (isSessionInvalidated) return  // Guard: modal should be blocking, but just in case
  await startTest()
  setView('testing')
}
```

**Rationale (Agent H):** Calling `takeControl()` in `handleBegin` is the wrong defensive measure — it would mask bugs by silently claiming and proceeding, creating the exact concurrent-session situation we're preventing. An early return is cheap, zero-risk, and catches the impossible case without new behavior.

**Verify:** Tab 1 active → Tab 2 opens → Tab 2 sees DuplicateTabModal → Tab 2 clicks "Use This Tab" → Tab 2 clicks "Resume Test" → Tab 1 IMMEDIATELY shows DuplicateTabModal.

---

### FIX-5: Answer loss when Tab 2 bypasses modal (B14H-003)

**Root Cause:** When Tab 1 receives `SESSION_QUERY` from Tab 2, it responds with `SESSION_ACTIVE` immediately — but Tab 1's pending IndexedDB queue hasn't been flushed to Firestore yet. Tab 2 reads from Firestore (missing Tab 1's queued answers) and starts writing its own answers, overwriting Tab 1's.

**Impact:** Answers from Tab 1 permanently lost if queue hadn't flushed before Tab 2 took over.

**Files:** `src/apBoost/hooks/useDuplicateTabGuard.js`, `src/apBoost/hooks/useTestSession.js`

**Solution (Updated per Agent H response):** Respond with SESSION_ACTIVE immediately, then flush in background (fire-and-forget). Do NOT await the flush — human latency on Tab 2 (clicking "Use This Tab") gives seconds of margin.

```js
// In useDuplicateTabGuard.js — add onSessionQuery callback parameter:
export function useDuplicateTabGuard(sessionId, { onSessionQuery } = {}) {
  const onSessionQueryRef = useRef(onSessionQuery)
  useEffect(() => { onSessionQueryRef.current = onSessionQuery }, [onSessionQuery])

  // In channelRef.current.onmessage handler (stays synchronous):
  channelRef.current.onmessage = (event) => {
    const { type, token } = event.data
    if (type === 'SESSION_QUERY' && token !== instanceToken && isActiveRef.current) {
      // Respond IMMEDIATELY — don't let Tab 2's 1s timeout expire
      channelRef.current.postMessage({ type: 'SESSION_ACTIVE', token: instanceToken })
      // Flush queue in background — fire-and-forget
      // Human latency on Tab 2 (clicking "Use This Tab") gives us seconds of margin
      onSessionQueryRef.current?.()
    }
    // ... rest of handler
  }
}

// In useTestSession.js — pass flushQueue as onSessionQuery:
const { instanceToken, isInvalidated, takeControl } = useDuplicateTabGuard(
  session?.id, { onSessionQuery: flushQueue }
)
```

**Rationale (Agent H):** Firestore writes for 3-5 items take 100-400ms on good connections, but can exceed 1s on school WiFi. Awaiting would risk Tab 2's 1s claim timeout expiring prematurely. The fire-and-forget approach works because: (1) Tab 2 sees `SESSION_ACTIVE` immediately and shows the modal, (2) the student needs ~1-3s to click "Use This Tab", (3) by then the flush completes. Even in the edge case where the student clicks before flush completes, `takeControl()` only writes a token — it doesn't overwrite answers. Tab 1's in-flight flush still lands (dot-notation merge is additive).

**Verify:** Tab 1 answers Q1-Q3 quickly → Tab 2 opens immediately → Tab 2 takes control → Check Firestore: Q1-Q3 answers present. Fresh session resume: Q1-Q3 pre-answered.

---

### FIX-6: Submit race condition — queueLength uses stale React state (B14C-003)

**Root Cause:** `submitTest` checks `queueLength > 0` (React state) before flushing, but `queueLength` can be stale by one render cycle after a rapid answer change.

**Impact:** Theoretical — if student changes answer then immediately submits within ~50ms, the last answer could be lost from the submitted result.

**File:** `src/apBoost/hooks/useTestSession.js`

**Solution:** Replace React state check with direct IndexedDB query:
```js
// In submitTest, before createTestResult:
const pending = await getPendingItems()
if (pending.length > 0) {
  await flushQueue()
  // Double-check after flush
  const remaining = await getPendingItems()
  if (remaining.length > 0) {
    // Retry once more
    await flushQueue()
  }
}
```

`getPendingItems` is already available from `useOfflineQueue` destructuring.

**Verify:** Set answer for Q14, immediately (within 100ms) navigate to Review and click Submit. Firestore result document must contain Q14's final answer.

**Agent C confirmed:** This is purely from static code analysis — no live agent run reproduced data loss from this race. The 300ms debounce + human latency makes it extremely unlikely in practice. **Deprioritized to MEDIUM.** Still a correct hardening fix, but not urgent.

---

## FIX NOW — Medium Priority

### FIX-7: Timer not visible on review screen (B14B-LIVE-002)

**Root Cause:** `ReviewScreen.jsx` does not render `TestTimer`. When students enter Review to decide whether to submit, they can't see remaining time.

**Impact:** UX issue — students can't make informed submit-vs-continue decisions without seeing the timer.

**File:** `src/apBoost/components/ReviewScreen.jsx`

**Solution:** Pass timer props through to ReviewScreen and render TestTimer in the header area. The timer value is already available in `APTestSession.jsx` — pass `timeRemaining` and `totalTime` as props to ReviewScreen, then render a read-only timer display in the review header.

**Verify:** Answer all MCQ → click "Review →" → timer visible on review screen.

---

### FIX-8: No submit confirmation modal for FRQ (B14B-LIVE-007)

**Root Cause:** The MCQ section has a "Submit Section" flow, but the FRQ "Submit Test" button calls `submitTest()` immediately without a confirmation step.

**Impact:** Students can accidentally submit by fast-tapping. No undo.

**File:** `src/apBoost/pages/APTestSession.jsx` (or the FRQ review screen component)

**Solution:** Add a confirmation modal before `submitTest()` is called from the FRQ review. Use a simple state-driven modal:
```jsx
const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)

// In FRQ review's submit button:
onClick={() => setShowSubmitConfirm(true)}

// Modal:
{showSubmitConfirm && (
  <ConfirmModal
    title="Submit Test?"
    message="Are you sure? This action cannot be undone."
    onConfirm={() => { setShowSubmitConfirm(false); handleSubmitTest() }}
    onCancel={() => setShowSubmitConfirm(false)}
  />
)}
```

**Verify:** Complete FRQ → click "Submit Test" → confirmation modal appears → Cancel returns to review → Confirm submits.

---

### FIX-9: FRQ submission type is immediately final (B14D-002)

**Status: PARTIALLY IMPLEMENTED** (per Agent D response)

Agent D reports this has already been addressed with:
1. **Two-step confirmation** on the FRQ choice screen (select card to highlight → click "Confirm & Continue")
2. **"Change submission type" link** in the test header during FRQ sections

**Remaining work:** Add a discard warning when switching types after answers are entered. Per Agent D, option (a) — warn with confirm — fits the confused-student persona:
```js
const handleChangeFRQType = () => {
  // Check if any FRQ answers are non-empty
  const hasAnswers = /* check frqAnswers map for non-empty values */
  if (hasAnswers && !window.confirm('Switching will discard your typed answers. Continue?')) {
    return
  }
  setFrqSubmissionType(null)
  setView('frqChoice')
}
```

**Note:** Section progression is one-way by design. The FRQ type change is an exception within the FRQ section (view state reset), not a section-level back navigation.

**Verify:** Type answers in FRQ → click "Change submission type" → warning dialog appears → Cancel keeps answers → Confirm returns to choice screen.

---

### FIX-10: Heartbeat recovery too slow — sustained "Connection unstable" banner (B14G-004)

**Root Cause:** `MAX_FAILURES = 3` and `HEARTBEAT_INTERVAL = 15000ms` means it takes 45+ seconds of failures before "Connection unstable" appears, and similarly long to recover after network restore.

**Impact:** Students see "Connection unstable" for 15-30s after network actually recovers.

**File:** `src/apBoost/hooks/useHeartbeat.js`

**Solution:** Reduce `MAX_FAILURES` from 3 to 2, and add an immediate re-heartbeat on `visibilitychange` (already exists at line 127-138) and on `navigator.onLine` event:
```js
// Add online event listener in useHeartbeat
useEffect(() => {
  const handleOnline = () => {
    if (sessionId && instanceToken) {
      doHeartbeat()  // Immediate heartbeat on network restore
    }
  }
  window.addEventListener('online', handleOnline)
  return () => window.removeEventListener('online', handleOnline)
}, [sessionId, instanceToken, doHeartbeat])
```

**Verify:** Block Firestore for 20s → restore → "Reconnected" banner appears within 5s of restore.

---

### FIX-11: Instruction screen resume position info not visible (B14G-006)

**Status: DOWNGRADED — Needs live verification before implementing**

**Agent G response:** Most likely answer is (c) — the text was actually there but the automated script's text extraction missed it. The code logic is correct: `APTestSession.jsx` gates on `if (loading) return <LoadingSpinner />` before rendering `InstructionScreen`, so by the time `InstructionScreen` mounts, `session` is already populated. The condition `isResuming = existingSession?.status === IN_PROGRESS || === PAUSED` should evaluate correctly.

**Action:** Do a quick manual check or Playwright screenshot of the instruction screen after resume to confirm or dismiss. No code change until verified live.

**Verify:** Navigate to test URL with existing session → take screenshot → check if "Resume from: Section 1, Question X" is visible.

---

---

## FIX NOW — High Priority (from B14F — Mobile)

### FIX-12: FRQ textarea hidden when mobile keyboard opens (B14F-001)

**Root Cause:** At 375x350 viewport (keyboard open), the FRQ textarea is at y=462 — completely below the viewport. No auto-scroll on focus.

**Impact:** Mobile students can't see what they're typing in FRQ textareas without manually scrolling.

**File:** `src/apBoost/components/FRQTextInput.jsx`

**Solution:** Add scrollIntoView on textarea focus:
```jsx
useEffect(() => {
  const textarea = textareaRef.current
  if (!textarea) return
  const handleFocus = () => {
    // On mobile, when keyboard opens, scroll textarea into view
    setTimeout(() => {
      textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 300) // Delay for keyboard animation
  }
  textarea.addEventListener('focus', handleFocus)
  return () => textarea.removeEventListener('focus', handleFocus)
}, [])
```

**Verify:** Mobile viewport 375x667 → FRQ question → resize to 375x350 (keyboard) → tap textarea → page auto-scrolls so textarea is visible.

---

### FIX-13: Browser Back button silently leaves test — no SPA navigation guard (B14F-002)

**Root Cause:** `beforeunload` only fires on browser close/refresh, not on React Router SPA navigation. Pressing Back navigates to `/ap` with no warning, losing test progress.

**Impact:** Students can accidentally leave mid-test by pressing Back. No confirmation, no recovery.

**File:** `src/apBoost/pages/APTestSession.jsx`

**Solution (Updated per Agent F response):** Use `useBlocker` from `react-router` (NOT `react-router-dom` — v7 consolidated exports). Build inline confirmation modal (~15 lines JSX), matching TestSessionMenu's visual pattern:

```jsx
import { useBlocker } from 'react-router'

// Inside APTestSessionInner:
const blocker = useBlocker(
  ({ currentLocation, nextLocation }) =>
    status === SESSION_STATUS.IN_PROGRESS &&
    currentLocation.pathname !== nextLocation.pathname
)

// Inline confirmation modal (same slide-up pattern as TestSessionMenu):
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

**Note (Agent F):** `TestSessionMenu` has exit confirmation but it's coupled to its slide-up menu panel — can't reuse directly. The inline approach above matches the same visual pattern without coupling.

**Verify:** Start test → answer Q1 → press browser Back → confirmation modal appears → "Stay" keeps you on test → "Leave" navigates away.

---

## FIX NOW — Medium Priority (from B14F — Mobile)

### FIX-14: Touch targets below 44x44px WCAG minimum (B14F-003/004/005/006)

**Root Cause:** Multiple buttons across the test UI have heights of 20-40px, below the WCAG 2.5.5 minimum of 44x44px. Affects: navigator toggle (20px), navigator grid cells (40px), Begin/Resume button (40px), Back/Next buttons (36-37px), Flag button (37px), hamburger (32px), strikethrough (33px), navigator close button (13x24px).

**Impact:** Mobile users struggle to reliably tap these targets, especially the 20px navigator toggle.

**Files:** Multiple — `QuestionNavigator.jsx`, `InstructionScreen.jsx`, `APTestSession.jsx`, `AnswerInput.jsx`

**Layout safety (confirmed by Agent F):** No overflow at 375px. Navigator grid still fits 6 cells/row with `w-11` (304px < 327px available). Bottom nav bar grows only 8px (60px→68px). All changes are safe.

**Solution:** Batch padding increases across all affected components:

| Component | Current | Fix | File |
|-----------|---------|-----|------|
| Navigator toggle | no padding | Add `py-3 px-2 min-h-[44px]` | `QuestionNavigator.jsx:~122` |
| Navigator grid cells | `w-10 h-10` (40px) | Change to `w-11 h-11` (44px) | `QuestionNavigator.jsx:~27` |
| Navigator close button | 13x24px | Add `p-2 min-h-[44px] min-w-[44px]` | `QuestionNavigator.jsx:~165` |
| Begin/Resume button | `py-2` (40px) | Change to `py-3` (≥44px) | `InstructionScreen.jsx:~97` |
| Back/Next buttons | `py-2` (36-37px) | Change to `py-3` | `QuestionNavigator.jsx:~112,135` |
| Flag button | `py-2` (37px) | Change to `py-3` | `APTestSession.jsx:~599` |
| Hamburger menu | `w-8 h-8` (32px) | Change to `w-11 h-11` | `APTestSession.jsx:~507` |
| Strikethrough button | `p-2` (33px) | Change to `p-3` | `AnswerInput.jsx:~132` |

**Verify:** On 375x667 viewport, all interactive buttons measure ≥44px in both width and height.

---

### FIX-15: IDBDatabase "connection is closing" console errors on navigation (B14F-007)

**Root Cause:** When navigating away from the test page, the component unmounts while `getPendingItems` is mid-transaction on IndexedDB. The closing connection throws an unhandled error.

**Impact:** 2-4 console errors per navigation. No data loss, but noisy and could mask real errors.

**File:** `src/apBoost/hooks/useOfflineQueue.js`

**Solution:** Add mounted-ref guard and catch IDB closing errors:
```js
const mountedRef = useRef(true)
useEffect(() => {
  return () => { mountedRef.current = false }
}, [])

// In getPendingItems:
const getPendingItems = useCallback(async () => {
  if (!mountedRef.current) return []
  try {
    // ... existing IDB transaction code ...
  } catch (err) {
    if (!mountedRef.current || err.code === 11 || err.message?.includes('closing')) {
      return []  // Silently ignore — connection closed due to unmount
    }
    logError('useOfflineQueue.getPendingItems', {}, err)
    return []
  }
}, [...])
```

**Verify:** Navigate to test → answer Q1 → press Back → return to test → zero IDBDatabase errors in console.

---

## Summary Table (Updated with Agent Responses)

| ID | Priority | Status | Description | Source |
|----|----------|--------|-------------|--------|
| FIX-1 | HIGH | TODO | Stale closure in useOfflineQueue.js | B14G-001 |
| FIX-2 | HIGH | TODO | reconcileQueue content-based comparison | B14G-002 |
| FIX-3 | HIGH | TODO | DuplicateTabModal on instruction screen | B14H-001 |
| FIX-4 | HIGH | TODO | handleBegin early-return guard (1 line) | B14H-002 |
| FIX-5 | HIGH | TODO | Fire-and-forget flush on SESSION_QUERY | B14H-003 |
| FIX-12 | HIGH | TODO | FRQ textarea auto-scroll on mobile keyboard | B14F-001 |
| FIX-13 | HIGH | TODO | SPA navigation guard (useBlocker) | B14F-002 |
| FIX-6 | MEDIUM | TODO | submitTest uses stale queueLength (theoretical) | B14C-003 |
| FIX-7 | MEDIUM | TODO | Timer on review screen | B14B-LIVE-002 |
| FIX-8 | MEDIUM | TODO | FRQ submit confirmation modal | B14B-LIVE-007 |
| FIX-9 | MEDIUM | PARTIAL | FRQ type selection — add discard warning | B14D-002 |
| FIX-10 | MEDIUM | TODO | Heartbeat recovery speed | B14G-004 |
| FIX-14 | MEDIUM | TODO | Touch targets ≥44px (batch — 8 components) | B14F-003/4/5/6 |
| FIX-15 | MEDIUM | TODO | IDBDatabase closing error suppression | B14F-007 |
| FIX-11 | LOW | UNCONFIRMED | Instruction screen resume position | B14G-006 |

### Recommended Implementation Order

**Phase 1 — Data integrity (offline + sync):**
1. **FIX-1 + FIX-2** (together — stale closure + reconcileQueue)

**Phase 2 — Duplicate tab safety:**
2. **FIX-3 + FIX-4 + FIX-5** (together — modal on instruction screen + guard + flush-on-query)

**Phase 3 — Navigation safety:**
3. **FIX-13** (useBlocker — prevents accidental test exit via Back button)

**Phase 4 — Mobile usability:**
4. **FIX-12** (FRQ auto-scroll on focus — quick)
5. **FIX-14** (touch target batch — simple padding changes across 8 components)

**Phase 5 — UX polish:**
6. **FIX-7** (timer on review — quick)
7. **FIX-8** (submit confirmation modal — quick)
8. **FIX-15** (IDB error suppression — quick)
9. **FIX-6** (submit hardening — low-urgency)
10. **FIX-10** (heartbeat tuning)
11. **FIX-9** (FRQ discard warning — small enhancement)
12. **FIX-11** (verify live first — may be a non-issue)
