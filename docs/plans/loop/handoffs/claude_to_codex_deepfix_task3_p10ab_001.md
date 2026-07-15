# Claude → Codex: DEEPFIX Task 3 P10 (OVR) parts (a)+(b) — review the DRAFT

> **TASK = DEEPFIX_TASK3_P10, round 1.** FIX_PLAN Phase P10 (OVR — teacher override + challenge redesign), the
> DECISION-INDEPENDENT core only: **(a) override callable + (b) reviewChallenge→server.** Parts (c) read-surface
> widening and (d) rules narrowing are DEFERRED pending owner decisions (U1 read-surface approach; the C-28 role
> model) — OUT OF SCOPE for this review. Dormant, DOUBLE-flag-gated, LOCAL-ONLY. Review correctness + flag-off
> byte-equivalence. Write `/out/reviews/codex_deepfix_task3_p10ab_001.md`, VERDICT (+ CONVERGED-OK if clean),
> flip → claude. ADJUDICATE U1–U9 in `P10_impl_notes.md`.

## BINDING RULE (David): "always verify all claims… Never trust blindly. Always verify."

## Read
- **Plan:** `audit/deepfix/task3/P10_IMPL_PLAN.md` §0/§1(a)(b)/§3 + `audit/deepfix/task2/FIX_PLAN.md` P10. Key §0
  finding: P10(b)'s twi-clamp + `phase==='new'` gate were ALREADY done by P4's `advanceForChallenge` — this draft
  REUSES them, does not rebuild them.
- **Draft + uncertainties:** `audit/deepfix/task3/P10_impl_notes.md` (U1–U9). Diff:
  `audit/deepfix/task3/phase10ab_diff.patch` (git-apply-clean + round-trip cmp-clean).
- **Changed files:** `functions/foundation.js` (the spine + both callables), `functions/index.js` (re-exports),
  `src/config/featureFlags.js` (client `SERVER_OVERRIDE=false`), `src/services/db.js` (client routing).

## Verify (priority)
1. **★ The `advanceForChallenge` REFACTOR is the load-bearing risk (already-converged deploy-stack code).**
   `runChallengeDayAdvanceTxn` (`foundation.js:1681`) was extracted from the transaction that lived INLINE in
   `advanceForChallenge` through P9. **Diff the extracted helper against the pre-P9 inline tx** — is it TRULY
   verbatim (same clamp `min(allocation, wordsRemaining)` lap-aware, same `phase==='new'` gate, same reads/writes,
   same order)? Any behavior drift = BLOCKER (it would change the P4 challenge path when SERVER_CHALLENGE_WRITE
   flips). `advanceForChallenge` (`:1899`) must be byte-identical in behavior post-refactor + still flag-gated
   (`:1826`).
2. **Flag-off byte-equivalence (orchestrator pre-checked — confirm):** `reviewChallenge:1950` +
   `overrideAttempt:2091` throw `failed-precondition` as their FIRST statement (no reads/writes when off); client
   `db.js` changes are one `if (SERVER_OVERRIDE)` early-return branch + additive exports. Both foundation flags
   false.
3. **overrideAttempt (`:2090`):** writes the FULL valid anchor (manual-pass.mjs parity — nwsi/nwei/wordsIntroduced/
   testId), advances via the shared helper, audit-logs `teacher_override`. Correct anchor shape? Idempotent/safe?
4. **reviewChallenge port (`:1949`):** faithful to the client body (answer-flip / score+`newPassed` with
   persisted-`totalQuestions` denom / `challenges.history` / `study_states` PASSED) + day-advance via helper?
5. **Authz — `assertOverrideAuthz` (`:1765`):** the I-10 §6 UNION — teacher AND (`attempt.teacherId===caller` OR
   current-enrollment owner, renameStudent pattern); unrelated teacher DENIED. Both callables enforce it. Correct
   + no privilege hole?
6. **U3 (two-hop):** reviewChallenge preserves today's two-hop (answer-flip commits, then day-advance) rather than
   one atomic tx — failure semantics match today (answer-flip can commit while day-advance no-ops). Acceptable, or
   should it be atomic? Also adjudicate U2 (fresh-anchor override), U5 (review-pass twi-flat, inherited from P4),
   U7 (advanceForChallenge authz left stamp-only).

VERDICT + CONVERGED-OK if 0 blockers/0 high. GO = (a)+(b) are a correct, safe, dormant draft; (c)/(d) resume once
David picks the read-surface + role-model lanes.
