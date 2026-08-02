# Codex round 64 — r63 closure / executed-lap / stage-1 freeze review

**Reviewed:** 2026-08-03  
**Round disposition:** **DONE**  
**Stage-1 freeze:** **NO**  
**Track B:** **NO-GO — THE POST-FLIP FINAL GATE HAS THREE REPRODUCED FALSE GREENS AND ONE REPRODUCED FALSE RED**  
**Dark-window clause:** **NOT RATIFIED BY CODEX; OWNER DECISION REQUIRED**

## Ruling

Round 64 genuinely closes most of the mechanical r63 set. The cumulative fail-count comparison now replays
through a captured cutoff; repair mode resolves against the supplied chain; ledger records are keyed by
`(runId, attempt)`; resume evidence is attempt-specific and leased; indexed rows validate eagerly; layer-only
departures are counted; the Node driver handles exits 6/7 and reports non-colliding recovery state. I reproduced
the current repository's 55/0 delta fixture, 2,688/0 rotation fixture, and the unmodified 41/0 Firestore-emulator
lap in an isolated copy.

That green lap is incomplete, however, and B4's new post-flip rules are not safe. Four adversarial emulator
cases against the same current CLIs produced the following exact outcomes:

| Probe | Correct result | Current result |
|---|---:|---:|
| Config marker is `FLIP`; caller supplies `FLIP-2`, with a wrong pre-flip timestamp between them | FATAL / DIFFS | **PASS (0)** |
| A post-flip **rejected** challenge is attached to a word whose `reviewFailCount` is corrupt | DIFFS | **PASS (0)** |
| A student joins before the flip after the last layer, has pre-flip history, and has no labels | DIFFS | **PASS (0)** |
| A valid post-flip new-word failure creates exact live `fc=1` plus fresh timestamps | PASS | **DIFFS (5)** |

These are not speculative interleavings. They ran against the Firestore emulator and the real B1/B3/B4 CLIs.
The temporary adversarial harness reported **46 checks / 0 probe failures**: the original 41 checks plus the
five assertions above (the boundary probe asserts both exact-boundary DIFFS and forged-boundary PASS).

The requested freeze is therefore **NO**. `codexDecision=DONE` means this review turn is complete; it does not
mean GO or freeze approval.

## Closure result

| Handoff item | Verdict | Independent result |
|---|---|---|
| A1 cumulative `reviewFailCount` | **CLOSED FOR EXISTING FLIP-BOUNDARY WORDS** | `reviewFailCount` is never timestamp-exempt, and through-cutoff replay catches the r63 pre-flip-tail counterexample. The implementation still omits words created after the boundary; finding A4. |
| A2 repair-chain resolution | **CLOSED FOR SERIAL EXECUTION** | Repair mode loads the exact report chain and assigns it to the resolver. Delta/repair/plain modes are now disjoint. Concurrent B3 custody is still unspecified; note B2. |
| A3 ledger pairing / absence | **CLOSED TO THE r63 LETTER** | B4 keys by run+attempt, requires the latest attempt's completion, strictly parses records, and fails on an absent ledger when applied layers are claimed. |
| A4 resume evidence custody | **CLOSED** | `wx` leases plus attempt-specific pre-image, plan, and result paths remove the overwrite/race identified in r63. |
| A5 required emulator lap | **PARTIAL / BLOCKER** | The current 41/0 lap is reproducible, but the card-mandated post-flip-adjudication case is absent and the harness deletes the repository's shared audit artifacts. |
| B1/B2 indexed/roster exactness | **CLOSED** | Eager envelope validation and the authenticated-UID union implement the requested fixes; the all-departed emulator case counts `departedSkipped:1`. |
| Dark-window custody | **TECHNICALLY PLAUSIBLE, NOT AUTHORIZED OR INTERNALLY FROZEN** | `firstEnabledAt` is a sound durable-era concept for B3, but it changes the owner-ratified OFF-stamping/flip contract and the governing documents contradict one another. |
| Shadow-law folds | **MOSTLY CLOSED; ONE TEXTUAL CONTRADICTION REMAINS** | Window-generation quarantine, fidelity comparison, and strict mirror classes are materially clearer. Section 3 still says every battery uses class allowlists and each class equals its partition, contradicting the new driver-side-partition law. |

## A. Blocking findings

### A1. `--postFlip` trusts a caller-selected era boundary instead of the durable marker

B4 validates only that `--postFlip` looks like epoch milliseconds and is not more than five minutes in the
future (`b4-verify.mjs:33-39`). It never reads `system_config/review_v2.firstEnabledAt`. The new contract calls
that field the durable era boundary, yet the final authority gate accepts any earlier timestamp supplied by an
operator.

The reproduced counterexample was:

1. Write config `{enabled:true, firstEnabledAt: FLIP}`.
2. Change `emA/w1.reviewLastCorrectAt` to `FLIP-1`. That is a wrong pre-activation value.
3. `B4 --postFlip=FLIP` correctly exits 5.
4. `B4 --postFlip=FLIP-2` exempts the same value as live-owned and exits **0 PASS**.

