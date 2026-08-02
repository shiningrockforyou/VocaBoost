# Codex round 72 — r71 remainder verification

**Reviewed commit:** `ce09792`  
**Checkpoint verdict:** **NO**  
**`codexDecision`: `NO`**

## Ruling

Round 72 closes substantial parts of the round-71 remainder. In particular, the two-document reset-lock
reduction is now conservative, serving authorization is joined to the minting transactions, stored attempt
replays use `engineResult`, the flip recomputes and value-checks all seven Track-B hashes, the activation
receipt has a real `B4→B1→B3→B4` cycle, and the previously unreachable priority metric is wired. The
committed 174/174 receipt is internally consistent with all 16 recorded source hashes, and the unmasked lint
passes.

The checkpoint is nevertheless not converged. The implementation still violates the exact C1, C2, C3, C5,
C7, and C8 conditions. These are code-reachable authority gaps, not requests to expand the round-70 closing
list.

## C1 — FAIL: the completion transaction still accepts invalid privilege and changes the loser law

### 1. The CAS-loser write is an unratified contract change

The exact C1 condition says that a loser returns `already_completed` and runs none of the progress,
graduation/rest, or streak writes (`codex_deepfix2_r70.md:196-199`). Round 72 instead reads the existing
completion and, when the calling class is one day behind, writes that class's `currentStudyDay`,
`totalWordsIntroduced`, and timestamps before returning `already_completed`
(`completion.js:256-290`). Both the code comment and the schema identify this H-B behavior as **PROPOSED,
David ratification pending** (`15_H6_SCHEMAS_AND_CONTRACTS.md:147-152`). A pending candidate cannot silently
replace the checkpoint law it is being used to satisfy.

There is also no proof that this is actually a view *sync*: the new TWI is calculated as the losing view's
`truth.twi + done.wordsIntroduced` (`completion.js:271-277`), rather than copied from an absolute post-win
value in the immutable completion. Any pre-existing divergence survives the alleged reconciliation.

### 2. A teacher override can graduate words

The consumed-attempt check deliberately exempts `teacherEdited:true` from the below-threshold refusal
(`completion.js:479-485`), but graduation then runs for every consumed attempt under gate ON, without a
teacher-edit zero-proof guard (`:504-540`, with writes at `:622-632`). That permits a preserved low organic
score/row set which was force-passed by a teacher to advance **and** graduate its correct/fill words.

This contradicts the frozen A1 law: the override preserves organic row facts and mints no proof/no
graduation (`15_H6_SCHEMAS_AND_CONTRACTS.md:161-164`), and DF2-10 requires “ONE advance + ZERO graduation”
(`02_TASK_LIST.md:79`). The exemption is needed for progression, but the graduation branch must be zeroed for
that evidence.

### 3. Impossible new-test evidence is still accepted

Consumed evidence now gets integer/range, total/answer-count, score/row, and score/threshold checks
(`completion.js:338-352,459-485`). New-test evidence does not. Its validation checks identity,
`passed:true`, type, day, epoch, and presentation claim (`:406-447`), but never requires a finite integer
score, sane totals/rows, score↔row agreement, or `passed === score >= stored threshold`. An engine-shaped,
presentation-bound new attempt with an impossible score can therefore satisfy the new half and advance TWI.
That leaves C1's explicit “reject impossible attempt shapes/scores” requirement only half implemented.

## C2 — FAIL: a live-new registry replay bypasses the in-transaction frontier bind

The new-claim path correctly reads progress and checks the frontier inside its transaction
(`presentations.js:435-444`). An existing compose-key registry, however, returns its presentation first
(`:331-365`). The bind and serving fence are never reached.

The remaining race is concrete: preflight sees day D as current; another completion advances the frontier;
then an already-existing, unclaimed day-D registry is replayed by the claim transaction. The transaction
returns the stale live-new presentation rather than `day_guard_rejected`, and that presentation can cross
the attempt-mint boundary. C2 requires live compose to accept only the server-authorized current frontier;
the check must cover replay as well as creation.

The round-71 queue replay ordering and introduced-universe ordinal issues are otherwise fixed.

## C3 — FAIL: malformed assignment containers still default open

Round 72 correctly validates malformed override *fields* and threads `uid` into the minting transactions.
It does not validate the assignment value itself as a plain object. `config.js:127-147` treats any truthy
assignment value as present and reads properties from it. Consequently values such as `true`, `7`,
`"assigned"`, or `[]` have no malformed override fields, retain all defaults, resolve `readStatus:"ok"`, and
produce `assignmentExists:true`.

I reproduced all four shapes against the resolver; each returned an OK posture and
`assertServableInTxn(...) === null`. C3 requires the complete assignment authority schema to HOLD on a
malformed authority value, not merely malformed fields of an assumed object.

