# Study Algorithm Audit

## Overview

This document analyzes the current study/spaced repetition system before replacing it with FSRS (Free Spaced Repetition Scheduler). The system uses a modified Leitner box algorithm with 5 boxes and a streak-based promotion system.

---

## 1. Current Algorithm Summary

### Algorithm Type
**Modified Leitner Box System** with streak-based promotion

### Box System
- **5 Boxes**: Boxes 1-5 (Box 1 = lowest mastery, Box 5 = highest mastery)
- **Box 4+**: Considered "mastered" (used in stats calculations)
- **Box 1**: Default for new/unseen words

### Review Scheduling
- **Interval Calculation**: `box * 15 minutes` (capped at 24 hours = 1440 minutes)
- **Next Review Time**: Calculated as `now + (box * 15 minutes)`
- **Due Words**: Words where `nextReview <= now`

### Study Result Logic (`saveStudyResult`)

#### "Easy" Result
- **Streak**: Increments by 1
- **Box Promotion**:
  - If `streak >= 3` AND `currentBox === 3`: Promote to Box 4, reset streak to 0
  - If `currentBox < 3`: Promote to `currentBox + 1`
  - If `currentBox >= 3` (but not the streak case): Stay at Box 3

#### "Hard" Result
- **Streak**: Reset to 0
- **Box**: Demote to `Math.max(1, currentBox - 1)`

#### "Again" Result
- **Streak**: Reset to 0
- **Box**: Reset to Box 1

### Test Result Logic (`submitTestAttempt` / `submitTypedTestAttempt`)

#### Correct Answer
- **Box < 3**: Promote directly to Box 4 (instant mastery)
- **Box >= 3**: Promote to Box 5
- **Streak**: Reset to 0

#### Wrong Answer
- **Box**: Demote to Box 1
- **Streak**: Reset to 0

---

## 2. Data Model

### Firestore Structure

#### Study States Collection
**Path**: `users/{userId}/study_states/{wordId}`

**Document Fields**:
```javascript
{
  box: number,              // 1-5, default: 1
  streak: number,           // Consecutive "easy" results, default: 0
  lastReviewed: Timestamp,  // Last review timestamp
  nextReview: Timestamp,    // Next scheduled review time
  result: string            // Last result: 'again' | 'hard' | 'easy'
}
```

#### User Document
**Path**: `users/{userId}`

**Relevant Fields**:
```javascript
{
  stats: {
    retention: number,      // Retention rate (0-1)
    credibility: number,    // Test credibility score (0-1)
    totalWordsLearned: number
  },
  settings: {
    weeklyGoal: number,
    useUnifiedQueue: boolean
  }
}
```

#### Class Assignment
**Path**: `classes/{classId}`

**Relevant Fields**:
```javascript
{
  assignments: {
    [listId]: {
      pace: number,              // Daily new word limit (default: 20)
      testOptionsCount: number,   // MCQ options (default: 4)
      testMode: string,           // 'mcq' | 'typed' | 'both'
      assignedAt: Timestamp
    }
  }
}
```

---

## 3. Key Functions

### `fetchSmartStudyQueue(listId, userId, classId, limitAmount)`
**Location**: `src/services/db.js:865-957`

**Purpose**: Selects words for study session based on priority

**Priority Order**:
1. **Due Words**: Words with `nextReview <= now`
2. **New Words**: Words without study_states (limited by daily pace)
3. **Review Words**: Words with `nextReview > now` (non-due)

**Special Cases**:
- If `retention < 0.6`: Only return Box 1 words
- Daily new word limit: `basePace * credibility` (default pace: 20)

**Returns**: Array of word objects (up to `limitAmount`, default: 100)

---

### `saveStudyResult(userId, wordId, result)`
**Location**: `src/services/db.js:971-1018`

**Purpose**: Updates study state after flashcard review

**Parameters**:
- `userId`: User ID
- `wordId`: Word ID
- `result`: `'again' | 'hard' | 'easy'`

**Updates**:
- `box`: Based on result logic (see Section 1)
- `streak`: Based on result logic
- `lastReviewed`: Current timestamp
- `nextReview`: Calculated via `computeNextReview(nextBox)`
- `result`: Stores the result value

---

### `computeNextReview(box)`
**Location**: `src/services/db.js:965-969`

**Purpose**: Calculates next review timestamp based on box number

**Formula**:
```javascript
const minutes = Math.min(box * 15, 24 * 60)  // Cap at 24 hours
return Timestamp.fromMillis(now.toMillis() + minutes * 60 * 1000)
```

