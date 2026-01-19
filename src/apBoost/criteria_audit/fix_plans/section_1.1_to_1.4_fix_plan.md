# Fix Plan: Sections 1.1 to 1.4

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_1.1_to_1.4_criteria_audit.md

## Executive Summary
- Total Issues: 14
- ⚠️ Partial Implementations: 11
- ❌ Missing Features: 3
- ❓ Needs Investigation: 0
- Estimated Complexity: Medium-High

---

## Issue 1: Timer Auto-Submit Not Implemented

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** When timer expires, section auto-submits
- **Current State:** `handleTimerExpire` callback exists but only logs "Timer expired, auto-submitting..." - actual auto-submit not implemented

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (lines 136-140) - handleTimerExpire callback
  - `src/apBoost/hooks/useTimer.js` (lines 84-89) - onExpire callback invocation
  - `src/apBoost/pages/APTestSession.jsx` (lines 182-192) - handleSubmit function
- **Current Implementation:** Timer detects expiration and calls onExpire callback, but the callback only logs
- **Gap:** Need to trigger actual submission logic when timer expires
- **Dependencies:** submitTest function, queue flush, navigation to results

### Fix Plan

#### Step 1: Implement auto-submit in handleTimerExpire
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- Replace console.log with actual auto-submit logic
- Call the existing `submitTest` function
- Handle the case where this is not the final section (should call submitSection instead)
- Add state tracking to prevent duplicate submissions

```javascript
// Pattern to follow:
const handleTimerExpire = useCallback(async () => {
  // Prevent duplicate submissions
  if (isSubmitting) return;

  // Check if this is the last section
  const isLastSection = currentSectionIndex >= (test?.sections?.length || 1) - 1;

  if (isLastSection) {
    // Auto-submit entire test
    const resultId = await submitTest();
    // Note: Navigation should happen in the component after submitTest returns
  } else {
    // Auto-submit just this section and move to next
    await submitSection();
  }
}, [isSubmitting, currentSectionIndex, test?.sections?.length, submitTest, submitSection]);
```

#### Step 2: Return autoSubmitTriggered flag from hook
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- Add state variable `autoSubmitTriggered`
- Set it to true when timer expires
- Return it from the hook for component to handle navigation

#### Step 3: Handle auto-submit navigation in component
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify
**Details:**
- Watch for `autoSubmitTriggered` flag
- Navigate to results page when test auto-submits
- Show transitional UI during auto-submission

### Verification Steps
1. Set timer to 10 seconds and let it expire - should auto-submit
2. Verify answers are saved before submission
3. Verify navigation to results page happens
4. Test with network offline when timer expires

### Potential Risks
- Race condition if user clicks submit at same time as timer expiring (mitigate with isSubmitting check)
- Queue may not be fully flushed before submission (ensure flushQueue is awaited)

---

## Issue 2: Timer Pause on Mobile Backgrounding

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Timer pauses on mobile when app backgrounded >30 seconds
- **Current State:** No visibility change detection for mobile backgrounding

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (lines 208-220) - beforeunload handler
  - `src/apBoost/hooks/useTimer.js` - No visibility change handling
- **Current Implementation:** Only beforeunload for tab close warning; no visibility API usage
- **Gap:** Need to detect when app goes to background and track duration
- **Dependencies:** Timer pause/resume functions already exist in useTimer

### Fix Plan

#### Step 1: Add visibility change detection in useTestSession
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Add new effect
**Details:**
- Add state to track when app was backgrounded
- Listen for visibilitychange event
- Calculate time elapsed when returning to foreground
- Pause timer and update session status if >30 seconds

```javascript
// Pattern to follow (add after beforeunload effect around line 220):
useEffect(() => {
  let backgroundedAt = null;
  const PAUSE_THRESHOLD_MS = 30000; // 30 seconds

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      backgroundedAt = Date.now();
    } else if (document.visibilityState === 'visible' && backgroundedAt) {
      const elapsed = Date.now() - backgroundedAt;
      backgroundedAt = null;

      if (elapsed > PAUSE_THRESHOLD_MS) {
        // Pause timer
        timer.pause();
        // Queue status update to PAUSED
        addToQueue({
          action: 'SESSION_STATUS',
          payload: { status: SESSION_STATUS.PAUSED, pausedAt: Date.now() }
        });
        // Could show a modal asking user if they want to resume
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [timer, addToQueue]);
```

