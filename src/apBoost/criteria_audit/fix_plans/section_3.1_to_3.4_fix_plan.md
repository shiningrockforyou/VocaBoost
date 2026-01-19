# Fix Plan: Sections 3.1 to 3.4

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_3.1_to_3.4_criteria_audit.md

## Executive Summary
- Total Issues: 11
- ⚠️ Partial Implementations: 6
- ❌ Missing Features: 4
- ❓ Needs Investigation: 1
- Estimated Complexity: **Medium**

These issues span data model enhancements across the ap_tests, ap_stimuli, ap_questions, and ap_session_state collections. Most fixes are additive field additions with minimal risk of breaking existing functionality.

---

## Issue 1: FRQ Sections Missing frqMultipliers Object

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** FRQ sections have frqMultipliers object (per-question)
- **Current State:** No grep results for "frqMultiplier" in services or data model code

### Code Analysis
- **Relevant Files:**
  - [apTeacherService.js](src/apBoost/services/apTeacherService.js) (lines 52-76) - Test creation
  - [seedTestData.js](src/apBoost/utils/seedTestData.js) (lines 28-38) - Section structure
  - [apScoringService.js](src/apBoost/services/apScoringService.js) (lines 21-44) - MCQ scoring uses `mcqMultiplier`
- **Current Implementation:** MCQ sections have `mcqMultiplier` field at section level (line 35 of seedTestData.js). FRQ sections have no equivalent.
- **Gap:** FRQ sections need per-question multipliers in format: `frqMultipliers: { questionId: multiplier }`
- **Dependencies:**
  - `apScoringService.js` needs to use frqMultipliers when calculating FRQ scores
  - `apGradingService.js` (line 195) recalculates scores - needs frqMultipliers

### Fix Plan

#### Step 1: Add frqMultipliers to Section Schema
**File:** `src/apBoost/utils/seedTestData.js`
**Action:** Modify
**Details:**
- Add `frqMultipliers: {}` field to FRQ sections in seed data
- Pattern: `frqMultipliers: { [questionId]: 1.0 }` for each question in section

#### Step 2: Update Test Creation to Support frqMultipliers
**File:** `src/apBoost/services/apTeacherService.js`
**Action:** Modify
**Details:**
- In `createTest()` function (line 52), sections already passed through as `testData.sections`
- No change needed here - just ensure UI passes frqMultipliers in section objects

#### Step 3: Integrate frqMultipliers in Scoring
**File:** `src/apBoost/services/apScoringService.js`
**Action:** Modify
**Details:**
- Add new function `calculateFRQSectionScore()` similar to `calculateMCQScore()` (lines 21-44)
- Apply per-question multipliers: `score = subScore * (section.frqMultipliers?.[questionId] || 1)`
- Reference pattern from MCQ: `const multiplier = section.mcqMultiplier || 1` (line 41)

#### Step 4: Update Grading Service Score Calculation
**File:** `src/apBoost/services/apGradingService.js`
**Action:** Modify
**Details:**
- In `saveGrade()` (lines 182-203), update score calculation to use frqMultipliers
- After line 183 where `frqScore` is calculated, apply multipliers from test sections
- Need to fetch test data to get section frqMultipliers

### Verification Steps
1. Create a test with FRQ section containing frqMultipliers
2. Grade an FRQ and verify score uses multipliers correctly
3. Check that final AP score reflects weighted FRQ scoring

### Potential Risks
- Low risk: Additive change, defaults to 1.0 multiplier if not present
- Must handle missing frqMultipliers gracefully with fallback

---

## Issue 2: totalTime Calculation Helper Missing

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** totalTime is CALCULATED (not stored) from sum of sections
- **Current State:** No calculation function found in services

### Code Analysis
- **Relevant Files:**
  - [apTypes.js](src/apBoost/utils/apTypes.js) - Type constants
  - [seedTestData.js](src/apBoost/utils/seedTestData.js) (line 33) - Section timeLimit in minutes
  - [useTestSession.js](src/apBoost/hooks/useTestSession.js) (line 133) - Accesses `currentSection.timeLimit`
- **Current Implementation:** Each section has `timeLimit` in minutes. No helper to sum them.
- **Gap:** Need utility function to calculate total test time from sections
- **Dependencies:** Dashboard displays, test list previews

