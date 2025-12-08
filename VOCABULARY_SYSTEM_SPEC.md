# VocaBoost Vocabulary System Specification

## Overview

VocaBoost uses a spaced repetition system (SRS) with a "box" progression model to help students learn and retain vocabulary words. This document explains how the vocabulary system works, including word progression, study sessions, tests, and PDF generation.

---

## 1. The Box System

### Box Levels

Each word has a **box** value (1-5) that represents its mastery level:

- **Box 1**: New/Unseen words or words that need review
- **Box 2-3**: Words in progress (learning phase)
- **Box 4**: Mastered words (first mastery level)
- **Box 5**: Advanced mastery (words that were already mastered and tested correctly again)

### Box Progression Rules

Words start at **Box 1** (unseen). As students study or test, words move between boxes based on performance.

---

## 2. How "Words Due" Are Calculated

### Definition of "Due"

A word is considered **"due"** when its `nextReview` timestamp is less than or equal to the current time. The `nextReview` timestamp is calculated when a word is studied or tested.

### Next Review Calculation

The `nextReview` time is computed using the formula:

```javascript
nextReview = currentTime + (box * 15 minutes)
```

**Examples:**
- **Box 1**: Due in 15 minutes
- **Box 2**: Due in 30 minutes
- **Box 3**: Due in 45 minutes
- **Box 4**: Due in 60 minutes (1 hour)
- **Box 5**: Due in 75 minutes (capped at 24 hours maximum)

**Note:** The maximum review interval is capped at 24 hours (1440 minutes).

### Counting Due Words

The system counts words as "due" by:

1. Fetching all words in a vocabulary list
2. Loading the student's `study_states` collection (contains box and `nextReview` for each word)
3. Comparing each word's `nextReview` timestamp to the current time
4. Counting words where `nextReview.toMillis() <= now.toMillis()`

**Implementation:** `fetchStudentStats()` function in `src/services/db.js`

---

## 3. What Happens When You Study

### Study Session Flow

1. **Queue Generation**: The system calls `fetchSmartStudyQueue()` to generate a personalized study queue
2. **Word Presentation**: Words are shown as flashcards (word on front, definition on back)
3. **Student Response**: Student selects "Again", "Hard", or "Easy"
4. **Result Processing**: The system calls `saveStudyResult()` to update the word's state

### Study Queue Priority

The study queue is built with the following priority (when retention ≥ 0.6):

1. **Due Words** (highest priority): Words where `nextReview <= now`
2. **New Words**: Words that have never been studied (limited by daily pace)
3. **Review Words**: Words that are not yet due but have been studied before

**Special Case (Low Retention):** If student's retention < 0.6, only Box 1 words are shown (panic mode).

### Daily New Word Limit

The number of new words introduced per day is calculated as:

```javascript
dailyNewLimit = basePace * credibility
```

- **basePace**: Default is 20, but can be set per class assignment
- **credibility**: Student's trust score (0.0 - 1.0), calculated from test performance

### Study Result Processing

When a student studies a word and selects a result:

#### If Result is "Easy":
- **Streak**: Incremented by 1
- **Box Progression**:
  - If `streak >= 3` AND `currentBox === 3`: Move to **Box 4** (mastery achieved)
  - If `currentBox < 3`: Move to `currentBox + 1`
  - If `currentBox >= 3`: Stay at Box 3 (glass ceiling)
- **Next Review**: Calculated based on new box value

#### If Result is "Hard":
- **Streak**: Reset to 0
- **Box**: Stays the same (no change)
- **Next Review**: Recalculated for current box

#### If Result is "Again":
- **Streak**: Reset to 0
- **Box**: Demoted to **Box 1** (or stays at 1 if already there)
- **Next Review**: Recalculated for Box 1 (15 minutes)

