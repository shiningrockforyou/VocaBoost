# Fix Plan: Sections 7.1 to 7.7

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_7.1_to_7.7_criteria_audit.md

## Executive Summary
- Total Issues: 11
- ⚠️ Partial Implementations: 5
- ❌ Missing Features: 4
- ❓ Needs Investigation: 2 (VERIFIED during planning - no longer unknown)
- Estimated Complexity: Medium

---

## Issue 1: Next Button Should Show "Review" on Last Question (7.3)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Next disabled on last question (shows "Review" instead)
- **Current State:** Next button is disabled when `!canGoNext` but button text remains "Next →". Does NOT change to "Review" on last question.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/QuestionNavigator.jsx` (lines 125-137) - Next button implementation
  - `src/apBoost/pages/APTestSession.jsx` (lines 477-494) - Props passed to QuestionNavigator
  - `src/apBoost/hooks/useTestSession.js` (lines 303-309) - canGoNext logic
- **Current Implementation:** Button always shows "Next →" text. The `canGoNext` prop is false on last question, which disables the button but doesn't change its text or behavior.
- **Gap:** When on last question, button should show "Review" and clicking it should go to review screen, not be disabled.
- **Dependencies:** `onGoToReview` function already exists and is passed to QuestionNavigator.

### Fix Plan

#### Step 1: Add isLastQuestion prop to QuestionNavigator
**File:** `src/apBoost/components/QuestionNavigator.jsx`
**Action:** Modify
**Details:**
- Add new prop `isLastQuestion` to the component props destructuring (line 60-78)
- This will be computed by the parent based on `currentFlatIndex === flatNavigationItems.length - 1`

#### Step 2: Modify Next button to show "Review" and navigate to review
**File:** `src/apBoost/components/QuestionNavigator.jsx`
**Action:** Modify (lines 125-137)
**Details:**
- Change the button logic:
  ```jsx
  <button
    onClick={isLastQuestion ? onGoToReview : onNext}
    disabled={!canGoNext && !isLastQuestion}
    className={`...`}
  >
    {isLastQuestion ? 'Review' : 'Next →'}
  </button>
  ```
- Button should be enabled when `isLastQuestion` (even if `!canGoNext`)
- Button text changes based on `isLastQuestion`
- Button onClick calls `onGoToReview` when last question

#### Step 3: Pass isLastQuestion prop from APTestSession
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify (line 477-494)
**Details:**
- Add prop: `isLastQuestion={currentFlatIndex === flatNavigationItems.length - 1}`
- Or compute it as `!canGoNext` since that already indicates last question

### Verification Steps
1. Navigate to the last question in a section
2. Verify button shows "Review" instead of "Next →"
3. Click button and verify it opens review screen
4. Verify on non-last questions button still shows "Next →"

### Potential Risks
- **Risk:** None significant. Only UI text and click handler changes.
- **Mitigation:** The `onGoToReview` function already exists and works.

---

## Issue 2: Review Screen Header with Timer (7.4)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Header with section info and timer
- **Current State:** APHeader and ConnectionStatus shown at top, but dedicated section info header with timer is NOT part of ReviewScreen itself. Timer visible in parent page but not directly in review UI.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/ReviewScreen.jsx` (lines 57-63) - Current header area
  - `src/apBoost/pages/APTestSession.jsx` (lines 358-384) - Review screen rendering
  - `src/apBoost/components/TestTimer.jsx` - Existing timer component
- **Current Implementation:** ReviewScreen has a simple `h1` title "Review Your Answers" but no timer or section info in its header.
- **Gap:** Should display section info (like "Section 1 of 2: Multiple Choice") and timer countdown, matching the testing interface header.
- **Dependencies:** `TestTimer` component exists and works. ReviewScreen needs `timeRemaining` and section info props.

### Fix Plan

#### Step 1: Add props to ReviewScreen for timer and section info
**File:** `src/apBoost/components/ReviewScreen.jsx`
**Action:** Modify (line 34-44)
**Details:**
- Add props: `timeRemaining`, `sectionNumber`, `totalSections`, `sectionTitle`
- Import TestTimer component at top of file

