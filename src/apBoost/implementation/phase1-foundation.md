# Phase 1: Foundation (MVP)

> **Goal:** Student can see tests, start MCQ test, answer questions, submit, see results

## Prerequisites
- Read `ap_boost_spec_plan.md` sections: 3.1 (Data Model), 5.1-5.4 (UI), 4.1-4.3 (Session State)
- Read plan file Part 6 (Detailed Phase 1 Specs)

---

## Step 1.1: Folder Structure

Create the following structure:

```
/src/apBoost/
├── index.js                     # Exports
├── routes.jsx                   # Route definitions
├── pages/
│   ├── APDashboard.jsx          # Test list
│   ├── APTestSession.jsx        # Test interface
│   └── APReportCard.jsx         # Results page
├── components/
│   ├── APHeader.jsx             # Header with AP branding
│   ├── InstructionScreen.jsx    # Pre-test info
│   ├── TestTimer.jsx            # Countdown display
│   ├── QuestionDisplay.jsx      # Question renderer (VERTICAL/HORIZONTAL)
│   ├── AnswerInput.jsx          # MCQ radio buttons
│   ├── QuestionNavigator.jsx    # Bottom bar + slide-up modal
│   └── ReviewScreen.jsx         # Full-page review before submit
├── services/
│   ├── apTestService.js         # Test CRUD
│   ├── apSessionService.js      # Session CRUD
│   └── apScoringService.js      # Score calculation
├── hooks/
│   ├── useTestSession.js        # Core session state hook
│   └── useTimer.js              # Timer logic
└── utils/
    ├── apTypes.js               # Constants and type definitions
    └── apTestConfig.js          # Subject configs
```

**Verification:**
- [ ] All folders exist
- [ ] Empty placeholder files created

---

## Step 1.2: Routes Setup

**File:** `routes.jsx`

```jsx
import { Route } from 'react-router-dom';
import APDashboard from './pages/APDashboard';
import APTestSession from './pages/APTestSession';
import APReportCard from './pages/APReportCard';

export const apBoostRoutes = (
  <>
    {/* Student Routes */}
    <Route path="/ap" element={<APDashboard />} />
    <Route path="/ap/test/:testId" element={<APTestSession />} />
    <Route path="/ap/test/:testId/assignment/:assignmentId" element={<APTestSession />} />
    <Route path="/ap/results/:resultId" element={<APReportCard />} />
  </>
);
```

**File:** `index.js`

```jsx
export { apBoostRoutes } from './routes';
```

**Integration:** Add to main `App.jsx`:
```jsx
import { apBoostRoutes } from './apBoost';
// In router: {apBoostRoutes}
```

**Verification:**
- [ ] `/ap` route accessible (shows placeholder)
- [ ] No console errors

---

## Step 1.3: APHeader Component

**File:** `components/APHeader.jsx`

**Requirements:**
- Display AP logo (from `/public/apBoost/`)
- Show user name (from auth context)
- Logout button (if applicable)
- Use existing auth context from parent project

**Props:** None (reads from context)

**Styling:**
```
- Background: bg-surface or white
- Border bottom: border-border-default
- Logo height: ~32px
- Padding: px-4 py-3
```

**Verification:**
- [ ] Logo displays correctly
- [ ] User name shows
- [ ] Responsive on mobile

---

## Step 1.4: APDashboard Page

**File:** `pages/APDashboard.jsx`

**Requirements:**
- Fetch available tests for current user
- Display as card grid
- Each card shows: test name, subject, due date, attempts, status

**TestCard subcomponent props:**
```typescript
interface TestCardProps {
  test: {
    id: string;
    name: string;
    subject: string;
    totalTime: number;      // minutes
    sectionCount: number;
  };
  assignment?: {
    dueDate: Timestamp;
    maxAttempts: number;
  };
  session?: {
    status: "IN_PROGRESS";
    currentSection: number;
    currentQuestion: number;
    attemptNumber: number;
  };
  attemptCount: number;
  onClick: () => void;
}
```

**Card Status Badges:**
- `Not Started` - gray
- `In Progress` - blue
- `Completed` - green

**Styling:**
```
- Grid: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4
- Card: bg-surface rounded-[--radius-card] shadow-theme-md p-4 border border-border-default
- Hover: hover:shadow-theme-lg transition
```

**Verification:**
- [ ] Cards display with correct info
- [ ] Click navigates to instruction screen
- [ ] Loading state shows skeleton

---

## Step 1.5: apTestService

