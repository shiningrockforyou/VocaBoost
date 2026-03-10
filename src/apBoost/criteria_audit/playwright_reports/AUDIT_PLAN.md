# apBoost Playwright MCP Audit Plan

## Prerequisites for All Tests

**P0: Data Seeding**
Before any audit scenarios, the Playwright agent must seed the database:
1. Navigate to `http://localhost:5173/ap/teacher`
2. Log in as a teacher account
3. Scroll to the "Developer Tools" section at the bottom of the page
4. Click the button labeled "Seed Full Test Data (Micro, Macro, Calc AB)"
5. Wait for the success message: "Seeded 3 tests, 51 questions, 5 students, 2 classes, 3 assignments, 13 results."
6. Verify the "My Tests" section now shows test cards

**Test Account Credentials (see `src/apBoost/TEST_ACCOUNTS.md` for full details):**

| Role | Email | Password |
|------|-------|----------|
| Teacher | teacher@apboost.test | Teacher123! |
| Student | student@apboost.test | Student123! |

**Account Requirements:**
- **Teacher account**: Must have `role === 'teacher'` in Firestore users collection. The seed script uses the logged-in user's UID as the teacher ID.
- **Student accounts**: The seed creates Firestore profile docs for 5 students (`student_seed_001` through `student_seed_005`), but Firebase Auth accounts must exist separately. If no real student Auth accounts exist, the student track must use the teacher account with student-accessible routes only (`/ap`, `/ap/test/:testId`, `/ap/results/:resultId`).

---

## TRACK 1: STUDENT EXPERIENCE AUDIT

---

### S-01: Dashboard Initial Load and Test Card Display

**Preconditions:** Seed data has been run. Logged in as a student (or user with available tests).

**Steps:**
1. Navigate to `http://localhost:5173/ap`
2. Wait for the loading skeleton (3 pulsing cards in a grid) to disappear
3. Verify the page heading "AP Practice Tests" is visible (`h1` element)
4. Count the number of test cards displayed in the grid (`.grid` container)
5. For each test card, verify it contains:
   - A test title (`h3` element, e.g., "AP Microeconomics Practice Exam")
   - A subject name (e.g., "AP Microeconomics")
   - Section count text (e.g., "2 sections")
   - Time text (e.g., "100 min" or similar)
   - A status badge: one of "Not Started", "In Progress", or "Completed" (in a `span` element)
6. Verify the AP header is present: contains "AP Practice" text and a link to `/ap`
7. Verify no error banner (red `bg-error` div) is shown

**Expected Results:**
- At least 3 test cards visible (AP Micro, AP Macro, AP Calc AB)
- All cards show "Not Started" status (for a fresh student account) or "Completed" (for seeded students)
- No loading skeleton visible after data loads

**Acceptance Criteria:**
- PASS: 3+ test cards render with title, subject, section count, time, and status badge
- FAIL: Fewer than 3 cards, missing fields, or error banner shown

**Capture:** Screenshot of full dashboard, DOM snapshot of the test card grid

**Criteria Audit References:** 1.9 (Dashboard), 7.1 (page states), 20.1 (phase verification)

---

### S-02: Instruction Screen - MCQ+FRQ Test

**Preconditions:** Dashboard loaded with seed data. No active session for the selected test.

**Steps:**
1. From the dashboard at `/ap`, click on the test card titled "AP Microeconomics Practice Exam"
2. Wait for navigation to `/ap/test/test_micro_full_1` (or similar test ID)
3. Wait for the instruction screen to render (look for `h1` with the test title)
4. Verify the test title is displayed in the heading: "AP Microeconomics Practice Exam"
5. Verify the subject name appears below the title (e.g., "AP Microeconomics")
6. Verify the section breakdown is shown:
   - "This test has 2 sections:" text
   - Section 1 details: section title, question count (e.g., "15 questions"), time limit
   - Section 2 details: section title, question count (e.g., "2 questions"), time limit
7. Verify "Total time:" appears with a formatted value
8. Verify the FRQ info box is present (blue `bg-info` div containing "Free Response Section" heading and descriptive text about typing responses)
9. Verify the warning box is present (yellow `bg-warning` div) with text:
   - "Once you begin, you cannot pause the timer."
   - "You cannot return to previous sections."
10. Verify two buttons are present:
    - "Cancel" button (border style, `text-text-secondary`)
    - "Begin Test" button (solid `bg-brand-primary` style, white text)
11. Click "Cancel" and verify navigation back to `/ap`
12. Click on the same test card again to return to instruction screen
13. Verify "Begin Test" button text (not "Resume Test" since no active session)

**Expected Results:**
- All instruction elements render correctly
- FRQ info box appears because test has FRQ sections
- Cancel navigates to dashboard
- Button says "Begin Test" for new sessions

**Acceptance Criteria:**
- PASS: All 10 verification points confirmed
- FAIL: Missing sections, wrong button text, FRQ info box absent, or navigation fails

**Capture:** Screenshot of instruction screen, screenshot after cancel navigation

**Criteria Audit References:** 1.10 (page states), 8.1 (FRQ instruction info), 7.1 (UI components)

---

### S-03: Begin Test - Timer Starts, Question 1 Displays

**Preconditions:** On the instruction screen for AP Micro test.

**Steps:**
1. Click "Begin Test" button
2. Wait for the test interface to render (header bar with timer + question content area + bottom nav bar)
3. Verify the header bar contains:
   - A hamburger menu button (3-line SVG icon, `aria-label="Open menu"`)
   - Section info text: "Section 1 of 2: Multiple Choice" (or similar section title)
   - Timer display showing `MM:SS` format (font-mono class, non-zero value)
4. Verify the timer is counting down (capture the time, wait 2 seconds, capture again, confirm it decreased)
5. Verify the question display area shows:
   - "Question 1" label (in `text-text-muted text-sm` span)
   - Question text for the first MCQ (the actual question text from seed data)
6. Verify four answer choices (A, B, C, D) are displayed:
   - Each in a button element with a letter badge (circular `w-6 h-6 rounded-full`)
   - Each with choice text
   - None selected (all have `bg-surface border-border-default` styling, not `bg-brand-primary`)
7. Verify the strikethrough buttons (X icon SVGs) appear next to each choice
8. Verify the bottom navigation bar shows:
   - "Back" button (disabled, with `cursor-not-allowed` styling since this is Q1)
   - "Question 1 of 15" text (or appropriate count) in the center
   - "Next" button on the right
9. Verify the "Flag for Review" button is present below the question with a flag icon

**Expected Results:**
- Timer is running and counting down
- First question renders with 4 choices, none selected
- Back is disabled, Next is enabled
- Flag button shows unflagged state

**Acceptance Criteria:**
- PASS: Timer counts, Q1 displays correctly, nav buttons in correct state
- FAIL: Timer not running, question not shown, wrong question count, or nav state incorrect

**Capture:** Screenshot of full test interface, console log check for errors, timer value at two timestamps

**Criteria Audit References:** 1.1 (timed sections), 7.2 (question display), 7.3 (header), 7.4 (navigation)

---

### S-04: MCQ Answer Selection and Persistence

**Preconditions:** Test session active, viewing Question 1 (MCQ), no answer selected.

**Steps:**
1. Verify no answer is currently selected (all choices have `bg-surface` class, not `bg-brand-primary`)
2. Click the answer choice button for option B
3. Verify option B is now selected:
   - The button has `bg-brand-primary` class and `text-white`
   - The letter badge for B shows `bg-white/20 text-white`
   - All other options (A, C, D) remain unselected
4. Click the "Next" button in the bottom nav bar
5. Verify "Question 2" label appears in the question area
6. Verify the center nav text now shows "Question 2 of 15"
7. Click option A for Question 2
8. Verify option A is selected (highlighted with brand primary)
9. Click the "Back" button in the bottom nav bar
10. Verify we are back on Question 1
11. Verify option B is STILL selected (answer persisted through navigation)
12. Change the answer: click option C
13. Verify option C is now selected and option B is deselected
14. Click "Next" to go to Question 2
15. Verify option A is still selected on Question 2

**Expected Results:**
- Clicking an answer highlights it with brand primary color
- Only one answer is selected at a time for MCQ
- Answers persist when navigating between questions
- Changing an answer deselects the previous one

**Acceptance Criteria:**
- PASS: All answer selection, deselection, and persistence checks pass
- FAIL: Answer not highlighted, multiple selected, or answer lost on navigation

**Capture:** Screenshots after selecting B on Q1, after selecting A on Q2, after returning to Q1 showing B still selected, after changing to C

**Criteria Audit References:** 2.1 (MCQ), 1.7 (session persistence), 5.1 (sync strategy)

---

### S-05: Question Flagging

**Preconditions:** Test session active, viewing Question 1 with option C selected.

**Steps:**
1. Locate the "Flag for Review" button below the question area (contains "Flag for Review" text and an unflagged icon)
2. Click "Flag for Review"
3. Verify the button changes:
   - Background becomes `bg-warning`
   - Text becomes "Flagged" with a flag emoji
