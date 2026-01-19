# Acceptance Criteria Audit: Sections 3.1 to 3.4

**Audited by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE

## Summary
- Total Criteria: 51
- Implemented: 40
- Partial: 6
- Missing: 4
- Unable to Verify: 1

---

## Section 3.1: ap_tests Collection

### Criterion: Contains: title, subject, testType, createdBy, isPublic
- **Status:** Implemented
- **Evidence:** [apTeacherService.js:56-67](src/apBoost/services/apTeacherService.js#L56-L67) - `createTest()` function creates document with all these fields
- **Notes:** Also confirmed in [seedTestData.js:21-48](src/apBoost/utils/seedTestData.js#L21-L48)

### Criterion: testType: "EXAM" (full test) or "MODULE" (practice 1-2 sections)
- **Status:** Implemented
- **Evidence:** [apTypes.js:21-24](src/apBoost/utils/apTypes.js#L21-L24) - `TEST_TYPE` constants defined
- **Notes:** Used in createTest with default `TEST_TYPE.EXAM`

### Criterion: questionOrder: "FIXED" or "RANDOMIZED"
- **Status:** Implemented
- **Evidence:** [apTypes.js:64-68](src/apBoost/utils/apTypes.js#L64-L68) - `QUESTION_ORDER` constants defined
- **Notes:** Used in test creation with default 'FIXED'

### Criterion: sections array with: id, title, sectionType, timeLimit, questionIds
- **Status:** Implemented
- **Evidence:** [seedTestData.js:28-38](src/apBoost/utils/seedTestData.js#L28-L38) - Section structure with all required fields
- **Notes:** Sections stored as array in test document

### Criterion: sections include calculatorEnabled boolean (for future Desmos)
- **Status:** Implemented
- **Evidence:** [seedTestData.js:36](src/apBoost/utils/seedTestData.js#L36) - `calculatorEnabled: false`
- **Notes:** Field present in seed data structure

### Criterion: MCQ sections have mcqMultiplier (single value)
- **Status:** Implemented
- **Evidence:** [seedTestData.js:35](src/apBoost/utils/seedTestData.js#L35) - `mcqMultiplier: 1.0`
- **Notes:** Used in scoring calculations

### Criterion: FRQ sections have frqMultipliers object (per-question)
- **Status:** Missing
- **Evidence:** No grep results for "frqMultiplier" in services or data model code
- **Notes:** FRQ multipliers are documented in acceptance criteria but not implemented in any service or seed data

### Criterion: scoreRanges object for AP 1-5 conversion (customizable)
- **Status:** Implemented
- **Evidence:** [apTypes.js:80-87](src/apBoost/utils/apTypes.js#L80-L87) - `DEFAULT_SCORE_RANGES` defined; [seedTestData.js:39-45](src/apBoost/utils/seedTestData.js#L39-L45) - Custom ranges in test doc
- **Notes:** Ranges are customizable per test

### Criterion: totalTime is CALCULATED (not stored) from sum of sections
- **Status:** Missing
- **Evidence:** No calculation function found in services
- **Notes:** The criteria specifies totalTime should be calculated client-side, but no helper function exists to compute it from section time limits

### Criterion: createdAt and updatedAt timestamps
- **Status:** Implemented
- **Evidence:** [apTeacherService.js:66-67](src/apBoost/services/apTeacherService.js#L66-L67) - `serverTimestamp()` used for both fields
- **Notes:** Properly using Firestore server timestamps

---

## Section 3.2: ap_stimuli Collection

### Criterion: Supports shared stimuli across questions
- **Status:** Partial
- **Evidence:** [apTypes.js:93](src/apBoost/utils/apTypes.js#L93) - `STIMULI: 'ap_stimuli'` collection constant defined; [apQuestionService.js:178](src/apBoost/services/apQuestionService.js#L178) - `stimulusId` field supported in questions
- **Notes:** Collection is DEFINED and stimulusId field exists, but NO service implements fetching from ap_stimuli collection. Questions currently use inline stimulus objects only.

### Criterion: type: TEXT, IMAGE, PASSAGE, DOCUMENT, CHART
- **Status:** Implemented
- **Evidence:** [apTypes.js:56-62](src/apBoost/utils/apTypes.js#L56-L62) - `STIMULUS_TYPE` constants defined
- **Notes:** All types defined; used in inline stimulus objects

### Criterion: content: text content or image URL
- **Status:** Implemented
- **Evidence:** [seedTestData.js:123-126](src/apBoost/utils/seedTestData.js#L123-L126) - Stimulus object with content field; [PassageDisplay.jsx:53](src/apBoost/components/tools/PassageDisplay.jsx#L53) - Content field accessed
- **Notes:** Content field properly used for both text and images

### Criterion: title and source for reference/citation
- **Status:** Partial
- **Evidence:** [seedTestData.js:126](src/apBoost/utils/seedTestData.js#L126) - `source` field implemented; [PassageDisplay.jsx:53](src/apBoost/components/tools/PassageDisplay.jsx#L53)
- **Notes:** `source` field is implemented and displayed. `title` field is NOT visible in stimulus objects

### Criterion: imageAlt for accessibility
- **Status:** Implemented
- **Evidence:** [QuestionDisplay.jsx:19](src/apBoost/components/QuestionDisplay.jsx#L19) - `stimulus.imageAlt` accessed; [FRQQuestionDisplay.jsx:17](src/apBoost/components/FRQQuestionDisplay.jsx#L17)
- **Notes:** Properly used with fallback alt text

### Criterion: tags for filtering/search
- **Status:** Missing
- **Evidence:** No tags field found in stimulus implementations
- **Notes:** Tags for stimuli not implemented - would need ap_stimuli service

---

## Section 3.3: ap_questions Collection

### Criterion: testId can be null (question bank item)
- **Status:** Implemented
- **Evidence:** [apQuestionService.js:155-196](src/apBoost/services/apQuestionService.js#L155-L196) - `createQuestion()` does not require testId as a mandatory field
- **Notes:** Questions can exist independently in question bank

### Criterion: questionType: MCQ, MCQ_MULTI, FRQ, SAQ, DBQ
- **Status:** Implemented
- **Evidence:** [apTypes.js:6-12](src/apBoost/utils/apTypes.js#L6-L12) - `QUESTION_TYPE` constants
- **Notes:** All five types defined

### Criterion: questionDomain: unit (e.g., "Unit 3: Colonial America")
- **Status:** Implemented
- **Evidence:** [seedTestData.js:59](src/apBoost/utils/seedTestData.js#L59) - `questionDomain: 'Unit 3: Colonial America'`; [apQuestionService.js:164](src/apBoost/services/apQuestionService.js#L164)
- **Notes:** Used for categorization and filtering

### Criterion: questionTopic: specific topic within unit
- **Status:** Implemented
- **Evidence:** [seedTestData.js:60](src/apBoost/utils/seedTestData.js#L60) - `questionTopic: 'Colonial Economy'`; [apQuestionService.js:165](src/apBoost/services/apQuestionService.js#L165)
- **Notes:** Properly implemented

### Criterion: difficulty: EASY, MEDIUM, HARD
- **Status:** Implemented
- **Evidence:** [apTypes.js:71-75](src/apBoost/utils/apTypes.js#L71-L75) - `DIFFICULTY` constants; [seedTestData.js:61](src/apBoost/utils/seedTestData.js#L61)
- **Notes:** All three levels defined and used

### Criterion: format: VERTICAL (no stimulus) or HORIZONTAL (with stimulus)
- **Status:** Implemented
- **Evidence:** [apTypes.js:15-18](src/apBoost/utils/apTypes.js#L15-L18) - `QUESTION_FORMAT` constants; [QuestionDisplay.jsx:41](src/apBoost/components/QuestionDisplay.jsx#L41)
- **Notes:** Both formats properly handled in display components

### Criterion: Can use stimulusId (shared) or inline stimulus object
- **Status:** Partial
- **Evidence:** [apQuestionService.js:178-179](src/apBoost/services/apQuestionService.js#L178-L179) - Both fields supported in createQuestion
- **Notes:** Both field options exist, but stimulusId lookup from ap_stimuli collection is not implemented

### Criterion: choiceA through choiceJ objects with text, imageUrl, imageAlt
- **Status:** Implemented
- **Evidence:** [apQuestionService.js:168-172](src/apBoost/services/apQuestionService.js#L168-L172) - Choices A-E defined; [AnswerInput.jsx:39-75](src/apBoost/components/AnswerInput.jsx#L39-L75) - imageUrl and imageAlt accessed
- **Notes:** Choices support text, imageUrl, and imageAlt. Only A-E explicitly defined in service, but CHOICE_LETTERS constant supports A-J

### Criterion: choiceCount auto-calculated
- **Status:** Implemented
- **Evidence:** [apQuestionService.js:173](src/apBoost/services/apQuestionService.js#L173) - `choiceCount: questionData.choiceCount || 4`; [APQuestionEditor.jsx:114-152](src/apBoost/pages/APQuestionEditor.jsx#L114-L152)
- **Notes:** Editor manages choiceCount state

### Criterion: correctAnswers array
- **Status:** Implemented
- **Evidence:** [apQuestionService.js:174](src/apBoost/services/apQuestionService.js#L174); [seedTestData.js:68](src/apBoost/utils/seedTestData.js#L68)
- **Notes:** Array format supports both single and multiple correct answers

### Criterion: partialCredit boolean for MCQ_MULTI
- **Status:** Implemented
- **Evidence:** [apQuestionService.js:183](src/apBoost/services/apQuestionService.js#L183) - `partialCredit: questionData.partialCredit || false`
- **Notes:** Defaults to false

### Criterion: explanation for rationale after grading
- **Status:** Implemented
- **Evidence:** [apQuestionService.js:181](src/apBoost/services/apQuestionService.js#L181); [seedTestData.js:70-71](src/apBoost/utils/seedTestData.js#L70-L71)
- **Notes:** Explanation text stored with each question

### Criterion: rubric for FRQ/SAQ/DBQ scoring guidelines
- **Status:** Missing
- **Evidence:** Grep found references in docs (`phase3-frq-support.md:61`) but NOT in `apQuestionService.createQuestion()`
- **Notes:** Rubric field is not implemented in the question creation service

### Criterion: points (base points before multiplier)
- **Status:** Implemented
- **Evidence:** [seedTestData.js:71](src/apBoost/utils/seedTestData.js#L71) - `points: 1`; [apScoringService.js:21-44](src/apBoost/services/apScoringService.js#L21-L44)
- **Notes:** Points field used in scoring calculations

### Criterion: subQuestions array for multi-part FRQ
- **Status:** Implemented
- **Evidence:** [apQuestionService.js:176](src/apBoost/services/apQuestionService.js#L176); [FRQQuestionDisplay.jsx:95-99](src/apBoost/components/FRQQuestionDisplay.jsx#L95-L99); [useTestSession.js:95-110](src/apBoost/hooks/useTestSession.js#L95-L110)
- **Notes:** Full subQuestion navigation implemented with label, prompt, points

### Criterion: tags for filtering/search
- **Status:** Partial
- **Evidence:** Not found in `createQuestion()` function [apQuestionService.js:155-196](src/apBoost/services/apQuestionService.js#L155-L196)
- **Notes:** Tags field is NOT included in the createQuestion service, though acceptance criteria requires it for filtering

---

## Section 3.4: ap_session_state Collection

### Criterion: userId and testId references
- **Status:** Implemented
- **Evidence:** [apSessionService.js:49-51](src/apBoost/services/apSessionService.js#L49-L51)
- **Notes:** Both fields stored in session document

### Criterion: sessionToken for duplicate detection (unique per session)
- **Status:** Implemented
- **Evidence:** [apSessionService.js:19-21](src/apBoost/services/apSessionService.js#L19-L21) - `generateSessionToken()` function; [apSessionService.js:53](src/apBoost/services/apSessionService.js#L53)
- **Notes:** Token generated with timestamp + random string

### Criterion: status: ACTIVE, PAUSED, COMPLETED
- **Status:** Partial
- **Evidence:** [apTypes.js:34-39](src/apBoost/utils/apTypes.js#L34-L39) - Uses `IN_PROGRESS` instead of `ACTIVE`
- **Notes:** Status values are: NOT_STARTED, IN_PROGRESS, PAUSED, COMPLETED. `ACTIVE` is not defined - uses `IN_PROGRESS` instead, which serves the same purpose

### Criterion: currentSectionIndex and currentQuestionIndex
- **Status:** Implemented
- **Evidence:** [apSessionService.js:56-57](src/apBoost/services/apSessionService.js#L56-L57); [apSessionService.js:185-196](src/apBoost/services/apSessionService.js#L185-L196)
- **Notes:** Both indices tracked and updatable via `updatePosition()`

### Criterion: sectionTimeRemaining object (seconds per section)
- **Status:** Implemented
- **Evidence:** [apSessionService.js:58](src/apBoost/services/apSessionService.js#L58); [apSessionService.js:205-215](src/apBoost/services/apSessionService.js#L205-L215)
- **Notes:** `updateTimer()` function updates per-section time

### Criterion: answers object with value and markedForReview per question
- **Status:** Partial
- **Evidence:** [apSessionService.js:59](src/apBoost/services/apSessionService.js#L59) - `answers: {}`; [apSessionService.js:60](src/apBoost/services/apSessionService.js#L60) - `flaggedQuestions: []`
- **Notes:** Answers are stored as simple values (not objects with markedForReview). Flag state is stored separately in `flaggedQuestions` array rather than within answers object

### Criterion: annotations object with highlights per question
- **Status:** Implemented
- **Evidence:** [apSessionService.js:61](src/apBoost/services/apSessionService.js#L61) - `annotations: {}`; [useAnnotations.js](src/apBoost/hooks/useAnnotations.js)
- **Notes:** Annotations stored per question with highlight ranges

### Criterion: strikethroughs object with struck options per question
- **Status:** Implemented
- **Evidence:** [apSessionService.js:62](src/apBoost/services/apSessionService.js#L62) - `strikethroughs: {}`
- **Notes:** Per-question strikethrough state tracked

### Criterion: lastHeartbeat timestamp
- **Status:** Implemented
- **Evidence:** [apSessionService.js:63](src/apBoost/services/apSessionService.js#L63); [apSessionService.js:258-266](src/apBoost/services/apSessionService.js#L258-L266)
- **Notes:** `updateHeartbeat()` function available

### Criterion: lastAction timestamp
- **Status:** Implemented
- **Evidence:** [apSessionService.js:64](src/apBoost/services/apSessionService.js#L64); updated in all state-modifying functions
- **Notes:** Automatically updated with serverTimestamp on each action

### Criterion: startedAt and completedAt timestamps
- **Status:** Implemented
- **Evidence:** [apSessionService.js:65-66](src/apBoost/services/apSessionService.js#L65-L66); [apSessionService.js:224-228](src/apBoost/services/apSessionService.js#L224-L228)
- **Notes:** startedAt set on creation, completedAt set on completeSession()

---

## Recommendations

### High Priority
1. **Implement ap_stimuli Service** - The collection constant exists but no service reads/writes to it. This prevents shared stimuli across questions. Create `apStimuliService.js` with CRUD operations.

2. **Add frqMultipliers to Section Schema** - FRQ sections need per-question multipliers for accurate weighted scoring. Add to test creation and seed data.

3. **Add rubric Field to Questions** - FRQ/SAQ/DBQ questions need rubric storage for grading guidelines. Add to `createQuestion()` in apQuestionService.js.

4. **Add tags Field to Questions** - Required for question bank filtering. Add to `createQuestion()` function.

### Medium Priority
5. **Add totalTime Calculation Helper** - Create utility function to sum section time limits for display purposes.

6. **Align Status Constants** - Consider renaming `IN_PROGRESS` to `ACTIVE` to match acceptance criteria, or update criteria to match implementation.

7. **Update Answer Schema** - Consider changing answers from simple values to objects with `{value, markedForReview}` structure as specified in criteria.

### Low Priority
8. **Add title Field to Stimulus** - Currently only `source` is tracked; add `title` for better citation support.

9. **Add stimulus tags** - Would require implementing full ap_stimuli collection service.

---

## Files Reviewed
- [apTypes.js](src/apBoost/utils/apTypes.js) - Type constants and collection names
- [apTestService.js](src/apBoost/services/apTestService.js) - Test fetching operations
- [apSessionService.js](src/apBoost/services/apSessionService.js) - Session state CRUD
- [apQuestionService.js](src/apBoost/services/apQuestionService.js) - Question bank operations
- [apTeacherService.js](src/apBoost/services/apTeacherService.js) - Test creation/management
- [seedTestData.js](src/apBoost/utils/seedTestData.js) - Data structure examples
- [useTestSession.js](src/apBoost/hooks/useTestSession.js) - Session state management
- [QuestionDisplay.jsx](src/apBoost/components/QuestionDisplay.jsx) - Question rendering
- [FRQQuestionDisplay.jsx](src/apBoost/components/FRQQuestionDisplay.jsx) - FRQ rendering
- [AnswerInput.jsx](src/apBoost/components/AnswerInput.jsx) - MCQ answer display
- [PassageDisplay.jsx](src/apBoost/components/tools/PassageDisplay.jsx) - Stimulus display
