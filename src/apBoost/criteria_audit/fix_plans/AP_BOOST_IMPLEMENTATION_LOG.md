# AP Boost Implementation Log

> **Purpose:** Track all code fixes implemented from the criteria audit fix plans.
> **Started:** 2026-01-14
> **Status:** In Progress

---

## Implementation Summary

| Section | Status | Issues Fixed | Date |
|---------|--------|--------------|------|
| 1.1-1.4 | COMPLETE | 8/8 | 2026-01-14 |
| 1.5-1.9 | COMPLETE | 5/5 | 2026-01-14 |
| 1.10-1.12 | COMPLETE | 3/3 | 2026-01-14 |
| 2.1-2.3 | COMPLETE | 6/6 | 2026-01-14 |
| 2.3.1-2.5 | COMPLETE | 4/4 | 2026-01-14 |
| 3.1-3.4 | COMPLETE | 10/11 | 2026-01-14 |
| 4.1-4.5 | COMPLETE | 8/8 | 2026-01-14 |
| 5.1-5.5 | Pending | 0/13 | - |
| 5.6-5.8 | Pending | 0/9 | - |
| 5.9-5.12 | Pending | 0/9 | - |
| 6.1-6.7 | Pending | 0/3 | - |
| 7.1-7.7 | Pending | 0/10 | - |
| 8.1-8.6 | Pending | 0/10 | - |
| 9.1-9.4 | Pending | 0/11 | - |
| 10.1-10.9 | Pending | 0/6 | - |
| 11.1-11.5 | Pending | 0/6 | - |
| 12.1-13.2 | Pending | 0/14 | - |
| 14.1-14.4 | Pending | 0/4 | - |
| 16.1-16.6 | Pending | 0/10 | - |
| 17.1-17.6 | Pending | 0/12 | - |
| 19.1-19.10 | Pending | 0/11 | - |
| 20.1-20.3 | Pending | 0/9 | - |
| 20.4-20.7 | Pending | 0/4 | - |

**Total Progress:** 44/~180 issues

---

## Section 1.1-1.4: Timer, Flags, Highlighter, Strikethrough

**Completed:** 2026-01-14
**Fix Plan:** [1.1_to_1.4-fix-plan-with-codebase-facts.md](fix-plan-with-codebase-facts/1.1_to_1.4-fix-plan-with-codebase-facts.md)

### Issues Implemented

| # | Issue | Status | Files Modified |
|---|-------|--------|----------------|
| 1 | FLAG_TOGGLE idempotent flush | DONE | useOfflineQueue.js |
| 2 | ANNOTATION_UPDATE flush | DONE | useOfflineQueue.js |
| 3 | Timer expiry triggers real submission | DONE | useTestSession.js |
| 4 | Offline timer expiry + submit on reconnect | DONE | useTestSession.js, useOfflineQueue.js |
| 5 | Lifecycle pause (visibility + pagehide) | DONE | useTestSession.js |
| 6 | Review mode flagged list | DONE | ReviewScreen.jsx |
| 7 | Highlighter overlap fix | DONE | Highlighter.jsx |
| 8 | Strikethrough icon + styling | DONE | AnswerInput.jsx |

### Key Changes

#### useOfflineQueue.js
- Added `getDoc`, `runTransaction` imports from firebase/firestore
- Implemented `FLAG_TOGGLE` case in `flushQueue()` with transaction-based read-modify-write
- Implemented `ANNOTATION_UPDATE` case with in-order processing for index stability
- Added `getPendingItems(actionFilter)` helper for querying pending items
- Added `deleteItems(itemIds)` helper for removing processed items

#### useTestSession.js
- Added `autoSubmitTriggeredRef`, `autoSubmitTriggered`, `autoSubmitResultId` state
- Added `submitFunctionsRef` to avoid circular dependency with timer
- Implemented `handleTimerExpire` with:
  - Single-flight guard (prevents race with manual submit)
  - AUTO_SUBMIT queue action for offline persistence
  - Immediate submission if online
- Added `checkPendingAutoSubmit` effect for reconnect handling
- Added `visibilitychange` handler with 30s threshold for mobile backgrounding
- Added `pagehide` handler for reliable timer sync on mobile Safari
- Exposed `autoSubmitTriggered`, `autoSubmitResultId` in return object

#### APTestSession.jsx
- Destructured `autoSubmitTriggered`, `autoSubmitResultId` from useTestSession
- Added `loadAnnotations` from useAnnotations
- Added effect to restore annotations from session on resume
- Added effect to navigate to results when auto-submit completes

#### ReviewScreen.jsx
- Added `flaggedQuestions` array computation
- Updated summary to show flagged question numbers (Q1, Q5, etc.)

#### Highlighter.jsx
- Replaced segment builder with boundary-sweep algorithm
- Creates boundaries for each highlight start/end
- Maintains active highlight stack during sweep
- Top-most highlight wins for overlap regions
- Click removal targets top-most highlight

#### AnswerInput.jsx
- Changed strikethrough icon from plus (`M9 12h6m-3-3v6`) to X (`M6 18L18 6M6 6l12 12`)
- Updated struck choice opacity from `opacity-50` to `opacity-[0.6]`
- Added `text-text-muted` to struck choice text

### Verification Checklist