#### Step 2: Add SESSION_STATUS action to offline queue
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Modify flushQueue switch statement
**Details:**
- Add case for SESSION_STATUS action
- Update session status in Firestore

```javascript
case 'SESSION_STATUS':
  updates.status = item.payload.status;
  if (item.payload.pausedAt) {
    updates.pausedAt = item.payload.pausedAt;
  }
  break;
```

#### Step 3: Add resume functionality
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Add resumeFromPause function
**Details:**
- Add function to resume timer and update status back to IN_PROGRESS
- Could be triggered by user action or automatically

### Verification Steps
1. On mobile, background app for >30 seconds, return - timer should be paused
2. Background for <30 seconds - timer should continue
3. Verify status is saved to Firestore as PAUSED
4. Test resume functionality

### Potential Risks
- visibilitychange may fire inconsistently across mobile browsers (test on iOS Safari, Chrome Android)
- User may lose track if paused unexpectedly (show clear UI indication)

---

## Issue 3: Timer Expiration While Offline Queues Auto-Submit

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Timer expiration while offline queues auto-submit action
- **Current State:** handleTimerExpire doesn't queue any actions

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (lines 136-140) - handleTimerExpire
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 201-225) - flushQueue switch
- **Current Implementation:** Timer expiration only logs; no queueing for offline scenario
- **Gap:** When offline and timer expires, need to queue a submit action that executes when back online
- **Dependencies:** Uses existing addToQueue infrastructure

### Fix Plan

#### Step 1: Queue auto-submit action in handleTimerExpire
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify handleTimerExpire
**Details:**
- When timer expires, queue an AUTO_SUBMIT action regardless of online status
- The actual submission will happen when queue flushes

```javascript
const handleTimerExpire = useCallback(() => {
  if (isSubmitting) return;

  const isLastSection = currentSectionIndex >= (test?.sections?.length || 1) - 1;

  // Queue the auto-submit action (works offline)
  addToQueue({
    action: 'AUTO_SUBMIT',
    payload: {
      isLastSection,
      sectionIndex: currentSectionIndex,
      expiredAt: Date.now(),
    }
  });

  // Set local state to show submission UI
  setAutoSubmitTriggered(true);
}, [isSubmitting, currentSectionIndex, test?.sections?.length, addToQueue]);
```

#### Step 2: Handle AUTO_SUBMIT in flushQueue
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Modify flushQueue switch statement
**Details:**
- Add case for AUTO_SUBMIT action
- This is more complex - may need to call apScoringService directly
- Consider: should this trigger full submission or just mark as needing submission?

```javascript
case 'AUTO_SUBMIT':
  // Mark session as pending submission
  updates.status = SESSION_STATUS.PENDING_SUBMIT;
  updates.autoSubmitExpiredAt = item.payload.expiredAt;
  break;
```

#### Step 3: Handle pending submission on reconnect
**File:** `src/apBoost/hooks/useTestSession.js` or `src/apBoost/pages/APTestSession.jsx`
**Action:** Add effect to detect PENDING_SUBMIT status
**Details:**
- When session loads with PENDING_SUBMIT status, complete the submission
- Show user that their test was auto-submitted due to timer expiring while offline

### Verification Steps
1. Go offline, let timer expire, go back online - should complete submission
2. Verify answers from before going offline are included
3. Test closing browser while offline and timer expired - should submit on next session load
4. Verify user sees clear messaging about what happened

### Potential Risks
- Complex state management for offline + timer expiration
- User might expect to continue but test is already submitted
- Queue order matters - ensure AUTO_SUBMIT processes after all answer changes

---

## Issue 4: Timer Pause on beforeunload

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Timer pauses when browser/tab closes (via beforeunload)
- **Current State:** Shows warning to user but doesn't actively pause timer or set status to PAUSED

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (lines 209-220) - beforeunload handler
- **Current Implementation:** Shows confirmation dialog if queue not empty
- **Gap:** Should also pause timer and queue status update
- **Dependencies:** Timer pause function exists, addToQueue available

### Fix Plan