4. Click "Next" to go to Question 2
5. Verify Question 2's flag button shows "Flag for Review" (unflagged state)
6. Flag Question 2 as well
7. Click the center "Question 2 of 15" text in the bottom nav to open the Question Navigator modal
8. Verify the slide-up modal appears with:
   - "Question Navigator" heading
   - A grid of question boxes
   - Question 1 box shows a flag emoji instead of the number "1"
   - Question 2 box shows a flag emoji instead of the number "2"
   - Question 1 box also has `bg-brand-primary` (answered) styling
   - Question 2 box also has `bg-brand-primary` (answered) styling
   - Question 1 and 2 boxes have `border-warning-ring border-2` (flagged border)
   - Unanswered, unflagged boxes show numbers and `bg-surface` styling
9. Verify the legend at the bottom shows: Answered (brand primary), Unanswered (surface), Flagged (warning border)
10. Close the navigator by clicking the backdrop or the close button
11. Navigate back to Question 1, click the "Flagged" button to unflag it
12. Verify the button reverts to "Flag for Review" with unflagged icon

**Expected Results:**
- Flag toggle works visually
- Flagged questions show flag emoji in the navigator grid
- Unflagging reverts the state

**Acceptance Criteria:**
- PASS: Flag toggles correctly, navigator shows flags, unflag works
- FAIL: Flag state doesn't persist, navigator doesn't reflect flags, or toggle fails

**Capture:** Screenshot of flagged button, screenshot of navigator modal showing flagged questions

**Criteria Audit References:** 1.2 (question flagging), 7.4 (navigation), 7.5 (review screen)

---

### S-06: Strikethrough on MCQ Choices

**Preconditions:** Test session active, viewing any MCQ question.

**Steps:**
1. Navigate to Question 3 (unanswered)
2. Locate the strikethrough button next to choice A (small button with an X SVG icon, `title="Strike through"`)
3. Click the strikethrough button for choice A
4. Verify choice A now has:
   - `opacity-[0.6]` class on the answer button
   - The choice text has `line-through text-text-muted` classes
   - The strikethrough button changes to `bg-muted border-border-strong` (active state)
5. Click the strikethrough button for choice D
6. Verify choice D also shows strikethrough styling
7. Click choice B to select it as the answer
8. Verify choice B is selected (brand primary background) while A and D remain struck through
9. Click the strikethrough button for choice A again (toggle off)
10. Verify choice A returns to normal: no opacity reduction, no line-through
11. Navigate to Question 4 and back to Question 3
12. Verify the strikethrough on choice D persists through navigation

**Expected Results:**
- Strikethrough applies visual changes (opacity + line-through)
- Multiple choices can be struck through simultaneously
- Striking through a choice does not select it as the answer
- Selected answers are independent of strikethroughs
- Strikethrough state persists through navigation

**Acceptance Criteria:**
- PASS: All strikethrough visual changes correct, persistence confirmed
- FAIL: Visual changes missing, strikethrough conflicts with selection, or state lost

**Capture:** Screenshot showing struck-through choices alongside a selected answer

**Criteria Audit References:** 1.4 (strikethrough), 7.2 (question display)

---

### S-07: Question Navigator Modal - Full Grid Navigation

**Preconditions:** Test session active, several questions answered (Q1=C, Q2=A, Q3=B), Q2 flagged, Q3 has strikethrough on D.

**Steps:**
1. Click the center "Question X of 15" text in bottom nav bar
2. Wait for the slide-up navigator modal to animate in
3. Verify the grid contains 15 question boxes (matching section 1 question count)
4. Verify answered questions (Q1, Q2, Q3) have `bg-brand-primary` and show white text
5. Verify flagged question (Q2) shows flag emoji instead of number
6. Verify unanswered questions (Q4-Q15) have `bg-surface` and show their number
7. Verify the current question has a `ring-2 ring-info-ring` highlight
8. Click on question box 7 in the grid
9. Verify the modal closes and Question 7 is now displayed
10. Verify the bottom nav shows "Question 7 of 15"
11. Verify Question 7 content loads (question text appears)
12. Click "Question 7 of 15" to reopen the navigator
13. Click the "Go to Review Screen" button at the bottom of the modal
14. Verify the Review Screen loads (see S-10 for details)
15. Click "Return to Questions" on the review screen to go back to testing

**Expected Results:**
- Navigator grid accurately reflects answered/unanswered/flagged states
- Clicking a question box navigates directly to that question
- "Go to Review Screen" button works

**Acceptance Criteria:**
- PASS: Grid states correct, navigation works, review screen accessible
- FAIL: States incorrect, navigation fails, or review button missing

**Capture:** Screenshot of full navigator modal grid, screenshot after navigating to Q7

**Criteria Audit References:** 7.4 (navigation), 1.6 (section locking)

---

### S-08: Answer All MCQ Questions in Section 1

**Preconditions:** Test session active in Section 1. Q1=C, Q2=A, Q3=B already answered.

**Steps:**
1. Navigate to Q4 using the bottom nav "Next" button or the question navigator
2. For each question Q4 through Q15, perform:
   a. Verify the question number label shows correctly ("Question N")
   b. Read the question text (verify it is non-empty)
   c. Click one answer choice (cycle through A, B, C, D across questions)
   d. Verify the selected answer highlights
   e. Click "Next" to proceed
3. After answering Q14, click "Next"
4. On Q15 (the last question in section 1), verify:
   - The "Next" button is replaced by a "Review" button (with `bg-brand-primary text-white` and text "Review ->")
5. Click "Review" button
6. Verify the Review Screen loads

**Expected Results:**
- All 15 MCQ questions can be answered sequentially
- The last question shows "Review" instead of "Next"
- Each question displays unique content

**Acceptance Criteria:**
- PASS: All 15 questions answered, "Review" button appears on last question
- FAIL: Missing questions, "Next" still shown on last question, or navigation breaks

**Capture:** Screenshot showing "Review" button on Q15

**Criteria Audit References:** 2.1 (MCQ), 7.4 (navigation - "Next" to "Review"), 1.6 (section locking)

---

### S-09: MCQ Multi-Select Question (if present in seed data)

**Preconditions:** A question of type MCQ_MULTI exists in the test. If the seed data does not include MCQ_MULTI in the standard tests, this scenario should document that and skip.

**Steps:**
1. Navigate to an MCQ_MULTI question (check for "Select all that apply" text below the question)
2. Verify each answer choice shows a checkbox indicator (`w-5 h-5 rounded` border element) instead of just the letter badge
3. Click choice A
4. Verify choice A is selected (brand primary background) and its checkbox shows a checkmark SVG
5. Click choice C
6. Verify BOTH A and C are now selected (both have brand primary background)
7. Click choice A again to deselect it
8. Verify only C remains selected
9. Click choices B and D
10. Verify C, B, and D are all selected simultaneously
11. Navigate away and back
12. Verify the multi-selection (B, C, D) persists

**Expected Results:**
- Checkboxes render for MCQ_MULTI
- Multiple selections allowed simultaneously
- Toggling deselects individual choices
- Selections persist through navigation

**Acceptance Criteria:**
- PASS: Multi-select behavior works correctly with checkboxes
- FAIL: Only single selection allowed, checkboxes missing, or selections lost
- SKIP: If no MCQ_MULTI questions exist in seed data, document this finding

**Capture:** Screenshot showing multiple selected answers with checkboxes

**Criteria Audit References:** 2.2 (MCQ_MULTI), 4.3 (partial credit scoring)

---

### S-10: Review Screen Before Section Submit

**Preconditions:** All 15 MCQ questions answered in Section 1. At least Q2 flagged. Navigated to Review Screen.

**Steps:**
1. Verify the Review Screen heading: "Review Your Answers"
2. Verify the question grid shows 15 question boxes:
   - All boxes have `bg-brand-primary` (all answered)
   - Flagged questions show flag emoji
3. Verify the Summary section (`bg-muted` div) shows:
   - "Answered: 15/15"
   - "Flagged: 1 (Q2)" or similar text listing flagged question numbers
   - No "Unanswered" line (since all are answered) or shows "Unanswered: 0"
4. Verify the legend shows: Answered, Unanswered, Flagged, Annotated indicators
5. Verify two action buttons are present:
   - "Return to Questions" button (border style)
   - "Submit Section" or "Submit Test" button (brand primary style)
   - Since this is Section 1 of 2, it should say "Submit Section" (not "Submit Test")
6. Click on a question box (e.g., Q5) in the review grid
7. Verify navigation back to Q5 in the testing view
8. Navigate back to the review screen (use "Review" button on last question or navigator)
9. Verify the review state is maintained

**Expected Results:**
- Review screen accurately summarizes all answers
- Flagged questions listed by number
- "Submit Section" shown for non-final sections
- Clicking a question box returns to that question

**Acceptance Criteria:**
- PASS: Summary counts correct, flagged list correct, navigation to questions works
- FAIL: Counts wrong, flagged not listed, or "Submit Test" shown for non-final section

**Capture:** Screenshot of full review screen with summary

**Criteria Audit References:** 7.5 (review screen), 1.2 (flagged questions in review)

---

### S-11: Submit Section 1 and Transition to Section 2 (FRQ)

**Preconditions:** On Review Screen for Section 1, all questions answered.

**Steps:**
1. Click "Submit Section" button
2. Wait for section submission to complete
3. Observe the transition to Section 2:
   - The header should now show "Section 2 of 2" with the FRQ section title
   - The timer should reset or show the Section 2 time limit
4. Since this is an FRQ section, verify the FRQ Choice Screen appears:
   - Heading: "Free Response Section"
   - Description: "Choose how you'd like to complete your free response answers:"
   - Two option cards:
     a. "Type Your Answers" card (with keyboard emoji, description about text boxes)
     b. "Write by Hand" card (with writing emoji, description about download/scan/upload)
   - Timer display at the bottom
