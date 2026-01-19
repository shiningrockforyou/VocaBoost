# Codebase Facts Report: MCQ_MULTI Runtime UI + Scoring (Sections 2.1–2.3)

**Generated:** 2026-01-14
**Chunk ID:** UNK__2.1_to_2.3
**Purpose:** Ground-truth facts for validating/refining fix plan scope

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### QUESTION_TYPE Definition

- **Location:** `src/apBoost/utils/apTypes.js:6-12`
- **MCQ_MULTI Token:** `'MCQ_MULTI'` (string value)
- **All Question Types:**
  - `MCQ: 'MCQ'`
  - `MCQ_MULTI: 'MCQ_MULTI'`
  - `FRQ: 'FRQ'`
  - `SAQ: 'SAQ'`
  - `DBQ: 'DBQ'`

**Evidence:**
```javascript
// src/apBoost/utils/apTypes.js:6-12
export const QUESTION_TYPE = {
  MCQ: 'MCQ',
  MCQ_MULTI: 'MCQ_MULTI',
  FRQ: 'FRQ',
  SAQ: 'SAQ',
  DBQ: 'DBQ',
}
```

### Question Object Schema (Creation)

- **Location:** `src/apBoost/services/apQuestionService.js:155-188`
- **`questionType`:** Defaults to `QUESTION_TYPE.MCQ` (line 161)
- **`correctAnswers`:** Always stored as array, defaults to `[]` (line 174)
- **`partialCredit`:** Boolean, defaults to `false` (line 183)

**Evidence:**
```javascript
// src/apBoost/services/apQuestionService.js:174,183
correctAnswers: questionData.correctAnswers || [],
partialCredit: questionData.partialCredit || false,
```

### MCQ_MULTI Creation in Editor

- **Location:** `src/apBoost/pages/APQuestionEditor.jsx:240-248`
- **`partialCredit`:** Set to `true` automatically for MCQ_MULTI (line 248)
- **`correctAnswers`:** Stored as array from state (line 247)

**Evidence:**
```javascript
// src/apBoost/pages/APQuestionEditor.jsx:247-248
questionData.correctAnswers = correctAnswers
questionData.partialCredit = questionType === QUESTION_TYPE.MCQ_MULTI
```

### Answer Storage Schema in Session State

- **Location:** `src/apBoost/hooks/useTestSession.js:39-40`
- **Data Structure:** React `Map` keyed by `questionId`
- **MCQ Answer Shape:** Single string value (e.g., `"A"`)
- **FRQ Answer Shape:** Object `{ subLabel: "answer text" }` when sub-questions exist (lines 337-342)

**Evidence:**
```javascript
// src/apBoost/hooks/useTestSession.js:39-40
// Answers state (Map for fast lookup)
const [answers, setAnswers] = useState(new Map())

// src/apBoost/hooks/useTestSession.js:343-344 (MCQ path)
} else {
  next.set(questionId, answer)  // Direct value assignment - string for MCQ
}
```

**KEY FACT:** No differentiation between MCQ and MCQ_MULTI in answer storage. Both use direct value assignment at line 344. There is NO array handling for MCQ_MULTI answers.

### Scoring Return Shapes

- **Location:** `src/apBoost/services/apScoringService.js:23-45`
- **Return Shape:** `{ correct: number, total: number, points: number }`
- **Multiplier:** Applied via `section.mcqMultiplier || 1` (line 41-42)

---

## 2) Write Paths

**Found: Yes**

### UI Event → State Update Flow

1. **AnswerInput click** → `onSelect(letter)` callback
   - **Location:** `src/apBoost/components/AnswerInput.jsx:45`
   - **Evidence:** `onClick={() => !disabled && onSelect(letter)}`

2. **APTestSession passes** → `setAnswer` from `useTestSession`
   - **Location:** `src/apBoost/pages/APTestSession.jsx:449-451`
   - **Evidence:** `selectedAnswer={currentAnswer}` and `onSelect={setAnswer}`

3. **useTestSession.setAnswer** → Updates local Map + queues for sync
   - **Location:** `src/apBoost/hooks/useTestSession.js:328-358`

