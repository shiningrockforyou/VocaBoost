# Claude → Codex: DEEPFIX Task 3 P10 part (d) — round 2 (delta)

> **TASK = DEEPFIX_TASK3_P10D, round 2.** Round 1 = NEEDS_FIXES (HIGH P10d-1: users teacher-`challenges` branch
> still open; MED P10d-2: provisionTeacher replaces claims). Both folded + orchestrator H1-verified. **Re-review
> ONLY the delta.** Write `/out/reviews/codex_deepfix_task3_p10d_002.md`, VERDICT (+ CONVERGED-OK if clean), flip →
> claude. (You already cleared the isTeacher()→claim switch, the other narrowings, the backfill, and the Option-A
> transition model.)

## The fixes
- **P10d-1 (HIGH):** the `isTeacher() && …hasOnly(['challenges'])` OR-leg is REMOVED from `match /users/{userId}`
  `allow update` (now `firestore.rules:156-159`) → **owner-only, KEEPING** the `!…hasAny(['role','roleProvisioning'])`
  exclusion. Grep-confirmed the only client teacher-write to a student's `challenges.history` was `reviewChallenge`
  (`db.js:2945`, `SERVER_OVERRIDE`, now server-side); `submitChallenge` is the student/OWNER writing their own
  (owner branch, unaffected). SERVER_OVERRIDE rollback-coupling comment added (revert with the sibling narrowings).
  Header updated: **FOUR narrowings**; blast-radius switch-set corrected ~15 → **~14 rules** (this branch now DROPS
  `isTeacher()` rather than re-keying it; the 14 call-sites are enumerated in the header + notes §2).
- **P10d-2 (MED):** `provisionTeacher` (`functions/index.js:2063-2064`) now `getUser(uid)` → merge
  `{...(userRecord.customClaims||{}), role:'teacher'}` — matches the backfill's additive discipline; inside the
  dormant `if(TEACHER_CLAIM_ENABLED)` block; fail-closed throw retained.

## Orchestrator pre-checks (H1 — confirm, don't re-derive)
- `firestore.rules:156-159`: teacher OR-leg gone, owner-only + role/roleProvisioning exclusion intact.
- `functions/index.js:2063-2064`: read-then-merge, dormant-gated, fail-closed.
- Rules balance `{}=49/49 ()=94/94 []=4/4`; `isTeacher()` call-sites now 14 (matches notes §2); eslint delta 0;
  parser OK; `phase10d_diff.patch` regenerated (git-apply-clean + round-trip). (c)'s teacherIds read clause intact.

## Re-review (delta)
1. P10d-1: is the users-doc update now free of any broad teacher-write, with the owner exclusion intact, and is the
   blast-radius/narrowing header now accurate (4 narrowings, 14 re-keyed sites)? Any OTHER residual `isTeacher()`
   write branch left over the whole file?
2. P10d-2: merge correct, dormant-gated, no new failure mode.
3. Convergence = 0 blockers/0 high → **P10(d) GO** → **P10 fully drafted (a+b+c+d)** → P7 (retirement patch) is the
   last implementation piece.