5. Click "Type Your Answers" option
6. Verify the test interface loads with FRQ content:
   - Question display should show an FRQ question with sub-question labels like "(a)", "(b)", "(c)"
   - A textarea should appear (the `FRQTextInput` component)
   - The textarea placeholder should read "Type your response here..."
   - Character count should show at the bottom (e.g., "0 / 10,000 characters")

**Expected Results:**
- Section transition happens cleanly
- FRQ choice screen appears with both options
- Selecting "Type" loads FRQ text input interface
- Timer shows Section 2 time

**Acceptance Criteria:**
- PASS: Section submits, FRQ choice appears, typed mode loads correctly
- FAIL: Submission fails, no FRQ choice screen, or FRQ interface broken

**Capture:** Screenshot of FRQ choice screen, screenshot of FRQ typing interface

**Criteria Audit References:** 1.6 (section locking/transition), 2.3 (FRQ), 8.1 (FRQ mode info)

---

### S-12: FRQ Answer Entry and Sub-Question Navigation

**Preconditions:** In Section 2 (FRQ), "Type Your Answers" selected. Viewing first FRQ question.

**Steps:**
1. Verify the FRQ question displays:
   - Question text (from `FRQQuestionDisplay` component)
   - Sub-question label "(a)" with its prompt text
   - Points indicator (e.g., "(3 points)")
2. Click into the textarea and type: "Supply and demand equilibrium occurs when the quantity supplied equals the quantity demanded at a given price level."
3. Verify the character count updates (e.g., "120 / 10,000 characters")
4. Verify the textarea auto-resizes as text is entered
5. Check the navigation: the flat navigation items should show sub-question labels (e.g., "1a", "1b", "1c", "2a", "2b") in the bottom nav
6. The center text should show something like "Question 1 of 5" (for 5 sub-questions total)
7. Click "Next" to navigate to sub-question (b)
8. Verify the sub-question label changes to "(b)" with a new prompt
9. Type an answer for sub-question (b): "The price mechanism acts as a rationing device in free markets."
10. Click "Next" to navigate through all remaining sub-questions, typing brief answers for each
11. Navigate back to sub-question (a)
12. Verify the previously typed text "Supply and demand equilibrium occurs..." is still present

**Expected Results:**
- FRQ sub-questions display with labels and prompts
- Textarea accepts input and shows character count
- Navigation works through sub-questions using "Next"/"Back"
- Answers persist when navigating between sub-questions

**Acceptance Criteria:**
- PASS: All sub-questions accessible, text persists, navigation works
- FAIL: Text lost on navigation, sub-questions missing, or character count wrong

**Capture:** Screenshot of FRQ with typed answer and character count

**Criteria Audit References:** 2.3 (FRQ), 2.3.2 (FRQTextInput), 7.4 (navigation with flat indexing)

---

### S-13: Submit Final Section and View Report Card

**Preconditions:** All FRQ sub-questions answered in Section 2. This is the final section.

**Steps:**
1. Navigate to the last sub-question in Section 2
2. Verify the "Review" button appears (since it is the last nav item)
3. Click "Review"
4. On the review screen, verify:
   - Button text is "Submit Test" (not "Submit Section") since this is the final section
   - Summary shows answered/unanswered counts for FRQ sub-questions
5. Click "Submit Test"
6. Observe the `SubmitProgressModal`:
   - "Submitting Test" heading
   - "Syncing your answers..." text
   - Queue count display (if items pending)
   - Spinner animation
7. Wait for submission to complete
8. Verify navigation to the Report Card page (`/ap/results/:resultId`)
9. On the Report Card, verify:
   - "SCORE REPORT" heading
   - Student name and test title displayed
   - Subject name shown
   - Date shown
   - AP Score badge (may show "Pending" hourglass if FRQ grading needed)
   - Grading status banner: "Free Response section is awaiting teacher grading..." (if test has FRQ)
   - Section score bars with percentages
   - MCQ Results table with columns: Q#, Domain, Topic, Correct answer, Your Answer, Result (check/X)
   - "Performance by Domain" section with progress bars
   - FRQ section showing "Awaiting Grade" badge and submitted answers
   - Action buttons: "Back to Dashboard" and "Download PDF"

**Expected Results:**
- Submit modal appears during submission
- Navigation to report card after successful submission
- Report card shows all expected sections
- AP score may be pending if FRQ needs grading
- MCQ results table correctly shows answers and correctness

**Acceptance Criteria:**
- PASS: Submission succeeds, report card renders with all sections, MCQ correctness indicators shown
- FAIL: Submission fails/hangs, report card missing sections, or navigation broken

**Capture:** Full-page screenshots of report card (may need multiple due to length), screenshot of submit modal

**Criteria Audit References:** 5.8 (submit flow), 9.1-9.4 (report card), 4.1 (scoring), 7.5 (review screen)

---

### S-14: Report Card MCQ Results Verification

**Preconditions:** Viewing report card from the just-completed test.

**Steps:**
1. Scroll to the "Section 1: Multiple Choice Results" section
2. Verify the table has columns: Q#, Domain, Topic, Correct, Your Answer, Result
3. For each row, verify:
   - Q# increments from 1 to 15
   - Domain column shows a domain string (e.g., "Unit 1: Basic Economic Concepts") or a dash
   - Topic column shows a topic string or a dash
   - Correct column shows the correct answer letter(s)
   - Your Answer column shows the answer you selected
   - Result column shows green checkmark (correct) or red X (incorrect)
4. Verify the MCQ summary line below the table: "MCQ Summary: X/15 correct (Y%)"
5. If "Performance by Domain" section exists:
   - Verify it shows domain names with progress bars
   - Verify percentage labels are shown
   - Verify color coding: green for >=70%, yellow for >=50%, red for <50%

**Expected Results:**
- All 15 MCQ results displayed with correct metadata
- Domain and Topic columns populated from seed data
- Correct/incorrect indicators match actual answers

**Acceptance Criteria:**
- PASS: All columns populated, correctness indicators accurate, domain performance shown
- FAIL: Missing columns, wrong correctness, or domain data absent

**Capture:** Screenshot of MCQ results table, screenshot of domain performance section

**Criteria Audit References:** 9.1 (report card - MCQ results), 9.2 (domain/topic columns), 4.1 (score calculation)

---

### S-15: Report Card - Flagged Questions Display

**Preconditions:** Viewing report card. Question 2 was flagged during the test.

**Steps:**
1. Scroll to find the "Flagged for Review" section
2. Verify:
   - Heading says "Flagged for Review"
   - Text says "You flagged X question(s) during the test:"
   - Flagged question badges appear (e.g., "Q2")
   - Each badge shows a correct/incorrect indicator (checkmark or X) with color coding:
     - Green border/background if the flagged question was answered correctly
     - Red border/background if incorrect
     - Gray if the question is FRQ (not yet graded)

**Expected Results:**
- Flagged questions section appears with correct count
- Each flagged question shows its correctness status

**Acceptance Criteria:**
- PASS: Flagged section present with correct question numbers and indicators
- FAIL: Section missing, wrong question numbers, or no indicators

**Capture:** Screenshot of flagged questions section

**Criteria Audit References:** 9.3 (report card - flagged questions)

---

### S-16: Report Card FRQ Section - Pending Grading

**Preconditions:** Viewing report card for a test with FRQ. FRQ not yet graded.

**Steps:**
1. Scroll to the "Section 2: Free Response" section
2. Verify the "Awaiting Grade" badge is shown (hourglass icon with warning styling)
3. Verify "Your Submitted Answers" sub-heading appears
4. For each FRQ question submitted, verify:
   - "Question N" heading
   - Sub-question labels "(a)", "(b)", etc.
   - The typed answer text is displayed in a `bg-muted` box
   - Empty sub-questions show "No response" in italic
5. Verify the points display at the bottom: "Raw Points: --/X (pending)"
6. Verify the main AP Score badge at the top shows the pending state (hourglass icon, "Pending" text)

**Expected Results:**
- FRQ answers are displayed read-only
- Grading status correctly shows pending
- AP score reflects ungraded status

**Acceptance Criteria:**
- PASS: Submitted answers visible, pending status shown, AP score pending
- FAIL: Answers not shown, grading status wrong, or AP score prematurely calculated

**Capture:** Screenshot of FRQ pending section

**Criteria Audit References:** 9.4 (report card - FRQ), 8.1 (FRQ grading status)

---

### S-17: Download Report PDF

**Preconditions:** Viewing a report card.

**Steps:**
1. Locate the "Download PDF" button at the bottom of the report card
2. Click the button
3. Verify a PDF file begins downloading (monitor the browser download event)
4. If possible, verify the PDF filename contains relevant info

**Expected Results:**
- PDF download initiates without errors
- No console errors during PDF generation

**Acceptance Criteria:**
- PASS: PDF downloads successfully
- FAIL: Button missing, download fails, or console error

**Capture:** Console log during PDF generation, screenshot of download button

**Criteria Audit References:** 9.1 (report card PDF download), 18 (PDF generation utilities)

---

### S-18: Return to Dashboard After Test Completion

**Preconditions:** Viewing report card.