**Evidence:**
```javascript
// src/apBoost/hooks/useTestSession.js:328-358
const setAnswer = useCallback((answer) => {
  const questionId = position.questionId
  if (!questionId || !session?.id) return

  // Update local state immediately (optimistic)
  setAnswers(prev => {
    const next = new Map(prev)
    // For FRQ with sub-questions, store as object
    if (isFRQQuestion && position.subQuestionLabel) {
      const existing = next.get(questionId) || {}
      next.set(questionId, {
        ...existing,
        [position.subQuestionLabel]: answer
      })
    } else {
      next.set(questionId, answer)  // ← MCQ path: direct value
    }
    return next
  })

  // Queue for sync
  addToQueue({
    action: 'ANSWER_CHANGE',
    payload: {
      questionId,
      value: answer,  // ← Value passed directly (string or any type)
      subQuestionLabel: position.subQuestionLabel // null for MCQ
    }
  })
}, [...])
```

### Queue → Firestore Write Path

- **Location:** `src/apBoost/hooks/useOfflineQueue.js:201-235`
- **Firestore Field Path:** `answers.${questionId}`
- **Write Method:** `updateDoc` with dot notation field path

**Evidence:**
```javascript
// src/apBoost/hooks/useOfflineQueue.js:203-207
case 'ANSWER_CHANGE':
  updates[`answers.${item.payload.questionId}`] = item.payload.value
  break
```

**KEY FACT:** The queue writes `item.payload.value` directly to Firestore. This value can be ANY type (string, array, object) — Firestore accepts arrays natively. The write path DOES support array values end-to-end.

### Direct Session Service (Fallback)

- **Location:** `src/apBoost/services/apSessionService.js:131-141`
- **Field Path:** `answers.${questionId}`
- **Function Signature:** `saveAnswer(sessionId, questionId, answer)`

**Evidence:**
```javascript
// src/apBoost/services/apSessionService.js:131-135
export async function saveAnswer(sessionId, questionId, answer) {
  try {
    await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
      [`answers.${questionId}`]: answer,  // ← Answer value passed directly
      lastAction: serverTimestamp(),
    })
```

**KEY FACT:** No type coercion or schema validation on `answer` parameter. Arrays would be accepted.

### Array Support Analysis

- **No JSON serialization** found in write paths
- **No schema validation** that enforces string type
- **Firestore natively supports** array field values

**CONCLUSION:** Write paths support arrays end-to-end. The blocker is the UI layer (AnswerInput only produces string values).

---

## 3) Offline/Resilience Mechanics

**Found: Yes** — Relevant to answer writes

### Queue Item Shape

- **Location:** `src/apBoost/hooks/useOfflineQueue.js:131-138`

**Evidence:**
```javascript
// src/apBoost/hooks/useOfflineQueue.js:131-138
const queueItem = {
  id: generateId(),
  sessionId,
  localTimestamp: Date.now(),
  action: action.action,       // 'ANSWER_CHANGE'
  payload: action.payload,     // { questionId, value, subQuestionLabel }
  status: 'PENDING',
}
```

### Flush/Reconciliation Logic

- **Location:** `src/apBoost/hooks/useOfflineQueue.js:203-207`
- **Action Type:** `'ANSWER_CHANGE'`
- **Behavior:** Directly assigns `payload.value` to Firestore field

**KEY FACT:** No type-checking or transformation in reconciliation. If `payload.value` is an array, it will be written as-is.

### Retry/Idempotency

- **Location:** `src/apBoost/hooks/useOfflineQueue.js:257-262`
- **Behavior:** Exponential backoff retry (2s, 4s, 8s, 16s)
- **Risk:** None for arrays — each write is a full replacement, not a merge

**Evidence:**
```javascript
// src/apBoost/hooks/useOfflineQueue.js:206
updates[`answers.${item.payload.questionId}`] = item.payload.value
```

This is a direct field set, not `arrayUnion` or similar. No merge/duplicate risk.

---

## 4) UI/Flow Entry Points

**Found: Yes**

### QuestionDisplay Rendering

