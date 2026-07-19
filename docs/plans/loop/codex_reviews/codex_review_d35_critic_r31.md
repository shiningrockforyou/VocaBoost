# Codex review — D3.5 critic pass R3

Verdict: **COMPLETE**

Reviewed:

- `docs/plans/D3.5_RECOVERY_AUDIT_PLAN.md`
- `docs/plans/loop/handoffs/claude_to_codex_d35_critic_r31.md`
- `functions/foundation.js` resolver semantics for `safeValuesForDoc`, canonical-first reads, and server log provenance

## Summary

Round-2 corrections are now integrated into the executable plan, not merely appended as commentary. I do not see a surviving blocker/high/medium gap that would justify another critic-pass revision before implementation planning.

The prior false-green / false-fail risks are addressed:

- The real pre-fix backup count is now consistently 156, not 211.
- The full 26SM backup is correctly labeled post-fix and not a pre-fix fallback.
- A11/B17 are correctly treated as mitigation canaries with `newWordRetakeThreshold=92` as a precondition, not fixed-family STOP failures.
- `INVALID_PRECONDITION` is now a first-class verdict in the method and verdict handling.
- F1/F2/F16 now match P4 read-only resolver behavior: no arbitrary CSD demotion; launch-doc safe-value reconciliation only; candidate logging; no canonical write.
- F8 now matches code: `resolveListProgress` prefers a preexisting canonical doc even when `LIST_PROGRESS_CANONICAL=false`, so the canonical-present case is a seeded boundary anomaly, not “ignored canonical.”
- Tier-3 fixed-family scenarios now require server-path proof plus negative assertions against canonical/client fallback writes.
- Client-state gaps are explicitly covered by B23/B24 and related browser-state cases.
- Safety requirements now define sandbox target identity, teacher pinning, real-list read-only treatment, join containment, and a per-run safety artifact.

## Code cross-checks

`functions/foundation.js` supports the corrected oracles:

- `safeValuesForDoc` uses stored CSD on review lookup failure, otherwise `max(storedCSD, anchor.csd)`, so P4 cannot demote CSD via safe-values reconciliation.
- Valid-anchor TWI is anchor-authoritative; invalid/no-anchor TWI is max-protected.
- `resolveListProgress` checks canonical first and returns it if present.
- With `LIST_PROGRESS_CANONICAL=false`, the resolver may create/update only the launching legacy `class_progress` doc and logs `list_progress_quarantine_candidate` / `resolve_list_progress`; write-capable quarantine/canonical hydration is P5+.
- Server logs include `writtenBy: "cloud-function"`, so the server-path proof wording is implementable.

## Non-blocking note

The Part A2 heading still uses strong “exact-state clones” language. The nearby superseding paragraph and M9 provenance contract make the intended behavior clear enough for this critic pass, but implementation docs should preserve the provenance distinction in artifact names and reports: exact backup, reconstructed from CS entry, or snapshot-derived.

## Decision

`codexDecision`: **COMPLETE**

`codexConverged`: **true**

From the Codex critic lens, the D3.5 plan is ready to leave critic-pass review and move to implementation planning / harness design.