**Intervals**:
- Box 1: 15 minutes
- Box 2: 30 minutes
- Box 3: 45 minutes
- Box 4: 60 minutes
- Box 5: 75 minutes
- Max: 1440 minutes (24 hours)

---

### `nextBoxValue(currentBox, result)`
**Location**: `src/services/db.js:959-963`

**Purpose**: Helper function to calculate next box (currently **NOT USED** in `saveStudyResult`)

**Note**: This function exists but is not called. The actual box logic is inline in `saveStudyResult`.

---

### `generateTest(userId, listId, classId, limit)`
**Location**: `src/services/db.js:1094-1204`

**Purpose**: Generates MCQ test words with prioritization

**Priority Order**:
1. **Due Review Words**: Box 1 words with `nextReview < now`
2. **Glass Ceiling Words**: Box 3 words (stuck words)
3. **New Words**: Unseen words

**Returns**: Array of word objects with MCQ options

---

### `generateTypedTest(userId, listId, classId, limit)`
**Location**: `src/services/db.js:1214-1269`

**Purpose**: Generates typed test words (same prioritization as MCQ)

**Returns**: Array of word objects (no MCQ options)

---

### `submitTestAttempt(userId, testId, answers, totalQuestions, classId)`
**Location**: `src/services/db.js:1282-1412`

**Purpose**: Processes test results and updates study states

**Logic**:
- **Correct**: Promote to Box 4 (if box < 3) or Box 5 (if box >= 3)
- **Wrong**: Demote to Box 1
- Updates `credibility` and `retention` stats
- Creates attempt document in `attempts` collection

---

### `submitTypedTestAttempt(userId, testId, words, responses, gradingResults, classId)`
**Location**: `src/services/db.js:1424-1593`

**Purpose**: Processes typed test results (same box logic as MCQ)

**Note**: Uses AI grading results from Cloud Function

---

### `fetchStudentStats(userId, listId)`
**Location**: `src/services/db.js:1020-1072`

**Purpose**: Calculates mastery statistics for a list

**Returns**:
```javascript
{
  mastery: number,        // Percentage (0-100)
  due: number,            // Count of due words
  totalWords: number,     // Total words in list
  wordsLearned: number,   // Words with box > 1
  masteredWords: number, // Words with box >= 4
  masteryCount: number    // Same as masteredWords
}
```

---

## 4. Parameters & Constants

### Box System
- **Box Range**: 1-5
- **Mastery Threshold**: Box 4+
- **Default Box**: 1 (for new words)

### Interval Calculation
- **Base Interval**: 15 minutes per box
- **Maximum Interval**: 24 hours (1440 minutes)
- **Formula**: `min(box * 15, 1440) minutes`

### Streak System
- **Streak Threshold**: 3 consecutive "easy" results
- **Promotion Condition**: `streak >= 3 AND box === 3` → Box 4
- **Reset Conditions**: "hard" or "again" results

### Daily Limits
- **Default Pace**: 20 new words per day
- **Pace Calculation**: `basePace * credibility`
- **Credibility Range**: 0-1 (based on test performance)

### Retention Threshold
- **Low Retention Mode**: `retention < 0.6`
- **Behavior**: Only shows Box 1 words in study queue

---

## 5. Integration Points

### StudySession.jsx
**Location**: `src/pages/StudySession.jsx`

**Integration**:
- **Line 50**: Calls `fetchSmartStudyQueue()` to load words
- **Line 76**: Calls `saveStudyResult(userId, wordId, result)` with:
  - `result`: `'again' | 'hard' | 'easy'`
- **Lines 197-217**: UI buttons map to results:
  - "Again" → `'again'`
  - "Hard" → `'hard'`
  - "Easy" → `'easy'`

**Flow**:
1. Load study queue on mount
2. Display flashcard
3. User flips card
4. User selects difficulty
5. Save result → update box/streak/nextReview
6. Move to next word

---

### TakeTest.jsx
**Location**: `src/pages/TakeTest.jsx`

**Integration**:
- **Line 64**: Calls `generateTest()` to load test words
- **Line 122**: Calls `submitTestAttempt()` to process results

**Flow**:
1. Generate test words (prioritized)
2. User answers MCQ questions
3. Submit → update study states based on correctness
4. Show results

---

### TypedTest.jsx
**Location**: `src/pages/TypedTest.jsx`

**Integration**:
- **Line 67**: Calls `generateTypedTest()` to load words
- **Line 181**: Calls `submitTypedTestAttempt()` after AI grading

**Flow**:
1. Generate test words (prioritized)
2. User types definitions
3. AI grades responses (Cloud Function)
4. Submit → update study states based on correctness
5. Show results

---

### Dashboard Stats
**Location**: `src/services/db.js:364-445` (`fetchDashboardStats`)

