# Fix Plan: Sections 1.5 to 1.9

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_1.5_to_1.9_criteria_audit.md

## Executive Summary
- Total Issues: 11
- ⚠️ Partial Implementations: 4
- ❌ Missing Features: 7
- ❓ Needs Investigation: 0
- Estimated Complexity: Medium-High

---

## Issue 1: Line Reader Drag Functionality (1.5)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Drag overlay to move position
- **Current State:** Only click repositioning exists via `handleOverlayClick`. No drag-and-drop implementation.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/tools/LineReader.jsx` (lines 49-58) - Click handler exists but no drag
- **Current Implementation:** Click anywhere on overlay calculates new position from `clickY / lineHeight`
- **Gap:** Users cannot drag the focus window to a new position - must click
- **Dependencies:** None - self-contained component

### Fix Plan

#### Step 1: Add drag state and mouse event handlers
**File:** `src/apBoost/components/tools/LineReader.jsx`
**Action:** Modify
**Details:**
- Add state: `const [isDragging, setIsDragging] = useState(false)`
- Add ref for drag start position: `const dragStartRef = useRef({ y: 0, position: 0 })`
- Add `onMouseDown` handler to the clear reading window div (lines 84-92)
- Track initial mouse Y and current position

#### Step 2: Add mousemove and mouseup handlers
**File:** `src/apBoost/components/tools/LineReader.jsx`
**Action:** Modify
**Details:**
- Create `handleMouseMove` callback:
  ```javascript
  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return
    const deltaY = e.clientY - dragStartRef.current.y
    const deltaLines = Math.round(deltaY / lineHeight)
    const newPosition = Math.max(0, dragStartRef.current.position + deltaLines)
    onPositionChange(newPosition)
  }, [isDragging, lineHeight, onPositionChange])
  ```
- Add document-level `mousemove` and `mouseup` listeners in useEffect
- On mouseup, set `isDragging` to false

#### Step 3: Update cursor styling
**File:** `src/apBoost/components/tools/LineReader.jsx`
**Action:** Modify
**Details:**
- Change cursor on clear window to `grab` when not dragging
- Change cursor to `grabbing` when dragging
- Add visual feedback (slight opacity change) during drag

### Verification Steps
1. Enable line reader, verify can drag the focus window up/down
2. Verify position updates smoothly during drag
3. Verify drag works on touch devices (add touch event equivalents if needed)
4. Verify click-to-reposition still works

### Potential Risks
- Mouse capture issues on window boundaries - mitigate with document-level event listeners
- Touch device support - may need to add touch event handlers separately

---

## Issue 2: Line Reader Scroll Position Tracking (1.5)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Tracks scroll position to maintain relative position
- **Current State:** No scroll event listeners. Line reader doesn't adjust when passage content scrolls.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/tools/LineReader.jsx` (line 64) - Uses `scrollHeight` but no scroll tracking
- **Current Implementation:** Uses absolute positioning based on `position * lineHeight` without scroll offset
- **Gap:** When user scrolls long passage, line reader stays at absolute position instead of tracking relative content position
- **Dependencies:** `contentRef` prop from parent component

### Fix Plan

#### Step 1: Add scroll position state
**File:** `src/apBoost/components/tools/LineReader.jsx`
**Action:** Modify
**Details:**
- Add state: `const [scrollOffset, setScrollOffset] = useState(0)`

#### Step 2: Add scroll event listener
**File:** `src/apBoost/components/tools/LineReader.jsx`
**Action:** Modify
**Details:**
- Add useEffect that attaches scroll listener to `contentRef.current`:
  ```javascript
  useEffect(() => {
    if (!enabled || !contentRef.current) return

    const handleScroll = () => {
      setScrollOffset(contentRef.current.scrollTop)
    }

    const element = contentRef.current
    element.addEventListener('scroll', handleScroll)
    return () => element.removeEventListener('scroll', handleScroll)
  }, [enabled, contentRef])
  ```

