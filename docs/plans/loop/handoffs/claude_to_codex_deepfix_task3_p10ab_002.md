# Claude → Codex: DEEPFIX Task 3 P10 (OVR) (a)+(b) — round 2 (delta)

> **TASK = DEEPFIX_TASK3_P10, round 2.** Round 1 = NEEDS_FIXES (1 blocker P10-1: `overrideAttempt` authorized one
> subject but wrote another). Folded + orchestrator H1-verified. **Re-review ONLY the P10-1 delta.** Write
> `/out/reviews/codex_deepfix_task3_p10ab_002.md`, VERDICT (+ CONVERGED-OK if clean), flip → claude. (c)/(d) still
> OUT OF SCOPE — David has now chosen U1=A (teacherIds-array denorm+migration) / role=A (custom claim), so (c)/(d)
> follow once (a)/(b) converge.)

## The fix — `overrideAttempt` write target is now BOUND to the authorization (two paths)
`functions/foundation.js`:
- **attemptId path (`:2153-2179`):** the write target `tStudentId/tClassId/tListId/tStudyDay` is derived FROM the
  loaded attempt, NEVER the request; a missing attempt → `not-found`; missing target fields → `invalid-argument`;
  **any request target field that conflicts with the loaded attempt → `invalid-argument`** (no authorize-X-write-Y).
  Authz = `assertOverrideAuthz(callerId, priorAttempt)` on the loaded attempt (the union you already accepted as
  target-bound for reviewChallenge). `assertOverrideAuthz` itself UNCHANGED.
- **orphan path, no attemptId (`:2180-2199`):** NEW strict `assertOverrideTargetAuthz(callerId,{studentId,classId,
  listId})` (`:1808`) — caller is a teacher AND owns the EXACT `classId` (`ownerTeacherId===caller`) AND the student
  is enrolled in THAT `classId` AND the class assigns THAT `listId`. The broad "owns any enrolled class" leg is NOT
  reused here.
- **The write (`:2205-2235`) + docId (`:2221`) consume the `t*` target-bound vars** (class read, day-1 pace lookup,
  anchor fields, docId) — authorized subject === written subject on both paths.

## Orchestrator pre-checks (H1 — confirm, don't re-derive)
- Read `:2150-2235` + `:1808-1833`: both paths resolve `t*` and the write uses `t*` (not request fields);
  orphan authz enforces own-class ∧ enrolled ∧ assigns-list; attemptId path rejects conflicting request fields.
- Flag-off byte-equivalence preserved: `overrideAttempt:2134` still throws `failed-precondition` first-statement;
  the entire P10-1 rework is downstream of that throw. `reviewChallenge` + `assertOverrideAuthz` (loaded-attempt
  paths) untouched. The 3 non-foundation files byte-unchanged from round 1.
- Validation: parser ×4; eslint delta 0; `phase10ab_diff.patch` git-apply-clean + round-trip cmp-clean.
- NOTE: the agent had a mid-run scripting slip that briefly reverted `foundation.js`; I re-verified the working
  tree holds BOTH the round-1 (a/b) callables AND the round-2 target-binding (all symbols present incl.
  `assertOverrideTargetAuthz:1808`).

## Re-review (delta)
1. Is the target-binding COMPLETE — any remaining path where the authorized subject ≠ the written subject
   (docId or anchor field sourced from an unvalidated request value)?
2. `assertOverrideTargetAuthz` correctness — own-class ∧ enrolled ∧ assigns-list; no privilege hole; the
   `enrolledClasses` hasOwnProperty check right?
3. attemptId-path conflict rejection + the testId→listId fallback (`:2165-2168`) — safe?
4. Flag-off byte-equivalence intact. Convergence = 0 blockers/0 high → **P10(a/b) GO** → (c)/(d) begin.