**File:** `services/apTestService.js`

**Functions:**

```javascript
/**
 * Fetch tests available to current user
 * Includes both assigned tests and self-practice tests
 */
export async function getAvailableTests(userId, role);

/**
 * Fetch full test with all questions for a test session
 */
export async function getTestWithQuestions(testId);

/**
 * Fetch test metadata only (no questions) for dashboard
 */
export async function getTestMeta(testId);

/**
 * Get assignment details for a student/test combination
 */
export async function getAssignment(testId, userId);
```

**Firestore Queries:**
- Tests: `ap_tests` collection
- Questions: `ap_questions` where `testId == testId`
- Assignments: `ap_assignments` where `studentIds` array contains userId

**Verification:**
- [ ] Returns mock/seeded test data
- [ ] Handles no tests gracefully

---

## Step 1.6: apSessionService

**File:** `services/apSessionService.js`

**Functions:**

```javascript
/**
 * Create new session or resume existing
 */
export async function createOrResumeSession(testId, userId, assignmentId);

/**
 * Update session state
 */
export async function updateSession(sessionId, updates);

/**
 * Save answer to session
 */
export async function saveAnswer(sessionId, questionId, answer);

/**
 * Mark session as completed
 */
export async function completeSession(sessionId);

/**
 * Load existing session
 */
export async function getSession(sessionId);
```

**Session Document Structure:**
```javascript
{
  userId: string,
  testId: string,
  assignmentId: string | null,
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED",
  attemptNumber: number,
  currentSectionIndex: number,
  currentQuestionIndex: number,
  answers: { [questionId]: string },
  flaggedQuestions: [string],
  sectionTimeRemaining: number,
  startedAt: Timestamp,
  lastUpdatedAt: Timestamp,
  completedAt: Timestamp | null,
}
```

**Verification:**
- [ ] Creates new session
- [ ] Resumes existing session
- [ ] Saves answers correctly

---

## Step 1.7: useTestSession Hook

**File:** `hooks/useTestSession.js`

**Core state management hook for test sessions.**

```javascript
export function useTestSession(testId, assignmentId) {
  return {
    // State
    session: Session | null,
    test: Test | null,
    loading: boolean,
    error: Error | null,

    // Position
    currentSection: Section,
    currentQuestion: Question,
    position: { sectionIndex, questionIndex, subQuestionLabel },

    // Navigation
    goToQuestion: (index) => void,
    goNext: () => void,
    goPrevious: () => void,
    canGoNext: boolean,
    canGoPrevious: boolean,

    // Answers
    answers: Map<string, Answer>,
    currentAnswer: Answer | null,
    setAnswer: (answer) => void,

    // Flags
    flags: Set<string>,
    toggleFlag: (questionId) => void,

    // Session control
    startTest: () => Promise<void>,
    submitSection: () => Promise<void>,
    submitTest: () => Promise<string>,

    // Status
    status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED",
    isSubmitting: boolean,
  };
}
```

**Key behaviors:**
- On mount: Load session from Firestore or create new
- On answer change: Debounce save to Firestore (1s)
- On navigation: Immediate save to Firestore
- Track local state optimistically

**Verification:**
- [ ] Loads session on mount
- [ ] Saves answers (debounced)
- [ ] Navigation works correctly

---

## Step 1.8: InstructionScreen Component

**File:** `components/InstructionScreen.jsx`

**Displays before test starts:**

```
┌─────────────────────────────────────────────────────────────────┐
│                        [Test Title]                              │
│                   AP United States History                       │
├─────────────────────────────────────────────────────────────────┤
│  This test has 2 sections:                                      │
│                                                                 │
│  Section 1: Multiple Choice                                     │
│  • 40 questions                                                 │
│  • 45 minutes                                                   │
│                                                                 │
│  Section 2: Free Response                                       │
│  • 3 questions (9 sub-parts total)                              │
│  • 55 minutes                                                   │
│                                                                 │
│  Total time: 1 hour 40 minutes                                  │
│                                                                 │
│  ⚠ Once you begin, you cannot pause the timer.                 │
│  ⚠ You cannot return to previous sections.                     │
│                                                                 │
│                    [Begin Test]                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface InstructionScreenProps {
  test: Test;
  assignment?: Assignment;
  existingSession?: Session;
  onBegin: () => void;
  onCancel: () => void;
}
```

**If resuming:** Show "Resume Test" with position summary.

**Verification:**
- [ ] Shows test info correctly
- [ ] Begin button works
- [ ] Resume shows correct position

