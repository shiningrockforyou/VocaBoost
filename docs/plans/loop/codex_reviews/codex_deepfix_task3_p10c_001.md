# Codex Review — DEEPFIX Task 3 P10 Part (c), Round 1

Verdict: NEEDS_FIXES

Reviewed handoff: `docs/plans/loop/handoffs/claude_to_codex_deepfix_task3_p10c_001.md`  
Target plan: `audit/deepfix/task3/P10_IMPL_PLAN.md`  
Implementation notes: `audit/deepfix/task3/P10c_impl_notes.md`  
Changed files: `src/config/featureFlags.js`, `functions/foundation.js`, `functions/index.js`, `src/services/db.js`, `firestore.indexes.json`, `scripts/cs/deepfix-migrate-attempts-teacherids.mjs`

## Summary

The denormalization shape is mostly coherent and flag-off dormancy is intact, but the draft is not signable as a C-19 read-surface fix yet because the widened client query is not paired with a Firestore attempts read-rule widening.

With `TEACHER_IDS_READ=true`, the gradebook query changes to:

```js
where('teacherIds', 'array-contains', teacherId)
```

Current `firestore.rules` still allow attempt reads only when:

```js
resource.data.studentId == request.auth.uid ||
resource.data.teacherId == request.auth.uid
```

A query whose result set may contain `teacherId != request.auth.uid` is not permitted by those rules. So the inherited-attempt read path this draft adds will fail at the rules layer unless the read-rule widening is co-released before or with the client flag flip.

## Findings

### P10c-1 — BLOCKER — widened query is not deployable without the attempts read-rule widening

Locations:

- `src/services/db.js:2075-2080`
- `firestore.rules:167-173`
- `src/config/featureFlags.js:155-161`
- `audit/deepfix/task3/P10c_impl_notes.md §6`

Current flag-on query:

```js
let attemptsQuery = query(
  collection(db, 'attempts'),
  TEACHER_IDS_READ
    ? where('teacherIds', 'array-contains', teacherId)
    : where('teacherId', '==', teacherId),
  orderBy('submittedAt', 'desc')
)
```

Current rules:

```rules
allow read: if isAuthenticated() && (
  resource.data.studentId == request.auth.uid ||
  resource.data.teacherId == request.auth.uid
);
```

This is exactly the I-10 query-vs-rules same-release problem. `teacherIds array-contains uid` does not imply `teacherId == uid`, so Firestore cannot prove this query is safe under the current rule. Inherited attempts where the teacher is present only in `teacherIds` remain unreadable.

The draft acknowledges that the attempts read-rule widening is part of the same-release rule, but still treats rules as a later part (d) and its deploy checklist flips `TEACHER_IDS_READ` before the rules widening. That ordering is not safe.

Required fix:

- Either include the additive attempts read-rule widening in this part (c) draft:

```rules
uid in resource.data.teacherIds
```

or equivalent guarded form, while leaving narrowing/custom-claim work for part (d);

- or explicitly split P10c into:
  1. indexes + denorm + migration only, with `TEACHER_IDS_READ` not allowed to flip;
  2. a same-release query+rules widening cutover.

The important invariant: `TEACHER_IDS_READ` must not be flipped in any build until deployed rules allow `teacherIds` reads. Otherwise the gradebook inherited-attempt query fails or silently degrades depending on how the caller handles the Firestore error.

## Checks that passed

### Membership-set definition

Status: acceptable.

The list-scoped set:

```text
{stampTeacherId} ∪ {ownerTeacherId of currently-enrolled classes that assign the attempt list}
```

is narrower than broad override authz, but it is the better read-surface default. It surfaces the canonical C-19 case: a promoted student continuing the same list in the new class. I would keep this narrower read scope unless David explicitly wants every broad-authz teacher to see every attempt.

### Disjunction budget

Status: OK by static reasoning.

Replacing `teacherId == uid` with `teacherIds array-contains uid` does not add an `in`/`array-contains-any` fanout. It remains a factor of 1, so the existing `classDisjuncts * filterStudentIds.length <= 30` guard still bounds the DNF product.

Still validate the exact indexed query shape in emulator/live staging before cutover.

### Write-stamp coverage

Status: mostly OK.

The new field is stamped at:

- server `writeAttemptTxn`;
- server `writeUpgradedReviewMarker`;
- server `overrideAttempt`;
- server `reviewChallenge` update via additive `arrayUnion`;
- client MCQ/typed submit paths under `TEACHER_IDS_READ`.

The `reviewChallenge` re-stamp is acceptable. It is additive and helps inherited attempts become visible even if they predate backfill.

### Ex-roster name-filter pre-scan

Status: acceptable with documented degradation.

The bounded cached `teacherIds array-contains` pre-scan is a reasonable client-side draft, with the known cap risk. The cap should be treated as a product/ops choice; it is not a blocker for this dormant draft.

### Migration

Status: acceptable for draft/backfill design.

The migration is dry-by-default, commit-guarded, union-never-demote, idempotent via `teacherIdsBackfilledAt`, and backs up before commit. Cohort scoping by attempt `classId` is a documented limitation; `--all` is the appropriate escape hatch for full reindex.

## Non-blocking notes

- `computeTeacherIdsForAttempt` falls back to stamp-only on read failure. That can under-stamp during an infrastructure/read fault, but the field is additive and the migration can repair it. Acceptable.
- No `joinClass`/promotion-time re-stamp exists yet. That means future promotions need either periodic backfill or a follow-up append path. Acceptable as deferred if explicitly tracked.
- The `teacherIds` index family is additive. The four-index set is reasonable for avoiding flag-on query errors across existing gradebook filters.

## Verification

Ran:

```bash
node --check functions/foundation.js
node --check functions/index.js
node --check scripts/cs/deepfix-migrate-attempts-teacherids.mjs
npm run build
```

All passed. Vite emitted only existing bundle/chunk warnings.

## Final decision

P10c needs one blocking correction before GO: bind the `teacherIds` read-rule widening to the same cutover as the `TEACHER_IDS_READ` query, or prevent the query flag from being considered flippable until that rule exists.