#### Step 1: Pause timer and queue status on beforeunload
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify beforeunload handler
**Details:**
- Pause the timer immediately
- Queue a TIMER_SYNC with current time remaining
- Note: Can't do async operations in beforeunload, so just pause locally

```javascript
const handleBeforeUnload = (e) => {
  // Always pause timer when leaving
  timer.pause();

  // Try to sync current state (synchronous)
  if (session?.id && currentSection?.id) {
    // Note: We can't await here, but navigator.sendBeacon could work
    // For now, queue it - it will be in IndexedDB for next session
    addToQueue({
      action: 'TIMER_SYNC',
      payload: { sectionTimeRemaining: { [currentSection.id]: timer.timeRemaining } }
    });
  }

  if (queueLength > 0) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    return e.returnValue;
  }
};
```

#### Step 2: Consider using navigator.sendBeacon for reliable sync
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Optional enhancement
**Details:**
- sendBeacon is designed for this exact use case
- Could send to a Cloud Function endpoint

### Verification Steps
1. Navigate away from test page - timer state should be saved
2. Return to test - should resume from saved time
3. Close browser abruptly - next session should have correct time

### Potential Risks
- beforeunload is unreliable for async operations
- sendBeacon requires server endpoint changes
- Mobile browsers may not fire beforeunload consistently

---

## Issue 5: Flagged Questions Not Listed in Review Screen

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Flagged questions listed separately in Review Screen summary
- **Current State:** Only shows count ("Flagged: X") but doesn't list individual flagged question numbers like unanswered

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/ReviewScreen.jsx` (lines 49, 95) - flaggedCount and display
- **Current Implementation:** `flaggedCount` calculated correctly, but only displayed as count
- **Gap:** Should list individual question numbers like it does for unanswered
- **Dependencies:** Already has the flags Set and questions array

### Fix Plan

#### Step 1: Add flaggedQuestions list calculation
**File:** `src/apBoost/components/ReviewScreen.jsx`
**Action:** Modify
**Details:**
- Add calculation similar to unansweredQuestions
- Located after line 49 where flaggedCount is calculated

```javascript
// Add after line 49:
// Get flagged question numbers
const flaggedQuestions = questions
  .map((q, idx) => ({ q, idx }))
  .filter(({ q }) => flags.has(q.id || q))
  .map(({ idx }) => idx + 1);
```

#### Step 2: Update display to list flagged questions
**File:** `src/apBoost/components/ReviewScreen.jsx`
**Action:** Modify line 95
**Details:**
- Change from just showing count to showing list like unanswered

```jsx
// Change line 95 from:
<li>• Flagged: {flaggedCount}</li>

// To:
{flaggedCount > 0 && (
  <li>
    • Flagged: {flaggedCount} (Q{flaggedQuestions.join(', Q')})
  </li>
)}
```

### Verification Steps
1. Flag questions 1, 5, and 10
2. Go to review screen
3. Verify display shows "Flagged: 3 (Q1, Q5, Q10)"
4. Verify clickable question boxes still show flag icon

### Potential Risks
- Long list of flagged questions might overflow (could truncate with "..." if >10)
- Minor: styling consistency with unanswered list

---

## Issue 6: FLAG_TOGGLE Not Persisted via IndexedDB Queue

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Flag state survives browser refresh/crash (via IndexedDB queue)
- **Current State:** Queue case exists but comment says "Flags need special handling - we'd need to maintain the array" - not fully implemented

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 208-210) - FLAG_TOGGLE case is empty
  - `src/apBoost/services/apSessionService.js` (lines 150-176) - toggleQuestionFlag with read-modify-write pattern
- **Current Implementation:** FLAG_TOGGLE action is queued but flushQueue does nothing with it
- **Gap:** Need to implement array field update in flushQueue
- **Dependencies:** Firestore arrayUnion/arrayRemove could simplify this

### Fix Plan

#### Step 1: Implement FLAG_TOGGLE in flushQueue using arrayUnion/arrayRemove
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Modify flushQueue switch statement
**Details:**
- Use Firestore arrayUnion and arrayRemove operators for atomic updates
- Collect all flag toggles and process them

```javascript
// Add imports at top:
import { arrayUnion, arrayRemove } from 'firebase/firestore';

