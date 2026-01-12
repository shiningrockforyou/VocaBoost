# Phase 7: Analytics & Reporting

> **Goal:** Exam analytics dashboard, performance heatmaps, report exports

## Prerequisites
- Phase 1-6 complete and verified
- Read `ap_boost_spec_plan.md` section: 3.6 (Exam Analytics Dashboard)
- Read plan file Phase 7 section

---

## Step 7.1: APExamAnalytics Page

**File:** `pages/APExamAnalytics.jsx`

**Route:** `/ap/teacher/analytics/:testId`

**Overview dashboard with performance heatmaps:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Exam Analytics: AP US History #1                    [Export ▼] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Filters:                                                       │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐│
│  │ Classes (multi-select) ▼    │ │ Students (multi-select) ▼   ││
│  │ ☑ Period 1                  │ │ ☑ All 60 students           ││
│  │ ☑ Period 3                  │ └─────────────────────────────┘│
│  └─────────────────────────────┘                                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  SECTION 1: Multiple Choice Performance        [Download PDF]   │
│                                                                 │
│  [MCQ Performance Grid - color-coded squares]                   │
│                                                                 │
│  [Detailed View]                                                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  SECTION 2: Free Response Performance          [Download PDF]   │
│                                                                 │
│  [FRQ Performance Grid - nested rectangles]                     │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Student Results (60 students)                                  │
│  [Student Results Table]                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Verification:**
- [ ] Page loads with test data
- [ ] Filters work
- [ ] Grids display

---

## Step 7.2: Analytics Components

### PerformanceGrid.jsx

**File:** `components/analytics/PerformanceGrid.jsx`

**MCQ grid - one square per question:**

```
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
│ Q1 │ │ Q2 │ │ Q3 │ │ Q4 │ │ Q5 │ │ Q6 │ │ Q7 │ │ Q8 │ │ Q9 │ │Q10 │
│92% │ │78% │ │65% │ │55% │ │43% │ │88% │ │71% │ │62% │ │58% │ │81% │
│ 🟢 │ │🟡🟢│ │ 🟡 │ │ 🟠 │ │ 🔴 │ │ 🟢 │ │🟡🟢│ │ 🟡 │ │ 🟠 │ │🟡🟢│
└────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘
```

**Props:**
```typescript
interface PerformanceGridProps {
  questions: Question[];
  results: Map<questionId, { correct: number; total: number }>;
  onQuestionClick: (questionId: string) => void;
}
```

**Color Scale (fixed thresholds):**
| Percentage | Color | CSS Class |
|------------|-------|-----------|
| > 85% | Green | `bg-green-500` |
| 70-85% | Yellow-Green | `bg-lime-400` |
| 60-70% | Yellow | `bg-yellow-400` |
| 50-60% | Orange | `bg-orange-400` |
| < 50% | Red | `bg-red-500` |

**Verification:**
- [ ] Grid displays correctly
- [ ] Colors match thresholds
- [ ] Click opens detail modal

---

### MCQSquare.jsx

**File:** `components/analytics/MCQSquare.jsx`

**Single question square:**

```typescript
interface MCQSquareProps {
  questionNumber: number;
  percentage: number;
  onClick: () => void;
}
```

**Verification:**
- [ ] Shows number and percentage
- [ ] Color correct
- [ ] Hover effect

---

### FRQCard.jsx

**File:** `components/analytics/FRQCard.jsx`

**FRQ question with nested sub-question squares:**

```
┌───────────────────────────────────┐
│ FRQ 1: "Using the excerpt..."     │
│ Overall: 66% 🟡                    │
│                                    │
│  ┌────┐ ┌────┐ ┌────┐            │
│  │ a  │ │ b  │ │ c  │            │
│  │72% │ │58% │ │68% │            │
│  │🟡🟢│ │ 🟠 │ │ 🟡 │            │
│  └────┘ └────┘ └────┘            │
│                                    │
└───────────────────────────────────┘
```

**Props:**
```typescript
interface FRQCardProps {
  question: Question;
  subResults: Map<subLabel, { points: number; maxPoints: number }>;
  onSubClick: (subLabel: string) => void;
}
```

**Verification:**
- [ ] Shows overall percentage
- [ ] Sub-question squares display
- [ ] Colors correct

---

### QuestionDetailModal.jsx

**File:** `components/analytics/QuestionDetailModal.jsx`

