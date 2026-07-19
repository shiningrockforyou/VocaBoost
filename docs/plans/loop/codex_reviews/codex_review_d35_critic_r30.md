# Codex review — D3.5 critic pass R2

Verdict: **GAPS-FOUND**

Reviewed:

- `docs/plans/D3.5_RECOVERY_AUDIT_PLAN.md`
- `docs/plans/loop/handoffs/claude_to_codex_d35_critic_r30.md`
- `functions/foundation.js` resolver semantics around `safeValuesForDoc` / `resolveListProgress`

## Summary

The round-1 findings were folded substantively and mostly correctly into the new consolidated section. The important M4 correction is also directionally correct against the deployed resolver: with `LIST_PROGRESS_CANONICAL=false`, `resolveListProgress` creates/updates only the launching legacy `class_progress` doc using `safeValuesForDoc`, logs quarantine candidates, and does not perform canonical/quarantine writes.

However, the plan is not yet execution-safe because the older primary sections still contain binding instructions that contradict the consolidated corrections. A runner can still implement the wrong 211-count/full-backup/A11/F1/F2/F8/A2 behavior by following the earlier tables.

## Findings

### High — Round-1 corrections are not integrated into the primary execution contract

The consolidated section fixes the semantics, but earlier plan sections still state the old contract:

- Lines 46–49 / 61–63 still say Tiers 1/2 run over “all 211 real states,” while the corrected count is 156 distinct pre-fix ticketed students and only class-progress backups are pre-fix-authentic.
- Part A2 lines 107–145 still says every July-ticketed student can be cloned to exact pre-fix state from saved backups and still lists the 07-17 full-cohort backup as a fallback. The corrected section says that backup is post-fix and non-throttle families require reconstruction/derivation with provenance.
- A11/B17 are still presented in the main tables as fixed threshold recovery, but the consolidated M3 correction says this is a live code bug / data-mitigated canary, observe-only, with threshold=92 as an `INVALID_PRECONDITION` guard.
- F1/F2/F8 still expect clamp/demotion or “server ignores canonical,” but M4 and the resolver show the P4 behavior is narrower: launch-doc safe-value reconciliation, candidate logging, no canonical write, and no arbitrary demotion unless `safeValuesForDoc` produces it. Also, canonical docs are explicitly preferred if present in `resolveListProgress`, so F8’s “ignores canonical” wording is wrong.
- Verdict handling lines 335–339 still omit the new `INVALID_PRECONDITION` verdict and still make all Part A/C/D fixed failures STOP, which conflicts with the mitigation-canary / observe-only corrections.

Required fix: either update the original tables and verdict/mechanics sections in place, or add a clear “Binding contract” statement saying the consolidated critic-pass section supersedes the earlier tables where they conflict. For an implementation plan, in-place edits are safer.

### Medium — M4 should name the exact `safeValuesForDoc` outcomes

M4 is correct at a high level, but the audit oracle should be explicit:

- `safeCSD = storedCSD` when anchor review lookup failed.
- Otherwise `safeCSD = max(storedCSD, anchor.csd)`, so P4 never demotes CSD through `safeValuesForDoc`.
- `safeTWI = anchor.twi` when anchor data is valid, so TWI can be reduced to the valid anchor.
- Otherwise `safeTWI = max(storedTWI, anchor.twi)`.

That means F1 should not expect CSD down-reconciliation in P4 read-only mode. F2/F16 can expect no negative/crash and candidate logs; TWI clamping only where the valid-anchor path makes it true.

### Medium — F8 canonical-preexisting anomaly expected result is wrong

The plan says that with `LIST_PROGRESS_CANONICAL=false`, a preexisting `users/{uid}/list_progress/{listId}` doc is ignored. The code does not do that. `resolveListProgress` checks canonical first and returns it in both modes.

If F8 remains in scope, expected behavior should be changed to one of:

- “preexisting canonical is detected as a boundary anomaly and documented,” if observe-only; or
- “preexisting canonical must not exist in sandbox preconditions except deliberately seeded anomaly cases,” if safety-focused.

Do not assert “server ignores canonical” unless the code changes.

## Round-1 fold status

- Retake threshold: folded, but main tables still contradict it.
- Unfalsifiable cases: folded into M6, but main rows still need concrete rewrites.
- Tier-3 client/server-path proof: folded.
- A2 overlay determinism: folded, but Part A2 still reads as exact-backup coverage.
- Client-state seeding: folded.
- F1/F2/F16 P4 split: folded, but main F rows still contradict it.
- Safety artifact / zero-26SM write proof: folded.
- `INVALID_PRECONDITION`: folded, but verdict handling still omits it.

## Decision

`codexDecision`: **GAPS-FOUND**

`codexConverged`: **false**

The conceptual corrections are good. The remaining work is to make the executable plan internally consistent so an implementer cannot follow stale tables and produce a false-green or false-fail audit.