- [ ] Flag Q1 -> refresh -> flag persists
- [ ] Highlight text -> refresh -> highlight persists
- [ ] Strikethrough choice -> refresh -> strikethrough persists
- [ ] Offline: flag + highlight + strikethrough -> reconnect -> all sync to Firestore
- [ ] Online: timer expires -> auto-submits -> navigates to results
- [ ] Click Submit at 1s remaining -> only one submission occurs
- [ ] Offline: timer expires -> refresh -> reconnect -> submission completes
- [ ] Background tab >30s -> timer pauses on return
- [ ] Background tab <30s -> timer continues
- [ ] Close tab -> reopen session -> time preserved
- [ ] Flagged questions appear in review list with Q#
- [ ] Overlapping highlights don't truncate text
- [ ] Strikethrough button shows X icon
- [ ] Struck choices have muted styling

---

## Section 1.5-1.9: Line Reader, Section Locking, Session Persistence

**Completed:** 2026-01-14
**Fix Plan:** [section_1.5_to_1.9_fix_plan.md](section_1.5_to_1.9_fix_plan.md)

### Issues Implemented

| # | Issue | Status | Files Modified |
|---|-------|--------|----------------|
| 1 | LineReader scroll tracking + drag | DONE | LineReader.jsx |
| 2 | Section lock visual indicator | DONE | APTestSession.jsx |
| 3 | PAUSED status on browser close | DONE | useTestSession.js, apSessionService.js |
| 4 | Annotation persistence (verified) | DONE | (no changes needed) |
| 5 | Dashboard maxAttempts display | DONE | APDashboard.jsx |

### Key Changes

#### LineReader.jsx
- Added `scrollTop` state for scroll offset tracking
- Added scroll event listener on `contentRef.current`
- Scroll-relative positioning: `windowTopRelative = position * lineHeight - scrollTop`
- Added `isDragging` state and `dragStartRef` for drag interaction
- Implemented Pointer Events API handlers (`onPointerDown`, `onPointerMove`, `onPointerUp`)
- Drag calculates delta lines from start position and clamps to maxPosition
- Click handler accounts for scroll offset when repositioning
- Clamped overlay heights to prevent negative values

#### useTestSession.js
- Added `updateSession` import from apSessionService
- Added pause marker write on `pagehide`:
  ```javascript
  localStorage.setItem(`ap_session_pause_${session?.id}`, Date.now().toString())
  ```
- Added pause marker write on `visibilitychange` when hidden
- Added pause marker clear when tab becomes visible again
- On session restore: check for pause marker, apply PAUSED status to Firestore
- On resume: update session status from PAUSED to IN_PROGRESS

#### apSessionService.js
- Updated `getActiveSession()` query to include PAUSED sessions:
  ```javascript
  where('status', 'in', [SESSION_STATUS.IN_PROGRESS, SESSION_STATUS.PAUSED])
  ```

#### APTestSession.jsx
- Added section lock indicator in header (visible when `position.sectionIndex > 0`):
  - Lock icon SVG
  - "Locked" text (hidden on small screens)
  - Tooltip explaining previous sections are locked

#### APDashboard.jsx
- Added max attempts check: `isMaxed = attemptCount >= maxAttempts`
- Disabled test cards when max attempts reached
- Added "Attempts: X / Y" display below test title
- Added "Max Attempts" status with warning styling when maxed

### Findings

1. **Section locking already structurally enforced**: `setCurrentSectionIndex` only increments in `submitSection()`. Navigation is per-section via `flatNavigationItems`. Only added visual indicator.

2. **Annotation persistence already implemented** in section 1.1-1.4: `ANNOTATION_UPDATE` handling in useOfflineQueue.js and restore wiring in APTestSession.jsx. Verified working - no changes needed.

### Verification Checklist

- [ ] Long passage: scroll up/down -> LineReader stays aligned
- [ ] Drag clear window -> position updates smoothly
- [ ] Click on overlay -> repositions correctly with scroll offset
- [ ] Mobile/touch: drag works
- [ ] Lock indicator shows when in section 2+
- [ ] Close tab mid-test -> reopen -> session is PAUSED and resumable
- [ ] Resume session -> status becomes IN_PROGRESS
- [ ] Normal refresh -> should NOT mark as PAUSED incorrectly
- [ ] Assignment with maxAttempts=2: shows "Attempts: 0/2", disables at 2/2
- [ ] Assignment with maxAttempts=-1: no limit shown, never disabled

---

## Section 1.10-1.12: Submit Modal, Header Menu, Toolbar Sticky

**Completed:** 2026-01-14
**Fix Plan:** [1.10_to_1.12-fix-plan-with-codebase-facts.md](fix-plan-with-codebase-facts/1.10_to_1.12-fix-plan-with-codebase-facts.md)

### Issues Implemented

| # | Issue | Status | Files Modified |
|---|-------|--------|----------------|
| 1 | Submit progress modal with retry | DONE | SubmitProgressModal.jsx (new), useTestSession.js, APTestSession.jsx |
| 2 | Header menu button | DONE | TestSessionMenu.jsx (new), QuestionNavigator.jsx, APTestSession.jsx |
| 3 | ToolsToolbar sticky positioning | DONE | PassageDisplay.jsx |

### Key Changes

#### SubmitProgressModal.jsx (NEW)
- Created submission progress modal component
- Props: `isVisible`, `queueLength`, `isSyncing`, `isTimedOut`, `onRetry`
- Two UI states:
  - **Syncing state**: Spinner, "Submitting Test", queue count display
  - **Timed out state**: Warning icon, "Unable to Sync", "Keep Trying" button
- Uses design tokens: `bg-surface`, `rounded-[--radius-card]`, `shadow-theme-xl`, `bg-info`, `bg-warning`

#### TestSessionMenu.jsx (NEW)
- Created slide-up menu component matching QuestionNavigator pattern
- Props: `isOpen`, `onClose`, `onOpenNavigator`, `onExit`
- Menu items:
  - "Go to Question..." → closes menu, opens QuestionNavigator
  - "Exit Test" → shows inline confirmation, then navigates to /ap
