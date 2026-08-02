# Codex round 68 — r67 closure / stage-1 freeze review

**Reviewed:** 2026-08-02  
**Round disposition:** **DONE**  
**STAGE-1 FREEZE:** **NO**  
**Track B:** **NO-GO — RECOVERY/OVERTAKE AUTHORITY IS STILL INCOMPLETE**

## Ruling

Round 68 closes the exact post-intent overtake I reported. A later delta now refuses while another run
dangles; the crashed run resumes before the layer; a stale resume after the layer is refused; and the
82-case lap executes that whole sequence through final PASS. The three-conjunct tail law, same-field
negative/positive, census units, edited-attempt pin, Drill E wording, remaining pointer deletion, lease-age
law, and post-flip orphan reporting also landed. The evidence is source-bound: 82/0, all eight sha16 values
match, and every bound source mtime precedes the artifact.

The freeze still fails on two adjacent authority paths that the new test does not cover:

1. A repair-mode crash cannot be resumed at all. Its repair-specific strict scan runs before the generic
   admission gate and rejects the run's own dangling intent.
2. A run that crashes at the already-carded `pre-intent` point has a durable resumable manifest but no
   ledger position. If M1 later applies, the stale M0 resume has `ownIntentIdx === -1`; the overtake check
   is skipped and M0 can overwrite M1 with a clean exit 0.

These are not speculative schema nits. The first is a one-crash permanent pre-flip recovery brick on the
supported `--repairExtras --resume` path. The second is the same stale-authority write Round 68 claims to
eliminate, reached through another existing crash point. The current 82/0 lap asserts only post-intent
overtake and never crash-resumes repair mode.

`codexDecision=DONE` means this review turn is complete. It is not GO or freeze approval.

## r67 closure accounting

| r67 item | Round-68 verdict | Independent result |
|---|---|---|
| A1 — admission + overtake | **POST-INTENT CASE CLOSED; GENERAL CLAIM MISSED** | The seven-step post-intent sequence executes correctly. Repair resume is rejected before the new gate, and pre-intent resumes have no order fence (A1/A2). |
| A2 — terminal schema | **BOOLEAN/IDENTITY CLOSED; “EXACT” OVERCLAIMED** | String/number `cutoverAborted` values throw and cutover delta identity binds to its intent. Outcome counters remain unvalidated and accept nonnumeric/negative shapes (B1). |
| B1 — lease age/pid/ABA | **AGE + PID CLOSED; ABA FIX PARTIAL** | Fresh unparseable leases are protected by mtime, aged ones reap, pid must be positive. Verify-after-rename protects the two-contender successor case but is not exclusive for three contenders (B2). |
| B2 — delta pointer | **CLOSED** | `b1-baseline-pointer-delta.json` is deleted. |
| Crash-then-flip orphan | **CLOSED AS A NONFATAL GATE DISPOSITION** | Post-flip reducer publishes dangling runs as `flipOrphanedRuns`; B4 reaches a verdict instead of ledger-FATAL. Pre-flip remains strict. |
| Three-conjunct tail law | **CLOSED** | Governing prose states moved ∧ quiet ∧ disk≡layer; the lap executes same-field lost-post-flip BLOCK and exact-live PASS. |
| Census publication/units | **CLOSED** | B4 counts only the boundary replay; both missing-timestamp and unknown-enum counters have exact fixture cases; replay exclusions publish. |
| Edited attempt | **CLOSED** | Teacher-edited attempts pin passing to `preOverride.score`; the forward preimage duty is carded. |
| Drill E / joiner prose | **CLOSED** | Item 8 keeps rehearsal registration during assignment-OFF; Track B explicitly says a layer-only aborted joiner is an uncovered blocker. |
| Evidence identity | **CLOSED** | 82/0, 8/8, frozen bytes. HEAD was committed after READY, but commit `15fe0f8` contains the exact bound bytes. |

## A. Blocking findings

### A1. Repair-mode crash recovery rejects its own dangling intent before the new admission law runs

Repair mode constructs `repairRealityScan` and invokes it immediately
(`b3-backfill-writer.mjs:159-176`). The scan copies **all** `red.problems` and exits 2 if any exist.
It has no “current run on resume” exception.

The same scan runs again after the execution lease is acquired (`:281`), still before Round 68's generic
admission logic at `:286-304`. That generic logic correctly filters the current run's problem:

```js
const foreignProblems = red.problems.filter(p => !p.startsWith(`${RUNID} `));
```

but a repair resume never reaches it.

Reachable sequence:

1. B4 publishes a valid extras report and exact applied-delta chain.
2. B3 starts `--repairExtras=<report> --appliedDelta=... --execute`.
3. It crashes at `post-intent` or after a committed repair chunk.
4. B4 correctly says “intent without completion (crash mid-run? resume it).”
5. The operator invokes the same bound repair command with `--resume`.
6. The pre-lease `repairRealityScan` sees that run's own latest dangling intent and exits 2.
7. A new repair runId also exits 2 on the same foreign problem. No supported command can clear the ledger.

This is a permanent pre-flip brick after one normal crash, not an operator-order corner. The emulator lap's
valid-repair case executes only the clean path; its crash/resume suite uses plain mode.

**Required closure:** make both repair scans distinguish the current resumable run from foreign problems,
then let the under-lease generic admission/overtake law decide. Add a repair-mode post-intent or
after-first-chunk crash, assert B4 FATAL, assert the exact bound repair resume completes, and assert final
B4 PASS with the extra deleted and unrelated chain state byte-equal.

