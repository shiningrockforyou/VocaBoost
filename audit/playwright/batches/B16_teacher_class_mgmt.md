# B16 — Teacher Class Management

**Priority:** P2
**Estimated duration:** 30–45 minutes
**Depends on:** B00.
**Personas:** Novice Teacher, Power Teacher, Anxious Teacher.

## Goal

Class creation, editing, deletion, student management.

## Scenarios

### S01 — Create class happy path

1. `noviceTeacher` logs in.
2. Dashboard → "Create New Class".
3. Modal opens. Fill name, studyDaysPerWeek.
4. Save. Class appears on dashboard within 2s.

### S02 — Create class with duplicate name

1. Create class "X". Then try to create another "X".
2. Verify behaviour (probably allowed, since classes are scoped by teacher).

### S03 — Cancel mid-create

1. Open modal. Fill. Cancel.
2. Verify: no class created.

### S04 — Modal close via Escape / outside-click

1. Open modal. Press Escape. Modal closes; nothing saved.

### S05 — Delete class

1. Open class. Click Delete (if available). Confirm.
2. Class disappears from dashboard.
3. Verify cleanup: student dashboards no longer show this class (after refresh).
4. Audit-known issue: deleteClass may not cascade — verify enrolled students don't have ghost class entries.

### S06 — Generate / regenerate joinCode

1. Open class settings. Find joinCode UI.
2. Regenerate. Old code invalid; new code works.

### S07 — Remove student from class

1. Open class roster. Remove one student.
2. Verify: student removed from class, member subcollection cleaned, studentCount decremented.
3. Audit-known issue: partial failure leaves orphan member.

### S08 — Class roster scale

1. Open `fullClass` (10+ students).
2. Verify roster renders. No layout breaks. No N+1 queries that hammer Firestore.

### S09 — Class with assigned lists

1. Open `primaryClass`. Verify all 3 assigned lists shown.
2. Click into a list from the class view.

### S10 — Class details edits don't clobber assignments

1. Edit class name only. Save.
2. Verify: assignments map unchanged.

## Severity reminder

S05 / S07 = HIGH. Others MEDIUM/LOW.
