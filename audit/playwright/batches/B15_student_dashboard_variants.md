# B15 — Student Dashboard Variants

**Priority:** P1
**Estimated duration:** 30–45 minutes
**Depends on:** B00, B04 / B05 for non-empty data.
**Personas:** Lazy Student (empty data), Careful Student (some progress), Anxious Student (multiple classes).

## Goal

The student dashboard handles many states: brand-new student, single class, multiple classes, list deleted by teacher, primary focus changed. Each variant should render without crashing and without showing stale data.

## Scenarios

### S01 — Brand-new student (no classes, no progress)

1. Fresh signup (B01 S04 covers).
2. Dashboard renders empty state with clear CTA to join a class.
3. No console errors.

### S02 — Student enrolled in one class, one list

1. Log in `lazy` (one class).
2. Dashboard renders: my classes (1), primary focus list, today's session card.
3. No console errors.

### S03 — Student enrolled in multiple classes

1. `careful` is in primaryClass + secondaryClass.
2. Dashboard shows both. Primary focus picked correctly (most recently assigned by default).

### S04 — Student switches primary focus

1. From dashboard, click the list selector dropdown.
2. Pick a different list as primary.
3. Dashboard re-renders with the new primary focus.
4. Refresh: choice persists.

**Audit-known issue #4:** updateUserSettings has no retry. If save fails, UI shows new choice but Firestore has old. Force a route failure to confirm.

### S05 — Teacher deletes a list student is studying

1. (Setup with two contexts.) `powerTeacher` deletes `tinyList` while `lazy` has it as primary focus.
2. Student dashboard (refresh).
3. Expected: graceful empty state OR fallback to another list as primary. No 404, no white screen.

### S06 — Teacher renames a list

1. `powerTeacher` renames `tinyList` to "Renamed List".
2. Student dashboard.
3. Expected: shows new name (audit-known issue #14 — cache may show stale).

### S07 — Today's session card states

For each state, screenshot and verify:
- Not started today, day available.
- Started, in NEW_WORDS phase.
- Started, in REVIEW_TEST phase.
- Completed today.
- Need to retake.

### S08 — Daily activity bar

1. Student with 5 days of history.
2. Bar shows 5 filled days + 2 future placeholders.
3. Hover (if interactive): tooltip with date + score.

### S09 — Stats panels (mastery rate, streak, total words)

1. Verify each panel reflects the student's progress.
2. Panels handle "no data yet" state gracefully (0% mastery, 0 streak, 0 words).

### S10 — Re-entry modal after session completion (or non-completion)

1. Completed today: dashboard may show "Practice more?" CTA.
2. Quit mid-session: dashboard shows "Resume session" CTA.
3. Click each; verify navigation.

### S11 — Dashboard responsive states

(Covered in detail in B20.)

## Severity reminder

S05 = HIGH (data corruption potential). S04 / S06 = MEDIUM. Others LOW.
