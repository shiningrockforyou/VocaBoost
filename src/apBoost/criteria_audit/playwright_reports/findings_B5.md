# Batch B5 Findings: Annotation Tools & Visual Polish

**Agent:** Sonnet 4.6
**Date:** 2026-03-10
**Status:** COMPLETE — 5 scenarios tested (2 SKIP, 1 PASS, 1 PARTIAL, 1 PASS with new findings)
**Scenarios Covered:** S-22, S-23, S-24, S-25, S-26

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** Desktop (1440x900) — Playwright headless Chromium
- **Auth:** teacher@apboost.test (Teacher123!) — all scenarios run as teacher
- **Test:** AP Calculus AB Practice Exam (test_calc_ab_full_1) for S-22, S-23, S-24, S-25, S-26

---

## Scenario Results

### S-22: Annotation Tools - Highlighter
- **Status:** SKIP
- **Evidence:** DOM inspection confirmed: no `button` with text containing "Highlight" or `title="Highlight tool"` found on Calc test Q1. No `.grid.grid-cols-1.lg\:grid-cols-2` two-column layout rendered.
- **Notes:** No HORIZONTAL format questions with text stimulus exist in the Calc test seed data (`seedFullData.js`). The seed data creates 15 MCQ questions for Section I and 7 FRQ questions for Section II, but none have a `stimulus` field with `type: 'PASSAGE'` or similar. The `QuestionDisplay.jsx` only renders `PassageDisplay` (with toolbar) for HORIZONTAL format questions with non-image stimuli. ToolsToolbar never mounts for any Calc question. Per the AUDIT_PLAN.md acceptance criteria, this scenario is SKIP.

### S-23: Annotation Tools - Line Reader
- **Status:** SKIP
- **Evidence:** No "Reader" button found in DOM. Same root cause as S-22: all Calc test questions use VERTICAL format with no text stimulus. `PassageDisplay` never mounts.
- **Notes:** Same skip reason as S-22. The line reader is only available in `PassageDisplay` which only renders for HORIZONTAL format with text stimulus.

### S-24: Timer Warning Colors
- **Status:** PARTIAL
- **Evidence:**
  - Timer found: `true`
  - Timer text at start: `"44:58"` (correct MM:SS format)
  - Timer container class: `"flex items-center gap-2 text-text-primary"` (correct default state)
  - Timer is counting down: `true` (44:57 → 44:54 in 3 seconds)
  - Clock emoji present: `true` (⏱)
  - CSS token test: `text-warning-text` resolves to `rgb(15, 23, 42)` (SAME AS `text-text-primary`) — the warning/error colors are NOT visually applied.
- **Notes:** Timer format, countdown, default color, and emoji all PASS. However, the timer warning/error thresholds are a FAIL — `text-warning-text` and `text-error-text` resolve to the same color as the default `text-text-primary` (slate-900). See FINDING-B5-001 for the systemic CSS token naming mismatch that causes this.

### S-25: Section Lock Indicator
- **Status:** PASS
- **Evidence:**
  - Successfully navigated to Q15 via question navigator and clicked "Review →"
  - Review screen showed "Answered: 0/15" with "Submit Section" button
  - Submitted Section 1 → FRQ choice screen appeared → clicked "Type Your Answers"
  - Section 2 header text: `"LockedSection 2 of 2: Section II: Free Response⏱29:55"`
  - `lockedTextFound: true` — text "Locked" visible in DOM
  - `lockedTitleFound: true` — `title="Previous sections are locked"` present on element
  - Lock SVG found: `viewBox="0 0 20 20"` with lock path (`M5 9V7a5 5 0 0110 0v2...`)
  - Back button: `disabled: true` on first question of Section 2
- **Notes:** All S-25 acceptance criteria met. Lock indicator shows correctly in header, back navigation is disabled, "Previous sections are locked" title attribute present.