#### Step 2: Add header bar with section info and timer
**File:** `src/apBoost/components/ReviewScreen.jsx`
**Action:** Modify (insert before line 58)
**Details:**
- Add header similar to test interface:
  ```jsx
  <div className="bg-surface border-b border-border-default px-4 py-3 flex items-center justify-between mb-6">
    <span className="text-text-secondary text-sm">
      Section {sectionNumber} of {totalSections}: {sectionTitle}
    </span>
    <TestTimer timeRemaining={timeRemaining} />
  </div>
  ```
- Reference pattern: `src/apBoost/pages/APTestSession.jsx` lines 403-411

#### Step 3: Pass props from APTestSession
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify (line 368-381)
**Details:**
- Add to ReviewScreen:
  ```jsx
  timeRemaining={timeRemaining}
  sectionNumber={position.sectionIndex + 1}
  totalSections={test?.sections?.length || 1}
  sectionTitle={currentSection?.title || 'Multiple Choice'}
  ```

### Verification Steps
1. Go to review screen
2. Verify header shows "Section X of Y: Title" on left
3. Verify timer countdown is visible on right
4. Verify timer continues counting down on review screen

### Potential Risks
- **Risk:** Timer display might look different from test interface
- **Mitigation:** Use exact same TestTimer component and similar container styling

---

## Issue 3: Flagged Questions List in Review Summary (7.4)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Summary section - Flagged for review: count + list
- **Current State:** Shows "Flagged: {flaggedCount}" but does NOT show list of flagged question numbers like it does for unanswered.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/ReviewScreen.jsx` (lines 45-56, 86-96) - Statistics and summary display
- **Current Implementation:**
  - Unanswered questions (line 51-56): Computes list and displays as "(Q4, Q6, etc.)"
  - Flagged questions (line 49, 95): Only shows count, no list
- **Gap:** Should show flagged question numbers similar to unanswered format.
- **Dependencies:** `flags` Set is already available; just need to compute list.

### Fix Plan

#### Step 1: Compute flagged question numbers list
**File:** `src/apBoost/components/ReviewScreen.jsx`
**Action:** Modify (after line 55, before line 57)
**Details:**
- Add computation similar to unansweredQuestions:
  ```jsx
  const flaggedQuestions = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => flags.has(q.id || q))
    .map(({ idx }) => idx + 1)
  ```

#### Step 2: Display flagged question list in summary
**File:** `src/apBoost/components/ReviewScreen.jsx`
**Action:** Modify (line 95)
**Details:**
- Change from:
  ```jsx
  <li>• Flagged: {flaggedCount}</li>
  ```
- To:
  ```jsx
  {flaggedCount > 0 ? (
    <li>
      • Flagged: {flaggedCount} (Q{flaggedQuestions.join(', Q')})
    </li>
  ) : (
    <li>• Flagged: 0</li>
  )}
  ```
- Follow same pattern as unanswered display (lines 90-93)

### Verification Steps
1. Flag several questions during test
2. Go to review screen
3. Verify flagged summary shows "Flagged: 3 (Q2, Q5, Q8)" format
4. Verify with no flags it shows "Flagged: 0"

### Potential Risks
- **Risk:** None. Simple display addition.
- **Mitigation:** Copy exact pattern from unanswered display.

---

## Issue 4: Reconnection Message and Auto-Dismiss (7.5, 7.7)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Shows "Reconnected - syncing..." briefly (2s) on recovery / Reconnected: "Reconnected - syncing..." (2s)
- **Current State:** Shows "Syncing your progress..." with spinner when `isSyncing`, but does NOT show "Reconnected" text and no automatic 2-second timeout for dismissal.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/ConnectionStatus.jsx` (lines 1-49) - Full component
  - `src/apBoost/hooks/useOfflineQueue.js` - Sets isSyncing/isFlushing state
- **Current Implementation:**
  - Line 7-9: Returns null when connected and not syncing
  - Line 12-37: Shows "Syncing your progress..." when `isSyncing`
  - No transition detection for disconnected → syncing state
  - No auto-dismiss timer
- **Gap:** Need to detect reconnection event and show different message; need 2s timer for auto-dismiss.
- **Dependencies:** Component receives `isConnected` and `isSyncing` props. Need internal state to track transitions.