#### Step 3: Adjust overlay position calculations
**File:** `src/apBoost/components/tools/LineReader.jsx`
**Action:** Modify
**Details:**
- Modify `windowTop` calculation to account for scroll:
  ```javascript
  const windowTop = position * lineHeight - scrollOffset
  ```
- Update top/bottom overlay heights to use scroll-adjusted position
- Clamp values to prevent negative heights when scrolled past focus line

#### Step 4: Update click handler for scroll offset
**File:** `src/apBoost/components/tools/LineReader.jsx`
**Action:** Modify
**Details:**
- In `handleOverlayClick`, adjust click position calculation:
  ```javascript
  const clickY = e.clientY - rect.top + scrollOffset
  ```

### Verification Steps
1. Open long passage with line reader enabled
2. Scroll passage content - verify line reader stays relative to focused text
3. Click to reposition while scrolled - verify correct position
4. Verify no flickering during scroll

### Potential Risks
- Performance issues with frequent scroll events - mitigate with throttle/requestAnimationFrame
- Parent container scroll vs content scroll - may need to identify correct scroll container

---

## Issue 3: Line Reader Works on Long Passages (1.5)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Works on long passages
- **Current State:** Basic support exists but scroll position synchronization incomplete

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/tools/LineReader.jsx` (line 64) - Uses `contentRef.current?.scrollHeight`
- **Current Implementation:** Overlay height calculations use scrollHeight, but position doesn't track scroll
- **Gap:** Combined with Issue 2 - scroll tracking will fix this

### Fix Plan
This issue will be resolved by implementing Issue 2 (scroll position tracking).

### Verification Steps
1. Test with passage requiring scrolling (>50 lines)
2. Verify overlay covers full content height
3. Verify focus window can access all content lines

### Potential Risks
None additional - addressed by Issue 2

---

## Issue 4: Section Locking - Navigation Prevention (1.6)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Cannot navigate back to previous sections / currentSectionIndex only increments
- **Current State:** No enforcement. `setCurrentSectionIndex` can be called with any value.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (line 35, 390-392) - `currentSectionIndex` state with no guards
  - `src/apBoost/hooks/useTestSession.js` (line 289-301) - `goPrevious` doesn't check section boundaries
- **Current Implementation:**
  - `submitSection` at line 386-393 increments section index
  - No validation prevents going back
- **Gap:** Must add validation to prevent section index from decreasing
- **Dependencies:** `flatNavigationItems`, `currentFlatIndex`, navigation functions

### Fix Plan

#### Step 1: Add completedSections tracking
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- Add state to track completed sections:
  ```javascript
  const [completedSections, setCompletedSections] = useState(new Set())
  ```
- Initialize from `existingSession.completedSections` on restore (line 177-196)

#### Step 2: Create guarded section setter
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- Replace direct `setCurrentSectionIndex` with guarded version:
  ```javascript
  const setCurrentSectionGuarded = useCallback((newIndex) => {
    setCurrentSectionIndex(prev => {
      // Only allow incrementing or staying same, never decrementing
      if (newIndex < prev) {
        console.warn('Attempted to navigate to previous section - blocked')
        return prev
      }
      return newIndex
    })
  }, [])
  ```
- Use this in `submitSection` and any other section navigation

#### Step 3: Update navigation boundary checks
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- Modify `canGoPrevious` to check section boundary:
  ```javascript
  const canGoPrevious = useMemo(() => {
    if (currentFlatIndex <= 0) return false

    // Check if previous item is in current section
    const prevItem = flatNavigationItems[currentFlatIndex - 1]
    const currentItem = flatNavigationItems[currentFlatIndex]

    // If navigating would cross section boundary, disallow
    if (prevItem && currentItem) {
      const prevQuestionIdx = prevItem.questionIndex
      const currQuestionIdx = currentItem.questionIndex
      // Check if they're in same section by comparing question indices
      // If prev is in different section (crossed boundary), block
      if (prevQuestionIdx >= currentSection.questionIds.length) {
        return false // Would go to previous section
      }
    }

    return true
  }, [currentFlatIndex, flatNavigationItems, currentSection])
  ```

#### Step 4: Mark sections as complete on submission
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- In `submitSection`, add section to completedSections:
  ```javascript
  const submitSection = useCallback(async () => {
    // Mark current section as complete
    setCompletedSections(prev => {
      const next = new Set(prev)
      next.add(currentSectionIndex)
      return next
    })

    // Queue persistence
    addToQueue({
      action: 'SECTION_COMPLETE',
      payload: { sectionIndex: currentSectionIndex }
    })

    // Move to next section...
  }, [currentSectionIndex, addToQueue])
  ```

### Verification Steps
1. Complete section 1, verify cannot go back to section 1 questions
2. Verify back button is disabled at section boundary
3. Verify section completion persists on resume
4. Verify cannot use keyboard shortcuts to bypass

### Potential Risks
- Existing sessions without `completedSections` field - handle gracefully with fallback
- May need to update Firestore schema/indexes

---

## Issue 5: Back Button Disabled at Section Boundary (1.6)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** "Back" button disabled on first question of a section (if previous section exists)
- **Current State:** `canGoBack` only checks `currentFlatIndex > 0`, doesn't consider section boundaries

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/QuestionNavigator.jsx` (lines 101-113) - Back button uses `canGoBack` prop
  - `src/apBoost/hooks/useTestSession.js` (lines 307-309) - `canGoPrevious` only checks `currentFlatIndex > 0`