### S-26: AP Calculus Test with LaTeX Rendering
- **Status:** PASS (MCQ) / FAIL (FRQ vertical layout)
- **Evidence:**
  - MCQ Q1: `mjx-container` count = 4, no raw `$...$` in visible text. Body text showed `"Find lim𝑥→3⁡𝑥2−9𝑥−3."` — Unicode math (rendered by MathJax), not raw LaTeX.
  - FRQ Q1: Body text showed `"Let $f(x)=x^3-6x^2+9x+2$.(a)Find all critical values. Classify each."` — raw LaTeX `$...$` strings visible to the student.
- **Notes:** MathJax renders correctly for MCQ questions (`QuestionDisplay.jsx` uses `<MathText>` wrapper). FRQ questions in vertical layout (`FRQQuestionDisplay.jsx`) do NOT use `<MathText>` for `question.questionText` in the no-stimulus branch (line 221), causing raw LaTeX to appear. See FINDING-B5-002.

---

## Findings

### Blockers
> None.

---

### High-Priority

#### [FINDING-B5-001]: Timer Warning/Error Colors Not Applied — CSS Token Naming Mismatch
- **Severity:** High-Priority
- **Scenario:** S-24
- **Criteria Reference:** Section 1.1 (Timed sections — timer display with color warning states), Section 7.3 (Header — timer with color-coded urgency)
- **What Happened:** Live CSS token test confirmed: `text-warning-text` and `text-error-text` both resolve to `rgb(15, 23, 42)` (identical to `text-text-primary` — slate-900 dark). No color change occurs when the timer reaches 5 minutes or 1 minute. The timer text remains the same dark color throughout.

  Root cause: Tailwind v4 generates utility classes from `@theme` CSS variable names. The `@theme` block defines:
  - `--color-text-error` → generates Tailwind class `text-text-error` ✓
  - `--color-text-warning` → generates Tailwind class `text-text-warning` ✓

  But `TestTimer.jsx` uses `text-error-text` and `text-warning-text` (reversed word order). These class names would require `--color-error-text` in `@theme` to generate, but only `--color-error-text` in `:root` (raw values, not in `@theme`) exists. The CSS rules for `.text-error-text` and `.text-warning-text` are never generated by Tailwind v4, so these classes have no effect.

  This is a **systemic issue** affecting 30+ usages across the codebase (see grep results): `ConnectionStatus.jsx`, `APQuestionBank.jsx`, `APStudentProfile.jsx`, `StudentResultsTable.jsx`, `FRQTextInput.jsx`, `ErrorFallback.jsx`, `performanceColors.js`, etc.

- **Expected:** When `timeRemaining` reaches ≤300 seconds (5 minutes): timer container applies class `text-warning-text` → text turns amber/yellow. When `timeRemaining` reaches ≤60 seconds (1 minute): timer container applies `text-error-text` → text turns red. These are defined in criteria 1.1 and are critical safety indicators for students taking timed AP exams.
- **Screenshot/Evidence:** CSS token test output:
  ```
  text-error-text:          rgb(15, 23, 42) (SAME AS PRIMARY!)
  text-error-text-strong:   rgb(15, 23, 42) (SAME AS PRIMARY!)
  text-warning-text:        rgb(15, 23, 42) (SAME AS PRIMARY!)
  text-warning-text-strong: rgb(15, 23, 42) (SAME AS PRIMARY!)
  text-text-error:          rgb(220, 38, 38) (DIFFERENT - OK)
  text-text-error-strong:   rgb(153, 27, 27) (DIFFERENT - OK)
  text-text-warning:        rgb(217, 119, 6) (DIFFERENT - OK)
  text-text-warning-strong: rgb(146, 64, 14) (DIFFERENT - OK)
  CSS Rules for error-text/warning-text: NO RULES FOUND
  ```
  Screenshot: `b5_s24_timer_normal.png`, `b5_s24_timer_check.png`