### Data Saved:
- `lastReviewed`: serverTimestamp()`
- `result`: "again" | "hard" | "easy"
- `box`: Updated box value (1-5)
- `streak`: Updated streak count
- `nextReview`: New timestamp for next review

**Implementation:** `saveStudyResult()` function in `src/services/db.js`

---

## 4. What Happens When You Take a Test

### Test Generation

When a student starts a test, the system calls `generateTest()` which:

1. **Fetches all words** from the vocabulary list (no filtering)
2. **Loads student's study states** to determine word progression
3. **Prioritizes word selection**:
   - **Priority 1**: Due Review Words (Box 1, `nextReview < now`)
   - **Priority 2**: "Glass Ceiling" Words (Box 3 - words stuck at intermediate level)
   - **Priority 3**: New/Unseen Words
4. **Generates multiple-choice options**:
   - Correct answer (the word's definition)
   - Distractor options (prefer same part of speech, then random)
   - Number of options configurable per class (default: 4)
5. **Shuffles and limits** to test size (default: 50 words)

### Test Submission

When a student submits a test:

1. **Score Calculation**: `correctAnswers / totalAnswered`
2. **Credibility Update**: Calculated as `correctCount / totalAnswers` (affects daily new word limit)
3. **Retention Calculation**: For words in Box 4+, calculates `correctAnswers / totalBox4PlusWords`
4. **Word State Updates**: Each answered word's box is updated based on correctness

### Test Result Processing

#### If Answer is **Correct**:
- **If current box < 3**: Promote directly to **Box 4** (instant mastery)
- **If current box >= 3**: Promote to **Box 5** (advanced mastery)
- **Streak**: Reset to 0
- **Next Review**: Recalculated based on new box

#### If Answer is **Wrong**:
- **Box**: Demoted to **Box 1** (back to learning phase)
- **Streak**: Reset to 0
- **Next Review**: Recalculated for Box 1 (15 minutes)

**Note:** Skipped/unanswered words are **not** processed and do not affect word states.

### Test Attempt Record

The system saves a test attempt document with:

- `studentId`: Student's user ID
- `testId`: Format `test_{listId}_{timestamp}`
- `classId`: Class ID (if taken in class context)
- `teacherId`: Teacher ID (for gradebook queries)
- `score`: Percentage score (0-100)
- `totalQuestions`: Total questions in test
- `answers`: Array of answer objects (word, correctAnswer, studentResponse, isCorrect)
- `credibility`: New credibility score
- `retention`: Retention score for Box 4+ words
- `submittedAt`: Server timestamp

**Implementation:** `submitTestAttempt()` function in `src/services/db.js`

---

## 5. Student Generated PDF

### PDF Generation Modes

Students can generate PDFs in two modes:

1. **Daily Worksheet Mode**: Personalized study queue (student view)
2. **Full List Mode**: Complete vocabulary list (teacher view)

### Daily Worksheet PDF (Student View)

**Trigger:** Student clicks "PDF" button on a class-assigned list in their dashboard.

**Data Source:** `fetchSmartStudyQueue(listId, userId, classId)` - same queue used for study sessions.

**Contents:**

1. **Header Section:**
   - "VocaBoost" logo/title (blue color)
   - List title
   - "Personalized Study Queue for [Date]"
   - Generation timestamp

2. **Table Columns:**
   - **Word**: The vocabulary word (bold)
   - **POS**: Part of speech
   - **Definition**: Primary definition + Korean definition (if available)
   - **Sample**: Sample sentence/usage

3. **Word Data Fields:**
   - `word` or `term`
   - `partOfSpeech` or `pos`
   - `definition` (primary) + `definitions.ko` (Korean, if available)
   - `samples[0]` or `sample` or `sampleSentence`

**File Naming:** `{ListTitle}_{YYYY-MM-DD}.pdf`

### Full List PDF (Teacher View)

**Trigger:** Teacher clicks "PDF" button on a list in class management.

**Data Source:** `fetchAllWords(listId)` - all words in the list, no filtering.

**Contents:** Same table structure as Daily Worksheet, but includes **all words** in the list, not filtered by student progress.

### PDF Technical Details

- **Format**: A4 portrait
- **Font**: Pretendard (Korean font support) with fallback to Helvetica
- **Styling**:
  - Grid theme with alternating row colors
  - Header row with slate background
  - Bold word column
  - Line breaks for long definitions
- **International Support**: Handles Korean characters via custom font loading

**Implementation:** `downloadListAsPDF()` function in `src/utils/pdfGenerator.js`

---

## 6. Key Data Structures

### Study State Document

**Location:** `users/{userId}/study_states/{wordId}`

**Fields:**
- `box`: Number (1-5)
- `streak`: Number (consecutive "easy" responses)
- `lastReviewed`: Firestore Timestamp
- `nextReview`: Firestore Timestamp
- `result`: String ("again" | "hard" | "easy") - last study result

### Test Attempt Document

**Location:** `attempts/{attemptId}`

**Fields:**
- `studentId`: String
- `testId`: String (format: `test_{listId}_{timestamp}`)
- `classId`: String | null
- `teacherId`: String | null
- `score`: Number (0-100)
- `totalQuestions`: Number
- `answers`: Array of answer objects
- `credibility`: Number (0.0-1.0)
- `retention`: Number (0.0-1.0)
- `submittedAt`: Firestore Timestamp

### User Stats Document

**Location:** `users/{userId}`

**Fields:**
- `stats.credibility`: Number (0.0-1.0) - affects daily new word limit
- `stats.retention`: Number (0.0-1.0) - affects study queue behavior

---

## 7. Key Functions Reference

### `fetchSmartStudyQueue(listId, userId, classId, limitAmount)`
Generates personalized study queue with priority: due words → new words → review words.

### `saveStudyResult(userId, wordId, result)`
Updates word's box, streak, and nextReview based on study result ("again" | "hard" | "easy").

### `generateTest(userId, listId, classId, limit)`
Creates a test with prioritized word selection and multiple-choice options.

### `submitTestAttempt(userId, testId, answers, totalQuestions, classId)`
Processes test results, updates word states, and saves attempt record.

### `fetchStudentStats(userId, listId)`
Calculates mastery percentage, due count, and learned words for a list.

### `computeNextReview(box)`
Calculates next review timestamp: `currentTime + (box * 15 minutes)`, capped at 24 hours.

### `downloadListAsPDF(listTitle, words, mode)`
Generates PDF with Korean font support in "Daily Worksheet" or "Full List" mode.

---

## 8. Summary Flow Diagrams

### Study Flow
```
Student clicks "Study Now"
  → fetchSmartStudyQueue() generates queue
  → Words shown as flashcards
  → Student selects result
  → saveStudyResult() updates box/streak/nextReview
  → Word moves to appropriate box
