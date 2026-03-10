# Batch B11 Findings: Cross-Cutting Quality

**Agent:** Sonnet 4.6
**Date:** 2026-03-09
**Status:** COMPLETE
**Scenarios Covered:** X-01, X-02, X-03

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 1440x900 (desktop), 375x812 (mobile), 768x1024 (tablet)
- **Auth:** Teacher account (teacher@apboost.test)

---

## Scenario Results

### X-01: UI Design Token Compliance Spot Check
- **Status:** PASS (runtime DOM scan) / PARTIAL (source code scan reveals 1 violation in conditional path)
- **Evidence:** Automated DOM class scan using a Playwright Node.js script scanned all rendered elements on 8 pages (Student Dashboard, Teacher Dashboard, Gradebook, Class Manager, Analytics, Question Bank, Report Card, Test Editor). Zero runtime violations found. Source code scan found `bg-yellow-200`, `bg-green-200`, `bg-pink-200`, `bg-blue-200` in `src/apBoost/hooks/useAnnotations.js` lines 8-11 (`HIGHLIGHT_COLORS` constant). These classes are applied to the Highlighter toolbar color swatches and to highlighted text spans during test sessions. They are NOT reachable with current seed data (none of the 51 seed questions have text stimuli), but they ARE code violations.
- **Previously Identified Violations Now Fixed:** `text-green-600` in `MCQDetailedView.jsx` (now `text-success-text`) and `bg-white border-white` in `AnswerInput.jsx` (now `bg-surface border-surface`). Both confirmed fixed by source code verification.

### X-02: Responsive Layout Check
- **Status:** PARTIAL
- **Evidence:** No horizontal body overflow at any viewport on any page. At 375px, the Gradebook table is scrollable (containerScrollWidth=575 vs clientWidth=343). A fade gradient is rendered at x=327-359px (right edge of container). However, the Grade button sits at left=505, right=575 — completely outside the 375px viewport. The scroll affordance fade exists but the usability gap remains: teachers cannot see or reach the Grade button without discovering horizontal swipe. At 768px, all columns are visible (table fits within 736px container). The Report Card MCQ table at 375px is NOT scrollable (scrollWidth=clientWidth=295) — Domain and Topic columns are correctly hidden via `hidden sm:table-cell` and a scroll fade overlay is rendered. This issue from the previous audit has been **fixed**.
- **Notes:** The Gradebook fix was partially applied (fade exists) but incomplete (critical Grade button is still 232px off-screen).

### X-03: Console Error Audit
- **Status:** PARTIAL
- **Evidence:** 1 error and 1 warning detected, both from Firebase Firestore on the `/login` page during the initial connection attempt. Error: "Firestore (12.6.0): Could not reach Cloud Firestore backend. Connection failed 1 times." Warning: "WebChannelConnection RPC 'Listen' stream transport errored." Zero console errors or warnings during subsequent navigation of all app routes (/ap, /ap/teacher, /ap/gradebook, /ap/teacher/classes, /ap/teacher/analytics, /ap/teacher/questions, /ap/results/:id). These Firebase startup errors are transient infrastructure errors that occur when the Firebase client first initializes during page load before the network connection is fully established. They are NOT application bugs.
- **Notes:** Firebase connectivity errors during initial page load are expected in the test/development environment. No errors during actual app usage.

---

## Findings

### Blockers
> No Blockers found.

---

### High-Priority
> No High-Priority issues found.

---

### Medium-Priority

