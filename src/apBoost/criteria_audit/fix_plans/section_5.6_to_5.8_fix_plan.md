# Fix Plan: Sections 5.6 to 5.8

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_5.6_to_5.8_criteria_audit.md

## Executive Summary
- Total Issues: 9
- ⚠️ Partial Implementations: 4
- ❌ Missing Features: 5
- ❓ Needs Investigation: 0
- Estimated Complexity: Medium-High

Section 5.6 (Duplicate Tab Detection) is fully implemented. All issues are in:
- Section 5.7 (Timer Behavior) - 4 issues
- Section 5.8 (Submit Flow) - 5 issues

---

## Issue 1: Timer Not Paused on Browser/Tab Close (5.7)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Browser/tab closed → Timer pauses (beforeunload)
- **Current State:** beforeunload only shows a warning message, doesn't pause timer or set PAUSED status

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (lines 208-220) - beforeunload handler only warns user
  - `src/apBoost/hooks/useDuplicateTabGuard.js` (lines 115-126) - beforeunload is empty
  - `src/apBoost/services/apSessionService.js` (lines 222-232) - completeSession exists but no pauseSession
  - `src/apBoost/hooks/useTimer.js` (lines 47-48) - pause() function exists
- **Current Implementation:**
  - `useTestSession.js:208-220` adds a beforeunload listener that only prevents immediate close with a warning
  - Timer state is saved every 30 seconds via queue (`handleTimerTick` lines 142-150)
  - No session status update to PAUSED on close
- **Gap:** Need to set session status to PAUSED and save timer state on beforeunload
- **Dependencies:**
  - `SESSION_STATUS.PAUSED` exists in `apTypes.js:37`
  - `updateSession` function exists in `apSessionService.js:112-122`

### Fix Plan

#### Step 1: Add pauseSession function to apSessionService.js
**File:** `src/apBoost/services/apSessionService.js`
**Action:** Add new function after completeSession (around line 233)
**Details:**
- Create `pauseSession(sessionId, sectionTimeRemaining)` function
- Sets status to `SESSION_STATUS.PAUSED`
- Saves current `sectionTimeRemaining` object
- Sets `pausedAt: serverTimestamp()`
- Reference pattern: `completeSession` function at lines 222-232

```javascript
export async function pauseSession(sessionId, sectionTimeRemaining) {
  try {
    await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
      status: SESSION_STATUS.PAUSED,
      sectionTimeRemaining,
      pausedAt: serverTimestamp(),
      lastAction: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error pausing session:', error)
    // Don't throw - this is best-effort during beforeunload
  }
}
```

#### Step 2: Update beforeunload handler in useTestSession.js
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify the beforeunload effect (lines 208-220)
**Details:**
- Import `pauseSession` from apSessionService
- Use `navigator.sendBeacon` for reliable async request during beforeunload
- Pause the timer and save state
- Note: sendBeacon doesn't support async Firestore directly, so use a fallback approach with synchronous flush attempt

```javascript
// beforeunload handler - pause session and save state
useEffect(() => {
  const handleBeforeUnload = (e) => {
    if (session?.id && status === SESSION_STATUS.IN_PROGRESS) {
      // Pause the timer
      timer.pause()

      // Build current timer state
      const timerState = currentSection?.id
        ? { [currentSection.id]: timer.timeRemaining }
        : {}

      // Use sendBeacon for reliable delivery (construct REST API call)
      // Or attempt synchronous Firestore update
      try {
        pauseSession(session.id, timerState)
      } catch {
        // Best-effort - can't block beforeunload
      }
    }

    // Still warn if queue has pending items
    if (queueLength > 0) {
      e.preventDefault()
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
      return e.returnValue
    }
  }

  window.addEventListener('beforeunload', handleBeforeUnload)
  return () => window.removeEventListener('beforeunload', handleBeforeUnload)
}, [session?.id, status, queueLength, timer, currentSection?.id])
```

#### Step 3: Handle PAUSED status on session resume
**File:** `src/apBoost/services/apSessionService.js`
**Action:** Modify `getActiveSession` function (lines 84-104)
**Details:**
- Include PAUSED status in the query (or do two queries)
- Return PAUSED sessions as resumable

