# Phase 3: FRQ Support

> **Goal:** Student can answer FRQ (typed mode), teacher can grade

## Prerequisites
- Phase 1 & 2 complete and verified
- Read `ap_boost_spec_plan.md` sections: 3.4 (FRQ Submission & Grading), 3.5 (Report Card)
- Read plan file Part 1.3 (FRQ Navigation Model), Part 1.7 (Partial Results)

---

## Key Concept: FRQ Sub-Question Navigation

**Critical:** Each FRQ sub-question is a separate "page"

```
Q1(a) → Navigate → Q1(b) → Navigate → Q1(c) → Q2(a) → ...
```

- Full question prompt reprinted on each sub-question page
- Navigator shows flat list: `1a 1b 1c 2a 2b 2c`
- Each sub-question has its own textarea

**Position tracking:**
```javascript
{
  sectionIndex: 1,
  questionIndex: 0,
  subQuestionLabel: "a"  // null for MCQ
}
```

---

## Step 3.1: Update QuestionDisplay for FRQ

**File:** `components/QuestionDisplay.jsx`

**Add FRQ rendering:**

```jsx
// For FRQ questions
if (question.questionType === 'FRQ') {
  return (
    <FRQQuestionDisplay
      question={question}
      subQuestionLabel={subQuestionLabel}
      stimulus={stimulus}
      format={format}
    >
      {children}
    </FRQQuestionDisplay>
  );
}
```

**FRQ Layout:**
- Always HORIZONTAL (stimulus on left if exists)
- Shows full question text
- Highlights current sub-question
- Shows rubric hint (point value)

**Verification:**
- [ ] FRQ renders correctly
- [ ] Sub-question highlighted
- [ ] Stimulus displays

---

## Step 3.2: FRQ Navigation Updates

**File:** `hooks/useTestSession.js`

**Update navigation logic:**

```javascript
// Compute flat index for FRQ sub-questions
const computeFlatIndex = (position) => {
  let index = 0;
  for (let s = 0; s < position.sectionIndex; s++) {
    index += getSectionQuestionCount(test.sections[s]);
  }
  for (let q = 0; q < position.questionIndex; q++) {
    const question = currentSection.questions[q];
    if (question.subQuestions) {
      index += question.subQuestions.length;
    } else {
      index += 1;
    }
  }
  if (position.subQuestionLabel) {
    const subIndex = question.subQuestions.findIndex(
      sq => sq.label === position.subQuestionLabel
    );
    index += subIndex;
  }
  return index;
};

// Navigate to next (handles sub-questions)
const goNext = () => {
  if (question.subQuestions && subQuestionLabel) {
    const subIndex = question.subQuestions.findIndex(
      sq => sq.label === subQuestionLabel
    );
    if (subIndex < question.subQuestions.length - 1) {
      // Next sub-question
      setPosition(prev => ({
        ...prev,
        subQuestionLabel: question.subQuestions[subIndex + 1].label
      }));
      return;
    }
  }
  // Next question
  goToQuestion(position.questionIndex + 1);
};
```

**Verification:**
- [ ] Navigate through sub-questions
- [ ] Flat index correct
- [ ] Back/Next work correctly

---

## Step 3.3: FRQTextInput Component

**File:** `components/FRQTextInput.jsx`

**Textarea for FRQ answers:**

```typescript
interface FRQTextInputProps {
  subQuestion: SubQuestion;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
}
```

**Features:**
- Auto-resize textarea
- Character count (optional)
- Placeholder: "Type your response here..."
- Save on blur or debounced

**Styling:**
```
- Border: border-border-default
- Focus: ring-2 ring-brand-primary
- Min height: 150px
- Max height: 400px (scrolls after)
```

**Verification:**
- [ ] Textarea expands
- [ ] Value saves correctly
- [ ] Character count works

---

## Step 3.4: Update QuestionNavigator for FRQ

**File:** `components/QuestionNavigator.jsx`

**Changes for FRQ:**
- Show flat sub-question boxes: `1a 1b 1c 2a 2b...`
- Each sub-question is own box
- Label shows inside box (smaller text)

```
┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
│1a │ │1b │ │1c │ │2a │ │2b │ │2c │ │2d │
│ ■ │ │ □ │ │ □ │ │ ■ │ │ □ │ │ □ │ │ □ │
└───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘
```

**Answered state for FRQ:**
- Check if `answers[questionId][subLabel]` has content

