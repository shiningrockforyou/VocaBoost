# Codex Review — DEEPFIX Task 3 P10 (OVR) Parts (a)+(b), Round 1

Verdict: NEEDS_FIXES

Reviewed handoff: `docs/plans/loop/handoffs/claude_to_codex_deepfix_task3_p10ab_001.md`  
Target plan: `audit/deepfix/task3/P10_IMPL_PLAN.md`  
Implementation notes: `audit/deepfix/task3/P10_impl_notes.md`  
Changed files: `functions/foundation.js`, `functions/index.js`, `src/config/featureFlags.js`, `src/services/db.js`

## Summary

The dormant flags and client routing are shaped correctly, and the `advanceForChallenge` transaction extraction looks behavior-preserving from the current code. However, `overrideAttempt` has a target-binding authorization hole: the authorization check can be satisfied by one attempt/class while the callable writes a fresh manual-pass anchor to a different caller-supplied target.

That is a blocker because `overrideAttempt` is the powerful path that creates authoritative reconciliation anchors.

## Findings

### P10-1 — BLOCKER — `overrideAttempt` authorizes one subject but writes another

Location: `functions/foundation.js:2118-2124`, `2145-2159`

Current behavior:

```js
let priorAttempt = null;
if (attemptId && typeof attemptId === "string") {
  const priorSnap = await db.collection("attempts").doc(attemptId).get();
  priorAttempt = priorSnap.exists ? priorSnap.data() : null;
}
const authzTarget = priorAttempt || {studentId, classId, teacherId: null};
const authz = await assertOverrideAuthz(callerId, authzTarget);
```

Then the callable writes an anchor using the request-supplied `studentId`, `classId`, `listId`, and `studyDay`:

```js
const docId = `${studentId}_${classId}_${listId}_day${studyDay}_typed_new_manual`;
await db.collection("attempts").doc(docId).set(anchor, {merge: true});
```

The authorization result is not bound to the target being written.

Concrete failure modes:

1. If `attemptId` is supplied, a teacher can authorize against a real attempt they are allowed to touch, then supply a different `studentId` / `classId` / `listId` in the same request. The fresh anchor is written for the request target, not for the authorized attempt target.
2. If `attemptId` is omitted or invalid, the synthetic target only carries `{studentId, classId, teacherId:null}`, but `assertOverrideAuthz` ignores the synthetic `classId`; it authorizes if the caller owns any class the student is currently enrolled in. That means a teacher who owns one enrolled class for the student can write an override anchor for a different caller-supplied class/list.

Why this matters:

- `overrideAttempt` creates a valid passed-new anchor with `newWordStartIndex`, `newWordEndIndex`, `wordsIntroduced`, `testId`, and `submittedAt`.
- That anchor is reconciliation-authoritative.
- Admin SDK bypasses Firestore rules, so the callable must fully bind authorization to the exact write target.

Required fix:

- If `attemptId` is supplied, either:
  - require the request target fields to match the loaded attempt’s target fields (`studentId`, `classId`, `listId`, and likely `studyDay` / `sessionType` as appropriate), or
  - derive the override target from the loaded attempt instead of trusting request target fields.
- If no attempt is supplied, authorize the exact target:
  - caller must be a teacher;
  - caller must own the supplied `classId`;
  - the supplied `studentId` must be enrolled in that same `classId`;
  - the supplied `classId` must assign the supplied `listId`.
- Do not allow “owns any enrolled class” to authorize an override for an arbitrary other `classId`.

This is separate from `reviewChallenge`: `reviewChallenge` acts on the loaded attempt itself, so its union authz is target-bound.

## Checks that passed

### Dark flags / flag-off byte equivalence

Status: OK.

- `reviewChallenge` throws `failed-precondition` as its first statement when `SERVER_REVIEW_CHALLENGE_ENABLED=false`.
- `overrideAttempt` throws `failed-precondition` as its first statement when `SERVER_OVERRIDE_ENABLED=false`.
- `SERVER_REVIEW_CHALLENGE_ENABLED=false`, `SERVER_OVERRIDE_ENABLED=false`, and client `SERVER_OVERRIDE=false`.
- `src/services/db.js` routes to the new callable only inside `if (SERVER_OVERRIDE)`, so the legacy client body remains the flag-off path.

### `runChallengeDayAdvanceTxn` extraction

Status: OK from static review.

The extracted helper preserves the important P4/P9 behavior:

- missing progress doc returns `no_progress_doc`;
- stale day guard uses `attempt.studyDay === currentDay + 1`;
- day-2+ new pass advances `session_states` to `review-study` without incrementing CSD;
- day completion increments CSD;
- TWI increment is clamped to remaining words when non-cycling;
- P9 cycling removes the remaining-words cap;
- TWI increment remains phase-gated to `phase === "new"`;
- `advanceForChallenge` remains gated by `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED=false`.

I do not see behavior drift in the extracted transaction body itself.

### `reviewChallenge` server port

Status: acceptable for this draft.

The port carries over the main client legs:

- pending challenge guard;
- answer status flip and `isCorrect=true` on accept;
- score recompute with persisted `totalQuestions` denominator;
- review attempts always pass, new attempts threshold-gate;
- `challenges.history` status update;
- accepted challenge writes `study_states/{wordId}` to `PASSED`;
- below-to-pass day advance delegates to the shared helper.

The two-hop shape is preserved server-side rather than made atomic. I accept that as the lower-risk parity choice for this draft.

### Authz union for `reviewChallenge`

Status: OK.

For `reviewChallenge`, `assertOverrideAuthz(callerId, attempt)` is applied to the loaded attempt that is actually being updated. That makes the stamp-or-current-enrollment union target-bound in this path.

## Adjudication notes

- U2 fresh-anchor override: acceptable only after P10-1 binds authorization to the exact target.
- U3 two-hop reviewChallenge: acceptable; it preserves today’s failure semantics.
- U4 override class precision: not optional. The current implementation is too broad and is the P10-1 blocker.
- U5 review-pass TWI-flat semantic: inherited from P4; not a new P10 blocker.
- U6 manual-pass threshold default `92`: acceptable as explicit manual-pass parity for now.
- U7 leaving `advanceForChallenge` stamp-only: acceptable for this scoped draft because `SERVER_OVERRIDE` routes the full review path away from it.
- U9 deferring parts (c)/(d): acceptable. Missing read-surface/rules edits are out of scope for this review.

## Verification

Ran:

```bash
node --check functions/foundation.js
npm run build
```

Both passed. Vite emitted only existing bundle/chunk warnings.

## Final decision

Do not proceed to GO until `overrideAttempt` authorization is target-bound.