### A2. The pre-intent crash point leaves no custody order, so a stale resume bypasses OVERTAKEN

The existing lap proves the state explicitly:

- the run manifest is already durable before phase 2;
- `crashPoint("pre-intent")` fires before the first ledger intent
  (`b3-backfill-writer.mjs:445-450`);
- the lap asserts “no ledger record before intent — rerun is legal”
  (`b-emulator-lap.mjs:187-194`).

Such a run is resumable because its manifest and preimage exist. Round 68's resume check searches the
ledger for the run's intent:

```js
const ownIntentIdx = red.ordered.findIndex(...);
if (ownIntentIdx >= 0) {
  // reject later applied completions
}
```

For a pre-intent crash, `ownIntentIdx` is -1 and the entire overtake check is skipped
(`b3-backfill-writer.mjs:297-302`).

Concrete sequence using only shipped operations:

1. M0 is applied.
2. Plain run P reaches a durable manifest and crashes at `pre-intent`; no P ledger record exists.
3. A prepared M1 delta executes. Admission sees no unresolved P and allows it.
4. P is invoked with `--resume`. There are no foreign problems and no P intent index, so it is admitted.
5. Resume regenerates P's M0 plan against live M1 and writes M1 back to M0.
6. P publishes a clean completion and exits 0; only the next B4 reports structural diffs.

My offline reducer probe on that ledger returned:

```text
problems=[]
ownIntentIdx=-1
appliedLayerShas=[M1]
overtakeCheckRuns=false
```

The 82-case overtake test begins its crash at `post-intent`, so it cannot catch this.

**Required closure:** give every durable/resumable run an order fence before the pre-intent crash window.
For example, persist a ledger-tail/hash authority fence in the immutable run manifest under the execution
lease, or introduce a non-dangling admission record understood by the reducer. On resume, absence of an
intent must not mean absence of history. Add the pre-intent crash → M1 → stale-resume sequence and assert
the resume is refused before any write, with final M1 B4 PASS.

## B. Additional authority defects

### B1. The “exact terminal schema” still accepts invalid counter types and ranges

Round 68 validates only the literal cutover boolean and the cutover delta sha. It does not require
`txnFailures`, `skippedResetLocked`, or `skippedEpochDrift` to be present nonnegative integers.
I ran the reducer with:

```json
{"cutoverAborted":true,"txnFailures":"many","skippedResetLocked":-2}
```

It returned `problems=[]` and published the malformed outcome in `cutoverRuns`. Surfacing real nonzero
counts is a valid alternative to treating them as fatal, but “real” still requires type/range validation.
Apply the same numeric schema to normal completions as well; today a string can also evade the arithmetic
problem check through `NaN`.

### B2. Verify-after-rename is not an ABA-safe lock for three contenders

The new token comparison repairs the two-contender sequence: if B renames A's live successor lease, B sees
the token mismatch, restores it, and exits. During that verification/restore interval the authoritative
lease pathname is absent.

With three starters:

1. A wins stale reaping, creates its live lease, and begins.
2. B, which assessed the old stale lease earlier, renames A's live lease and detects the mismatch.
3. Before B restores it, C sees no lease, atomically creates one, and begins.
4. B's restore either fails on C's lease or replaces it, depending on filesystem semantics; A and C have
   already both been admitted.

Conditional release cannot undo concurrent writes. This is a design gap, not merely the carried absence of
a two-process test. Serialize stale reaping with a stable per-original reaper claim, or use a protocol that
never removes a successor's authoritative pathname before identity is proven. Add a real multi-process
starter negative before production execution.

## Evidence and checks

- Validated owner `codex`, round 68, revision 208, task/handoff/ready-marker identity.
- Reviewed the r68 handoff, full r67 panel union, changed scripts/docs, target card, evidence, and relevant
  reducer/writer/gate paths.
- `node --check` passed for all eight bound scripts.
- `delta-chain-fixture.mjs`: **81 checks / 0 failures**.
- `rotation-cyclicity-fixture.mjs`: **2,688 checks / 0 failures**.
- Evidence sha16: **8/8 match**; artifact reports **82/0**; every bound source mtime predates it.
- Offline reducer probes reproduced the pre-intent missing-order state, the repair self-problem, and the
  malformed terminal-counter acceptance.
- No second emulator lap was launched: this Windows host has no Java and the only WSL distribution is
  `docker-desktop`; the session forbids reviving the Docker workflow. The shipped 82/0 evidence is
  accepted for the cases it actually executes.
- No production Firestore, Docker, Playwright, application source, or shared forensic chain was mutated.

## Minimal falsifiable closure set

1. Make repair-mode resume admit its own latest dangling attempt through both repair scans; execute a
   crash-resume repair through final PASS.
2. Persist an authority-order fence for pre-intent resumable runs; execute pre-intent crash → M1 → stale
   resume REFUSED, final M1 PASS.
3. Validate completion counters as required nonnegative integers and add malformed-shape negatives.
4. Replace the rename/restore ABA protocol with one that remains exclusive for N contenders; run a real
   multi-process starter negative.
5. Re-run the solo lap only after the final bound source bytes and verify 8/8 again.

Only then is stage-1 freeze reviewable. **STAGE-1 FREEZE = NO.**
