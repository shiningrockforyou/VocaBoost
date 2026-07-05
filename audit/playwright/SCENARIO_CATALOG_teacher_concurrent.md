# LSR Audit — Teacher-Concurrent & Adversarial Scenario Catalog

**Purpose (David, 2026-07-05):** the CS-worst behaviors were *teacher moves happening while students
are actively studying* — list adds/removes, setting changes, enrollment changes. This catalog adds those,
**interleaved concurrently with live student sessions**, and goes **beyond** the CS log to stress the whole
failure space so we're prepared for issues we haven't seen yet.

**Orchestration model:** each scenario runs multiple live browser contexts (1 teacher + 1–3 students, sometimes
a 2nd teacher) and interleaves their actions on a shared timeline. `‖` marks steps that overlap in wall-clock
(teacher acts *while* a student session is open). All interaction is UI-only per the policy doc; Admin SDK is
read-only verification between/after, never during a browser scenario.

**Legend:** Actor `T`=teacher1, `T2`=teacher2, `S1..S3`=students. Priority **P1**=Phase-1-relevant + high-CS,
**P2**=robustness, **P3**=creative/extreme. `[known-bug]` = expected to reproduce a de-scoped defect → files a
finding, not a pass/fail of Phase 1.

---

## Category TA — Teacher list-assignment changes (mid student progress)

### TA1 — List ADD flips students onto the new list `[known-bug: getPrimaryFocus §7-H3]` · P1 · repro 박시은 CS-06-24b/-06-28b
- **Pre:** S1 completes 2 days on list L in class C (has real progress + a default focus on L).
- **Timeline:** S1 opens dashboard ‖ **T assigns a second list M to C** ‖ S1 reloads dashboard.
- **Observe:** Is S1 silently switched to M's Day 1? Is L's progress still shown/reachable? Is the default
  list now M (getPrimaryFocus newest-assigned) despite L having progress?
- **Expect:** likely repro of the flip (de-scoped bug) → **finding**; L progress must persist (data intact).

### TA2 — List UNASSIGN strands mid-progress students `[known-bug: nice-to-haves #1]` · P1 · repro 박한별
- **Pre:** S1 mid-progress (day 3) on L in C.
- **Timeline:** S1 on dashboard ‖ **T unassigns L from C** (accepts the "progress is saved" confirm) ‖ S1 reloads.
- **Observe:** Can S1 still reach L? Or stranded on Day 1 of remaining lists / empty? Confirm-dialog wording.
- **Expect:** repro of stranding → finding; underlying progress/list_progress must not be destroyed.

### TA3 — Unassign then RE-ADD (does progress resurface cleanly?) · P2 · novel
- **Pre:** S1 day-3 on L in C.
- **Timeline:** T unassigns L ‖ S1 sees stranded → **T re-adds L to C** ‖ S1 reloads.
- **Observe:** Does S1's day-3 progress resurface intact, or reset? Any duplicate/ghost progress doc?

### TA4 — List SWAP mid-progress (remove L, add M same session) · P2 · novel
- **Pre:** S1 day-2 on L in C.
- **Timeline:** ‖ T unassigns L AND assigns M in quick succession ‖ S1 reloads → studies M → later T re-adds L.
- **Observe:** Does S1 cleanly move to M and can they return to L with day-2 intact?

### TA5 — Teacher assigns S1's in-progress list to a SECOND class S1 is in (teacher-driven dual-class) · P1 · novel/Phase-1-core
- **Pre:** S1 day-4 on L in class A; S1 also enrolled in class B (B does NOT yet have L).
- **Timeline:** **T assigns L to B** ‖ S1 opens L under B.
- **Observe (Phase-1 heart):** does list-scoped reconciliation carry S1's day-4/twi into B (flag-on) or show
  B's Day-1 (flag-off)? This is the *teacher-driven* path to the shared-progress state — the real-world way
  박주하 became dual on one list.

---

## Category TS — Teacher settings changes (mid student progress / mid session)

### TS1 — Pace bump mid-list · P1 · novel
- **Pre:** S1 at day 5 on L (twi ~ 5×pace).
- **Timeline:** ‖ **T changes C's pace 80→120** ‖ S1 studies next day.
- **Observe:** does the next new-word allocation continue from the current twi (position-correct) with the new
  pace, or mis-jump? Day counter behavior.