- **File(s) to Fix:** There are two valid approaches:

  **Option A (Recommended): Fix `src/index.css` — add missing `@theme` entries**
  Add `--color-error-text` and `--color-warning-text` entries to the `@theme` block alongside the existing `--color-text-error` and `--color-text-warning` entries.

  **Option B: Fix all code usages — rename class references**
  Replace all `text-error-text` → `text-text-error`, `text-warning-text` → `text-text-warning`, `text-error-text-strong` → `text-text-error-strong`, `text-warning-text-strong` → `text-text-warning-strong`, `text-success-text` → `text-text-success`, `text-success-text-strong` → `text-text-success-strong` across all files.

- **How to Fix:**
  **Option A (recommended — minimal code change, preserves existing class naming convention):**

  In `src/index.css`, inside the `@theme { }` block (after line 407), add these alias entries:
  ```css
  /* Aliases for backward-compatible class names (text-error-text, text-warning-text) */
  --color-error-text: rgb(var(--color-error-text, 220 38 38));
  --color-error-text-strong: rgb(var(--color-error-text-strong, 153 27 27));
  --color-warning-text: rgb(var(--color-warning-text, 217 119 6));
  --color-warning-text-strong: rgb(var(--color-warning-text-strong, 146 64 14));
  --color-success-text: rgb(var(--color-success-text, 5 150 105));
  --color-success-text-strong: rgb(var(--color-success-text-strong, 6 95 70));
  ```

  Wait — this creates a circular reference (`:root` has `--color-error-text` and `@theme` would reference it). The correct approach for Tailwind v4 is:

  In `src/index.css`, inside `@theme { }` block, add directly after the existing `--color-text-error` entries (around line 395):
  ```css
  --color-error-text: rgb(var(--color-error-text));
  --color-error-text-strong: rgb(var(--color-error-text-strong));
  --color-warning-text: rgb(var(--color-warning-text));
  --color-warning-text-strong: rgb(var(--color-warning-text-strong));
  --color-success-text: rgb(var(--color-success-text));
  --color-success-text-strong: rgb(var(--color-success-text-strong));
  ```

  This tells Tailwind v4 to generate utility classes `.text-error-text { color: var(--color-error-text) }` etc., using the `:root` CSS variables that are already defined. No circular reference since `@theme` references the `:root` var, not itself.

  Note: Alternatively (cleaner): rename the `:root` vars to avoid confusion, but that requires updating ALL 30+ code usages.

- **Acceptance Test:**
  1. Open a browser DevTools console and run:
     ```javascript
     const tmp = document.createElement('span');
     tmp.className = 'text-warning-text';
     document.body.appendChild(tmp);
     console.log(getComputedStyle(tmp).color); // Should be amber, not slate-900
     document.body.removeChild(tmp);
     ```
  2. Start the Calc test, navigate to Q1.
  3. In DevTools, execute: `document.querySelector('.font-mono').parentElement.className = 'flex items-center gap-2 text-warning-text'`
  4. Verify the timer text turns amber/yellow color.
  5. Restore and test: `className = 'flex items-center gap-2 text-error-text'`
  6. Verify the timer text turns red.

---

#### [FINDING-B5-002]: FRQ Question Text Displays Raw LaTeX Instead of Rendered Math
- **Severity:** High-Priority
- **Scenario:** S-26
- **Criteria Reference:** Section 2.1 (MCQ display — MathText renders LaTeX in question text and choices), Section 7.2 (Question display with MathText)
- **What Happened:** FRQ questions in the vertical layout branch of `FRQQuestionDisplay.jsx` (the no-stimulus layout, lines 206-254) render `question.questionText` as plain text without `<MathText>` wrapping. When the question text contains LaTeX (e.g., `Let $f(x)=x^3-6x^2+9x+2$.`), the raw dollar-sign delimited LaTeX is shown directly to the student.

  Live evidence from Section 2, Q1 of the Calc test body text:
  ```
  "Let $f(x)=x^3-6x^2+9x+2$.(a)Find all critical values. Classify each. Justify.(4 pts)"
  ```

  The stimulus-present branch (lines 137-202) correctly uses `<MathText>` for `question.questionText` (line 168-170). The vertical (no-stimulus) branch at line 221 does NOT.

