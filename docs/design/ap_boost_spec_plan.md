# apBoost Specification & Implementation Plan

> AP Exam Practice Test System - Bluebook-style interface for AP exam preparation

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Data Model](#3-data-model)
4. [Session State Management](#4-session-state-management)
5. [UI/UX Specification](#5-uiux-specification)
6. [Implementation Phases](#6-implementation-phases)
7. [Verification Checklist](#7-verification-checklist)

---

## 1. Overview

### 1.1 Purpose

apBoost is a practice test system that mimics the College Board's Bluebook application, allowing students to practice AP exams in a realistic testing environment.

### 1.2 Key Features

| Feature | Description |
|---------|-------------|
| Timed sections | Per-section countdown timers with pause capability |
| Question flagging | Mark questions for review |
| Highlighter | Highlight text in passages/stimuli |
| Strikethrough | Cross out MCQ answer options |
| Line reader | Focus tool for reading passages |
| Section locking | Cannot return to previous sections (like real Bluebook) |
| Session persistence | Resume tests after browser close |

### 1.3 Supported Question Types

- **MCQ** - Multiple choice questions (auto-scored)
- **FRQ** - Free response questions (manual/AI grading)
- **SAQ** - Short answer questions
- **DBQ** - Document-based questions

### 1.4 User Roles

| Role | Capabilities |
|------|--------------|
| Student | Take tests, view scores, review completed tests |
| Teacher | Create tests, assign to classes, view student results |
| Admin | Manage question bank, create public tests |

---

## 2. Architecture

### 2.1 Folder Structure

```
/src/apBoost/                    # ALL apBoost code lives here
├── pages/
│   ├── APDashboard.jsx          # Student: available tests, progress
│   ├── APTestSession.jsx        # Main test-taking interface
│   ├── APTestReview.jsx         # Review completed test (quick view after submit)
│   ├── APReportCard.jsx         # Full results page (student view)
│   ├── APTeacherDashboard.jsx   # Teacher: manage tests, view results
│   ├── APGradebook.jsx          # Teacher: grade FRQs, view student results
│   ├── APExamAnalytics.jsx      # Teacher: test performance heatmaps
│   ├── APStudentProfile.jsx     # Teacher: AP-specific student overview (stub)
│   ├── APTestEditor.jsx         # Create/edit tests
│   └── APQuestionBank.jsx       # Browse/search question bank
├── components/
│   ├── APHeader.jsx             # Header with AP branding
│   ├── APErrorBoundary.jsx      # Catches render errors
│   ├── ErrorFallback.jsx        # Error UI with retry/dashboard links
│   ├── TestTimer.jsx            # Countdown timer per section
│   ├── QuestionDisplay.jsx      # Renders question based on type
│   ├── AnswerInput.jsx          # MCQ options, text input for FRQ
│   ├── QuestionNavigator.jsx    # Question list with flag status
│   ├── ReviewScreen.jsx         # Summary before submit
│   ├── ConnectionStatus.jsx     # "Connection unstable" banner
│   ├── DuplicateTabModal.jsx    # Block duplicate tab modal
│   ├── SessionSkeleton.jsx      # Loading skeleton for session
│   ├── tools/
│   │   ├── Highlighter.jsx      # Text highlighting tool
│   │   ├── Strikethrough.jsx    # Strike-through for MCQ options
│   │   └── LineReader.jsx       # Focus line reader
│   ├── stimulus/
│   │   ├── PassageDisplay.jsx   # Reading passages with tools
│   │   └── ImageDisplay.jsx     # Images/charts
│   ├── grading/
│   │   ├── GradingPanel.jsx     # Teacher side-panel for FRQ grading
│   │   ├── FRQGradeInput.jsx    # Per-question grade/comment inputs
│   │   └── StudentAnswerViewer.jsx  # View typed or uploaded answers
│   ├── report/
│   │   ├── ReportHeader.jsx     # Student/test info header
│   │   ├── ScoreSummary.jsx     # AP score + section breakdown
│   │   ├── MCQResultsTable.jsx  # MCQ answer table
│   │   └── FRQResultsTable.jsx  # FRQ scores + comments table
│   └── analytics/
│       ├── PerformanceGrid.jsx  # Shared grid for MCQ/FRQ squares
│       ├── MCQSquare.jsx        # Individual MCQ question square
│       ├── FRQCard.jsx          # FRQ card with nested sub-question squares
│       ├── QuestionDetailModal.jsx  # Modal showing question + distribution
│       ├── MCQDetailedView.jsx  # Expanded list view of all MCQ
│       ├── StudentResultsTable.jsx  # Student list table
│       └── FilterBar.jsx        # Class/student multi-select filters
├── services/
│   ├── apTestService.js         # CRUD for tests, questions
│   ├── apSessionService.js      # Test session management
│   ├── apScoringService.js      # Score calculation
│   ├── apGradingService.js      # FRQ grading operations (save grades, upload PDF)
│   ├── apStorageService.js      # Firebase Storage operations (FRQ uploads)
│   └── apAnalyticsService.js    # Aggregate stats (% correct, distributions)
├── hooks/
│   ├── useTestSession.js        # Test state management + sync
│   ├── useHeartbeat.js          # 15s server ping
│   ├── useDuplicateTabGuard.js  # BroadcastChannel listener
│   ├── useTimer.js              # Section timer logic
│   ├── useOfflineQueue.js       # Queue writes during disconnect
│   └── useAnnotations.js        # Highlight/strikethrough state
├── utils/
│   ├── apTypes.js               # Type constants
│   ├── apTestConfig.js          # Subject configs, time limits
│   ├── logError.js              # Centralized error logging
│   ├── withTimeout.js           # Promise timeout wrapper
│   ├── validateSession.js       # Session data validation
│   ├── generateAnswerSheetPdf.js  # Create printable FRQ answer sheet
│   ├── generateReportPdf.js     # Create downloadable score report
│   ├── generateQuestionsPdf.js  # Export questions as PDF (for analytics)
│   ├── fileUpload.js            # Handle FRQ file uploads (PDF, images, HEIC)
│   └── performanceColors.js     # Color scale helper (>85% green, etc.)
├── routes.jsx                   # All AP routes
└── index.js                     # Exports

/public/apBoost/                 # AP-specific static assets
├── ap_logo.png
├── ap_logo_vector.svg
├── ap_logo_header_blue.svg
├── ap_logo_header_orange.svg
└── ...
```

### 2.2 Integration with vocaBoost

| Aspect | Approach |
|--------|----------|
| **Code location** | All in `/src/apBoost/` |
| **Routing** | Single import in `App.jsx`, all routes under `/ap/*` |
| **Auth** | Reuse existing `AuthContext` (same Firebase Auth) |
| **Theme** | Reuse existing `ThemeContext` and design tokens |
| **UI components** | Import from `../components/ui/` |
| **Firebase** | Same `db`, `auth` instances from `../services/db` |
| **Data** | Separate collections with `ap_` prefix |

### 2.3 Removal Strategy

To completely remove apBoost:
1. Delete `/src/apBoost/` folder
2. Delete `/public/apBoost/` folder
3. Remove single import line from `App.jsx`
4. (Optional) Delete `ap_*` Firestore collections

---

## 3. Data Model

### 3.1 Firestore Collections

```
ap_tests/{testId}
├── title: string
├── subject: string (e.g., "AP_US_HISTORY", "AP_LANG")
├── testType: "EXAM" | "MODULE"                // EXAM=full test, MODULE=practice (1-2 sections)
├── createdBy: userId
├── isPublic: boolean (pre-built = true, teacher-created = false)
├── questionOrder: "FIXED" | "RANDOMIZED"
├── sections: [
│   {
│     id: string,
│     title: string,
│     sectionType: "MCQ" | "FRQ" | "MIXED",
│     timeLimit: number (minutes),
│     questionIds: [questionId, ...],
│     calculatorEnabled: boolean,           // Desmos integration (future)
│     mcqMultiplier: number | null,         // Single multiplier for MCQ sections
│     frqMultipliers: { [questionId]: number } | null  // Per-question for FRQ
│   }
│ ]
├── scoreRanges: {                          // Customizable AP 1-5 conversion
│     ap5: { min: number, max: number },    // e.g., { min: 90, max: 100 }
│     ap4: { min: number, max: number },    // e.g., { min: 75, max: 89 }
│     ap3: { min: number, max: number },    // e.g., { min: 65, max: 74 }
│     ap2: { min: number, max: number },    // e.g., { min: 50, max: 64 }
│     ap1: { min: number, max: number }     // e.g., { min: 0, max: 49 }
│   }
├── createdAt: timestamp
└── updatedAt: timestamp
// NOTE: totalTime is CALCULATED from sum of sections, not stored

ap_stimuli/{stimulusId}                     // Shared stimuli (for stimulus-sharing)
├── type: "TEXT" | "IMAGE" | "PASSAGE" | "DOCUMENT" | "CHART"
├── content: string (text content or image URL)
├── title: string | null (for reference)
├── source: string | null (citation/attribution)
├── imageAlt: string | null (accessibility, for images)
├── createdBy: userId
├── createdAt: timestamp
└── tags: [string]

ap_questions/{questionId}
├── testId: string | null (null = question bank item)
├── subject: string
├── questionType: "MCQ" | "MCQ_MULTI" | "FRQ" | "SAQ" | "DBQ"
├── questionDomain: string | null           // Unit (e.g., "Unit 3: Colonial America")
├── questionTopic: string | null            // Specific topic within unit
├── difficulty: "EASY" | "MEDIUM" | "HARD"
├── format: "VERTICAL" | "HORIZONTAL"       // VERTICAL=no stimulus, HORIZONTAL=with stimulus
├── stimulusId: string | null               // Reference to ap_stimuli (for sharing)
├── stimulus: {                             // Inline stimulus (if not using stimulusId)
│     type: "TEXT" | "IMAGE" | "PASSAGE" | "DOCUMENT" | "CHART",
│     content: string,
│     source: string | null
│   } | null
├── questionText: string                    // The actual question
├── choiceA: { text: string, imageUrl: string | null, imageAlt: string | null } | null
├── choiceB: { ... } | null
├── choiceC: { ... } | null
├── choiceD: { ... } | null
├── choiceE: { ... } | null                 // Optional (A-E common, F-J rare)
├── choiceF: { ... } | null
├── choiceG: { ... } | null
├── choiceH: { ... } | null
├── choiceI: { ... } | null
├── choiceJ: { ... } | null
├── choiceCount: number                     // Auto-calculated (count of non-null choices)
├── correctAnswers: [string]                // ["A"] for single, ["A", "C"] for multi-select
├── partialCredit: boolean                  // For MCQ_MULTI - give points for partial correct
├── explanation: string | null              // Rationale shown after grading
├── rubric: string | null                   // For FRQ/SAQ/DBQ - scoring guidelines
├── points: number                          // Base points (before multiplier)
├── subQuestions: [                         // For FRQ with parts a, b, c...
│     {
│       id: string,
│       label: string,                      // "a", "b", "c", etc.
│       questionText: string,
│       points: number,
│       rubric: string | null
│     }
│   ] | null
├── tags: [string]                          // For filtering/search
└── createdBy: userId

ap_session_state/{sessionId}
├── userId: string
├── testId: string
├── sessionToken: string (unique per session, for duplicate detection)
├── status: "ACTIVE" | "PAUSED" | "COMPLETED"
├── currentSectionIndex: number
├── currentQuestionIndex: number
├── sectionTimeRemaining: { [sectionId]: number (seconds) }
├── answers: {
│     [questionId]: {
│       value: string,
│       markedForReview: boolean
│     }
│   }
├── annotations: {
│     [questionId]: [
│       { type: "highlight", start: number, end: number, color: string }
│     ]
│   }
├── strikethroughs: { [questionId]: [optionId, ...] }
├── lastHeartbeat: timestamp
├── lastAction: timestamp
├── startedAt: timestamp
└── completedAt: timestamp | null

ap_test_results/{resultId}
├── userId: string
├── testId: string
├── classId: string                            // Which class context
├── assignmentId: string                       // Reference to ap_assignments
├── attemptNumber: number                      // 1, 2, or 3
├── isFirstAttempt: boolean                    // True only for attempt 1 (for stats)
├── sessionId: string (reference to original session)
├── answers: {                                 // MCQ answers stored directly
│     [questionId]: string | {                 // FRQ answers have subparts
│       a: string,
│       b: string,
│       ...
│     }
│   }
├── score: number | null
├── maxScore: number
├── percentage: number | null
├── apScore: number | null                     // 1-5 AP score
├── sectionScores: {
│     [sectionId]: { correct: number, total: number, points: number }
│   }
├── frqSubmissionType: "TYPED" | "HANDWRITTEN" | null   // null if no FRQ section
├── frqUploadUrl: string | null                // Student's scanned handwritten answer
├── frqGradedPdfUrl: string | null             // Teacher's annotated PDF with feedback
├── frqGrades: {                               // Teacher grades per FRQ question
│     [questionId]: {
│       subScores: { [label]: number },        // e.g., { a: 2, b: 3, c: 1 }
│       comment: string | null                 // Teacher comment for this question
│     }
│   } | null
├── gradingStatus: "NOT_NEEDED" | "PENDING" | "IN_PROGRESS" | "COMPLETE"
├── startedAt: timestamp
├── completedAt: timestamp
└── gradedAt: timestamp | null

ap_classes/{classId}
├── name: string
├── subject: string
├── teacherId: string
├── studentIds: [userId, ...]
├── createdAt: timestamp
└── updatedAt: timestamp
// NOTE: Assignments are stored in ap_assignments collection, not here

ap_assignments/{assignmentId}                  // Junction table for test-student assignments
├── testId: string
├── classId: string
├── studentIds: [userId, ...]                  // Explicit list (when "Assign All", expands to roster)
├── dueDate: timestamp | null
├── maxAttempts: number                        // Default: 3
├── assignedAt: timestamp
└── assignedBy: userId
// NOTE: Only students in studentIds array can access this test
// NOTE: New students joining class do NOT auto-get old assignments
```

### 3.2 Indexes Required

```
ap_session_state:
  - userId + status (find active sessions for user)
  - sessionToken (duplicate tab detection)

ap_test_results:
  - userId + testId + classId (find user's attempts for a test in a class)
  - testId + completedAt (leaderboard/analytics)
  - userId + isFirstAttempt (stats queries - first attempts only)

ap_assignments:
  - classId + studentIds (find assignments for a student in a class)
  - testId (find all assignments for a test)

ap_classes:
  - teacherId (find teacher's classes)
  - studentIds (find student's classes)

ap_questions:
  - subject + tags (question bank filtering)
  - subject + questionDomain (filter by unit)
  - difficulty + questionType (filter for test building)

ap_stimuli:
  - subject + tags (find shared stimuli)
```

### 3.3 Scoring Flow

#### 3.3.1 Score Calculation Process

```
Test Completed
      │
      ▼
┌─────────────────────────────────────────────┐
│ 1. Calculate RAW SCORE per section          │
│    MCQ: count correct answers               │
│    FRQ: sum of graded subquestion points    │
└─────────┬───────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ 2. Apply MULTIPLIERS                        │
│    MCQ section: rawScore × mcqMultiplier    │
│    FRQ section: Σ(questionScore × frqMultipliers[qId])  │
└─────────┬───────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ 3. Calculate TOTAL weighted score           │
│    Sum all section weighted scores          │
└─────────┬───────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ 4. Convert to PERCENTAGE                    │
│    percentage = (totalWeighted / maxWeighted) × 100  │
└─────────┬───────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ 5. Map to AP SCORE (1-5)                    │
│    Use test.scoreRanges to determine AP score  │
│    e.g., 75% → check scoreRanges → AP 4     │
└─────────────────────────────────────────────┘
```

#### 3.3.2 Example Calculation

**Test structure:**
- Section 1 (MCQ): 40 questions, mcqMultiplier = 1.0
- Section 2 (FRQ): 3 questions
  - Q1: frqMultiplier = 1.5
  - Q2: frqMultiplier = 1.3333
  - Q3: frqMultiplier = 1.1667

**Student performance:**
- MCQ: 32/40 correct → 32 raw points × 1.0 = 32 weighted
- FRQ Q1: 6/9 points × 1.5 = 9 weighted
- FRQ Q2: 5/9 points × 1.3333 = 6.67 weighted
- FRQ Q3: 7/9 points × 1.1667 = 8.17 weighted

**Totals:**
- Total weighted: 32 + 9 + 6.67 + 8.17 = 55.84
- Max weighted: 40×1.0 + 9×1.5 + 9×1.3333 + 9×1.1667 = 40 + 13.5 + 12 + 10.5 = 76
- Percentage: 55.84 / 76 × 100 = 73.5%

**AP score conversion (using scoreRanges):**
```javascript
scoreRanges: {
  ap5: { min: 80, max: 100 },
  ap4: { min: 65, max: 79 },
  ap3: { min: 50, max: 64 },
  ap2: { min: 35, max: 49 },
  ap1: { min: 0, max: 34 }
}
// 73.5% → falls in ap4 range → AP Score: 4
```

#### 3.3.3 Partial Credit (MCQ_MULTI)

> **TODO:** The exact partial credit formula needs to be finalized. We will revisit this when implementing the scoring service.

For multiple-select questions where `partialCredit: true`:

```javascript
// Student selects: ["A", "C"]
// Correct answers: ["A", "B", "C"]

// Calculate partial credit
const selected = new Set(["A", "C"]);
const correct = new Set(["A", "B", "C"]);
const correctSelected = intersection(selected, correct).size;  // 2
const incorrectSelected = difference(selected, correct).size;  // 0
const missed = difference(correct, selected).size;             // 1

// Points awarded (various formulas possible - TBD)
// Option A: Simple ratio
points = (correctSelected / correct.size) * basePoints;  // 2/3 = 0.67 of base

// Option B: Penalty for wrong selections
points = Math.max(0, (correctSelected - incorrectSelected) / correct.size) * basePoints;
```

#### 3.3.4 FRQ Sub-Question Scoring

FRQ questions with `subQuestions` are scored per part:

```javascript
// Question structure
{
  questionType: "FRQ",
  points: 9,  // Total for question
  subQuestions: [
    { label: "a", questionText: "Identify...", points: 3, rubric: "..." },
    { label: "b", questionText: "Explain...", points: 3, rubric: "..." },
    { label: "c", questionText: "Analyze...", points: 3, rubric: "..." }
  ]
}

// Student answer stored as:
answers: {
  "questionId": {
    value: {
      a: "Student's answer to part a...",
      b: "Student's answer to part b...",
      c: "Student's answer to part c..."
    },
    subScores: {  // Filled in after grading
      a: 2,       // Graded 2/3
      b: 3,       // Graded 3/3
      c: 1        // Graded 1/3
    }
  }
}
```

### 3.4 FRQ Submission & Grading Flow

#### 3.4.1 Student FRQ Submission Modes

Students choose submission mode **per test** (all-or-nothing):

| Mode | Description |
|------|-------------|
| **TYPED** | Student types answers directly in the browser |
| **HANDWRITTEN** | Student downloads answer sheet PDF, writes by hand, uploads scan |

#### 3.4.2 Answer Sheet PDF Generation

When student selects handwritten mode, generate a printable PDF containing:

```
┌─────────────────────────────────────────────────────────┐
│  [AP Logo]    ANSWER SHEET                              │
│  Test: AP US History Practice Exam #3                   │
│  Student: _________________________  Date: ___________  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  SECTION 2: Free Response Questions                     │
│                                                         │
│  ═══════════════════════════════════════════════════    │
│  QUESTION 1 (9 points)                                  │
│  ───────────────────────────────────────────────────    │
│  [Stimulus text/image reprinted here]                   │
│                                                         │
│  Using the excerpt above, answer parts a, b, and c.     │
│                                                         │
│  (a) Identify ONE historical development... (3 pts)     │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │  [Lined writing space]                          │    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  (b) Explain how... (3 pts)                             │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │  [Lined writing space]                          │    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  (c) Briefly explain... (3 pts)                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │  [Lined writing space]                          │    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 3.4.3 Handwritten Upload

**Supported formats:**
- PDF
- Images: JPG, PNG, HEIC/HEIF (Mac), WebP
- Multiple files allowed (combined into single submission)

**Upload flow:**
1. Student clicks "Upload Answer Sheet" in FRQ section
2. File picker opens (accepts PDF + images)
3. Preview shown before final submit
4. Files uploaded to Firebase Storage: `ap_frq_uploads/{userId}/{resultId}/`
5. `frqUploadUrl` stored in ap_test_results

#### 3.4.4 Teacher Grading Interface

Teachers grade FRQ via side-panel in Gradebook (similar to vocaBoost challenges):

```
┌─────────────────────────────────────────────────────────┐
│  GRADING: John Smith - AP US History Exam #3            │
│  ───────────────────────────────────────────────────────│
│                                                         │
│  [View Student's Answer] ← Opens uploaded PDF/typed text│
│                                                         │
│  Question 1: "Using the excerpt..."      Total: __/9    │
│  ┌───────────────────────────────────────────────────┐  │
│  │ (a) Identify ONE historical...        [__]/3 pts  │  │
│  │ (b) Explain how...                    [__]/3 pts  │  │
│  │ (c) Briefly explain...                [__]/3 pts  │  │
│  │                                                   │  │
│  │ Comment: [________________________]               │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Question 2: "Develop an argument..."    Total: __/7    │
│  ┌───────────────────────────────────────────────────┐  │
│  │ (a) Thesis                            [__]/1 pt   │  │
│  │ (b) Contextualization                 [__]/1 pt   │  │
│  │ (c) Evidence (0-3)                    [__]/3 pts  │  │
│  │ (d) Analysis & Reasoning              [__]/2 pts  │  │
│  │                                                   │  │
│  │ Comment: [________________________]               │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│  [Upload Annotated PDF]  ← Teacher's handwritten notes  │
│                                                         │
│  [Save Draft]  [Mark Complete]                          │
└─────────────────────────────────────────────────────────┘
```

**Grading states:**
- `PENDING` - Test completed, awaiting grading
- `IN_PROGRESS` - Teacher started but not finished
- `COMPLETE` - All FRQ graded, scores finalized

#### 3.4.5 Teacher Annotated PDF

Teachers can optionally upload a PDF with handwritten feedback:
- Stored at: `ap_frq_graded/{resultId}/graded.pdf`
- URL saved to `frqGradedPdfUrl`
- Displayed to student in Report Card with download button

### 3.5 Report Card (Results View)

#### 3.5.1 Overview

The Report Card displays complete test results. Two views:
- **Student view**: Full-screen page at `/ap/results/:resultId`
- **Teacher view**: Side-panel from Gradebook (editable)

#### 3.5.2 Report Card Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SCORE REPORT                                │
│                                                                     │
│  Student: John Smith              Class: AP US History - Period 3   │
│  Test: 2024 Practice Exam #2      Date: January 12, 2026            │
│  Subject: AP United States History                                  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                    ┌───────────────────┐                            │
│                    │                   │                            │
│                    │    AP SCORE: 4    │                            │
│                    │                   │                            │
│                    └───────────────────┘                            │
│                                                                     │
│  Section Scores (after multiplier):                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Section 1 (MCQ):     32/40 pts    │████████████████░░░░│ 80% │   │
│  │  Section 2 (FRQ):     23.84/36 pts │█████████████░░░░░░░│ 66% │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Total: 55.84/76 pts (73.5%)                                        │
│                                                                     │
│  [Download Report PDF]                                              │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SECTION 1: Multiple Choice Results                                 │
│  ┌────┬────────┬──────────┬─────────────────┬──────────┬──────────┐ │
│  │ Q# │ Answer │ Response │ Domain          │ Topic    │ Result   │ │
│  ├────┼────────┼──────────┼─────────────────┼──────────┼──────────┤ │
│  │ 1  │   B    │    B     │ Unit 3          │ Colonial │    ✓     │ │
│  │ 2  │   D    │    C     │ Unit 4          │ Rev War  │    ✗     │ │
│  │ 3  │   A    │    A     │ Unit 3          │ Colonial │    ✓     │ │
│  │... │  ...   │   ...    │ ...             │ ...      │   ...    │ │
│  └────┴────────┴──────────┴─────────────────┴──────────┴──────────┘ │
│                                                                     │
│  MCQ Summary: 32/40 correct (80%)                                   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SECTION 2: Free Response Results                                   │
│  ┌────┬─────┬─────────┬────────┬─────────────┬───────┬───────────┐  │
│  │ Q# │ Sub │ Pts Max │ Earned │ Domain      │ Topic │ Comment   │  │
│  ├────┼─────┼─────────┼────────┼─────────────┼───────┼───────────┤  │
│  │ 1  │  a  │    3    │   2    │ Unit 5      │ Civil │ Good...   │  │
│  │    │  b  │    3    │   3    │             │       │ Excellent │  │
│  │    │  c  │    3    │   1    │             │       │ Needs...  │  │
│  │    │     │ Subtotal│  6/9   │             │       │           │  │
│  ├────┼─────┼─────────┼────────┼─────────────┼───────┼───────────┤  │
│  │ 2  │  a  │    1    │   1    │ Unit 6      │ Recon │           │  │
│  │    │  b  │    1    │   0    │             │       │ Missing   │  │
│  │    │... │   ...   │  ...   │             │       │           │  │
│  │    │     │ Subtotal│  5/7   │             │       │           │  │
│  └────┴─────┴─────────┴────────┴─────────────┴───────┴───────────┘  │
│                                                                     │
│  FRQ Summary: 18/27 raw pts → 23.84/36 weighted (66%)               │
│                                                                     │
│  [Download Graded Paper (PDF)] ← Teacher's annotated feedback       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3.5.3 Report Card Data Sources

| Field | Source |
|-------|--------|
| Student name | `users/{userId}` |
| Class name | `ap_classes/{classId}` |
| Test name/subject | `ap_tests/{testId}` |
| Date | `ap_test_results.completedAt` |
| AP Score | `ap_test_results.apScore` |
| Section scores | `ap_test_results.sectionScores` |
| MCQ answers | `ap_test_results.answers` + `ap_questions` for correct answers |
| FRQ grades | `ap_test_results.frqGrades` |
| Domain/Topic | `ap_questions.questionDomain`, `ap_questions.questionTopic` |
| Graded PDF | `ap_test_results.frqGradedPdfUrl` |

#### 3.5.4 Report PDF Export

"Download Report PDF" generates a formatted PDF containing:
- Header with student/test info
- AP Score prominently displayed
- Section breakdown with scores
- Full MCQ results table
- Full FRQ results table with teacher comments
- Does NOT include the teacher's annotated PDF (separate download)

### 3.6 Exam Analytics Dashboard

#### 3.6.1 Overview

Teacher dashboard for analyzing test performance across students and questions.

**Route:** `/ap/teacher/analytics/:testId`

#### 3.6.2 Filters

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Filter by:                                                              │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐   │
│  │ Classes (multi-select) ▼    │  │ Students (multi-select) ▼       │   │
│  │ ☑ Period 1                  │  │ ☑ John Smith                    │   │
│  │ ☑ Period 3                  │  │ ☑ Jane Doe                      │   │
│  │ ☐ Period 5                  │  │ ☑ Bob Wilson                    │   │
│  └─────────────────────────────┘  │ ...                             │   │
│                                    └─────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Both filters are **multi-select** (checkboxes)
- When classes selected → auto-populate Students dropdown with those class rosters
- Selecting a class auto-checks all students from that class
- Can manually uncheck individual students
- Default: All classes, all students

#### 3.6.3 Performance Color Scale (Fixed Thresholds)

| Percentage | Color | Description |
|------------|-------|-------------|
| > 85% | Green | Excellent |
| 70-85% | Yellow-Green | Good |
| 60-70% | Yellow | Satisfactory |
| 50-60% | Orange | Needs Improvement |
| < 50% | Red | Critical |

**Note:** These thresholds are NOT configurable (fixed for consistency).

#### 3.6.4 MCQ Performance Grid

Displays one square per MCQ question, color-coded by % correct across selected students.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  SECTION 1: Multiple Choice Performance                [Download PDF]   │
│                                                                          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │
│  │ Q1 │ │ Q2 │ │ Q3 │ │ Q4 │ │ Q5 │ │ Q6 │ │ Q7 │ │ Q8 │ │ Q9 │ │Q10 │ │
│  │92% │ │78% │ │65% │ │55% │ │43% │ │88% │ │71% │ │62% │ │58% │ │81% │ │
│  │ 🟢 │ │🟡🟢│ │ 🟡 │ │ 🟠 │ │ 🔴 │ │ 🟢 │ │🟡🟢│ │ 🟡 │ │ 🟠 │ │🟡🟢│ │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ...                                 │
│  │Q11 │ │Q12 │ │Q13 │ │Q14 │ │Q15 │                                      │
│  │90% │ │68% │ │74% │ │52% │ │86% │        [Detailed View]               │
│  │ 🟢 │ │ 🟡 │ │🟡🟢│ │ 🟠 │ │ 🟢 │                                      │
│  └────┘ └────┘ └────┘ └────┘ └────┘                                      │
│                                                                          │
│  Layout: flex-wrap (squares wrap to next row as needed)                 │
└──────────────────────────────────────────────────────────────────────────┘
```

**Interactions:**
- **Click square** → Opens Question Detail Modal
- **"Download PDF"** → Download questions as PDF document
- **"Detailed View"** → Expand to full list view with all distributions

#### 3.6.5 MCQ Question Detail Modal

Opens when clicking a question square in the grid.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Question 4                                                    [X Close] │
│  ─────────────────────────────────────────────────────────────────────── │
│                                                                          │
│  [Stimulus text/image displayed here if applicable]                      │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────── │
│                                                                          │
│  Which of the following best describes the economic impact of...         │
│                                                                          │
│  Response Distribution (32 students):                                    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ (A) Increased trade with Britain       ████████████████  45%    │    │
│  │     [Light Red - Incorrect]            (14 students)            │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ (B) Expansion of domestic manufacturing ███████████████████ 55% │    │
│  │     [Green - Correct ✓]                (18 students)            │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ (C) Decline in agricultural output     ░░░░░░░░░░░░░░░░░░  0%   │    │
│  │     [Light Red - Incorrect]            (0 students)             │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ (D) Reduced government spending        ░░░░░░░░░░░░░░░░░░  0%   │    │
│  │     [Light Red - Incorrect]            (0 students)             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Correct Answer: B                                                       │
│  Domain: Unit 4 - Market Revolution                                      │
│  Topic: Industrial Development                                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Color coding:**
- **Green** = Correct answer (show % who got it right)
- **Light Red** = Incorrect answers (show % who chose this distractor)

#### 3.6.6 MCQ Detailed View

"Detailed View" expands to show all questions in a vertical list format:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  MCQ Detailed View                                        [← Back to Grid]│
│  ─────────────────────────────────────────────────────────────────────── │
│                                                                          │
│  Q1 (92% correct)                                                        │
│  "Which of the following describes..."                                   │
│  A: 3%  B: 92% ✓  C: 2%  D: 3%                                          │
│  ─────────────────────────────────────────────────────────────────────── │
│                                                                          │
│  Q2 (78% correct)                                                        │
│  "The primary cause of..."                                               │
│  A: 78% ✓  B: 12%  C: 8%  D: 2%                                         │
│  ─────────────────────────────────────────────────────────────────────── │
│                                                                          │
│  Q3 (65% correct)                                                        │
│  "According to the passage..."                                           │
│  A: 20%  B: 10%  C: 65% ✓  D: 5%                                        │
│  ─────────────────────────────────────────────────────────────────────── │
│                                                                          │
│  ... (continues for all questions)                                       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

#### 3.6.7 FRQ Performance Grid

Displays FRQ questions as large rectangles containing nested sub-question squares.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  SECTION 2: Free Response Performance                  [Download PDF]   │
│                                                                          │
│  ┌───────────────────────────────────┐  ┌───────────────────────────────┐│
│  │ FRQ 1: "Using the excerpt..."     │  │ FRQ 2: "Develop an argument..." ││
│  │ Overall: 66% 🟡                    │  │ Overall: 71% 🟡🟢               ││
│  │                                    │  │                                ││
│  │  ┌────┐ ┌────┐ ┌────┐            │  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ││
│  │  │ a  │ │ b  │ │ c  │            │  │  │ a  │ │ b  │ │ c  │ │ d  │ ││
│  │  │72% │ │58% │ │68% │            │  │  │85% │ │62% │ │75% │ │63% │ ││
│  │  │🟡🟢│ │ 🟠 │ │ 🟡 │            │  │  │ 🟢 │ │ 🟡 │ │🟡🟢│ │ 🟡 │ ││
│  │  └────┘ └────┘ └────┘            │  │  └────┘ └────┘ └────┘ └────┘ ││
│  │                                    │  │                                ││
│  └───────────────────────────────────┘  └───────────────────────────────┘│
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**FRQ Display:**
- Each FRQ = large rectangle
- Nested squares for each sub-question (a, b, c, etc.)
- Shows **average %** (points earned / points possible) for filtered students
- No distribution (unlike MCQ) - just the average score
- Color-coded using same scale as MCQ

**Interactions:**
- **Click sub-question square** → Could show rubric and point breakdown (future)
- **"Download PDF"** → Download FRQ questions as PDF

#### 3.6.8 Student Performance List

Below the question grids, show a list of all students matching the current filters.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Student Results (32 students)                                           │
│  ─────────────────────────────────────────────────────────────────────── │
│                                                                          │
│  ┌────────────────┬──────────────────────┬───────┬───────┬───────┬─────┐│
│  │ Name           │ Email                │ MCQ   │ FRQ   │AP Score│     ││
│  ├────────────────┼──────────────────────┼───────┼───────┼───────┼─────┤│
│  │ John Smith     │ john@school.edu      │ 32/40 │ 24/36 │   4   │ 📄  ││
│  │ Jane Doe       │ jane@school.edu      │ 38/40 │ 30/36 │   5   │ 📄  ││
│  │ Bob Wilson     │ bob@school.edu       │ 28/40 │ 20/36 │   3   │ 📄  ││
│  │ Alice Brown    │ alice@school.edu     │ 25/40 │ 18/36 │   3   │ 📄  ││
│  │ ...            │ ...                  │ ...   │ ...   │  ...  │ ... ││
│  └────────────────┴──────────────────────┴───────┴───────┴───────┴─────┘│
│                                                                          │
│  Legend: 📄 = Open Report Card                                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Columns:**
| Column | Description |
|--------|-------------|
| Name | Student's display name (clickable → Student Profile) |
| Email | Student's email address |
| MCQ | MCQ score as fraction (e.g., "32/40") |
| FRQ | FRQ score as fraction (e.g., "24/36") |
| AP Score | Calculated AP score (1-5) |
| Report Card | 📄 button → Opens Report Card for this student |

**Interactions:**
- **Click student name** → Navigate to `/ap/teacher/student/:userId` (APStudentProfile)
- **Click 📄 button** → Navigate to Report Card for this test result

#### 3.6.9 Student Profile Page (Stub)

New page at `/ap/teacher/student/:userId` showing AP-specific student overview.

**Status:** Stub/placeholder for now with TODO note.

**Planned features (future):**
- Student's AP test history across all subjects
- Performance trends over time
- Strengths/weaknesses by domain
- Comparison to class average

---

## 4. Session State Management

### 4.1 Core Principle

**Firestore-first** architecture - the server is the source of truth, not local storage.

Local storage (IndexedDB) serves only as a **write-ahead queue** - a temporary holding area to prevent data loss during network issues. After sync, Firestore is always authoritative.

### 4.2 State Sync Strategy

| Event | Action | Timing |
|-------|--------|--------|
| Answer change | Debounced write | 2-3 second batch |
| Flag toggle | Debounced write | 2-3 second batch |
| Annotation (highlight) | Debounced write | 2-3 second batch |
| Strikethrough | Debounced write | 2-3 second batch |
| Question navigation | Immediate write | Instant |
| Section complete | Immediate write | Instant |
| Timer tick | Local only | Firestore update every 30s |
| `beforeunload` event | Set status → PAUSED | Instant |
| Test submission | Immediate write | Instant |

### 4.3 Write-Ahead Queue (IndexedDB)

All writes go through a local queue before reaching Firestore. This ensures no data loss during network issues.

#### 4.3.1 Queue Schema

```javascript
// IndexedDB: ap_action_queue
{
  id: "uuid-abc123",                    // Unique action ID
  sessionId: "session-xyz",             // Which test session
  localTimestamp: 1704067200000,        // Client's clock (for queue ordering)
  action: "ANSWER_CHANGE",              // Action type
  payload: {
    questionId: "q1",
    value: "B",
    markedForReview: false
  },
  status: "PENDING"                     // PENDING → CONFIRMED → (deleted)
}
```

#### 4.3.2 Action Types

| Action | Payload |
|--------|---------|
| `ANSWER_CHANGE` | `{ questionId, value, markedForReview }` |
| `FLAG_TOGGLE` | `{ questionId, markedForReview }` |
| `ANNOTATION_ADD` | `{ questionId, annotation: { type, start, end, color } }` |
| `ANNOTATION_REMOVE` | `{ questionId, annotationIndex }` |
| `STRIKETHROUGH_TOGGLE` | `{ questionId, optionId }` |
| `NAVIGATION` | `{ currentSectionIndex, currentQuestionIndex }` |
| `SECTION_COMPLETE` | `{ sectionIndex, timeRemaining }` |
| `TIMER_SYNC` | `{ sectionTimeRemaining: { ... } }` |
| `SESSION_PAUSE` | `{ status: "PAUSED" }` |
| `SESSION_SUBMIT` | `{ status: "COMPLETED" }` |

#### 4.3.3 Write Flow

```
User performs action
        │
        ▼
┌───────────────────────────┐
│ 1. Update React state     │  (instant UI feedback)
│    (optimistic update)    │
└─────────┬─────────────────┘
          │
          ▼
┌───────────────────────────┐
│ 2. Write to IndexedDB     │  (survives browser crash)
│    queue with PENDING     │
└─────────┬─────────────────┘
          │
          ▼
┌───────────────────────────┐
│ 3. Debounce timer (2-3s)  │  (batch multiple actions)
└─────────┬─────────────────┘
          │
          ▼
┌───────────────────────────┐
│ 4. Write batch to         │
│    Firestore              │
└─────────┬─────────────────┘
          │
    ┌─────┴─────┐
    │           │
 Success      Failure
    │           │
    ▼           ▼
┌─────────┐   ┌─────────────┐
│ Delete  │   │ Keep in     │
│ from    │   │ queue,      │
│ queue   │   │ retry later │
└─────────┘   └─────────────┘
```

### 4.4 Retry Strategy

#### 4.4.1 Exponential Backoff

After a write failure:

```
Attempt 1 → Fail → Wait 2s
Attempt 2 → Fail → Wait 4s
Attempt 3 → Fail → Wait 8s
Attempt 4+ → Switch to opportunistic mode
```

#### 4.4.2 Opportunistic Sync

After exponential backoff exhausted, also try to flush queue when:

| Trigger | Event |
|---------|-------|
| User action | Any answer/flag/annotation change |
| Network restored | `window.addEventListener('online', ...)` |
| Tab gains focus | `visibilitychange` event |
| Heartbeat succeeds | Connection confirmed working |

```javascript
// Opportunistic retry triggers
window.addEventListener('online', flushQueue);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') flushQueue();
});

// Also try on every user action
function handleAnswerChange(answer) {
  updateLocalState(answer);
  addToQueue(answer);
  flushQueue();  // Always attempt, catches connection recovery
}
```

### 4.5 Heartbeat System

```
Interval: 15 seconds
Purpose: Update lastHeartbeat timestamp, verify session validity, detect tab takeover

On success:
  - Update lastHeartbeat in Firestore
  - Check sessionToken matches (detect takeover)
  - Clear failure counter
  - Attempt to flush any pending queue items

On failure:
  - Increment failure counter
  - Retry immediately (up to 2 retries)

After 3 consecutive failures:
  - Show "Connection unstable" banner
  - Switch to local queue mode
  - Continue allowing test-taking

On recovery:
  - Flush queued writes to Firestore
  - Hide banner
  - Reset failure counter
```

### 4.6 Duplicate Tab Detection

#### 4.6.1 Token Architecture

| Token | Purpose | Where stored |
|-------|---------|--------------|
| `sessionId` | Identifies the test attempt | Firestore + URL |
| `sessionToken` | Current "owner" of session | Firestore (updated on takeover) |
| `instanceToken` | Identifies this specific browser tab | Memory only (generated on load) |

```javascript
// Each tab generates its own instanceToken on mount
const instanceToken = useMemo(() => crypto.randomUUID(), []);

// On session load, this tab claims ownership
await updateDoc(sessionRef, {
  sessionToken: instanceToken,  // Overwrite previous owner
  lastHeartbeat: serverTimestamp()
});
```

#### 4.6.2 Detection Methods

**Method 1: BroadcastChannel API (same browser, instant)**

```javascript
const channel = new BroadcastChannel(`ap_session_${sessionId}`);

// Claim session
channel.postMessage({ type: 'SESSION_CLAIMED', token: instanceToken });

// Listen for other tabs
channel.onmessage = (event) => {
  if (event.data.type === 'SESSION_CLAIMED' && event.data.token !== instanceToken) {
    // Another tab took over
    setInvalidated(true);
    showModal("Session moved to another tab");
  }
};
```

**Method 2: Firestore token check (cross-browser, on heartbeat)**

```javascript
const sendHeartbeat = async () => {
  const session = await getDoc(sessionRef);

  if (session.data().sessionToken !== instanceToken) {
    // Another browser/device took over
    setInvalidated(true);
    showModal("Session opened elsewhere");
    return;
  }

  await updateDoc(sessionRef, { lastHeartbeat: serverTimestamp() });
};
```

#### 4.6.3 Behavior

| Scenario | Detection Speed | Result |
|----------|-----------------|--------|
| Same browser, new tab | Instant (BroadcastChannel) | First tab shows "moved" modal |
| Different browser | ≤15 seconds (heartbeat) | First browser shows "moved" modal |
| Different device | ≤15 seconds (heartbeat) | First device shows "moved" modal |

**The later tab always wins.** First tab becomes read-only.

### 4.7 Timer Behavior (Lenient Mode)

| Trigger | Timer Action | Detection Method |
|---------|--------------|------------------|
| Browser/tab closed | Pause | `beforeunload` event → status = PAUSED |
| Tab backgrounded (desktop) | Continue | `visibilitychange` - no action |
| App backgrounded (mobile) | Pause | `visibilitychange` → hidden for >30s → pause |
| Network disconnect | Continue locally | Timer runs client-side |
| User clicks "Pause" | Pause | Button (if feature enabled) |
| Return to paused session | Show "Resume" prompt | Check status === PAUSED on load |

**Mobile handling (visibilitychange):**

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // User switched away - record timestamp
    backgroundedAt = Date.now();
  } else {
    // User returned
    if (backgroundedAt && Date.now() - backgroundedAt > 30000) {
      // Gone for >30 seconds on mobile - pause timer
      pauseTimer();
      showResumePrompt();
    }
    backgroundedAt = null;
  }
});
```

**Why 30 seconds?** Brief task-switches (checking a text, switching apps) shouldn't pause. Extended absences should.

**Section locking:**
- Once a section is completed, user cannot go back
- Matches real Bluebook behavior
- `currentSectionIndex` only increments, never decrements

### 4.8 Submit Flow

#### 4.8.1 Normal Submit (Queue Empty)

```
User clicks "Submit Test"
        │
        ▼
Check queue.length === 0?
        │
       Yes
        │
        ▼
Write { status: "COMPLETED", completedAt } to Firestore
        │
        ▼
Create ap_test_results document
        │
        ▼
Redirect to results page
```

#### 4.8.2 Submit with Pending Queue

```
User clicks "Submit Test"
        │
        ▼
Check queue.length > 0?
        │
       Yes
        │
        ▼
┌───────────────────────────────────────┐
│ Show modal:                           │
│                                       │
│ "Syncing your answers..."             │
│                                       │
│ ████████████░░░░░░░░ 60%              │
│                                       │
│ Please don't close this window.       │
└───────────────────────────────────────┘
        │
        ▼
Aggressive flush: retry every 2s
        │
   ┌────┴────┐
   │         │
Success   Fails for 30+ seconds
   │         │
   ▼         ▼
Complete  ┌───────────────────────────────────────┐
submit    │ "Unable to sync"                      │
normally  │                                       │
          │ We couldn't reach the server.         │
          │ Your answers are saved locally.       │
          │                                       │
          │ • Keep this tab open                  │
          │ • Check your connection               │
          │ • We'll keep trying                   │
          │                                       │
          │ [Keep Trying]                         │
          └───────────────────────────────────────┘
```

**No JSON backup option.** If user closes tab against warning, data is lost. Their choice.

### 4.9 Session Resume Flow

```
User opens test URL
        │
        ▼
Load session from Firestore
        │
        ▼
Check IndexedDB for pending queue items
        │
   ┌────┴────┐
   │         │
No items   Has items
   │         │
   │         ▼
   │    For each item:
   │         │
   │    Compare item.localTimestamp vs session.lastModified
   │         │
   │    ┌────┴────┐
   │    │         │
   │  Newer     Older
   │    │         │
   │    ▼         ▼
   │  Apply    Discard
   │  to       (stale)
   │  Firestore
   │    │
   │    ▼
   │  Delete from queue
   │         │
   └────┬────┘
        │
        ▼
Use Firestore state (now authoritative)
        │
        ▼
Show "Resume" modal if status was PAUSED
```

### 4.10 Conflict Resolution

**Timestamps are key.** We use Firestore's `serverTimestamp()` for authority.

```javascript
// Local timestamps: for queue ordering only
const queueItem = {
  localTimestamp: Date.now(),  // Client's clock (may be wrong)
  ...
};

// Firestore timestamps: for conflict resolution
await updateDoc(sessionRef, {
  answers: newAnswers,
  lastModified: serverTimestamp()  // Google's servers (always correct)
});
```

**Resolution rule:** Firestore's `lastModified` (server timestamp) wins.

| Scenario | Resolution |
|----------|------------|
| Local newer than Firestore | Apply local to Firestore |
| Firestore newer than local | Discard local (another tab updated) |
| Same timestamp | Last-write-wins (Firestore handles) |

### 4.11 Data Loss Policy

#### 4.11.1 What We Protect Against (Must Handle)

| Scenario | Protection |
|----------|------------|
| Network blip (few seconds) | Queue + auto-retry |
| Page refresh | `beforeunload` warning + resume |
| Accidental tab close | `beforeunload` warning + resume |
| Browser crash | IndexedDB persists + resume |
| App/JS error | Error boundary + state preserved |
| Server temporarily down | Queue locally + sync when back |
| Slow connection | Loading states + generous timeouts |

#### 4.11.2 Acceptable Loss (With Warning)

| Scenario | Handling |
|----------|----------|
| User ignores "don't close" warning | Data lost - user's choice |
| User clears browser data | Data lost - user's choice |
| User in incognito + closes | Data lost - expected behavior |
| User offline entire test, never reconnects | Data lost - can't sync without network |
| User's device dies | Physical loss - not app's responsibility |

#### 4.11.3 No Protection Needed

| Scenario | Reason |
|----------|--------|
| User disables JavaScript | App can't function |
| User blocks storage/cookies | App can't persist |
| User on unsupported browser | Not our target |
| IndexedDB corrupted (rare browser bug) | Browser's fault |

#### 4.11.4 The Warning Pattern

```
User attempts risky action
        │
        ▼
┌───────────────────────────────────────┐
│ ⚠️ Warning                            │
│                                       │
│ "You have unsaved changes. If you     │
│  leave, your progress may be lost."   │
│                                       │
│ [Stay on Page]     [Leave Anyway]     │
└───────────────────────────────────────┘
        │
        └── If "Leave Anyway" → Acceptable loss
```

**The warning is our liability shield.** Once warned, user's choice.

### 4.12 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Browser crash mid-IndexedDB write | IndexedDB transactions are atomic - either complete or rollback |
| Device storage full | Catch `QuotaExceededError`, immediately try to flush, show warning if still fails |
| Timer expires while offline | Queue auto-submit action, complete submission when connection returns |
| Two tabs race to write | Last-write-wins via sessionToken - later tab invalidates earlier |
| Firestore quota exceeded | Exponential backoff, notify user after extended failure |
| User's clock wildly wrong | Use `serverTimestamp()` for Firestore, local timestamps only for queue ordering |

### 4.13 Hooks Overview

| Hook | Responsibility |
|------|----------------|
| `useTestSession` | Main orchestrator: loads session, manages state, coordinates sync |
| `useHeartbeat` | 15s ping to Firestore, tracks failures, checks token, triggers banner |
| `useDuplicateTabGuard` | BroadcastChannel setup, duplicate detection, invalidation modal |
| `useTimer` | Per-section countdown, pause/resume, time warnings |
| `useOfflineQueue` | IndexedDB queue management, debounced writes, flush on reconnect |
| `useAnnotations` | Manages highlights and strikethroughs per question |

### 4.14 Connection Status UI States

| State | Banner | User Can |
|-------|--------|----------|
| Connected | None | Everything normal |
| Retrying (1-2 failures) | None | Everything normal (silent retry) |
| Disconnected (3+ failures) | "Connection unstable - saving locally" | Continue test-taking |
| Reconnected | "Reconnected - syncing..." (2s) | Everything normal |
| Submit pending | Modal with progress | Wait only |
| Submit failed | Modal with "Keep Trying" | Wait or risk loss |

### 4.15 Error Handling Conventions

#### 4.15.1 Core Principles

| Principle | Rule |
|-----------|------|
| **No silent failures** | Every error must be logged with context |
| **Fail fast** | Detect and report errors at boundaries, not deep in call stack |
| **Never empty catch** | All catch blocks must log or rethrow |
| **Validate at boundaries** | Check data shape when receiving from external sources |

#### 4.15.2 React Error Boundary

Wrap the test session in an Error Boundary to catch render crashes:

```jsx
// src/apBoost/components/APErrorBoundary.jsx
class APErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logError('APErrorBoundary', { componentStack: errorInfo.componentStack }, error);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

// Usage in routes.jsx
<APErrorBoundary>
  <APTestSession />
</APErrorBoundary>
```

**Fallback UI shows:**
- "Something went wrong" message
- "Try Again" button (resets error state)
- "Return to Dashboard" link
- Note: Your answers are saved locally

#### 4.15.3 Async Function Pattern

Every async function must follow this pattern:

```javascript
async function saveAnswer(questionId, value) {
  // 1. Guard clauses - fail fast on invalid input
  if (!questionId) {
    logError('saveAnswer', { questionId, value }, new Error('questionId is required'));
    return { success: false, error: 'INVALID_INPUT' };
  }

  try {
    // 2. Main logic
    await updateDoc(sessionRef, { [`answers.${questionId}`]: value });
    return { success: true };

  } catch (error) {
    // 3. Log with full context
    logError('saveAnswer', { questionId, value }, error);

    // 4. Handle by error type
    if (error.code === 'unavailable' || error.code === 'network-request-failed') {
      // Network error - queue for retry
      addToQueue({ action: 'ANSWER_CHANGE', payload: { questionId, value } });
      return { success: false, error: 'NETWORK', queued: true };
    }

    if (error.code === 'permission-denied') {
      // Auth error - session may be invalid
      return { success: false, error: 'AUTH' };
    }

    // Unknown error - rethrow for Error Boundary
    throw error;
  }
}
```

#### 4.15.4 logError Utility

Create centralized error logging:

```javascript
// src/apBoost/utils/logError.js
export function logError(functionName, context, error) {
  const errorInfo = {
    function: functionName,
    context,
    message: error?.message || String(error),
    code: error?.code,
    stack: error?.stack,
    timestamp: new Date().toISOString(),
    sessionId: getCurrentSessionId(),  // if available
    userId: getCurrentUserId(),        // if available
  };

  // Always log to console in dev
  console.error(`[${functionName}]`, errorInfo);

  // In production, could send to error tracking service
  if (import.meta.env.PROD) {
    // sendToErrorTracking(errorInfo);  // Future: Sentry, etc.
  }
}
```

#### 4.15.5 Null/Undefined Handling

| Situation | Pattern |
|-----------|---------|
| **External data (Firestore, API)** | Validate shape explicitly, throw if unexpected |
| **User input** | Validate + show error message to user |
| **Optional fields (by design)** | `??` or `?.` is acceptable |
| **Function parameters** | Guard clause at top of function |
| **Chained access after validation** | `?.` is safe |

**Validation at boundaries:**

```javascript
// When loading session from Firestore
function validateSessionData(data) {
  if (!data) {
    throw new Error('Session data is null');
  }
  if (typeof data.answers !== 'object') {
    throw new Error('Session answers is not an object');
  }
  if (typeof data.currentSectionIndex !== 'number') {
    throw new Error('currentSectionIndex is not a number');
  }
  // ... validate all required fields
  return data;  // Now safe to use
}

// Usage
const rawData = await getDoc(sessionRef);
const session = validateSessionData(rawData.data());
```

**Guard clauses:**

```javascript
function updateAnswer(questionId, value) {
  // Guard clauses at top - fail fast
  if (!questionId) {
    logError('updateAnswer', { questionId, value }, 'questionId is required');
    return;
  }
  if (value === undefined) {
    logError('updateAnswer', { questionId, value }, 'value is undefined');
    return;
  }

  // Safe to proceed
  // ...
}
```

#### 4.15.6 Timeouts and Loading States

| Operation | Timeout | Loading State |
|-----------|---------|---------------|
| Initial session load | 10s | Full-page skeleton |
| Save answer (Firestore) | 10s | None (optimistic) |
| Heartbeat | 5s | None (silent) |
| Submit test | 30s | Modal with progress |
| Load question bank | 15s | Skeleton list |

**Timeout wrapper:**

```javascript
async function withTimeout(promise, ms, operation) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]);
}