```javascript
export async function getActiveSession(testId, userId) {
  try {
    // Check for IN_PROGRESS or PAUSED sessions
    const sessionsQuery = query(
      collection(db, COLLECTIONS.SESSION_STATE),
      where('testId', '==', testId),
      where('userId', '==', userId),
      where('status', 'in', [SESSION_STATUS.IN_PROGRESS, SESSION_STATUS.PAUSED])
    )
    // ... rest unchanged
  }
}
```

### Verification Steps
1. Start a test session, let timer run for a few seconds
2. Close the browser tab (click X or Ctrl+W)
3. Reopen the test - verify session shows as resumable
4. Check Firestore: session status should be PAUSED, sectionTimeRemaining should reflect last timer value
5. Resume session - verify timer continues from saved position

### Potential Risks
- **Risk:** Firestore writes during beforeunload are unreliable
  - **Mitigation:** Use navigator.sendBeacon with a Cloud Function endpoint as backup, or accept best-effort behavior since timer saves every 30s anyway
- **Risk:** User might close tab before 30s timer sync
  - **Mitigation:** The pauseSession call captures current timer state at close time

---

## Issue 2: Mobile Background Timer Pause (5.7)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** App backgrounded (mobile) >30s → Timer pauses
- **Current State:** No mobile-specific pause logic; timers are throttled by mobile browsers but not explicitly paused

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTimer.js` - timer logic, no visibility handling
  - `src/apBoost/hooks/useHeartbeat.js` (lines 101-113) - has visibilitychange listener pattern
- **Current Implementation:** Timer uses setInterval which mobile browsers throttle in background
- **Gap:** Need explicit visibility change detection with 30s threshold
- **Dependencies:** `useTimer` hook controls timer, needs visibility awareness

### Fix Plan

#### Step 1: Add visibility tracking to useTimer
**File:** `src/apBoost/hooks/useTimer.js`
**Action:** Add visibility change detection with 30s threshold
**Details:**
- Track when tab becomes hidden
- If hidden for >30s, pause timer
- On visible, check elapsed time and potentially pause
- Reference pattern: `useHeartbeat.js:101-113` for visibilitychange listener

```javascript
// Add to useTimer hook (after existing refs around line 24)
const hiddenAtRef = useRef(null)
const MOBILE_PAUSE_THRESHOLD = 30000 // 30 seconds

// Add new useEffect for visibility change (around line 104)
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAtRef.current = Date.now()
    } else if (document.visibilityState === 'visible') {
      if (hiddenAtRef.current) {
        const hiddenDuration = Date.now() - hiddenAtRef.current
        hiddenAtRef.current = null

        // If hidden for >30s (likely mobile background), pause timer
        if (hiddenDuration >= MOBILE_PAUSE_THRESHOLD && isRunning) {
          // Adjust time remaining to account for hidden period
          setTimeRemaining(prev => Math.max(0, prev - Math.floor(hiddenDuration / 1000)))
          // Could also trigger a callback to notify parent
        }
      }
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [isRunning])
```

#### Step 2: Add callback for background pause detection
**File:** `src/apBoost/hooks/useTimer.js`
**Action:** Add optional `onBackgroundPause` callback to timer options
**Details:**
- Allow parent to react when timer detects a long background period
- Useful for saving state or showing a notification

### Verification Steps
1. Start test on mobile device or mobile emulator
2. Switch to another app for 35+ seconds
3. Return to the test app
4. Verify timer has accounted for background time appropriately
5. Check console logs for visibility change events

### Potential Risks
- **Risk:** Desktop users might trigger this if they minimize browser
  - **Mitigation:** 30s threshold is long enough that normal desktop minimization won't trigger
- **Risk:** Mobile browsers vary in how they handle timers
  - **Mitigation:** This is a defensive measure on top of natural browser throttling

---

## Issue 3: User Pause Button Missing (5.7)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** User clicks "Pause" → Timer pauses (if enabled)
- **Current State:** `pause()` function exists in useTimer but no UI button in APTestSession

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTimer.js` (lines 47-48) - `pause()` function exists
  - `src/apBoost/pages/APTestSession.jsx` - no pause button in UI
  - `src/apBoost/components/TestTimer.jsx` - timer display component
