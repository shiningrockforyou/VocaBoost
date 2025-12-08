# VocaBoost Data Structure Overview

## 1. Firestore Collections (Top-Level)

### `users` Collection
**Path:** `/users/{uid}`

**Document Structure:**
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
    retention: number,               // 0.0-1.0, calculated from test results (Box 4+ words)
    credibility: number             // 0.0-1.0, calculated from test accuracy
  },
  settings: {
    weeklyGoal: number,              // Default: 100 words/week
    useUnifiedQueue: boolean         // Default: false
  },
  enrolledClasses: {                 // Denormalized map for quick access
    [classId]: {
      name: string,
      joinedAt: Timestamp
    }
  },
  createdAt: Timestamp
}
```

**Subcollection:** `users/{uid}/study_states/{wordId}`
```javascript
{
  box: number,                       // 1-5 (Leitner system)
  streak: number,                    // Consecutive "easy" responses (resets on "again"/"hard")
  lastReviewed: Timestamp,           // Last time word was studied
  nextReview: Timestamp,             // Next review time (calculated: currentTime + box * 15 minutes)
  result: "again" | "hard" | "easy"  // Last study result
}
```

---

### `classes` Collection
**Path:** `/classes/{classId}`

**Document Structure:**
```javascript
{
  name: string,
  ownerTeacherId: string,            // Reference to users/{uid}
  joinCode: string,                  // 6-character uppercase code
  settings: {
    allowStudentListImport: boolean
  },
  assignedLists: string[],             // Array of list IDs (legacy, maintained for compatibility)
  mandatoryLists: string[],           // Array of list IDs that are required
  assignments: {                      // NEW: Map structure for better metadata
    [listId]: {
      pace: number,                   // Words per day (default: 20)
      assignedAt: Timestamp,
      testOptionsCount: number        // Default: 4 (for MCQ tests)
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

**Document Structure:**
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
  samples: string[],                  // Example sentences
  audioUrl: string | null,            // Google Cloud Storage URL
  roots: string[],                    // Word roots/etymology
  partOfSpeech: string | null,
  createdAt: Timestamp
}
```

---

### `attempts` Collection
**Path:** `/attempts/{attemptId}`

**Document Structure:**
```javascript
{
  studentId: string,                  // Reference to users/{uid}
  testId: string,                     // Format: "test_{listId}_{timestamp}"
  classId: string | null,            // Class ID if test taken in class context (NEW)
  teacherId: string | null,           // Teacher ID for efficient gradebook queries (NEW)
  score: number,                      // 0-100 (percentage)
  graded: boolean,                   // Always true (graded immediately)
  answers: [
    {
      wordId: string,
      word: string,                   // Denormalized for display
      correctAnswer: string,          // The correct definition (NEW - stored for legacy compatibility)
      studentResponse: string,        // The answer the student provided
      isCorrect: boolean
    }
  ],
  skipped: number,                    // Number of unanswered questions
  totalQuestions: number,
  credibility: number,               // 0.0-1.0, calculated from all answers
  retention: number,                 // 0.0-1.0, calculated from box >= 4 words
  submittedAt: Timestamp
}
```

**Note:** 
- `classId` and `teacherId` are added to new attempts (legacy attempts may not have these fields)
- `correctAnswer` is stored in each answer object for accurate display in gradebook
- Legacy attempts without `correctAnswer` will fetch it from `lists/{listId}/words/{wordId}` on demand

---

## 2. Data Relationships

### User → Classes
- **Students:** `users/{uid}.enrolledClasses` (denormalized map)
- **Teachers:** Query `classes` where `ownerTeacherId == uid`
- **Membership:** `classes/{classId}/members/{uid}` (subcollection)

### Class → Lists
- **Assigned Lists:** `classes/{classId}.assignedLists` (array) + `assignments` (map)
- **Assignment Metadata:** `classes/{classId}.assignments[listId]` contains pace, testOptionsCount, assignedAt

### List → Words
- **Words:** `lists/{listId}/words/{wordId}` (subcollection)
- **Count:** `lists/{listId}.wordCount` (cached, updated on word add/remove)

### User → Study Progress
- **Study States:** `users/{uid}/study_states/{wordId}` (subcollection)
- **Box System:** 1 (new) → 2 → 3 → 4 (mastered) → 5 (expert)
- **Test Results:** `attempts` collection filtered by `studentId`

---

## 3. Key Data Models & Defaults

### User Defaults
```javascript
defaultProfile = {
  displayName: '',
  school: '',
  gradYear: null,
  gradMonth: null,
  calculatedGrade: null,
  avatarUrl: ''
}

defaultStats = {
  totalWordsLearned: 0,
  streakDays: 0,
  credibility: 1.0,        // Default trust score (updated after tests)
  retention: 1.0          // Default retention rate (updated after tests)
}

defaultSettings = {
  weeklyGoal: 100,        // Changed from dailyGoal
  useUnifiedQueue: false
}
```

### Class Defaults
```javascript
{
  assignedLists: [],
  mandatoryLists: [],
  settings: {
    allowStudentListImport: false
  }
}
```

### Assignment Defaults
```javascript
{
  pace: 20,               // Words per day
  testOptionsCount: 4,    // MCQ options
  assignedAt: Timestamp
}
```

---

## 4. Data Flow Patterns

### Study Session Flow
1. **Fetch Queue:** `fetchSmartStudyQueue(userId, listId, classId)`
   - Gets words from `lists/{listId}/words`
   - Checks `users/{userId}/study_states` for progress
   - Filters by due date, box level, and daily limit
2. **Save Result:** `saveStudyResult(userId, wordId, result)`
   - Updates `users/{userId}/study_states/{wordId}`
   - Calculates next box and review date
   - Updates `lastReviewed` timestamp

### Test Flow
1. **Generate Test:** `generateTest(userId, listId, classId, limit)`
   - Fetches words from list
   - Prioritizes: Due Review Words (Box 1) → Glass Ceiling Words (Box 3) → New Words
   - Creates MCQ options with distractors (prefers same part of speech)
   - Returns shuffled array
2. **Submit Test:** `submitTestAttempt(userId, testId, answers, totalQuestions, classId)`
   - Fetches `classId` from URL params (if provided)
   - Fetches `teacherId` from class document (if `classId` provided)
   - Creates document in `attempts` collection with `classId` and `teacherId`
   - Updates `users/{userId}/study_states` for each word
   - Calculates and updates `credibility` and `retention` in user stats
   - **Box Logic:**
     - Correct answer: Box < 3 → Box 4 (instant mastery), Box >= 3 → Box 5 (expert)
     - Wrong answer: → Box 1 (reset to learning phase)
   - **Answer Storage:** Each answer includes `correctAnswer` field for gradebook display

### Dashboard Stats Flow
1. **Fetch Stats:** `fetchDashboardStats(userId)`
   - Queries `users/{userId}/study_states` for weekly progress
   - Queries `attempts` for latest test
   - Counts mastered words (box >= 4)
   - Gets retention from `users/{userId}.stats.retention`
2. **Student Classes:** `fetchStudentClasses(studentId)`
   - Reads `users/{studentId}.enrolledClasses`
   - Fetches full class documents
   - Populates `assignedListDetails` with list data and stats
   - Calculates `list.stats` via `fetchStudentStats(userId, listId)`

---

## 5. Important Data Transformations

### Backward Compatibility
- **Old `assignedLists` array** → **New `assignments` map**
  - Code converts old format to new format on read
  - Both formats maintained during transition

### Test ID Format
- **Pattern:** `test_{listId}_{timestamp}`
- **Example:** `test_abc123_1704067200000`
- Used to extract `listId` from test attempts

### Study State Box System
- **Box 1:** New/Unseen words
- **Box 2-3:** Learning phase
- **Box 4:** Mastered (counted in stats)
- **Box 5:** Expert level (from test mastery)

### Stats Calculations
- **`totalWordsLearned`:** Count of words where `box > 1`
- **`masteredWords`:** Count of words where `box >= 4`
- **`mastery`:** Percentage = `(masteryCount / totalWords) * 100`
- **`retention`:** Calculated from test results on words in box >= 4
  - Formula: `(correct answers on box 4+ words) / (total box 4+ words tested)`
  - Default: 1.0 if no box 4+ words tested
- **`credibility`:** Calculated from test accuracy (affects daily new word limit)
  - Formula: `(correct answers) / (total answers)`
  - Default: 1.0 for new users
  - Used in: `dailyNewLimit = basePace * credibility`

---

## 6. Data Access Patterns

### Caching Strategy
- **Session Storage:** Word lists cached in `sessionStorage` with timestamp
- **Cache Key:** `vocaboost_words_${listId}`
- **TTL:** Session-based (cleared on page refresh)

### Query Patterns
- **Teacher Classes:** `where('ownerTeacherId', '==', uid)`
- **Teacher Lists:** `where('ownerId', '==', uid)`
- **Class by Join Code:** `where('joinCode', '==', code)`
- **Latest Test:** `where('studentId', '==', uid), orderBy('submittedAt', 'desc'), limit(1)`
- **Teacher Attempts:** `where('teacherId', '==', uid), orderBy('submittedAt', 'desc')` (NEW - efficient gradebook queries)
- **Teacher Attempts by Class:** `where('teacherId', '==', uid), where('classId', '==', classId), orderBy('submittedAt', 'desc')` (NEW)
- **Weekly Progress:** Filter `study_states` by `lastReviewed` within 7 days

---

## 7. Data Integrity Notes

- **Denormalization:** `users.enrolledClasses` stores class names for quick dashboard loading
- **Cached Counts:** `lists.wordCount` updated on word add/remove operations
- **Atomic Updates:** Uses Firestore batches for multi-document updates
- **Cleanup:** `fetchStudentClasses` removes invalid class references from `enrolledClasses`
- **Legacy Data Support:** 
  - Old attempts without `classId`/`teacherId` are handled via fallback logic
  - Old attempts without `correctAnswer` fetch definition from `lists/{listId}/words/{wordId}` on demand
- **Teacher Data Caching:** Teacher-related data (classes, students, lists) cached for 5 minutes to reduce redundant queries

---

## 8. Firestore Indexes

### Required Composite Indexes

The following composite indexes are required for efficient queries:

**Index 1: Teacher Attempts Query**
- Collection: `attempts`
- Fields:
  - `teacherId` (Ascending)
  - `submittedAt` (Descending)
- Used by: `queryTeacherAttempts()` for gradebook queries

**Index 2: Teacher Attempts by Class**
- Collection: `attempts`
- Fields:
  - `teacherId` (Ascending)
  - `classId` (Ascending)
  - `submittedAt` (Descending)
- Used by: `queryTeacherAttempts()` with class filter

**Deployment:**
- Indexes are defined in `firestore.indexes.json`
- Deploy via Firebase Console (link provided when query runs) or CLI: `firebase deploy --only firestore:indexes`

---

## 9. Collection Summary

| Collection | Document ID | Key Fields | Subcollections |
|------------|-------------|------------|----------------|
| `users` | `{uid}` | `role`, `profile`, `stats`, `settings`, `enrolledClasses` | `study_states/{wordId}` |
| `classes` | `{classId}` | `name`, `ownerTeacherId`, `joinCode`, `assignments` | `members/{studentUid}` |
| `lists` | `{listId}` | `title`, `ownerId`, `visibility`, `wordCount` | `words/{wordId}` |
| `attempts` | `{attemptId}` | `studentId`, `testId`, `classId`, `teacherId`, `score`, `answers`, `credibility`, `retention` | None |

---

## 10. Recent Schema Changes

### Added Fields (2024)

**`attempts` Collection:**
- `classId` (string | null) - Added to new test attempts for direct class attribution
- `teacherId` (string | null) - Added for efficient teacher gradebook queries
- `answers[].correctAnswer` (string) - Added to each answer object for accurate gradebook display

**`users.stats` Object:**
- `credibility` (number) - Default 1.0, updated after tests
- `retention` (number) - Default 1.0, updated after tests

**Migration Notes:**
- Legacy attempts without `classId`/`teacherId` are handled via fallback logic
- Legacy attempts without `correctAnswer` fetch definition on demand from word documents
- All new attempts include these fields automatically

---

This structure supports the study system, class management, and progress tracking while maintaining scalability and data consistency.