// Usage
const session = await withTimeout(
  getDoc(sessionRef),
  10000,
  'loadSession'
);
```

**Loading state pattern:**

```javascript
const [loadingState, setLoadingState] = useState('idle'); // idle | loading | error | success

async function loadSession() {
  setLoadingState('loading');
  try {
    const data = await withTimeout(getDoc(sessionRef), 10000, 'loadSession');
    setSession(validateSessionData(data));
    setLoadingState('success');
  } catch (error) {
    logError('loadSession', { sessionId }, error);
    setLoadingState('error');
  }
}

// In JSX
if (loadingState === 'loading') return <SessionSkeleton />;
if (loadingState === 'error') return <ErrorState onRetry={loadSession} />;
```

#### 4.15.7 Error Types and User Messages

| Error Type | User Message | Action |
|------------|--------------|--------|
| Network/offline | "Connection lost. Your work is saved locally." | Show banner, continue |
| Auth/permission | "Session expired. Please log in again." | Redirect to login |
| Validation | "Something's wrong with this question. Skipping." | Skip question, log |
| Timeout | "Taking too long. Retrying..." | Auto-retry with backoff |
| Unknown | "Something went wrong. Your work is saved." | Show error boundary |

---

## 5. UI/UX Specification

### 5.1 Test Session Layout

**Question Display Formats:**

| Format | Layout | When Used |
|--------|--------|-----------|
| **VERTICAL** | One column - question + answers only | Questions without stimulus |
| **HORIZONTAL** | Two columns - left: stimulus, right: question + answers | Questions with stimulus |

#### 5.1.1 HORIZONTAL Layout (Two-Column - With Stimulus)

```
┌─────────────────────────────────────────────────────────────────┐
│ [AP Logo]  Section 1 of 3: Multiple Choice    ⏱️ 45:23    [≡]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────┐ ┌────────────────────────────┐   │
│  │     LEFT PANEL           │ │       RIGHT PANEL          │   │
│  │     (Stimulus)           │ │   (Question + Answers)     │   │
│  │                          │ │                            │   │
│  │  [Passage, image, or     │ │  Question 5 of 20  [🚩]    │   │
│  │   document text here]    │ │                            │   │
│  │                          │ │  Which of the following    │   │
│  │  [Highlighter]           │ │  best describes...         │   │
│  │  [Line Reader]           │ │                            │   │
│  │                          │ │  ○ A) First option         │   │
│  │                          │ │  ● B) Second (selected)    │   │
│  │                          │ │  ○ C) Third option         │   │
│  │                          │ │  ○ D) Fourth option        │   │
│  │                          │ │                            │   │
│  └──────────────────────────┘ └────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [◄ Back]        Question 5 of 20 ▲            [Next ►]        │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.1.2 VERTICAL Layout (One-Column - No Stimulus)

