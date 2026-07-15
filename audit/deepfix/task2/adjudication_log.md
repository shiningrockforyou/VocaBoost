# Task 2 — adjudication log (Codex baton + fable-verifier findings)

Per-finding ACCEPTED/REJECTED-with-evidence (H1: every finding traced to code before folding). Codex loop first
(David's mandated Task-2 order), then the 3 fable verifiers, then the second Codex loop.

## Codex round 1 (FIX_PLAN v1) — `codex_reviews/codex_deepfix_task2_fixplan_001.md` — VERDICT blockers=1 high=4 med=2
**Orchestrator verdict: ALL 7 ACCEPTED (each verified-true against the working tree). Folded → FIX_PLAN v2.**

| # | Sev | Finding | Verification (orchestrator, [V-now]) | Disposition |
|---|---|---|---|---|
| 1 | blocker | P4 routes live clients through a write-capable `resolveListProgress` (hydrate-on-miss CREATES canonical) BEFORE P5's audited migration → canonical docs written on arbitrary loads pre-backup/authorization | Plan-internal contradiction confirmed (P3 §245-250 write-capable resolver; P4 §299-303 routes hydration + "read never write"; P5 §343-378 "THE migration"). Current model is writeful on access (`progressService.js:264-271`). | **ACCEPTED** → resolveListProgress READ-ONLY/shadow pre-P5 (reconcile in-memory, log candidate, NO canonical write); P5 eager script writes; post-P5 write-capable. |
| 2 | high | M8 role whitelist on `allow write` breaks user creation (create writes role) | `db.js:221` `role: docOverrides.role ?? 'student'` via `setDoc(…,{merge:true})` `:233` [V-now] | **ACCEPTED** → split create (role must be 'student'/absent) vs update (affectedKeys excludes role); role changes via callable; +rules tests. |
| 3 | high | P4 cutover doesn't route the client reset/delete path to server `resetProgress` before P6 removes owner-delete → reset breaks | client reset deletes attempts (`db.js` reset ~2957-2993 `where studentId+classId`); `firestore.rules` `allow delete: if resource.data.studentId==request.auth.uid` [V-now] | **ACCEPTED** → P4 hard req: SERVER_RESET_PROGRESS route, migrate every reset caller, greps/tests, P6 rules-denied-reset persona. |
| 4 | high | P3 "No live path changes" false — functions deploy activates GRADE_JOB_ENABLED grading-job path | `functions/index.js:90` `GRADE_JOB_ENABLED=true`; used `:973` gradeTypedTest, `:1459` getGradingStatus [V-now] | **ACCEPTED** → qualify/remove the sentence; add the full grading-job recovery suite to P3 acceptance (reuse `grading_job_tests.mjs`); keep JOB_ENABLED=true (already HEAD, Codex-reviewed×3), deploy validates it. |
| 5 | high | P5 CSD-plausibility amendment leans on the non-durable `reviewOnlyDay` marker (session_states only, not recentSessions) → undercounts multi-day | `studyService.js:1448-1449` comment: reviewOnlyDay "deliberately NOT on the summary"; written only to session_states `:1451-1456`; summary `:1460-1472` lacks it [V-now] | **ACCEPTED** → primary evidence = distinct post-anchor review ATTEMPTS by `(classId,listId,studyDay)` (durable), cap 1/studyDay, same lineage; marker supplemental; dry-run assert N>1 consecutive. |
| 6 | med | P3 W2 marker acceptance not asserted (current callable lacks range+testId) | `functions/index.js:580-597` marker has no testId/nwsi/nwei; pairing exact-range `db.js:3438-3444`; gradebook drops unparseable testId `db.js:1962-1977` [V-now] | **ACCEPTED** → P3 acceptance tests assert upgraded marker (parseable testId + int nwsi/nwei == anchor + getReviewForDay pairs + gradebook-visible). |
| 7 | med | Tree far dirtier than "three-file #11"; P0 needs a scoped commit manifest | `git status` = 223 changed/untracked (mostly audit/deepfix + scripts, stays uncommitted per David) [V-now] | **ACCEPTED** → P0 requires a scoped commit manifest (only the 3 #11 runtime files; isolate from audit churn; record sha; full client-delta review). Commit is David/owner's action. |

**Rejected: none.** Codex's "Claims checked and accepted" independently re-confirmed my load-bearing facts
(#9/#10/#11 present, G1 real, nonce double-derivation real, class-keyed identity, reviewChallenge gap + unclamped
twi writer). Round 1 was a clean, high-signal review — no evidence-backed rejections needed.

## Codex round 2 (FIX_PLAN v2, delta re-review) — `codex_deepfix_task2_fixplan_002.md` — **VERDICT 0/0/0/0 CONVERGED-OK / GO**
All 7 folds verified RESOLVED by Codex against the tree; the pre-P5 canonical-write falsifier PASSED (no remaining
path writes a canonical `list_progress` doc before the audited P5 migration; CONT-A creates only class-keyed docs
pre-P5, later migrated). **First Codex loop CONVERGED after one fold round** (round 1 substantive → round 2 clean
delta GO; SOP judgment: legitimate convergence). Two IMPLEMENTATION-phase notes carried to Task 3 (not plan
defects): (1) preserve the resolver mode-switch as an explicit server-side flag/constant with tests proving P4
cannot write canonical docs; (2) make "same student/list lineage" concrete in the migration script (not prose).

## 3 fable verifiers (2.4/2.5) — `plan_review_fable{4,5,6}.md` — all findings H1-verified by orchestrator
**Verdict: 1 BLOCKER + 7 HIGH + MED/nits — ALL VERIFIED-TRUE against the tree, NONE rejected. Strong cross-verifier
overlap (migration window ×3; reviewChallenge twi writer ×2; focus-yield ×2) = high-confidence signal. Fold → v3.**

| Finding | Verifier · Sev | Verification [V-now] | Disposition |
|---|---|---|---|
| **F4-1** read-only resolver dropped the entry-time reconciliation WRITE the day-guard depends on → completion rejection loop for strand/dual-enroll | #4 · **BLOCKER** | `progressService.js:264-270` writes `safeCSD` to class_progress; day-guard `:441-448` reads stored csd as baseline. VERIFIED. | **ACCEPTED** → clarify: read-only resolver PRESERVES today's LEGACY class_progress reconciliation write; only refrains from creating the NEW list_progress doc. (Resolves both the Codex blocker AND this.) |
| **F4-2** server reviewOnlyDay derives from allocation only, omits predicate reason 3 (REVIEW_STUDY resume) → twi double-introduce | #4 · HIGH | `studyService.js:1329-1335`: predicate has 3 reasons (alloc≤0 OR isListComplete OR startPhase==REVIEW_STUDY). VERIFIED. | **ACCEPTED** → server derivation must replicate all 3 reasons; diff-check asserts it. |
| **F4-3** P6 role-create rule breaks the LIVE teacher signup (self-select Teacher) | #4 · HIGH | `Signup.jsx:140-147` Teacher radio → `role: formState.role` `:38`. VERIFIED. | **ACCEPTED** → the teacher-provisioning path ships WITH P6 (or the signup flow changes); can't defer to P10. |
| **F4-4 / F6-1 / F6-9** P5 completeSession legacy→canonical write-flip unspecified; no off-peak exec window / watch / post-flip catch-up; reversibility overstated (point-of-no-return = first post-flip completion) | #4 HIGH + #6 HIGH | migration is the riskiest live event; class-hour peaks; in-flight sessions dropped. | **ACCEPTED** → spec the write-flip; add off-peak execution + watch window + post-flip delta pass; qualify reversibility. |
| **F5-HIGH-1** MCQ stays client-authoritative forever → N5 overstated; forged MCQ mints range-valid anchors post-lockdown | #5 · HIGH | `functions/index.js:438-442` "No 'server-mcq' until Phase E; selectedOptionId forgeable". VERIFIED. | **ACCEPTED** → acknowledge in §6 ledger + N5 caveat + the X3 cycling-gate forgery implication (server-MCQ is a scoped follow-on, not silently omitted). |
| **F5-HIGH-2** reviewChallenge (3rd twi writer) has no P4→P5 routing → writes dead class_progress P5-P10, no-ops post-P7 | #5 HIGH (+ #4 med) | `db.js:2790` hard-coded `class_progress` doc; `:2794` exists-guard; `:2831-2833` twi/csd write. VERIFIED. | **ACCEPTED** → route reviewChallenge day-advance to server WITH P4/P5 (not deferred to P10); it's the 3rd twi writer I-6 named. |
| **F6-2** teacher "Students" view reads class_progress directly; un-migrated → breaks at P7 | #6 · HIGH | `progressService.js:518` `fetchStudentsProgressForClass`→`getClassProgress`; `ClassDetail.jsx:198`. VERIFIED. | **ACCEPTED** → migrate the TEACHER read path to resolve from list_progress (P4/P5 scope; the plan covered only the student read path). |
| **F6-3** CS toolchain (sweep/manual-pass/census) is class_progress-shaped; no P5 rework → post-P5 false-CLEAN + writes dead collection | #6 · HIGH | scripts/cs/* read/write class_progress. | **ACCEPTED** → schedule the CS-toolchain rework into P5/P7 (the sweep + manual-pass + census must target list_progress); X5 depends on it. |
| **F6-4** start-over gated 4-6+ weeks vs David's "tonight" (07-13) promise; 5 finished-everything on manual treadmill, no interim/calendar | #6 · HIGH | David 07-13 chat + SESSION_CONTEXT §4. | **ACCEPTED** → surface that CONT-A (advance-to-next) ships fast post-RO; state the CYC timeline + interim handling for the 5 finished-everything; a David-comms item (§7). |
| **F6-5 / F5-med** P8 focus-yield misses the explicit-pin branch (`getPrimaryFocus` returns from `:1058-1078` before the recency branch) → ~287 CS-pinned students never auto-advance; also breaks under P9 cycling (twi≥listTotal) | #6 MED + #5 MED | `Dashboard.jsx:1058-1078` pin branch returns first; `:1084+` recency branch. VERIFIED. | **ACCEPTED** → P8 focus-yield handles the pin branch (pinned finished list yields to nextListId / advance updates the pin); make the yield lap-aware for P9. |

**MEDs/LOWs also folded** (text sharpening, no re-sequencing): P7 retirement inventory + zero-class_progress-refs
acceptance + flag lifecycle (~8 flags, CONTINUATION_LINKS orphan); client/server reviewOnlyDay fork → runtime
mismatch log (not just one-time diff-check); recon-overlay end-state decision; completeSession idempotency
(committed-but-lost retry vs day-guard); CSD screen per-doc own-anchor baseline bound to the merge rule; §7
"nothing blocks execution" corrected (decisions 2/3/8 gate P5); P1 G5 watch signal/clock (F6-7); nit cites
(P6(a) "P9"→P10; owner-delete `rules:120-122`; P8 focus cite).

**Cleared by the verifiers (no change):** the conflict rule vs all F-3 populations (counts re-verified
36/6/72/22/5=141); the review-attempt evidence mechanism; all 7 v2 Codex folds true; W3 supersession; P1
hosting-only safety; the one-migration keystone genuinely converges (no hidden second migration).

## Codex round 3 (SECOND loop, FIX_PLAN v3 verifier-fold delta) — `codex_deepfix_task2_fixplan_003.md` — **VERDICT 0/0/0/0 CONVERGED-OK / GO**
All 8 v3 verifier-fold deltas confirmed RESOLVED (incl. the F4-1 blocker: read-only resolver preserves the legacy
class_progress recon write AND withholds the new canonical write → no completion-rejection loop AND no pre-P5
canonical write; the reviewChallenge server-routing; the teacher read path + CS toolchain re-pointing; the P8
pin-branch focus-yield). **TASK 2 CONVERGED** — first Codex loop GO + 3-verifier folded + second Codex loop GO.

**Task-2 acceptance met (H2):** Codex GO (twice) + independent 3-agent (verifier) verification + all findings
folded. → Task 3 implementation authorized (David pre-authorized autonomous impl once converged).
Two Task-3 carryforwards from Codex r2: (1) resolver mode-switch = explicit server flag + tests proving P4 can't
write canonical; (2) "same student/list lineage" concrete in the migration script.