### Fix Plan

#### Step 1: Create calculateTotalTime Utility
**File:** `src/apBoost/utils/apTestConfig.js` (or new `testHelpers.js`)
**Action:** Add function
**Details:**
```javascript
/**
 * Calculate total test time from sections
 * @param {Array} sections - Array of section objects
 * @returns {number} Total time in minutes
 */
export function calculateTotalTime(sections) {
  if (!sections || !Array.isArray(sections)) return 0
  return sections.reduce((sum, section) => sum + (section.timeLimit || 0), 0)
}

/**
 * Format total time for display
 * @param {number} minutes - Total minutes
 * @returns {string} Formatted string e.g., "1h 30m"
 */
export function formatTotalTime(minutes) {
  if (!minutes) return '0m'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}
```
- Reference pattern from timer formatting in [useTimer.js](src/apBoost/hooks/useTimer.js)

#### Step 2: Use in Dashboard/Test Lists
**File:** `src/apBoost/pages/APDashboard.jsx` (or equivalent test list component)
**Action:** Add import and use
**Details:**
- Import `calculateTotalTime, formatTotalTime` from utility
- Display in test card/list: `{formatTotalTime(calculateTotalTime(test.sections))}`

### Verification Steps
1. View test list - verify total time displays correctly
2. Test with multiple sections - verify sum is correct
3. Test with empty sections array - verify returns 0

### Potential Risks
- None: Pure utility function, no state changes

---

## Issue 3: ap_stimuli Collection Service Missing

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Supports shared stimuli across questions
- **Current State:** Collection constant `STIMULI: 'ap_stimuli'` defined but NO service implements fetching

### Code Analysis
- **Relevant Files:**
  - [apTypes.js](src/apBoost/utils/apTypes.js) (line 93) - `STIMULI: 'ap_stimuli'` defined
  - [apQuestionService.js](src/apBoost/services/apQuestionService.js) (lines 178-179) - `stimulusId` and `stimulus` fields
  - [PassageDisplay.jsx](src/apBoost/components/tools/PassageDisplay.jsx) - Renders stimulus inline
  - [QuestionDisplay.jsx](src/apBoost/components/QuestionDisplay.jsx) (line 19) - Uses `stimulus.imageAlt`
- **Current Implementation:** Questions store inline stimulus objects. `stimulusId` field exists but is never used to fetch.
- **Gap:** Need full CRUD service for ap_stimuli collection and resolution logic in test loading
- **Dependencies:**
  - `getTestWithQuestions()` in [apTestService.js](src/apBoost/services/apTestService.js) (lines 95-124) needs to resolve stimulusIds
  - Teacher question editor needs stimulus picker

### Fix Plan

#### Step 1: Create apStimuliService.js
**File:** `src/apBoost/services/apStimuliService.js`
**Action:** Create new file
**Details:**
- Reference pattern from [apQuestionService.js](src/apBoost/services/apQuestionService.js)
```javascript
/**
 * AP Stimuli Service
 * Handles shared stimulus/passage CRUD operations
 */
import { db } from '../../firebase'
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore'
import { COLLECTIONS, STIMULUS_TYPE } from '../utils/apTypes'
import { logError } from '../utils/logError'

export async function createStimulus(stimulusData) {
  const stimuliRef = collection(db, COLLECTIONS.STIMULI)
  const newStimulus = {
    type: stimulusData.type || STIMULUS_TYPE.PASSAGE,
    title: stimulusData.title || '',  // <-- NEW: title field
    content: stimulusData.content || '',
    source: stimulusData.source || '',
    imageAlt: stimulusData.imageAlt || '',
    tags: stimulusData.tags || [],    // <-- NEW: tags field
    createdBy: stimulusData.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const docRef = await addDoc(stimuliRef, newStimulus)
  return docRef.id
}

export async function getStimulusById(stimulusId) { ... }
export async function getStimuli(filters = {}) { ... }  // For picker
export async function updateStimulus(stimulusId, updates) { ... }
export async function deleteStimulus(stimulusId) { ... }
```