**Steps:**
1. Click the "Back to Dashboard" link at the bottom of the report card
2. Verify navigation to `/ap`
3. Verify the test card for the completed test now shows:
   - Status badge: "Completed" with `bg-success text-success-text` styling
4. Verify the test card is still clickable

**Expected Results:**
- Dashboard loads with updated status
- Completed test shows green "Completed" badge

**Acceptance Criteria:**
- PASS: Navigation works, status updated to Completed
- FAIL: Status still shows "Not Started" or navigation fails

**Capture:** Screenshot of dashboard with completed test card

**Criteria Audit References:** 1.9 (dashboard status), 20.1 (phase verification)

---

### S-19: Take a Second Test (AP Macro) - Abbreviated Flow

**Preconditions:** Dashboard loaded, AP Macro test not yet taken.

**Steps:**
1. Click on the "AP Macroeconomics Practice Exam" test card
2. Verify instruction screen shows correct test details (title, subject, sections)
3. Click "Begin Test"
4. Answer questions Q1 through Q5 quickly (select option A for all)
5. Flag Q3 and Q4
6. Open the question navigator, verify Q1-Q5 are answered (brand primary) and Q3/Q4 are flagged
7. Navigate to Q15 directly via the navigator grid
8. Answer Q15 with option D
9. Use "Review" button to go to review screen
10. Verify summary shows "Answered: 6/15", "Unanswered: 9 (Q6, Q7, Q8, Q9, Q10, Q11, Q12, Q13, Q14)"
11. Verify the unanswered warning appears: yellow `bg-warning` box with count
12. Click "Submit Section" (intentionally submitting with unanswered questions)
13. Complete FRQ section (type brief answers, submit test)
14. Verify report card shows correct answered/unanswered for MCQ section

**Expected Results:**
- Second test flows correctly end-to-end
- Unanswered questions are tracked and displayed
- Partial completion is allowed
- Report card reflects which questions were left unanswered

**Acceptance Criteria:**
- PASS: Complete flow works, unanswered tracking correct
- FAIL: Any step fails or unanswered questions not tracked

**Capture:** Screenshot of review screen with unanswered warning, report card showing unanswered

**Criteria Audit References:** 1.9 (dashboard), 7.5 (review screen - unanswered warning)

---

### S-20: Hamburger Menu - Go to Question and Exit Test

**Preconditions:** Test session active (start a new test or use existing session).

**Steps:**
1. Click the hamburger menu button in the test header (3-line SVG icon with `aria-label="Open menu"`)
2. Verify the slide-up menu appears with:
   - "Menu" heading
   - Close button ("x")
   - "Go to Question..." button (with "Q" icon)
   - "Exit Test" button (in error/red text color)
3. Click "Go to Question..."
4. Verify the Question Navigator modal opens (the menu closes first)
5. Close the navigator
6. Reopen the hamburger menu
7. Click "Exit Test"
8. Verify the confirmation dialog appears:
   - "Exit Test?" heading
   - "Are you sure you want to exit? Your progress will be saved." message
   - "Cancel" and "Exit Test" buttons
9. Click "Cancel"
10. Verify the menu closes and test session continues
11. Reopen menu, click "Exit Test" again, then click the red "Exit Test" confirmation button
12. Verify navigation to the dashboard (`/ap`)

**Expected Results:**
- Menu opens and closes correctly
- "Go to Question" opens navigator
- "Exit Test" shows confirmation before exiting
- Cancel keeps the session active
- Confirming exit navigates to dashboard

**Acceptance Criteria:**
- PASS: All menu interactions work as described
- FAIL: Menu doesn't open, no confirmation on exit, or exit fails

**Capture:** Screenshot of menu, screenshot of exit confirmation

**Criteria Audit References:** 1.10 (page states - menu), 7.3 (header UI)

---

### S-21: Session Resume After Page Refresh

**Preconditions:** Start a new test or use an existing in-progress session.

**Steps:**
1. Start a test and answer Q1 (select option B), Q2 (select option A)
2. Flag Q1
3. Note the timer value (e.g., "58:30")
4. Refresh the browser page (F5 / Ctrl+R)
5. Wait for the page to reload at the same URL
6. Observe the behavior:
   - The instruction screen may appear briefly, then auto-transition to testing (if session status is IN_PROGRESS)
   - OR the instruction screen shows "Resume Test" button (instead of "Begin Test")
7. If "Resume Test" appears:
   - Verify the resume info box: "Resume from: Section 1, Question X"
   - Click "Resume Test"
8. Verify the test session resumes:
   - Timer resumes at approximately the same value (minus elapsed time)
   - Navigate to Q1: verify option B is still selected
   - Navigate to Q2: verify option A is still selected
   - Verify Q1 is still flagged (check flag button shows "Flagged" state)

**Expected Results:**
- Session persists across page refresh
- Answers, flags, and timer state are restored
- Resume flow works correctly

**Acceptance Criteria:**
- PASS: All state (answers, flags, timer) restored after refresh
- FAIL: Answers lost, flags reset, timer restarted from full, or session not detected

**Capture:** Screenshot before refresh (noting timer), screenshot after resume showing restored state

**Criteria Audit References:** 1.7 (session persistence), 5.9 (session resume), 1.1 (timer persistence)

---

### S-22: Annotation Tools - Highlighter (if question has text stimulus)

**Preconditions:** Test session active on a question with a text stimulus (HORIZONTAL layout with passage). This requires a question in the seed data with a stimulus. If no such questions exist in Section 1, check Section 2 or note the finding.

**Steps:**
1. Navigate to a question that has a text stimulus (two-column layout with passage on left)
2. Verify the ToolsToolbar appears above the passage:
   - "Highlight" button with a colored square and dropdown arrow
   - "Reader" button with book emoji
   - "Clear" button with trash emoji
3. Click the "Highlight" button dropdown arrow
4. Verify a color picker appears with color swatches
5. Select the yellow color (default)
6. Select text within the passage by clicking and dragging
7. Verify the selected text becomes highlighted with a yellow background
8. Select different text and highlight it
9. Verify both highlights persist
10. Navigate to another question and back
11. Verify highlights are still visible on the passage

**Expected Results:**
- Highlight tool activates color picker
- Text selection creates visible highlights
- Multiple highlights can coexist
- Highlights persist through navigation

**Acceptance Criteria:**
- PASS: Highlighting works with persistence
- FAIL: No text stimulus questions exist (document finding), highlighting not functional, or highlights lost
- SKIP: If no HORIZONTAL format questions with text stimuli in seed data

**Capture:** Screenshot of highlighted passage text, screenshot of tools toolbar

**Criteria Audit References:** 1.3 (highlighter), 1.12 (ToolsToolbar), 7.2 (question display)

---

### S-23: Annotation Tools - Line Reader

**Preconditions:** On a question with text stimulus and annotation tools visible.

**Steps:**
1. Click the "Reader" button (book emoji) in the ToolsToolbar
2. Verify the button changes to active state (`bg-brand-primary text-white`)
3. Verify a line reader overlay appears on the passage (dimmed areas above and below a visible window)
4. Verify a dropdown appears next to the Reader button to select visible lines (1, 2, or 3)
5. Verify the hint text appears: "Use arrow keys to navigate"
6. Change the visible lines from 2 to 1 using the dropdown
7. Verify the visible window narrows
8. Click the Reader button again to toggle off
9. Verify the overlay disappears and the button returns to inactive state

**Expected Results:**
- Line reader overlay renders over the passage
- Line count selector works
- Toggle on/off functions correctly

**Acceptance Criteria:**
- PASS: Line reader activates, line count changes, toggle works
- FAIL: Overlay doesn't appear, line count doesn't change, or toggle broken
- SKIP: If no text stimulus questions available

**Capture:** Screenshot of line reader overlay on passage

**Criteria Audit References:** 1.5 (line reader), 1.12 (ToolsToolbar)

---

### S-24: Timer Warning Colors

**Preconditions:** Test session active with timer running.

**Steps:**
1. Observe the timer display in the header
2. When timer is above 5 minutes: verify `text-text-primary` class (default color)
3. If possible (via DevTools or waiting), observe the timer when it reaches:
   - Below 5 minutes (300 seconds): verify `text-warning-text` class (yellow/warning color)
   - Below 1 minute (60 seconds): verify `text-error-text` class (red/error color)
4. Verify the timer format is always `MM:SS` (font-mono class)
5. Verify the clock emoji is present next to the time

**Expected Results:**
- Timer changes color at 5-minute and 1-minute thresholds
- Format remains consistent

**Acceptance Criteria:**
- PASS: Color transitions observed at correct thresholds
- PARTIAL: Only verified at one threshold due to time constraints (document which)
- FAIL: Timer doesn't change color or shows wrong format

**Capture:** Screenshots at each timer threshold if possible

**Criteria Audit References:** 1.1 (timed sections - timer display), 7.3 (header)

---

### S-25: Section Lock Indicator

**Preconditions:** Test session active in Section 2 (after completing Section 1).

**Steps:**
1. Verify the section header shows "Section 2 of 2: [FRQ section title]"
2. Verify the lock indicator appears next to the hamburger menu:
   - A lock SVG icon (`fill="currentColor" viewBox="0 0 20 20"`)
   - "Locked" text (visible on larger screens, `hidden sm:inline` class)
   - The indicator has `text-text-muted` styling
   - Title attribute: "Previous sections are locked"
