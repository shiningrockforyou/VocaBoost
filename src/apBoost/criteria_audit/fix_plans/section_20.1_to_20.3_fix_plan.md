# Fix Plan: Sections 20.1 to 20.3 (Seed Data & Phase Verification 1-4)

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_20.1_to_20.3_criteria_audit.md

## Executive Summary
- Total Issues: 9
- ⚠️ Partial Implementations: 4
- ❌ Missing Features: 4
- ❓ Needs Investigation: 1
- Estimated Complexity: Medium

---

## Issue 1: FRQ Section for Phase 3 Testing (Seed Data)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Test with FRQ section for Phase 3 testing
- **Current State:** Seed data only includes MCQ section. No FRQ section or FRQ test is seeded.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/seedTestData.js` (lines 15-188) - Contains seedAPTestData function that creates MCQ-only test
  - `src/apBoost/utils/apTypes.js` (lines 6-12, 27-31) - Defines QUESTION_TYPE.FRQ/SAQ/DBQ and SECTION_TYPE.FRQ
- **Current Implementation:** Only one test ("AP US History Practice Exam #1") with MCQ section containing 5 MCQ questions
- **Gap:** No FRQ section exists. No FRQ questions with `subQuestions` array are defined.
- **Dependencies:** apTypes.js provides the type constants needed

### Fix Plan

#### Step 1: Add FRQ Test Document
**File:** `src/apBoost/utils/seedTestData.js`
**Action:** Add new test document after the existing MCQ test
**Details:**
- Create new test document `test_apush_frq_practice_1`
- Set `testType: TEST_TYPE.EXAM` and `hasFRQ: true`
- Include single FRQ section with `sectionType: SECTION_TYPE.FRQ`
- Reference FRQ question IDs: `['frq1', 'frq2']`
- Include proper `scoreRanges` for AP 1-5 conversion

```javascript
// Pattern to follow - add after line 48 (after existing test creation)
const frqTestId = 'test_apush_frq_practice_1'
await setDoc(doc(db, COLLECTIONS.TESTS, frqTestId), {
  title: 'AP US History FRQ Practice',
  subject: 'AP_US_HISTORY',
  testType: TEST_TYPE.EXAM,
  createdBy: 'system',
  isPublic: true,
  hasFRQ: true,
  questionOrder: QUESTION_ORDER.FIXED,
  sections: [{
    id: 'section_frq',
    title: 'Free Response',
    sectionType: SECTION_TYPE.FRQ,
    timeLimit: 60,
    questionIds: ['frq1', 'frq2'],
    calculatorEnabled: false,
  }],
  scoreRanges: { ...DEFAULT_SCORE_RANGES },
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
})
```

#### Step 2: Add FRQ Question Documents
**File:** `src/apBoost/utils/seedTestData.js`
**Action:** Add FRQ questions with `subQuestions` array
**Details:**
- Create 2 FRQ questions with proper structure
- Each question must have `subQuestions` array with `label`, `prompt`, `points`, and optional `rubric`
- Use `questionType: QUESTION_TYPE.SAQ` or `QUESTION_TYPE.DBQ`

```javascript
// FRQ question structure to add
const frqQuestions = [
  {
    id: 'frq1',
    testId: frqTestId,
    subject: 'AP_US_HISTORY',
    questionType: QUESTION_TYPE.SAQ,
    format: QUESTION_FORMAT.VERTICAL,
    questionDomain: 'Unit 5: Early Republic',
    difficulty: 'MEDIUM',
    questionText: 'Answer all parts of the question that follows.',
    subQuestions: [
      { label: 'a', prompt: 'Briefly describe ONE economic change...', points: 3, rubric: '1 pt for identification, 2 pts for explanation' },
      { label: 'b', prompt: 'Briefly explain ONE political consequence...', points: 3, rubric: '...' },
      { label: 'c', prompt: 'Briefly explain ONE social effect...', points: 3, rubric: '...' },
    ],
    points: 9,
  },
  // Add second FRQ question following same pattern
]
```

### Verification Steps
1. Run `seedAPTestData()` in browser console
2. Verify in Firestore: `ap_tests/test_apush_frq_practice_1` exists with `hasFRQ: true`
3. Verify `ap_questions/frq1` and `frq2` exist with `subQuestions` arrays
4. Load APDashboard - new FRQ test should appear
5. Click test - should navigate to test session
6. Verify sub-question navigation works (1a → 1b → 1c)

### Potential Risks
- None - additive change to seed data

---

## Issue 2: Mixed MCQ + FRQ Test (Seed Data)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Test with mixed MCQ + FRQ for full testing
- **Current State:** No mixed test exists in seed data. Only single MCQ section test.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/seedTestData.js` (lines 28-37) - sections array only contains MCQ section
  - `src/apBoost/utils/apTypes.js` (line 30) - `SECTION_TYPE.MIXED` exists
