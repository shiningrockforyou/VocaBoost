# Plan review — FIX_PLAN v2 — Verifier #6 (product / UX / rollout & operational safety on the live 26SM cohort)

**Reviewer:** Independent Plan Verifier #6 (Fable). **Date:** 2026-07-13. **Mode:** READ-ONLY review; no code
changes, no live Firebase. **Target:** `audit/deepfix/task2/FIX_PLAN.md` (v2).
**Verification stance (David's binding rule):** every finding below is anchored to a `file:line` in today's
working tree, a Task-1 export, the TA chat log, or SUPPORT_RUNBOOK — re-checked by this reviewer, not inherited.
Code claims I re-verified myself are tagged `[V-6]`.

**Verdict up front:** the rollout architecture is fundamentally sound and unusually safety-conscious for the
live cohort — P0's G1 disarm before any functions deploy, hosting-only first (fastest harm reduction for the
183), the resolver held read-only until P5, capability-gated terminal buttons (never a dead button), per-phase
rollback with the legacy docs retained. The CONT-A/CYC split genuinely delivers David's request in the right
order. **But the plan is written from the data-safety side of the glass. Its student/teacher/TA-facing surface
has four HIGH gaps** — P5 has no watch window, no execution window, and an overstated reversibility claim; the
teacher progress views are never inventoried in the P4 cutover and would freeze (then break at P7); the entire
CS toolchain the program's own X5 discipline depends on goes stale at P5; and the plan's real calendar
contradicts promises David already made in the TA channel, leaving the 5 finished-everything students on a
daily manual-test treadmill for ~a month with no interim. None of these invalidate the backbone; all are
fixable inside the existing phases.

---

## Severity-ranked findings

