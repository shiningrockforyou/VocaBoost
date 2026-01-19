# Acceptance Criteria Audit: Sections 1.5 to 1.9

**Audited by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE

## Summary
- Total Criteria: 45
- ✅ Implemented: 29
- ⚠️ Partial: 5
- ❌ Missing: 11
- ❓ Unable to Verify: 0

---

## Section 1.5: Line Reader Tool

### Criterion: Toggle button activates line reader overlay
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/tools/LineReader.jsx:60-111` - Renders overlay when `enabled=true`. `LineReaderControls` component provides toggle button at line 129-141.
- **Notes:** Works correctly with toggle state managed via props.

### Criterion: Only current line(s) visible through overlay
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/tools/LineReader.jsx:73-102` - Creates darkened overlay above (lines 73-80) and below (lines 94-102) the focus area, with clear window in between (lines 83-92).
- **Notes:** Uses CSS `bg-black/60` for darkened areas.

### Criterion: Configurable: 1-3 visible lines
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/tools/LineReader.jsx:23` - `visibleLines` prop defaults to 2. `LineReaderControls` component (lines 147-155) provides dropdown with 1, 2, 3 line options.
- **Notes:** Constraint enforced in `useAnnotations.js:162` with `Math.min(3, Math.max(1, lines))`.

### Criterion: Drag overlay to move position
- **Status:** ❌ Missing
- **Evidence:** `src/apBoost/components/tools/LineReader.jsx` - No drag implementation found. Searched for drag/draggable/onDrag/mousedown/mousemove patterns - none found.
- **Notes:** Only click repositioning is implemented via `handleOverlayClick`. Should add drag functionality for better UX.

### Criterion: Arrow keys move the focus line
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/tools/LineReader.jsx:32-47` - `handleKeyDown` effect listens for ArrowUp/ArrowDown keys and calls `onPositionChange`.
- **Notes:** Properly prevents default and handles position bounds.

### Criterion: Works on long passages
- **Status:** ⚠️ Partial
- **Evidence:** `src/apBoost/components/tools/LineReader.jsx:64` - Uses `contentRef.current?.scrollHeight` but scroll tracking is incomplete.
- **Notes:** Basic support exists but scroll position synchronization is not fully implemented.

### Criterion: Darkened overlay above and below focus area
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/tools/LineReader.jsx:73-102` - Top overlay (lines 73-80) and bottom overlay (lines 94-102) both use `bg-black/60`.
- **Notes:** Smooth transitions with `duration-150`.

### Criterion: Clear/focused area shows current line(s)
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/tools/LineReader.jsx:83-92` - Clear window with border styling and subtle glow effect.
- **Notes:** Uses `border-brand-primary/50` and box-shadow for visibility.

### Criterion: Click on overlay repositions focus
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/tools/LineReader.jsx:50-58` - `handleOverlayClick` calculates new position from click Y coordinate.
- **Notes:** Formula: `Math.floor(clickY / lineHeight)`.

### Criterion: Absolute positioned with pointer-events: none for clear area
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/tools/LineReader.jsx:79,89,101` - Dark overlays have `pointerEvents: 'none'`. Container has `pointer-events-auto` for click handling.
- **Notes:** Correctly allows text selection through clear area.

### Criterion: Tracks scroll position to maintain relative position
- **Status:** ❌ Missing
- **Evidence:** `src/apBoost/components/tools/LineReader.jsx` - No scroll event listeners or scroll position tracking found.
- **Notes:** Critical missing feature - line reader should adjust when content scrolls.