```

### Test Flow
```
Student clicks "Take Test"
  → generateTest() creates test with prioritized words
  → Student answers questions
  → submitTestAttempt() processes results
  → Correct answers: Promote to Box 4 or 5
  → Wrong answers: Demote to Box 1
  → Attempt saved to attempts collection
```

### Due Words Calculation
```
For each word in list:
  → Check if study_states/{wordId} exists
  → If exists, check nextReview timestamp
  → If nextReview <= now, word is "due"
  → Count all due words
```

---

## 9. Edge Cases and Special Behaviors

### Low Retention Mode
If `retention < 0.6`, study queue only shows Box 1 words (panic mode - focus on struggling words).

### Glass Ceiling
Words at Box 3 require 3 consecutive "easy" responses to reach Box 4, or a correct test answer.

### Test Instant Mastery
Correct test answers instantly promote words to Box 4 (if < Box 3) or Box 5 (if >= Box 3), bypassing the normal study progression.

### Legacy Data Support
The system handles words without `classId` or `correctAnswer` fields (from older attempts) through fallback logic.

### Daily Pace Calculation
New words per day = `basePace * credibility`, ensuring students with lower credibility get fewer new words to prevent overload.

---

## 10. Performance Optimizations

- **Lazy Loading**: Answers are not loaded in `queryTeacherAttempts()` - only fetched on demand via `fetchAttemptDetails()`
- **Caching**: Teacher data (classes, students, lists) cached for 5 minutes to avoid redundant fetches
- **Session Storage**: Word lists cached in sessionStorage for faster subsequent loads
- **Batch Updates**: Test results processed in parallel using `Promise.all()`

---

*Last Updated: [Current Date]*
*Version: 1.0*