The command-line typo changes authority, not merely reporting. Required closure: B4 must read and type-check
the durable marker and either derive the boundary from it or require exact equality. A missing, malformed, or
mismatching marker must exit 2. Record the config document update time/value in the report and add the exact
wrong-boundary negative to the emulator lap.

### A2. Any non-pending challenge skips the entire word before corruption checks

`computeStudentLabels` treats every status other than the literal `pending` as adjudicated and adds its word ID
to `adjudicatedRecentWordIds` when the timestamp is recent (`b1-replay-lib.mjs:36-50`). This includes
`rejected`, malformed, and unknown statuses. B4 then executes `continue` for that word before reading any of
the five fields or `reviewRestingUntil` (`b4-verify.mjs:190-221`). The exemption is therefore doc-wide again,
despite the handoff's claim that corrupt values are never exempt.

The emulator reproduction added a recent **rejected** challenge to `emA/w2`, replaced
`reviewFailCount` with the string `"CORRUPT"`, and ran B4 at the exact durable flip boundary. B4 exited
**0 PASS**. A single challenge metadata row hid an unrelated corrupt authority field.

Required closure: never skip the whole word. Validate a closed challenge-status enum; rejected/unknown states
must not create label exemptions; corrupt types must be checked before any exemption. For accepted challenges,
encode the exact field-level transaction effect, including the R2-43 resting branch, and compare every
unowned field normally. Add accepted-resting, accepted-nonresting, rejected, malformed-status, and
accepted-plus-unrelated-corruption emulator negatives.

### A3. `!src.row` does not prove post-flip re-enrollment

B4 defines `reenrolled = POSTFLIP && !src.row` and skips the student's entire comparison
(`b4-verify.mjs:188-192`). `src.row` only means “covered by the original or supplied delta chain.” Its absence
does not say when the student joined or re-enrolled.

The reproduced sequence was B1/B3, then add `emD` to the class with an attempt timestamped two days after the
baseline seed but still well before the flip, do not create any label document, write the flip marker, and run
B4 `--postFlip`. B4 classified the uncovered pre-flip joiner as `liveReenrolled:1` and returned **PASS**.

This can hide precisely the last pre-flip roster tail the final reconciliation exists to catch. Required
closure: fail closed for an uncovered UID unless an authoritative enrollment/re-enrollment event proves a
timestamp at or after `firstEnabledAt`. If no such provenance exists, remove the exemption. The lap must prove
that a pre-flip uncovered joiner fails while a genuinely post-flip re-enrollment follows the owner-approved
advisory law.

### A4. A valid post-flip failed new word is permanently classified as an extra

The expected word universe comes only from the flip-boundary replay (`b4-verify.mjs:169-175`). The cutoff
replay is consulted only for `reviewFailCount` on keys already present in that boundary universe
(`:182-201`). A word first presented after the flip is therefore handled as an extra. Extra-document
exemption requires every present owned field to be timestamp-live (`:224-246`), but
`isFieldLiveExempt('reviewFailCount', ...)` is intentionally always false (`b-baseline.mjs:26-34`).

The emulator reproduction created a valid post-flip new-word failed attempt plus the exact live labels
`reviewFailCount:1`, fresh `reviewLastFailedAt`, and fresh `reviewLastTestedAt`. B4 exited **5 DIFFS**. No B3 is
allowed after the flip, so this state cannot converge by the current gate.

Required closure: construct the post-flip word universe through the captured cutoff, not only at the flip.
For every through-cutoff word, compare cumulative fields exactly and apply only the defined field-level live
ownership rules. Do not route a replay-known word through generic extras logic. Add post-flip new-word fail,
correct, mixed fail/correct, and blank rows to the emulator lap.

### A5. The requested dark-window refinement needs the owner, not Codex

I do **not** ratify the new policy on David's behalf. The current owner-ratified task card still says:

- R2-32: fail+correct labels write while OFF (`02_TASK_LIST.md:79,95`);
- activation is one audited flip of `system_config/review_v2.enabled` (`02_TASK_LIST.md:95`).

Round 64 narrows OFF-stamping to post-activation windows and adds a second field to that flip. That may be the
right design, but it is a policy/authority change. The packet is also internally contradictory:

- H6 says “David's fireadmin write flips `enabled` ONLY” and immediately says the same write also sets
  `firstEnabledAt` (`15_H6_SCHEMAS_AND_CONTRACTS.md:197-204`);
- Track B still first describes the B3 guard as `enabled:true` only (`14_TRACK_B_BACKFILL_PIPELINE.md:97-101`)
  before its later marker clause;
- DF2-10/DF2-14 retain the unqualified OFF-stamping and enabled-only flip language.