**Integration**:
- Counts words reviewed in last 7 days
- Counts mastered words (box >= 4)
- Calculates retention from user stats

---

## 6. Algorithm Characteristics

### Strengths
- Simple box-based system
- Streak system encourages consistent practice
- Test results provide instant mastery promotion
- Daily pace limits prevent overwhelm

### Limitations
- **Fixed intervals**: No adaptive scheduling based on performance history
- **No ease factor**: All words in same box have same interval
- **Limited boxes**: Only 5 boxes (may not scale well)
- **No forgetting curve**: Doesn't model memory decay
- **Simple intervals**: Linear progression (15, 30, 45, 60, 75 minutes)
- **No review history**: Only tracks last review, not full history

### Differences from Traditional Leitner
- **Streak requirement**: Box 3 → 4 requires 3 consecutive "easy"
- **Test promotion**: Tests can instantly promote to Box 4/5
- **No box demotion on wrong**: Tests demote to Box 1 (not gradual)

---

## 7. Migration Considerations

### Data to Preserve
- `box`: Current mastery level (1-5)
- `lastReviewed`: Last review timestamp
- `streak`: Current streak count

### Data to Add (FSRS)
- `difficulty`: FSRS difficulty parameter
- `stability`: FSRS stability parameter
- `reviewHistory`: Array of review records
- `lastReview`: Last review timestamp (may reuse `lastReviewed`)
- `dueDate`: Next review date (may replace `nextReview`)

### Functions to Replace
- `saveStudyResult()` → FSRS `review()` function
- `computeNextReview()` → FSRS `nextReview()` calculation
- `fetchSmartStudyQueue()` → FSRS queue selection

### Functions to Keep
- `generateTest()` / `generateTypedTest()` (prioritization logic may change)
- `submitTestAttempt()` / `submitTypedTestAttempt()` (box update logic will change)

---

## 8. Code Locations Summary

| Function | File | Lines |
|----------|------|-------|
| `fetchSmartStudyQueue` | `src/services/db.js` | 865-957 |
| `saveStudyResult` | `src/services/db.js` | 971-1018 |
| `computeNextReview` | `src/services/db.js` | 965-969 |
| `nextBoxValue` | `src/services/db.js` | 959-963 |
| `generateTest` | `src/services/db.js` | 1094-1204 |
| `generateTypedTest` | `src/services/db.js` | 1214-1269 |
| `submitTestAttempt` | `src/services/db.js` | 1282-1412 |
| `submitTypedTestAttempt` | `src/services/db.js` | 1424-1593 |
| `fetchStudentStats` | `src/services/db.js` | 1020-1072 |
| `StudySession` component | `src/pages/StudySession.jsx` | 21-230 |
| `TakeTest` component | `src/pages/TakeTest.jsx` | 22-317 |
| `TypedTest` component | `src/pages/TypedTest.jsx` | 25-327 |

---

## 9. Test Word Selection Logic

### Current Prioritization
Both `generateTest()` and `generateTypedTest()` use the same 3-tier priority:

1. **Due Review Words (Box 1)**: Words in Box 1 with `nextReview < now`
2. **Glass Ceiling Words (Box 3)**: Words stuck in Box 3
3. **New Words**: Words without study_states

### Selection Process
- Fills up to `limit` (default: 50) words
- Shuffles final selection
- **No random selection**: All selection is priority-based

### MCQ Options Generation
- Prefers same part-of-speech distractors
- Falls back to any word if not enough POS matches
- Number of options: 4-10 (configurable per class assignment)

---

## 10. Edge Cases & Special Behaviors

### Low Retention Mode
- **Trigger**: `user.stats.retention < 0.6`
- **Behavior**: `fetchSmartStudyQueue()` only returns Box 1 words
- **Purpose**: Focus on struggling words

### Daily New Word Limit
- **Calculation**: `basePace * credibility`
- **Default**: 20 words/day
- **Adjustment**: Credibility from 0-1 scales the limit
- **Purpose**: Prevent overwhelming students with too many new words

### Test Instant Mastery
- **Correct answer on test**: Instant promotion to Box 4 (if box < 3) or Box 5 (if box >= 3)
- **Purpose**: Reward test performance
- **Note**: Different from flashcard "easy" which requires streak

### Challenge System
- **Location**: `src/services/db.js:2646-2842`
- **Impact**: If challenge accepted, word promoted to Box 4/5 (same as correct test answer)
- **Note**: Separate from study algorithm but affects box state

---

## End of Audit

This document provides a complete overview of the current study algorithm. Use this as a reference when implementing FSRS to ensure all functionality is preserved or appropriately migrated.