- **Current Implementation:** Only single-section MCQ test
- **Gap:** Need multi-section test with both MCQ and FRQ sections
- **Dependencies:** Requires FRQ questions from Issue 1

### Fix Plan

#### Step 1: Add Mixed Test Document
**File:** `src/apBoost/utils/seedTestData.js`
**Action:** Add new mixed test after FRQ test
**Details:**
- Create test `test_apush_full_exam`
- Include 2 sections: MCQ section (reuse q1-q5) + FRQ section (reuse frq1-frq2)
- Set `hasFRQ: true`

```javascript
const mixedTestId = 'test_apush_full_exam'
await setDoc(doc(db, COLLECTIONS.TESTS, mixedTestId), {
  title: 'AP US History Full Practice Exam',
  subject: 'AP_US_HISTORY',
  testType: TEST_TYPE.EXAM,
  createdBy: 'system',
  isPublic: true,
  hasFRQ: true,
  questionOrder: QUESTION_ORDER.FIXED,
  sections: [
    {
      id: 'section_mcq',
      title: 'Section 1: Multiple Choice',
      sectionType: SECTION_TYPE.MCQ,
      timeLimit: 45,
      questionIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
      mcqMultiplier: 1.0,
      calculatorEnabled: false,
    },
    {
      id: 'section_frq',
      title: 'Section 2: Free Response',
      sectionType: SECTION_TYPE.FRQ,
      timeLimit: 60,
      questionIds: ['frq1', 'frq2'],
      calculatorEnabled: false,
    }
  ],
  scoreRanges: { ...DEFAULT_SCORE_RANGES },
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
})
```

### Verification Steps
1. Run seed function
2. Verify test exists with 2 sections in Firestore
3. Start test - complete MCQ section
4. Verify section transition to FRQ works
5. Submit - verify Report Card shows both section scores

### Potential Risks
- Section transition logic may need verification in `useTestSession.submitSection()`

---

