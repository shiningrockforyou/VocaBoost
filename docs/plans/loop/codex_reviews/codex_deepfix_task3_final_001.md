# Codex review — DEEPFIX_TASK3_FINAL round 1

## Verdict

NEEDS_FIXES. I found one cross-phase deploy-order blocker. The per-phase code that was already converged still looks coherent in isolation, and the static checks/build passed, but the composed rules artifact does not currently support the phase order described by the implementation log.

Validation run:

- `node --check functions/foundation.js`
- `node --check functions/index.js`
- `node --check scripts/cs/deepfix-migrate-list-progress.mjs`
- `node --check scripts/cs/deepfix-migrate-attempts-teacherids.mjs`
- `node --check scripts/cs/deepfix-backfill-teacher-claims.mjs`
- `npm run build`

All passed.

## Finding FINAL-1 — BLOCKER — The single `firestore.rules` artifact combines the P6 cutoff and P10d claim/narrowing deploys, so there is no safe P6-only rules deploy from the current working tree

Files:

- `firestore.rules:3-77`
- `firestore.rules:98-112`
- `firestore.rules:182-196`
- `firestore.rules:250-301`
- `audit/deepfix/task3/P10d_impl_notes.md:118-145`
- `audit/deepfix/task3/adjudication_log.md:80-117`, `:190-209`

Defect:

The composed `firestore.rules` file now contains both:

1. P6 foundation cutoff rules: attempts `create/update/delete:false`, progress subcollection client-write denial, role self-write split.
2. P10d rules: `isTeacher()` switched to `request.auth.token.role == 'teacher'`, teacher write branches removed for user subcollections / attempts / user challenges.

That is not just staging prose; it is the actual deploy artifact. `isTeacher()` already reads the custom claim at `firestore.rules:110-111`, and the P10d narrowings are present in the same file as the P6 cutoff.

The per-phase deploy story does not compose:

- The adjudication log treats P6 as a foundation deploy step before P9/P10 (`P3+P4+P5+P6 = foundation complete`, then P9, then P10).
- P6’s header says `firebase deploy --only firestore:rules` after P3/P4/P5 prerequisites.
- P10d’s notes say the same rules file is undeployed until the P10 cutover and requires `TEACHER_CLAIM_ENABLED=true`, the claim backfill, and token refresh before rules deploy.

Those two statements cannot both be operationally true for one physical `firestore.rules` file. If David deploys `firestore.rules` at the P6 point using the current tree, P10d also deploys early. That switches all teacher-gated rules from doc-role to custom-claim before the P10d preconditions and can lock teachers out of class/list/system_log/AP/gradebook surfaces. If David waits to deploy the file until P10d, then P6 is not actually deployed/soaked before P9/P10, violating the documented P9/P10 foundation prerequisite and leaving direct client attempt/progress write authority open longer than the foundation plan claims.

Concrete failure scenario:

1. P3 functions + P4 client + P5 migration are ready.
2. Operator follows P6 header and runs `firebase deploy --only firestore:rules`.
3. Current rules deploy includes `isTeacher() -> request.auth.token.role` and the P10d narrowings.
4. Existing teacher accounts whose Auth tokens do not yet carry `role:'teacher'` fail every teacher-gated rule, even though the P10d backfill/refresh step has not happened.

Fix:

Create explicit deployable rules artifacts or a mechanically enforceable patch sequence:

- `firestore.rules.p6` / patch: P6 cutoff plus P10c additive `teacherIds` read clause only if intentionally co-released, but **no** P10d claim switch/narrowings.
- `firestore.rules.p10d` / patch: applies the claim model and P10d narrowings only after `TEACHER_CLAIM_ENABLED=true`, claim backfill, token refresh, and rules tests.

Then document one global deploy order that names the exact artifact used at each rules deploy. The important part is not the file naming; it is that a P6 rules deploy from the repo cannot accidentally include P10d.

Until this is fixed, I would not call the final whole-surface gate clean.

## Cross-phase checks that looked acceptable

- P5 migration and P7 retirement do not appear to directly conflict. P7 is prepared-not-applied and deliberately excludes the reconciliation-core collapse and P10 flags, which is conservative.
- P7 write-path patch removes only the three P4/P6 write-path fallbacks and documents its post-soak preconditions. I did not find it deleting a still-needed P9/P10 path.
- The P9/P10 server-side invariant composition looks consistent at static-review level: `completeSession`, `advanceForChallenge`, `reviewChallenge`, and `overrideAttempt` all route through durable progress refs and the cross-class cycling resolver where expected.
- `teacherIds` read-surface widening is additive in rules, but because it lives in the same physical rules file as P10d, its safe-anytime property is only true if deployed via an additive-only rules artifact.

## Required next review

After fixing FINAL-1, send a delta focused on:

1. The exact deploy artifacts / patch files for P6, P10c additive read, and P10d narrowing.
2. The single global cutover order.
3. Proof that no command named in the P6 step can deploy P10d accidentally.