3. Verify that navigation (Back button, question navigator) does NOT allow going back to Section 1 questions
4. The "Back" button should be disabled on the first question of Section 2

**Expected Results:**
- Lock icon visible when in section 2+
- Cannot navigate back to Section 1
- Visual indicator clearly shows previous sections locked

**Acceptance Criteria:**
- PASS: Lock indicator present, back-navigation blocked
- FAIL: No lock indicator, or back-navigation to Section 1 is possible

**Capture:** Screenshot of header showing lock indicator

**Criteria Audit References:** 1.6 (section locking), 7.3 (header)

---

### S-26: AP Calculus Test with LaTeX Rendering

**Preconditions:** Seed data loaded. No active session for AP Calc AB test.

**Steps:**
1. Navigate to `/ap` dashboard
2. Click on "AP Calculus AB Practice Exam" test card
3. Click "Begin Test"
4. Navigate through questions and look for LaTeX-rendered math:
   - Inline math (e.g., `$f(x)$`) should render as formatted equations
   - Display math (e.g., `$$\int_0^1 f(x)\,dx$$`) should render centered
5. Verify MathJax rendering is working:
   - Math content appears as formatted equations (not raw LaTeX source like `$...$`)
   - Fractions, integrals, superscripts render correctly
6. Check that LaTeX also renders in answer choices (if choices contain math)
7. Answer a few questions and submit to verify the full flow works with math content

**Expected Results:**
- LaTeX renders as formatted mathematical expressions
- No raw `$...$` delimiters visible to the user
- MathJax loading doesn't break the test flow

**Acceptance Criteria:**
- PASS: LaTeX renders correctly in question text and choices
- FAIL: Raw LaTeX shown, rendering errors, or MathJax not loaded

**Capture:** Screenshot of math-rendered question, screenshot of math-rendered choices

**Criteria Audit References:** 2.1 (MCQ display), 7.2 (question display with MathText)

---

### S-27: Duplicate Tab Detection

**Preconditions:** Test session active in one browser tab.

**Steps:**
1. Start a test session in Tab 1, answer a few questions
2. Open a new browser tab (Tab 2) and navigate to the same test URL
3. Observe Tab 2 behavior:
   - The DuplicateTabModal should appear with:
     - Warning icon (yellow circle with triangle)
     - "Session Active Elsewhere" heading
     - "This test is already open in another browser tab." message
     - "Go to Dashboard" button
     - "Use This Tab" button
4. Click "Go to Dashboard" in Tab 2
5. Verify Tab 2 navigates to `/ap`
6. Open Tab 2 to the test URL again
7. In the DuplicateTabModal, click "Use This Tab"
8. Verify Tab 2 takes control of the session
9. Check Tab 1: it should now show the DuplicateTabModal (session invalidated)

**Expected Results:**
- Duplicate tab is detected via BroadcastChannel or Firestore token
- Modal prevents simultaneous editing
- "Use This Tab" transfers control
- Previous tab becomes invalidated

**Acceptance Criteria:**
- PASS: Detection works, modal appears, takeover succeeds
- FAIL: No detection, modal missing, or both tabs remain active

**Capture:** Screenshot of DuplicateTabModal in Tab 2, screenshot of invalidated Tab 1

**Criteria Audit References:** 5.5 (duplicate tab guard), 7.7 (duplicate tab modal)

---

### S-28: Connection Status Banner

**Preconditions:** Test session active.

**Steps:**
1. Verify no connection banner is shown when connection is stable (return value is `null` from ConnectionStatus)
2. Using browser DevTools, go to Network tab and set throttling to "Offline"
3. Wait for the heartbeat to detect disconnection (up to 45 seconds = 3 failed heartbeats at 15s interval)
4. Verify the disconnected banner appears:
   - Yellow `bg-warning` background
   - Warning icon
   - Text: "Connection unstable - your progress is being saved locally"
5. Set network back to Online
6. Wait for heartbeat to succeed
7. Verify the syncing banner briefly appears:
   - Blue `bg-info` background
   - Spinner animation
   - Text: "Syncing your progress..."
8. After sync completes, verify the reconnected banner:
   - Green `bg-success` background
   - Text: "Reconnected"
9. Wait 2 seconds and verify the reconnected banner auto-dismisses

**Expected Results:**
- Disconnected state shown after heartbeat failures
- Syncing state shown during reconnection
- Reconnected banner auto-dismisses after 2 seconds
- Answers entered while offline are preserved

**Acceptance Criteria:**
- PASS: All three banner states observed with correct auto-dismiss
- FAIL: Banner missing, wrong state, or doesn't auto-dismiss

**Capture:** Screenshots of disconnected, syncing, and reconnected banners

**Criteria Audit References:** 5.4 (heartbeat), 5.11 (data loss protection), 7.6 (connection status), 7.1 (reconnect auto-dismiss)

---

### S-29: View Existing Seed Results on Report Card

**Preconditions:** Seed data includes 13 test results with varied scores.

**Steps:**
1. If logged in as a seeded student account (e.g., `student_seed_001`), navigate to `/ap`
2. Click on a test card that has "Completed" status
3. The instruction screen or a result selection should appear
4. Navigate to a result URL directly: `/ap/results/{result_id}` (using a known seed result ID)
5. Verify the report card loads with:
   - AP Score badge showing a numeric score (1-5) with color coding
   - MCQ results table populated
   - Score percentages and section breakdowns
   - "Back to Dashboard" and "Download PDF" buttons
6. Verify different AP score colors:
   - Score 5: green (`bg-success`)
   - Score 4: blue (`bg-info`)
   - Score 3: yellow (`bg-warning`)
   - Score 2: light red (`bg-error-bg-subtle`)
   - Score 1: red (`bg-error`)

**Expected Results:**
- Seed result renders correctly
- AP score badge shows appropriate color
- All sections populated from seed data

**Acceptance Criteria:**
- PASS: Report card renders with seed data
- FAIL: Report card fails to load or shows empty data
- SKIP: If cannot access seed result IDs directly

**Capture:** Screenshot of seed result report card

**Criteria Audit References:** 9.1 (report card), 4.4 (AP score display)

---

## TRACK 2: TEACHER EXPERIENCE AUDIT

---

### T-01: Teacher Dashboard Load

**Preconditions:** Logged in as a teacher account. Seed data has been run.

**Steps:**
1. Navigate to `http://localhost:5173/ap/teacher`
2. Wait for loading skeleton to disappear
3. Verify the page heading: "Teacher Dashboard"
4. Verify Quick Action buttons:
   - "Create New Test" (with "+" icon, brand primary style, links to `/ap/teacher/test/new`)
   - "Question Bank" (with "Q" icon, links to `/ap/teacher/questions`)
   - "Gradebook" (with "G" icon, links to `/ap/gradebook`)
   - "Manage Classes" (with "C" icon, links to `/ap/teacher/classes`)
5. Verify "My Tests" section:
   - Shows test count: "My Tests (3)" or similar
   - Up to 4 test cards displayed
   - Each card shows: title, question summary (e.g., "15 MCQ, 2 FRQ"), "Edit" link, "Assign" button
   - "View All" link present
6. Verify "Pending Grading" section in sidebar:
   - Shows count in heading: "Pending Grading (X)"
   - Lists submissions needing grading (e.g., "X submissions for AP Micro...")
   - "Go to Gradebook" link
7. Verify "My Classes" section in sidebar:
   - Shows class count: "My Classes (2)"
   - Lists class names with student counts (e.g., "AP Economics Period 1 - 5 students")

**Expected Results:**
- All dashboard sections render with seed data
- Quick action buttons link to correct routes
- Test cards show accurate question counts

**Acceptance Criteria:**
- PASS: All sections render, counts accurate, links correct
- FAIL: Missing sections, wrong counts, or broken links

**Capture:** Full-page screenshot of teacher dashboard

**Criteria Audit References:** 11.1 (teacher dashboard), 20.1 (phase verification)

---

### T-02: Teacher Route Protection

**Preconditions:** Logged in as a student account (non-teacher role).

**Steps:**
1. Navigate directly to `http://localhost:5173/ap/teacher`
2. Verify the page redirects to `/ap` (student dashboard) or shows an access denied message
3. Try navigating to `http://localhost:5173/ap/teacher/test/new`
4. Verify the same redirect/block behavior
5. Try navigating to `http://localhost:5173/ap/gradebook`
6. Verify the same redirect/block behavior

**Expected Results:**
- All teacher routes are inaccessible to student accounts
- Student is redirected to their dashboard

**Acceptance Criteria:**
- PASS: All teacher routes redirect or block non-teacher users
- FAIL: Any teacher route is accessible by a student
- SKIP: If no separate student Auth account available, document finding

**Capture:** Screenshots or console logs showing redirect behavior

**Criteria Audit References:** 12.1 (role-based route protection), 13.1 (TeacherRoute guard)

---

### T-03: Gradebook - View Pending Submissions

**Preconditions:** Logged in as teacher. Seed data includes pending FRQ results.

**Steps:**
1. Navigate to `http://localhost:5173/ap/gradebook`
2. Wait for the page to load
3. Verify the page heading: "Gradebook"
4. Verify the subtitle: "Review and grade student FRQ submissions"
5. Verify the filter bar contains three dropdowns:
   - "Status:" with options: Pending, In Progress, Complete, All
   - "Test:" with options: All Tests, [individual test names]
   - "Class:" with options: All Classes, [individual class names]