```
┌─────────────────────────────────────────────────────────────────┐
│ [AP Logo]  Section 1 of 3: Multiple Choice    ⏱️ 45:23    [≡]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Question 5 of 20                            [🚩 Flag]   │   │
│  │                                                          │   │
│  │  Which of the following best describes...               │   │
│  │                                                          │   │
│  │  ○ A) First option text                                 │   │
│  │  ● B) Second option text (selected)                     │   │
│  │  ○ C) Third option text                                 │   │
│  │  ○ D) Fourth option text                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [◄ Back]        Question 5 of 20 ▲            [Next ►]        │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Navigation System

**No navigation dots.** Instead, use a bottom bar with slide-up modal:

#### 5.2.1 Bottom Navigation Bar

The bottom bar displays:
```
┌─────────────────────────────────────────────────────────────────┐
│  [◄ Back]        Question 5 of 20 ▲            [Next ►]        │
└─────────────────────────────────────────────────────────────────┘
```

- **"Question X of Y"** is clickable - opens the Question Navigator Modal
- **▲ arrow** indicates the modal can slide up
- **Back/Next** buttons for linear navigation

#### 5.2.2 Question Navigator Modal (Slide-Up)

When user clicks "Question X of Y ▲", a modal slides up from the bottom:

```
┌─────────────────────────────────────────────────────────────────┐
│                                              [X Close]          │
│                                                                 │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ │
│  │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │ │ 6 │ │ 7 │ │ 8 │ │ 9 │ │10 │ │
│  │ ■ │ │ ■ │ │ ■ │ │ □ │ │ ■ │ │ □ │ │🚩 │ │ □ │ │ □ │ │ ■ │ │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ │
│                                                                 │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ │
│  │11 │ │12 │ │13 │ │14 │ │15 │ │16 │ │17 │ │18 │ │19 │ │20 │ │
│  │ □ │ │ ■ │ │ □ │ │ ■ │ │🚩 │ │ □ │ │ □ │ │ ■ │ │ □ │ │ ■ │ │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ │
│                                                                 │
│                    [Go to Review Screen]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Box States:**
| State | Visual | Description |
|-------|--------|-------------|
| Answered | ■ (filled/colored) | Blue or primary color fill |
| Unanswered | □ (empty/white) | White background |
| Flagged | 🚩 (flag icon) | Orange border or flag icon |
| Current | Highlighted border | Shows which question is active |