- Built-in exit confirmation state (no separate modal)
- Animation: `animate-slide-up` (0.3s ease-out)

#### QuestionNavigator.jsx
- Added controlled mode support via optional props:
  - `isOpen: controlledOpen` - external open state
  - `onOpenChange` - callback to update external state
- Logic: if `controlledOpen !== undefined`, use controlled mode; else use internal state
- Allows menu to programmatically open the navigator

#### useTestSession.js
- Added submission retry state:
  - `submitError` - error message from failed submission
  - `isSubmitTimedOut` - true after 30s of failures
  - `submitStartTimeRef` - tracks submission start time
  - `pendingFrqDataRef` - stores frqData for retry
- Enhanced `submitTest()`:
  - Retry loop with 2s interval
  - After 30s: sets `isSubmitTimedOut = true`, stops auto-retry
  - Keeps `isSubmitting = true` so modal stays visible
- Added `retrySubmit()`:
  - Resets timeout state
  - Restarts submission loop with stored frqData
  - Used by "Keep Trying" button
- Exported: `submitError`, `isSubmitTimedOut`, `retrySubmit`

#### APTestSession.jsx
- Added state:
  - `showMenu` - controls TestSessionMenu visibility
  - `isNavigatorOpen` - controls QuestionNavigator (for menu integration)
- Added hamburger button to header (before section label):
  - SVG icon (three horizontal lines)
  - `w-8 h-8` touch target
  - `hover:bg-hover` feedback
- Integrated TestSessionMenu with handlers:
  - `onClose={() => setShowMenu(false)}`
  - `onOpenNavigator={() => setIsNavigatorOpen(true)}`
  - `onExit={handleCancel}`
- Integrated SubmitProgressModal:
  - `isVisible={isSubmitting}`
  - `queueLength`, `isSyncing`, `isTimedOut={isSubmitTimedOut}`
  - `onRetry={handleRetry}`
- Added `handleRetry` function to navigate on successful retry
- Passed controlled props to QuestionNavigator: `isOpen`, `onOpenChange`

#### PassageDisplay.jsx
- Added sticky positioning to toolbar wrapper:
  ```jsx
  <div className="sticky top-0 z-10 bg-surface shrink-0 pb-3 mb-3 border-b border-border-default">
  ```
- Toolbar now stays pinned while scrolling long passages
- `bg-surface` prevents content showing through

### Verification Checklist

- [ ] Online submit: modal shows briefly → completes → navigates to results
- [ ] Offline submit: modal shows → retries every 2s → 30s timeout → "Unable to sync"
- [ ] "Keep Trying" button: triggers new submission attempt
- [ ] Queue count displayed during sync (X items remaining)
- [ ] Hamburger button visible in test session header
- [ ] Menu opens on hamburger click
- [ ] "Go to Question..." opens QuestionNavigator
- [ ] "Exit Test" shows confirmation → "Cancel" returns to menu → "Exit" navigates to /ap
- [ ] Backdrop click closes menu
- [ ] Long passage: toolbar stays pinned while scrolling
- [ ] Toolbar background is opaque (no content bleed-through)
- [ ] Z-index: no conflicts with other overlays (DuplicateTabModal, QuestionNavigator)

---

## Section 2.1-2.3: MCQ_MULTI Runtime UI + Scoring

**Completed:** 2026-01-14
**Fix Plan:** [7.1_to_7.7-fix-plan-with-codebase-facts.md](fix-plan-with-codebase-facts/7.1_to_7.7-fix-plan-with-codebase-facts.md)

### Issues Implemented

| # | Issue | Status | Files Modified |
|---|-------|--------|----------------|
| 1 | MCQ_MULTI multi-select UI | DONE | AnswerInput.jsx |
| 2 | MCQ_MULTI checkbox visual | DONE | AnswerInput.jsx |
| 3 | MCQ_MULTI scoring (partial + all-or-nothing) | DONE | apScoringService.js |
| 4 | Report Card array formatting | DONE | APReportCard.jsx |
| 5 | PDF array formatting | DONE | generateReportPdf.js |
| 6 | Analytics array key canonicalization | DONE | apAnalyticsService.js |
| 7 | "Select all that apply" hint | DONE | QuestionDisplay.jsx |

### Key Changes

#### AnswerInput.jsx
- Added `QUESTION_TYPE` import from apTypes
- Added `isMulti` detection: `question?.questionType === QUESTION_TYPE.MCQ_MULTI`
- Selection check: MCQ uses `selectedAnswer === letter`, MCQ_MULTI uses `selectedAnswer.includes(letter)`
- Click handler: MCQ_MULTI toggles letter in array, sorts and dedupes before calling `onSelect(sortedArray)`
- Added checkbox UI (square with checkmark) before letter badge for MCQ_MULTI:
  - Unchecked: `border-current opacity-60`
  - Checked: `bg-white border-white text-brand-primary` with SVG checkmark

#### apScoringService.js
- Added `QUESTION_TYPE` import
- Created `calculateMCQMultiScore(studentAnswer, correctAnswers, partialCredit)` helper:
  - Normalizes student answer: string → `[string]`, array → array, else → `[]`
  - Sorts both sets for order-insensitive comparison
  - Partial credit mode: `max(0, (correctSelected - incorrectSelected) / totalCorrect)`
  - All-or-nothing mode: exact set match required
- Updated `calculateMCQScore()` to branch on `question.questionType`:
  - MCQ_MULTI → uses helper, adds fractional points
  - MCQ → keeps existing `includes()` logic
- Updated MCQ results building to include `score` and `questionType` fields
- `correctAnswer` field now shows comma-separated list for multi-answer questions