#### Step 2: Add Stimulus Resolution to Test Loading
**File:** `src/apBoost/services/apTestService.js`
**Action:** Modify `getTestWithQuestions()`
**Details:**
- After line 114 where questions are loaded, resolve stimulusIds:
```javascript
// Resolve stimulusIds to full stimulus objects
for (const questionId of Object.keys(questionsMap)) {
  const question = questionsMap[questionId]
  if (question.stimulusId && !question.stimulus) {
    const stimulus = await getStimulusById(question.stimulusId)
    if (stimulus) {
      questionsMap[questionId] = { ...question, stimulus }
    }
  }
}
```
- Import `getStimulusById` from apStimuliService

#### Step 3: Add Stimulus Picker to Question Editor
**File:** `src/apBoost/pages/APQuestionEditor.jsx`
**Action:** Add stimulus selection UI
**Details:**
- Add state for `stimulusId` (line ~104 area)
- Add "Select Shared Stimulus" button/modal
- When shared stimulus selected, clear inline stimulus and set stimulusId
- Pattern: Similar to subject selector (lines 336-345)

### Verification Steps
1. Create shared stimulus via service
2. Create question referencing stimulusId
3. Load test and verify stimulus resolves correctly
4. Verify PassageDisplay renders shared stimulus

### Potential Risks
- Medium: Involves new service file and modification to test loading
- Migration: Existing inline stimuli continue working (no breaking change)
- Performance: Additional Firestore reads for stimulus resolution (can batch later)

---

## Issue 4: Stimulus Missing title Field

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** title and source for reference/citation
- **Current State:** `source` field implemented, `title` field NOT visible in stimulus objects

### Code Analysis
- **Relevant Files:**
  - [seedTestData.js](src/apBoost/utils/seedTestData.js) (lines 123-127) - Stimulus has `source`, no `title`
  - [PassageDisplay.jsx](src/apBoost/components/tools/PassageDisplay.jsx) (lines 53, 86, 104-107) - Only displays `source`
- **Current Implementation:** Stimulus objects have `{ type, content, source }`, missing `title`
- **Gap:** Add `title` field for proper document/passage identification
- **Dependencies:** PassageDisplay rendering

### Fix Plan

#### Step 1: Add title to Stimulus Schema
**File:** `src/apBoost/utils/seedTestData.js`
**Action:** Modify seed data stimulus
**Details:**
- Add `title` field to stimulus object:
```javascript
stimulus: {
  type: 'PASSAGE',
  title: 'Society in America',  // <-- Add this
  content: '"The factory system..."',
  source: 'Harriet Martineau, Society in America, 1837',
}
```

#### Step 2: Display title in PassageDisplay
**File:** `src/apBoost/components/tools/PassageDisplay.jsx`
**Action:** Modify rendering
**Details:**
- Add title display above content (after line 52):
```jsx
const { type, content, source, imageAlt, title } = stimulus
// ... then in render:
{title && (
  <h3 className="text-text-primary font-medium text-lg mb-2">{title}</h3>
)}
```
- Position title before content, source as citation below

### Verification Steps
1. Add title to seed data
2. Load question with stimulus
3. Verify title displays in PassageDisplay

### Potential Risks
- None: Purely additive, backward compatible

---

## Issue 5: Stimulus tags Field Missing

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** tags for filtering/search
- **Current State:** No tags field in stimulus implementations

### Code Analysis
- **Relevant Files:**
  - [apStimuliService.js](src/apBoost/services/apStimuliService.js) - Will be created (Issue 3)
  - [apQuestionService.js](src/apBoost/services/apQuestionService.js) (lines 84-91) - Text search pattern
- **Current Implementation:** Inline stimuli have no tags. No shared stimulus service yet.
- **Gap:** Need tags array for filtering when selecting shared stimuli
- **Dependencies:** Requires ap_stimuli service (Issue 3)

### Fix Plan

#### Step 1: Include tags in apStimuliService (covered in Issue 3)
**Details:** Already included in Issue 3, Step 1