- **Current Implementation:** Timer can be paused programmatically but no user control
- **Gap:** Need optional pause button (configurable per test)
- **Dependencies:** Test config might need `allowPause: boolean` field

### Fix Plan

#### Step 1: Add pauseEnabled flag to test sections schema
**File:** `src/apBoost/utils/apTypes.js` (or documentation only)
**Action:** Document that sections can have `allowPause: boolean` field
**Details:**
- Default to `false` for exam-like behavior
- Teachers can enable for practice tests

#### Step 2: Expose timer pause/resume from useTestSession
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Add pause/resume controls to return value (around line 493)
**Details:**
- Currently `timer` is internal; expose `pauseTimer` and `resumeTimer` callbacks
- Track paused state to update session status

```javascript
// Add to the hook
const pauseTimer = useCallback(() => {
  timer.pause()
  // Optionally update session status to PAUSED
  if (session?.id) {
    addToQueue({
      action: 'SESSION_PAUSE',
      payload: { sectionTimeRemaining: { [currentSection?.id]: timer.timeRemaining } }
    })
  }
}, [timer, session?.id, currentSection?.id, addToQueue])

const resumeTimer = useCallback(() => {
  timer.resume()
}, [timer])

// Add to return object (around line 495)
pauseTimer,
resumeTimer,
isTimerPaused: !timer.isRunning && !timer.isExpired,
```

#### Step 3: Add optional Pause button to APTestSession header
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Add conditional pause button in header (around line 410)
**Details:**
- Only show if `currentSection?.allowPause === true`
- Toggle between Pause and Resume
- Disable during submit or when invalidated

```jsx
{currentSection?.allowPause && (
  <button
    onClick={isTimerPaused ? resumeTimer : pauseTimer}
    disabled={isInvalidated || isSubmitting}
    className="px-3 py-1 text-sm rounded-[--radius-button] border border-border-default hover:bg-hover"
  >
    {isTimerPaused ? 'Resume' : 'Pause'}
  </button>
)}
```

### Verification Steps
1. Create a test with `allowPause: true` in section config
2. Start the test
3. Verify pause button appears
4. Click pause - verify timer stops
5. Click resume - verify timer continues
6. Verify tests without allowPause don't show the button

### Potential Risks
- **Risk:** Users might abuse pause to take unlimited time
  - **Mitigation:** Track total pause duration, limit number of pauses, or record for teacher review
- **Risk:** Pausing might interfere with other timing logic
  - **Mitigation:** Ensure heartbeat and session sync continue during pause

---

## Issue 4: Resume Prompt for Paused Sessions (5.7)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Return to paused session → Show "Resume" prompt
- **Current State:** InstructionScreen can show resume info, but PAUSED status is never set

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/InstructionScreen.jsx` (lines 66-73) - shows resume info for IN_PROGRESS
  - `src/apBoost/pages/APTestSession.jsx` (lines 262-268) - passes existingSession to InstructionScreen
- **Current Implementation:** InstructionScreen checks `existingSession?.status === SESSION_STATUS.IN_PROGRESS` only
- **Gap:** Also need to handle PAUSED status
- **Dependencies:** Fixes from Issue 1 (pauseSession) must be implemented first

### Fix Plan

#### Step 1: Update InstructionScreen to handle PAUSED status
**File:** `src/apBoost/components/InstructionScreen.jsx`
**Action:** Modify isResuming check (line 19)
**Details:**
- Check for both IN_PROGRESS and PAUSED
- Show appropriate message for PAUSED sessions

```javascript
// Line 19 - update the check
const isResuming = existingSession?.status === SESSION_STATUS.IN_PROGRESS ||
                   existingSession?.status === SESSION_STATUS.PAUSED