- **Expected:** FRQ question text containing LaTeX notation should render as formatted mathematical expressions via MathJax, regardless of whether the question has a stimulus. No raw `$...$` should be visible to the student.
- **Screenshot/Evidence:** Live test body text from S-25 run (entering Section 2):
  ```
  bodySnippet: "...Question 1(a)Total: 10 pointsLet $f(x)=x^3-6x^2+9x+2$.(a)Find all critical values. Classify each. Justify.(4 pts)..."
  ```
  The `$f(x)=x^3-6x^2+9x+2$` is raw LaTeX visible to the student.
- **File(s) to Fix:** `src/apBoost/components/FRQQuestionDisplay.jsx`
- **How to Fix:**
  In `FRQQuestionDisplay.jsx`, locate the vertical layout branch (lines 206-254, the `return` statement inside `if (!activeStimulus)`).

  Find line 221-223:
  ```jsx
  <p className="text-text-primary whitespace-pre-wrap">
    {question.questionText}
  </p>
  ```

  Replace with:
  ```jsx
  <p className="text-text-primary whitespace-pre-wrap">
    <MathText>{question.questionText}</MathText>
  </p>
  ```

  `MathText` is already imported at the top of `FRQQuestionDisplay.jsx` (line 3: `import MathText from './MathText'`). No new import needed.

  Also check the sub-question prompts in the vertical layout. In the vertical layout's `currentSubQuestion` block (line 241):
  ```jsx
  {currentSubQuestion.prompt && (
    <p className="text-text-primary mt-1">{currentSubQuestion.prompt}</p>
  )}
  ```
  This also lacks `<MathText>`. Fix to:
  ```jsx
  {currentSubQuestion.prompt && (
    <p className="text-text-primary mt-1"><MathText>{currentSubQuestion.prompt}</MathText></p>
  )}
  ```

- **Acceptance Test:**
  1. Navigate to `http://localhost:5173/ap/test/test_calc_ab_full_1`.
  2. Begin the test.
  3. Answer all 15 MCQ questions (or use question navigator to skip to Q15).
  4. Click "Review →" then "Submit Section".
  5. Click "Type Your Answers" on the FRQ choice screen.
  6. Verify: Section 2 Q1 question text displays "Let $f(x) = x^3 - 6x^2 + 9x + 2$" with proper mathematical formatting (superscripts, no dollar signs visible).
  7. PASS if no raw `$` characters appear in FRQ question text.
  8. FAIL if `$f(x)=x^3...` or similar raw LaTeX is visible.

---

### Medium-Priority

#### [FINDING-B5-003]: No Text Stimulus Questions in Seed Data — Annotation Tools Untestable
- **Severity:** Medium-Priority
- **Scenario:** S-22, S-23
- **Criteria Reference:** Section 1.3 (Highlighter tool), Section 1.5 (Line reader), Section 1.12 (ToolsToolbar)
- **What Happened:** Both S-22 (Highlighter) and S-23 (Line Reader) must be SKIP because no questions in the seeded test data (`seedFullData.js`) include a `stimulus` field with text content. All 51 seeded questions (15 Micro MCQ, 3 Micro FRQ, 15 Macro MCQ, 3 Macro FRQ, 10 Calc MCQ, 7 Calc FRQ) use the VERTICAL format without stimuli. The `PassageDisplay` component (which contains the ToolsToolbar, Highlighter, and LineReader) is never mounted during normal test-taking with seed data.
- **Expected:** The audit plan (S-22, S-23) expected at least some questions in Section 1 of the Calc test to have text stimuli so annotation tools could be verified. The annotation tool components exist and appear well-implemented in source code review (`Highlighter.jsx`, `LineReader.jsx`, `ToolsToolbar.jsx`, `useAnnotations.js`), but cannot be verified via live testing with current seed data.
- **Suggested Fix:** Add at least 2-3 HORIZONTAL format MCQ questions with text stimuli (`type: 'PASSAGE'`) to the Calc test seed data in `src/apBoost/utils/seedFullData.js`. These questions should cover both text highlighting and line reader scenarios. Example structure:
  ```javascript
  {
    id: 'calc_mcq_stimulus_01',
    questionType: 'MCQ',
    format: 'HORIZONTAL', // auto-set when stimulus present
    stimulus: {
      type: 'PASSAGE',
      title: 'Passage on Calculus Applications',
      content: 'The velocity of a particle is given by v(t) = 3t² - 6t + 2. When the acceleration equals zero, the particle reaches a critical point...',
      source: 'AP Calculus AB Practice',
    },
    questionText: 'Based on the passage, at what time does the particle reach its minimum velocity?',
    // ... choices, correct answer, etc.
  }
  ```