**Opens when clicking a question square:**

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
│  │ (B) Expansion of manufacturing         ███████████████████ 55%  │    │
│  │     [Green - Correct ✓]                (18 students)            │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ (C) Decline in agriculture             ░░░░░░░░░░░░░░░░░░  0%   │    │
│  │ (D) Reduced government spending        ░░░░░░░░░░░░░░░░░░  0%   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Correct Answer: B                                                       │
│  Domain: Unit 4 - Market Revolution                                      │
│  Topic: Industrial Development                                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface QuestionDetailModalProps {
  question: Question;
  distribution: Map<choice, { count: number; percentage: number }>;
  onClose: () => void;
}
```

**Verification:**
- [ ] Shows question and stimulus
- [ ] Shows response distribution bars
- [ ] Correct answer highlighted green
- [ ] Incorrect answers in red

---

### MCQDetailedView.jsx

**File:** `components/analytics/MCQDetailedView.jsx`

**Expanded list view with all question distributions:**

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
│  ...                                                                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Verification:**
- [ ] All questions listed
- [ ] Distributions inline
- [ ] Back to grid works

---

### StudentResultsTable.jsx

**File:** `components/analytics/StudentResultsTable.jsx`

**List of students with scores:**

```
┌────────────────┬──────────────────────┬───────┬───────┬───────┬─────┐
│ Name           │ Email                │ MCQ   │ FRQ   │AP Score│     │
├────────────────┼──────────────────────┼───────┼───────┼───────┼─────┤
│ John Smith     │ john@school.edu      │ 32/40 │ 24/36 │   4   │ 📄  │
│ Jane Doe       │ jane@school.edu      │ 38/40 │ 30/36 │   5   │ 📄  │
│ Bob Wilson     │ bob@school.edu       │ 28/40 │ 20/36 │   3   │ 📄  │
└────────────────┴──────────────────────┴───────┴───────┴───────┴─────┘
```

**Features:**
- Sortable columns
- Click name → Student Profile
- Click 📄 → Report Card

**Verification:**
- [ ] Table displays
- [ ] Sort works
- [ ] Links work

---

### FilterBar.jsx

**File:** `components/analytics/FilterBar.jsx`

**Multi-select filters for classes and students:**

```typescript
interface FilterBarProps {
  classes: Class[];
  students: Student[];
  selectedClasses: string[];
  selectedStudents: string[];
  onClassChange: (classIds: string[]) => void;
  onStudentChange: (studentIds: string[]) => void;
}
```

**Behavior:**
- Both filters are multi-select (checkboxes)
- Select class → auto-populate students dropdown
- Default: All classes, all students

**Verification:**
- [ ] Multi-select works
- [ ] Class selection filters students
- [ ] Results update on filter change

---

## Step 7.3: apAnalyticsService

**File:** `services/apAnalyticsService.js`

```javascript
/**
 * Get aggregated results for a test
 */
export async function getTestAnalytics(testId, filters);

/**
 * Calculate question performance across students
 */
export function calculateQuestionPerformance(results, questions);

/**
 * Calculate response distribution for MCQ
 */
export function calculateResponseDistribution(results, questionId);

/**
 * Calculate FRQ sub-question averages
 */
export function calculateFRQPerformance(results, questions);

/**
 * Get student list with scores
 */
export async function getStudentResults(testId, filters);
```

**Aggregation logic:**
- For each question: count correct / total attempts
- For MCQ distribution: count each choice selection
- For FRQ: average points per sub-question

**Verification:**
- [ ] Aggregations correct
- [ ] Filters apply
- [ ] Performance acceptable (large datasets)

---

## Step 7.4: generateReportPdf

**File:** `utils/generateReportPdf.js`

**Generate Report Card as PDF:**

```javascript
/**
 * Generate downloadable PDF of student report card
 * @param {TestResult} result
 * @param {Test} test
 * @param {User} student
 * @returns {Blob} PDF blob
 */
export async function generateReportPdf(result, test, student);
```

**PDF Contents:**
- Header with student/test info
- AP Score prominently displayed
- Section breakdown with scores
- Full MCQ results table
- Full FRQ results table with comments
- Does NOT include teacher's annotated PDF (separate)

**Verification:**
- [ ] PDF generates
- [ ] All sections included
- [ ] Formatting correct

---

## Step 7.5: generateQuestionsPdf

**File:** `utils/generateQuestionsPdf.js`

**Generate questions as PDF for teacher reference:**

```javascript
/**
 * Generate PDF of test questions
 * @param {Test} test
 * @param {Object} options - includeAnswers, includeStimuli
 * @returns {Blob} PDF blob
 */
export async function generateQuestionsPdf(test, options);
```

**Options:**
- `includeAnswers`: Show correct answers (teacher version)
- `includeStimuli`: Include stimulus content

**Verification:**
- [ ] PDF generates
- [ ] Answers included/excluded correctly
- [ ] Stimuli render

---

## performanceColors Utility

**File:** `utils/performanceColors.js`

```javascript
export const PERFORMANCE_THRESHOLDS = [
  { min: 85, color: 'green-500', label: 'Excellent' },
  { min: 70, color: 'lime-400', label: 'Good' },
  { min: 60, color: 'yellow-400', label: 'Satisfactory' },
  { min: 50, color: 'orange-400', label: 'Needs Improvement' },
  { min: 0, color: 'red-500', label: 'Critical' },
];

export function getPerformanceColor(percentage) {
  for (const threshold of PERFORMANCE_THRESHOLDS) {
    if (percentage >= threshold.min) {
      return threshold.color;
    }
  }
  return 'red-500';
}

export function getPerformanceLabel(percentage) {
  // Similar logic
}
```

---

## Final Verification Checklist

- [ ] Analytics page loads for test
- [ ] Class/student filters work
- [ ] MCQ grid shows color-coded squares
- [ ] Click square → modal with distribution
- [ ] FRQ grid shows nested sub-question squares
- [ ] Detailed view shows all questions
- [ ] Student table with sortable columns
- [ ] Click student → profile page
- [ ] Click 📄 → report card
- [ ] Download Report PDF works
- [ ] Download Questions PDF works (teacher)
- [ ] Colors match threshold definitions