#### APReportCard.jsx
- Updated `studentAnswer` display to format arrays:
  ```jsx
  {Array.isArray(result.studentAnswer)
    ? result.studentAnswer.slice().sort().join(', ')
    : result.studentAnswer || '—'}
  ```

#### generateReportPdf.js
- Added array formatting before `doc.text()`:
  ```javascript
  const formattedAnswer = Array.isArray(r.studentAnswer)
    ? r.studentAnswer.slice().sort().join(', ')
    : r.studentAnswer || '—'
  ```

#### apAnalyticsService.js
- Canonicalized array keys for distribution bucketing:
  ```javascript
  const answer = Array.isArray(mcqResult.studentAnswer)
    ? mcqResult.studentAnswer.slice().sort().join('')
    : mcqResult.studentAnswer || 'No Answer'
  ```
- Join without separator for stable keys (e.g., "AC" not "A, C")

#### QuestionDisplay.jsx
- Added "Select all that apply" hint after question text in both layouts:
  ```jsx
  {question.questionType === QUESTION_TYPE.MCQ_MULTI && (
    <p className="text-sm text-text-secondary italic mt-2">
      Select all that apply
    </p>
  )}
  ```
- `QUESTION_TYPE` already imported, no new import needed

### Data Contracts

| Context | MCQ | MCQ_MULTI |
|---------|-----|-----------|
| Answer storage | `string \| null` | `string[] \| null` (sorted) |
| Scoring input | `correctAnswers.includes(answer)` | `calculateMCQMultiScore()` |
| Report display | `"B"` | `"A, C"` |
| Analytics key | `"B"` | `"AC"` |

### Verification Checklist

- [ ] MCQ_MULTI: Click A → click C → both show checkmarks
- [ ] MCQ_MULTI: Click A again → A deselects, C stays
- [ ] MCQ: Single-select behavior unchanged (no checkbox)
- [ ] Navigate away/back → MCQ_MULTI selections persist
- [ ] Refresh → selections load from Firestore
- [ ] Scoring: `correctAnswers=["A","C"]`, student=["A","C"] → full credit
- [ ] Scoring: `correctAnswers=["A","C"]`, student=["A"], partialCredit=true → 0.5 credit
- [ ] Scoring: `correctAnswers=["A","C"]`, student=["A","B"], partialCredit=true → 0 credit
- [ ] Report Card: MCQ_MULTI answers display as "A, C"
- [ ] PDF download: MCQ_MULTI answers readable
- [ ] Analytics: MCQ_MULTI distribution loads without errors
- [ ] "Select all that apply" hint shows for MCQ_MULTI only

---

## Section 2.3.1-2.5: FRQ Sub-Answer Persistence, Blur-Save, DBQ Multi-Stimulus

**Completed:** 2026-01-14
**Fix Plan:** Custom plan from analysis (synchronous-exploring-frost.md)

### Issues Implemented

| # | Issue | Status | Files Modified |
|---|-------|--------|----------------|
| 1 | FRQ sub-answer data loss during queue flush | DONE | useOfflineQueue.js |
| 2 | FRQTextInput blur-save handler | DONE | FRQTextInput.jsx, APTestSession.jsx |
| 3 | DBQ multi-document stimulus display | DONE | FRQQuestionDisplay.jsx |
| 4 | SAQ/DBQ manual grading verification | DONE | (no changes needed - verified working) |

### Key Changes

#### useOfflineQueue.js
- **Critical fix**: ANSWER_CHANGE now uses nested Firestore paths for FRQ sub-questions
- Added deduplication by `(questionId, subQuestionLabel)` using Map
- Before: `updates[\`answers.${questionId}\`] = value` (overwrote entire answer)
- After:
  ```javascript
  if (subQuestionLabel) {
    updates[`answers.${questionId}.${subQuestionLabel}`] = value  // Nested path
  } else {
    updates[`answers.${questionId}`] = value  // MCQ - direct
  }
  ```
- Last-write-wins per key: `${questionId}:${subQuestionLabel || '__single__'}`

#### FRQTextInput.jsx
- Added `onBlur` prop with default `null`
- Added `lastBlurValueRef` to dedupe repeated blur saves
- Added `handleBlur` function:
  ```javascript
  const handleBlur = () => {
    if (onBlur && value !== lastBlurValueRef.current) {
      onBlur(value)
      lastBlurValueRef.current = value
    }
  }
  ```
- Wired `onBlur={handleBlur}` to textarea element

#### APTestSession.jsx
- Wired `onBlur={setAnswer}` to FRQTextInput component
- Provides blur-save safety net in addition to debounced onChange

#### FRQQuestionDisplay.jsx
- Added `useState` import
- Created `DocumentSelector` component:
  - Scrollable tab bar for document switching
  - Active state styling with `bg-brand-primary`
  - Supports `doc.title` or falls back to "Doc N"
- Added stimulus detection logic:
  ```javascript
  const stimulusInput = stimulus || question.stimulus || question.stimuli
  const isMultiStimulus = Array.isArray(stimulusInput)
  const stimuliArray = isMultiStimulus ? stimulusInput : (stimulusInput ? [stimulusInput] : [])
  const activeStimulus = stimuliArray[activeDocIndex] || null
  ```
- Added `activeDocIndex` state for document navigation
- Renders DocumentSelector when `isMultiStimulus && stimuliArray.length > 1`
- Backward compatible with single stimulus (no visual change)

### Data Contracts

| Context | Single Stimulus | Multi Stimulus (DBQ) |
|---------|-----------------|----------------------|
| Input | `question.stimulus: object` | `question.stimuli: object[]` or `stimulus: object[]` prop |
| Storage | `answers[qId] = "text"` | `answers[qId] = { a: "text", b: "text" }` |
| Flush path | `answers.${qId}` | `answers.${qId}.${subLabel}` |