// Around line 66 - different message for PAUSED
{isResuming && existingSession && (
  <div className="bg-info rounded-[--radius-alert] p-4 mb-6">
    <p className="text-info-text-strong text-sm">
      {existingSession.status === SESSION_STATUS.PAUSED
        ? 'Your session was paused. Resume from:'
        : 'Resume from:'} Section {existingSession.currentSectionIndex + 1},
      Question {existingSession.currentQuestionIndex + 1}
      {existingSession.sectionTimeRemaining && (
        <span className="ml-2">
          (Time remaining: {formatTimeFromSeconds(existingSession.sectionTimeRemaining)})
        </span>
      )}
    </p>
  </div>
)}
```

#### Step 2: Update session resume to unpause
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** In startTest callback, set status back to IN_PROGRESS if PAUSED
**Details:**
- Currently `createOrResumeSession` returns existing session
- Need to update status from PAUSED to IN_PROGRESS when resuming

```javascript
// In startTest callback (around line 227)
const startTest = useCallback(async () => {
  if (!user || !testId) return

  try {
    setLoading(true)
    const newSession = await createOrResumeSession(testId, user.uid, assignmentId)
    setSession(newSession)

    // If resuming from PAUSED, update status to IN_PROGRESS
    if (newSession.status === SESSION_STATUS.PAUSED) {
      await updateSession(newSession.id, { status: SESSION_STATUS.IN_PROGRESS })
    }

    // Start timer
    timer.start()
  } catch (err) {
    // ...
  }
}, [user, testId, assignmentId, timer])
```

### Verification Steps
1. Start a test, answer some questions
2. Close the browser tab (triggering pause from Issue 1 fix)
3. Return to the test
4. Verify InstructionScreen shows "Your session was paused" message
5. Click Resume - verify session continues from saved position with correct timer

### Potential Risks
- **Risk:** Multiple session states could cause confusion
  - **Mitigation:** Clear state machine: NOT_STARTED → IN_PROGRESS ⇄ PAUSED → COMPLETED

---

## Issue 5: Submit Progress Modal Missing (5.8.2)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Show "Syncing your answers..." modal with progress
- **Current State:** Submit flushes queue silently with no user feedback

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APTestSession.jsx` (lines 182-192) - handleSubmit function
  - `src/apBoost/hooks/useTestSession.js` (lines 396-421) - submitTest function
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 173-266) - flushQueue function
  - `src/apBoost/components/DuplicateTabModal.jsx` - modal pattern reference
- **Current Implementation:** submitTest calls flushQueue but no UI feedback
- **Gap:** Need SyncingModal component with progress indicator
- **Dependencies:** Must track sync state (queueLength, isFlushing)

### Fix Plan

#### Step 1: Create SyncingModal component
**File:** `src/apBoost/components/SyncingModal.jsx` (NEW FILE)
**Action:** Create modal for sync progress
**Details:**
- Show during submit when queue is being flushed
- Display progress (items synced / total)
- Reference pattern: DuplicateTabModal.jsx for styling

```jsx
/**
 * SyncingModal - Modal shown during answer sync on submit
 */
export default function SyncingModal({
  isOpen,
  queueLength,
  isSyncing,
  syncFailed,
  onRetry,
  failedDuration = 0
}) {
  if (!isOpen) return null

  const showFailedState = syncFailed || failedDuration >= 30

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div className="relative bg-surface rounded-[--radius-card] shadow-theme-xl p-6 md:p-8 max-w-md mx-4">
        {showFailedState ? (
          // Failed state after 30s
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-error flex items-center justify-center">
                <span className="text-3xl">⚠</span>
              </div>
            </div>
            <h2 className="text-xl font-bold text-text-primary text-center mb-2">
              Unable to Sync
            </h2>
            <p className="text-text-secondary text-center mb-4">
              We're having trouble saving your answers.
            </p>
            <ul className="text-text-muted text-sm mb-6 space-y-2">
              <li>• Keep this tab open</li>
              <li>• Check your internet connection</li>
              <li>• We'll keep trying automatically</li>
            </ul>
            <div className="flex justify-center">
              <button
                onClick={onRetry}
                className="px-6 py-2 rounded-[--radius-button] bg-brand-primary text-white font-medium hover:opacity-90"
              >
                Keep Trying
              </button>
            </div>
          </>
        ) : (
          // Syncing state
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-info flex items-center justify-center animate-pulse">
                <span className="text-3xl">⏳</span>
              </div>
            </div>
            <h2 className="text-xl font-bold text-text-primary text-center mb-2">
              Syncing Your Answers...
            </h2>
            <p className="text-text-secondary text-center mb-4">
              Please wait while we save your work.
            </p>
            {queueLength > 0 && (
              <p className="text-text-muted text-sm text-center">
                {queueLength} item{queueLength !== 1 ? 's' : ''} remaining
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

#### Step 2: Track sync failure duration in useTestSession
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Add state for sync failure tracking
**Details:**
- Track when sync started and if it failed for 30s+
- Return these values for SyncingModal

```javascript
// Add state (around line 32)
const [syncStartedAt, setSyncStartedAt] = useState(null)
const [syncFailed, setSyncFailed] = useState(false)

