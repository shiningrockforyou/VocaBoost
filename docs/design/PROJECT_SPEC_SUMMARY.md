# VocaBoost Project Spec Summary

## 1. Routes

All routes defined in `src/App.jsx`:

| Path | Component | Access Level | Description |
|------|-----------|--------------|-------------|
| `/` | `Dashboard` | Private | Main dashboard (renders differently for teachers/students) |
| `/login` | `Login` | Public | User login page |
| `/signup` | `Signup` | Public | User registration page |
| `/lists` | `ListLibrary` | Private + Teacher | View all vocabulary lists (teacher-only) |
| `/lists/new` | `ListEditor` | Private + Teacher | Create new vocabulary list (teacher-only) |
| `/lists/:listId` | `ListEditor` | Private + Teacher | Edit existing vocabulary list (teacher-only) |
| `/classes/:classId` | `ClassDetail` | Private + Teacher | View class details, assign lists, manage students (teacher-only) |
| `/study/:listId` | `StudySession` | Private | Flashcard study session |
| `/test/:listId` | `TakeTest` | Private | Multiple choice test |
| `/typed-test/:listId` | `TypedTest` | Private | Typed definition test (AI-graded) |
| `/gradebook` | `Gradebook` | Private | Student gradebook view (challenge submission mode) |
| `/teacher/gradebook` | `Gradebook` | Private + Teacher | Teacher gradebook view (challenge review mode, supports `?classId=xxx` query param) |
| `*` | `Navigate` | - | Catch-all route redirects to `/` |

**Route Protection:**
- `PrivateRoute`: Requires authentication
- `TeacherRoute`: Requires teacher role (wrapped inside `PrivateRoute`)

---

## 2. Database Schema

### `users` Collection
**Path:** `/users/{uid}`

```javascript
{
  role: "student" | "teacher" | "admin",
  email: string,
  profile: {
    displayName: string,
    school: string,
    gradYear: number | null,
    gradMonth: number | null,
    calculatedGrade: number | null,
    avatarUrl: string
  },
  stats: {
    totalWordsLearned: number,      // Words with box > 1
    streakDays: number,             // Consecutive days with activity
    retention: number,               // 0.0-1.0, calculated from test results
    credibility: number             // 0.0-1.0, calculated from test accuracy
  },
  settings: {
    weeklyGoal: number,              // Default: 100 words/week
    useUnifiedQueue: boolean         // Default: false
  },
  enrolledClasses: {                 // Denormalized map
    [classId]: {
      name: string,
      joinedAt: Timestamp
    }
  },
  challenges: {
    history: [                       // Challenge history array
      {
        attemptId: string,
        wordId: string,
        challengedAt: Timestamp,
        replenishAt: Timestamp,      // 30 days from challenge
        status: "pending" | "accepted" | "rejected"
      }
    ]
  },
  createdAt: Timestamp
}
```

**Subcollection:** `users/{uid}/study_states/{wordId}`
```javascript
{
  box: number,                       // 1-5 (Leitner system)
  streak: number,                    // Consecutive "easy" responses
  lastReviewed: Timestamp,
  nextReview: Timestamp,            // Calculated: currentTime + box * 15 minutes
  result: "again" | "hard" | "easy"
}
```

---

### `classes` Collection
**Path:** `/classes/{classId}`