### Fix Plan

#### Step 1: Add state for tracking previous connection and showing reconnected message
**File:** `src/apBoost/components/ConnectionStatus.jsx`
**Action:** Modify
**Details:**
- Add imports: `import { useState, useEffect, useRef } from 'react'`
- Add state:
  ```jsx
  const [wasDisconnected, setWasDisconnected] = useState(false)
  const [showReconnected, setShowReconnected] = useState(false)
  const dismissTimerRef = useRef(null)
  ```

#### Step 2: Add effect to track disconnection and trigger reconnected state
**File:** `src/apBoost/components/ConnectionStatus.jsx`
**Action:** Modify
**Details:**
- Add effect to detect transitions:
  ```jsx
  useEffect(() => {
    // Track when we become disconnected
    if (!isConnected) {
      setWasDisconnected(true)
    }

    // When we reconnect after being disconnected, show reconnected message
    if (isConnected && wasDisconnected && isSyncing) {
      setShowReconnected(true)
      setWasDisconnected(false)
    }

    // When syncing completes, start 2s timer to hide banner
    if (isConnected && !isSyncing && showReconnected) {
      dismissTimerRef.current = setTimeout(() => {
        setShowReconnected(false)
      }, 2000)
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current)
      }
    }
  }, [isConnected, isSyncing, wasDisconnected, showReconnected])
  ```

#### Step 3: Update syncing message to show "Reconnected - syncing..."
**File:** `src/apBoost/components/ConnectionStatus.jsx`
**Action:** Modify (lines 12-37)
**Details:**
- Change the syncing state text based on `showReconnected`:
  ```jsx
  if (isSyncing || showReconnected) {
    return (
      <div className="bg-info border-b border-info-border px-4 py-2 flex items-center justify-center gap-2">
        <svg className="animate-spin h-4 w-4 text-info-text" ...>
        <span className="text-info-text text-sm">
          {showReconnected ? 'Reconnected - syncing...' : 'Syncing your progress...'}
        </span>
      </div>
    )
  }
  ```

#### Step 4: Modify the return null condition to account for showReconnected
**File:** `src/apBoost/components/ConnectionStatus.jsx`
**Action:** Modify (line 7-9)
**Details:**
- Change condition to also check showReconnected:
  ```jsx
  if (isConnected && !isSyncing && !showReconnected) {
    return null
  }
  ```

### Verification Steps
1. Simulate network disconnection (offline mode in DevTools)
2. Verify "Connection unstable" banner appears
3. Restore connection
4. Verify banner changes to "Reconnected - syncing..."
5. After sync completes, verify banner auto-dismisses after 2 seconds
6. Verify normal syncing (without prior disconnect) shows "Syncing your progress..."

### Potential Risks
- **Risk:** Timer cleanup on unmount
- **Mitigation:** Use ref for timer and cleanup in effect return.
- **Risk:** Edge cases in state transitions
- **Mitigation:** Test disconnection/reconnection cycles thoroughly.

---

## Issue 5: Silent Retry Threshold Verification (7.7)