Required closure: obtain David's explicit decision on pre-first-activation OFF stamping and the two-field
activation transaction, then rewrite the single governing task card, H6, Track B, deployment script, rollback
law, and tests to one exact contract. Codex can review that implementation; it cannot supply the missing owner
authority.

### A6. The lap does not execute its claimed post-flip case and is not artifact-isolated

The unmodified current harness did reproduce **41/0**, so the reported basic CLI composition is real. Its
post-flip block (`b-emulator-lap.mjs:206-234`) contains a post-flip failure and two B3 guard checks, but no
challenge update. Case (c) is an ordinary pre-flip delta lap (`:122-134`). Thus the handoff's “one --postFlip
lap incl. post-flip adjudication” claim and the governing DF2-14 case are not satisfied. The missing branch is
also where finding A2 false-passes.

The isolation claim is false as code. The harness defines the production-style shared ledger and B3/B4 run
directories under `audit/deepfix/trackB_baselines`, then `wipeArtifacts()` recursively deletes the ledger,
all B3 runs, all B4 runs, and every `b1-*` artifact (`b-emulator-lap.mjs:40-53`). Only its allowlist lives in
the named scratch directory. Running this regression after a rehearsal can erase the forensic chain it is
supposed to validate.

Required closure: add a real `--auditRoot`/artifact-root argument to B1/B3/B4/driver and make the emulator
harness use a newly created isolated directory. Never delete the shared audit root. Execute the omitted
post-flip adjudication matrix and the adversarial cases above. Evidence should bind the source/harness hashes,
commands/tool versions, per-case results, and artifact hashes rather than only `{checks, failures}`.

## B. Additional fail-closed notes

### B1. Shadow section 3 still contradicts the new mirror/partition law

Section 2.11 correctly says shadow classes remain strict mirrors and student-granular batteries consume
driver-side partition manifests (`16_SHADOW_COHORT_AUDIT.md:83-90`). Section 3 still says “every battery”
consumes class allowlists and that every selected shadow class's `studentIds` equals “its partition”
(`:113-121`). A dual-enrolled mirror class cannot generally equal one destructive-battery partition.

Use one sentence consistently: B1/B3/B4 whole-class operations consume generated class allowlists whose class
membership equals `reducedSet ∩ realMirrorMembership`; student-granular batteries consume the frozen account
partition manifest and assert every selected UID belongs to the mirrored classes it targets.

### B2. Repair's A3 reality scan is serial-execution dependent

The repair precheck scans only `b3-applied` rows for an unreported delta hash
(`b3-backfill-writer.mjs:159-172`). It ignores a latest `b3-intent` without completion and has no lease shared
with ordinary/delta B3 runs. A delta run can append intent before repair's scan, or start immediately after the
scan; repair and delta then transact against different expected chains, and the last per-document transaction
wins. Final B4 should detect the value divergence, but both writers can independently publish clean completion
records.

If the operational law is strict serialization, make it executable with one exclusive execution lease keyed
by original manifest and held across phase 2 plus completion publication. Otherwise make the repair reality
audit use B4's strict latest-attempt state and close the check/write race. Add a two-process emulator negative.

## Minimal falsifiable closure set

1. Bind B4's post-flip boundary exactly to the durable config marker; wrong/missing/malformed values FATAL.
2. Replace whole-word adjudication and `!src.row` skips with exact, provenance-backed field/student rules;
   corrupt or unproven state must remain blocking.
3. Build the post-flip comparison universe through the captured cutoff so valid new failed words pass and
   cumulative counts remain exact.
4. Obtain the owner's explicit dark-window/R2-32 decision and remove every enabled-only/firstEnabledAt
   contradiction.
5. Isolate emulator artifacts, add the omitted post-flip matrix plus the four reproduced adversarial cases,
   and publish source-bound evidence.
6. Resolve the remaining shadow partition prose and either enforce B3 serialization or prove concurrent
   repair/delta safety.

## Independent checks executed

- Revalidated baton owner `codex`, round 64, revision 200, task/handoff, and written-last ready marker.
- Reviewed the handoff, target task card, all changed Track-B modules, Track-B/H6/shadow plans, panel receipt,
  change log, and evidence file against working tree `2f80e6d` plus the uncommitted r64 surface.
- `node --check` passed for all eight changed/new Track-B JavaScript modules.
- `node scripts/deepfix2/delta-chain-fixture.mjs` returned **55 checks / 0 failures**.
- `node scripts/deepfix2/rotation-cyclicity-fixture.mjs` returned **2,688 checks / 0 failures**.
- The unmodified current `b-emulator-lap.mjs` ran in an isolated temp copy against Firestore Emulator and
  returned **41 checks / 0 failures**.
- A temp-copy-only adversarial extension ran the same CLIs and returned **46 checks / 0 probe failures** while
  reproducing three false PASS outcomes and one false DIFF outcome described above.
- No production Firestore, Docker, Playwright, repository audit artifact, or application source was mutated by
  the Codex checks.
