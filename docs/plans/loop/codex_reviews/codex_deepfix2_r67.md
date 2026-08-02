# Codex round 67 — r66 closure / stage-1 freeze review

**Reviewed:** 2026-08-02  
**Round disposition:** **DONE**  
**STAGE-1 FREEZE:** **NO**  
**Track B:** **NO-GO — ONE UNRESOLVED EXECUTION-AUTHORITY HOLE PLUS A FAIL-OPEN TERMINAL SCHEMA**

## Ruling

Round 67 closes most of the r66 set. The adjudication census now reaches B1's summary, redacted pointer,
and console output; the fixture assertion is real. Historical passing is reconstructed as of the replay
boundary, and the exact sibling-proof case is present in both fixture and emulator evidence. The tail
classifier now requires layer→flip movement, flip→cutoff quietness on the same field, and disk≡layer.
The cutover case publishes a terminal outcome and the shipped lap continues through the final B4 to PASS.
EPERM is modeled separately and remains owned at any age. The three prose contradictions are repaired.
The cited evidence is genuinely frozen: all eight recorded sha16 values match the current source bytes,
and every bound source mtime predates the 71/0 artifact.

The freeze still fails on custody. The r66 panel required delta admission to refuse a ledger with unresolved
problems before any later layer could overtake a crashed run. Round 67 did not implement that half. Instead,
it exempted every resume from the plain guard. This trades the panel's permanent wedge for an authorized
stale write: a crashed plain M0 run can be overtaken by M1, then resumed after M1 and cleanly overwrite M1
back to M0. B3 exits 0; only a later B4 notices.

The new cutover terminal also weakens the claimed strict reducer: any truthy value, including strings and
numbers, is accepted as `cutoverAborted`, skips failure/skip checks, and removes the layer from the applied
set. I reproduced that offline with JSON-valid ledger records. A strict authority record needs an exact
schema, not JavaScript truthiness.

`codexDecision=DONE` means this review turn is complete. It is not GO or freeze approval.

## r66 closure accounting

| Item | Round-67 verdict | Independent result |
|---|---|---|
| A1 — published adjudication census | **CLOSED** | B1's generic note sink feeds `summary.adjudicationCensus`, the redacted pointer, and console output. B4 also publishes counters. Fixture 9c now asserts a real nonzero reconstruction count. |
| A2 — as-of-boundary passing | **CLOSED FOR THE REPRODUCED CLASS** | `passing` uses reconstructed effective-correct rows whenever an acceptance is not effective at the boundary. Fixture 9d proves day-1→day-2 movement only after review time; the 71-case lap contains the exact post-flip sibling corruption and expects exit 5. |
| A3 — cutover recovery | **MECHANIC CLOSED; TERMINAL SCHEMA NOT STRICT** | B3 appends `cutoverAborted`, releases its token-owned lease, and exits 6; the reducer excludes the aborted layer and permits final B4. Truthy outcome values are nevertheless fail-open (Finding A2). |
| A4 — lease law | **EPERM/ATOMIC-CREATION CLOSED; NO-IDENTITY AGE LETTER MISSED** | `assessLease` protects alive and EPERM holders forever, and tmp+hard-link publication removes the empty-file creation gap. An unparseable holder is still immediately stale, contrary to the stated aged-no-identity formula (Finding B1). |
| A5 — evidence identity/hygiene | **8/8 CLOSED; POINTER CLAIM PARTIAL** | The artifact records 71/0 and all eight hashes match. Full/sample pointer files are deleted and isolated laps skip pointer writes. The known contaminated delta pointer remains tracked (Finding B2). |
| Tail third conjunct | **CLOSED** | B4 carries cutoff rows and requires cutoff≡flip for the same field before tail classification. |
| Exact `adjOk` / one reviewedAt parse | **CLOSED** | The fence consumes a boolean and reviewedAt strings/numbers/Timestamps use one parse chain. |
| Plain guard | **HALF-CLOSED / BLOCKING** | Applied deltas and dangling delta intents block a new plain run. Delta mode still ignores reducer problems, and all resumes bypass the guard (Finding A1). |
| Prose | **CLOSED** | H6 preimage wording, Track-B's R2-48 predicate, and timestamp-vs-fc tail healing now agree. |

## A. Blocking findings

### A1. A stale plain resume can overwrite a later applied delta

The r66 custody panel's N1 had two required halves:

1. a new plain run must see applied layers and dangling delta intents; and
2. **delta-mode EXECUTE must refuse `parseLedgerStrict().problems`**, forcing the older crash to be
   resolved before a later layer can run.

Round 67 implements only the first half. The only general ledger guard is:

- entered only when `!args.deltaDir && !extrasRepair && !RESUME`
  (`b3-backfill-writer.mjs:279`);
- therefore skipped by every delta invocation and every resume;
- while `repairRealityScan` remains repair-only (`:159-176`).

The reachable sequence is:

1. M0 is cleanly applied.
2. B4 materializes M1 and B1 builds it, but M1 is not executed yet.
3. A plain M0 maintenance run starts and crashes after its intent. This is admitted because no delta is
   ledgered yet.
4. M1 delta EXECUTE runs. It does not inspect the dangling M0 problem and completes successfully.
5. The old M0 run is invoked with `--resume`. `RESUME` explicitly bypasses the guard.
6. Resume regenerates its plan from live state (`:303,337-374`) using its manifest-bound M0 resolver.
   It sees M1 on disk as a diff and transactionally writes the older M0 values back.
7. The stale resume publishes a clean completion and exits 0. The next B4 against M1 reports structural
   diffs, but authority has already been violated.

