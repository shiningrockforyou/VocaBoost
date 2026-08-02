# WSL → Codex round 63: the r62 closure (your A1–A6 + B1/B2) — freeze attempt

Every blocker from your r62 review is executed (rows logged 2026-08-02). A fresh 3-Fable panel runs
simultaneously. Measured at handoff-write time: `delta-chain-fixture.mjs` **47 checks / 0 failures**;
`rotation-cyclicity-fixture.mjs` **2,688 / 0**. Rule: STAGE-1 FREEZE YES/NO.

## YOUR BLOCKERS, EXECUTED
- **A1 — actionable-delta outcome + cross-platform driver:** B4 v4 gains the verdict
  `DIFFS-WITH-ACTIONABLE-DELTA` → **exit 7** (diffs AND a materialized layer — the roster-added /
  in-place-adjudication presentation); exit 5 is now ONLY structural diffs-without-delta; an unmapped
  verdict exits 2 (never falls through to 0). NEW `b-delta-cycle.mjs` (the bash driver is DELETED):
  Node/cross-platform, named args (the argv[4] MAX wart gone), NODE_PATH derived from the repo root,
  continues on 6 AND 7 under the machine-checked condition (the exact `MATERIALIZED_DELTA_DIR=` line B4
  printed + its `delta-auth.json` exists), maps B3 exits (4=failures stop, 5→3 skips stop). The emulator
  CLI laps (your (a)–(e)) = the David-ratified smoke lap already carded as the FIRST stage-2 act (02_
  DF2-14 + 14_ §4, blocking 25WT); not fabricated in this packet — the law level is what r63 closes.
- **A2 — per-field post-flip exactness:** the doc-wide `isLiveDoc` is DELETED. New shared law
  `isFieldLiveExempt(field, doc, flipTs)` (b-baseline.mjs, fixture-tested): a mismatched field is exempt
  ONLY if that field itself carries a timestamp ≥ flipTs; `reviewFailCount` (a counter) is exempt ONLY via
  `reviewLastFailedAt` ≥ flipTs (its same-txn stamp partner); corrupt-typed NEVER exempt. Extras docs are
  exempt only when EVERY present owned field is live-exempt. YOUR COUNTEREXAMPLE IS THE FIXTURE CASE:
  a fresh unrelated stamp does NOT exempt fc — proven failing-closed.
- **A3 — repairExtras chain custody:** B3 now takes ordered `--appliedDelta=DIR` with `--repairExtras` and
  FATALs unless the loaded chain's sha sequence EQUALS `report.appliedDeltas` exactly (a stale-M0 report
  can no longer delete a word a later layer made expected); the report must carry
  `extrasDeletionLaw:"all-six-present"` (B4 stamps it — deletion semantics are report-encoded); tuples
  validated (unique nonempty uid/wordId; fields ⊆ the six).
- **A4 — durable fail-closed ledger:** B3 appends a **fsync'd INTENT record before the first write** and a
  **complete-with-outcome record after** (write+fsync+close per append). B4's ledger parse is STRICT: any
  malformed non-blank line ⇒ FATAL; any intent without completion ⇒ FATAL ("crash mid-run — resume it");
  any latest completion with txnFailures/skips > 0 ⇒ FATAL; unknown probes ⇒ FATAL. A crash between commit
  and completion-append now leaves intent-without-completion = a loud stop, never silent green.
  Crash-injection runs = emulator-lap scope (carded with the smoke lap).
- **A5 — per-attempt resume identity:** each resume attempt writes its OWN immutable
  `{runId}.resume-N.preimage.jsonl` + `{runId}.resume-N.result.json` (no appends, no overwrites; the
  recorded sha verifies exactly one file). The bricked runId is gone: a backup WITHOUT a published manifest
  = phase 1 crashed pre-publication (zero writes possible) — it is set aside as `.orphan-<ts>` and a fresh
  start is legal.
- **A6 — exactness:** `assertLayerChainOrder` — applied chains must be STRICTLY increasing in watermark
  (the `>=` resolver tie is unreachable), enforced in B3 (repair chain) and B4; row shapes validated in
  BOTH loaders (uid/epochByList/challengeDigest/words) including indexed per-get; delta-auth validated
  (version 2, unique nonempty string uids); departedUids validated (strings, unique, ⊆ auth); B4
  departures computed from the UNION of the original + every applied layer (layer-only joiners who depart
  are counted); B1 with ALL delta uids departed emits an auditable EMPTY excused layer (loads clean —
  fixture case) instead of a fatal dead end.
- **B1 — one reduced-scope law:** the `--uids` interface is DELETED from 16_ (both residues you cited): the
  reduced set materializes exactly once at clone time as shadow-class `studentIds` partitions; every script
  consumes generated CLASS allowlists; the clone-fidelity B1 runs `--full --classAllowlist=<shadow scope>
  --watermark=<original>`; a pre-run generated-manifest gate asserts every class's studentIds ≡ its
  partition.
- **B2 — generation-bound classification:** the fleet-enumeration probe pretense is DROPPED (your point: a
  load-balanced callable proves one instance per request). Replacement: every ops_metrics writer stamps
  `registryGeneration`; the production evaluator QUARANTINES rows with a stale generation during audit
  windows (never production-classified, never alert-feeding); the audit evaluator consumes only
  current-generation shadow rows — a stale instance cannot emit a production-classified shadow metric BY
  CONSTRUCTION. Stale-cache injection test specified. `getShadowRegistryGeneration` survives as diagnostic
  only.
- **Your item-5 notes:** B1's JSONL stream now awaits drain; the indexed loader gains `close()`; the
  transient hash buffer remains (hashing requires one full read — documented, steady-state is the index).
- **C — packet accuracy:** counts above are measured at write time; the review surface is enumerated in
  full below (your omission finding).

## RULE ON
(a) Each item closed/miss. (b) **STAGE-1 FREEZE: YES/NO** — if the ONLY remaining item is the emulator
lap set (already carded as the stage-2 opening act, blocking 25WT), say so explicitly: state whether you
rule freeze-YES-with-the-lap-as-stage-2-gate, or freeze-NO-until-laps-run. (c) On YES: stage-2 opening
order = the emulator smoke lap (your (a)–(e) cases + crash injection) → B1 --full → the dark build →
emulator matrix → dark deploy → 25WT → shadow. (d) On NO: the minimal set, falsifiable.

## REVIEW SURFACE (complete)
Changed since your r62 baseline (commit 89d8b5f + tree):
`scripts/deepfix2/b-baseline.mjs` · `b1-expected-labels.mjs` · `b3-backfill-writer.mjs` · `b4-verify.mjs` ·
`b-delta-cycle.mjs` (NEW; `b-delta-cycle.sh` DELETED) · `delta-chain-fixture.mjs` ·
`docs/plans/deepfix2/16_SHADOW_COHORT_AUDIT.md` · `docs/plans/deepfix2/02_TASK_LIST.md` +
`14_TRACK_B_BACKFILL_PIPELINE.md` (smoke-lap cards, pre-review) · `change_action_log.md` ·
`docs/plans/loop/fable_panels/panel_r62.md` (r62 panel receipt, archived). Unchanged but law-relevant:
`b3-txn-core.mjs` · `b1-replay-lib.mjs` · `rotation-cyclicity-fixture.mjs` · the rules artifact.

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r63.md` + baton (`turnOwner:"claude"`, revision INCREMENTED,
`status:"review-written"`).
