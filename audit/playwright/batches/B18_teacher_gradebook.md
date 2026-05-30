# B18 — Teacher Gradebook

**Priority:** P2
**Estimated duration:** 45–60 minutes
**Depends on:** B00, B02/B03 for submitted attempts.
**Personas:** Power Teacher, Anxious Teacher.

## Goal

Gradebook lists submissions accurately. Filter, sort, search. Performance scales with class size. Single source of truth.

## Scenarios

### S01 — Gradebook lists all student attempts

1. After B02/B03/B11 ran, attempts exist for multiple students.
2. `powerTeacher` opens gradebook.
3. Each attempt listed once. Student name, list, score, date.

### S02 — Filter by class

1. Pick `primaryClass`. Verify only its students' attempts shown.

### S03 — Filter by list

1. Pick `tinyList`. Verify only attempts on that list.

### S04 — Filter by test type (MCQ / Typed / Blind Spot)

1. Pick MCQ. Only MCQ attempts.

### S05 — Filter by date range

1. Last 7 days. Verify date-bounded.

### S06 — Sort by score

1. Click Score column. Ascending. Descending.

### S07 — Sort by date

Default; verify newest first.

### S08 — Click into an attempt detail

1. Click a row. Detail view opens.
2. Verify all answers, AI rationale (if typed), challenge status visible.

### S09 — Empty gradebook

1. Pick `emptyClass`. Verify empty state.

### S10 — Gradebook stale data

1. Student submits attempt while teacher has gradebook open.
2. Gradebook does NOT auto-update (typical SPA behaviour).
3. Refresh; attempt appears.
4. Document this UX — is it intended?

### S11 — Audit-flagged duplicate display

1. After B12 S10/S11 runs (if any duplicates were created), verify gradebook handles them sanely.

### S12 — Performance with large class

1. `fullClass` has 10+ students with multiple attempts each.
2. Gradebook load time < 3s.
3. Scroll smooth.

### S13 — Export gradebook (if supported)

CSV or PDF export. Verify contents match what's on screen.

## Severity reminder

S01 / S08 = BLOCKER if broken. S10 / S12 = MEDIUM. Others LOW.