**Interactions:**
- **Click a box** → Navigate directly to that question, modal closes
- **"Go to Review Screen"** → Opens Review Screen (full page)
- **X or click outside** → Close modal, stay on current question

### 5.3 Tools Specification

#### Highlighter
- Click and drag to highlight text in stimulus
- Color options: yellow (default), green, pink, blue
- Click highlighted text to remove
- Highlights persist per question within session

#### Strikethrough
- Click answer option to toggle strikethrough
- Visual: gray text with line through
- Does not affect selection (can still select struck option)
- Persists per question within session

#### Line Reader
- Toggle button activates overlay
- Only current line visible (configurable: 1-3 lines)
- Drag or arrow keys to move
- Helpful for long passages

#### Flag for Review
- Toggle button on each question
- Flagged questions show 🚩 in navigator
- Review screen lists all flagged questions
- Does not affect scoring

### 5.4 Review Screen (Full Page)

Accessed via "Go to Review Screen" button in the Question Navigator Modal.
This is a **full page** (not a modal) showing all questions in a grid:

```
┌─────────────────────────────────────────────────────────────────┐
│ [AP Logo]  Section 1 of 3: Multiple Choice    ⏱️ 45:23    [≡]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    Review Your Answers                          │
│                                                                 │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ │
│  │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │ │ 6 │ │ 7 │ │ 8 │ │ 9 │ │10 │ │
│  │ ■ │ │ ■ │ │ ■ │ │ □ │ │ ■ │ │ □ │ │🚩 │ │ □ │ │ □ │ │ ■ │ │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ │
│                                                                 │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ │
│  │11 │ │12 │ │13 │ │14 │ │15 │ │16 │ │17 │ │18 │ │19 │ │20 │ │
│  │ □ │ │ ■ │ │ □ │ │ ■ │ │🚩 │ │ □ │ │ □ │ │ ■ │ │ □ │ │ ■ │ │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Summary:                                                       │
│  • Answered: 12/20                                              │
│  • Unanswered: 8 (Q4, Q6, Q8, Q9, Q11, Q13, Q16, Q17)          │
│  • Flagged for review: 2 (Q7, Q15)                             │
│                                                                 │
│  ⚠️ You have 8 unanswered questions                             │
│                                                                 │
│  [Return to Questions]              [Submit Section] / [Next Section]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Interactions:**
- **Click a question box** → Navigate back to that question
- **"Return to Questions"** → Go back to current question
- **"Submit Section"** → If final section, submit entire test
- **"Next Section"** → If not final section, lock current section and move to next

**Legend (same as modal):**
| State | Visual | Description |
|-------|--------|-------------|
| Answered | ■ (filled/colored) | Blue or primary color fill |
| Unanswered | □ (empty/white) | White background |
| Flagged | 🚩 (flag icon) | Orange border or flag icon |

### 5.5 Connection Status Banner

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Connection unstable - your progress is being saved locally   │
└─────────────────────────────────────────────────────────────────┘
```