### Audit Finding
- **Status:** ❓ Unable to Verify → **VERIFIED**
- **Criterion:** Retrying (1-2 failures): No banner (silent retry)
- **Current State:** Need to verify hook implementation.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useHeartbeat.js` (lines 1-131)
- **Current Implementation:**
  - Line 9-10: `const MAX_FAILURES = 3`
  - Lines 70-76: Only sets `isConnected` to false when `newCount >= MAX_FAILURES`
  ```jsx
  setFailureCount(prev => {
    const newCount = prev + 1
    if (newCount >= MAX_FAILURES) {
      setIsConnected(false)
    }
    return newCount
  })
  ```
- **Gap:** NONE - This is correctly implemented! 1-2 failures remain silent, banner only shows at 3+ failures.

### Fix Plan
**No fix needed.** The implementation correctly:
1. Tracks failure count
2. Only sets `isConnected = false` when failures reach 3 or more
3. ConnectionStatus component only shows banner when `!isConnected`

### Verification Steps
1. Verify by code inspection (DONE)
2. Integration test: Block Firestore network, verify no banner on first 2 heartbeat failures
3. Verify banner appears after 3rd failure

---

## Issue 6: Disconnected 3+ Failures Threshold Verification (7.7)

### Audit Finding
- **Status:** ❓ Unable to Verify → **VERIFIED**
- **Criterion:** Disconnected (3+ failures): "Connection unstable" banner
- **Current State:** Banner displays when `!isConnected`, but threshold logic needed verification.

### Code Analysis
- Same as Issue 5.
- **Verified:** MAX_FAILURES = 3, banner triggers correctly.

### Fix Plan
**No fix needed.** Implementation is correct.

---

## Issue 7: Submit Progress Modal (7.7)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Submit pending: Modal with progress bar
- **Current State:** When submitting, the Submit button shows spinner (ReviewScreen.jsx:138-144) but no full modal with progress bar for "Syncing your answers..." flow.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/ReviewScreen.jsx` (lines 133-149) - Current submit button with spinner
  - `src/apBoost/components/DuplicateTabModal.jsx` - Modal pattern to follow
  - `src/apBoost/pages/APTestSession.jsx` (lines 181-192) - handleSubmit function
  - `src/apBoost/hooks/useTestSession.js` (lines 395-421) - submitTest implementation
- **Current Implementation:** Button shows inline spinner and "Submitting..." text. No modal overlay.
- **Gap:** Need full modal with progress indicator and message "Syncing your answers..."
- **Dependencies:** May need to track submit progress state in useTestSession hook.

### Fix Plan

#### Step 1: Create SubmitProgressModal component
**File:** `src/apBoost/components/SubmitProgressModal.jsx` (NEW FILE)
**Action:** Create
**Details:**
- Follow DuplicateTabModal pattern (lines 1-52)
- Structure:
  ```jsx
  export default function SubmitProgressModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Modal */}
        <div className="relative bg-surface rounded-[--radius-card] shadow-theme-xl p-6 md:p-8 max-w-md mx-4">
          {/* Spinner Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-info flex items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-info-text" .../>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-text-primary text-center mb-2">
            Submitting Your Test
          </h2>

          {/* Message */}
          <p className="text-text-secondary text-center mb-4">
            Syncing your answers...
          </p>

          {/* Progress bar (optional visual) */}
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-brand-primary animate-pulse" style={{ width: '60%' }} />
          </div>

          <p className="text-text-muted text-sm text-center mt-4">
            Please don't close this window.
          </p>
        </div>
      </div>
    )
  }
  ```

#### Step 2: Import and render in APTestSession
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify
**Details:**
- Import: `import SubmitProgressModal from '../components/SubmitProgressModal'`
- Add to review screen render (after line 366):
  ```jsx
  {isSubmitting && <SubmitProgressModal />}
  ```
- Also add to main test interface and handwritten mode screens

### Verification Steps
1. Complete test and click Submit
2. Verify modal appears with "Syncing your answers..."
3. Verify modal blocks interaction
4. Verify modal disappears when submission completes

### Potential Risks
- **Risk:** Modal may block ability to see error if submission fails
- **Mitigation:** Issue 8 handles failed submission with its own modal.

---

## Issue 8: Submit Failed Modal (7.7)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Submit failed: Modal with "Keep Trying" button
- **Current State:** No submit failure modal component found. The acceptance criteria specify an "Unable to sync" modal with "Keep Trying" button for failed submissions.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (lines 395-421) - submitTest catches errors, sets error state
  - `src/apBoost/pages/APTestSession.jsx` (lines 181-192) - handleSubmit, no retry logic
  - `src/apBoost/components/DuplicateTabModal.jsx` - Modal pattern to follow
- **Current Implementation:** On submit error, `setError(err.message)` is called and `setIsSubmitting(false)`. No dedicated failure modal.
- **Gap:** Need modal with retry button that appears after submission failure.
- **Dependencies:** Need to track submit error state separately from general error state.

### Fix Plan