### TS2 — Threshold RAISE strands a borderline passer `[known-bug family: NTF#5]` · P1 · novel
- **Pre:** S1 passes a day at ~93% (server passed=true stored).
- **Timeline:** ‖ **T raises threshold 92→95** ‖ S1 continues next day / re-opens results.
- **Observe:** does the already-stored pass hold (server passed at submit-time), while the *next* test now
  gates at 95? Any retroactive un-pass? (NTF#5 display-vs-server interplay.)

### TS3 — Threshold LOWER rescues a failer · P2 · novel
- **Pre:** S1 failed a day at 88% (threshold 92).
- **Timeline:** ‖ **T lowers threshold 92→85** ‖ S1 retakes / re-opens.
- **Observe:** can S1 now advance? Does the old failed attempt re-evaluate or must they retake?

### TS4 — Test MODE flip mid-session · P2 · novel/nasty
- **Pre:** S1 opens a **typed** new-word study session (mid-cards, not submitted).
- **Timeline:** S1 in typed session ‖ **T flips C to MCQ** ‖ S1 proceeds to the test.
- **Observe:** does the in-flight session stay typed (frozen), or flip to MCQ underneath the student? Next
  day's mode? (Settings-frozen-at-session-start question — plan wants frozen; Phase 1 doesn't enforce.)

### TS5 — testSizeNew shrink/grow mid-progress · P3 · novel
- **Pre:** S1 mid-progress. **T changes New Word Test Size 30→10** ‖ S1 next test.
- **Observe:** test size honored; no crash on a smaller/larger set.

---

## Category TE — Teacher enrollment changes (mid student progress)

### TE1 — Teacher REMOVES a mid-session student from the class · P1 · novel
- **Pre:** S1 day-2 on L in C, opens a session.
- **Timeline:** S1 in session ‖ **T removes S1 from C** (roster remove) ‖ S1 submits / reloads.
- **Observe:** does the in-flight submit succeed or error? Does S1 lose access gracefully? Progress
  destroyed or orphaned? (removeStudentFromClass deletes no progress per code — verify it stays intact.)

### TE2 — Remove from A while dual-enrolled in B on the same list · P1 · Phase-1-core · novel
- **Pre:** S1 dual-enrolled A+B, shared list L, day-5 progress.
- **Timeline:** **T removes S1 from A** ‖ S1 opens L under B.
- **Observe:** does S1's shared L progress survive (list-scoped: yes, study_states+list_progress persist)?
  This is the safe-unenroll case the plan §7-B6/§5.3 depends on.

### TE3 — Teacher DELETES a class with an enrolled mid-progress student · P2 · novel/extreme
- **Pre:** S1 day-3 on L in C (only class). **T deletes C.**
- **Observe:** S1 dashboard graceful (no crash/white screen)? Progress orphaned but not corrupt? Can S1
  rejoin/continue elsewhere? (Extreme — real if a teacher cleans up.)

### TE4 — Re-enrollment loop · P2 · novel
- **Pre:** S1 day-3 on L in C.
- **Timeline:** T removes S1 → S1 sees removed → **S1 rejoins C by code** → opens L.
- **Observe:** does day-3 progress resurface (study_states persist) or reset to Day 1?

---

## Category XC — Cross-class / list-scoped-recon stress (Phase-1 heart)

### XC1 — Triple overlap, three paces · P1 · novel
- **Pre:** S1 in classes A(80)/B(100)/C(60), all sharing list L. One day studied in each (built flag-off).
- **Timeline (flag-on):** enter L under A, then B, then C.
- **Observe:** does position converge to the greatest across all three each time (no ping-pong, no demotion)?
  Which pace drives each session's allocation? (Extends §9 dual to triple.)

### XC2 — Cross-pace demotion guard · P1 · novel · plan §2.2 core
- **Pre:** S1 day-8 on L in A (pace 80, twi 640). **T creates class B pace 20, assigns L, moves S1.**
- **Timeline (flag-on):** S1 opens L under B.
- **Observe:** does day-8/twi-640 hold (day=session-count, position preserved) rather than B's pace implying
  "day 32"? The exact CSD-non-demoting behavior [C3-5].

### XC3 — Same-day concurrent completion, two classes (the §13 race, real repro) · P1 · novel
- **Pre:** S1 dual-enrolled A+B on L, both at the same uncompleted day.
- **Timeline:** S1 opens the day's test under A in context-1 ‖ **simultaneously** opens under B in context-2 ‖
  submits both within seconds.