#### Step 2: Add tags Filter to Stimulus Search
**File:** `src/apBoost/services/apStimuliService.js`
**Action:** Add in getStimuli() function
**Details:**
```javascript
export async function getStimuli(filters = {}) {
  let constraints = []

  // Filter by type
  if (filters.type) {
    constraints.push(where('type', '==', filters.type))
  }

  // Filter by tags (array-contains for single tag)
  if (filters.tag) {
    constraints.push(where('tags', 'array-contains', filters.tag))
  }

  // ... rest similar to searchQuestions pattern
}
```

### Verification Steps
1. Create stimulus with tags
2. Search by tag - verify filter works
3. Multiple tags - verify array-contains behavior

### Potential Risks
- None: New functionality, no breaking changes

---

## Issue 6: Questions Missing rubric Field

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** rubric for FRQ/SAQ/DBQ scoring guidelines
- **Current State:** Grep found references in docs but NOT in `createQuestion()`

### Code Analysis
- **Relevant Files:**
  - [apQuestionService.js](src/apBoost/services/apQuestionService.js) (lines 155-196) - createQuestion function
  - [apGradingService.js](src/apBoost/services/apGradingService.js) (lines 108-154) - getResultForGrading fetches questions
  - [APQuestionEditor.jsx](src/apBoost/pages/APQuestionEditor.jsx) (lines 440-460) - FRQ sub-question editing
- **Current Implementation:** Questions have `explanation` field for MCQ rationale. FRQ has `subQuestions` with `maxPoints` per part but no rubric.
- **Gap:** Need `rubric` field (string or structured object) for grading guidelines
- **Dependencies:** Grading UI needs to display rubric

### Fix Plan

#### Step 1: Add rubric Field to createQuestion
**File:** `src/apBoost/services/apQuestionService.js`
**Action:** Modify
**Details:**
- Add after line 181 (explanation field):
```javascript
explanation: questionData.explanation || '',
// Scoring - FRQ/SAQ/DBQ rubric
rubric: questionData.rubric || null,  // Can be string or { [label]: "criteria..." }
```

#### Step 2: Add Rubric Editor to Question Editor
**File:** `src/apBoost/pages/APQuestionEditor.jsx`
**Action:** Modify
**Details:**
- Add state: `const [rubric, setRubric] = useState('')`
- Add rubric textarea in FRQ section (after line 460, after sub-questions):
```jsx
{isFRQ && (
  <div className="bg-surface rounded-[--radius-card] border border-border-default p-4 mb-6">
    <label className="block text-text-secondary text-sm font-medium mb-2">
      Rubric / Scoring Guidelines
    </label>
    <textarea
      value={rubric}
      onChange={(e) => setRubric(e.target.value)}
      placeholder="Enter scoring rubric for graders..."
      rows={5}
      className="w-full px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary resize-none"
    />
  </div>
)}
```
- Include `rubric` in questionData in handleSave (line 252)

#### Step 3: Display Rubric in Grading UI
**File:** `src/apBoost/pages/APGrading.jsx` (or equivalent)
**Action:** Add rubric display
**Details:**
- In grading interface, display `question.rubric` alongside student response
- Pattern: Similar to how `explanation` might be shown

### Verification Steps
1. Create FRQ question with rubric text
2. Verify rubric saves to Firestore
3. Grade submission - verify rubric displays

### Potential Risks
- Low: Additive field, backward compatible
- Consider structured rubric format for per-subquestion guidelines in future

---

## Issue 7: Questions Missing tags Field

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** tags for filtering/search
- **Current State:** Not found in `createQuestion()` function

### Code Analysis
- **Relevant Files:**
  - [apQuestionService.js](src/apBoost/services/apQuestionService.js) (lines 155-196) - createQuestion
  - [apQuestionService.js](src/apBoost/services/apQuestionService.js) (lines 35-91) - searchQuestions (text search, no tags)
- **Current Implementation:** Search uses subject, questionType, difficulty, domain filters. No tags.
- **Gap:** Need `tags` array field for flexible categorization
- **Dependencies:** Question bank filtering, question picker

### Fix Plan

#### Step 1: Add tags Field to createQuestion
**File:** `src/apBoost/services/apQuestionService.js`
**Action:** Modify
**Details:**
- Add after line 187 (updatedAt):
```javascript
updatedAt: serverTimestamp(),
tags: questionData.tags || [],  // Array of string tags
```

