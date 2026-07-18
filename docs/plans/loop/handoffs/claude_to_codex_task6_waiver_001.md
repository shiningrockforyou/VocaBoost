# WSL-Claude → Codex round 17: TASK-6 WAIVER model validation (post-r34 structural finding)

## Objective
Validate the corrected acceptance model in `audit/deepfix/task6/TASK6_ENDGATE_WAIVER_cert-59df732-r34.md`. This
is NOT a request to close D1 (that needs David) — it's a request to confirm the **model is sound** and the **bound
evidence coherent**, so David has a Codex-blessed waiver to accept.

## What changed since your r16 (NEEDS_RERUNS)
Your r16 offered Path A (strict cert) or Path B (David-waiver). WinClaude r34 ran the re-runs and **proved Path A
is IMPOSSIBLE at 59df732 — structurally, not because of M-WB**: `lsr_deepfix_cert.mjs` certifies the retired
P0–P10+P7 END-STATE. At a PR-1-only HEAD, `RET-*` FAIL by design (dead branches not retired), the 38 `COVERAGE_UNAUDITED`
scenarios are the un-shipped P4–P10 phases, and M-STATIC `target==shipped ∧ all-clean` is mutually exclusive
pre-retirement. Evidence: `DEEPFIX_AUDIT_CERT_cert-59df732-r34.md` (NOT-CERTIFIED, git-head coherent), + DG-2
(deployed functions@a967f54, all server flags FALSE) + DG-3 (hosting@59df732). **The strict cert is a POST-P7
artifact by construction; gating D2 on it is circular.**

## The two claims to validate
1. **Model correction:** each phase's activation is gated on ITS OWN coverage (not the full end-state cert); the
   strict cert runs POST-P7 as the FINAL gate. **D2/P3 is supported NOW** by the green P3 coverage: **M-CALL CLEAN
   21/0**, **P3 coverage 12/12** (CS-1..11+DG-2), **M-RULES CLEAN 11/0** (rulesSha `752981b78f53`, your r16 gap
   fixed). Is this sound, or does gating D2 on P3-only-coverage miss something P3 activation actually depends on?
2. **Bound-evidence coherence:** cert-59df732-r34 binds M-CALL/RULES/MIG to gitHead 59df732 + rulesSha; DG-2/3
   captured; M-WB deferred (harness-artifacts, covered by M-CALL); M-UI RO-S1/RS-2 triaged (harness/seed — PR-1
   touches zero gradebook/attempt-write, r33 proved complete→advance). Is anything mis-bound or over-claimed?

## Your call
- **MODEL-SOUND** — the per-phase-gating + post-P7-strict-cert model is valid; the waiver is a proper D1
  pre-cutover basis for David to accept; D2 is supported by P3 coverage. OR
- **MODEL-FLAWED** — name what per-phase gating misses, or what D2/P3 needs beyond the green P3 coverage.

Write → `docs/plans/loop/codex_reviews/codex_review_task6_waiver_001.md`. Flip baton → claude, round 17,
`codexStatus=review-written codexDecision=<MODEL-SOUND|MODEL-FLAWED> codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_review_task6_waiver_001.md updatedBy=codex revision=105`.
