# Phase 5: Teacher Flow

> **Goal:** Teachers can create tests, manage questions, assign to classes

## Prerequisites
- Phase 1-4 complete and verified
- Read `ap_boost_spec_plan.md` sections: 3.1 (Data Model - ap_tests, ap_questions, ap_classes, ap_assignments)
- Read plan file Phase 5 section

---

## Step 5.1: APTeacherDashboard Page

**File:** `pages/APTeacherDashboard.jsx`

**Teacher home with overview:**

```
┌─────────────────────────────────────────────────────────────────┐
│  AP Boost - Teacher Dashboard                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Quick Actions:                                                 │
│  [+ Create New Test]  [Question Bank]  [Gradebook]             │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  My Tests (5)                                          [View All]│
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │ AP US History #1 │ │ AP US History #2 │ │ AP Calculus #1   │ │
│  │ 40 MCQ, 3 FRQ    │ │ 35 MCQ           │ │ 20 MCQ, 2 FRQ    │ │
│  │ [Edit] [Assign]  │ │ [Edit] [Assign]  │ │ [Edit] [Assign]  │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Pending Grading (8)                                            │
│  • 5 submissions for AP US History #1                           │
│  • 3 submissions for AP Calculus #1                             │
│  [Go to Gradebook]                                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  My Classes (3)                                                 │
│  • Period 1 - AP US History (28 students)                       │
│  • Period 3 - AP US History (32 students)                       │
│  • Period 5 - AP Calculus (25 students)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Sections:**
1. Quick actions (prominent buttons)
2. My Tests (recent, with Edit/Assign)
3. Pending Grading count
4. My Classes list

**Verification:**
- [ ] Shows teacher's tests
- [ ] Quick actions work
- [ ] Pending grading count correct

---

## Step 5.2: APTestEditor Page

**File:** `pages/APTestEditor.jsx`

**Create/edit test with sections:**

```
┌─────────────────────────────────────────────────────────────────┐
│  [← Back]  Create New Test                          [Save Draft]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Test Name: [_______________________________]                   │
│  Subject: [AP US History ▼]                                     │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Sections:                                                      │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Section 1: Multiple Choice                    [⋮] [🗑]    │  │
│  │ Time Limit: [45] minutes    Multiplier: [1.0]            │  │
│  │ Questions: 40               [+ Add Questions]             │  │
│  │                                                           │  │
│  │ 1. Which of the following...             [Edit] [Remove] │  │
│  │ 2. The primary cause of...               [Edit] [Remove] │  │
│  │ 3. According to the passage...           [Edit] [Remove] │  │
│  │ ...                                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Section 2: Free Response                      [⋮] [🗑]    │  │
│  │ Time Limit: [55] minutes                                  │  │
│  │ Questions: 3                [+ Add Questions]             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [+ Add Section]                                                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Scoring:                                                       │
│  AP 5: [80]% - 100%    AP 2: [35]% - [49]%                     │
│  AP 4: [65]% - [79]%   AP 1: [0]% - [34]%                      │
│  AP 3: [50]% - [64]%                                            │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [Cancel]                              [Save and Publish]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Drag to reorder sections
- Drag to reorder questions within section
- Add questions from bank or create new
- Set time limits per section
- Configure score ranges

**Verification:**
- [ ] Create new test
- [ ] Add sections
- [ ] Add questions to sections
- [ ] Reorder via drag
- [ ] Save draft and publish

---

## Step 5.3: APQuestionBank Page

**File:** `pages/APQuestionBank.jsx`

**Browse and manage question bank:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Question Bank                             [+ Create Question]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Filters:                                                       │
│  Subject: [All ▼]  Type: [All ▼]  Difficulty: [All ▼]          │
│  Domain: [All ▼]   Search: [_______________]                    │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Showing 150 questions                                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ☐ Q1 | MCQ | Unit 3: Colonial America | Medium           │  │
│  │    "Which of the following best describes..."             │  │
│  │    [Preview] [Edit] [Add to Test ▼]                       │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ ☐ Q2 | FRQ | Unit 4: Revolutionary War | Hard             │  │
│  │    "Using the excerpt, answer parts a, b, and c..."       │  │
│  │    [Preview] [Edit] [Add to Test ▼]                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [With Selected: Add to Test ▼]                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Filter by subject, type, difficulty, domain
- Full-text search
- Preview question (modal)
- Bulk select and add to test

**Verification:**
- [ ] Filters work
- [ ] Search works
- [ ] Preview shows full question
- [ ] Add to test works

---

## Step 5.4: Class Assignment

**File:** `components/teacher/AssignTestModal.jsx`

**Assign test to classes/students:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Assign Test: AP US History #1                         [X Close]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Select Classes:                                                │
│  ☑ Period 1 - AP US History (28 students)                      │
│  ☑ Period 3 - AP US History (32 students)                      │
│  ☐ Period 5 - AP Calculus (25 students)                        │
│                                                                 │
│  Or select individual students:                                 │
│  [Search students...]                                           │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Settings:                                                      │
│  Due Date: [____/____/____]  (optional)                        │
│  Max Attempts: [3]                                              │
│  FRQ Mode: [Typed ▼]  (Typed / Handwritten)                    │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [Cancel]                              [Assign to 60 students]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Creates `ap_assignments` document:**
```javascript
{
  testId: string,
  classId: string,
  studentIds: [userId, ...],
  dueDate: Timestamp | null,
  maxAttempts: number,
  frqSubmissionType: "TYPED" | "HANDWRITTEN",
  assignedAt: serverTimestamp(),
  assignedBy: teacherId
}
```

**Verification:**
- [ ] Select classes/students
- [ ] Set due date
- [ ] Set max attempts
- [ ] Set FRQ mode
- [ ] Creates assignment document

---

## Services

### apTeacherService.js

**File:** `services/apTeacherService.js`

```javascript
/**
 * Get teacher's tests
 */
export async function getTeacherTests(teacherId);

/**
 * Create new test
 */
export async function createTest(testData);

/**
 * Update test
 */
export async function updateTest(testId, updates);

/**
 * Delete test (soft delete?)
 */
export async function deleteTest(testId);

/**
 * Get teacher's classes
 */
export async function getTeacherClasses(teacherId);

/**
 * Create assignment
 */
export async function createAssignment(assignmentData);

/**
 * Get pending grading count
 */
export async function getPendingGradingCount(teacherId);
```

### apQuestionService.js

**File:** `services/apQuestionService.js`

```javascript
/**
 * Search question bank
 */
export async function searchQuestions(filters);

/**
 * Create question
 */
export async function createQuestion(questionData);

/**
 * Update question
 */
export async function updateQuestion(questionId, updates);

/**
 * Add questions to test section
 */
export async function addQuestionsToSection(testId, sectionId, questionIds);

/**
 * Remove question from test section
 */
export async function removeQuestionFromSection(testId, sectionId, questionId);
```

---

## Final Verification Checklist

- [ ] Teacher dashboard shows tests, classes, pending grading
- [ ] Create new test with sections
- [ ] Add questions from bank to test
- [ ] Create new questions
- [ ] Reorder questions via drag
- [ ] Assign test to class
- [ ] Set due date and max attempts
- [ ] Set FRQ submission mode
- [ ] Students see assigned tests in dashboard