## Issue 3: Assignment Document (Seed Data)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** At least one assignment linking test to students
- **Current State:** No assignment document is seeded.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/seedTestData.js` - No assignment creation code
  - `src/apBoost/utils/apTypes.js` (line 97) - `COLLECTIONS.ASSIGNMENTS = 'ap_assignments'` defined
  - `src/apBoost/services/apGradingService.js` (lines 43-48) - Filters by `classId` implying assignment structure
- **Current Implementation:** No assignment seed data
- **Gap:** Need sample `ap_assignments` document with `testId`, `classId`, `studentIds[]`
- **Dependencies:** Requires ap_classes collection (may also need seed data)

### Fix Plan

#### Step 1: Add Sample Class Document
**File:** `src/apBoost/utils/seedTestData.js`
**Action:** Add class document before assignment
**Details:**
- Create class `class_apush_period1`
- Include `teacherId`, `name`, `studentIds[]`

```javascript
const classId = 'class_apush_period1'
await setDoc(doc(db, COLLECTIONS.CLASSES, classId), {
  name: 'AP US History - Period 1',
  teacherId: 'demo_teacher', // Placeholder
  studentIds: ['demo_student_1', 'demo_student_2'],
  subject: 'AP_US_HISTORY',
  createdAt: serverTimestamp(),
})
```

#### Step 2: Add Assignment Document
**File:** `src/apBoost/utils/seedTestData.js`
**Action:** Add assignment linking test to class
**Details:**
- Create assignment `assignment_apush_exam1`
- Link to MCQ test and class
- Include due date, available dates

```javascript
const assignmentId = 'assignment_apush_exam1'
await setDoc(doc(db, COLLECTIONS.ASSIGNMENTS, assignmentId), {
  testId: testId, // 'test_apush_practice_1'
  classId: classId,
  teacherId: 'demo_teacher',
  title: 'APUSH Practice Exam #1',
  studentIds: ['demo_student_1', 'demo_student_2'],
  availableFrom: serverTimestamp(),
  dueDate: null, // No due date for practice
  allowLateSubmission: true,
  createdAt: serverTimestamp(),
})
```

### Verification Steps
1. Run seed function
2. Verify `ap_classes/class_apush_period1` exists
3. Verify `ap_assignments/assignment_apush_exam1` exists with proper references
4. Verify assignment shows in teacher's assignment list (if implemented)

### Potential Risks
- Teacher/student IDs are placeholders - actual integration needs real user IDs

---

## Issue 4: Submit with Pending Queue Shows Sync Progress

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Submit with pending queue → shows sync progress
- **Current State:** `submitTest` calls `flushQueue()` before creating result if `queueLength > 0`. However, progress modal/UI during flush is not clearly visible.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (lines 396-421) - `submitTest` function
  - `src/apBoost/components/ReviewScreen.jsx` (lines 138-144) - Shows "Submitting..." spinner
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 173-266) - `flushQueue` with `isFlushing` state
- **Current Implementation:**
  - ReviewScreen shows "Submitting..." with spinner during submit
  - `isFlushing` state exposed from useOfflineQueue
  - `queueLength` exposed but not shown in UI
- **Gap:** No specific progress indicator showing "Syncing X items..." before submit
- **Dependencies:** useTestSession exposes `isSyncing` and `queueLength` already

### Fix Plan

#### Step 1: Enhance ReviewScreen Submit Button
**File:** `src/apBoost/components/ReviewScreen.jsx`
**Action:** Show queue sync progress before submission
**Details:**
- Add `isSyncing` and `queueLength` props to ReviewScreen
- Show specific sync message when queue is flushing
- Show different states: "Syncing answers..." → "Submitting..."

```jsx
// Add props
export default function ReviewScreen({
  // ... existing props
  isSyncing,    // NEW
  queueLength,  // NEW
}) {

// Update submit button (lines 133-149)
<button onClick={onSubmit} disabled={isSubmitting || isSyncing}>
  {isSyncing ? (
    <>
      <Spinner />
      Syncing {queueLength} answer{queueLength !== 1 ? 's' : ''}...
    </>
  ) : isSubmitting ? (
    <>
      <Spinner />
      Submitting...
    </>
  ) : (
    isFinalSection ? 'Submit Test' : 'Submit Section'
  )}
</button>
```

#### Step 2: Pass Props from APTestSession
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Pass sync state to ReviewScreen
**Details:**
- Find ReviewScreen render (around line 352-384)
- Add `isSyncing` and `queueLength` props

```jsx
<ReviewScreen
  // ... existing props
  isSyncing={isSyncing}
  queueLength={queueLength}
/>
```

### Verification Steps
1. Answer questions, then go offline (Network tab → Offline)
2. Answer more questions (builds queue)
3. Go online and click "Go to Review Screen"
4. Click "Submit Test" - should show "Syncing X answers..."
5. After sync completes, should show "Submitting..."

### Potential Risks
- Need to disable submit button during sync to prevent double-submit

---

## Issue 5: Cross-Browser Duplicate Detection Timing

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Open in different browser → first browser shows modal within 15s
- **Current State:** BroadcastChannel only works same-browser. Cross-browser detection relies on Firestore `sessionToken` check during heartbeat.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useHeartbeat.js` (lines 8-9) - `HEARTBEAT_INTERVAL = 15000` (15 seconds)
  - `src/apBoost/hooks/useHeartbeat.js` (lines 46-50) - Session takeover detection via `sessionToken` comparison
- **Current Implementation:**
  - Heartbeat interval is correctly set to 15 seconds (line 9)
  - When heartbeat detects different `sessionToken`, sets `sessionTakenOver = true` (line 49)
- **Gap:** None - implementation appears correct per spec. Timing is 15s heartbeat interval.
- **Dependencies:** Works with `useDuplicateTabGuard` for same-browser, heartbeat for cross-browser

### Fix Plan

#### Step 1: Verify Implementation (No Code Change Needed)
**File:** `src/apBoost/hooks/useHeartbeat.js`
**Action:** Documentation/verification only
**Details:**
- Heartbeat interval is correctly 15000ms (line 9)
- `MAX_FAILURES = 3` means detection after max 45 seconds in worst case
- Cross-browser: New browser claims session, old browser's next heartbeat (within 15s) detects `sessionToken` mismatch

### Verification Steps
1. Start test in Chrome, note test session is active
2. Open same test URL in Firefox
3. Firefox should claim session (new `sessionToken`)
4. Chrome should show "Session taken over" modal within 15 seconds
5. Time the actual detection - should be ≤15 seconds from Firefox opening

### Potential Risks
- If heartbeat is in-flight when takeover occurs, detection may take up to 30s (2 intervals)

---

## Issue 6: Connection Unstable Banner Timing

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Disconnect network → "Connection unstable" banner after ~45s
- **Current State:** ConnectionStatus component exists and shows banner based on `isConnected` prop. Timing depends on heartbeat failure count.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/ConnectionStatus.jsx` (lines 40-48) - Disconnected state banner
  - `src/apBoost/hooks/useHeartbeat.js` (lines 8-10) - `HEARTBEAT_INTERVAL = 15000`, `MAX_FAILURES = 3`
  - `src/apBoost/hooks/useHeartbeat.js` (lines 70-76) - Failure count increment and `isConnected` toggle
- **Current Implementation:**
  - Heartbeat every 15 seconds
  - After 3 consecutive failures, `isConnected` becomes false
  - 3 failures × 15s = 45 seconds matches spec
- **Gap:** None - implementation appears correct. Just needs integration testing.
- **Dependencies:** APTestSession must pass `isConnected` to ConnectionStatus

### Fix Plan

#### Step 1: Verify Integration (No Code Change Needed)
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Verify ConnectionStatus receives props
**Details:**
- Check that `isConnected` from useTestSession is passed to ConnectionStatus
- `useTestSession` exposes `isConnected` (line 498)

### Verification Steps
1. Start a test session
2. Open DevTools → Network tab → Set "Offline"
3. Wait and observe:
   - At ~15s: First heartbeat failure
   - At ~30s: Second heartbeat failure
   - At ~45s: Third failure - banner should appear
4. Verify banner says "Connection unstable - your progress is being saved locally"

### Potential Risks
- None - timing is mathematically correct per implementation

---

## Issue 7: Mark Complete → Student Sees Updated Score

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** "Mark Complete" → student sees updated score
- **Current State:** Components exist. Would need integration testing to verify score recalculation and real-time update flow.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/grading/GradingPanel.jsx` (lines 302-314) - `handleMarkComplete` function
  - `src/apBoost/services/apGradingService.js` (lines 165-210) - `saveGrade` with score recalculation
  - `src/apBoost/pages/APReportCard.jsx` (lines 271-297) - `loadResult` on mount only
- **Current Implementation:**
  - GradingPanel calls `saveGrade(resultId, grades, GRADING_STATUS.COMPLETE, ...)`
  - `saveGrade` recalculates `score`, `percentage`, `apScore` and updates Firestore (lines 182-203)
  - APReportCard loads result once on mount - no real-time listener
- **Gap:** APReportCard doesn't have real-time updates. If student has page open while teacher grades, they won't see update without refresh.
- **Dependencies:** Firestore onSnapshot listener needed

### Fix Plan

#### Step 1: Add Firestore Listener to APReportCard
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Replace one-time fetch with real-time listener
**Details:**
- Import `onSnapshot` from firebase/firestore
- Replace `getDoc` with `onSnapshot` in useEffect
- Handle unsubscribe in cleanup

```jsx
// Replace getDoc with onSnapshot (around lines 271-297)
import { onSnapshot } from 'firebase/firestore'

useEffect(() => {
  if (!resultId) return

  setLoading(true)
  setError(null)

  // Real-time listener for result updates
  const unsubscribe = onSnapshot(
    doc(db, COLLECTIONS.TEST_RESULTS, resultId),
    async (docSnap) => {
      if (!docSnap.exists()) {
        setError('Result not found')
        setLoading(false)
        return
      }

      const resultData = { id: docSnap.id, ...docSnap.data() }
      setResult(resultData)

      // Load test metadata (can still be one-time)
      if (resultData.testId && !test) {
        const testData = await getTestMeta(resultData.testId)
        setTest(testData)
      }

      setLoading(false)
    },
    (err) => {
      console.error('Error loading result:', err)
      setError(err.message || 'Failed to load results')
      setLoading(false)
    }
  )

  return () => unsubscribe()
}, [resultId])
```

#### Step 2: Add Visual Feedback for Score Update
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Add transition animation when score updates
**Details:**
- Add CSS transition to APScoreBadge
- Optionally show "Score Updated!" toast when grading completes

### Verification Steps
1. Student submits test with FRQ, opens Report Card (shows "Pending")
2. Keep Report Card open in student's browser
3. Teacher opens Gradebook, grades the FRQ, clicks "Mark Complete"
4. Student's Report Card should update WITHOUT refresh:
   - AP Score badge updates from ⏳ to actual score
   - "Awaiting Grade" banner disappears
   - FRQ points fill in
5. Verify total score and percentage update

### Potential Risks
- Real-time listener uses Firestore quota - consider debouncing or limiting
- Need to handle document deletion edge case

---

## Issue 8: Annotations Visible in Review Mode

### Audit Finding
- **Status:** ❓ Unable to Verify
- **Criterion:** Annotations visible in review mode (read-only)
- **Current State:** ReviewScreen shows question grid but doesn't appear to display annotation details.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/ReviewScreen.jsx` (lines 1-155) - No annotation props or display
  - `src/apBoost/hooks/useAnnotations.js` (lines 1-258) - Full annotation state management
  - `src/apBoost/pages/APTestSession.jsx` - Uses useAnnotations but may not pass to ReviewScreen
- **Current Implementation:**
  - ReviewScreen receives `questions`, `answers`, `flags`, `onGoToQuestion`, etc.
  - ReviewScreen does NOT receive highlights, strikethroughs, or display them
  - QuestionBox only shows answered/flagged state
- **Gap:** Annotations are not passed to or displayed in ReviewScreen
- **Dependencies:** Need to pass annotation state from APTestSession

### Fix Plan

#### Step 1: Add Annotation Props to ReviewScreen
**File:** `src/apBoost/components/ReviewScreen.jsx`
**Action:** Accept and display annotation summary
**Details:**
- Add `highlights` and `strikethroughs` props (Maps from useAnnotations)
- Show annotation indicators in QuestionBox or summary

```jsx
// Add props to ReviewScreen signature
export default function ReviewScreen({
  // ... existing props
  highlights,      // Map<questionId, HighlightRange[]>
  strikethroughs,  // Map<questionId, Set<choiceId>>
}) {

// Calculate annotation counts
const annotatedCount = Array.from(highlights?.keys() || []).length
  + Array.from(strikethroughs?.keys() || []).filter(qId =>
      strikethroughs.get(qId)?.size > 0
    ).length
```

#### Step 2: Update QuestionBox to Show Annotation Indicator
**File:** `src/apBoost/components/ReviewScreen.jsx`
**Action:** Add annotation indicator to QuestionBox
**Details:**
- Show small icon/indicator if question has highlights or strikethroughs
- Keep read-only (no editing in review mode)

```jsx
function QuestionBox({ number, questionId, isAnswered, isFlagged, hasAnnotations, onClick }) {
  return (
    <button ...>
      {isFlagged ? '🚩' : hasAnnotations ? <span className="text-xs">📝</span> : number}
    </button>
  )
}

// In render:
<QuestionBox
  hasAnnotations={
    (highlights?.get(questionId)?.length > 0) ||
    (strikethroughs?.get(questionId)?.size > 0)
  }
/>
```

#### Step 3: Add Annotation Summary to Review Summary
**File:** `src/apBoost/components/ReviewScreen.jsx`
**Action:** Show annotation count in summary section
**Details:**
- Add "Questions with annotations: X" to summary

```jsx
// In Summary section (around line 88-96)
<li>• Answered: {answeredCount}/{totalQuestions}</li>
{annotatedCount > 0 && (
  <li>• With annotations: {annotatedCount}</li>
)}
```

#### Step 4: Pass Annotations from APTestSession
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Pass annotation state to ReviewScreen
**Details:**
- Find where ReviewScreen is rendered
- Pass `highlights` and `strikethroughs` from useAnnotations

### Verification Steps
1. Start test, answer questions
2. Add highlights to some passage text
3. Add strikethroughs to some answer choices
4. Go to Review Screen
5. Verify:
   - Summary shows "With annotations: X"
   - QuestionBox shows 📝 icon for annotated questions
   - Annotations are read-only (can't edit in review mode)

### Potential Risks
- Displaying full annotation details (actual highlight text) in review may clutter UI
- Keep it as indicator only, not full annotation viewer

---

## Implementation Order
Recommended order to implement fixes (considering dependencies):

1. **Issues 1-3 (Seed Data)** - Foundation for testing other features
   - Issue 1: FRQ test and questions (enables FRQ testing)
   - Issue 2: Mixed test (enables full flow testing)
   - Issue 3: Assignment + Class (enables assignment-based access)

2. **Issue 7: Real-time Score Updates** - High user value, independent fix
   - APReportCard onSnapshot listener
   - Most impactful for student experience

3. **Issue 4: Submit Sync Progress** - UX improvement
   - ReviewScreen UI enhancement
   - Builds on existing isSyncing/queueLength

4. **Issues 5 & 6: Timing Verification** - No code changes
   - Integration testing to confirm timing
   - Document results in test plan

5. **Issue 8: Review Mode Annotations** - Lower priority
   - Nice-to-have feature
   - Can be deferred if time-constrained

## Cross-Cutting Concerns

### Type Constants
All fixes should use constants from `src/apBoost/utils/apTypes.js`:
- `QUESTION_TYPE.FRQ`, `QUESTION_TYPE.SAQ`, `QUESTION_TYPE.DBQ`
- `SECTION_TYPE.FRQ`, `SECTION_TYPE.MCQ`
- `COLLECTIONS.TESTS`, `COLLECTIONS.QUESTIONS`, `COLLECTIONS.ASSIGNMENTS`, `COLLECTIONS.CLASSES`

### Seed Data Best Practices
- Include `createdAt: serverTimestamp()` and `updatedAt: serverTimestamp()` on all documents
- Use consistent ID patterns (`test_*`, `frq*`, `class_*`, `assignment_*`)
- Return created IDs from seed function for verification

### Firestore Patterns
- Use `onSnapshot` for real-time updates (Issue 7)
- Always handle unsubscribe in cleanup
- Include error handling for all Firestore operations

## Notes for Implementer

1. **Testing Order**: Implement seed data first (Issues 1-3) as they enable testing of other features

2. **FRQ Sub-question Structure**: Each sub-question must have:
   - `label`: Single letter (a, b, c)
   - `prompt`: The sub-question text
   - `points`: Points for this sub-question
   - `rubric`: (Optional) Grading rubric text

3. **Real-time Listener Quota**: APReportCard real-time listener (Issue 7) counts against Firestore quota. For production, consider:
   - Only enabling listener when `gradingStatus !== 'COMPLETE'`
   - Adding polling fallback for high-traffic scenarios

4. **Review Mode Annotations**: The current fix plan shows indicators only. If full annotation viewing is needed in review mode, that would require additional component work to render highlights/strikethroughs in read-only mode.

5. **Timing Verification**: Issues 5 and 6 don't require code changes but need integration testing. Create test scenarios:
   - Cross-browser: Chrome + Firefox simultaneously
   - Network offline: DevTools Network tab → Offline
   - Document test results for QA sign-off
