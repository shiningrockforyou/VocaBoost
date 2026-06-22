# Phase 1 — Server-Side Attempt Write: Deploy & Client-Cutover Handoff

**Date:** 2026-06-22 · **Plan:** `PLAN_server_side_attempt_write_v2.md` §13

## What's done (committed-pending-your-commit, in `functions/index.js`)
The **server half** of Phase 1 — additive, backward-compatible, **does nothing until a client sends `writeContext`** (none does yet, so deploying it changes zero live behavior):
- `writeAttemptTxn` — the one true server writer (transactional, idempotent on the client `attemptDocId`, server-authoritative scoring/passThreshold, anchor echo + invalid-anchor refusal, enrollment check).
- `submitVocabAttempt` — new callable (MCQ write + typed write-retry).
- `readExistingAttemptForContext` / `normalizeExistingAttempt` / `buildTypedAttemptAnswers` — helpers.
- `gradeTypedTest` — extended: HttpsError-ified, pre-AI existence check, writes via `finishGrading` when `writeContext` present, returns the grade un-rebilled on write failure.

**Validation done here:** `node --check` clean; scoring/pass/anchor logic dry-run passes (MCQ 10-of-50 → 20% not 100%; review-always-passes; new-anchor refusal). eslint shows only the pre-existing env-gap `no-undef` errors — and deploy's predeploy is `eslint . || exit 0`, so it can't block.

## Step 1 — YOU deploy the functions (I can't — no creds in the container)
On Windows / PowerShell, from the repo root:
```
firebase deploy --only functions
```
Safe to deploy now: it's non-breaking (no client sends `writeContext`). Watch for: `gradeTypedTest` + `submitVocabAttempt` deploy green; no new errors in the functions log.

## Step 2 — I do the client cutover (after deploy), validated against the live function
Why after deploy: the client change reorders studyDay-derivation before grading, handles the 3-branch response (`attemptWritten` / `alreadyWritten` / `attemptWritten:false`), and must preserve recovery on write-failure — all in the live test flow. I'll write it **flag-gated (default OFF)** and validate each branch against the deployed function on a `ta@`/25WT sandbox persona before flipping anything for real students. Files: `TypedTest.jsx`, `MCQTest.jsx` (+ a `SERVER_ATTEMPT_WRITE` flag).

## Step 3 — Validate on sandbox (post-cutover, flag ON for sandbox only)
- Typed + MCQ full pass writes the attempt server-side.
- **Failure injection:** kill the client right after the function returns → attempt is STILL written (the whole point).
- **Idempotency:** retry/double-submit → no duplicate (same `attemptDocId`).
- **Retake:** fail-then-retake same day → two distinct attempts (nonce rolls).
- **MCQ partial:** 10-of-50 answered → 20%, not 100%.
- `scripts/cs/data-integrity-sweep.mjs` clean after (no invalid anchors produced).

## Step 4 — Gradual rollout, then Phase 4 lock-down
Flip the flag per-class / percentage; monitor; then `create`-only firestore.rules tightening + MCQ server re-grade fast-follow. Phase 3 (progress writes into the txn) is the remaining piece for full grade+progress atomicity.

## Open decision already made
`users.stats.credibility/retention` update: **deprecated server-side** (grep found 0 UI consumers). If you later want it, replicate inside `writeAttemptTxn`.