#### [FINDING-B11-001]: Raw Tailwind color classes used for Highlighter feature color swatches (source code violation)
- **Severity:** Medium-Priority
- **Scenario:** X-01
- **Criteria Reference:** Section 14.1 (design tokens — NEVER use raw Tailwind values like `bg-slate-100`, `text-gray-700`), CLAUDE.md Design Tokens rule
- **What Happened:** `src/apBoost/hooks/useAnnotations.js` lines 8-11 defines `HIGHLIGHT_COLORS` using raw Tailwind color classes: `bg-yellow-200`, `bg-green-200`, `bg-pink-200`, `bg-blue-200`. These classes are applied at runtime in two places: (1) the color picker swatches in `ToolsToolbar.jsx` line 23 and line 41, and (2) highlighted text spans in `Highlighter.jsx` line 129. The toolbar and highlighter only render for questions with text stimuli/passages (none exist in current seed data). The DOM scan found zero violations at runtime, but this is a source-code violation that WILL be exposed when passage-based questions are added.
- **Expected:** All color values should use design tokens from `src/index.css`. However, highlighter colors are intentionally literal visual colors (yellow marker, green marker, etc.) that don't map cleanly to semantic tokens. Acceptable alternatives: define CSS custom properties for highlighter colors in `index.css`, or use Tailwind's opacity variant pattern.
- **Screenshot/Evidence:** Source code inspection of `src/apBoost/hooks/useAnnotations.js` lines 7-12. Runtime scan of 8 pages confirms zero DOM violations currently (no passage questions in seed data).
- **File(s) to Fix:** `src/apBoost/hooks/useAnnotations.js`
- **How to Fix:** Option A (Recommended) — Define semantic highlight color tokens in `src/index.css` and reference them:

  In `src/index.css`, add to the `:root` / theme section:
  ```css
  --highlight-yellow: oklch(0.93 0.14 95);
  --highlight-green: oklch(0.87 0.12 145);
  --highlight-pink: oklch(0.92 0.08 350);
  --highlight-blue: oklch(0.87 0.09 220);
  ```

  Then in `src/apBoost/hooks/useAnnotations.js`, replace the HIGHLIGHT_COLORS object:
  ```js
  export const HIGHLIGHT_COLORS = {
    yellow: 'bg-[var(--highlight-yellow)]',
    green: 'bg-[var(--highlight-green)]',
    pink: 'bg-[var(--highlight-pink)]',
    blue: 'bg-[var(--highlight-blue)]',
  }
  ```

  Option B (Minimal change) — Use Tailwind's arbitrary value syntax with CSS custom properties, keeping the colors in CSS variables so they are theme-aware.

  Option C (Pragmatic exception) — Document these as intentional literal colors (they represent physical highlighter pen colors) and add a comment in the file explaining why they are exceptions. This is the lowest-effort option.
- **Acceptance Test:** Add a question with a text stimulus to one of the seeded tests via the Question Bank. Navigate to that test session, start the test, reach the question with the stimulus. Verify the highlighter toolbar color swatches are visible and use design tokens (not raw Tailwind). Inspect element classes in DevTools to confirm the correct class is applied.

---

#### [FINDING-B11-002]: Gradebook table Grade button not reachable at 375px mobile without horizontal scroll discovery
- **Severity:** Medium-Priority
- **Scenario:** X-02
- **Criteria Reference:** Section 7.1 (UI components — mobile usability), Section 14.1 (code organization — responsive)
- **What Happened:** On the Gradebook page at 375px viewport width, the table's "Action" column (containing the Grade button) is positioned at left=505, right=575 — completely outside the visible 343px client width. A scroll fade gradient overlay IS rendered at x=327-359 (right edge of container), providing visual affordance, but the actual Grade button is 162px beyond even that fade indicator. The teacher can scroll the table to reach the Grade button, but the visual affordance (a 32px fade at the container edge) may not be sufficient to communicate that significant scrollable content exists.

  Measured from live testing: Grade buttons visible=false, inViewport=false, viewportWidth=375, button left=505, button right=575. Container scrollWidth=575, clientWidth=343. Fade div: display=block, left=327, right=359, opacity=1.