**Verification:**
- [ ] Shows flat sub-question list
- [ ] Answered state correct
- [ ] Click navigates to sub-question

---

## Step 3.5: Update APReportCard for Partial Results

**File:** `pages/APReportCard.jsx`

**When `gradingStatus !== 'COMPLETE'`:**

```
┌─────────────────────────────────────────────────────────────────┐
│  SECTION 1: Multiple Choice                                     │
│  32/40 correct (80%)                                            │
│  [Full results table]                                           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  SECTION 2: Free Response                                       │
│  ⏳ Awaiting Grade                                              │
│                                                                 │
│  Your submitted answers:                                        │
│  Q1(a): [Student's answer - read only]                         │
│  Q1(b): [Student's answer - read only]                         │
│  ...                                                            │
│                                                                 │
│  Points: --/27 (pending)                                       │
└─────────────────────────────────────────────────────────────────┘
```

**Verification:**
- [ ] MCQ shows immediately
- [ ] FRQ shows "Awaiting Grade"
- [ ] Student answers visible (read-only)

---

## Step 3.6: APGradebook Page

**File:** `pages/APGradebook.jsx`

**Teacher grading list:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Gradebook                                            [Filter ▼] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Student        │ Test              │ Status     │ Action │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ John Smith     │ AP US History #1  │ ⏳ Pending │ [Grade]│  │
│  │ Jane Doe       │ AP US History #1  │ ✓ Complete │ [View] │  │
│  │ Bob Wilson     │ AP US History #2  │ ⏳ Pending │ [Grade]│  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Filters:**
- Test (dropdown)
- Status (Pending/Complete/All)
- Class (dropdown)

**Click "Grade":** Opens side panel

**Verification:**
- [ ] Lists students needing grading
- [ ] Filters work
- [ ] Click opens grading panel

---

## Step 3.7: GradingPanel Component

**File:** `components/grading/GradingPanel.jsx`

**Side panel for grading FRQ:**

```
┌─────────────────────────────────────────────────────────────────┐
│  GRADING: John Smith - AP US History #1            [X Close]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [View Student's Answer]  ← Opens PDF/typed text               │
│                                                                 │
│  Question 1: "Using the excerpt..."           Total: __/9      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ (a) Identify ONE historical...            [__]/3 pts     │ │
│  │ (b) Explain how...                        [__]/3 pts     │ │
│  │ (c) Briefly explain...                    [__]/3 pts     │ │
│  │                                                          │ │
│  │ Comment: [________________________]                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Question 2: ...                                                │
│                                                                 │
│  ────────────────────────────────────────────────────────────  │
│  [Save Draft]  [Mark Complete]                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface GradingPanelProps {
  resultId: string;
  onClose: () => void;
  onSave: () => void;
}
```

**Grading inputs:**
- Number input for each sub-question (0 to max points)
- Text area for comments
- Auto-calculate question total

**Verification:**
- [ ] Shows student answer
- [ ] Score inputs work
- [ ] Comments save
- [ ] "Mark Complete" updates status

---

## Step 3.8: apGradingService

**File:** `services/apGradingService.js`

**Functions:**

```javascript
/**
 * Get all results pending grading for teacher
 */
export async function getPendingGrades(teacherId, filters);

/**
 * Get single result for grading
 */
export async function getResultForGrading(resultId);

/**
 * Save grade (draft or complete)
 */
export async function saveGrade(resultId, grades, status);

/**
 * Calculate final FRQ score from sub-scores
 */
export function calculateFRQScore(grades, test);
```

**Grade Document Update:**
```javascript
{
  frqGrades: {
    [questionId]: {
      subScores: { a: 2, b: 3, c: 1 },
      comment: "Good analysis..."
    }
  },
  gradingStatus: "IN_PROGRESS" | "COMPLETE",
  gradedBy: teacherId,
  gradedAt: serverTimestamp()
}
```

**Verification:**
- [ ] Saves grades correctly
- [ ] Calculates total score
- [ ] Updates grading status

---

## Final Verification Checklist

- [ ] FRQ shows full question on each sub-question page
- [ ] Navigate 1a → 1b → 1c via Next
- [ ] Navigator shows flat sub-question boxes
- [ ] FRQ textarea saves correctly
- [ ] Submit → Report Card shows "Awaiting Grade" for FRQ
- [ ] Teacher sees pending grades in Gradebook
- [ ] Teacher can grade sub-questions
- [ ] "Mark Complete" → student sees updated score