## C4 — PASS for the round-71 remainder

The reduction now rejects when either reset-lock document has a live lock and permits takeover only when
all present locks are stale. The pre-P5 reset-v2 fence no longer creates the existence-preferred
`list_progress` document, and the reset-v2 path remains behind the named dark gate. I do not retain the
round-71 C4 blocker.

One packet correction is still required: the claim that the disabled branch is “byte-preserved” is too
broad. Its durable reset behavior follows the legacy branch, but the callable response and system-event
payload now include `resetV2`, `targetEpoch`, `rv2Deleted`, and `jobsCancelled`
(`foundation.js:2296-2301`). Call this state-law parity, not byte identity.

## C5 — FAIL: the purported full queue fence is optional

The individual queue checks at `callables.js:523-548` are strong when `p.queueRef` is truthy. The outer
condition is still only `if (p.queueRef)` (`:522`). Thus a live-review presentation with a missing, empty,
or null queue pointer falls through to the current transaction config's threshold and can mint an attempt.
The already-computed `isReviewType`/`isRerun` facts (`:470-472`) are not used to require the queue for a live
review.

The fence needs an explicit typed refusal for `isReviewType && !isRerun` unless a canonical queue reference
is present. New and rerun presentations may retain their defined null leg. The lap has no `queue_invalid`
fixture, which is why all 174 checks remain green with this branch reachable.

Stored `engineResult` replay is fixed; I do not retain that part of C5.

## C6 — PASS for the round-71 remainder

The flip now enumerates the required Track-B inputs, recomputes and compares their hash values, enforces the
ordered cyclic stage grammar, and consumes a real cycling receipt. All 16 committed artifact hashes match
the current files. I do not retain the round-71 C6 blocker.

## C7 — FAIL: audit rows are not bound to the window run

`recordOpsMetric` stamps `shadow` and `registryGeneration`, but no audit-window run identity
(`monitoring.js:153-169`). `classifyRows` filters by generation/shadow only (`:178-204`), and
`evaluateThresholds` bounds the query by `startedAt` only (`:249-262`). `runId` is validated as a non-empty
window field, but it is never stamped on ordinary metric rows or compared during consumption.

Therefore rows from another run with the same generation and timestamps after the current `startedAt` can
feed the current audit. C7 expressly requires `startedAt`/**run** binding. Malformed-window handling and the
priority signal are fixed, but they do not close this remaining isolation requirement.

## C8 — FAIL: the green artifact still cannot falsify the remaining authority bugs

The receipt's expanded hashes, unmasked lint, and several new wrapped tests are useful improvements. The
claim that C8 now runs over the callable boundary is still broader than the lap:

- Case E's wrong-day, rerun-as-new, cross-epoch, impossible-record, and related completion negatives call
  `DONE.completeDay` directly (`engine-emulator-lap.mjs:487-516`), not `reviewV2CompleteDay`.
- The enrollment/assignment “race” removes authority and calls `COMP.composeDayQueue` directly
  (`:759-770`). It exercises the transaction resolver, but not an edit between public preflight and the final
  transaction and not the required public handler boundary.
- There are no fixtures for missing `queueRef`, teacher-edited zero graduation, impossible new-test scores,
  or audit run isolation. Searches for `queue_invalid`, `teacherEdited`, and `windowRunId` in the lap each
  return zero matches.
- The handoff calls the artifact “LAP v3,” while the script header, emitted summary, committed artifact, and
  log label all remain version 2 (`engine-emulator-lap.mjs:4,932-938`; evidence JSON `version:2`).

The 174/174 count is therefore source-bound but still false-green against the exact public-boundary matrix
and the surviving C1/C5/C7 behaviors.

## Independent verification

- `node --check` on all 16 changed/bound JavaScript and MJS sources: **16/16 passed**.
- `require('./functions/reviewV2/callables.js')`: **passed**.
- `npm run lint` in `functions/`: **passed**, with the prior exit mask removed.
- `git diff --check`: **passed** (only unrelated working-copy line-ending warnings).
- Committed engine artifact: `174/174`, `failed:0`, schema `version:2`; all **16/16** recorded SHA-256
  prefixes independently match their source files.
- Direct assignment-container resolver probe: boolean, number, string, and array values all reproduced the
  fail-open OK/default posture.
- I did not rerun the Firestore emulator lap: its runbook/environment is `/app`-based and no baton request
  authorized reviving the retired Docker workflow. The committed result was checked structurally and by
  source hash rather than treated as independent execution evidence.

## Decision

**CHECKPOINT: NO.**  
**DARK DEPLOY ORDER SERIES: HOLD.**  
**Next review: re-check only the remaining C1, C2, C3, C5, C7, and C8 points above, plus ratification or
removal of H-B. C4 and C6 are closed unless their code changes again.**