#### Step 1: Create SubmitFailedModal component
**File:** `src/apBoost/components/SubmitFailedModal.jsx` (NEW FILE)
**Action:** Create
**Details:**
- Follow DuplicateTabModal pattern
- Structure:
  ```jsx
  export default function SubmitFailedModal({ onRetry, onCancel }) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Modal */}
        <div className="relative bg-surface rounded-[--radius-card] shadow-theme-xl p-6 md:p-8 max-w-md mx-4">
          {/* Error Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-error flex items-center justify-center">
              <span className="text-3xl">⚠</span>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-text-primary text-center mb-2">
            Unable to Sync
          </h2>

          {/* Message */}
          <p className="text-text-secondary text-center mb-2">
            We're having trouble submitting your test.
          </p>
          <p className="text-text-muted text-sm text-center mb-6">
            Your answers are saved locally. Please try again.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onCancel}
              className="px-6 py-2 rounded-[--radius-button] border border-border-default text-text-secondary hover:bg-hover transition-colors"
            >
              Return to Review
            </button>
            <button
              onClick={onRetry}
              className="px-6 py-2 rounded-[--radius-button] bg-brand-primary text-white font-medium hover:opacity-90 transition-opacity"
            >
              Keep Trying
            </button>
          </div>
        </div>
      </div>
    )
  }
  ```

#### Step 2: Add submit error state to APTestSession
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify
**Details:**
- Add state: `const [submitError, setSubmitError] = useState(false)`
- Modify handleSubmit to catch and set error:
  ```jsx
  const handleSubmit = async () => {
    try {
      setSubmitError(false)
      const frqData = frqSubmissionType === FRQ_SUBMISSION_TYPE.HANDWRITTEN
        ? { frqSubmissionType, frqUploadedFiles: uploadedFiles }
        : { frqSubmissionType: FRQ_SUBMISSION_TYPE.TYPED }

      const resultId = await submitTest(frqData)
      if (resultId) {
        navigate(`/ap/results/${resultId}`)
      } else {
        setSubmitError(true) // submitTest returned null on error
      }
    } catch (err) {
      setSubmitError(true)
    }
  }
  ```

#### Step 3: Import and render SubmitFailedModal
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify
**Details:**
- Import: `import SubmitFailedModal from '../components/SubmitFailedModal'`
- Add to review screen render:
  ```jsx
  {submitError && (
    <SubmitFailedModal
      onRetry={handleSubmit}
      onCancel={() => setSubmitError(false)}
    />
  )}
  ```

### Verification Steps
1. Simulate network error during submit (offline mode)
2. Verify failed modal appears with "Unable to sync"
3. Click "Keep Trying" and verify retry attempt
4. Click "Return to Review" and verify modal closes
5. Test successful retry after network restored

### Potential Risks
- **Risk:** Infinite retry loop if error persists
- **Mitigation:** Consider adding retry count limit and guidance to contact support after X attempts.

---

## Issue 9: Menu Button (7.2)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Menu button [≡]
- **Current State:** No hamburger menu button in the test session header. Header only shows section info and timer.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APTestSession.jsx` (lines 402-411) - Test session header
  - `src/apBoost/components/APHeader.jsx` - Dashboard header (different from test header)
- **Current Implementation:** Test session has its own inline header with just section info and timer. No menu button.
- **Gap:** Could add menu button for options like settings, help, or exit.
- **Priority:** Medium - not critical for core functionality.

### Fix Plan

#### Step 1: Add menu button and dropdown state
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify
**Details:**
- Add state: `const [menuOpen, setMenuOpen] = useState(false)`
- Add to header (before timer):
  ```jsx
  <div className="relative">
    <button
      onClick={() => setMenuOpen(!menuOpen)}
      className="p-2 rounded-[--radius-button] hover:bg-hover text-text-secondary"
      aria-label="Menu"
    >
      ≡
    </button>
    {menuOpen && (
      <div className="absolute right-0 top-full mt-1 bg-surface border border-border-default rounded-[--radius-card] shadow-theme-md py-1 min-w-[160px] z-50">
        <button
          onClick={() => { setMenuOpen(false); /* TODO: help action */ }}
          className="w-full px-4 py-2 text-left text-text-secondary hover:bg-hover text-sm"
        >
          Help
        </button>
        <button
          onClick={() => { setMenuOpen(false); navigate('/ap'); }}
          className="w-full px-4 py-2 text-left text-error-text hover:bg-hover text-sm"
        >
          Exit Test
        </button>
      </div>
    )}
  </div>
  ```

### Verification Steps
1. Verify ≡ button visible in header
2. Click and verify dropdown appears
3. Test each menu option

### Potential Risks
- **Risk:** "Exit Test" could cause data loss
- **Mitigation:** Could add confirmation modal before exit, or rely on beforeunload handler.

---

## Issue 10: Resizable Divider (7.1)

### Audit Finding
- **Status:** ❌ Missing (Optional)
- **Criterion:** Resizable divider between panels (optional)
- **Current State:** Grid layout has fixed 50/50 column split.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/QuestionDisplay.jsx` (lines 98-135) - HORIZONTAL layout
- **Current Implementation:** Uses `grid-cols-1 lg:grid-cols-2` for fixed equal columns.
- **Gap:** Optional feature for accessibility - allow users to resize stimulus vs question panels.
- **Priority:** Low - marked as optional in acceptance criteria.