// Modify the switch case (around line 208):
case 'FLAG_TOGGLE': {
  const { questionId, markedForReview } = item.payload;
  if (markedForReview) {
    // Need to handle multiple flags - collect and apply at end
    if (!updates._flagsToAdd) updates._flagsToAdd = [];
    updates._flagsToAdd.push(questionId);
  } else {
    if (!updates._flagsToRemove) updates._flagsToRemove = [];
    updates._flagsToRemove.push(questionId);
  }
  break;
}
```

#### Step 2: Apply flag changes after building updates object
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add after switch statement, before writing to Firestore
**Details:**
- Apply arrayUnion/arrayRemove operations

```javascript
// After the switch statement, before the Firestore write:
if (updates._flagsToAdd?.length > 0) {
  updates.flaggedQuestions = arrayUnion(...updates._flagsToAdd);
  delete updates._flagsToAdd;
}
if (updates._flagsToRemove?.length > 0) {
  // Note: Can't mix arrayUnion and arrayRemove in same update
  // May need separate write for removes
  // Alternative: Read current, modify, write
}
```

**Note:** This is tricky because Firestore doesn't support mixing arrayUnion and arrayRemove in same update. May need to do multiple writes or batch the operations.

#### Alternative Step 2: Use read-modify-write pattern
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Implement full read-modify-write
**Details:**
- Read current flaggedQuestions array
- Apply all pending changes
- Write back

```javascript
// After building the updates object but before the updateDoc:
if (pendingItems.some(item => item.action === 'FLAG_TOGGLE')) {
  // Get current session state
  const sessionDoc = await getDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId));
  let flaggedQuestions = sessionDoc.data()?.flaggedQuestions || [];

  // Apply all flag toggles
  for (const item of pendingItems.filter(i => i.action === 'FLAG_TOGGLE')) {
    const { questionId, markedForReview } = item.payload;
    if (markedForReview && !flaggedQuestions.includes(questionId)) {
      flaggedQuestions.push(questionId);
    } else if (!markedForReview) {
      flaggedQuestions = flaggedQuestions.filter(id => id !== questionId);
    }
  }

  updates.flaggedQuestions = flaggedQuestions;
}
```

### Verification Steps
1. Flag a question, close browser, reopen - flag should persist
2. Flag multiple questions quickly, close browser - all should persist
3. Toggle flag on/off/on, close browser - final state should persist
4. Test offline: flag questions, lose connection, reconnect - flags should sync

### Potential Risks
- Race condition if user flags in different tabs (mitigate with duplicate tab guard)
- Read-modify-write pattern could overwrite concurrent changes (consider transactions)
- Array order doesn't matter for flags, but duplicates could occur (use Set logic)

---

## Issue 7: ANNOTATION_UPDATE Not Persisted via IndexedDB Queue

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Highlights survive browser refresh/crash
- **Current State:** ANNOTATION_UPDATE action queued but not processed in flushQueue

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 201-225) - no ANNOTATION_UPDATE case
  - `src/apBoost/hooks/useAnnotations.js` (lines 44-50, 110-117) - addToQueue calls
  - `src/apBoost/services/apSessionService.js` (line 61-62) - session has annotations/strikethroughs fields
- **Current Implementation:** Actions are queued but never processed
- **Gap:** Need case handler for ANNOTATION_UPDATE with subtypes (ADD_HIGHLIGHT, REMOVE_HIGHLIGHT, TOGGLE_STRIKETHROUGH, etc.)
- **Dependencies:** Session schema has `annotations` and `strikethroughs` fields

### Fix Plan

#### Step 1: Add ANNOTATION_UPDATE case to flushQueue
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Modify flushQueue switch statement
**Details:**
- Handle different annotation payload types
- Build nested update paths for Firestore

```javascript
case 'ANNOTATION_UPDATE': {
  const { type, questionId, range, color, index, choiceId } = item.payload;

  switch (type) {
    case 'ADD_HIGHLIGHT':
      // Need to accumulate highlights for the same questionId
      if (!updates._highlights) updates._highlights = {};
      if (!updates._highlights[questionId]) updates._highlights[questionId] = [];
      updates._highlights[questionId].push({ ...range, color });
      break;

    case 'REMOVE_HIGHLIGHT':
      // Mark for removal by index - complex, may need read-modify-write
      if (!updates._highlightRemovals) updates._highlightRemovals = {};
      if (!updates._highlightRemovals[questionId]) updates._highlightRemovals[questionId] = [];
      updates._highlightRemovals[questionId].push(index);
      break;

    case 'CLEAR_HIGHLIGHTS':
      updates[`annotations.${questionId}`] = [];
      break;

    case 'TOGGLE_STRIKETHROUGH':
      // Need to track toggles per question
      if (!updates._strikethroughToggles) updates._strikethroughToggles = {};
      if (!updates._strikethroughToggles[questionId]) {
        updates._strikethroughToggles[questionId] = new Set();
      }
      // Toggle: if already in set, remove it; otherwise add
      const set = updates._strikethroughToggles[questionId];
      if (set.has(choiceId)) {
        set.delete(choiceId);
      } else {
        set.add(choiceId);
      }
      break;

    case 'CLEAR_STRIKETHROUGHS':
      updates[`strikethroughs.${questionId}`] = [];
      break;

    case 'CLEAR_ALL':
      updates.annotations = {};
      updates.strikethroughs = {};
      break;
  }
  break;
}
```

#### Step 2: Process accumulated annotation changes before write
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add after switch statement
**Details:**
- Convert accumulated changes to Firestore update format

```javascript
// Process highlights
if (updates._highlights) {
  // Read current, merge, write back
  const sessionDoc = await getDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId));
  const currentAnnotations = sessionDoc.data()?.annotations || {};

  for (const [questionId, newHighlights] of Object.entries(updates._highlights)) {
    const existing = currentAnnotations[questionId] || [];
    updates[`annotations.${questionId}`] = [...existing, ...newHighlights];
  }
  delete updates._highlights;
}