### Verification Checklist

- [ ] FRQ: Answer part (a), then part (b), wait for flush → Firestore has BOTH
- [ ] FRQ: Offline → answer (a), answer (b), refresh, go online → both persist
- [ ] FRQ: Navigate away → back → both sub-answers present
- [ ] MCQ: Answers still work correctly (regression)
- [ ] Blur: Type text → click outside textarea → answer is queued
- [ ] Blur: Type nothing → blur → no duplicate queue entry
- [ ] DBQ: Array stimuli → document tabs appear
- [ ] DBQ: Click tabs → content switches correctly
- [ ] DBQ: Single stimulus → renders unchanged (no tabs)
- [ ] DBQ: 6+ documents → tabs scroll horizontally

---

## Files Created/Modified Index

### Files Created
| File | Section | Purpose |
|------|---------|---------|
| SubmitProgressModal.jsx | 1.10-1.12 | Submission progress modal with syncing/timeout states |
| TestSessionMenu.jsx | 1.10-1.12 | Slide-up menu with exit confirmation |
| apStimuliService.js | 3.1-3.4 | CRUD service for shared stimuli (ap_stimuli collection) |

### Files Modified
| File | Sections | Changes |
|------|----------|---------|
| useOfflineQueue.js | 1.1-1.4, 2.3.1-2.5 | FLAG_TOGGLE, ANNOTATION_UPDATE flush, getPendingItems, deleteItems, FRQ sub-answer nested paths, answer deduplication |
| useTestSession.js | 1.1-1.4, 1.5-1.9, 1.10-1.12 | Timer auto-submit, visibility/pagehide handlers, checkPendingAutoSubmit, pause markers, submission retry state machine |
| APTestSession.jsx | 1.1-1.4, 1.5-1.9, 1.10-1.12, 2.3.1-2.5 | Annotation restore, auto-submit navigation, section lock indicator, hamburger menu, SubmitProgressModal integration, FRQTextInput onBlur wiring |
| FRQTextInput.jsx | 2.3.1-2.5 | onBlur prop, dedupe guard with lastBlurValueRef, handleBlur function |
| FRQQuestionDisplay.jsx | 2.3.1-2.5 | DocumentSelector component, multi-stimulus detection, activeDocIndex state, array stimuli support |
| ReviewScreen.jsx | 1.1-1.4 | Flagged questions list |
| Highlighter.jsx | 1.1-1.4 | Boundary-sweep algorithm |
| AnswerInput.jsx | 1.1-1.4, 2.1-2.3 | X icon, muted styling, MCQ_MULTI multi-select UI + checkbox |
| LineReader.jsx | 1.5-1.9 | Scroll tracking, drag interaction via Pointer Events |
| apSessionService.js | 1.5-1.9 | PAUSED status included in getActiveSession query |
| APDashboard.jsx | 1.5-1.9 | Max attempts display and enforcement |
| QuestionNavigator.jsx | 1.10-1.12 | Controlled mode support (isOpen/onOpenChange props) |
| PassageDisplay.jsx | 1.10-1.12 | Sticky toolbar positioning |
| apScoringService.js | 2.1-2.3 | MCQ_MULTI scoring helper, branch on questionType, mcqResults with score/questionType |
| APReportCard.jsx | 2.1-2.3 | Array answer formatting for MCQ_MULTI |
| generateReportPdf.js | 2.1-2.3 | Array answer formatting for PDF |
| apAnalyticsService.js | 2.1-2.3 | Array key canonicalization for distribution |
| QuestionDisplay.jsx | 2.1-2.3 | "Select all that apply" hint for MCQ_MULTI |
| apQuestionService.js | 3.1-3.4 | rubric/tags fields in createQuestion, tag filtering in searchQuestions |
| APQuestionEditor.jsx | 3.1-3.4 | rubric/tags UI fields with load/save support |
| apScoringService.js | 3.1-3.4 | frqMaxPoints calculation with frqMultipliers |
| apGradingService.js | 3.1-3.4 | calculateFRQScore with multipliers, saveGrade fetches test |
| apTestService.js | 3.1-3.4 | stimulusId resolution in getTestWithQuestions |
| PassageDisplay.jsx | 1.10-1.12, 3.1-3.4 | Sticky toolbar, title rendering for stimuli |
| seedTestData.js | 3.1-3.4 | title/tags in stimulus example |
| apTypes.js | 3.1-3.4 | ACTIVE alias for SESSION_STATUS |

---

## Implementation Notes

### Patterns Established