- **Current Implementation:** Simple index check without section awareness
- **Gap:** Need to check if at first question of a section AND previous section exists/is completed

### Fix Plan

#### Step 1: Update canGoPrevious logic in hook
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- As described in Issue 4 Step 3, update `canGoPrevious` to:
  ```javascript
  const canGoPrevious = useMemo(() => {
    // Can't go back from index 0
    if (currentFlatIndex <= 0) return false

    // If at first question of current section and not section 0, block
    // because previous section is locked
    if (currentSectionIndex > 0 && currentQuestionIndex === 0) {
      // Only for first flat item of the section
      const firstFlatItemOfSection = flatNavigationItems.findIndex(item =>
        item.questionIndex === 0 &&
        (item.subQuestionLabel === null || item.subQuestionLabel === 'a')
      )
      if (currentFlatIndex === firstFlatItemOfSection) {
        return false
      }
    }

    return true
  }, [currentFlatIndex, currentSectionIndex, currentQuestionIndex, flatNavigationItems])
  ```

#### Step 2: Enhance goPrevious to enforce boundary
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- Add validation in `goPrevious`:
  ```javascript
  const goPrevious = useCallback(() => {
    if (!canGoPrevious) {
      console.warn('Cannot go previous - at section boundary')
      return
    }
    const prevIndex = currentFlatIndex - 1
    if (prevIndex >= 0) {
      goToFlatIndex(prevIndex)
    }
  }, [currentFlatIndex, canGoPrevious, goToFlatIndex])
  ```

### Verification Steps
1. Start test, go to section 2
2. Navigate to first question of section 2
3. Verify back button is disabled/grayed out
4. Verify clicking does nothing
5. Verify keyboard left arrow also blocked

### Potential Risks
- FRQ sub-questions may complicate first-question detection - test with FRQ sections

---