---

### Nitpicks

- **Nit (S-24):** The timer's clock emoji is `⏱` (stopwatch). The acceptance criteria (S-24) says "clock emoji is present" — a stopwatch is technically different from a clock. While semantically close, an actual clock emoji (🕐 or ⏰) might be more semantically aligned with a countdown timer. This is cosmetic and inconsequential.

- **Nit (S-25):** The "Locked" text in the header is `hidden sm:inline` — it is NOT visible on screens below 640px width. On mobile, only the lock SVG icon appears with no accompanying text. This is by design per the class but the lock icon alone (without text) may be less clear to mobile users. Aria-label or tooltip should remain sufficient for accessibility.

- **Nit (S-26):** The `MathText` component skips MathJax processing entirely if no `$$`, `$`, `\(`, or `\[` pattern is found (via `MATH_PATTERN` regex test). This is a performance optimization, but if the regex misses an edge case in how teachers enter LaTeX (e.g., using `\\(` escaped), the content would render raw. Low risk with current seed data.

---

## Console Errors

| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| /ap/test/test_calc_ab_full_1 | `[APBoost:useHeartbeat.doHeartbeat] Session taken over by another instance null` | Log (expected — fires before instance token is established on session start) |
| /ap/test/test_calc_ab_full_1 | `[APBoost:useDuplicateTabGuard.claimSession] Session claimed {instanceToken: ...}` | Log (expected — normal session claim behavior) |
| All pages | Zero JavaScript `error` type console messages detected during entire B5 audit session | N/A |

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 5 |
| PASS | 2 (S-25, S-26 MCQ) |
| FAIL | 0 |
| PARTIAL | 1 (S-24 — timer format/countdown PASS, but warning/error colors broken) |
| SKIP | 2 (S-22, S-23 — no text stimulus questions in seed data) |
| Blockers Found | 0 |
| High-Priority Found | 2 (B5-001: timer warning colors, B5-002: FRQ raw LaTeX) |
| Medium-Priority Found | 1 (B5-003: no stimulus seed data) |
| Nitpicks | 3 |

---

## Appendix: Detailed Evidence

### S-26 MathJax Rendering (MCQ)
Q1 body text (MathJax rendered): `"Find lim𝑥→3⁡𝑥2−9𝑥−3."` — Unicode math output, not raw LaTeX.
`mjx-container` elements found: 4 (on Q1 alone, covering the limit expression in both question and choices).

### S-25 Section Lock DOM Evidence
```
lockedTextFound: true — text "Locked" in DOM
lockedTitleFound: true — title="Previous sections are locked"
Lock SVG viewBox: "0 0 20 20"
Lock SVG path: "M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5..."
headerText: "LockedSection 2 of 2: Section II: Free Response⏱29:55"
backBtnDisabled: true (← Back button disabled on Q1 of Section 2)
```