- **Location:** `src/apBoost/pages/APTestSession.jsx:416-456`
- **Props Received:**
  - `question` (full question object including `questionType`)
  - `questionNumber`
  - `format` (VERTICAL/HORIZONTAL)
  - `subQuestionLabel` (for FRQ)

**Evidence:**
```javascript
// src/apBoost/pages/APTestSession.jsx:416-421
<QuestionDisplay
  question={currentQuestion}
  questionNumber={position.questionIndex + 1}
  stimulus={currentQuestion?.stimulus}
  format={format}
  subQuestionLabel={subQuestionLabel}
```

### QuestionDisplay Implementation

- **Location:** `src/apBoost/components/QuestionDisplay.jsx:48-164`
- **`questionType` Access:** Via `question.questionType` (line 77-78)
- **MCQ_MULTI Hint:** **NOT FOUND** — No "Select all that apply" text exists

**Evidence of Absence:**
```javascript
// src/apBoost/components/QuestionDisplay.jsx:155-158
// Question text rendering - NO questionType check
<p className="text-text-primary mb-6 whitespace-pre-wrap">
  {question.questionText}
</p>
```

The component imports `QUESTION_TYPE` but only uses it for FRQ type detection (line 77):
```javascript
const frqTypes = [QUESTION_TYPE.FRQ, QUESTION_TYPE.SAQ, QUESTION_TYPE.DBQ]
if (frqTypes.includes(question.questionType)) { ... }
```

### AnswerInput Rendering

- **Location:** `src/apBoost/pages/APTestSession.jsx:447-455`
- **Props Passed:**
  - `question` (full question object)
  - `selectedAnswer` → `currentAnswer` (single value)
  - `onSelect` → `setAnswer` (callback)
  - `strikethroughs` (Set)
  - `onStrikethrough` (callback)

**Evidence:**
```javascript
// src/apBoost/pages/APTestSession.jsx:447-455
<AnswerInput
  question={currentQuestion}
  selectedAnswer={currentAnswer}
  onSelect={setAnswer}
  disabled={isSubmitting || isInvalidated}
  strikethroughs={currentStrikethroughs}
  onStrikethrough={handleStrikethrough}
/>
```

**KEY FACT:** No `questionType` prop passed to AnswerInput. The component has no way to differentiate MCQ from MCQ_MULTI.

### AnswerInput Implementation

- **Location:** `src/apBoost/components/AnswerInput.jsx:17-107`
- **Selected Check:** `selectedAnswer === letter` (line 36) — STRING equality
- **Click Handler:** `onSelect(letter)` — passes single letter (line 45)
- **No `questionType` prop** in function signature (line 17-24)

**Evidence:**
```javascript
// src/apBoost/components/AnswerInput.jsx:17-24
export default function AnswerInput({
  question,
  selectedAnswer,
  onSelect,
  disabled = false,
  strikethroughs = new Set(),
  onStrikethrough,
}) {
```

```javascript
// src/apBoost/components/AnswerInput.jsx:36
const isSelected = selectedAnswer === letter  // ← String comparison only
```

```javascript
// src/apBoost/components/AnswerInput.jsx:45
onClick={() => !disabled && onSelect(letter)}  // ← Passes single letter string
```

### Multi-Select UI Affordances

**NOT FOUND** — Evidence of absence:

1. No checkbox visual in AnswerInput (only radio-style selection indicator)
2. No array comparison in `isSelected` logic
3. No toggle behavior (clicking always replaces, never toggles)
4. No `questionType` prop to trigger different behavior

---

## 5) Must-Answer Questions

### Q1: Where is `QUESTION_TYPE.MCQ_MULTI` defined, and what are all question types?

**ANSWER:**
- **Location:** `src/apBoost/utils/apTypes.js:6-12`
- **All Types:** MCQ, MCQ_MULTI, FRQ, SAQ, DBQ

**Evidence:**
```javascript
export const QUESTION_TYPE = {
  MCQ: 'MCQ',
  MCQ_MULTI: 'MCQ_MULTI',
  FRQ: 'FRQ',
  SAQ: 'SAQ',
  DBQ: 'DBQ',
}
```