- **Expected:** The Gradebook should be fully usable on mobile. The Grade button is the primary action for a teacher's mobile workflow. The AUDIT_PLAN.md X-02 criterion states "All pages remain usable at mobile widths." A teacher accessing the gradebook on mobile cannot perform their primary task without discovering horizontal scroll.
- **Screenshot/Evidence:** `screenshots/b11_fresh/x02_mobile_375_gradebook.png` — shows table with Student, Test, and Submitted columns visible. Status and Action columns are off-screen. Fade overlay is present at right edge.
- **File(s) to Fix:** `src/apBoost/pages/APGradebook.jsx`
- **How to Fix:** The fade overlay is already in place (line 351). The remaining issue is that the critical Grade button is far off-screen. Implement responsive column hiding to make the Grade button accessible without scroll:

  In `APGradebook.jsx`, the table header (lines 331-337) and `GradebookRow` component (lines 75-101):

  **Step 1 — Hide "Submitted" column on mobile** (it's less critical than Status and Grade):
  In the `<thead>` `<tr>`, change the "Submitted" `<th>`:
  ```jsx
  <th className="text-left py-3 px-4 text-text-secondary font-medium hidden sm:table-cell">Submitted</th>
  ```

  **Step 2 — In `GradebookRow`, change the completedDate `<td>`:**
  ```jsx
  <td className="py-3 px-4 text-text-muted text-sm hidden sm:table-cell">{completedDate}</td>
  ```

  This alone may not be sufficient. If Status is also too wide, also hide it and show it inline:
  ```jsx
  <th className="text-left py-3 px-4 text-text-secondary font-medium hidden sm:table-cell">Status</th>
  ```
  And in GradebookRow:
  ```jsx
  <td className="py-3 px-4 hidden sm:table-cell">
    <StatusBadge status={result.gradingStatus} />
  </td>
  ```
  Then add the status badge inline below the student name for mobile:
  ```jsx
  <td className="py-3 px-4 text-text-primary">
    {result.studentName}
    <span className="sm:hidden block mt-1"><StatusBadge status={result.gradingStatus} /></span>
  </td>
  ```

  With Submitted and Status hidden on mobile, the table will have Student (left), Test (middle), Action (right), which should fit within ~375px. The Grade button would then be visible without scrolling.

- **Acceptance Test:** Set browser to 375px width. Navigate to `/ap/gradebook`. Verify the Grade button is visible without horizontal scrolling. Verify teachers can click it to open the grading panel. Verify at 768px+ the Submitted and Status columns reappear correctly.

---

### Nitpicks

- **Nit:** The Firebase Firestore WebChannel transport error that appears in the console on `/login` page load is an infrastructure-level warning. It is transient and resolves automatically (the client retries and connects). No fix needed, but it can be suppressed if desired by adding Firebase offline persistence or configuring more lenient retry timeouts in the Firebase initialization.

- **Nit:** The Analytics page shows "Total Students: 0" and empty bar charts because the teacher-filtered analytics query returns no matched data from the seed. This appears to be a data filter/seed mismatch. Observed at `/ap/teacher/analytics/test_micro_full_1` — the page loads without error but shows empty state.

---

## Console Errors
| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| /login (initial load) | `@firebase/firestore: Could not reach Cloud Firestore backend. Connection failed 1 times. Most recent error: FirebaseError: [code=unavailable]` | warning (transient, infrastructure) |
| /login (initial load) | `@firebase/firestore: WebChannelConnection RPC 'Listen' stream transport errored. Name: undefined Message: undefined` | warning (transient, infrastructure) |
| All other routes | No errors or warnings detected | — |

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 3 |
| PASS | 1 |
| FAIL | 0 |
| PARTIAL | 2 |
| SKIP | 0 |
| Blockers Found | 0 |
| High-Priority Found | 0 |
| Medium-Priority Found | 2 |
| Nitpicks | 2 |

### Key Observations

**X-01 (Design Token Compliance):** The runtime DOM scan found zero violations across all 8 tested pages. Two violations identified in the previous B11 audit (`text-green-600` in MCQDetailedView.jsx and `bg-white border-white` in AnswerInput.jsx) have been **FIXED** in the current codebase. One new source-code violation identified: raw Tailwind highlighter colors (`bg-yellow-200`, `bg-green-200`, `bg-pink-200`, `bg-blue-200`) in `useAnnotations.js` — not currently reachable in production as no seed questions have text stimuli, but will manifest when passage-based questions are added.

**X-02 (Responsive Layout):** Significant improvement since previous run. The Report Card MCQ table issue has been **FIXED** — Domain and Topic columns are hidden via `hidden sm:table-cell` and a scroll fade overlay is present. The Report Card is fully usable at 375px. The Gradebook partially improved — a scroll fade gradient was added — but the Grade button remains unreachable without horizontal scroll at 375px (505px from left in a 375px viewport). Recommending responsive column hiding to make Grade button accessible.

**X-03 (Console Errors):** Two Firebase startup errors detected on the `/login` page during initial connection. These are transient infrastructure errors that self-resolve (Firebase reconnects automatically). Zero errors during normal app navigation. This is treated as PARTIAL (errors exist but not during normal usage flows). All 7 major routes visited were error-free.