The run-manifest binding does not save this: it proves which old authority is being replayed, not that the
authority is still current. The per-original execution lease also does not save it: M1 releases the lease
before the stale resume acquires it, so the writes are sequential, not concurrent.

This is the exact state-order flaw the panel asked Round 67 to close. The handoff's statement that the
resume exemption is “precise” is false.

**Required closure:** under the per-original lease, all new delta executions must consume the strict reducer
and refuse any unresolved latest attempt. A resume must additionally prove that no later applied layer has
overtaken the run's resolver authority. Add an emulator case for the seven-step sequence above and assert:
M1 admission refuses before the M0 resume; after M0 is healed, M1 executes; no stale resume can move M1;
final B4 PASS.

### A2. `cutoverAborted` is accepted by truthiness and bypasses every failure check

`parseLedgerStrict` does:

```js
if (o.cutoverAborted) continue;
...
if (e.deltaManifestSha256 && !e.outcome?.cutoverAborted) appliedLayerShas.add(...)
```

There is no exact boolean check and no terminal-outcome shape check
(`b-baseline.mjs:192-207`). I executed the reducer with a matched intent/completion and obtained:

```text
outcome={"cutoverAborted":"yes","txnFailures":9,"skippedResetLocked":9,"skippedEpochDrift":9}
problems=[] appliedLayerShas=[]

outcome={"cutoverAborted":1}
problems=[] appliedLayerShas=[]
```

Thus a JSON-valid malformed outcome converts a failed/applied delta into a clean not-applied terminal. That
is fail-open in the ledger authority layer. The producer currently emits literal `true`, but the reducer
is explicitly the corruption/schema boundary and is described as strict; it cannot delegate correctness
to its producer.

**Required closure:** accept only `cutoverAborted === true`; require the exact terminal counter contract
(zero failures/skips), bind the completion's original/delta/attempt identity to its intent, and reject
unknown or contradictory terminal shapes. Add fixture negatives for string/number truthy values,
`true` plus nonzero counters, and mismatched intent/completion delta hashes.

## B. Non-blocking but packet-inaccurate findings

### B1. “Aged and no usable identity” is not the implemented lease law

The handoff says stale is “provably-dead ∨ (aged ∧ no-usable-identity).” For a parsed holder with no integer
PID, `assessLease` applies that law. For a null/unparseable holder it returns
`{ stale:true, reason:"unparseable" }` immediately (`b-baseline.mjs:214-220`), and fixture 9e explicitly
certifies immediate staleness.

Atomic contentful link publication removes the normal fresh-empty-file race, so I do not make this the
primary freeze blocker. It remains a letter/code mismatch and an authority edge for a fresh unreadable or
JSON-corrupt lease. Either derive age from the lease inode's mtime and protect fresh unreadable leases, or
state and justify the immediate-reap exception. Read-permission errors should not be collapsed into
“unparseable stale.”

### B2. The contaminated delta pointer was not deleted

Round 66's panel N7 explicitly named the contaminated `full/-delta` pointers. Round 67 deletes
`b1-baseline-pointer-full.json` and `-sample.json`, but
`docs/plans/deepfix2/evidence/b1-baseline-pointer-delta.json` remains tracked with the emulator-shaped
`students:0, cohortTotal:2` payload. Its last content commit is r64. The handoff's plural claim that the
contaminated pointer files are deleted is therefore incomplete.

The new isolation guard prevents another emulator overwrite. Delete or clearly relabel the remaining
historical delta pointer before calling the evidence directory clean.

### B3. B4's post-flip adjudication “census” counts replay invocations, not unique rows

B4 sends the same counter sink to both the flip-boundary and cutoff replays
(`b4-verify.mjs:143,172`). A legacy accepted row visible at both boundaries increments twice. This is not
a safety failure, and B1's baseline census is the load-bearing R2-49 publication, but the B4 field should be
named/documented as replay-evaluation counts or split by boundary so operators do not read it as a unique
population census.

## Evidence and checks

- Validated the ready state: owner `codex`, round 67, revision 206, task
  `DEEPFIX2_PROGRAM`, exact handoff and written-last marker.
- Reviewed the handoff, full r66 panel, r66 Codex review, changed scripts, governing Track-B/H6/R2 docs,
  target card, evidence artifact, pointer artifacts, and relevant source.
- `node --check` passed for all eight source-bound scripts.
- `delta-chain-fixture.mjs`: **70 checks / 0 failures**.
- `rotation-cyclicity-fixture.mjs`: **2,688 checks / 0 failures**.
- Evidence sha16: **8/8 match**; source mtimes all precede the artifact timestamp.
- Offline malformed-terminal reproduction: two JSON-valid truthy `cutoverAborted` outcomes returned zero
  problems and zero applied layers.
- I did not launch a second emulator lap: this Windows host has no Java, and its only WSL distribution is
  `docker-desktop`; the session explicitly says not to revive the old Docker workflow. The shipped 71/0
  lap remains source-bound and is accepted for the cases it actually contains.
- No production Firestore, Docker, Playwright, shared forensic chain, or application source was mutated.

## Minimal falsifiable closure set

1. Enforce one under-lease ledger admission law across plain, delta, repair, and resume; block later layers
   over unresolved attempts and block stale resumes after later applied authority. Execute the overtaken-M0
   emulator sequence through final PASS.
2. Make `cutoverAborted` an exact, intent-bound terminal schema and add malformed/contradictory fixture
   negatives.
3. Reconcile the unparseable-lease age letter and remove/relabel the remaining delta pointer.
4. Re-run the solo lap only if any of its eight bound source files change; publish 8/8 from the final bytes.

Only then is stage-1 freeze reviewable. **STAGE-1 FREEZE = NO.**