---

## Step 1.9: APTestSession Page

**File:** `pages/APTestSession.jsx`

**Main test interface that orchestrates:**
- useTestSession hook
- useTimer hook
- QuestionDisplay, AnswerInput, QuestionNavigator, TestTimer

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ [APHeader]  Section 1 of 3: Multiple Choice    ⏱ 45:23    [≡]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [QuestionDisplay - VERTICAL or HORIZONTAL based on format]    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [QuestionNavigator - bottom bar]                              │
└─────────────────────────────────────────────────────────────────┘
```

**States:**
- `loading` - Show skeleton
- `instruction` - Show InstructionScreen
- `testing` - Show test interface
- `review` - Show ReviewScreen (full page)
- `submitting` - Show submit modal

**Verification:**
- [ ] Loads and shows instruction screen
- [ ] Timer starts on begin
- [ ] Questions display correctly

---

## Step 1.10: QuestionDisplay Component

**File:** `components/QuestionDisplay.jsx`

**Renders question based on format:**

**VERTICAL (no stimulus):**
- Single column with question text and answer choices

**HORIZONTAL (with stimulus):**
- Two columns: left = stimulus, right = question + answers
- Stimulus can be text, passage, image, chart

**Props:**
```typescript
interface QuestionDisplayProps {
  question: Question;
  questionNumber: number;
  stimulus?: Stimulus;
  format: "VERTICAL" | "HORIZONTAL";
  children: ReactNode;  // AnswerInput slot
}
```

**Verification:**
- [ ] VERTICAL layout correct
- [ ] HORIZONTAL layout correct
- [ ] Stimulus renders (text, image)

---

## Step 1.11: AnswerInput Component

**File:** `components/AnswerInput.jsx`

**MCQ radio button group:**

**Props:**
```typescript
interface AnswerInputProps {
  question: Question;
  selectedAnswer: string | null;
  onSelect: (answer: string) => void;
  disabled?: boolean;
  strikethroughs?: Set<string>;
  onStrikethrough?: (choice: string) => void;
}
```

**Renders choices A-J based on question.choiceCount**

**Styling:**
- Unselected: border, white bg
- Selected: filled primary color
- Strikethrough: gray text with line-through

**Verification:**
- [ ] Click selects answer
- [ ] Selection persists
- [ ] Strikethrough works (if enabled)

---

## Step 1.12: useTimer Hook + TestTimer Component

**File:** `hooks/useTimer.js`

```javascript
export function useTimer({
  initialTime,        // Seconds
  onExpire,           // Callback at 0
  isPaused,           // External pause
}) {
  return {
    timeRemaining: number,
    formatted: string,        // "45:30"
    isExpired: boolean,
    pause: () => void,
    resume: () => void,
    reset: (time) => void,
  };
}
```

**No warning thresholds** - timer just counts down.

**File:** `components/TestTimer.jsx`

```typescript
interface TestTimerProps {
  timeRemaining: number;
}
```

**Display:** `45:30` format, monospace font

**Verification:**
- [ ] Counts down correctly
- [ ] Calls onExpire at 0
- [ ] Displays formatted time

---

## Step 1.13: QuestionNavigator Component

**File:** `components/QuestionNavigator.jsx`

**Bottom bar + slide-up modal navigation.**

**Bottom Bar:**
```
┌─────────────────────────────────────────────────────────────────┐
│  [◄ Back]        Question 5 of 20 ▲            [Next ►]        │
└─────────────────────────────────────────────────────────────────┘
```

**Slide-up Modal (on click):**
```
┌─────────────────────────────────────────────────────────────────┐
│                                              [X Close]          │
│                                                                 │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ...                            │
│  │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │                                │
│  │ ■ │ │ ■ │ │ □ │ │ □ │ │🚩│                                │
│  └───┘ └───┘ └───┘ └───┘ └───┘                                │
│                                                                 │
│                    [Go to Review Screen]                        │
└─────────────────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface QuestionNavigatorProps {
  questions: Question[];
  currentIndex: number;
  totalQuestions: number;
  answers: Map<string, Answer>;
  flags: Set<string>;
  onNavigate: (index: number) => void;
  onBack: () => void;
  onNext: () => void;
  onGoToReview: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
}
```

**Box States:**
- Answered: filled/colored (primary)
- Unanswered: white/empty
- Flagged: flag icon, orange border
- Current: ring highlight

**Verification:**
- [ ] Bottom bar shows "Question X of Y"
- [ ] Click opens modal
- [ ] Click box navigates
- [ ] "Go to Review Screen" works

---

## Step 1.14: ReviewScreen Component

**File:** `components/ReviewScreen.jsx`

**Full-page review before submit:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Review Your Answers                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Question grid - same as modal]                               │
│                                                                 │
│  Summary:                                                       │
│  • Answered: 18/20                                              │
│  • Unanswered: 2 (Q7, Q15)                                     │
│  • Flagged: 3                                                   │
│                                                                 │
│  ⚠ You have 2 unanswered questions                             │
│                                                                 │
│  [Return to Questions]     [Submit Section] / [Next Section]   │
└─────────────────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface ReviewScreenProps {
  section: Section;
  questions: Question[];
  answers: Map<string, Answer>;
  flags: Set<string>;
  onGoToQuestion: (index: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  isFinalSection: boolean;
}
```