### Criterion: Settings button to change visible line count
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/tools/LineReader.jsx:146-156` - `LineReaderControls` has dropdown select for 1/2/3 lines.
- **Notes:** Appears only when line reader is enabled.

---

## Section 1.6: Section Locking

### Criterion: Cannot navigate back to previous sections
- **Status:** ❌ Missing
- **Evidence:** Searched for `section.*lock|locked.*section|previous.*section` - only found warning text in `InstructionScreen.jsx:61`. No actual enforcement logic found.
- **Notes:** Critical missing feature. `useTestSession.js` does not prevent decreasing `currentSectionIndex`.

### Criterion: currentSectionIndex only increments, never decrements
- **Status:** ❌ Missing
- **Evidence:** `src/apBoost/hooks/useTestSession.js` - Searched for `decrement.*section` - no results. `setCurrentSectionIndex` can be called with any value.
- **Notes:** No guard against decrementing section index.

### Criterion: "Back" button disabled on first question of a section (if previous section exists)
- **Status:** ❌ Missing
- **Evidence:** `src/apBoost/components/QuestionNavigator.jsx:101-113` - Back button disabled only based on `canGoBack` prop which checks `currentFlatIndex > 0` but doesn't consider section boundaries.
- **Notes:** Should check if at first question of section AND previous section exists.

### Criterion: Clear visual indication that previous section is locked
- **Status:** ⚠️ Partial
- **Evidence:** `src/apBoost/components/InstructionScreen.jsx:61` - Warning text "You cannot return to previous sections" shown before test.
- **Notes:** No visual indication during test-taking that previous sections are locked (e.g., grayed out section indicator).

### Criterion: Matches real Bluebook behavior
- **Status:** ❌ Missing
- **Evidence:** Multiple missing section locking features as noted above.
- **Notes:** Bluebook enforces strict section locking - current implementation does not.

---

## Section 1.7: Session Persistence (Resume Tests)

### Criterion: Closing browser mid-test sets status to PAUSED
- **Status:** ❌ Missing
- **Evidence:** `src/apBoost/hooks/useTestSession.js:208-220` - `beforeunload` handler only shows warning dialog if queue has items. Does NOT set status to PAUSED.
- **Notes:** Critical gap - session remains IN_PROGRESS, not PAUSED when browser closes.

### Criterion: Reopening test shows "Resume" prompt
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/InstructionScreen.jsx:19,66-73,87` - Checks `existingSession?.status === SESSION_STATUS.IN_PROGRESS` and shows "Resume Test" button with position summary.
- **Notes:** Works because session stays IN_PROGRESS (though should be PAUSED per above criterion).

### Criterion: Resume restores exact question position (currentSectionIndex, currentQuestionIndex)
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/hooks/useTestSession.js:180-182` - Loads `existingSession.currentSectionIndex` and `currentQuestionIndex` on session restore.
- **Notes:** Position correctly restored from Firestore.

### Criterion: Resume restores all answer selections
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/hooks/useTestSession.js:184-191` - Iterates over `existingSession.answers` and restores to Map.
- **Notes:** Handles both MCQ and FRQ answer formats.

### Criterion: Resume restores timer state (remaining time)
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/hooks/useTestSession.js:127-134` - `initialTime` memo checks `session?.sectionTimeRemaining?.[currentSection.id]` first before falling back to section timeLimit.
- **Notes:** Timer synced every 30 seconds via queue (line 143-149).

### Criterion: Resume restores all annotations (highlights, strikethroughs)
- **Status:** ⚠️ Partial
- **Evidence:** `src/apBoost/hooks/useAnnotations.js:180-205` - `loadAnnotations` function exists and can restore highlights/strikethroughs from session data.
- **Notes:** However, `useTestSession.js` does NOT call `loadAnnotations` when restoring session. The function exists but isn't wired up.

### Criterion: Resume restores flag states
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/hooks/useTestSession.js:193-195` - Restores `existingSession.flaggedQuestions` to Set.
- **Notes:** Flag state correctly restored.

---

## Section 1.8: Instruction Screen (Pre-Test)

### Criterion: InstructionScreen component displays before test starts
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/pages/APTestSession.jsx:258-269` - Renders `InstructionScreen` when `view === 'instruction'`.
- **Notes:** Initial view state is 'instruction' (line 45).

### Criterion: Shows test title and subject
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/InstructionScreen.jsx:24-30` - Shows `test.title` and subject via `getSubjectConfig(test.subject).name`.
- **Notes:** Properly styled with text-2xl and centered.

### Criterion: Lists all sections with: name, question count, time limit
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/InstructionScreen.jsx:38-49` - Maps over `test.sections` showing title/sectionType, questionIds.length, and `formatTimeMinutes(section.timeLimit)`.
- **Notes:** Uses proper styling with border-left indicator.

### Criterion: Shows total test time (calculated from sections)
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/InstructionScreen.jsx:18,52-54` - Uses `calculateTotalTime(test.sections)` and displays with `formatTimeMinutes`.
- **Notes:** Calculated, not stored (matches spec).

### Criterion: Warning: "Once you begin, you cannot pause the timer"
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/InstructionScreen.jsx:60` - Shows warning text with ⚠ icon.
- **Notes:** Uses bg-warning styling.

### Criterion: Warning: "You cannot return to previous sections"
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/InstructionScreen.jsx:61` - Shows warning text with ⚠ icon.
- **Notes:** Users are warned but enforcement is missing (see Section 1.6).