6. Verify the default Status filter is "Pending"
7. Verify the results table contains columns:
   - Student (name)
   - Test (title)
   - Submitted (date)
   - Status (badge)
   - Action (Grade/View button)
8. Verify at least one row appears with:
   - Student name (e.g., "Alex Johnson")
   - Test title
   - Date string
   - Status badge showing "Pending" (hourglass icon, warning styling)
   - "Grade" button (brand primary style)
9. Verify the submission count at the bottom: "Showing X submissions"

**Expected Results:**
- Gradebook loads with filtered pending results
- Filter dropdowns populated from seed data
- Table displays student submissions correctly

**Acceptance Criteria:**
- PASS: Table renders with pending submissions, filters populated
- FAIL: Empty table, missing filters, or wrong data

**Capture:** Screenshot of gradebook with pending submissions

**Criteria Audit References:** 11.3 (gradebook), 8.2 (grading workflow), 11.4 (gradebook real-time)

---

### T-04: Gradebook - Filter by Test and Status

**Preconditions:** On the Gradebook page with seed data.

**Steps:**
1. Note the current count of submissions shown
2. Change the "Status" filter to "All"
3. Wait for the table to update (real-time via onSnapshot)
4. Verify the submission count changes (should show more or equal results)
5. Verify rows with "Complete" status now also appear (green check badge)
6. Change the "Test" filter to select a specific test (e.g., "AP Microeconomics Practice Exam")
7. Verify only submissions for that test are shown
8. Change the "Class" filter to select a specific class
9. Verify results are further filtered
10. Reset all filters to their defaults (Status: Pending, Test: All Tests, Class: All Classes)

**Expected Results:**
- Filters dynamically update the results table
- Status filter changes which grading statuses are shown
- Test and Class filters narrow results correctly
- Real-time updates (onSnapshot) refresh the table without page reload

**Acceptance Criteria:**
- PASS: All three filters work correctly and can be combined
- FAIL: Filters don't update results, or incorrect filtering

**Capture:** Screenshots at each filter state

**Criteria Audit References:** 11.3 (gradebook filters), 11.4 (real-time gradebook)

---

### T-05: Grade FRQ Submission via Grading Panel

**Preconditions:** On Gradebook page with at least one "Pending" submission.

**Steps:**
1. Find a row with "Pending" status and click the "Grade" button
2. Verify the GradingPanel slides in from the right:
   - Panel header shows "Grading: [Student Name]" and test title
   - Close button (X) in top right
3. Verify the score summary bar: "Total FRQ Score: 0 / X"
4. For each FRQ question in the panel:
   - Verify the question text is shown (truncated with "...")
   - For each sub-question:
     a. Verify sub-question label "(a)", "(b)", etc.
     b. Verify the prompt text is shown
     c. Verify "Student Response:" section shows the student's typed answer in a `bg-muted` box
     d. Locate the score input (number input with `/ X pts` label)
     e. Enter a score (e.g., 2 out of 3 for part a, 3 out of 3 for part b)
     f. Verify the question total updates (e.g., "5 / 6 pts")
   - Locate the "Feedback (optional)" textarea
   - Type feedback: "Good analysis of supply and demand. Consider including more examples."
5. Verify the total score in the summary bar updated
6. Click "Save Draft"
7. Wait for save to complete (button shows "Saving..." then reverts)
8. Close the panel (click X or backdrop)
9. Verify the row in the gradebook table now shows "In Progress" status

**Expected Results:**
- Grading panel opens with student answers
- Score inputs accept values within range
- Feedback textarea works
- Save Draft persists scores and changes status to In Progress
- Panel closes cleanly

**Acceptance Criteria:**
- PASS: All grading interactions work, draft saves, status updates
- FAIL: Panel doesn't open, scores not saved, or status doesn't update

**Capture:** Screenshot of grading panel with scores entered, screenshot of updated gradebook row

**Criteria Audit References:** 8.2 (grading panel), 8.3 (FRQ sub-question scoring), 8.4 (grading workflow)

---

### T-06: Complete FRQ Grading - Mark Complete

**Preconditions:** A submission is in "In Progress" grading status from T-05.

**Steps:**
1. Find the "In Progress" row in the gradebook and click "Grade"
2. Verify the grading panel opens with previously saved scores (from the draft)
3. Verify the score inputs show the values entered in T-05
4. Adjust scores if needed
5. Click "Mark Complete"
6. Wait for save to complete
7. Verify the panel closes automatically (onClose called)
8. Verify the gradebook table updates:
   - The row now shows "Complete" status (green check badge)
   - The action button changes from "Grade" to "View"
9. Click "View" on the completed row
10. Verify the panel opens in view mode with the graded scores

**Expected Results:**
- Previously entered scores persist in draft
- Mark Complete changes grading status
- Completed submissions show "View" instead of "Grade"

**Acceptance Criteria:**
- PASS: Draft scores persist, completion works, status updates
- FAIL: Scores lost, completion fails, or status doesn't change

**Capture:** Screenshot of completed row in gradebook

**Criteria Audit References:** 8.4 (grading workflow - completion), 4.4 (FRQ scoring), 8.5 (score recalculation)

---

### T-07: Exam Analytics Page

**Preconditions:** Logged in as teacher. Seed data includes test results.

**Steps:**
1. From the teacher dashboard, find a test card and click "Edit"
2. Navigate to analytics: `http://localhost:5173/ap/teacher/analytics/{test_id}` (use a known test ID from seed data)
3. Wait for analytics to load
4. Verify the page heading: "Exam Analytics" with the test title below
5. Verify the action buttons in header area:
   - "Export Questions PDF" button
   - "Export with Answers" button
   - "Back" button
6. Verify Summary Stats cards (4 cards in a grid):
   - "Total Students" with a count
   - "Average Score" with percentage and points
   - "Highest Score" with points
   - "Lowest Score" with points
7. Verify AP Score Distribution chart:
   - Shows scores 5, 4, 3, 2, 1 with horizontal bar charts
   - Each bar shows count and percentage
8. Verify MCQ Section:
   - "Section 1: Multiple Choice Performance" heading
   - Toggle buttons: "Grid" and "Detailed"
   - Default view shows the performance grid (MCQSquare components)
9. Click "Detailed" toggle
10. Verify the detailed view loads with per-question breakdowns
11. Click on a question in the grid/detailed view
12. Verify the QuestionDetailModal opens:
    - Question text displayed
    - Response distribution shown
    - Close button works
13. Verify Student Results table:
    - Shows student names with scores
    - Each row has a document icon for viewing the report

**Expected Results:**
- Analytics page loads with seed data
- All summary stats display correct values
- Grid and Detailed views toggle correctly
- Question detail modal works
- Student results table populated

**Acceptance Criteria:**
- PASS: All analytics sections render with data, interactions work
- FAIL: Missing sections, no data, or interactions broken

**Capture:** Full-page screenshots of analytics (multiple due to length), modal screenshot

**Criteria Audit References:** 10.1-10.9 (analytics), 11.2 (teacher workflow - analytics)

---

### T-08: Analytics - Student Profile Navigation

**Preconditions:** On the Exam Analytics page with Student Results table visible.

**Steps:**
1. Scroll to the "Student Results" table at the bottom of the analytics page
2. Verify student rows with names and scores
3. Click on a student name (or the row click handler)
4. Verify navigation to `/ap/teacher/student/{userId}`
5. Verify the APStudentProfile page loads with:
   - Student's name and email
   - Test history table showing past test attempts
   - Score trend bar chart (if multiple results exist)
   - Domain analysis showing strengths and weaknesses
6. Click back to return to analytics

**Expected Results:**
- Student profile page loads with seed data
- Test history and performance data displayed
- Navigation works both ways

**Acceptance Criteria:**
- PASS: Profile page renders with student data, all sections present
- FAIL: Navigation fails, profile empty, or page errors

**Capture:** Screenshot of student profile page

**Criteria Audit References:** 10.5 (student profile), 10.6 (performance trends), 10.7 (domain analysis)

---

### T-09: Analytics - Export PDFs

**Preconditions:** On the Exam Analytics page.

**Steps:**
1. Click "Export Questions PDF" button
2. Verify a PDF begins downloading (questions without answers)
3. Click "Export with Answers" button
4. Verify a second PDF begins downloading (questions with answers included)
5. Check console for any errors during PDF generation

**Expected Results:**
- Both PDF exports initiate without errors
- Downloads complete

**Acceptance Criteria:**
- PASS: Both PDFs download successfully
- FAIL: Download fails or console errors

**Capture:** Console log, download confirmation

**Criteria Audit References:** 10.1 (analytics PDF export), 18 (PDF utilities)

---

### T-10: Class Manager Page

**Preconditions:** Logged in as teacher. Seed data includes 2 classes.

**Steps:**
1. Navigate to `http://localhost:5173/ap/teacher/classes`
2. Wait for the page to load
3. Verify the page shows:
   - Page heading for class management
   - List of existing classes (2 from seed data)
   - Each class showing: name, period, student count
4. Click on a class to select it (e.g., "AP Economics Period 1")
5. Verify the student list loads:
   - Shows student names and emails from seed data (5 students)
6. Verify the "Create Class" form or button is present
7. Test creating a new class:
   - Enter class name: "AP Government Period 2"
   - Enter period: "2"
   - Select a subject
   - Click create/submit