// Process highlight removals (requires read-modify-write)
if (updates._highlightRemovals) {
  // Similar pattern - read, remove by index, write
  delete updates._highlightRemovals;
}

// Process strikethroughs
if (updates._strikethroughToggles) {
  const sessionDoc = await getDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId));
  const currentStrikethroughs = sessionDoc.data()?.strikethroughs || {};

  for (const [questionId, toggleSet] of Object.entries(updates._strikethroughToggles)) {
    const existing = new Set(currentStrikethroughs[questionId] || []);
    for (const choiceId of toggleSet) {
      if (existing.has(choiceId)) {
        existing.delete(choiceId);
      } else {
        existing.add(choiceId);
      }
    }
    updates[`strikethroughs.${questionId}`] = Array.from(existing);
  }
  delete updates._strikethroughToggles;
}
```

### Verification Steps
1. Add highlights, close browser, reopen - highlights should persist
2. Add strikethroughs, close browser - should persist
3. Test offline annotation changes sync correctly
4. Verify highlight removals work correctly

### Potential Risks
- Complex read-modify-write logic prone to bugs
- Highlight index removal is order-dependent
- Conflicting changes from different sessions could collide

---

## Issue 8: Highlights Not Visible in Review Mode

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Highlights visible in review mode (read-only)
- **Current State:** ReviewScreen only shows question summary grid, not question details with highlights

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/ReviewScreen.jsx` - Only shows grid of question boxes, no question content
  - `src/apBoost/pages/APTestSession.jsx` (lines 351-384) - review view renders ReviewScreen
  - `src/apBoost/components/QuestionDisplay.jsx` - Contains highlight rendering capability
- **Current Implementation:** ReviewScreen is a summary view, not a detailed review
- **Gap:** Need a way to view full question with annotations in review mode
- **Dependencies:** Would need to either expand ReviewScreen or create new component

### Fix Plan

#### Step 1: Add "View Question" functionality from ReviewScreen
**File:** `src/apBoost/components/ReviewScreen.jsx`
**Action:** Modify QuestionBox component
**Details:**
- Add hover state to show "View" button
- Clicking opens question detail modal/panel
- Pass annotations as props

```jsx
// Modify QuestionBox to show detail on click (with option to navigate)
<button
  onClick={onClick}
  className={`/* existing classes */`}
  title="Click to view or navigate to this question"
>
  {/* existing content */}
</button>
```

#### Step 2: Create ReviewQuestionModal component
**File:** `src/apBoost/components/ReviewQuestionModal.jsx` (new file)
**Action:** Create
**Details:**
- Modal that shows question content with highlights and strikethroughs
- Read-only - no editing of annotations allowed
- "Go to Question" button to navigate and close review

