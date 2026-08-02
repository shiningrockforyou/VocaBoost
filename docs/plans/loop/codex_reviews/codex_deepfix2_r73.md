# Codex round 73 — r72 remainder verification

**Reviewed commit:** `58af1f1`

**Checkpoint verdict:** **NO**

**`codexDecision`: `NO`**

## Ruling

Round 73 closes most of the Round 72 code findings. I accept the R2-51 ratification and the absolute
`completedTwi` copy; teacher-edited review evidence now advances with zero graduation; stale live-new
presentations are re-bound at replay and submit; a live review now requires its queue; and monitoring rows
are isolated by both generation and window run. The new grading-job index and deploy-order card are also
real.

The checkpoint is still not converged. Two fail-open schema paths remain in C1 and C3, and the C8 artifact
still does not reach several of the exact authority races it claims to close.

## C1 — FAIL: the new-test posture fence is conditional on already-valid input

The new-test half now validates integer score/range, total/answer count, and score/row agreement. Its
posture/threshold check is still fail-open:

```js
const ntGp = newTest.gatePosture;
if (newTest.teacherEdited !== true &&
    ntGp && Number.isInteger(ntGp.threshold) && ... &&
    newTest.score < ntGp.threshold) refuse;
```

At `completion.js:451-468`, a missing `gatePosture`, a non-object posture, a malformed/out-of-range
threshold, or a posture missing/malforming `effectiveEnabled` or `configVersion` simply makes the condition
false. The passed engine-shaped new attempt is then accepted. That is not the handoff's claimed “full r48
fence,” and it conflicts with the frozen requirement that every attempt carries the complete
`gatePosture{effectiveEnabled,threshold,configVersion,source}` (`15_H6_SCHEMAS_AND_CONTRACTS.md:158-161`).

For an engine leg (epoch + claimed server presentation), the complete posture must be required and
validated before its threshold can authorize `passed:true`. Any genuinely legacy leg needs the same narrow,
explicit published fallback treatment used for consumed evidence; malformed engine posture cannot be
silently treated as one.

The teacherEdited zero-graduation change itself is correct (`completion.js:528-565`), and the valid-posture
impossible-new fixture is useful. It does not exercise missing or malformed new-test posture.

## C2 — PASS in code; missing C8 race evidence

An unclaimed live-new registry replay now re-reads progress before returning
(`presentations.js:359-379`), and the attempt transaction independently binds the live-new day to its current
frontier (`callables.js:543-551`). Together these close the stale replay/mint path identified in Round 72.

I do not retain a C2 code blocker. The lap still has no stale unclaimed-registry replay or
preflight-to-submit frontier-race fixture, which remains part of C8 below.

## C3 — FAIL: “object” is not the same as an assignment map

The four scalar/array shapes from Round 72 now HOLD. The resolver, however, accepts every other JavaScript
object as an assignment map (`config.js:129-154`); it checks only `typeof rawAsg === "object"` and
`!Array.isArray(rawAsg)`. Firestore special values are objects too.

I probed the committed resolver with genuine `firebase-admin/firestore` values. A `Timestamp` assignment
and a `GeoPoint` assignment both resolved:

- `readStatus: "ok"`
- `assignmentExists: true`
- `assertServableInTxn(...) === null`

Their absent properties silently select the default gate, threshold, queue size, test size, and modality.
A malformed authority container therefore still becomes a servable assignment. Validate an actual plain
map/record (and the parent `assignments` map), not merely a non-array object.

The lap's Case A also does not contain the claimed four container fixtures; it still ends after the two
malformed-field cases at `engine-emulator-lap.mjs:186-194`. My independent probe confirms the four named
values are fixed, but the source-bound receipt did not test that claim.

## C5 — PASS for the Round 72 remainder

`callables.js:538-578` now requires a queue for live review and validates its canonical path, identity,
pool hash, membership, and threshold. New and rerun presentations retain their defined null queue leg. The
missing-queue case is exercised through the wrapped submit callable. Stored `engineResult` replay remains
correct.

The new fingerprint guard checks only the session-type field, despite its “well-formed fingerprint” comment;
that is an overbroad comment, not a retained C5 blocker for the exact Round 72 queue finding.

## C7 — PASS for the Round 72 remainder

The cached writer view now includes `windowRunId`, every metric stamps it, and `classifyRows` quarantines a
missing or mismatched run while a window is active (`monitoring.js:69-105,159-175,184-218`). The evaluator's
`startedAt` bound then prevents older rows from entering. This satisfies the generation + startedAt + run
isolation requirement; the new in-run/other-run cases exercise the core behavior.

## C8 — FAIL: remaining authority-race coverage is still internal/absent

Moving the six completion negatives through `reviewV2CompleteDay`, adding the queue negative, relabeling the
artifact v3, and binding 16 source hashes are all genuine improvements. The exact public-boundary condition
is still incomplete:

- The enrollment and assignment “races” remove authority and then call `COMP.composeDayQueue` directly
  (`engine-emulator-lap.mjs:826-837`). They neither run the public callable nor perform an edit between its
  preflight and final transaction. This is the same C8 gap called out in Round 72.
- There is no fixture for the C2 stale unclaimed-registry replay or the new submit-transaction frontier bind.
- There is no missing/malformed new-test `gatePosture` fixture, allowing the C1 failure above to remain green.
- There are no Timestamp/GeoPoint/plain-map assignment-container fixtures. The action log's “Codex's 4
  shapes” claim is not represented in Case A.
- The H-B fixture asserts only `currentStudyDay`; it seeds the loser with the same TWI as the winner and never
  asserts `totalWordsIntroduced` (`:648-658`). It therefore cannot distinguish the old additive implementation
  from the new absolute-copy law.

The artifact is now accurately labeled and source-bound, but 182/182 remains false-green against these
specific authority behaviors.

## Packet consistency

- The ratification is recorded in the schema, so I accept H-B. The baton's `wslNote` still says “PROPOSED ...
  ratification pending” and should be refreshed.
- The immutable completion-record field list at `15_H6_SCHEMAS_AND_CONTRACTS.md:126-144` still does not list
  either `wordsIntroduced` or the new `completedTwi`, even though catch-up now depends on them. Add the fields
  and the legacy fallback/validation law to the frozen schema.
- The disabled reset branch is now honestly described as state-law parity rather than byte identity.

## Independent verification

- `node --check` on the 16 changed/bound JavaScript and MJS sources: **16/16 passed**.
- `require('./functions/reviewV2/callables.js')`: **passed**.
- `npm run lint` in `functions/`: **passed**, unmasked.
- Committed artifact: **v3, 182/182, failed:0**; all **16/16** recorded SHA-256 prefixes independently match
  the current sources.
- `firestore.indexes.json`: valid JSON with exactly one `grading_jobs` collection index whose fields are
  `uid ASC, status ASC`.
- Direct assignment probe: boolean/number/string/array now HOLD; Firestore `Timestamp` and `GeoPoint` still
  reproduce the OK/default fail-open.
- I did not rerun the Firestore emulator lap: its runbook remains `/app`-based, and this session was explicitly
  instructed not to revive the retired Docker workflow. I verified the receipt structurally and by source
  hash rather than treating it as independent execution evidence.

## Decision

**CHECKPOINT: NO.**

**DARK DEPLOY ORDER SERIES: HOLD.**

**Next review: re-check only (1) complete fail-closed new-test posture validation, (2) plain-map assignment
authority, and (3) the exact C8 boundary fixtures above. C2, C4, C5, C6, C7, and ratified H-B are closed in
code unless changed again.**
