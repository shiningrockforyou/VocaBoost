# Findings — B_LIST_PROGRESS_PHASE1 (ORCH_TA2_2026-07-05)

**Run date:** 2026-07-05T07:52:39.062Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [stu] join "25WT LSR-TCH-B" via TCHBBB → visible
- [2026-07-05T07:53:34.785Z] **request-failed** — [TA2-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qrghcVmJ8EEsw29LUZaSxH85MLWmNtCVQJTN8aMjUVQuEf7Nf6P_-w&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:53:34.790Z] **request-failed** — [TA2-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=lI7UEryfL3HxIEyXkZV61pc-OjWKI1jGJOYe0wSYRmrDpC6RIjU3eA&VER=8&d — net::ERR_ABORTED
- [2026-07-05T07:53:36.998Z] **flow-gap** — [s18-d1-rev] no Review/Continue button
- [2026-07-05T07:53:44.393Z] **request-failed** — [TA2-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Zlvea8xe1UjFI2J_oC_0rtO29RG3KUfF4uvWUYTkRGPOcf7WUfK_aw&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:53:47.594Z] **native-dialog** — [TA2-T] confirm: Remove this list from the class? Student progress is saved. — accepted
  - STEP [teacher] unassign "LSR TOP Vocab (audit clone)" from 25WT LSR-TCH-B → removed
- [2026-07-05T07:53:49.703Z] **request-failed** — [TA2-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=6nELFRk3moCdx7i0T6Ks-i3DfLkt-xKRJL0jlgb7IPpqDcrvNnWh6w&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:53:49.710Z] **request-failed** — [TA2-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=VMEoaYw-Kuio-ttuWrRpTARybFiYzJ7tvZRyQs_yeQWCeBiGSUhrZw&VER=8&d — net::ERR_ABORTED
- [2026-07-05T07:53:52.806Z] **BUG** — [TA2] after teacher unassigned "LSR TOP Vocab (audit clone)" from 25WT LSR-TCH-B, student can reach the list: false — STRANDED (박한별 repro)

---

### F03 — [CONFIRMED][known-bug nice-to-haves #1] Teacher unassigning a list strands a mid-progress student
**Severity:** HIGH (product; recurring CS cause) · **Repro:** 박한별 (nice-to-haves #1/#2)
**Scenario:** TA2 (teacher-concurrent, flag-off). Student s18 has real progress (day-1) on "LSR TOP Vocab" in
25WT LSR-TCH-B. **While the student is active, the teacher unassigns that list from the class** (accepting the
"Remove this list from the class? Student progress is saved." confirm). On reload the student **can no longer
reach the list** — stranded. Progress docs persist (unassignListFromClass deletes nothing) but the list is no
longer offered, so it's unreachable via the list selector.
**Root cause / product gap:** the unassign confirm ("progress is saved") is misleading — technically true but
the list becomes inaccessible mid-progress; nice-to-haves #1 (reword) / #2 (block/warn when students are
mid-progress) / #3b (progress-preferring fallback). UI-confirmed live.
**Fix direction:** warn/block unassigning a list with active student progress; reword the confirm; the
list selector should still offer any list the student has progress on.