```jsx
// New component pattern:
export default function ReviewQuestionModal({
  question,
  answer,
  highlights,
  strikethroughs,
  onClose,
  onNavigate,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-[--radius-card] max-w-2xl w-full max-h-[80vh] overflow-auto p-6">
        {/* Question content with annotations read-only */}
        <QuestionDisplay
          question={question}
          highlights={highlights}
          disabled={true}
          annotationsEnabled={false}
        >
          <AnswerInput
            question={question}
            selectedAnswer={answer}
            disabled={true}
            strikethroughs={strikethroughs}
          />
        </QuestionDisplay>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose}>Close</button>
          <button onClick={onNavigate}>Go to Question</button>
        </div>
      </div>
    </div>
  );
}
```

#### Step 3: Integrate modal into ReviewScreen
**File:** `src/apBoost/components/ReviewScreen.jsx`
**Action:** Modify
**Details:**
- Add state for selected question
- Pass annotations and questions data from parent
- Show modal when question selected

### Verification Steps
1. Add highlights and strikethroughs to questions
2. Go to review screen
3. Click on a question box - should open modal with annotations visible
4. Verify annotations are read-only in modal
5. "Go to Question" should navigate back to testing view

### Potential Risks
- Requires passing more data to ReviewScreen (annotations, full questions)
- Could make the review screen more complex/slower
- Consider lazy loading question details

---

## Issue 9: Overlapping Highlights Not Handled Gracefully

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Handles overlapping highlights gracefully
- **Current State:** Simple overlap handling - later highlight takes precedence, but complex overlaps may not render correctly

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/tools/Highlighter.jsx` (lines 46-79) - HighlightedText segment building
- **Current Implementation:** Sorts by start, uses `Math.max(lastEnd, highlight.end)` to skip overlapped text
- **Gap:** When highlights overlap, the overlapped portion uses only the first highlight's color; nested highlights not supported
- **Dependencies:** Could use more sophisticated segment merging algorithm

### Fix Plan

#### Step 1: Implement proper segment merging for overlaps
**File:** `src/apBoost/components/tools/Highlighter.jsx`
**Action:** Modify HighlightedText function
**Details:**
- Use interval merging algorithm
- When highlights overlap, keep the later one's color for the overlapping portion
- Or: blend/layer colors for overlapping sections

```javascript
// More sophisticated segment building:
function HighlightedText({ content, highlights, onHighlightClick }) {
  if (!highlights || highlights.length === 0) {
    return <span>{content}</span>;
  }

  // Build a list of all boundary points
  const boundaries = [];
  highlights.forEach((h, idx) => {
    boundaries.push({ pos: h.start, type: 'start', color: h.color, index: idx });
    boundaries.push({ pos: h.end, type: 'end', color: h.color, index: idx });
  });

  // Sort by position
  boundaries.sort((a, b) => a.pos - b.pos || (a.type === 'end' ? -1 : 1));

  // Build segments with active highlights at each point
  const segments = [];
  let lastPos = 0;
  let activeHighlights = [];

  for (const b of boundaries) {
    if (b.pos > lastPos) {
      segments.push({
        text: content.slice(lastPos, b.pos),
        color: activeHighlights.length > 0 ? activeHighlights[activeHighlights.length - 1].color : null,
        indices: [...activeHighlights.map(h => h.index)],
      });
    }

    if (b.type === 'start') {
      activeHighlights.push({ color: b.color, index: b.index });
    } else {
      activeHighlights = activeHighlights.filter(h => h.index !== b.index);
    }

    lastPos = b.pos;
  }

  // Add remaining text
  if (lastPos < content.length) {
    segments.push({ text: content.slice(lastPos), color: null, indices: [] });
  }

  // Render segments
  return (
    <>
      {segments.map((seg, idx) =>
        seg.color ? (
          <span
            key={idx}
            className={`${HIGHLIGHT_COLORS[seg.color]} cursor-pointer hover:opacity-70`}
            onClick={(e) => {
              e.stopPropagation();
              // Click removes the topmost highlight in this segment
              if (seg.indices.length > 0) {
                onHighlightClick(seg.indices[seg.indices.length - 1]);
              }
            }}
          >
            {seg.text}
          </span>
        ) : (
          <span key={idx}>{seg.text}</span>
        )
      )}
    </>
  );
}
```

### Verification Steps
1. Highlight "the quick brown" then highlight "brown fox" - should show overlap correctly
2. Click on overlapping portion - should remove the most recently added highlight
3. Test with 3+ overlapping highlights
4. Verify no text is lost or duplicated

### Potential Risks
- More complex algorithm, potential for bugs
- Performance with many highlights (should be fine for typical use)
- Edge cases with zero-length ranges or identical ranges

---

## Issue 10: Strikethrough Button Shows Plus Icon Instead of X

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Small "X" button next to each MCQ option (or right-click)
- **Current State:** Button exists but shows plus/minus icon instead of X

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/AnswerInput.jsx` (lines 97-99) - SVG path is a plus sign
- **Current Implementation:** `<path d="M9 12h6m-3-3v6" />` draws a plus
- **Gap:** Should be an X icon
- **Dependencies:** None