8. Verify the new class appears in the class list
9. Verify student add functionality:
   - Find the student email input
   - Enter an email
   - Click add student
10. Verify student removal:
    - Find the remove button next to a student
    - Click remove
    - Verify the student is removed from the list

**Expected Results:**
- Class list shows seed data classes
- Class creation works
- Student add/remove functions correctly

**Acceptance Criteria:**
- PASS: All class management operations work
- FAIL: Classes don't load, creation fails, or student management broken

**Capture:** Screenshot of class list, screenshot of class detail with students

**Criteria Audit References:** 11.5 (class management), 12.1 (routes - /ap/teacher/classes)

---

### T-11: Teacher Dashboard - Seed Data Button

**Preconditions:** Logged in as teacher in development mode.

**Steps:**
1. Navigate to `/ap/teacher`
2. Scroll to the bottom of the page
3. Verify the "Developer Tools" section is visible (only in dev mode)
4. Verify the "Seed Full Test Data (Micro, Macro, Calc AB)" button is present
5. If data needs re-seeding, click the button
6. Verify the button shows "Seeding..." while processing
7. Verify the success message appears: "Seeded 3 tests, 51 questions, 5 students, 2 classes, 3 assignments, 13 results."
8. Verify the dashboard data refreshes (tests section updates)

**Expected Results:**
- Seed button visible in development
- Seeding completes successfully
- Dashboard refreshes with new data

**Acceptance Criteria:**
- PASS: Seed runs successfully, data appears on dashboard
- FAIL: Seed fails, button missing, or data doesn't refresh

**Capture:** Screenshot of seed success message

**Criteria Audit References:** 19 (seed data), 20.7 (phase verification)

---

### T-12: Test Editor - View Existing Test

**Preconditions:** Logged in as teacher. Seed data includes tests.

**Steps:**
1. From teacher dashboard, find a test card (e.g., "AP Microeconomics Practice Exam") and click "Edit"
2. Verify navigation to `/ap/teacher/test/{testId}/edit`
3. Verify the APTestEditor page loads with:
   - Test title input populated
   - Subject selection populated
   - Sections listed with question counts
   - Questions listed within each section
   - Each question showing: question text (truncated), type (MCQ/FRQ), difficulty
4. Verify question reorder buttons (up/down arrows) are present next to each question
5. Click the up arrow on the second question
6. Verify the question moves up in the list

**Expected Results:**
- Editor loads with existing test data
- All fields populated from Firestore
- Question reordering works

**Acceptance Criteria:**
- PASS: Editor loads correctly, reordering works
- FAIL: Editor fails to load, data missing, or reorder broken

**Capture:** Screenshot of test editor with sections and questions

**Criteria Audit References:** 11.1 (teacher workflow - test editor), 11.2 (question reordering)

---

### T-13: Test Editor - Create New Test

**Preconditions:** Logged in as teacher.

**Steps:**
1. Navigate to `http://localhost:5173/ap/teacher/test/new`
2. Verify the test editor loads in creation mode (empty form or new test)
3. Verify a test title input is present (empty or with placeholder)
4. Verify a subject dropdown/selector is present
5. Verify the ability to add sections
6. Take note of the URL (should contain a new test ID if auto-created)

**Expected Results:**
- New test editor loads without errors
- Route resolves correctly to APTestEditor component

**Acceptance Criteria:**
- PASS: Editor loads for new test creation
- FAIL: Route 404, editor errors, or creation fails

**Capture:** Screenshot of new test editor

**Criteria Audit References:** 12.1 (routes - /ap/teacher/test/new), 11.1 (teacher workflow)

---

### T-14: Question Bank Page

**Preconditions:** Logged in as teacher. Seed data includes 51 questions.

**Steps:**
1. Navigate to `http://localhost:5173/ap/teacher/questions`
2. Wait for the APQuestionBank page to load
3. Verify:
   - Questions listed from the seed data
   - Each question shows: question text, type (MCQ/FRQ), subject, difficulty
   - Search/filter functionality present
   - Ability to create new questions (link/button)
4. If filters exist, test filtering by subject or type
5. Click on a question to view/edit it
6. Verify navigation to `/ap/teacher/question/{questionId}/edit`

**Expected Results:**
- Question bank loads with seed data
- Filtering works
- Navigation to individual questions works

**Acceptance Criteria:**
- PASS: Questions listed, filters work, navigation works
- FAIL: Empty list, filters broken, or navigation fails

**Capture:** Screenshot of question bank

**Criteria Audit References:** 11.1 (teacher workflow - question bank), 12.1 (routes)

---

### T-15: Assign Test to Class

**Preconditions:** Logged in as teacher. At least one published test and one class exist.