**Verification:**
- [ ] Shows correct summary
- [ ] Click box navigates back
- [ ] Submit works

---

## Step 1.15: apScoringService

**File:** `services/apScoringService.js`

**Functions:**

```javascript
/**
 * Calculate MCQ score
 */
export function calculateMCQScore(answers, questions, section);

/**
 * Convert percentage to AP score (1-5)
 */
export function calculateAPScore(percentage, scoreRanges);

/**
 * Create test result document
 */
export async function createTestResult(session, test);
```

**Score calculation:**
1. Count correct answers
2. Apply section multiplier
3. Calculate percentage
4. Map to AP score using test.scoreRanges

**Verification:**
- [ ] Correct answers counted
- [ ] Multiplier applied
- [ ] AP score mapped correctly

---

## Step 1.16: APReportCard Page

**File:** `pages/APReportCard.jsx`

**Displays test results:**

```
┌─────────────────────────────────────────────────────────────────┐
│                         SCORE REPORT                            │
│                                                                 │
│  Student: John Smith              Test: AP US History #2        │
│                                                                 │
│                    ┌───────────────────┐                        │
│                    │    AP SCORE: 4    │                        │
│                    └───────────────────┘                        │
│                                                                 │
│  Section 1 (MCQ):     32/40 pts    ████████████░░░░ 80%        │
│                                                                 │
│  MCQ Results Table:                                             │
│  | Q# | Answer | Response | Result |                           │
│  | 1  |   B    |    B     |   ✓    |                           │
│  | 2  |   D    |    C     |   ✗    |                           │
│  ...                                                            │
│                                                                 │
│  [Download Report PDF]  [Back to Dashboard]                     │
└─────────────────────────────────────────────────────────────────┘
```

**Verification:**
- [ ] Shows AP score prominently
- [ ] MCQ table with correct/incorrect
- [ ] Back to dashboard works

---

## Final Verification Checklist

- [ ] `/ap` shows test cards
- [ ] Click test → instruction screen
- [ ] "Begin Test" starts timer
- [ ] Answer MCQ, selection persists
- [ ] Bottom bar shows "Question X of Y"
- [ ] Click → modal with grid boxes
- [ ] Navigate via boxes
- [ ] Flag questions, shows in grid
- [ ] "Go to Review Screen" → full page
- [ ] Submit → creates result
- [ ] Navigate to Report Card
- [ ] Shows AP score and MCQ table

---

## Seed Data Required

Create at least one test in Firestore:

```javascript
// ap_tests/test1
{
  name: "AP US History Practice Exam #1",
  subject: "AP_US_HISTORY",
  sections: [
    {
      id: "section1",
      name: "Multiple Choice",
      sectionType: "MCQ",
      questionIds: ["q1", "q2", "q3", ...],
      timeLimit: 45,
      mcqMultiplier: 1.0
    }
  ],
  questionOrder: "FIXED",
  scoreRanges: {
    ap5: { min: 80, max: 100 },
    ap4: { min: 65, max: 79 },
    ap3: { min: 50, max: 64 },
    ap2: { min: 35, max: 49 },
    ap1: { min: 0, max: 34 }
  }
}

// ap_questions/q1
{
  testId: "test1",
  subject: "AP_US_HISTORY",
  questionType: "MCQ",
  format: "VERTICAL",
  questionText: "Which of the following...",
  choiceA: { text: "First option" },
  choiceB: { text: "Second option" },
  choiceC: { text: "Third option" },
  choiceD: { text: "Fourth option" },
  choiceCount: 4,
  correctAnswers: ["B"],
  points: 1
}
```