---

### Q2: What is the exact shape of `currentAnswer` for MCQ questions today?

**ANSWER:** String (single letter like `"A"`, `"B"`, etc.) or `null`

**Location:** `src/apBoost/hooks/useTestSession.js:311-325`

**Evidence:**
```javascript
// src/apBoost/hooks/useTestSession.js:311-325
const currentAnswer = useMemo(() => {
  const questionId = position.questionId
  if (!questionId) return null

  const answer = answers.get(questionId)
  if (!answer) return null

  // For FRQ with sub-questions, answer is an object { a: "...", b: "...", c: "..." }
  if (isFRQQuestion && position.subQuestionLabel && typeof answer === 'object') {
    return answer[position.subQuestionLabel] || null
  }

  return answer  // ← MCQ: returns stored value directly (string)
}, [answers, position.questionId, position.subQuestionLabel, isFRQQuestion])
```

---

### Q3: Does `useTestSession` accept and persist non-string answers for non-FRQ questions?

**ANSWER:** **Technically yes**, but practically no.

**Location:** `src/apBoost/hooks/useTestSession.js:328-358`

**Evidence:**
```javascript
// src/apBoost/hooks/useTestSession.js:343-344
} else {
  next.set(questionId, answer)  // ← No type check, any value accepted
}
```

The code does NOT validate that `answer` is a string. However, the UI (AnswerInput) only ever calls `onSelect(letter)` with a single string, so in practice only strings are stored for MCQ.

---

### Q4: Where does the app persist answers beyond React state?

**ANSWER:**
1. **IndexedDB Queue:** `src/apBoost/hooks/useOfflineQueue.js:141-143` (temporary)
2. **Firestore:** `ap_session_state.answers.{questionId}` (durable)

**Field Path:** `answers.${questionId}`

**Evidence:**
```javascript
// src/apBoost/hooks/useOfflineQueue.js:206
updates[`answers.${item.payload.questionId}`] = item.payload.value

// src/apBoost/services/apSessionService.js:133-134
await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
  [`answers.${questionId}`]: answer,
```

---

### Q5: In `AnswerInput`, what comparison determines "selected" today?

**ANSWER:** String equality `selectedAnswer === letter`

**Location:** `src/apBoost/components/AnswerInput.jsx:36`

**Evidence:**
```javascript
const isSelected = selectedAnswer === letter
```

**No branch by `questionType` exists.** The component does not receive `questionType` as a prop and has no conditional logic based on question type.

---

### Q6: In `QuestionDisplay`, is there any text/hint logic based on question type (MCQ vs MCQ_MULTI)?

**ANSWER:** **No** — QuestionDisplay is fully generic for MCQ types.

**Location:** `src/apBoost/components/QuestionDisplay.jsx:77-89, 140-163`

**Evidence:** The only `questionType` check is for FRQ delegation:
```javascript
// src/apBoost/components/QuestionDisplay.jsx:77-89
const frqTypes = [QUESTION_TYPE.FRQ, QUESTION_TYPE.SAQ, QUESTION_TYPE.DBQ]
if (frqTypes.includes(question.questionType)) {
  return <FRQQuestionDisplay ... />
}
```

For MCQ/MCQ_MULTI, the same rendering path is used with no differentiation. No "Select all that apply" hint exists.

---

### Q7: In scoring, what logic determines correctness for MCQ, and does it handle arrays?

**ANSWER:** Single-value `includes()` check. **Does NOT handle arrays.**

**Location:** `src/apBoost/services/apScoringService.js:23-45`

**Evidence:**
```javascript
// src/apBoost/services/apScoringService.js:32-37
const studentAnswer = answers[questionId]
const correctAnswers = question.correctAnswers || []

if (correctAnswers.includes(studentAnswer)) {
  correct++
}
```

This checks if the single `studentAnswer` string is IN the `correctAnswers` array. For MCQ_MULTI with `correctAnswers: ["A", "C"]`:
- If student answers `"A"` (string), `["A", "C"].includes("A")` → `true` (gets full credit incorrectly)
- There is NO array comparison logic for MCQ_MULTI