// Modify submitTest (around line 396)
const submitTest = useCallback(async (frqData = null) => {
  if (!session?.id || isSubmitting) return null

  try {
    setIsSubmitting(true)
    timer.pause()

    // Track sync start
    if (queueLength > 0) {
      setSyncStartedAt(Date.now())
      setSyncFailed(false)

      try {
        await flushQueue()
      } catch (err) {
        // Track failure duration
        const elapsed = Date.now() - syncStartedAt
        if (elapsed >= 30000) {
          setSyncFailed(true)
          return null // Let modal handle retry
        }
        throw err
      }
      setSyncStartedAt(null)
    }

    const resultId = await createTestResult(session.id, frqData)
    return resultId
  } catch (err) {
    // ...
  }
}, [...])

// Add to return object
syncStartedAt,
syncFailed,
retrySunc: flushQueue,
```

#### Step 3: Integrate SyncingModal in APTestSession
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Add SyncingModal component
**Details:**
- Import and render SyncingModal
- Show when isSubmitting and queueLength > 0 or syncFailed

```jsx
// Add import
import SyncingModal from '../components/SyncingModal'

// Add to destructured hook values
syncStartedAt,
syncFailed,
retrySync,

// Add component (around line 395)
<SyncingModal
  isOpen={isSubmitting && (queueLength > 0 || syncFailed)}
  queueLength={queueLength}
  isSyncing={isSyncing}
  syncFailed={syncFailed}
  onRetry={retrySync}
  failedDuration={syncStartedAt ? Date.now() - syncStartedAt : 0}
/>
```

### Verification Steps
1. Start a test, answer several questions
2. Go offline (DevTools Network tab)
3. Click submit - verify SyncingModal appears with "Syncing Your Answers..."
4. Wait 30+ seconds offline - verify modal changes to "Unable to Sync" state
5. Go back online - click "Keep Trying" - verify sync completes

### Potential Risks
- **Risk:** Modal might block user from doing anything during sync
  - **Mitigation:** This is intentional during submit; user should wait for sync
- **Risk:** User might close tab during sync
  - **Mitigation:** beforeunload warning already prevents this

---

## Issue 6: Aggressive Flush Retry (5.8.2)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Aggressive flush: retry every 2s
- **Current State:** Uses exponential backoff (2s, 4s, 8s, 16s) instead of fixed 2s

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 255-262) - exponential backoff logic
- **Current Implementation:** `Math.pow(2, retryCountRef.current) * 1000` creates 2s, 4s, 8s, 16s delays
- **Gap:** During submit, should use aggressive fixed 2s retry
- **Dependencies:** Need to differentiate normal flush from submit flush

### Fix Plan

#### Step 1: Add aggressive flush mode to useOfflineQueue
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add optional `aggressive` parameter to flushQueue
**Details:**
- When aggressive=true, use fixed 2s retry
- When aggressive=false (default), use exponential backoff

```javascript
// Modify flushQueue signature (line 173)
const flushQueue = useCallback(async (aggressive = false) => {
  // ...existing code...

  // In catch block (around line 255)
  } catch (error) {
    logError('useOfflineQueue.flushQueue', { sessionId }, error)

    retryCountRef.current++
    if (retryCountRef.current < (aggressive ? 15 : 5)) {
      // Aggressive: fixed 2s retry; Normal: exponential backoff
      const delay = aggressive
        ? 2000
        : Math.pow(2, retryCountRef.current) * 1000
      scheduleFlush(delay, aggressive)
    }
  }
}, [sessionId, isFlushing, isOnline, updateQueueLength, scheduleFlush])