1. **Transaction-based queue flush**: Use `runTransaction` for array field updates (flags, annotations)
2. **Last-write-wins deduplication**: For FLAG_TOGGLE, keep only last action per questionId
3. **In-order processing**: For ANNOTATION_UPDATE, process in queue order for index stability
4. **Single-flight guards**: Use ref + state combo for preventing race conditions
5. **Boundary-sweep algorithm**: For overlapping ranges, create start/end boundaries and sweep
6. **localStorage pause markers**: Write timestamp on pagehide, apply status on restore, clear on success
7. **Pointer Events API**: Use for cross-platform drag interaction (pointerdown/move/up + setPointerCapture)
8. **Scroll-relative positioning**: Track scrollTop state and subtract from absolute position for overlays
9. **Submission retry loop**: 2s interval with 30s timeout, keep `isSubmitting=true` to maintain modal visibility
10. **Controlled component pattern**: Support both internal and external state via optional props (isOpen/onOpenChange)
11. **Slide-up modal pattern**: Fixed backdrop + absolute bottom panel with `animate-slide-up` animation
12. **Inline confirmation**: Handle confirmation state within menu component rather than separate modal
13. **Array answer storage**: MCQ_MULTI stores sorted arrays (`["A", "C"]`), MCQ stores strings (`"B"`)
14. **Partial credit formula**: `max(0, (correctSelected - incorrectSelected) / totalCorrect)` with penalty for wrong selections
15. **Array key canonicalization**: Join without separator for object keys (e.g., `"AC"`) to avoid spacing variants
16. **Format arrays for display**: `arr.slice().sort().join(', ')` for human-readable output
17. **Nested Firestore paths for sub-answers**: Use `answers.${questionId}.${subQuestionLabel}` for FRQ sub-questions to avoid overwriting sibling parts
18. **Answer deduplication by composite key**: Dedupe by `${questionId}:${subQuestionLabel || '__single__'}` for last-write-wins per sub-answer
19. **Blur-save dedupe guard**: Track `lastBlurValueRef` to avoid duplicate saves when value unchanged
20. **Multi-stimulus detection**: Check `Array.isArray(stimulus)` and normalize to array for consistent rendering
21. **Additive schema changes**: Default missing fields to fallback values (e.g., `frqMultipliers?.[id] || 1`) to avoid migrations
22. **Batch stimulus resolution**: Dedupe stimulusIds before fetching, resolve all at once with `getStimuliByIds()`
23. **Multiplier map building**: Flatten section-level multipliers into single map for scoring: `buildFrqMultipliersMap(sections)`
24. **Alias constants for spec compatibility**: Add alias (e.g., `ACTIVE: 'IN_PROGRESS'`) rather than changing stored values

### Design Tokens Used
- `opacity-[0.6]` for struck choices
- `text-text-muted` for struck text
- Existing tokens: `bg-surface`, `border-border-default`, etc.

### Testing Considerations
- Offline testing requires disabling network in DevTools
- Timer testing can use short timeouts (e.g., 10s) for verification
- Mobile backgrounding requires actual device or browser visibility API simulation

---

## Section 3.1-3.4: Data Model (FRQ Multipliers, Stimuli Service, Question Metadata)

**Completed:** 2026-01-14
**Fix Plan:** [BATCH_AUTOMATION_INSTRUCTIONS.md](../BATCH_AUTOMATION_INSTRUCTIONS.md)

### Issues Implemented

| # | Issue | Status | Files Modified |
|---|-------|--------|----------------|
| 1 | frqMultipliers missing from FRQ sections | DONE | apScoringService.js, apGradingService.js |
| 2 | ap_stimuli service missing | DONE | apStimuliService.js (new) |
| 3 | stimulusId not resolved in getTestWithQuestions | DONE | apTestService.js |
| 4 | stimulus.title not displayed | DONE | PassageDisplay.jsx |
| 5 | stimulus.tags missing | DONE | seedTestData.js |
| 6 | question.rubric missing | DONE | apQuestionService.js, APQuestionEditor.jsx |
| 7 | question.tags missing | DONE | apQuestionService.js, APQuestionEditor.jsx |
| 8 | searchQuestions tag filtering | DONE | apQuestionService.js |
| 9 | IN_PROGRESS vs ACTIVE status mismatch | DONE | apTypes.js (alias added) |
| 10 | calculateTotalTime helper missing | SKIP | Already exists in apTestConfig.js |
| 11 | Answer shape mismatch (flaggedQuestions) | SKIP | Keep current design (no migration) |

### Key Changes

#### apQuestionService.js
- Added `rubric` and `tags` fields to `createQuestion()`:
  ```javascript
  rubric: questionData.rubric || null,
  tags: questionData.tags || [],
  ```
- Added tag filtering to `searchQuestions()`:
  ```javascript
  if (filters.tag) {
    constraints.push(where('tags', 'array-contains', filters.tag))
  }
  ```
- Updated JSDoc to document `filters.tag` parameter

#### APQuestionEditor.jsx
- Added state: `rubric`, `tagsInput` (comma-separated string)
- Added load logic to populate from existing question
- Added UI: tags input field in metadata section, rubric textarea (FRQ types only)
- Added save logic: parse tags to array, include rubric for FRQ types

#### apScoringService.js
- Added FRQ max points calculation with multipliers in `createTestResult()`:
  ```javascript
  let frqMaxPoints = 0
  for (const section of test.sections) {
    if (section.sectionType === SECTION_TYPE.FRQ || section.sectionType === SECTION_TYPE.MIXED) {
      for (const questionId of section.questionIds || []) {
        const question = test.questions[questionId]
        const multiplier = section.frqMultipliers?.[questionId] || 1
        const questionMaxPoints = (question.subQuestions || []).reduce(...)
        frqMaxPoints += questionMaxPoints * multiplier
      }
    }
  }
  ```
- Replaced hardcoded `frqMaxPoints: 0` with calculated value

#### apGradingService.js
- Added `SECTION_TYPE` import
- Added `buildFrqMultipliersMap(sections)` helper function
- Updated `calculateFRQScore(grades, frqMultipliers = {})` to accept and apply multipliers:
  ```javascript
  for (const [questionId, questionGrade] of Object.entries(grades)) {
    const multiplier = frqMultipliers[questionId] || 1
    // Sum sub-scores and apply multiplier
    total += questionTotal * multiplier
  }
  ```
- Updated `saveGrade()` to fetch test and build multipliers map before scoring