### Fix Plan

#### Step 1: Change SVG to X icon
**File:** `src/apBoost/components/AnswerInput.jsx`
**Action:** Modify line 98
**Details:**
- Replace plus path with X path

```jsx
// Change from:
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-3-3v6" />

// To:
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
```

### Verification Steps
1. View MCQ question
2. Strikethrough button should show X icon
3. Verify icon is visible and appropriately sized

### Potential Risks
- None - simple visual change

---

## Issue 11: Strikethrough Styling Not Exact

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Styling: text-decoration: line-through, color: text-muted, opacity: 0.6
- **Current State:** Uses opacity-50 (0.5) not 0.6, and text color not explicitly set to muted

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/AnswerInput.jsx` (lines 53, 69) - opacity-50 and line-through
- **Current Implementation:** `opacity-50` for container, `line-through` on text span
- **Gap:** Opacity should be 0.6 (60%), text color should be explicitly muted
- **Dependencies:** Tailwind doesn't have opacity-60 by default

### Fix Plan

#### Step 1: Update strikethrough styling
**File:** `src/apBoost/components/AnswerInput.jsx`
**Action:** Modify lines 53 and 69
**Details:**
- Change opacity-50 to opacity-60 (or use arbitrary value [0.6])
- Add text-text-muted to struck-through text

```jsx
// Line 53, change from:
${isStruckThrough ? 'opacity-50' : ''}

// To:
${isStruckThrough ? 'opacity-[0.6]' : ''}

// Line 69, change from:
<span className={isStruckThrough ? 'line-through' : ''}>

// To:
<span className={isStruckThrough ? 'line-through text-text-muted' : ''}>
```

### Verification Steps
1. Strike through an option
2. Verify opacity is visually 60% (slightly more visible than before)
3. Verify text color is muted

### Potential Risks
- Minor visual change, should be safe
- If opacity-[0.6] doesn't work in project's Tailwind config, use inline style

---

## Issue 12: Strikethrough Not Visible in Review Mode

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Strikethrough visible in review mode
- **Current State:** ReviewScreen doesn't display individual question details

### Code Analysis
- Same as Issue 8 (Highlights in review mode)
- **Gap:** ReviewScreen needs access to strikethrough data and question content

### Fix Plan

This is the same solution as Issue 8 - the ReviewQuestionModal would also show strikethroughs since AnswerInput already handles the `strikethroughs` prop.

#### Step 1: Same as Issue 8 - Create ReviewQuestionModal
Already covered in Issue 8 fix plan.

#### Step 2: Ensure strikethroughs passed to modal
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify review view
**Details:**
- Pass getStrikethroughs function or full strikethroughs Map to ReviewScreen
- ReviewScreen passes to ReviewQuestionModal

### Verification Steps
1. Strike through options on various questions
2. Go to review mode
3. View a question - strikethroughs should be visible
4. Verify strikethrough styling matches testing view

### Potential Risks
- Same as Issue 8

---

## Issue 13: Click Option Text to Toggle Strikethrough

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Click MCQ answer option to toggle strikethrough
- **Current State:** Uses dedicated button instead of clicking the option text

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/AnswerInput.jsx` (lines 43-80) - main button selects answer
- **Current Implementation:** Clicking option selects it; separate X button for strikethrough
- **Gap:** Criterion says clicking option should toggle strikethrough
- **Dependencies:** This conflicts with selection behavior - can't do both on same click

