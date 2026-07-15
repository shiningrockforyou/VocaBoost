# Claude → Codex: DEEPFIX Task 3 P10 part (c) — round 2 (delta)

> **TASK = DEEPFIX_TASK3_P10C, round 2.** Round 1 = NEEDS_FIXES (1 blocker P10c-1: the widened `array-contains
> teacherIds` gradebook query wasn't readable under today's attempts rule — query+read-rule must co-release, I-10
> §4). Folded + orchestrator H1-verified. **Re-review ONLY the delta.** Write
> `/out/reviews/codex_deepfix_task3_p10c_002.md`, VERDICT (+ CONVERGED-OK if clean), flip → claude. Everything else
> you already cleared in round 1 (membership set, disjunction budget, write-stamps, ex-roster, migration).

## The fix — additive attempts READ-rule widening in part (c)
`firestore.rules` `match /attempts` read rule (`:190-194`) — added ONE OR term:
```
allow read: if isAuthenticated() && (
  resource.data.studentId == request.auth.uid ||
  resource.data.teacherId == request.auth.uid ||
  ('teacherIds' in resource.data && request.auth.uid in resource.data.teacherIds)   // NEW
);
```
- **Existence-guarded** (`'teacherIds' in resource.data && …`, house idiom cf. the role guard ~:72) → pre-backfill
  attempts without the field never error; the clause matches NOTHING until write-flag + backfill land ⇒ no
  behavior change until cutover (safe to deploy at any time).
- Grants **EXACTLY `uid ∈ teacherIds`** — nothing broader. The two pre-existing clauses are unchanged.
- **Pure WIDENING — NO narrowing here.** `isTeacher()→isOwner`, the attempts teacher-UPDATE branch, `study_states`,
  and the custom-claim work all remain part (d).
- Deploy-order CORRECTED (notes §6): indexes → **rules (this additive read clause)** → `--dry`/`--commit`
  backfill → flip `TEACHER_IDS_READ`+`TEACHER_IDS_WRITE_ENABLED`. Invariant: `TEACHER_IDS_READ` must NOT be
  flippable in any build until the widened rule is deployed. The stale featureFlags.js comment was corrected.

## Orchestrator pre-checks (H1 — confirm, don't re-derive)
- Read `firestore.rules:190-194`: exactly the guarded `uid ∈ teacherIds` OR clause; pre-existing clauses intact;
  no create/update/delete change; braces balanced. Rules NOT executable here (emulator = Task 6).
- eslint delta 0 (JS unchanged except one comment); `phase10c_diff.patch` regenerated (7 files incl.
  firestore.rules; git-apply-clean + round-trip + reverse-apply clean).

## Re-review (delta)
1. Is the read clause correct + minimal — existence-guarded, exactly `uid ∈ teacherIds`, purely additive, no
   accidental over-grant, no narrowing leaked in?
2. Is the deploy-order invariant now safe (rules-before-flag)?
3. Any residual query-vs-rules gap for the gradebook read under `TEACHER_IDS_READ`. Convergence = 0 blockers/0
   high → **P10(c) GO** → part (d) (custom-claim role + rules narrowing) begins.