#### Step 2: Add tags Filter to searchQuestions
**File:** `src/apBoost/services/apQuestionService.js`
**Action:** Modify searchQuestions function
**Details:**
- Add after line 62 (createdBy filter):
```javascript
// Filter by tag
if (filters.tag) {
  constraints.push(where('tags', 'array-contains', filters.tag))
}
```

#### Step 3: Add Tags Input to Question Editor
**File:** `src/apBoost/pages/APQuestionEditor.jsx`
**Action:** Add tags editor
**Details:**
- Add state: `const [tags, setTags] = useState([])`
- Add simple tag input (comma-separated) near metadata section:
```jsx
<div>
  <label className="block text-text-muted text-xs mb-1">Tags</label>
  <input
    type="text"
    value={tags.join(', ')}
    onChange={(e) => setTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
    placeholder="tag1, tag2, tag3"
    className="w-full px-2 py-1.5 text-sm rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
  />
</div>
```

### Verification Steps
1. Create question with tags
2. Search by tag - verify filter works
3. Verify tags display/edit in editor

### Potential Risks
- None: Additive field

---

## Issue 8: Session Status Uses IN_PROGRESS Instead of ACTIVE

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** status: ACTIVE, PAUSED, COMPLETED
- **Current State:** Uses `IN_PROGRESS` instead of `ACTIVE`

### Code Analysis
- **Relevant Files:**
  - [apTypes.js](src/apBoost/utils/apTypes.js) (lines 34-39) - SESSION_STATUS enum
  - [apSessionService.js](src/apBoost/services/apSessionService.js) (lines 54, 90, 225) - Uses IN_PROGRESS
  - [useTestSession.js](src/apBoost/hooks/useTestSession.js) (line 17, 446) - Imports and uses SESSION_STATUS
- **Current Implementation:** `SESSION_STATUS = { NOT_STARTED, IN_PROGRESS, PAUSED, COMPLETED }`
- **Gap:** Acceptance criteria specifies `ACTIVE` instead of `IN_PROGRESS`
- **Dependencies:** All session-related queries and status checks

### Fix Plan

**Recommendation:** Keep `IN_PROGRESS` - it's more descriptive and already consistently implemented throughout the codebase. Update acceptance criteria document instead.

**Alternative (if must match criteria exactly):**

#### Step 1: Add ACTIVE as Alias
**File:** `src/apBoost/utils/apTypes.js`
**Action:** Modify
**Details:**
```javascript
export const SESSION_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  ACTIVE: 'IN_PROGRESS',  // Alias for acceptance criteria compatibility
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
}
```

### Verification Steps
1. If aliased: Verify ACTIVE and IN_PROGRESS resolve to same value
2. All session queries continue to work

### Potential Risks
- High if renaming: Would require migrating existing Firestore documents
- Low if aliasing: No data migration needed

---

## Issue 9: Answers Stored as Simple Values Instead of Objects

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** answers object with value and markedForReview per question
- **Current State:** Answers stored as simple values, flags stored separately in `flaggedQuestions` array

### Code Analysis
- **Relevant Files:**
  - [apSessionService.js](src/apBoost/services/apSessionService.js) (lines 59-60) - `answers: {}`, `flaggedQuestions: []`
  - [apSessionService.js](src/apBoost/services/apSessionService.js) (lines 131-141) - saveAnswer stores simple value
  - [useTestSession.js](src/apBoost/hooks/useTestSession.js) (lines 39-43) - Local answers as Map, flags as Set
- **Current Implementation:**
  - MCQ: `answers[questionId] = 'A'`
  - FRQ: `answers[questionId] = { a: '...', b: '...' }`
  - Flags: `flaggedQuestions = ['q1', 'q3']`
- **Gap:** Criteria expects `answers[questionId] = { value: 'A', markedForReview: true }`
- **Dependencies:** All answer reading/writing code

### Fix Plan

**Recommendation:** Keep current structure - it's cleaner and working. Separate concerns:
- `answers` for answer values (simple or FRQ object)
- `flaggedQuestions` for review flags (array)

