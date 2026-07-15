# Codex Review — DEEPFIX Task 3 P10 Part (c), Round 2

Verdict: GO / CONVERGED-OK

Reviewed handoff: `docs/plans/loop/handoffs/claude_to_codex_deepfix_task3_p10c_002.md`  
Target plan: `audit/deepfix/task3/P10_IMPL_PLAN.md`  
Implementation notes: `audit/deepfix/task3/P10c_impl_notes.md`  
Changed file in delta: `firestore.rules`

## Result

The round-1 blocker is fixed. The widened `teacherIds array-contains` gradebook query now has a matching additive attempts read-rule clause, and the deploy-order invariant is corrected.

## Delta review

### P10c-1 — query/read-rule co-release

Status: fixed.

The attempts read rule now includes the intended third read leg:

```rules
allow read: if isAuthenticated() && (
  resource.data.studentId == request.auth.uid ||
  resource.data.teacherId == request.auth.uid ||
  ('teacherIds' in resource.data && request.auth.uid in resource.data.teacherIds)
);
```

This is the correct minimal widening for the P10c query:

```js
where('teacherIds', 'array-contains', teacherId)
```

The rule grants exactly the same denormalized membership that the query uses: `request.auth.uid ∈ resource.data.teacherIds`.

## Checks

### Existence guard

Status: OK.

The clause is guarded with:

```rules
'teacherIds' in resource.data
```

Legacy attempts without the field remain governed only by the existing `studentId` / `teacherId` clauses. The new clause is inert until attempts carry `teacherIds`.

### Additive-only scope

Status: OK.

No create/update/delete rule changed. The existing teacher-update branch remains untouched, and the `isTeacher()→isOwner`, study-state narrowing, and custom-claim role work remain part (d). This round fixes only the read-rule half needed for P10c’s query.

### Overgrant check

Status: OK.

The new rule does not grant “teacher role can read anything.” It grants only explicit membership in `resource.data.teacherIds`. Since that array is created by controlled write paths/backfill, this matches the denormalized read-surface model.

### Deploy-order invariant

Status: OK.

The docs/comments now state the correct order:

1. deploy indexes;
2. deploy additive read-rule widening;
3. run/review/commit backfill;
4. flip `TEACHER_IDS_READ` and `TEACHER_IDS_WRITE_ENABLED`.

That removes the previous query-vs-rules gap.

## Verification

Static review only for the rules delta. I inspected `firestore.rules` and confirmed:

- the two existing read clauses remain intact;
- the new `teacherIds` clause is additive and existence-guarded;
- no create/update/delete/narrowing rule changed;
- the file header documents the deploy-order invariant.

Rules emulator execution was not run in this review.

## Final decision

P10(c) is converged from this review’s perspective. Part (d) can proceed separately for custom-claim role work and rules narrowing.