### Fix Plan

**Note:** The current implementation is actually better UX because:
1. Clicking naturally selects an answer
2. Strikethrough is a secondary action
3. Having separate controls prevents accidental strikethrough when trying to select

**Recommendation:** Consider this as acceptable deviation from criterion, or implement right-click for strikethrough as an alternative.

#### Alternative Option A: Right-click for strikethrough
**File:** `src/apBoost/components/AnswerInput.jsx`
**Action:** Add onContextMenu handler
**Details:**
```jsx
<button
  // ... existing props
  onContextMenu={(e) => {
    e.preventDefault();
    if (onStrikethrough) onStrikethrough(letter);
  }}
>
```

#### Alternative Option B: Long-press on mobile
**File:** `src/apBoost/components/AnswerInput.jsx`
**Action:** Add long-press detection
**Details:**
- Use touch events with timeout for long-press detection
- Long-press toggles strikethrough instead of selecting

### Verification Steps
1. Right-click on option - should toggle strikethrough
2. Regular click should still select the option
3. On mobile, long-press should strikethrough

### Potential Risks
- Right-click behavior may surprise users
- Need to disable default context menu
- Long-press detection adds complexity

---

## Issue 14: Strikethrough Persistence via IndexedDB Queue

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Strikethrough survives browser refresh/crash
- **Current State:** Same as highlights - ANNOTATION_UPDATE not fully processed

### Code Analysis
Same as Issue 7 - strikethrough uses TOGGLE_STRIKETHROUGH subtype of ANNOTATION_UPDATE

### Fix Plan

Already covered in Issue 7 fix plan - TOGGLE_STRIKETHROUGH handling is included in the ANNOTATION_UPDATE case.

### Verification Steps
1. Strike through options, close browser, reopen - strikethroughs should persist
2. Test offline strikethrough changes

### Potential Risks
- Same as Issue 7

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 6: FLAG_TOGGLE persistence** - Foundational queue fix, pattern reused for annotations
2. **Issue 7: ANNOTATION_UPDATE persistence** - Builds on FLAG_TOGGLE pattern, needed for Issues 8, 12, 14
3. **Issue 10: Strikethrough X icon** - Simple, no dependencies
4. **Issue 11: Strikethrough styling** - Simple, no dependencies
5. **Issue 5: Flagged questions listing** - Simple, standalone
6. **Issue 1: Timer auto-submit** - Core functionality, needed for Issues 2, 3
7. **Issue 3: Offline auto-submit queue** - Builds on Issue 1
8. **Issue 2: Mobile background detection** - Builds on timer handling
9. **Issue 4: beforeunload timer pause** - Minor enhancement
10. **Issue 9: Overlapping highlights** - Can be done independently
11. **Issues 8 & 12: Review mode annotations** - Larger feature, needs Issues 6, 7 first
12. **Issue 13: Click-to-strikethrough** - Optional, may leave as-is

## Cross-Cutting Concerns

### 1. Read-Modify-Write Pattern
Multiple issues require reading current Firestore state, modifying it, and writing back. Consider:
- Creating a shared utility function
- Using Firestore transactions for atomicity
- Batching related changes

### 2. Queue Processing Improvements
The flushQueue function needs significant expansion. Consider:
- Breaking into smaller handler functions per action type
- Adding unit tests for queue processing logic
- Adding retry logic per action type

### 3. ReviewScreen Architecture
Issues 8 and 12 both need ReviewScreen to display question details. Consider:
- Whether to expand ReviewScreen or create separate detail view
- Lazy loading question details for performance
- Modal vs. inline expansion pattern

## Notes for Implementer

1. **Test thoroughly offline scenarios** - Queue processing is complex and bugs can cause data loss
2. **Consider mobile browsers** - visibilitychange API behaves differently on iOS vs Android
3. **Firestore quotas** - Read-modify-write operations count as 2 operations; batch when possible
4. **Backward compatibility** - Sessions created before these changes should still work
5. **Feature flags** - Consider hiding unfinished features behind flags during development
6. **Console logging** - The existing logDebug/logError patterns should be used for debugging queue issues