- Appears below header when connection lost
- Yellow/warning background
- Auto-dismisses when connection restored
- Shows "Reconnected - syncing..." briefly on recovery

### 5.6 Duplicate Tab Modal

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    ⚠️ Session Active Elsewhere                  │
│                                                                 │
│    This test is already open in another browser tab.            │
│                                                                 │
│    To prevent data conflicts, you can only have one             │
│    active session at a time.                                    │
│                                                                 │
│              [Use This Tab]    [Go to Dashboard]                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Phases

### Phase 1: Foundation (MVP)

**Goal:** Basic test-taking flow with MCQ support

| Step | Files | Description |
|------|-------|-------------|
| 1.1 | `routes.jsx`, `index.js` | Route setup, exports |
| 1.2 | `APHeader.jsx` | Header with AP branding |
| 1.3 | `APDashboard.jsx` | List available tests |
| 1.4 | `apTestService.js` | CRUD for tests/questions |
| 1.5 | `apSessionService.js` | Session CRUD |
| 1.6 | `useTestSession.js` | Core session state hook |
| 1.7 | `APTestSession.jsx` | Main test interface (MCQ only) |
| 1.8 | `QuestionDisplay.jsx`, `AnswerInput.jsx` | Question rendering |
| 1.9 | `useTimer.js`, `TestTimer.jsx` | Section timer |
| 1.10 | `QuestionNavigator.jsx` | Question list navigation |
| 1.11 | `ReviewScreen.jsx` | Pre-submit review |

