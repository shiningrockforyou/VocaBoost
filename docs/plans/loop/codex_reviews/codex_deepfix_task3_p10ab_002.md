# Codex Review — DEEPFIX Task 3 P10 (OVR) Parts (a)+(b), Round 2

Verdict: GO / CONVERGED-OK

Reviewed handoff: `docs/plans/loop/handoffs/claude_to_codex_deepfix_task3_p10ab_002.md`  
Target plan: `audit/deepfix/task3/P10_IMPL_PLAN.md`  
Implementation notes: `audit/deepfix/task3/P10_impl_notes.md`  
Changed file in delta: `functions/foundation.js`

## Result

The round-1 blocker is fixed. I do not see a remaining blocker/high in P10(a)+(b).

## Delta review

### P10-1 — target-bound authorization for `overrideAttempt`

Status: fixed.

The prior failure mode was: authorize against one subject, then write a fresh manual-pass anchor for a different request-supplied subject.

The new implementation closes that in both paths.

#### Attempt-id path

Location: `functions/foundation.js:2153-2179`

When `attemptId` is supplied:

- the callable loads the attempt;
- `tStudentId`, `tClassId`, `tListId`, and `tStudyDay` are derived from the loaded attempt;
- `listId` falls back to the existing `testId` parse only if the attempt has no `listId`;
- missing target fields reject;
- any request-supplied target field that conflicts with the loaded attempt rejects;
- authorization is checked against that same loaded attempt via `assertOverrideAuthz`.

The written doc id and anchor fields then consume the `t*` variables, not the untrusted request target.

#### No-attempt/orphan path

Location: `functions/foundation.js:1808-1833`, `2180-2199`

When no `attemptId` is supplied:

- the request must supply `studentId`, `classId`, `listId`, and integer `studyDay`;
- the dedicated `assertOverrideTargetAuthz` requires:
  - caller is a teacher;
  - caller owns the exact target class;
  - the student is enrolled in that exact target class;
  - that class assigns the target list.

This correctly avoids reusing the broad “owns any enrolled class” union for a fresh-authoritative anchor write.

#### Anchor write

Location: `functions/foundation.js:2201-2235`

The anchor construction is now target-bound:

- class read uses `tClassId`;
- assignment lookup uses `tListId`;
- day-1 pace lookup uses `tStudentId` and `tClassId`;
- doc id uses `tStudentId/tClassId/tListId/tStudyDay`;
- anchor `studentId/classId/listId/studyDay/testId` use the same `t*` target;
- day-advance and audit log use the same `t*` target.

I do not see a remaining authorize-X/write-Y path.

## Flag-off check

Still OK.

`overrideAttempt` still throws `failed-precondition` as its first statement when `SERVER_OVERRIDE_ENABLED=false`, so the new target-binding logic is unreachable while dark. The client flag remains `SERVER_OVERRIDE=false`.

## Non-blocking contract note

`overrideAttempt` always writes a `sessionType:"new"` manual-pass anchor. The attempt-id path derives the target from the loaded attempt, but it does not require the loaded attempt itself to be a new-word attempt. That is acceptable for this dormant draft if the future UI only exposes override for the intended “manual-pass new-word false negative / orphan” cases. If the eventual UI can pass arbitrary review attempts into this callable, add a server-side guard requiring the loaded attempt to be a new-word target before writing a new anchor.

I am not marking this as a blocker because the callable’s documented semantics are “fresh valid new anchor,” the UI entrypoint is deferred, and the target-binding/security issue from round 1 is closed.

## Verification

Ran:

```bash
node --check functions/foundation.js
npm run build
```

Both passed. Vite emitted only existing bundle/chunk warnings.

## Final decision

P10(a)+(b) are converged from this review’s perspective. Parts (c)/(d) remain out of scope and can proceed under the chosen read-surface/role-model decisions.