---

### Q8: Where is `partialCredit` set for MCQ_MULTI creation, and is it read at runtime?

**ANSWER:**
- **Set:** `src/apBoost/pages/APQuestionEditor.jsx:248`
- **Read at Runtime:** **NO** — `partialCredit` is NEVER accessed in `apScoringService.js`

**Evidence (Set):**
```javascript
// src/apBoost/pages/APQuestionEditor.jsx:248
questionData.partialCredit = questionType === QUESTION_TYPE.MCQ_MULTI
```

**Evidence (Not Read):** Searched `apScoringService.js` — no reference to `partialCredit` or `question.partialCredit` in the scoring logic.

---

### Q9: Is `correctAnswers` always an array? Any validators/migrations?

**ANSWER:** Always stored as array. No runtime validators found.

**Location:** `src/apBoost/services/apQuestionService.js:174`

**Evidence:**
```javascript
correctAnswers: questionData.correctAnswers || [],
```

No migration or validation logic found. The code always defaults to empty array `[]` if undefined.

---

### Q10: Are there downstream consumers that assume `studentAnswer` is a string?

**ANSWER:** **Yes** — Multiple consumers would break with array values.

| File | Line | Code | Risk |
|------|------|------|------|
| `APReportCard.jsx` | 93 | `{result.studentAnswer \|\| '—'}` | Would render `[object Object]` or array literal |
| `generateReportPdf.js` | 171 | `doc.text(r.studentAnswer \|\| '—', ...)` | Same issue in PDF output |
| `apAnalyticsService.js` | 144 | `const answer = mcqResult.studentAnswer \|\| 'No Answer'` | Used as object key in distribution |
| `apScoringService.js` | 108 | `studentAnswer,` (in mcqResults) | Stored in Firestore, displayed later |

**Evidence:**
```javascript
// src/apBoost/pages/APReportCard.jsx:92-93
<td className="py-2 px-3 text-text-primary font-mono">
  {result.studentAnswer || '—'}
</td>

// src/apBoost/utils/generateReportPdf.js:171
doc.text(r.studentAnswer || '—', margin + 20, yPos)

// src/apBoost/services/apAnalyticsService.js:144
const answer = mcqResult.studentAnswer || 'No Answer'
```

---

### Q11: Are there PropTypes/TS type checks that constrain `selectedAnswer` to string?

**ANSWER:** **No** — No PropTypes or TypeScript found in apBoost components.

**Evidence:** Grep search for `PropTypes` in `src/apBoost` returned only audit documentation, not actual code.

---

### Q12: How would review mode / answer summary render arrays today?

**ANSWER:** ReviewScreen uses `.has()` on answers Map — works with any value type.

**Location:** `src/apBoost/components/ReviewScreen.jsx:47-49`

**Evidence:**
```javascript
// src/apBoost/components/ReviewScreen.jsx:47-49
const answeredCount = questions.filter(q => answers.has(q.id || q)).length
const unansweredCount = totalQuestions - answeredCount
const flaggedCount = questions.filter(q => flags.has(q.id || q)).length
```

This only checks if an answer EXISTS (Map.has), not its value. Would work fine with arrays.

**However, APReportCard (Q10) WOULD break** when displaying the actual answer value.

---

## Summary: Critical Gaps for MCQ_MULTI

| Component | Current State | Gap |
|-----------|---------------|-----|
| `AnswerInput.jsx` | Radio-style single select | Needs checkbox toggle + array state |
| `QuestionDisplay.jsx` | No MCQ_MULTI hint | Needs "Select all that apply" indicator |
| `useTestSession.js` | Stores any value (no validation) | Technically ready, but UI doesn't send arrays |
| `apScoringService.js` | `includes()` single value check | Needs array comparison + partial credit logic |
| `APReportCard.jsx` | Assumes string `studentAnswer` | Needs array formatting |
| `generateReportPdf.js` | Assumes string `studentAnswer` | Needs array formatting |
| `apAnalyticsService.js` | Uses answer as object key | Needs array handling in distribution |

---

## End of Report