**Verification:**
- [ ] Navigate to `/ap` - dashboard loads
- [ ] Start test - timer counts down
- [ ] Answer MCQ - selection persists
- [ ] Navigate questions - state preserved
- [ ] Submit test - results saved

### Phase 2: Session Resilience

**Goal:** Robust session management, no data loss

| Step | Files | Description |
|------|-------|-------------|
| 2.1 | `useHeartbeat.js` | 15s server ping |
| 2.2 | `useOfflineQueue.js` | Queue writes offline |
| 2.3 | `ConnectionStatus.jsx` | Banner component |
| 2.4 | `useDuplicateTabGuard.js` | BroadcastChannel |
| 2.5 | `DuplicateTabModal.jsx` | Modal component |
| 2.6 | Update `useTestSession.js` | Integrate all hooks |

**Verification:**
- [ ] Close browser mid-test → resume exactly
- [ ] Open second tab → modal appears
- [ ] Disconnect network → banner shows, can continue
- [ ] Reconnect → auto-sync, banner hides

### Phase 3: Tools

**Goal:** Bluebook-style annotation tools

| Step | Files | Description |
|------|-------|-------------|
| 3.1 | `useAnnotations.js` | Annotation state management |
| 3.2 | `Highlighter.jsx` | Text highlighting |
| 3.3 | `Strikethrough.jsx` | MCQ option strikethrough |
| 3.4 | `LineReader.jsx` | Focus line reader |
| 3.5 | `PassageDisplay.jsx` | Passage with tools |
| 3.6 | Update `QuestionDisplay.jsx` | Integrate tools |

