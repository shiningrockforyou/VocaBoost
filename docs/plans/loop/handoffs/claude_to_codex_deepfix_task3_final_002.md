# Claude → Codex: DEEPFIX Task 3 — FINAL whole-surface review, round 2 (delta)

> **TASK = DEEPFIX_TASK3_FINAL, round 2.** Round 1 you found FINAL-1 (deploy-order composition BLOCKER). In
> parallel, 2 Fable reviewers found 12 more (F-2..F-13 + 3 nits) — orchestrator H1-verified the 4 HIGHs, folded
> ALL as 3 streams (A foundation-security, B rules-deploy-order, C client/scripts/misc). **Re-review the fold
> delta**: do the fixes CLOSE the findings, with no regression + flag-off byte-equivalence intact? You did NOT see
> the Fable findings in round 1, so verify those fixes too. Write `/out/reviews/codex_deepfix_task3_final_002.md`,
> VERDICT (+ CONVERGED-OK if clean), flip → claude.

## Read
- `audit/deepfix/task3/FINAL_REVIEW_FINDINGS.md` (the consolidated finding table F-1..F-13 + verdicts).
- Fold notes: `FINAL_FOLD_A_notes.md`, `FINAL_FOLD_C_notes.md`, `DEPLOY_ORDER.md` (+ `firestore.p6.rules` /
  `firestore.p10c.rules`). Patches (records; already applied to the tree): `final_fold_a.patch`, `final_fold_c.patch`.

## The fixes to verify (delta)
- **F-1 (B):** `firestore.rules` split into 3 stage artifacts + `DEPLOY_ORDER.md`. Confirm: `firestore.p6.rules` has
  NO claim-switch/narrowings (doc-role isTeacher, teacher branches present); the strict superset chain R1⊂R2⊂R3;
  the global order composes all per-phase preconditions; a P6 deploy cannot include P10d. Working-tree
  `firestore.rules` rule-LOGIC unchanged (header re-key only).
- **F-2 (A) — M4 enforce wired:** `validateAttemptAnchorShadow` now REJECTS (throws) on violation when
  `ANCHOR_VALIDATION_ENFORCE` (still false); shadow/log-only when off; read-error fails OPEN. Does it correctly
  reject the forged-anchor exploit (nwei≫server) when enforcing, and stay byte-identical when off?
- **F-4 (A) — completeSession evidence:** advances only with a day-N passed-`new` anchor OR a server-verified
  review-only reason, else `no_evidence` (no write); autoCompleted markers excluded from evidence. Does it still
  allow every LEGITIMATE completion (each of the 3 review-only reasons) + block the evidence-free pump?
- **F-3 (A):** resetProgress canonical mode now zeros csd/twi + fresh programStartDate. **F-6 (A):** getListAnchor +
  db.js `getMostRecentPassedNewTest` exclude pre-`resetAt` attempts, GATED behind dormant `SERVER_RESET_PROGRESS`
  (orch-verified byte-equivalent today); migration folds progress_meta + carries the tombstone. **F-5 (A):**
  overrideAttempt day-1 finder now list-matched + nwei clamped to listSize−1. **F-7 (A):** resolver twiSuspect
  second leg catches `invalid-anchor`. **F-12 (A):** assertOverrideTargetAuthz accepts legacy assignedLists.
- **C:** F-8 Signup getIdToken(true) on redemption; F-10 Start-over gated on effective cycling
  (`CYCLING_ENABLED && cyclingSourceClassId`); F-13 backfill scripts exit-2 on read-back mismatch; N-1/2 documented;
  F-9 deferred to P7 (inventory note).

## Orchestrator pre-checks (H1)
Byte-equivalence + tree-intact VERIFIED: F-6 live reader gated behind dormant SERVER_RESET_PROGRESS (db.js:3530);
F-2 both anchor flags off → early-return; F-10 flag-off → button absent; M-STATIC baseline CLEAN; all fold flags
still dormant; streams didn't cross-touch. eslint delta 0 per stream; patches round-trip cmp-clean.

## Re-review
Do the fixes CLOSE their findings (esp. F-1 stage isolation, F-2 enforce actually rejects, F-4 still allows all
legit completions)? Any NEW defect the fixes introduced? Any finding NOT adequately closed? Convergence = 0
blockers/0 high → **FINAL REVIEW CONVERGED** → the implementation is signed off (pending the Task-6 Playwright run).
