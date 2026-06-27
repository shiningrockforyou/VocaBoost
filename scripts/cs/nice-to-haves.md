# Nice-to-Haves — CS-driven improvement backlog

Non-urgent improvements surfaced by recurring CS tickets. **None are backend bugs** — they're
guardrails / UX / process changes that would stop the same CS tickets from recurring. Logged here
so they're tracked rather than re-discovered each time. Promote to a real ticket when prioritized.

Last updated: 2026-06-23.

---

## 1. Reword the list-unassign confirmation dialog  ·  UI  ·  small  ·  HIGH

**Problem.** Removing a list from a class shows:
> "Remove this list from the class? Student progress is saved."

This is *technically* true (progress docs aren't deleted) but **misleading** — it reads as
"harmless." In reality, unassigning a list that students are **mid-progress** on **strands them**:
their progress is preserved but becomes **unreachable** (the list is no longer offered, so the
list-selector can't show it → they see Day 1 of whatever's left). This false reassurance is the
likely human-factors cause of the recurring "my list reset to Day 1" tickets (e.g. 박한별, B2).

**Fix.** `src/pages/ClassDetail.jsx:~389` (`handleUnassignList`) — reword the `window.confirm`:
> "Remove this list? Students still working on it will **lose access** until it's re-assigned
> (their progress is preserved but hidden). Students who already finished are unaffected."

**Effort/risk:** one-line string change, no logic. Risk ~0.

---

## 2. Guardrail: warn/block unassigning a list with active student progress  ·  backend+UI  ·  small-med  ·  MED

**Problem.** Nothing stops a teacher from unassigning a list that students are actively working
on. The only signal is the (misleading) confirm text.

**Fix.** In `unassignListFromClass` (`src/services/db.js:821`) or its caller, check whether any
enrolled student has active progress on `(classId, listId)` (a `class_progress` doc or recent
attempts). If so, surface a stronger warning ("N students are mid-progress on this list") and
require an extra confirm — or soft-block. Keeps the genuinely-orphaned case (#1) from happening
silently.

**Effort/risk:** small read + a confirm gate. Low risk.

---

## 3. "Add, don't swap" during list transitions  ·  PROCESS  ·  ZERO code  ·  applied

**Problem.** Cohort transitions (Base Camp → Ascent) were done by **removing** Base Camp and
**adding** Ascent. The removal is what strands the stragglers. Classes that simply **added**
Ascent and kept Base Camp had zero orphans (the list-selector covers both).

**Fix (already applied for INT, 2026-06-23, CS-2026-06-23b):** add the new list alongside the old
one; never unassign a list while anyone is mid-progress on it. Document as the standing procedure.
10/11 INT classes now carry both lists; **B2 still needs Base Camp re-added** (pending).

---

## 3b. Default-list fallback should prefer the list with progress  ·  client  ·  small  ·  HIGH

**Problem.** `getPrimaryFocus` (Dashboard.jsx:1037) falls back to the **most-recently-assigned** list for any student with no saved `primaryFocusListId` — and it **ignores which list the student has progress on**. So when a teacher **adds** a new list (e.g. Ascent) to a class, every never-selected student is silently flipped onto the new (often harder) list mid-progress on the old one. Confirmed real-world stress cause (박시은 + likely other Inter E students after Ascent was added 2026-06-22).

**Fix.** In the fallback, prefer the list the student has **active progress / a session_state** on; only use most-recently-assigned when there's no progress anywhere. Pairs with the "add-don't-swap" guidance (#3).

**Effort/risk:** small, localized to the fallback branch. High value — stops the next list-add from stranding a cohort.

---

## 4. Progress portability across class change  ·  ARCHITECTURE  ·  large  ·  LOW / future

**Problem.** Progress is keyed by `(classId, listId)`. When a student is moved to a different
class (even one that assigns the *same* list), their progress doesn't follow → fresh Day 1 in the
new class (e.g. 박한별: Base Camp progress lives under B2, invisible in B1). Handled per-student by
hand today.

**Possible directions (NOT required — only if this keeps recurring at scale):**
- A "carry my progress to this class" migration on enroll (copy `class_progress` + `session_state`
  + re-point attempts' `classId`), OR
- Key progress by `(student, listId)` instead of `(class, listId)` so it's class-independent.

**Effort/risk:** large structural change + migration. **Not needed to resolve current tickets** —
the config fixes (#1–#3) cover the real-world cause. Listed only so the option is on record.

---

## Related deferred items (tracked elsewhere)
- **R7 — forgeable `isCorrect` on attempt writes:** `submitVocabAttempt` still trusts the client's
  `isCorrect`. Broader "forgeable attempts" hardening; see PLAN_server_side_attempt_write_v2.md / commercial-readiness.
- **#23** offline failed-fetch console noise (cosmetic). **#28** Dashboard.jsx → Teacher/Student split.