**Verification:**
- [ ] Highlight text → persists on navigation
- [ ] Strikethrough option → visual feedback
- [ ] Line reader → overlay moves correctly
- [ ] Tools visible in review mode

### Phase 4: Teacher Flow

**Goal:** Test creation and class management

| Step | Files | Description |
|------|-------|-------------|
| 4.1 | `APTeacherDashboard.jsx` | Teacher home |
| 4.2 | `APTestEditor.jsx` | Create/edit tests |
| 4.3 | `APQuestionBank.jsx` | Question library |
| 4.4 | Class management | Assign tests, view results |

**Verification:**
- [ ] Teacher creates test with sections
- [ ] Teacher adds questions to test
- [ ] Teacher assigns test to class
- [ ] Teacher views student results

### Phase 5: Scoring & Review

**Goal:** Auto-scoring and test review

| Step | Files | Description |
|------|-------|-------------|
| 5.1 | `apScoringService.js` | Score calculation |
| 5.2 | `APTestReview.jsx` | Review completed test |
| 5.3 | FRQ support | Text input, manual grading |
| 5.4 | Analytics | Score trends, weak areas |

**Verification:**
- [ ] MCQ auto-scored on submit
- [ ] Review shows correct/incorrect
- [ ] FRQ saved, awaiting manual grade
- [ ] Student sees score breakdown