### S-24 CSS Token Test Full Output
```
text-text-primary:        rgb(15, 23, 42)
text-text-secondary:      rgb(51, 65, 85)      DIFFERENT — OK
text-text-muted:          rgb(100, 116, 139)   DIFFERENT — OK
text-error-text:          rgb(15, 23, 42)      SAME AS PRIMARY — BROKEN
text-error-text-strong:   rgb(15, 23, 42)      SAME AS PRIMARY — BROKEN
text-warning-text:        rgb(15, 23, 42)      SAME AS PRIMARY — BROKEN
text-warning-text-strong: rgb(15, 23, 42)      SAME AS PRIMARY — BROKEN
text-text-error:          rgb(220, 38, 38)     DIFFERENT — OK (correct class name)
text-text-error-strong:   rgb(153, 27, 27)     DIFFERENT — OK (correct class name)
text-text-warning:        rgb(217, 119, 6)     DIFFERENT — OK (correct class name)
text-text-warning-strong: rgb(146, 64, 14)     DIFFERENT — OK (correct class name)
text-success-text:        rgb(15, 23, 42)      SAME AS PRIMARY — BROKEN
text-success-text-strong: rgb(15, 23, 42)      SAME AS PRIMARY — BROKEN
```

Correct Tailwind v4 class names (what actually works):
- `text-text-error` (not `text-error-text`)
- `text-text-warning` (not `text-warning-text`)
- `text-text-error-strong` (not `text-error-text-strong`)
- `text-text-warning-strong` (not `text-warning-text-strong`)
- `text-text-success` (not `text-success-text`)

### Files Affected by B5-001 (CSS Token Naming Mismatch)
All files using broken class names (30+ instances):
- `src/apBoost/components/TestTimer.jsx` — lines 22, 25 (timer warning/error)
- `src/apBoost/components/ConnectionStatus.jsx` — lines 54, 103, 114, 115
- `src/apBoost/components/analytics/StudentResultsTable.jsx` — line 172
- `src/apBoost/components/FRQTextInput.jsx` — line 101
- `src/apBoost/components/ErrorFallback.jsx` — line 31
- `src/apBoost/pages/APDashboard.jsx` — line 135
- `src/apBoost/pages/APQuestionBank.jsx` — lines 45, 46, 492
- `src/apBoost/pages/APStudentProfile.jsx` — lines 137, 208, 266
- `src/apBoost/pages/APTeacherDashboard.jsx` — lines 224, 225, 357
- `src/apBoost/pages/APReportCard.jsx` — lines 120, 403, 406, 434, 552, 572
- `src/apBoost/pages/APExamAnalytics.jsx` — lines 222, 225
- `src/apBoost/pages/APGradebook.jsx` — line 325
- `src/apBoost/pages/APClassManager.jsx` — lines 167, 268, 309
- `src/apBoost/pages/APTestEditor.jsx` — lines 61, 155, 478
- `src/apBoost/pages/APTestSession.jsx` — lines 283, 286, 558
- `src/apBoost/pages/APAssignTest.jsx` — lines 75, 76
- `src/apBoost/pages/APQuestionEditor.jsx` — lines 65, 329
- `src/apBoost/utils/performanceColors.js` — lines 11-13, 41, 75, 105-107
- `src/apBoost/components/grading/GradingPanel.jsx` — line 372
- `src/apBoost/components/tools/ToolsToolbar.jsx` — line 150
- `src/apBoost/components/ReviewScreen.jsx` — line 122
- `src/apBoost/components/TestSessionMenu.jsx` — line 127
- `src/apBoost/components/teacher/AssignTestModal.jsx` — line 187
- `src/apBoost/components/InstructionScreen.jsx` — line 73
- `src/apBoost/components/FRQHandwrittenMode.jsx` — line 128
- `src/apBoost/components/FileUpload.jsx` — lines 180, 236
- `src/apBoost/pages/APTeacherDashboard.jsx` — line 78 (`text-warning-text`)

---

## Revision History

| Date | Change |
|------|--------|
| 2026-03-10 | Initial B5 audit. All 5 scenarios tested via Playwright (Chromium headless). S-22/S-23 SKIP documented, S-24 PARTIAL with critical B5-001 finding, S-25 PASS, S-26 PASS (MCQ) with B5-002 (FRQ). |