**Steps:**
1. From the teacher dashboard, find a published test card and click the "Assign" button
2. Verify navigation to `/ap/teacher/test/{testId}/assign`
3. Verify the APAssignTest page loads with:
   - Test title shown
   - Class selection (list of teacher's classes)
   - Assignment options (due date, max attempts, etc.)
4. Select a class
5. Set assignment options if available
6. Submit the assignment
7. Verify success feedback

**Expected Results:**
- Assignment page loads with correct test and class data
- Assignment can be created
- Success feedback shown

**Acceptance Criteria:**
- PASS: Assignment flow completes successfully
- FAIL: Page doesn't load, classes not shown, or assignment fails

**Capture:** Screenshot of assignment page, screenshot of success feedback

**Criteria Audit References:** 11.1 (teacher workflow - assignment), 3.7 (ap_assignments)

---

## TRACK 3: ERROR HANDLING AND EDGE CASES

---

### E-01: Error State - Invalid Test ID

**Preconditions:** Logged in.

**Steps:**
1. Navigate to `http://localhost:5173/ap/test/nonexistent_test_id`
2. Wait for the error state to render
3. Verify:
   - "Error Loading Test" heading appears
   - Error message text explaining the issue
   - "Back to Dashboard" button present
4. Click "Back to Dashboard"
5. Verify navigation to `/ap`

**Expected Results:**
- Error state renders gracefully (no crash)
- Error message is user-friendly
- Recovery navigation works

**Acceptance Criteria:**
- PASS: Error state shown cleanly, recovery works
- FAIL: Page crashes, no error message, or recovery broken

**Capture:** Screenshot of error state

**Criteria Audit References:** 6.1 (error handling), 7.1 (page states)

---

### E-02: Error State - Invalid Result ID

**Preconditions:** Logged in.

**Steps:**
1. Navigate to `http://localhost:5173/ap/results/nonexistent_result_id`
2. Wait for the error state to render
3. Verify:
   - "Error Loading Results" heading appears
   - Error message: "Result not found" or similar
   - "Back to Dashboard" button present
4. Click "Back to Dashboard"
5. Verify navigation to `/ap`

**Expected Results:**
- Error state renders gracefully for invalid result
- Recovery navigation works

**Acceptance Criteria:**
- PASS: Error state shown cleanly with recovery option
- FAIL: Page crashes or no error message

**Capture:** Screenshot of error state

**Criteria Audit References:** 6.1 (error handling), 9.1 (report card error state)

---

### E-03: SubmitProgressModal - Timeout and Retry

**Preconditions:** Test session active with some answers.

**Steps:**
1. Go offline using DevTools (Network: Offline)
2. Click through to the review screen and click "Submit Test" (or "Submit Section")
3. Verify the SubmitProgressModal appears:
   - "Submitting Test" heading
   - Spinner animation
   - "Syncing your answers..." text
4. Wait for the 30-second timeout
5. Verify the modal transitions to timeout state:
   - Warning icon (yellow circle with "!")
   - "Unable to Sync" heading
   - "Your answers are saved locally." message
   - "Please check your internet connection and try again." text
   - "Keep Trying" button
6. Go back online using DevTools
7. Click "Keep Trying"
8. Verify the modal returns to syncing state and eventually completes

**Expected Results:**
- Submit modal shows progress during submission
- Timeout detected after 30 seconds
- "Keep Trying" retries the submission
- Answers are not lost

**Acceptance Criteria:**
- PASS: Timeout detected, retry works, submission eventually succeeds
- FAIL: No timeout detection, retry fails, or answers lost

**Capture:** Screenshots of syncing state, timeout state, and retry

**Criteria Audit References:** 5.8 (submit flow), 7.1 (submit progress modal), 6.1 (error handling)

---

### E-04: APErrorBoundary Crash Recovery

**Preconditions:** Test session page loaded.

**Steps:**
1. Verify the APTestSession is wrapped in `APErrorBoundary` (this is code-level verification)
2. If possible, trigger a JavaScript error (e.g., by corrupting local state via DevTools console)
3. Verify the ErrorFallback component renders:
   - Error message displayed
   - Recovery action available (reload or navigate away)
4. If cannot trigger error, document that error boundary exists as a safety net

**Expected Results:**
- Error boundary catches rendering errors
- Fallback UI shown instead of crash

**Acceptance Criteria:**
- PASS: Error boundary catches errors gracefully
- PARTIAL: Cannot trigger error but boundary exists in code
- FAIL: App crashes to white screen

**Capture:** Screenshot of error fallback if triggered

**Criteria Audit References:** 6.1 (error handling), 14.1 (code organization)

---

### E-05: Before Unload Warning

**Preconditions:** Test session active with IN_PROGRESS status.

**Steps:**
1. Start a test and answer at least one question
2. Attempt to close the browser tab or navigate away
3. Verify the browser's native "Leave site?" confirmation dialog appears
4. Click "Stay" (or cancel)
5. Verify the test session continues normally

**Expected Results:**
- beforeunload event triggers confirmation dialog
- Canceling keeps the session active

**Acceptance Criteria:**
- PASS: Confirmation dialog appears, session continues after cancel
- FAIL: No warning, or session breaks after cancel

**Capture:** Screenshot of browser leave-site dialog (if capturable by Playwright)

**Criteria Audit References:** 5.11 (data loss protection), 5.1 (beforeunload)

---

## TRACK 4: CROSS-CUTTING CONCERNS

---

### X-01: UI Design Token Compliance Spot Check

**Preconditions:** Various pages loaded.

**Steps:**
1. On the student dashboard, inspect the test cards:
   - Background: verify `bg-surface` (not `bg-white` or `bg-slate-*`)
   - Text: verify `text-text-primary` (not `text-gray-900`)
   - Border: verify `border-border-default` (not `border-gray-200`)
   - Radius: verify `rounded-[--radius-card]` (not `rounded-lg`)
2. On the test session header:
   - Background: verify `bg-surface`
   - Border: verify `border-border-default`
3. On the report card:
   - Success colors: verify `bg-success` / `text-success-text` (not `bg-green-*`)
   - Error colors: verify `bg-error` / `text-error-text` (not `bg-red-*`)
4. On buttons:
   - Primary: verify `bg-brand-primary` (not `bg-blue-500`)
   - Border style: verify `border-border-default` (not `border-gray-300`)
5. Document any raw Tailwind values found (e.g., `bg-slate-100`, `text-gray-700`)

**Expected Results:**
- All inspected elements use design tokens
- No raw Tailwind color/radius values

**Acceptance Criteria:**
- PASS: All checked elements use design tokens
- PARTIAL: Most use tokens, a few violations found (list them)
- FAIL: Widespread use of raw Tailwind values

**Capture:** DOM inspection screenshots showing class names

**Criteria Audit References:** 14.1 (code organization - design tokens), CLAUDE.md design token rules

---

### X-02: Responsive Layout Check

**Preconditions:** Various pages loaded.

**Steps:**
1. On the student dashboard, resize the browser to mobile width (375px):
   - Verify test cards stack vertically (single column)
   - Verify no horizontal overflow
2. On the test session:
   - Verify question text is readable
   - Verify answer choices stack properly
   - Verify bottom nav bar is usable
3. On the teacher dashboard:
   - Verify the 3-column grid collapses to single column
   - Verify quick action buttons wrap
4. On the report card:
   - Verify MCQ table scrolls horizontally if needed
   - Verify score badge is centered

**Expected Results:**
- All pages remain usable at mobile widths
- No content overflow or unreadable text

**Acceptance Criteria:**
- PASS: All pages responsive and usable at 375px width
- PARTIAL: Most pages responsive, some issues noted
- FAIL: Pages broken at mobile width

**Capture:** Mobile-width screenshots of key pages

**Criteria Audit References:** 7.1 (UI components), 14.1 (code organization)

---

### X-03: Console Error Audit

**Preconditions:** Browser DevTools console open, cleared.

**Steps:**
1. Navigate through the complete student flow: Dashboard -> Instruction -> Test -> Review -> Submit -> Report Card
2. After each navigation, check the console for:
   - JavaScript errors (red)
   - Warnings (yellow)
   - Unhandled promise rejections
3. Navigate through the teacher flow: Dashboard -> Gradebook -> Analytics -> Class Manager
4. Document ALL console errors and warnings with their messages and the page they occurred on

**Expected Results:**
- No unhandled JavaScript errors during normal flow
- Warnings are expected (React dev mode, etc.) but no critical ones

**Acceptance Criteria:**
- PASS: No JavaScript errors in console during normal flows
- PARTIAL: Warnings present but no errors
- FAIL: Console errors during normal usage

**Capture:** Console log exports from each page transition

**Criteria Audit References:** 6.1-6.7 (error handling), 14.1 (code organization)

---

## Summary of Scenarios

| ID | Track | Name | Priority |
|----|-------|------|----------|
| S-01 | Student | Dashboard Initial Load | P0 |
| S-02 | Student | Instruction Screen | P0 |
| S-03 | Student | Begin Test - Timer & Q1 | P0 |
| S-04 | Student | MCQ Answer Selection & Persistence | P0 |
| S-05 | Student | Question Flagging | P1 |
| S-06 | Student | Strikethrough on MCQ Choices | P1 |
| S-07 | Student | Question Navigator Modal | P1 |
| S-08 | Student | Answer All MCQ Questions | P0 |
| S-09 | Student | MCQ Multi-Select | P1 |
| S-10 | Student | Review Screen | P0 |
| S-11 | Student | Submit Section & FRQ Transition | P0 |
| S-12 | Student | FRQ Answer Entry & Navigation | P0 |
| S-13 | Student | Submit Final Section & Report Card | P0 |
| S-14 | Student | Report Card MCQ Results | P1 |
| S-15 | Student | Report Card Flagged Questions | P2 |
| S-16 | Student | Report Card FRQ Pending | P1 |
| S-17 | Student | Download Report PDF | P2 |
| S-18 | Student | Return to Dashboard After Completion | P1 |
| S-19 | Student | Second Test - Abbreviated | P1 |
| S-20 | Student | Hamburger Menu | P1 |
| S-21 | Student | Session Resume After Refresh | P0 |
| S-22 | Student | Highlighter Tool | P2 |
| S-23 | Student | Line Reader Tool | P2 |
| S-24 | Student | Timer Warning Colors | P2 |
| S-25 | Student | Section Lock Indicator | P2 |
| S-26 | Student | LaTeX Rendering (Calc Test) | P1 |
| S-27 | Student | Duplicate Tab Detection | P1 |
| S-28 | Student | Connection Status Banner | P1 |
| S-29 | Student | View Seed Results on Report Card | P2 |
| T-01 | Teacher | Dashboard Load | P0 |
| T-02 | Teacher | Route Protection | P0 |
| T-03 | Teacher | Gradebook - Pending Submissions | P0 |
| T-04 | Teacher | Gradebook - Filters | P1 |
| T-05 | Teacher | Grade FRQ - Grading Panel | P0 |
| T-06 | Teacher | Complete FRQ Grading | P0 |
| T-07 | Teacher | Exam Analytics | P1 |
| T-08 | Teacher | Student Profile Navigation | P2 |
| T-09 | Teacher | Analytics PDF Export | P2 |
| T-10 | Teacher | Class Manager | P1 |
| T-11 | Teacher | Seed Data Button | P2 |
| T-12 | Teacher | Test Editor - View | P1 |
| T-13 | Teacher | Test Editor - Create New | P1 |
| T-14 | Teacher | Question Bank | P1 |
| T-15 | Teacher | Assign Test | P1 |
| E-01 | Error | Invalid Test ID | P1 |
| E-02 | Error | Invalid Result ID | P1 |
| E-03 | Error | Submit Timeout & Retry | P1 |
| E-04 | Error | Error Boundary | P2 |
| E-05 | Error | Before Unload Warning | P2 |
| X-01 | Cross | Design Token Compliance | P2 |
| X-02 | Cross | Responsive Layout | P2 |
| X-03 | Cross | Console Error Audit | P1 |

**Total: 50 scenarios** across 4 tracks.

---

## Recommended Execution Order

1. **Phase 1 (Setup):** T-11 (seed data) -> T-01 (teacher dashboard verification)
2. **Phase 2 (Student Core Flow):** S-01 -> S-02 -> S-03 -> S-04 -> S-05 -> S-06 -> S-07 -> S-08 -> S-10 -> S-11 -> S-12 -> S-13
3. **Phase 3 (Student Report Card):** S-14 -> S-15 -> S-16 -> S-17 -> S-18
4. **Phase 4 (Student Advanced):** S-19 -> S-20 -> S-21 -> S-26 -> S-09 -> S-27 -> S-28
5. **Phase 5 (Student Annotations):** S-22 -> S-23 -> S-24 -> S-25
6. **Phase 6 (Teacher Core):** T-02 -> T-03 -> T-04 -> T-05 -> T-06
7. **Phase 7 (Teacher Advanced):** T-07 -> T-08 -> T-09 -> T-10 -> T-12 -> T-13 -> T-14 -> T-15
8. **Phase 8 (Error & Edge Cases):** E-01 -> E-02 -> E-03 -> E-04 -> E-05
9. **Phase 9 (Cross-Cutting):** X-01 -> X-02 -> X-03 -> S-29

---

### Critical Files for Implementation
- `/app/src/apBoost/pages/APTestSession.jsx` - Central orchestrator for the entire test-taking experience; renders all views (instruction, testing, review, FRQ choice) based on state
- `/app/src/apBoost/hooks/useTestSession.js` - Core hook that composes all sub-hooks and manages session state, answers, flags, navigation, submission
- `/app/src/apBoost/pages/APReportCard.jsx` - Full report card rendering with MCQ results table, domain performance, flagged questions, FRQ section
- `/app/src/apBoost/components/grading/GradingPanel.jsx` - Teacher grading side-panel with score inputs, feedback, save draft, mark complete
- `/app/src/apBoost/utils/seedFullData.js` - Seed script that creates all test data needed for the audit; must be run first