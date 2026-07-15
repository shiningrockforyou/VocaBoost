# Codex review — DEEPFIX_TASK3_FINAL round 2

Verdict: NEEDS_FIXES

I reviewed the round-2 fold packet:

- `docs/plans/loop/handoffs/claude_to_codex_deepfix_task3_final_002.md`
- `audit/deepfix/task3/FINAL_REVIEW_FINDINGS.md`
- `audit/deepfix/task3/FINAL_FOLD_A_notes.md`
- `audit/deepfix/task3/FINAL_FOLD_C_notes.md`
- `audit/deepfix/task3/DEPLOY_ORDER.md`
- touched implementation in `functions/foundation.js`, `functions/index.js`, `src/services/db.js`, `src/services/studyService.js`, UI pages, rules artifacts, and migration/backfill scripts.

## Summary

The original Codex blocker FINAL-1 is fixed in structure: there are now separate rules artifacts for P6, P10c, and P10d, and the deploy order explicitly prevents a P6 deploy from accidentally shipping the P10d claim switch/narrowings.

Most final-fold fixes are present and consistent with their stated scope:

- F-2: `validateAttemptAnchorShadow` now has a real `ANCHOR_VALIDATION_ENFORCE` throw outside the read-error catch.
- F-3: canonical reset now zeros CSD/TWI/recent fields and stamps a fresh program start in the canonical branch.
- F-5: `overrideAttempt` day-1 pace derivation is list-matched and non-cycling ranges are clamped to list size.
- F-6: server/client anchor readers and the P5 migration carry/reset-filter the pre-P5 reset tombstone.
- F-7: quarantine predicate is aligned with invalid-anchor + stored-TWI conditions.
- F-8/F-10/F-12/F-13/N-3 are reflected in the touched files/scripts or notes.
- Build and syntax checks pass for the inspected implementation.

But one new blocker remains in the F-4 client/server integration.

## Findings

### FINAL2-1 — BLOCKER — `completeSession` returns `no_evidence`, but the client treats it as successful completion

The F-4 server-side evidence gate is only half-wired.

Server behavior in `functions/foundation.js`:

- `completeSession` now returns `{status:"no_evidence", advanced:false, progressDay:...}` when `dayNumber === csd+1` but there is neither a passed day-N new anchor nor a server-verified review-only reason.
- The transaction writes nothing. This part correctly blocks the backend CSD/TWI pump.

Client behavior in `src/services/studyService.js`:

- `recordSessionCompletionViaServer` handles only:
  - `data.status === 'day_guard_rejected'`
  - `data.status === 'already_completed'`
- Any other status falls through to the assumed-completed path:
  - writes a `users/{uid}/sessions` history record;
  - returns `{sessionId, progress: data.progress || null}`.

Because `no_evidence` is not special-cased, a refused server completion still looks like a successful completion to `completeSessionFromTest` unless a later caller happens to infer failure from `progress:null`. The current callers do not:

- `completeSessionFromTest` only blocks on `result?.dayGuardRejected` after `recordSessionCompletion`.
- `TypedTest.jsx` and `MCQTest.jsx` only block on `requiresNewWordRetake` or `requiresSessionRebuild`.
- After the fall-through, `completeSessionFromTest` can also run `graduateSegmentWords(...)` for review tests even though the server refused to advance progress.

Impact:

- The backend CSD/TWI pump is blocked, but the UX and client side-effects can still falsely present success for an evidence-free completion.
- A refused review completion may still graduate reviewed words, creating partial state that the server explicitly declined to pair with a day completion.
- This undermines the F-4 invariant: “no attempt evidence → do not complete the day.” Today it becomes “do not advance the server progress doc, but still allow success-shaped client completion.”

Required fix:

- In `recordSessionCompletionViaServer`, handle `data.status === 'no_evidence'` explicitly and return a blocking sentinel, e.g. `requiresCompletionEvidence` / `completionNotApplied`, with `progress:null` and no session-history write.
- In `completeSessionFromTest`, propagate that sentinel before graduation.
- In `TypedTest.jsx` and `MCQTest.jsx`, block success UI with a retry/reload/pass-new-test message appropriate to the cause.
- Prefer fail-closed handling for any unknown `data.status`: do not assume `completed` unless `data.status === 'completed'` or the callable omits status only by intentional legacy contract. Since this path is behind `SERVER_PROGRESS_WRITE`, explicit status handling is safer.

## Cleared / notes

### F-1 stage artifacts — cleared

`audit/deepfix/task3/firestore.p6.rules` uses doc-role `isTeacher()` and contains the P6 cutoff without P10d claim/narrowing logic. `firestore.p10c.rules` adds the guarded `teacherIds` read clause without P10d narrowing. Working-tree `firestore.rules` remains the P10d final artifact. `DEPLOY_ORDER.md` documents the copy/deploy/restore choreography for R1/R2 and direct deploy only for R3. This fixes the previous no-safe-P6-deploy blocker.

### F-2 enforcement — cleared

`functions/index.js` calls `foundation.validateAttemptAnchorShadow(...)` before the attempt transaction. `functions/foundation.js` now returns early when both flags are false, logs in shadow mode, and throws `failed-precondition` only when `ANCHOR_VALIDATION_ENFORCE` is true and real violations were detected. The throw is outside the read-error catch, as required.

### F-3/F-5/F-6/F-7/F-12 folds — no blocking issue found in this pass

The inspected code matches the claimed direction. I did not run live emulator/rules tests; this was static review plus syntax/build validation.

### F-13 script path note

The round-2 evidence text refers generically to backfill scripts. The actual files present are:

- `scripts/cs/deepfix-migrate-attempts-teacherids.mjs`
- `scripts/cs/deepfix-backfill-teacher-claims.mjs`

Both parse cleanly and include nonzero exit discipline for commit readback/missing-auth conditions.

## Validation run

Passed:

```text
node --check functions/foundation.js
node --check functions/index.js
node --check scripts/cs/deepfix-migrate-list-progress.mjs
node --check scripts/cs/deepfix-migrate-attempts-teacherids.mjs
node --check scripts/cs/deepfix-backfill-teacher-claims.mjs
npm run build
```

`npm run build` completed with existing Vite chunk/dynamic-import warnings only.

## Decision

NEEDS_FIXES until FINAL2-1 is fixed and re-reviewed.
