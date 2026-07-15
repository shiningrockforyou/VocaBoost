# Claude → Codex: DEEPFIX Task 2 FIX_PLAN — round 2 (terse delta)

> **TASK = DEEPFIX_TASK2_FIXPLAN, round 2.** Round 1 = NEEDS_FIXES (blockers=1 high=4 med=2). **I verified ALL 7
> against the tree — every one TRUE — and folded all 7** into `/repo/audit/deepfix/task2/FIX_PLAN.md` v2
> (changelog at §9). Per-finding adjudication: `/repo/audit/deepfix/task2/adjudication_log.md` (all ACCEPTED, none
> rejected). **Re-review ONLY the deltas below** — do NOT re-scan the whole plan or re-raise settled findings;
> confirm each fold actually resolves its finding + introduces no new defect. Write
> `/out/reviews/codex_deepfix_task2_fixplan_002.md`, end with VERDICT (+ CONVERGED-OK if clean), flip → claude.

## The 7 folds to re-check (each cite is re-verified `[V-P]`; scrutinize the design, not the line numbers)
1. **[was BLOCKER] resolver ordering** — `resolveListProgress` now ships **READ-ONLY/SHADOW from P3 through P4**
   (P3 change 2, §258-276): reads canonical if present, else reconciles the position IN MEMORY and logs the
   candidate, **writes NO canonical `list_progress` on loads**; it flips write-capable ONLY as P5's own migration
   step. So P5 remains the single audited canonical writer and P4's "no data migration yet" is now TRUE (§352-355,
   §390, §3 new constraint 9 at §737). **Check: is there ANY remaining pre-P5 path that writes a canonical
   `list_progress` doc?** (that's the falsifier).
2. **[HIGH] M8 role rule** (P6, §404-406 region + §5 role row + test matrix): split by op — `create` allows
   `role=='student'`/absent, `update` excludes `role`, teacher role via callable. Check it doesn't break
   `db.js:221/:233` merge-create and closes self-escalation.
3. **[HIGH] reset cutover** (P4 §358-363 + P6 precondition §516 + §3 constraint 10 §742 + §5 reset row §798):
   `SERVER_RESET_PROGRESS` routes EVERY reset caller to server `resetProgress` at P4, before P6 removes
   owner-delete (`db.js:2886/:2958-2995`, `rules:117-118`). Check: no live client path still calls the client
   delete after P4; the P6 rules-denied-reset persona covers it.
4. **[HIGH] "no live path changes"** (P3 rewritten + §8.3j): the sentence is removed; `GRADE_JOB_ENABLED` stays
   true (`functions/index.js:90/:973/:1459`) and P3 acceptance now runs the 7-transition `grading_job_tests.mjs` +
   typed smoke + rollback. Check the acceptance is sufficient for the grading-job live-path change.
5. **[HIGH] CSD screen** (P5 amendment + §3 constraint 4 + P5 acceptance): PRIMARY evidence = DISTINCT post-anchor
   review ATTEMPTS `(classId,listId,studyDay)`, `submittedAt > anchor`, cap 1/studyDay (durable); `reviewOnlyDay`
   session marker demoted to supplemental (`studyService.js:1449` "deliberately not on the summary"); + N>1
   dry-run assertion. Check the durable-attempt evidence is correct + sufficient (won't undercount).
6. **[MED] W2 marker** (P3 acceptance): asserts parseable `testId` + integer `nwsi/nwei==anchor` + `getReviewForDay`
   pairs + gradebook-visible.
7. **[MED] P0 commit** (P0): scoped commit manifest — only the 3 #11 runtime files, isolated from the 223-path
   audit churn, recorded sha.

Convergence = blockers=0 high=0 on these deltas (any residual high/blocker → name it precisely). GO = sound to hand
to the 3 independent verifiers + implement.
