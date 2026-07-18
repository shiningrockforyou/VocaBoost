# Codex review — Task-6 waiver acceptance model (`cert-59df732-r34`)

## Verdict

`MODEL-SOUND`

The corrected model is sound: D2/P3 should be gated on the coverage for the P3 server surface it activates, while the full `lsr_deepfix_cert.mjs` strict certification is a post-cutover/end-state gate. Requiring the strict cert before D2 is circular because that cert explicitly requires shipped/end-state P4–P10/P7-retirement conditions that cannot be true at `59df732`.

This does not close D1 by itself. It gives David a coherent waiver basis to accept.

## Evidence checked

- `audit/deepfix/task6/TASK6_ENDGATE_WAIVER_cert-59df732-r34.md`
- `audit/playwright/findings/DEEPFIX_AUDIT_CERT_cert-59df732-r34.md`
- `docs/plans/loop/win/reviews/winclaude_034.md`
- `audit/playwright/lsr_deepfix_cert.mjs`
- `audit/deepfix/task4/AUDIT_DESIGN.md`
- `audit/deepfix/task3/DEPLOY_ORDER.md`
- `docs/plans/SESSION_TODO_2026-07-17.md`
- `docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md`
- bound finding JSONs for `deepfix_call`, `deepfix_rules`, `deepfix_static`, DG-2, and DG-3 under `audit/playwright/findings/`

## Model validation

### 1. Strict cert is structurally an end-state/post-P7 gate

Confirmed.

`lsr_deepfix_cert.mjs` requires all six matrices present, all-clean, `M-STATIC target == shipped`, coherent flag-ON binding, and full §5 coverage across P0–P10. The embedded coverage map includes later/end-state scenarios such as P4 client cutover, P6 cutoff rules, P7 retirement, P8 continuation, P9 cycling, and P10 override/challenge redesign.

At `59df732`, the generated cert is correctly `NOT-CERTIFIED` because:

- `M-STATIC target=shipped` is `NOT_CLEAN`;
- `M-WB` is absent;
- `M-UI` is not clean;
- 38 canonical later-phase scenarios are uncovered.

Those are not defects in D2/P3. They are evidence that the strict cert is the final end-state gate, not a valid pre-D2 gate.

### 2. Per-phase gating is the correct acceptance model

Confirmed.

For D2/P3, the relevant activated surface is the P3 server/foundation surface and the M4 shadow/start-soak posture, not the P4 client routing, P5 canonical migration, P6 rules cutoff, P7 legacy retirement, or P8–P10 product surfaces.

The available P3 evidence is coherent enough for a David-accepted waiver:

- `M-CALL`: `CLEAN`, 21 pass / 0 fail / 0 invalid / 2 documented skips, bound to git `59df732657...`.
- `M-RULES`: `CLEAN`, 11 pass / 0 fail / 0 invalid, bound to git `59df732657...` and rules sha `752981b78f53...`.
- `M-MIG --dry`: clean dry-run oracle coverage for its pre-cutover role.
- DG-2: deployed functions are still `a967f54` with server flags false, proving D2 is not already live.
- DG-3: hosting build stamp is `59df732`, proving the PR-1 client is live.

The cert’s P3 row shows 12/12 coverage. Two legs, `CS-7` and `CS-10`, are documented skips rather than executed passes. That is acceptable for this waiver because they are secret/live-grading recovery legs and are not the core D2 progress-authority flag flip. They should remain explicitly ledgered and should not be described as executed green tests.

### 3. D2 still has non-waiver gates

Confirmed.

The waiver should be read as resolving the Task-6/D1 audit-binding problem only. It does not replace:

- David’s explicit D1 waiver acceptance;
- C2/PR-2 gate for `REVIEW_ENGAGEMENT_STAMP_ENABLED` and `RECOVERY_SCORE_CLAMP_ENABLED`;
- A2 invariant-suite gate;
- the exact D2 deploy/flag list discipline in `SESSION_TODO_2026-07-17.md`.

This matters because D2 flips seven flags, including the two PR-2 flags. The original P3 matrix does not by itself prove those PR-2-specific features; those are covered by the separate C2/PR-2 review path. The roadmap already models this correctly (`D2` gated by `D1, C2, A2`).

## Bound-evidence coherence

Mostly coherent, with one precision caveat:

- `deepfix_call_cert-59df732-r34.json` has `rulesSha256: null`.
- `deepfix_rules_cert-59df732-r34.json` has `rulesSha256: 752981b78f53...`.

This does not break the waiver model because M-CALL does not exercise Firestore rules and M-RULES is the rules-bound matrix. But the waiver/handoff should not claim that M-CALL itself is rules-sha-bound. The accurate statement is:

- M-CALL is runId/git-head/flag-set/emulator bound.
- M-RULES is runId/git-head/rules-sha/flag-set bound.
- M-MIG is runId/git-head bound.

DG-2/DG-3 evidence is coherent with the model:

- unauthenticated DG-2 in `deepfix_dg_probes_cert-59df732-r34.json` is inconclusive/401;
- authenticated DG-2 in `deepfix_dg2_auth_cert-59df732-r34.json` proves deployed functions `a967f54`, all server flags false;
- DG-3 proves hosting `59df732`, `dirty:false`.

## Required wording constraints before David acceptance

These are wording/contract constraints, not model blockers:

1. Do not call the strict cert “failed” in a way that implies product failure at `59df732`; call it structurally unreachable pre-cutover.
2. Do not describe `CS-7`/`CS-10` as executed passes; they are documented skips on the P3 ledger.
3. Do not imply M-CALL is rules-sha-bound; only M-RULES is.
4. State that D2’s PR-2 flags ride on C2/PR-2 approval in addition to this D1 waiver.

## Final call

The acceptance model is valid:

- per-phase activation gates should use per-phase coverage;
- the strict single-runId program cert belongs after the end-state exists;
- the current waiver is a coherent D1 pre-cutover basis for David to accept;
- D2/P3 may proceed after David accepts D1 and the separate D2 gates (`C2`, `A2`, exact flag/deploy discipline) are satisfied.