#### apStimuliService.js (NEW)
- Created complete CRUD service for shared stimuli
- Functions:
  - `getStimulusById(stimulusId)` - single fetch
  - `getStimuliByIds(stimulusIds)` - batch fetch with deduplication
  - `searchStimuli(filters)` - search with type/tag/creator filters
  - `createStimulus(stimulusData)` - create with title/tags support
  - `updateStimulus(stimulusId, updates)` - partial update
  - `deleteStimulus(stimulusId)` - delete
- Uses existing patterns: `db` import from `../../firebase`, `logError` utility

#### apTestService.js
- Added `getStimuliByIds` import from apStimuliService
- Added stimulus resolution in `getTestWithQuestions()`:
  ```javascript
  const stimulusIds = Object.values(questionsMap)
    .filter((q) => q.stimulusId && !q.stimulus)
    .map((q) => q.stimulusId)

  if (stimulusIds.length > 0) {
    const stimuli = await getStimuliByIds(stimulusIds)
    for (const question of Object.values(questionsMap)) {
      if (question.stimulusId && !question.stimulus && stimuli[question.stimulusId]) {
        question.stimulus = stimuli[question.stimulusId]
      }
    }
  }
  ```

#### PassageDisplay.jsx
- Updated props destructuring to include `title`
- Added title rendering for both image and text stimuli:
  ```jsx
  {title && (
    <h3 className="text-base font-semibold text-text-primary mb-3">{title}</h3>
  )}
  ```

#### seedTestData.js
- Added `title` and `tags` to existing stimulus example:
  ```javascript
  stimulus: {
    type: 'PASSAGE',
    title: 'Document A: Observations on American Manufacturing',
    content: '...',
    source: 'Harriet Martineau, Society in America, 1837',
    tags: ['primary-source', 'industrial-revolution', 'market-revolution'],
  }
  ```

#### apTypes.js
- Added `ACTIVE` alias to `SESSION_STATUS`:
  ```javascript
  ACTIVE: 'IN_PROGRESS', // Alias for spec compatibility
  ```

### Design Decisions

1. **No data migrations**: All changes are additive. Missing `frqMultipliers` default to 1, missing `rubric`/`tags` default to null/[].

2. **Keep separate flaggedQuestions array**: The audit document recommended not changing answer shape to embedded objects. Current design with separate `flaggedQuestions` array is cleaner.

3. **calculateTotalTime already exists**: Confirmed in `apTestConfig.js:114-116`. No duplicate needed.

4. **ACTIVE alias approach**: Rather than changing stored values from IN_PROGRESS to ACTIVE (which would require migration), added an alias constant for spec compatibility.

### Verification Checklist

- [ ] Create question with rubric and tags via editor → persists in Firestore
- [ ] Search questions by tag → filters correctly
- [ ] Create FRQ section with `frqMultipliers: { q1: 2 }` → frqMaxPoints calculated correctly
- [ ] Grade FRQ → weighted score applies multiplier
- [ ] Create stimulus in ap_stimuli → can be fetched via service
- [ ] Question with stimulusId (no inline stimulus) → stimulus resolves on test load
- [ ] Stimulus with title → title displays in PassageDisplay
- [ ] SESSION_STATUS.ACTIVE === SESSION_STATUS.IN_PROGRESS → true

### Files Created/Modified

| File | Type | Changes |
|------|------|---------|
| apStimuliService.js | NEW | Complete CRUD service for shared stimuli |
| apQuestionService.js | Modified | rubric/tags fields, tag filtering |
| APQuestionEditor.jsx | Modified | rubric/tags UI fields |
| apScoringService.js | Modified | frqMaxPoints calculation with multipliers |
| apGradingService.js | Modified | calculateFRQScore with multipliers, saveGrade fetches test |
| apTestService.js | Modified | stimulusId resolution |
| PassageDisplay.jsx | Modified | title rendering |
| seedTestData.js | Modified | title/tags in stimulus example |
| apTypes.js | Modified | ACTIVE alias |

---

## Section 4.1-4.5: Authorization, Indexes, Defaults, Field Aliases

**Completed:** 2026-01-14
**Fix Plan:** [4.1_to_4.5-fix-plan-with-codebase-facts.md](fix-plan-with-codebase-facts/4.1_to_4.5-fix-plan-with-codebase-facts.md)

### Issues Implemented

| # | Issue | Status | Files Modified |
|---|-------|--------|----------------|
| 1 | Missing Firestore indexes for AP collections | DONE | firestore.indexes.json |
| 2 | isPublic vs isPublished field mismatch (NEW) | DONE | apTestService.js |
| 3 | No access control - direct URL bypass | DONE | apTestService.js, apSessionService.js, useTestSession.js |
| 4 | Grading query missing teacherId filter (NEW) | DONE | apGradingService.js |
| 5 | maxAttempts defaults to 1 (spec says 3) | DONE | AssignTestModal.jsx, apTeacherService.js |
| 6 | FRQ field name aliases missing | DONE | apScoringService.js, apGradingService.js |
| 7 | Security rules too permissive for teachers | DONE | firestore.rules |

### Key Changes

#### firestore.indexes.json
- **Merged** 6 AP-specific indexes (preserved existing `attempts` indexes):
  - `ap_session_state`: `(testId, userId, status)` - session lookup
  - `ap_tests`: `(createdBy, createdAt desc)` - teacher's tests
  - `ap_classes`: `(teacherId, name)` - teacher's classes
  - `ap_assignments`: `(testId, assignedAt desc)` - assignment lookup
  - `ap_test_results`: `(gradingStatus, completedAt desc)` - grading queue
  - `ap_test_results`: `(teacherId, gradingStatus, completedAt desc)` - teacher-isolated grading

#### apTestService.js
- Fixed `getAvailableTests()` query from `isPublic` to `isPublished`:
  ```javascript
  where('isPublished', '==', true)
  ```