This separation is actually better for:
1. Atomic updates (flag toggle doesn't touch answers)
2. Efficient querying (array-contains for finding flagged items)
3. Clean data model

**If must change to match criteria:**

#### Step 1: Update saveAnswer to Store Object
**File:** `src/apBoost/services/apSessionService.js`
**Action:** Modify
**Details:**
- Change `saveAnswer()` (lines 131-141):
```javascript
export async function saveAnswer(sessionId, questionId, value, markedForReview = false) {
  await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
    [`answers.${questionId}`]: { value, markedForReview },
    lastAction: serverTimestamp(),
  })
}
```

#### Step 2: Update All Answer Reading Code
**File:** Multiple files
**Details:**
- In useTestSession.js, update answer access: `answers.get(questionId)?.value`
- In apScoringService.js, update: `answers[questionId]?.value`
- In result creation, update answer handling

### Verification Steps
1. Answer question - verify stored as `{ value, markedForReview }`
2. Toggle flag - verify markedForReview updates
3. Score calculation - verify extracts value correctly

### Potential Risks
- **High risk for modification:** Many code paths read answers
- Data migration needed for existing sessions
- **Recommendation:** Keep current structure, document deviation from criteria

---

## Issue 10: stimulusId Lookup Not Implemented

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Can use stimulusId (shared) or inline stimulus object
- **Current State:** Both fields exist, but stimulusId lookup not implemented

### Code Analysis
- Covered in Issue 3 (ap_stimuli service)

### Fix Plan
See Issue 3, Step 2 - Stimulus resolution in `getTestWithQuestions()`

---

## Issue 11: Unable to Verify Status Constant Alignment

### Audit Finding
- **Status:** ❓ Unable to Verify (per summary count)
- Related to Issue 8 - SESSION_STATUS naming

### Fix Plan
See Issue 8 recommendation

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 2: totalTime Calculation Helper** - Foundational utility, no dependencies, quick win
2. **Issue 4: Stimulus title Field** - Simple additive change, no dependencies
3. **Issue 7: Questions tags Field** - Simple additive change, enables filtering
4. **Issue 6: Questions rubric Field** - Simple additive change, important for FRQ grading
5. **Issue 1: frqMultipliers** - Medium complexity, needed for accurate FRQ scoring
6. **Issue 3: ap_stimuli Service** - Creates new service file, enables Issues 5 & 10
7. **Issue 5: Stimulus tags Field** - Depends on Issue 3
8. **Issue 10: stimulusId Lookup** - Depends on Issue 3
9. **Issue 8: IN_PROGRESS vs ACTIVE** - Recommend documenting deviation, low priority
10. **Issue 9: Answer Object Structure** - Recommend keeping current structure, high risk to change

---

## Cross-Cutting Concerns

### Utility Pattern
Create shared utility file if it doesn't exist: `src/apBoost/utils/testHelpers.js`
- `calculateTotalTime(sections)`
- `formatTotalTime(minutes)`
- Could also add `calculateMaxFRQPoints(sections, questions)` for score displays

### Service Pattern Reference
All new services should follow the established pattern in `apQuestionService.js`:
- Import from firebase/firestore
- Import COLLECTIONS from apTypes
- Use logError for error handling
- Export named functions
- Use serverTimestamp() for dates

### Backward Compatibility
All fixes are additive - existing data will continue to work:
- New fields default to null/empty
- Missing multipliers default to 1.0
- Missing tags default to empty array

---

## Notes for Implementer

1. **Test with existing data first** - Ensure no regressions before adding new fields
2. **Firestore indexes** - If adding tag filtering, check if composite index needed
3. **FRQ scoring changes** - After implementing frqMultipliers, manually test scoring calculation
4. **Stimulus service** - Consider caching stimulus lookups to avoid repeated reads
5. **Issue 9 (answer structure)** - Strongly recommend NOT changing - current structure is cleaner and functional. Document as intentional deviation from acceptance criteria.
6. **Issue 8 (IN_PROGRESS)** - Also recommend keeping current naming - it's more descriptive than "ACTIVE"

---

## Quality Checklist
- [x] Every ⚠️/❌/❓ issue from the audit has a fix plan
- [x] Each fix plan includes specific file paths and line numbers
- [x] Each fix plan references existing code patterns to follow
- [x] Dependencies between fixes are identified
- [x] Implementation order is logical
- [x] Verification steps are actionable
- [x] Potential risks are documented