### F6-1 · HIGH — P5 (the migration) has no watch window, no execution window, and its reversibility claim is overstated
- **Location:** FIX_PLAN P5 "Procedure" + "Deploy gate" ("No app deploy; G4 (sweep before/after) + the CS-event
  authorization chain") and "Ship/Test/Revert" ("Reversible: backups + legacy docs RETAINED until P7").
- **Problem (live-student impact):** the single riskiest student-facing event in the program is the ONLY phase
  with no G5 watch window at all, no named post-migration live signals, and no stated execution window — while
  its own Non-regression section says **in-flight `session_states` are dropped/rebuilt** (persist §7.5). 26SM
  studies in class-hour peaks (06h/08h spikes per CS-2026-06-28; "before afternoon sessions" per
  CS-2026-07-13d). Run the migration during a study window and active students lose in-flight sessions
  mid-test. Worse, "reversible until P7" is not true from the student's chair: the moment the first
  post-migration completion lands on a canonical doc, restoring backups would erase that student's day(s). The
  REAL point of no return is the first post-migration study session — **hours after the script, not 14 days**.
- **Evidence:** P5 deploy-gate line (no G5); P5 non-regression ("in-flight session_states dropped/rebuilt");
  CS-2026-06-28 (class-hour failure spikes 06h=93/08h=80); CS-2026-07-13d ("before afternoon sessions" was
  itself an ops constraint); F-3 (`scan_F3_dualenroll.json`): 36 LIVE-STRAND are *actively studying* — they are
  exactly the students most likely to be mid-session.
- **Fix:** add to P5: (a) a mandatory low-traffic execution window (late-night KST, after the day's last
  sessions); (b) a 24–48h G5-class watch with named signals — `csd_anchor_invalid`, `list_progress_quarantined`,
  `impossible_phase_detected`, `day_guard_rejected`, first-N-canonical-session spot checks, and TA-channel
  volume; (c) an honest reversal statement: "clean reversal only before the first post-migration completion;
  after that, reversal requires a merge-back script" — and pre-write that merge-back script as part of the
  rehearsal.

### F6-2 · HIGH — Teacher progress views are not in the P4 cutover inventory → they freeze at P5 and break at P7
- **Location:** FIX_PLAN P4 change list (names only "Dashboard panel C" + "render AND session-entry paths");
  P5; P7 (deletes legacy docs). Code `[V-6]`: `src/pages/ClassDetail.jsx:25/:198` →
  `fetchStudentsProgressForClass` → `src/services/progressService.js:518-538` → `getClassProgress` reads raw
  per-class `class_progress` docs for every student × list. Same family: `db.js:542` comment ("other metrics
  derived from class_progress"), `studyService.js:908-939` (blind-spot cache in class_progress).
- **Problem (teacher/TA impact):** `resolveListProgress(listId)` is a uid-scoped callable — a teacher resolving
  ANOTHER student's progress cannot use it, and 40 students × 3 lists per class view makes per-student callable
  fan-out a non-starter anyway. So the teacher "Students" tab (the surface CS-2026-07-09b documents as "reads
  class_progress") is structurally OUTSIDE the P4 resolver route. If it isn't separately migrated: post-P5,
  writes go canonical while ClassDetail still reads legacy → **every teacher sees every student's day number
  frozen at migration-day values** (an entire cohort of phantom "stuck students" reported into the TA channel —
  the exact ticket shape the program exists to end); at P7, legacy deletion makes it worse — every student
  displays as "not started." The plan's own goal "keep gradebook/teacher views coherent through the migration"
  has no work item carrying it.
- **Evidence:** CS-2026-07-09b ("'Students' shows Day 8 because it reads `class_progress`"); the P4 text routes
  reads through the resolver but every named consumer is student-side; P6 rules (a) only excludes
  `list_progress`/`class_progress` from client *writes* — teacher *reads* of canonical docs are possible, but
  no code change is scheduled to point teacher fetches at the new collection.
- **Fix:** add to P4 (or a P5 rider): an explicit inventory of ALL progress readers — student (Dashboard,
  session-entry, test pages `TypedTest.jsx:851/:994`, `MCQTest.jsx:578/:733`) AND teacher
  (`fetchStudentsProgressForClass`, dashboard stats, blind-spot cache) — with the teacher path re-pointed to
  direct `list_progress` reads (legacy fallback until P5). P5 rehearsal acceptance must include: "a teacher
  view shows post-migration day numbers correctly."

### F6-3 · HIGH — The CS toolchain (sweep, manual-pass, census) is class_progress-shaped; P5 changes the model under it with no scheduled rework
- **Location:** FIX_PLAN C-38 (P1 pre-step: sweep learns `reviewOnlyDay` — only); X5 (§3.7); P5 procedure
  (sweep + census2 re-run as the after-check). SUPPORT_RUNBOOK §1 script catalog; CLAUDE.md CS rules.
- **Problem (operational safety):** the program's own safety spine (X5: sweep + F-4 census before/after every
  write) is executed by scripts whose signatures — dup/orphan progress, docId mismatch, TWI>list, ghost
  progress — are all defined against `users/{uid}/class_progress/{classId}_{listId}`. P5 makes
  `list_progress/{listId}` the truth. Un-reworked, the post-P5 sweep scans a dead collection and reports CLEAN
  forever (worse than no sweep: false assurance at exactly the phases — P6/P7/P9 — that lean on it). Same for
  `manual-pass.mjs`: it writes a class-keyed progress doc + session_state; between P5 and P10 (override
  callable), manual-pass is still the ONLY unstick tool for permafail/lost-save students (3 permafail now,
  F-6; the class recurs — 양서현's case cycled through 수기채점), and post-P5 it would write values the
  resolver never reads. The hand-patch treadmill wouldn't just persist — it would silently stop working.
- **Evidence:** SUPPORT_RUNBOOK §1 (both scripts' contracts); `scan_F6_FINDINGS.md` (3 permafail now,
  recurring); FIX_PLAN P10 acceptance itself assumes "every SUPPORT_RUNBOOK manual-pass event class has an
  in-product path" only AT P10 — leaving a P5→P10 window with no working manual unstick.
- **Fix:** add a P5 pre-step (peer of C-38): `data-integrity-sweep.mjs` + `deepfix-census2.mjs` +
  `manual-pass.mjs` learn the canonical model (dual-mode: legacy signatures until migration, list_progress
  signatures after; manual-pass writes the doc the resolver reads + still stamps the full valid anchor),
  rehearsed on 25WT alongside the migration rehearsal. Log the rework in SUPPORT_RUNBOOK.

### F6-4 · HIGH — The plan's real calendar contradicts promises already made in the TA channel; the finished-everything students have no interim
- **Location:** FIX_PLAN P9 (hard gate P6) + P3 acceptance ("M4 shadow false-reject ≈ 0 over **≥14 days** of
  live traffic") + P6→P7 (≥14 days) — i.e., start-over/cycling is realistically **4–6+ weeks out**. §7.6
  defers only the product knobs; no timeline is surfaced anywhere.
- **Problem (expectation/ops):** David told the TAs, verbatim: 07-10 "이번 주말에 관련 기능 업데이트 예정입니다"
  (feature update this weekend), and 07-13 "목록 끝나고 나서 다시 처음부터 하게 하는 기능은 **오늘 밤에** 업데이트
  될 예정입니다" (start-over ships TONIGHT), and instructed manual Ascent tests for the Summit finishers
  "오늘까지만" (through today only) — TA_CHATLOG 07-10 15:37 / 07-13 11:11 / 07-13 14:11. The plan silently
  re-schedules "tonight" to ~a month away and says nothing. Concretely stranded: the **5 finished-everything
  students** (함지민†, Soul Kim, 유찬†, 이가온, Young Cho — SESSION_CONTEXT §4; 2 already 수강종료, arguably
  *because* the product had nothing for them) plus every future Summit finisher stays on the daily
  manual-test/수기채점 treadmill until P9 — the very treadmill the plan's thesis says doesn't hold. CONT-A
  can't help them (no next list to link).
- **Fix:** (a) add an honest calendar band per phase (even ±week granularity) to §0.3 so David can re-set TA
  expectations deliberately; (b) give the finished-everything cohort a named interim in P8's scope — e.g., the
  P8 terminal for a student with NO `nextListId` and all lists finished should at least surface review
  sessions as the daily activity ("keep these sharp") rather than a static congratulation, and the plan should
  say whether the manual-test treadmill continues (owned by whom) until P9; (c) fold "walk back the 'tonight'
  promise" into the comms item (F6-6).

### F6-5 · MED — P8's focus-yield is specified at the wrong branch of `getPrimaryFocus`: explicit pins bypass it, and ~287 students carry CS-written pins
- **Location:** FIX_PLAN P8 "Focus-yield (C-13 fix)" cites `Dashboard.jsx:1084-1108`. Code `[V-6]`: that range
  is step **2a** (the recency-ranked auto-select). The explicit-preference branch — step 1,
  `Dashboard.jsx:1055-1078` — **returns first** whenever `settings.primaryFocusListId` is set, and never
  reaches the ranking.
- **Problem (student impact):** CS has explicitly pinned focus at scale: **200 students** pinned to ASCENT
  (CS-2026-06-28b), **87** batch-advanced via `primaryFocus` (CS-2026-07-13d/e), plus individual cases. A yield
  implemented only at :1084-1108 never fires for a pinned student — when the 200 Ascent-pinned students finish
  Ascent, their pin holds focus on the finished list and they land on the static terminal daily, un-yielded.
  That is the C-13 population the fix claims to dissolve, and it is the *majority* pattern in the live cohort
  because CS created it.
- **Fix:** specify the yield at the resolution level (after step 1 AND step 2a: "if the resolved focus list is
  finished (`twi ≥ listTotal`) and its launching-class assignment has `nextListId`, yield"), or clear/rewrite
  the pin on finish; add a pinned-student persona to P8's tests. One line in the plan; a cohort-sized miss if
  left to implementation.

### F6-6 · MED — No TA-facing comms/runbook item exists for ANY phase, and "silent" is not a real option for P5
- **Location:** §7.3 (migration comms: "one-line notice vs silent" — deferred to David); P1/P5 pre-steps
  (none mention the TA channel); SUPPORT_RUNBOOK (no planned entry template for the deploys).
- **Problem:** the TA channel is the de-facto monitoring system — every anomaly lands there within hours
  (오하린's ticket on 07-13 was a **20-word** start-position discrepancy). P5 forward-jumps 36 actively-studying
  students by hundreds of words / many day-numbers (F-3 example: twi 200 → 1520) — silent, that is a
  guaranteed same-day ticket flood, answered by TAs who were never told, spending David's time re-explaining
  per-student ("진도는 개인 진도입니다" already had to be said by hand on 07-13). P1 also changes what students
  and TAs see (the wall error → finished terminal + hero; the de-alarmed C-27 modal): TAs will otherwise keep
  applying the old runbook ("tell them to pass the new-word test"). The student-facing notice is genuinely
  David's call; the TA-channel pre-brief is not a decision, it is an ops requirement.
- **Fix:** make a one-paragraph TA-channel pre-brief a mandatory pre-step of P1, P5, P8, and P9 (what changed,
  what students will see, what NOT to report), each mirrored as the SUPPORT_RUNBOOK CS entry the standing rules
  already require. Leave only the student-facing notice in §7.3.

### F6-7 · MED — The G5 watch windows watch the wrong signal on the wrong clock for P1's payload
- **Location:** P1 deploy gate: "G5 60-min watch window (permission-denied signature alert >3/30min; baseline
  118/18h on 06-29)".
- **Problem:** the permission-denied alert is the 06-29 *save-failure* signature — the right standing guard for
  functions/rules deploys, but P1's payload is completion-path logic whose regression modes (a legitimate day
  failing to complete; a review-only day mis-classified; TWI motion) emit `reviewNoNewPass` sweep hits,
  `day_guard_rejected`, `csd_anchor_invalid`, or *nothing at all* — never permission-denied. And 60 wall-clock
  minutes after an off-peak deploy observes near-zero traffic: 26SM activity is class-hour-concentrated
  (06h/08h spikes, CS-2026-06-28; afternoon sessions, CS-2026-07-13d). The watch can trivially pass while the
  first real cohort exposure is 12h later with nobody watching.
- **Fix:** re-anchor every G5 window to "through the first peak study window post-deploy," and give P1 a
  payload-matched signal set: completion-success rate on review-only days, `reviewNoNewPass` vs the predicted
  floor (31), `day_guard_rejected` trend, `csd_anchor_invalid` ≈ 0 — these are already in P1's *acceptance*;
  they belong in the *watch*.

### F6-8 · MED — §7's "nothing else blocks execution" hides that three decisions sit on P5's critical path; add needed-by phases
- **Location:** §7 header; P5 procedure ("[C7-2] … the 70 EXT-cohort items need David's scope decision
  (§7.2)"); §7.3 (comms — needed before migration day); §7.8 (write authorizations — literally the P5/P6/P7
  gates).
- **Problem:** as written, a reader can conclude the whole decision list is fire-and-forget. In fact: #2
  (EXT-cohort quarantine scope) is a named P5 precondition; #3 must be decided before migration day; #8 IS the
  P5/P6/P7 execution trigger; #5 shapes the P8 backfill; #6 gates P9's knobs; #4 gates P10. If David defers the
  list wholesale (which the header invites), P5 stalls at its gate with the cohort mid-program.
- **Fix:** one column: "needed by <phase>". Re-title the section "Decisions and their deadlines." Keep the
  plan's correct observation that none block *starting* (P0–P4).

### F6-9 · MED — The P5 write-target flip for `completeSession` is unstated; a non-atomic flip splits the brain for same-day students
- **Location:** P4 flags/data ("completion still writes csd/twi to the LEGACY `class_progress` doc via
  `completeSession` until P5"); P5 procedure (flips only `resolveListProgress` to write-capable; never says
  when/how `completeSession` starts writing canonical); §8.3 h (flags the resolver mode-switch atomicity, but
  not the writer's).
- **Problem:** between the migration script finishing and `completeSession` switching targets, a student who
  completes a day writes LEGACY while every read is CANONICAL → their day silently doesn't appear (to them or
  their teacher) until the P7 catch-up merge — a fresh mini-#11 experience manufactured on migration night,
  on whichever students study first. The plan clearly *intends* one atomic server-side mode flip; it just
  never says the writer is included in it.
- **Fix:** one sentence in P5's procedure: "the same server-side mode flag flips `resolveListProgress`
  write-capable AND `completeSession`'s write target to canonical, atomically, as the migration's final step";
  add a rehearsal persona: student session in flight across the flip completes into the canonical doc.

### F6-10 · LOW — CONT-A dual-enroll semantics: accepted, with one sharpening
- §8.3 e's "launching class governs the link" is coherent with class=policy, and the risk is naturally small
  IF the P8 `nextListId` backfill is uniform across classes sharing a list (conventional Base→Ascent→Summit —
  which `next-list-by-class_2026-07-13.md` supports). State that uniformity as a backfill rule, and the
  dual-enroll confusion surface (98 students pre-P5, F-3) collapses to teacher-intended divergence only. The
  planned persona test stands.

### F6-11 · LOW — P9 rollback UX for mid-lap students is asserted, not verified
- P9 says flag-off re-dead-ends mid-lap students "into the P8 terminal (no corruption)". A lap-2 student's
  monotonic virtual twi exceeds listTotal; under non-cycling code the finished-hero/terminal math
  (`wordsLeft = listTotal − twi` → negative) and day displays are unexercised. Add a "rollback persona"
  (mid-lap student under `cyclingEnabled=false`) to P9's test list so the escape hatch is known-good before
  it's needed.

### F6-12 · LOW — P1's acceptance executor is unresolved; name the fallback bar now
- P1's sandbox acceptance depends on a harness that cannot run in this env and whose Codex-side egress
  preflight TIMED OUT (SESSION_CONTEXT §3: NOT_READY). The plan's fallback ("manual §8 tests against 25WT") is
  right, but with 183 students at the wall the pressure to shortcut will be real. Name the executor
  (David/Codex), the minimal test list (review-only plan §8 tests 1–8), and the evidence artifact up front so
  the gate can't be eroded in the moment.

---

## Scrutiny-point coverage (the six assigned questions)

1. **Migration-day UX (P5):** the data-side protections are strong — the hard asserts (0 twi/csd regressions,
   P-patches survive, NOBODY H→B) mean no student can *see an apparent loss*, which is the alarming direction;
   the v2 HIGH-5 amendment correctly protects the RO-unfrozen from re-quarantine on durable attempt evidence.
   What remains unsafe is the *operational* frame: no execution window, no watch, dropped in-flight sessions,
   overstated reversibility (F6-1), a comms plan that treats "silent" as viable (F6-6), and an unstated writer
   flip (F6-9). The forward jump itself (36 students) is the right outcome — they stop re-doing words they own.
2. **Deploy sequencing:** hosting-only-first is the correct harm-reduction order; the full-bundle-at-HEAD risk
   is honestly handled (client-delta review vs `a967f54`). No phase's rollback strands a student mid-flow
   EXCEPT P5's (F6-1: the real no-return point is the first post-migration completion, not P7) and the known
   accepted P6 stale-bundle residual ([C8-1] — adequately bounded by the 14-day no-legacy-write precondition +
   the P4 denial→reload handler). G5 as specified is insufficient for P1's payload (F6-7).
3. **Teacher/TA & CS surface:** the plan retires the treadmills in the right order (P8 kills batch-advance,
   P10 kills manual-pass demand) — but leaves the teacher progress views out of the cutover (F6-2), the CS
   tooling un-migrated across the model change (F6-3), and a P5→P10 window where the only unstick tool writes
   to a dead collection. C-38 is correct but is one-tenth of the tooling story.
4. **Forward design:** CONT-A/CYC/OVR genuinely deliver David's three asks; the split argument (§2.1) is
   sound and falsifiable as written; capability-gated rendering ("start over" only post-P9) is the right
   dead-button defense; student-chooses default matches the verbatim request. The two real product gaps: the
   focus-yield misses pinned students as specified (F6-5), and the last-list finisher has nothing until P9
   (F6-4). Dual-enroll link semantics are acceptable with the uniform-backfill rule (F6-10).
5. **David-decisions (§7):** the set is right and nothing is mis-deferred — the plan itself correctly refuses
   to let the token-guidance fix (zero-code; the TA channel demonstrably taught students wrong rules, including
   by David: "다음 주에 challenge reset" vs the verified 30 days) wait for P10. But the "nothing blocks
   execution" framing is wrong for #2/#3/#8, which gate P5 (F6-8).
6. **Operational safety:** X5 and the CS-event authorization chain are respected throughout — I found **no
   phase requiring a live write the program isn't authorized to make** (P1/P2/P3 write nothing; P5/P6/P7 and
   the two config backfills are all explicit David-authorized CS events per §7.8). The one self-undermining
   gap: X5's instruments themselves go stale at P5 (F6-3) — the discipline survives only if the tools do.

## Verdict on rollout safety for the live 26SM cohort

**CONDITIONAL GO.** P0→P4 are safe to execute as written (with the F6-7 watch re-anchoring, which is cheap).
P5 must not run until F6-1 (window + watch + honest reversal), F6-2 (teacher read surfaces), F6-3 (CS tooling
rework), and F6-9 (atomic writer flip) are folded in — all are additive amendments inside the existing phase,
none disturb the backbone or the v2 Codex folds. F6-4/F6-6 (timeline honesty + TA comms) cost a page and
prevent the failure mode this program was chartered to end: real students and TAs discovering the system's
behavior changed by hitting it.