### Fix Plan (Deferred)

This is marked as optional. Recommend deferring to a future enhancement sprint.

If implementing:
1. Use a library like `react-resizable-panels` or implement custom drag divider
2. Store user preference in localStorage
3. Add minimum width constraints (e.g., 20%-80% range)

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 1: Next Button "Review"** - Quick win, no dependencies, improves UX immediately
2. **Issue 3: Flagged Questions List** - Quick win, simple change, improves review screen
3. **Issue 2: Review Screen Timer** - Simple props addition, improves consistency
4. **Issue 4: Reconnection Message** - More complex state management, but important UX improvement
5. **Issue 7: SubmitProgressModal** - New component, needed before Issue 8
6. **Issue 8: SubmitFailedModal** - Depends on Issue 7 pattern, completes submit flow
7. **Issue 9: Menu Button** - Nice-to-have, independent
8. **Issue 10: Resizable Divider** - Optional, defer if time constrained

Issues 5 and 6 require no code changes (verified as working correctly).

---

## Cross-Cutting Concerns

### Spinner SVG Pattern
The same spinner SVG is duplicated across components. Consider extracting to a shared `Spinner` component:
- Used in: ConnectionStatus.jsx, ReviewScreen.jsx, SubmitProgressModal (new)
- Location: `src/apBoost/components/ui/Spinner.jsx`

### Modal Pattern
All modals (DuplicateTabModal, SubmitProgressModal, SubmitFailedModal) share common structure:
- Fixed overlay with backdrop
- Centered card with icon, title, message, actions
- Consider creating a reusable `Modal` wrapper component

---

## Notes for Implementer

1. **Design Tokens:** All new components MUST use design tokens from `/src/index.css`. Do not use raw Tailwind values.

2. **Testing Reconnection:** The reconnection flow (Issue 4) requires testing with actual network disconnection. Chrome DevTools offline mode is useful but may not fully replicate Firestore behavior.

3. **Submit Flow Timing:** The acceptance criteria mention showing failed modal after "30s+ failure". Current implementation doesn't have this timeout. Consider adding if needed:
   - Start timer when submission begins
   - Only show failed modal if either: error is thrown OR 30s passes without success

4. **Accessibility:** All new modals should trap focus and be keyboard navigable. The buttons should have appropriate `aria-label` attributes.

5. **Mobile Responsive:** Test all changes on mobile viewport. The header menu button dropdown especially needs mobile consideration.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/apBoost/components/QuestionNavigator.jsx` | Add `isLastQuestion` prop, modify Next button |
| `src/apBoost/components/ReviewScreen.jsx` | Add timer/section props, add flagged list, add header bar |
| `src/apBoost/components/ConnectionStatus.jsx` | Add reconnection state tracking and auto-dismiss |
| `src/apBoost/pages/APTestSession.jsx` | Pass new props, add menu, integrate submit modals |

## New Files to Create

| File | Purpose |
|------|---------|
| `src/apBoost/components/SubmitProgressModal.jsx` | Modal during submission |
| `src/apBoost/components/SubmitFailedModal.jsx` | Modal for failed submission |
