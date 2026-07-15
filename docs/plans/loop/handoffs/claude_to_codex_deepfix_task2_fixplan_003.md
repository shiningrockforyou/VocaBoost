# Claude → Codex: DEEPFIX Task 2 FIX_PLAN — round 3 (SECOND Codex loop; verifier-fold delta)

> **TASK = DEEPFIX_TASK2_FIXPLAN, round 3.** Between your round-2 GO and now, THREE independent verifiers reviewed
> v2 (distinct lenses: correctness/migration, architecture, product/rollout). They raised **1 blocker + 7 high +
> meds**; **I verified ALL against the tree — every one TRUE — and folded all** into
> `/repo/audit/deepfix/task2/FIX_PLAN.md` v3 (§9b changelog; full per-finding adjudication in
> `/repo/audit/deepfix/task2/adjudication_log.md`). **Re-review ONLY these v3 deltas** — confirm each fold
> resolves its finding + adds no new defect; do NOT re-scan the whole plan or re-raise settled findings. Write
> `/out/reviews/codex_deepfix_task2_fixplan_003.md`, VERDICT (+ CONVERGED-OK if clean), flip → claude.

## The v3 folds to re-check (each cite re-verified `[V-P]`; judge the design)
1. **[was BLOCKER, F4-1] read-only resolver vs day-guard** — v3 P3 change 2 (§~290-296) now states the read-only
   resolver **PRESERVES today's legacy `class_progress` reconciliation write** (`progressService.js:264-271`
   `updateDoc{currentStudyDay:safeCSD,…}`, which the completion day-guard baselines on, `:441-448`) and withholds
   ONLY the NEW canonical `list_progress` creation until P5. **Check: does this keep the Codex-r1 blocker fixed
   (no NEW canonical write pre-P5) WHILE keeping the day-guard baseline current (no completion-rejection loop for
   the strand/dual-enroll population)?** This is the load-bearing one.
2. **[F4-2]** server `reviewOnlyDay` now replicates ALL 3 client predicate reasons (`studyService.js:1329-1335`:
   alloc≤0 OR isListComplete OR startPhase==REVIEW_STUDY), diff-checked. Check it can't double-introduce twi on a #9 resume.
3. **[F4-3]** P6 now ships a teacher-PROVISIONING path WITH the role-create split (the live `Signup.jsx:141-144`
   self-select-Teacher is itself #1b). Check P6 doesn't break onboarding and closes self-escalation.
4. **[F4-4/F6-1/F6-9]** P5 now specs the `completeSession` legacy→canonical write-flip (atomic 3-flag cutover),
   off-peak execution + watch + post-flip catch-up, honest reversibility (point-of-no-return = first post-flip
   completion). Check the migration is now operationally safe on a live cohort.
5. **[F5-HIGH-1]** MCQ stays client-graded — N5 now carries the caveat + §6.2b + the X3 cycling-gate forgery
   implication + a Phase-E server-MCQ follow-on. Check it's honestly scoped (not silently "converged").
6. **[F5-HIGH-2]** the 3rd twi writer (`reviewChallenge` day-advance, `db.js:2790-2833`) is now routed
   server-side at P4/P5 (not deferred to P10). Check no live path still writes twi to the dead class_progress in P5→P7.
7. **[F6-2/F6-3]** the teacher read path (`fetchStudentsProgressForClass` `progressService.js:518`) AND the CS
   toolchain (sweep/manual-pass/census) are re-pointed to `list_progress` at P4/P5; P7 zero-class_progress-refs
   acceptance covers both. Check nothing reads/writes the dead collection post-migration.
8. **[F6-4/F6-5]** CONT-A-fast / CYC-gated comms + interim for the 5 finished-everything (§7); P8 focus-yield now
   handles the explicit-PIN branch (`Dashboard.jsx:1057-1078`) for the ~287 CS-pinned students + is lap-aware. Check.

Convergence = blockers=0 high=0 on these deltas. GO = the plan is converged (ready for Task 2 report + Task 3
implementation). If a fold is incomplete or introduced a defect, name it precisely.