- **Observe:** double-introduction / position jump / duplicate attempt? The serve-guard §5.4 should make the
  2nd join the review instead of re-introducing. (Directly tests the accepted §13 race.)

---

## Category MS — Multi-student concurrency under one teacher action

### MS1 — One unassign, three simultaneous mid-session students · P1 · novel
- **Pre:** S1/S2/S3 all day-2+ on L in C, all three open sessions.
- **Timeline:** all three studying ‖ **T unassigns L from C**.
- **Observe:** do all three degrade gracefully and identically? Any one crash while others don't? (Blast
  radius of a single teacher action across a live cohort — the real 박한별-at-scale.)

### MS2 — Pace change hits a cohort mid-day · P2 · novel
- **Pre:** S1/S2/S3 mid-day on L in C. ‖ **T changes pace.** ‖ each completes.
- **Observe:** consistent allocation for all; no partial-application skew.

---

## Category AD — Adversarial / creative student behaviors (beyond CS)

### AD1 — Ping-pong stress · P2 · novel
- S1 dual-enrolled, rapidly switches A↔B ~10× with a study interspersed. Observe: no drift, no demotion,
  no duplicate progress, UI stays responsive.

### AD2 — Student self-RESET mid-audit · P1 · novel · plan §5.3
- S1 has multi-class shared-list progress → **S1 uses the Settings "reset my progress"** → observe: does it
  clear cross-class shared study_states/attempts (the plan's cross-class-nuke concern §7-B6)? Does the other
  class's progress survive or vanish? (Confirms the list-aware-reset requirement empirically.)

### AD3 — Two-tab same-class double submit · P2 · repro batches B12
- S1 opens the same day's test in two tabs of the *same* class, submits both. Observe: one logical outcome,
  no double-advance (grading idempotency, adjacent to Phase 1).

### AD4 — Mid-test list-unassign · P3 · novel/nasty
- S1 reaches a test's final screen ‖ **T unassigns that list** ‖ S1 submits. Observe: submit succeeds (attempt
  already server-bound) or errors gracefully; no corrupt state.

### AD5 — Join-abandon-rejoin churn · P3 · novel
- S1 joins C, immediately (no study) leaves via removal, rejoins, then studies. Observe: clean state, no
  ghost enrollment/progress.

---

## Category GB — Gradebook / cross-teacher (shared-truth, Phase-1 §2.1)

### GB1 — Two teachers, one shared list, one student · P1 · novel · plan §2.1/§7-H4
- **Pre:** T assigns L to class A; **T2 assigns L to class B**; S1 in both; S1 has day-6 progress.
- **Timeline (flag-on):** S1 studies under A ‖ **T2 opens B's gradebook** for S1.
- **Observe:** does T2 see S1's shared list position (incl. work done in T's class) — the intended shared-truth
  — and does the per-class *attempt* history stay class-filtered? (The cross-teacher visibility David approved.)

### GB2 — Gradebook during the storm · P3 · novel
- **T watches C's gradebook** live ‖ S1 rapidly completes days / switches. Observe: teacher view coherent,
  no stale Day-1 flash, no crash on concurrent writes.

---

## Execution plan
- **Wave T-1 (P1 first):** TA1, TA2, TA5, TS1, TS2, TE1, TE2, XC1, XC2, XC3, MS1, AD2, GB1 — the
  Phase-1-relevant + highest-CS set.
- **Wave T-2 (P2):** TA3, TA4, TS3, TS4, TE3, TE4, MS2, AD1, AD3.
- **Wave T-3 (P3 creative/extreme):** TS5, AD4, AD5, GB2.
- Each scenario: read-only pre-snapshot of its actors → run the interleaved timeline (UI-only) → read-only
  post-snapshot + assert → **every anomaly filed** (mandatory findings protocol), known-bugs tagged.
- Flag-off (Run L) validates the teacher-move mechanics + files the de-scoped-bug repros; flag-on (Run S)
  re-runs the Phase-1-relevant ones (TA5, XC1-3, TE2, AD2, GB1) to prove the fix.

Accounts: fresh disposables per mutating scenario from `lsr_s14`–`lsr_s30`; `lsr_teacher_01/02`.
