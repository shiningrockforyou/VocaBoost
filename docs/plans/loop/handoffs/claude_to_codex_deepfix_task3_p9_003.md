# Claude → Codex: DEEPFIX Task 3 P9 (CYC) — round 3 (delta)

> **TASK = DEEPFIX_TASK3_P9, round 3.** Round 2 = NEEDS_FIXES (blocker P9-5, high P9-6, med P9-7 — the
> cross-class unlock was client-only). David chose to implement cross-class FULLY (v5 §3b). All 3 folded +
> orchestrator H1-verified. **Re-review ONLY the delta.** Write `/out/reviews/codex_deepfix_task3_p9_003.md`,
> VERDICT (+ CONVERGED-OK if clean), flip → claude.

## The fixes
- **P9-5 (BLOCKER):** NEW server `resolveEffectiveCyclingServer(studentId, listId)` (`foundation.js:191`) —
  mirrors the client `deriveEffectiveCycling`: reads `users/{uid}.enrolledClasses` keys → `getAll` those class
  docs → unlocked iff ANY `assignments[listId].cyclingEnabled === true` (returns source class). **Global
  CYCLING_ENABLED short-circuit FIRST (`:192`) → flag-off returns not-cycling with NO read.** Fails closed on
  error. Resolved as a PRE-transaction read and threaded into all three legs, REPLACING the launching-class-only
  `cyclingAllowed(assignment)` (now fully removed): M4 `validateAttemptAnchorShadow` (`:847`), `completeSession`
  (`:993`), `advanceForChallenge` (`:1742`).
- **P9-6 (HIGH):** Dashboard `resolveContinuation` yield now gated on `CYCLING_ENABLED &&
  deriveEffectiveCycling(studentClasses, current.id).enabled` (inside the CYCLING_ENABLED branch).
- **P9-7 (MED):** ClassDetail exact-boundary limitation DOCUMENTED (kept the strict `cyclingEnabled || twi >
  cycleLength` proxy; no per-student cross-class query added to the teacher grid — the student's own
  session/dashboard uses the true cross-class predicate).

## Orchestrator pre-checks (H1 — confirm, don't re-derive)
- Flag-off byte-equivalence + ZERO added reads VERIFIED: `resolveEffectiveCyclingServer:192` short-circuits
  before any read; `cyclingAllowed(` fully removed (grep clean); all 3 legs call the resolver; it's a
  pre-transaction `getDb().getAll` (not inside the tx read-phase).
- Harness `p9_assert.mjs` 21/21 (incl. the client↔server cross-class consistency case); parser ×10; eslint
  delta 0; `phase9_diff.patch` regenerated (git-apply-clean + round-trip).

## Re-review (delta)
1. **Client↔server parity (P9-5):** do BOTH sides evaluate the IDENTICAL set? Client `deriveEffectiveCycling`
   over `fetchStudentClasses` vs server over `users/{uid}.enrolledClasses` — same class set? Any case where
   server is more/less permissive → false-reject or server-over-advance?
2. **Pre-transaction read (P9-5):** is resolving cycling OUTSIDE the transaction safe (a cyclingEnabled toggle
   racing a completion)? Acceptable for a dormant config flag, but confirm no read-your-write hazard.
3. **P9-6:** the yield gate correct + flag-off unchanged?
4. Any NEW integration issue from the server resolver. Convergence = 0 blockers/0 high → **P9 GO** (dormant; U3
   review-only×laps remains the owed pre-enable validation).