## Issue 6: Visual Indication of Section Locking (1.6)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Clear visual indication that previous section is locked
- **Current State:** Warning text "You cannot return to previous sections" shown before test only. No indication during test.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/InstructionScreen.jsx` (line 61) - Pre-test warning
  - `src/apBoost/pages/APTestSession.jsx` (lines 403-411) - Header shows section info
- **Current Implementation:** Pre-test warning exists, no runtime indication
- **Gap:** Need visual cue during test showing previous sections are locked
- **Dependencies:** Section completion state from Issue 4

### Fix Plan

#### Step 1: Add section indicator component
**File:** `src/apBoost/components/SectionIndicator.jsx` (NEW FILE)
**Action:** Create
**Details:**
- Create component showing section tabs/pills:
  ```javascript
  function SectionIndicator({
    sections,
    currentIndex,
    completedSections
  }) {
    return (
      <div className="flex items-center gap-1">
        {sections.map((section, idx) => {
          const isCompleted = completedSections.has(idx)
          const isCurrent = idx === currentIndex
          const isLocked = idx < currentIndex

          return (
            <div
              key={section.id}
              className={`
                px-3 py-1 rounded-[--radius-button-sm] text-xs
                ${isCurrent ? 'bg-brand-primary text-white' : ''}
                ${isLocked ? 'bg-muted text-text-muted' : ''}
                ${!isCurrent && !isLocked ? 'bg-surface border border-border-default text-text-secondary' : ''}
              `}
            >
              {isLocked && <span className="mr-1">🔒</span>}
              Section {idx + 1}
            </div>
          )
        })}
      </div>
    )
  }
  ```

#### Step 2: Add SectionIndicator to test header
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify
**Details:**
- Import `SectionIndicator`
- Add to header (around line 403-411):
  ```jsx
  <header className="...">
    <div className="flex items-center gap-4">
      <SectionIndicator
        sections={test?.sections || []}
        currentIndex={position.sectionIndex}
        completedSections={completedSections}
      />
    </div>
    <TestTimer ... />
  </header>
  ```

#### Step 3: Pass completedSections from hook
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- Add `completedSections` to return object (around line 448-509)

### Verification Steps
1. Start test, verify section indicators visible in header
2. Complete section 1, verify lock icon appears
3. Verify current section highlighted
4. Verify future sections appear neutral/upcoming

### Potential Risks
- Header space constraints - may need responsive design for many sections

---

## Issue 7: PAUSED Status on Browser Close (1.7)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Closing browser mid-test sets status to PAUSED
- **Current State:** `beforeunload` handler only shows warning if queue has items. Does NOT set status to PAUSED.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (lines 208-220) - beforeunload handler
  - `src/apBoost/services/apSessionService.js` (lines 112-122) - `updateSession` function
  - `src/apBoost/utils/apTypes.js` (line 37) - `SESSION_STATUS.PAUSED` exists but unused
- **Current Implementation:** beforeunload only shows confirmation dialog
- **Gap:** Need to write PAUSED status to Firestore on unload
- **Dependencies:** Queue flush may not complete before page closes

### Fix Plan

#### Step 1: Add visibilitychange handler for pausing
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- Add visibilitychange listener that sets PAUSED when page hidden:
  ```javascript
  useEffect(() => {
    if (!session?.id) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Use sendBeacon for reliable unload-time request
        const payload = JSON.stringify({
          status: SESSION_STATUS.PAUSED,
          pausedAt: new Date().toISOString()
        })
        navigator.sendBeacon(
          `${API_BASE}/ap/session/${session.id}/pause`,
          payload
        )
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [session?.id])
  ```

#### Step 2: Alternative - Queue-based approach
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- If no backend endpoint available, use IndexedDB to mark session for pause:
  ```javascript
  useEffect(() => {
    if (!session?.id) return

    const handleBeforeUnload = () => {
      // Store pause marker in localStorage (survives page close)
      localStorage.setItem(`ap_session_pause_${session.id}`, Date.now().toString())
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [session?.id])
  ```
- On next session load, check for pause marker and update Firestore

#### Step 3: Add pause recovery logic
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- In `loadTestAndSession` (around line 160-203), check for pause markers:
  ```javascript
  // Check if session was paused via browser close
  const pauseMarker = localStorage.getItem(`ap_session_pause_${existingSession.id}`)
  if (pauseMarker) {
    // Update session status to PAUSED in Firestore
    await updateSession(existingSession.id, {
      status: SESSION_STATUS.PAUSED,
      pausedAt: new Date(parseInt(pauseMarker))
    })
    localStorage.removeItem(`ap_session_pause_${existingSession.id}`)
  }
  ```

#### Step 4: Update session resume to handle PAUSED status
**File:** `src/apBoost/services/apSessionService.js`
**Action:** Modify
**Details:**
- Update `getActiveSession` to also query for PAUSED status:
  ```javascript
  const sessionsQuery = query(
    collection(db, COLLECTIONS.SESSION_STATE),
    where('testId', '==', testId),
    where('userId', '==', userId),
    where('status', 'in', [SESSION_STATUS.IN_PROGRESS, SESSION_STATUS.PAUSED])
  )
  ```

### Verification Steps
1. Start test, answer some questions
2. Close browser tab
3. Reopen test - verify shows resume prompt
4. Check Firestore - verify status is PAUSED
5. Resume test, verify status returns to IN_PROGRESS

### Potential Risks
- `sendBeacon` has payload size limits - keep minimal
- localStorage can be cleared - acceptable fallback
- Firestore index needed for status 'in' query

---

## Issue 8: Resume Restores Annotations (1.7)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Resume restores all annotations (highlights, strikethroughs)
- **Current State:** `loadAnnotations` function exists in useAnnotations but is never called in useTestSession when restoring session.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useAnnotations.js` (lines 180-205) - `loadAnnotations` function fully implemented
  - `src/apBoost/hooks/useTestSession.js` (lines 176-196) - Session restore logic, annotations not loaded
  - `src/apBoost/services/apSessionService.js` (lines 59-62) - Session stores `annotations` and `strikethroughs` fields
- **Current Implementation:**
  - `loadAnnotations` can parse `{highlights: {...}, strikethroughs: {...}}`
  - Session data includes these fields
  - But `useTestSession` never calls `loadAnnotations`
- **Gap:** Need to wire up annotation loading in session restore
- **Dependencies:** `useAnnotations` hook, session data structure

### Fix Plan

#### Step 1: Export loadAnnotations capability from useAnnotations
**File:** `src/apBoost/hooks/useAnnotations.js`
**Action:** Verify (already exported at line 253)
**Details:**
- `loadAnnotations` is already in the return object - no change needed

#### Step 2: Pass annotation data to useAnnotations
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify
**Details:**
- Get `session` from `useTestSession`
- Pass initial annotation data to `useAnnotations`:
  ```javascript
  const {
    ...annotationProps,
    loadAnnotations,
  } = useAnnotations(session?.id, addToQueue)

  // Load annotations when session is restored
  useEffect(() => {
    if (session && (session.annotations || session.strikethroughs)) {
      loadAnnotations({
        highlights: session.annotations || {},
        strikethroughs: session.strikethroughs || {}
      })
    }
  }, [session, loadAnnotations])
  ```

#### Step 3: Alternative - Load in useTestSession and pass to hook
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- Return annotation data with session for parent to use:
  ```javascript
  // In return object
  sessionAnnotations: session?.annotations || {},
  sessionStrikethroughs: session?.strikethroughs || {},
  ```

### Verification Steps
1. Start test, add highlights to passage
2. Add strikethroughs to answer choices
3. Close/refresh browser
4. Resume test - verify highlights visible
5. Verify strikethroughs visible on answer choices
6. Verify line reader state NOT restored (intentional - per-session tool)

### Potential Risks
- Large annotation data could slow restore - monitor performance
- Data format mismatch between save and load - verify schema consistency

---

## Issue 9: TestCard Shows Max Attempts (1.9)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** TestCard shows assignment info if applicable: due date, max attempts
- **Current State:** Due date is shown but max attempts is NOT displayed.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APDashboard.jsx` (lines 48-52) - Shows due date only
  - `src/apBoost/services/apTeacherService.js` (line 239) - Confirms `maxAttempts` field exists in assignment
- **Current Implementation:** TestCard displays due date from assignment but ignores maxAttempts
- **Gap:** Add max attempts display in TestCard
- **Dependencies:** Assignment data includes `maxAttempts` field

### Fix Plan

#### Step 1: Add max attempts to TestCard display
**File:** `src/apBoost/pages/APDashboard.jsx`
**Action:** Modify
**Details:**
- Update TestCard component (around line 48-52):
  ```jsx
  {assignment?.dueDate && (
    <p className="text-text-muted text-sm mt-2">
      Due: {assignment.dueDate.toDate?.().toLocaleDateString() || 'N/A'}
    </p>
  )}

  {assignment?.maxAttempts && assignment.maxAttempts > 1 && (
    <p className="text-text-muted text-sm mt-1">
      Attempts: {attemptCount} / {assignment.maxAttempts}
    </p>
  )}
  ```

#### Step 2: Show remaining attempts if limited
**File:** `src/apBoost/pages/APDashboard.jsx`
**Action:** Modify
**Details:**
- Add logic to show warning when approaching limit:
  ```jsx
  {assignment?.maxAttempts && (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-text-muted text-sm">
        Attempts: {attemptCount} / {assignment.maxAttempts}
      </span>
      {attemptCount >= assignment.maxAttempts && (
        <span className="text-error-text text-xs">(Limit reached)</span>
      )}
    </div>
  )}
  ```

#### Step 3: Disable card if max attempts reached
**File:** `src/apBoost/pages/APDashboard.jsx`
**Action:** Modify
**Details:**
- Add disabled state to TestCard button:
  ```jsx
  const isMaxedOut = assignment?.maxAttempts && attemptCount >= assignment.maxAttempts

  <button
    onClick={onClick}
    disabled={isMaxedOut}
    className={`... ${isMaxedOut ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
  ```

### Verification Steps
1. Create assignment with maxAttempts = 2
2. View dashboard - verify shows "Attempts: 0 / 2"
3. Complete one attempt - verify shows "Attempts: 1 / 2"
4. Complete second attempt - verify shows limit reached
5. Verify cannot start new attempt when maxed out

### Potential Risks
- Assignments without maxAttempts field - handle gracefully with optional chaining
- Public tests don't have assignments - ensure null checks

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 4 (Section Locking Navigation Prevention)** - Foundational; affects Issues 5-6
2. **Issue 5 (Back Button Section Boundary)** - Depends on Issue 4; user-facing fix
3. **Issue 6 (Visual Indication of Locking)** - Depends on Issue 4; UI enhancement
4. **Issue 7 (PAUSED Status on Browser Close)** - Independent; critical for session integrity
5. **Issue 8 (Resume Restores Annotations)** - Independent; improves resume experience
6. **Issue 9 (Max Attempts Display)** - Independent; simple UI fix
7. **Issue 1 (Line Reader Drag)** - Independent; UX improvement
8. **Issues 2 & 3 (Line Reader Scroll)** - Combined fix; UX improvement

## Cross-Cutting Concerns

### Queue Action Types
Add new queue action types to `useOfflineQueue.js` switch statement:
- `SECTION_COMPLETE` - Mark section as completed
- `SESSION_PAUSE` - Set session status to PAUSED
- `ANNOTATION_RESTORE` - (Optional) Confirm annotation restore

### Firestore Schema Updates
Consider adding/documenting fields:
- `ap_session_state.completedSections` - Array of completed section indices
- `ap_session_state.pausedAt` - Timestamp when session was paused

### Index Requirements
May need composite index for:
- `ap_session_state` on `(testId, userId, status)` for PAUSED query

## Notes for Implementer

1. **Section Locking Priority**: This is the most critical fix as it affects test integrity. Implement Issues 4-6 together to ensure complete section locking behavior.

2. **PAUSED Status Approach**: If backend endpoint isn't available, the localStorage fallback approach is reliable. The visibilitychange event is more reliable than beforeunload for modern browsers.

3. **Line Reader Improvements**: These are UX enhancements and can be deprioritized if needed. The drag feature especially is a "nice to have" while scroll tracking is more important.

4. **Testing Considerations**:
   - Test section locking with both MCQ-only and mixed MCQ/FRQ sections
   - Test browser close behavior in multiple browsers (Chrome, Firefox, Safari)
   - Test annotation restore with large amounts of highlights

5. **Performance Monitoring**: The scroll tracking for line reader should use `requestAnimationFrame` or throttling to prevent performance issues on low-end devices.