```javascript
{
  name: string,
  ownerTeacherId: string,            // Reference to users/{uid}
  joinCode: string,                  // 6-character uppercase code
  settings: {
    allowStudentListImport: boolean
  },
  assignedLists: string[],            // Array of list IDs (legacy)
  mandatoryLists: string[],          // Array of list IDs that are required
  assignments: {                      // Map structure for assignment metadata
    [listId]: {
      pace: number,                   // Words per day (default: 20)
      assignedAt: Timestamp,
      testOptionsCount: number,       // Default: 4 (for MCQ tests)
      testMode: "mcq" | "typed" | "both"  // Default: "mcq"
    }
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Subcollection:** `classes/{classId}/members/{studentUid}`
```javascript
{
  joinedAt: Timestamp,
  displayName: string,
  email: string
}
```

---

### `lists` Collection
**Path:** `/lists/{listId}`

```javascript
{
  title: string,
  description: string,
  ownerId: string,                   // Reference to users/{uid} (teacher)
  visibility: "public" | "private" | "class",
  wordCount: number,                  // Cached count, updated when words added/removed
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Subcollection:** `lists/{listId}/words/{wordId}`
```javascript
{
  word: string,
  definition: string,
  definitions: {                      // Multi-language support
    en: string,
    [lang]: string
  },
  samples: string[],                  // Example sentences
  audioUrl: string | null,            // Google Cloud Storage URL
  roots: string[],                    // Word roots/etymology
  partOfSpeech: string | null,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### `attempts` Collection
**Path:** `/attempts/{attemptId}`

```javascript
{
  studentId: string,                  // Reference to users/{uid}
  testId: string,                    // Format: "test_{listId}_{timestamp}" or "typed_{listId}_{timestamp}"
  testType: "mcq" | "typed",         // Default: "mcq"
  classId: string | null,            // Class ID if test taken in class context
  teacherId: string | null,          // Teacher ID for efficient gradebook queries
  score: number,                      // 0-100 (percentage)
  graded: boolean,                   // Always true (graded immediately)
  answers: [
    {
      wordId: string,
      word: string,                   // Denormalized for display
      correctAnswer: string,          // The correct definition
      studentResponse: string,        // The answer the student provided
      studentAnswer: string,          // Alternative field name (legacy)
      isCorrect: boolean,
      // Typed test specific fields:
      aiReasoning: string | null,     // AI grading explanation (typed tests only)
      challengeStatus: "pending" | "accepted" | "rejected" | null,
      challengeNote: string | null,  // Student's challenge explanation
      challengeReviewedBy: string | null,
      challengeReviewedAt: Timestamp | null
    }
  ],
  skipped: number,                   // Number of unanswered questions
  totalQuestions: number,
  credibility: number,               // 0.0-1.0, calculated from all answers
  retention: number,                 // 0.0-1.0, calculated from box >= 4 words
  submittedAt: Timestamp
}
```

**Note:** 
- `classId` and `teacherId` are added to new attempts (legacy attempts may not have these fields)
- `testType` distinguishes MCQ from typed tests
- Challenge fields are only present for typed tests

---

## 3. Cloud Functions

All functions in `functions/index.js`:

### `gradeTypedTest`
**Type:** Callable function (v2)  
**Authentication:** Required  
**Secret:** `OPENAI_API_KEY`

**Purpose:** Grades typed vocabulary definitions using OpenAI GPT-4o-mini

**Input:**
```javascript
{
  answers: [
    {
      wordId: string,
      word: string,
      correctDefinition: string,
      studentResponse: string
    }
  ]
}
```

**Output:**
```javascript
{
  results: [
    {
      wordId: string,
      isCorrect: boolean,
      reasoning: string
    }
  ]
}
```

**Features:**
- Pre-filters blank responses (auto-marks incorrect)
- Uses lenient grading rules (accepts synonyms, paraphrasing, multiple languages)
- Post-grading validation (overrides AI mistakes for blank responses, word repetition, etc.)
- Maximum 100 answers per request
- Returns normalized results matching input order

---

## 4. Component Tree

### `src/pages/` (Page Components)

| File | Description |
|------|-------------|
| `ClassDetail.jsx` | Teacher view for managing a class: assign lists, view students, class switcher popover, link to filtered gradebook |
| `Dashboard.jsx` | Main dashboard that renders differently for teachers (classes, lists) vs students (assigned lists, study/test options) |
| `Gradebook.jsx` | Unified gradebook component supporting both teacher (review challenges) and student (submit challenges) modes |
| `ListEditor.jsx` | Create/edit vocabulary lists: add/edit/delete words, import from CSV/text |
| `ListLibrary.jsx` | Teacher view of all vocabulary lists with navigation to edit/create |
| `Login.jsx` | User login page with email/password and Google OAuth |
| `Signup.jsx` | User registration page with email/password and Google OAuth |
| `StudySession.jsx` | Flashcard study session with Leitner system integration |
| `TakeTest.jsx` | Multiple choice vocabulary test |
| `TypedTest.jsx` | Typed definition test with AI grading and challenge system |
| `TeacherGradebook.jsx` | Legacy file (replaced by `Gradebook.jsx`) |

---

### `src/components/` (Reusable Components)

| File | Description |
|------|-------------|
| `AssignListModal.jsx` | Modal for teachers to assign lists to classes with pace, test options, and test mode settings |
| `BackButton.jsx` | Reusable back button component linking to dashboard |
| `CollapsibleCard.jsx` | Card component with expand/collapse functionality |
| `CreateClassModal.jsx` | Modal for creating new classes |
| `Flashcard.jsx` | Flashcard component for study sessions with flip animation and audio playback |
| `ImportWordsModal.jsx` | Modal for importing words from CSV/text format |
| `LoadingSpinner.jsx` | Loading spinner component with size variants |
| `MasteryBars.jsx` | Visual mastery progress bars component |
| `MasterySquares.jsx` | Visual mastery squares component |
| `PrivateRoute.jsx` | Route wrapper requiring authentication |
| `TeacherRoute.jsx` | Route wrapper requiring teacher role |
| `TestResults.jsx` | Unified component for displaying MCQ and typed test results with challenge UI |

**Subdirectory:** `src/components/modals/`
| File | Description |
|------|-------------|
| `StudySelectionModal.jsx` | Modal for selecting study mode/options |

---

### `src/components/ui/` (UI Component Library)

| File | Description |
|------|-------------|
| `Badge.jsx` | Badge component with variants (default, info, success, warning, error, purple) and sizes |
| `Button.jsx` | Button component with variants (primary, primary-blue, secondary, ghost, outline, danger) and sizes |
| `Card.jsx` | Card component with variants (default, hoverable, hero, gradient, vitals) and sizes |
| `IconButton.jsx` | Icon-only button component with variants (default, danger, ghost) and sizes |
| `Input.jsx` | Text input component with sizes and focus states |
| `Modal.jsx` | Modal/dialog component with sizes and close button |
| `Select.jsx` | Dropdown select component with sizes and focus states (matches modal style) |
| `Textarea.jsx` | Textarea component with focus states |
| `index.js` | Barrel export file for all UI components |

---

## 5. Key Services

All exported functions from `src/services/db.js` grouped by purpose:

### Authentication & User Management
- `createUserDocument(user, payload)` - Creates or merges Firestore user document with defaults
- `updateUserSettings(userId, settings)` - Updates user settings (weeklyGoal, useUnifiedQueue)

### Classes
- `createClass({ name, ownerTeacherId })` - Creates a new class with generated join code
- `fetchTeacherClasses(ownerTeacherId)` - Fetches all classes owned by a teacher
- `fetchStudentClasses(studentId)` - Fetches all classes a student is enrolled in with assigned list details
- `fetchClass(classId)` - Fetches a single class document
- `deleteClass(classId)` - Deletes a class document
- `joinClass(studentId, joinCode)` - Enrolls a student in a class using join code
- `assignListToClass(classId, listId, pace, testOptionsCount, testMode)` - Assigns a list to a class with settings
- `unassignListFromClass(classId, listId)` - Removes a list assignment from a class
- `updateAssignmentSettings(classId, listId, settings)` - Updates assignment settings (pace, testOptionsCount, testMode)

### Lists
- `createList({ title, description, ownerId, visibility })` - Creates a new vocabulary list
- `fetchTeacherLists(ownerId)` - Fetches all lists owned by a teacher
- `fetchAllWords(listId)` - Fetches all words from a list
- `addWordToList(listId, wordData)` - Adds a single word to a list
- `updateWord(listId, wordId, wordData)` - Updates a word in a list
- `deleteWord(listId, wordId)` - Deletes a word from a list
- `batchAddWords(listId, wordsArray)` - Adds multiple words to a list in batches
- `deleteList(listId)` - Deletes a list and all its words

### Study & Learning
- `fetchSmartStudyQueue(listId, userId, classId, limitAmount)` - Fetches words due for study based on Leitner system
- `saveStudyResult(userId, wordId, result)` - Saves study session result and updates word box
- `fetchStudentStats(userId, listId)` - Fetches student progress stats for a specific list
- `fetchStudentAggregateStats(studentId)` - Fetches aggregate stats across all lists
- `fetchDashboardStats(userId)` - Fetches dashboard statistics (weekly progress, latest test, mastery count, retention)

### Tests
- `generateTest(userId, listId, classId, limit)` - Generates MCQ test words with options based on priority
- `generateTypedTest(userId, listId, classId, limit)` - Generates typed test words (same prioritization, no options)
- `submitTestAttempt(userId, testId, answers, totalQuestions, classId)` - Submits MCQ test attempt and updates word states
- `submitTypedTestAttempt(userId, testId, words, responses, gradingResults, classId)` - Submits typed test attempt with AI grading results
- `calculateCredibility(answers, userWordStates)` - Calculates credibility score from test answers

### Attempts & Gradebook
- `fetchClassAttempts(classId)` - Fetches all attempts for a class (legacy, used in ClassDetail)
- `fetchAllTeacherAttempts(teacherId)` - Fetches all attempts for a teacher (legacy, replaced by queryTeacherAttempts)
- `queryTeacherAttempts(teacherId, filters, lastDoc, pageSize)` - Server-side paginated query for teacher attempts with filtering
- `queryStudentAttempts(studentId, filters, lastDoc, pageSize)` - Server-side paginated query for student attempts with filtering
- `fetchAttemptDetails(attemptId)` - Fetches full attempt details with enriched data (student name, list name, class name, word definitions)
- `fetchUserAttempts(uid)` - Fetches all attempts for a user (legacy)

### Challenges
- `getAvailableChallengeTokens(challengeHistory)` - Calculates available challenge tokens (5 minus active rejections)
- `submitChallenge(userId, attemptId, wordId, note)` - Submits a challenge for a typed test answer
- `reviewChallenge(teacherId, attemptId, wordId, accepted)` - Teacher reviews and accepts/rejects a challenge

---

## Design System

**Name:** "Academic Glass"  
**Documentation:** See `UI_DESIGN.md` for complete design system documentation

**Key Characteristics:**
- Slate color palette with royal blue (`brand-primary`) and orange (`brand-accent`) accents
- Rounded corners (`rounded-xl`, `rounded-2xl`, `rounded-3xl`)
- Consistent spacing and typography
- Glassmorphism-inspired elements
- Centralized UI component library in `src/components/ui/`

---

## Key Features

1. **Leitner Spaced Repetition System** - 5-box system for word mastery tracking
2. **Dual Test Modes** - Multiple choice (MCQ) and typed definition tests
3. **AI Grading** - OpenAI GPT-4o-mini for typed test grading with lenient rules
4. **Challenge System** - Students can challenge AI grading decisions (5 tokens, 30-day penalty for rejections)
5. **Teacher Gradebook** - Comprehensive gradebook with filtering, pagination, and Excel export
6. **Class Management** - Teachers can create classes, assign lists, manage students
7. **List Management** - Teachers can create/edit vocabulary lists with word import
8. **Study Sessions** - Flashcard-based study with audio playback
9. **Progress Tracking** - Credibility and retention metrics, mastery visualization
10. **Google OAuth** - Alternative authentication method alongside email/password

---

## Technology Stack

- **Frontend:** React, React Router DOM, Tailwind CSS
- **Backend:** Firebase (Firestore, Authentication, Cloud Functions)
- **AI:** OpenAI GPT-4o-mini (via Cloud Function)
- **Icons:** Lucide React
- **PDF Generation:** jsPDF, jsPDF-AutoTable
- **Excel Export:** xlsx
- **State Management:** React Hooks (useState, useEffect, useMemo, useCallback)

---

## Recent Major Changes

See `CHANGELOG.md` for detailed change history. Recent highlights:
- Unified `Gradebook` component for teacher and student views
- Class switcher popover in ClassDetail
- URL-based gradebook filtering (`?classId=xxx`)
- Centralized UI component library
- Unified `TestResults` component for MCQ and typed tests
- Challenge system implementation
- Typed test with AI grading
- Test mode settings (`mcq`, `typed`, `both`)