- Added `canAccessTest(testId, userId)` function:
  ```javascript
  export async function canAccessTest(testId, userId) {
    // Check if test is published (publicly available)
    const testDoc = await getDoc(doc(db, COLLECTIONS.TESTS, testId))
    if (testDoc.exists() && testDoc.data().isPublished) {
      return { allowed: true, reason: 'public' }
    }
    // Check if user is assigned to this test
    const assignment = await getAssignment(testId, userId)
    if (assignment) {
      return { allowed: true, reason: 'assigned', assignmentId: assignment.id }
    }
    return { allowed: false, reason: 'unauthorized' }
  }
  ```

#### apSessionService.js
- Added `canAccessTest` import
- Added access check at start of `createOrResumeSession()`:
  ```javascript
  const access = await canAccessTest(testId, userId)
  if (!access.allowed) {
    throw new Error('Access denied: You are not authorized to take this test')
  }
  const resolvedAssignmentId = assignmentId || access.assignmentId || null
  ```
- Session now uses resolved assignmentId from access check

#### useTestSession.js
- Added `canAccessTest` import
- Added access check in `loadTestAndSession()` before loading test content:
  ```javascript
  const access = await canAccessTest(testId, user.uid)
  if (!access.allowed) {
    setError('You are not authorized to access this test')
    setLoading(false)
    return
  }
  ```
- Prevents test content from loading for unauthorized users

#### apGradingService.js
- Added teacherId filter to `getPendingGrades()` for teacher isolation:
  ```javascript
  constraints.push(where('teacherId', '==', teacherId))
  ```
- Added `frqGradedPdfUrl` alias when saving annotated PDF:
  ```javascript
  if (annotatedPdfUrl) {
    updateData.annotatedPdfUrl = annotatedPdfUrl
    updateData.frqGradedPdfUrl = annotatedPdfUrl // Alias for spec compatibility
  }
  ```

#### AssignTestModal.jsx
- Changed default from `useState(1)` to `useState(3)`:
  ```javascript
  const [maxAttempts, setMaxAttempts] = useState(3)
  ```

#### apTeacherService.js
- Changed fallback from `|| 1` to `?? 3` (safer nullish coalescing):
  ```javascript
  maxAttempts: assignmentData.maxAttempts ?? 3,
  ```

#### apScoringService.js
- Added FRQ alias fields in `createTestResult()`:
  ```javascript
  frqUploadedFiles: frqData?.frqUploadedFiles || null,
  frqUploadUrl: frqData?.frqUploadedFiles?.[0]?.url || null, // Alias
  annotatedPdfUrl: null,
  frqGradedPdfUrl: null, // Alias
  ```

#### firestore.rules
- Tightened `ap_test_results` update rule for teacher isolation:
  ```javascript
  allow update: if isAuthenticated() && (
    resource.data.userId == request.auth.uid ||
    (isTeacher() && resource.data.teacherId == request.auth.uid)
  );
  ```

### Validation Findings (Pre-Implementation)

Before implementing, we validated the fix plan's assumptions:

| Assumption | Validation Result |
|------------|-------------------|
| `getAssignment()` returns `{id, ...data}` | ✅ Confirmed |
| `isPublic` vs `isPublished` mismatch | ✅ NEW ISSUE discovered |
| No access checks in session flow | ✅ Confirmed - complete bypass possible |
| No AP indexes exist | ✅ Confirmed - only `attempts` indexes |
| AP security rules exist | ✅ Better than expected - rules present but permissive |
| Grading missing teacherId filter | ✅ NEW ISSUE discovered |
| FRQ shape is `{name, url, ...}[]` | ✅ Confirmed for alias derivation |

### Security Model After Changes

| Collection | Read | Create | Update |
|------------|------|--------|--------|
| ap_session_state | Owner only | Owner only | Owner only |
| ap_test_results | Owner OR teacher | Owner only | Owner OR owner's teacher |
| ap_tests | All authenticated | Teachers | Teachers |
| ap_classes | All authenticated | Teachers | Teachers |
| ap_assignments | All authenticated | Teachers | Teachers |

### Verification Checklist

- [ ] Deploy indexes: `firebase deploy --only firestore:indexes`
- [ ] Deploy rules: `firebase deploy --only firestore:rules`
- [ ] Unauthorized user visiting `/ap/test/:testId` → sees "You are not authorized" error
- [ ] Unauthorized user cannot create session (error thrown)
- [ ] Assigned student can load and take test normally
- [ ] Published test (`isPublished=true`) accessible to all authenticated users
- [ ] Teacher A cannot see Teacher B's pending grades
- [ ] Teacher A can only update results where `teacherId == A`
- [ ] New assignment defaults to 3 attempts in UI
- [ ] New FRQ result contains both `frqUploadedFiles` and `frqUploadUrl`
- [ ] Graded result contains both `annotatedPdfUrl` and `frqGradedPdfUrl`
- [ ] No "missing index" errors in Firebase console

### Files Modified

| File | Changes |
|------|---------|
| firestore.indexes.json | Added 6 AP-specific indexes |
| firestore.rules | Tightened teacher update rule for results |
| apTestService.js | Fixed isPublished query, added canAccessTest() |
| apSessionService.js | Added access check in createOrResumeSession() |
| useTestSession.js | Added access check before loading test content |
| apGradingService.js | Added teacherId filter, frqGradedPdfUrl alias |
| apScoringService.js | Added frqUploadUrl and frqGradedPdfUrl aliases |
| apTeacherService.js | Fixed maxAttempts fallback to ?? 3 |
| AssignTestModal.jsx | Fixed maxAttempts default to 3 |