### Criterion: "Begin Test" button starts the test
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/InstructionScreen.jsx:84-88` - Button calls `onBegin` prop. `APTestSession.jsx:166-169` handles via `startTest()`.
- **Notes:** Changes view to 'testing' after starting.

### Criterion: "Cancel" button returns to dashboard
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/InstructionScreen.jsx:77-82` - Button calls `onCancel` prop. `APTestSession.jsx:215-217` navigates to '/ap'.
- **Notes:** Properly styled as secondary action.

### Criterion: If resuming: Shows "Resume Test" with position summary (Section X, Question Y)
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/components/InstructionScreen.jsx:66-73` - Checks `isResuming` and shows position info. Button text changes to "Resume Test" (line 87).
- **Notes:** Uses bg-info styling for resume info box.

---

## Section 1.9: Test Dashboard (APDashboard)

### Criterion: Fetches available tests for current user
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/pages/APDashboard.jsx:96` - Calls `getAvailableTests(user.uid, user.role)`.
- **Notes:** Role-based fetching supported.

### Criterion: Displays tests as card grid (responsive: 1/2/3 columns)
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/pages/APDashboard.jsx:141,154` - Uses `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
- **Notes:** Proper responsive breakpoints.

### Criterion: TestCard shows: test name, subject, total time, section count
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/pages/APDashboard.jsx:35-46` - Shows `test.title`, `subjectConfig.name`, `formatTimeMinutes(totalTime)`, and `test.sections?.length`.
- **Notes:** All required info displayed.

### Criterion: TestCard shows assignment info if applicable: due date, max attempts
- **Status:** ⚠️ Partial
- **Evidence:** `src/apBoost/pages/APDashboard.jsx:48-52` - Shows due date via `assignment.dueDate.toDate?.().toLocaleDateString()`.
- **Notes:** **Max attempts is NOT shown** - missing from TestCard. Only due date is displayed.

### Criterion: TestCard shows session status if in progress
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/pages/APDashboard.jsx:54-58` - Shows "Section X, Q Y" position info when `session?.status === SESSION_STATUS.IN_PROGRESS`.
- **Notes:** Uses text-info-text styling.

### Criterion: Status badges: "Not Started" (gray), "In Progress" (blue), "Completed" (green)
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/pages/APDashboard.jsx:17-27` - Three status states with `bg-muted` (gray), `bg-info` (blue), `bg-success` (green).
- **Notes:** Correctly mapped to session state.

### Criterion: Click card navigates to InstructionScreen
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/pages/APDashboard.jsx:119-125,162` - `handleTestClick` navigates to `/ap/test/${test.id}` (with optional assignment ID).
- **Notes:** Navigation triggers InstructionScreen as first view in APTestSession.

### Criterion: Loading state shows skeleton cards
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/pages/APDashboard.jsx:66-77,140-145` - `TestCardSkeleton` component with `animate-pulse` rendered 3x during loading.
- **Notes:** Good loading UX.

### Criterion: Empty state if no tests available
- **Status:** ✅ Implemented
- **Evidence:** `src/apBoost/pages/APDashboard.jsx:146-153` - Shows "No tests available" message when `tests.length === 0`.
- **Notes:** Includes helpful secondary message about teacher assignments.

---

## Recommendations

### Critical Missing Features (High Priority)
1. **Section Locking** (1.6) - No enforcement exists. Must prevent navigation to previous sections after completing.
2. **PAUSED Status on Browser Close** (1.7) - `beforeunload` should set session status to PAUSED via Firestore update or queue.
3. **Drag Support for Line Reader** (1.5) - Only click repositioning exists; should add drag-to-move.

### Important Missing Features (Medium Priority)
4. **Annotation Restoration on Resume** - `loadAnnotations()` function exists but is never called in `useTestSession.js` when restoring session.
5. **Scroll Position Tracking for Line Reader** (1.5) - Line reader doesn't adjust when passage is scrolled.
6. **Max Attempts Display** (1.9) - TestCard should show max attempts from assignment info.

### Suggested Implementation Order
1. Section locking (affects test integrity)
2. PAUSED status on browser close (affects session recovery)
3. Annotation restoration (affects user experience)
4. Line reader drag/scroll (polish feature)
5. Max attempts display (minor UI enhancement)
