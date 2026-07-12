# Fix10 — Implementation-diff audit synthesis (initial 3-agent, fable)

Diff: `docs/plans/loop/fix10/impl_diff.patch` (`src/pages/TypedTest.jsx` + `src/pages/MCQTest.jsx`).
Design: `plan.md` v3 (CONVERGED). **Verdict: all 3 lenses clean — SHIP. No blocker/high/medium.**

## Lens A — correctness → CORRECT (ship)
Verified patch == working tree (`git apply --reverse --check`). Race eliminated end-to-end BOTH branches:
Day-1 (stored CSD 0 → guard `expectedDay 1 === dayNumber 1`) and Day-2+ (stored CSD N-1 → `expectedDay N ===
N`); no remaining writer to class_progress CSD in the window (`getNewWordAttemptForDay` is a pure query).
Null path correct (completion self-creates). Retry-save idempotent. Flag-off equivalent. Nits: (1) progressRef
moved inside `if` — behaviorally identical/tighter; (2) TOCTOU concurrent-delete → skip persist+completion —
strictly narrower than pre-fix, design-accepted. NO CODE CHANGE.

## Lens B — flag-off equivalence → SHIP
Flag-off byte-equivalent for every app-written doc (`getOrCreateClassProgress` always truthy → `if(progress)`
no-op; `?? null` identity for all 7 fields of an init doc). Sole flag-off delta = malformed-doc case (missing
field: pre-fix `updateDoc` throws→swallowed→completion SKIPPED; post-fix persists `null`→completes) — a strict
improvement, Codex-R2-accepted, unreachable for app docs. `?? null` should NOT be flag-gated (gating would
preserve the wedge-failure for zero benefit). No #9/Run S interaction (completion never consumes the snapshot;
skipping the reconcile means one FEWER writer racing #9 pairing). Imports correct, no shadowing. Nits: comment
"byte-equivalent" slightly overstates (→ tightened to "behavior-equivalent"); rebuild-after-external-reset is
guard-as-designed (logged §9.4). ACTED: comment tweak (both files).

## Lens C — parity & edge → CLEAN
Two edited blocks byte-identical (mechanical diff). Both files fully patched, correct session-final block,
Typed inside the re-invocable `doWriteAndFinalize` closure. `if(progress)` scope correct — `completeSessionFromTest`
runs in BOTH progress-present and null cases (NOT nested). All 9 snapshot fields present for the retake
consumer. DO-NOT-TOUCH (`:823`/`:543`) intact; no progressService change; flag untouched. Nits: `?? null`
null-write into retake-restore live fields IF that (dormant) path revives — logged §9.5.

## Actions taken (folding the audit)
1. Code comment "byte-equivalent" → "behavior-equivalent (Run L)" in both files (Lens B nit 2).
2. Logged 2 observations to plan §9.4/§9.5 (rebuild-after-external-reset = guard-as-designed; retake null-write
   + TOCTOU for the Fix B follow-up).
3. No behavioral code change required — all substantive findings were confirmations or design-accepted.

## Convergence
All 3 fable lenses independently confirmed: spec-exact, race eliminated (both branches), flag-off equivalent,
parity byte-identical, imports correct, DO-NOT-TOUCH honored, Fix B deferral honored. Lint 0-new vs baseline.
→ Ready to hand the diff to Codex (task FIX10_CODE).