---

## 7. Verification Checklist

### Basic Flow
- [ ] Navigate to `/ap` - APDashboard loads
- [ ] See list of available tests
- [ ] Start a test - lands on first question
- [ ] Timer counts down correctly
- [ ] Answer MCQ - selection highlighted
- [ ] Flag question - icon appears in navigator
- [ ] Navigate via navigator - state preserved
- [ ] Complete section - moves to next (can't go back)
- [ ] Submit test - see score summary

### Session Resilience
- [ ] Close browser mid-test → Reopen → Resume from exact position
- [ ] Open second tab (same browser) → First tab shows "moved" modal instantly
- [ ] Open in different browser → First browser shows modal within 15s
- [ ] Choose "Use This Tab" → First tab becomes read-only
- [ ] Disconnect network → "Connection unstable" banner after 3 failures (~45s)
- [ ] Continue answering offline → Works normally, queue fills
- [ ] Reconnect → Banner shows "syncing", then hides, data synced
- [ ] Refresh page → Session resumes (status: PAUSED → ACTIVE)
- [ ] Complete section → Cannot navigate back (locked)
- [ ] Submit with pending queue → Shows sync progress modal
- [ ] Submit fails for 30s+ → Shows "Unable to sync" with "Keep Trying"
- [ ] Timer expires offline → Auto-submit queued, completes on reconnect

### Write-Ahead Queue
- [ ] Answer question → Immediately visible in UI (optimistic)
- [ ] Answer question → Written to IndexedDB within ms
- [ ] Answer question → Written to Firestore within 2-3s (debounced)
- [ ] Crash browser mid-test → Reopen → Queue items replayed
- [ ] Queue items older than Firestore → Discarded (stale)
- [ ] Queue items newer than Firestore → Applied to Firestore

### Tools
- [ ] Highlighter → Select text → Highlight appears
- [ ] Highlighter → Click highlight → Removes it
- [ ] Strikethrough → Click option → Line through text
- [ ] Strikethrough → Click again → Removes it
- [ ] Line reader → Toggle on → Overlay appears
- [ ] Line reader → Arrow keys → Moves focus line
- [ ] All annotations persist across question navigation
- [ ] Annotations visible in review mode (read-only)

### Teacher Flow
- [ ] Teacher dashboard shows owned tests
- [ ] Create new test → Add sections → Add questions
- [ ] Save test → Appears in dashboard
- [ ] Assign test to class → Students see it
- [ ] View student results → Shows scores and answers

---

## Appendix A: Design Tokens Reference

Use these tokens from `/src/index.css` - never raw Tailwind values:

```css
/* Backgrounds */
bg-base, bg-surface, bg-muted, bg-inset

/* Text */
text-text-primary, text-text-secondary, text-text-muted, text-text-faint

/* Borders */
border-border-default, border-border-strong, border-border-muted

/* Radius */
rounded-[--radius-card], rounded-[--radius-button], rounded-[--radius-input]

/* Semantic */
bg-success, bg-error, bg-warning, bg-info

/* Brand */
bg-brand-primary, bg-brand-accent, text-brand-text

/* Shadows */
shadow-theme-sm, shadow-theme-md, shadow-theme-lg
```

---

## Appendix B: Routes

```
# Student Routes
/ap                         → APDashboard (student home)
/ap/test/:testId            → APTestSession (take test)
/ap/test/:testId/review     → APTestReview (quick view after submit)
/ap/results/:resultId       → APReportCard (full results page)

# Teacher Routes
/ap/teacher                 → APTeacherDashboard
/ap/teacher/gradebook       → APGradebook (grade FRQs, view results)
/ap/teacher/gradebook/:resultId  → APGradebook with side-panel open
/ap/teacher/test/new        → APTestEditor (create)
/ap/teacher/test/:testId    → APTestEditor (edit)
/ap/teacher/questions       → APQuestionBank
/ap/teacher/analytics/:testId  → APExamAnalytics (performance heatmaps)
/ap/teacher/student/:userId → APStudentProfile (student overview - stub)
/ap/teacher/class/:classId  → Class management
```

---

*Last updated: 2026-01-12*