// Update scheduleFlush to pass aggressive flag
const scheduleFlush = useCallback((delay, aggressive = false) => {
  if (flushTimeoutRef.current) {
    clearTimeout(flushTimeoutRef.current)
  }
  flushTimeoutRef.current = setTimeout(() => {
    flushQueue(aggressive)
  }, delay)
}, [])
```

#### Step 2: Use aggressive flush in submitTest
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Call flushQueue with aggressive=true during submit
**Details:**

```javascript
// In submitTest (around line 407)
if (queueLength > 0) {
  await flushQueue(true) // aggressive retry
}
```

### Verification Steps
1. Start test, answer questions
2. Go offline
3. Submit test
4. Observe retry attempts in console - should retry every 2s, not exponential
5. Go online - verify sync completes

### Potential Risks
- **Risk:** Aggressive retry might hammer server
  - **Mitigation:** Only used during submit (single operation), limited to 15 retries (30s)

---

## Issue 7: "Unable to Sync" Modal After 30s (5.8.2)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** On failure for 30s+: show "Unable to sync" modal
- **Current State:** No modal shown after extended sync failure

### Code Analysis
- Covered by Issue 5 (SyncingModal component) - the modal switches to failed state after 30s

### Fix Plan
**Covered by Issue 5 implementation.** The SyncingModal component includes both syncing and failed states, switching after 30s.

### Verification Steps
See Issue 5 verification steps.

---

## Issue 8: "Unable to Sync" Modal Content (5.8.2)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** "Unable to sync" shows: keep tab open, check connection, keep trying

### Code Analysis
- Covered by Issue 5 (SyncingModal component) - includes these instructions

### Fix Plan
**Covered by Issue 5 implementation.** The SyncingModal failed state includes:
- "Keep this tab open"
- "Check your internet connection"
- "We'll keep trying automatically"

### Verification Steps
See Issue 5 verification steps.

---

## Issue 9: "Keep Trying" Button (5.8.2)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** [Keep Trying] button available

### Code Analysis
- Covered by Issue 5 (SyncingModal component) - includes Keep Trying button

### Fix Plan
**Covered by Issue 5 implementation.** The SyncingModal failed state includes a "Keep Trying" button that triggers `onRetry` callback.

### Verification Steps
See Issue 5 verification steps.

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 1: Timer Pause on Close** - Foundational, enables PAUSED status
   - Add `pauseSession` to apSessionService.js
   - Update beforeunload handler
   - Update `getActiveSession` to include PAUSED

2. **Issue 4: Resume Prompt for Paused Sessions** - Depends on Issue 1
   - Update InstructionScreen to handle PAUSED
   - Update startTest to unpause

3. **Issue 2: Mobile Background Timer Pause** - Independent
   - Add visibility change detection to useTimer

4. **Issue 3: User Pause Button** - Independent, lower priority
   - Expose pause/resume from useTestSession
   - Add optional UI button

5. **Issue 5: SyncingModal** - Independent, high priority
   - Create SyncingModal component
   - Track sync failure state
   - Integrate in APTestSession

6. **Issue 6: Aggressive Flush** - Should come with Issue 5
   - Add aggressive mode to flushQueue
   - Use in submitTest

7. **Issues 7-9:** Covered by Issue 5 implementation

---

## Cross-Cutting Concerns

### Session Status State Machine
Ensure consistent status transitions:
```
NOT_STARTED → IN_PROGRESS (on startTest)
IN_PROGRESS → PAUSED (on tab close / manual pause)
PAUSED → IN_PROGRESS (on resume)
IN_PROGRESS → COMPLETED (on submit)
PAUSED → COMPLETED (should not happen, but handle gracefully)
```

### Timer State Persistence
Timer state should be saved:
1. Every 30 seconds via queue (existing)
2. On pause (manual or automatic)
3. On tab close (best effort)

---

## Notes for Implementer

1. **beforeunload limitations:** Firestore writes during beforeunload are unreliable. Consider using a Cloud Function with `navigator.sendBeacon` as a backup, or accept that timer saves every 30s anyway.

2. **Mobile browser variations:** Different mobile browsers handle visibility and timers differently. Test on actual iOS Safari and Android Chrome devices.

3. **Test configuration:** The pause button feature requires test/section configuration. Document the `allowPause` field for test creators.

4. **Modal z-index:** Ensure SyncingModal has appropriate z-index to appear above other content (currently z-50 like DuplicateTabModal).

5. **Accessibility:** Add ARIA attributes to SyncingModal for screen readers (aria-modal, aria-labelledby, role="dialog").
