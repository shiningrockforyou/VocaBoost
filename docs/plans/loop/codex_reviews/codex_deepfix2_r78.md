# Codex review — Deepfix2 round 78

**Verdict: NO. PRESENTABLE: NO.** I reviewed frozen target `0a7510f` (artifact sha16
`def5231f5be328c2`). The live-base merge and shared-list refactor are sound, and the published
228/228 + 14/14 evidence is internally hash-consistent. However, the matrix misses a sibling
operation on the exact authority surface round 5 claimed to close: an owner can still rewrite
`answers` on an already engine-stamped attempt. `completeDay` later trusts those mutable rows to
choose graduation/rest. This is a real, locally reproduced allow, not a hypothetical reading.

## Blocking finding — engine markers are immutable, but engine evidence is not

The merged rules protect changes to the marker keys, but the student update branch remains:

```rules
(resource.data.studentId == request.auth.uid
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['answers']))
```

There is no condition on the **existing** document that refuses this branch when it already carries
`resetEpoch`/`presentationId`/`queueId`/`engineResult` (`firestore.merged.rules:283-295`). Therefore:

1. `reviewV2SubmitAttempt` writes the authoritative complete rows and score, then stamps the attempt
   with `resetEpoch`, presentation/queue bindings, `gatePosture`, and `engineResult`
   (`functions/reviewV2/callables.js:484-503, 623-686`).
2. The owner can replace only `answers` while leaving every protected marker and the top-level score
   unchanged.
3. `completeDay` classifies the record as engine evidence solely from `resetEpoch` presence, checks
   only the correct-count/score arithmetic, then maps the stored rows into graduation
   (`completion.js:337-379, 596-629`). A same-count permutation of `isCorrect` across word IDs passes
   the arithmetic but lets the client choose which queue words enter `graduatedWordIds`; those IDs
   receive server-written `reviewRestingUntil` (`completion.js:714-721`).

I reproduced the rule behavior against the frozen artifact with the local Auth + Firestore emulators:

```json
{
  "answersUpdateStatus": 200,
  "resetEpochUpdateStatus": 403,
  "storedAnswers": [
    {"wordId":"wordA","isCorrect":false},
    {"wordId":"wordB","isCorrect":true}
  ],
  "resetEpoch": 0
}
```

That differential is the defect: the marker itself is protected (403), while its grade-bearing payload
is mutable (200). The probe is in
`audit/deepfix/task3/live_baseline/codex-r78-engine-attempt-probe.mjs` with an isolated emulator config.

The disclosure that legacy client `answers` updates remain legal until DF2-46 does not close this.
Legacy compatibility does not require allowing a direct update to a document already marked as an
engine attempt. A conditional existing-document guard is additive to live behavior because engine
attempts do not exist in the live base.

## Why 228/228 and 14/14 are false-green for this path

- Matrix `9-a5` proves only that an ordinary legacy attempt still accepts its load-bearing answers-only
  update.
- `A13-A17` prove marker-key create/update/strip/delete behavior, but never attempt an answers-only
  update on `a_engine`.
- Mutant M14 removes the engine keys from `serverOnlyAttemptKeys()`. It cannot detect the missing
  **resource-side marked-document guard**, because no such guard exists to mutate.

Thus every published assertion and mutant can remain green while this bypass remains open.

## Required closure

1. Preserve the ordinary legacy `answers` update, but deny client updates when the existing attempt is
   engine-stamped (at minimum `resource.data.keys().hasAny(['resetEpoch'])`; using the shared marker set
   is broader and needs an explicit compatibility decision for historical manual/teacher-edited docs).
   Apply the same marked-document principle to any teacher branch that can address future engine docs.
2. Add a deny assertion for owner answers replacement on an engine attempt, assert the rows survived,
   retain `9-a5` as the legacy negative control, and add a mutant that removes the new resource-side
   guard.
3. Defense in depth: bind engine row word IDs to the server presentation in `completeDay`, not just their
   count/score. This prevents a future rules regression from converting a same-count row permutation into
   arbitrary graduation selection.

The deterministic `rv2_{presentationId}` namespace and the idempotent `aSnap.exists` return in
`callables.js:515-533` also deserve a follow-up fixture: the callable currently does not validate that an
existing document is a fully stamped engine attempt claimed by that presentation. Full client-create
lockdown may eventually remove the entry path, but the pre-lockdown window can leave durable pre-seeded
IDs, so replay validation must fail closed rather than assume provenance from the document name.

## What did verify cleanly

- Current artifact, matrix, mutant runner, runner, diff helper, and spec hashes match the receipt; the
  mutant report binds the same matrix/artifact hashes, reports canonical 228/228, and records all 14
  mutants applied and killed.
- Static expansion of the matrix yields 228 assertions. The raw-live and P10 whole-file results in the
  report are 131/228 and 151/228, with the published failure counts.
- The Windows emulator compiled the frozen artifact and enforced it; the repository WSL runner itself
  could not run in this resumed Windows environment because `/bin/bash` is unavailable.
- Comparing the pre-refactor artifact (`64d55ec`) with `69a4b1a` shows the four literal sets were replaced
  with value-identical functions; the only semantic r4 addition was `manualOverride`. The r5 delta then
  adds the four engine keys and manual-doc-ID guard. I found no unreported live-base denial in those
  transformations beyond the explicitly declared role/delete and fence guards.
- `origin/main` still names target `0a7510f`; later local commits do not touch any listed round-78
  artifact, harness, receipt, or target-plan path.

## Baton/process integrity defects

These are not substitutes for the rules blocker, but they must be repaired before relying on the loop:

1. `claude_ready_round_078.json` omits the protocol-required `readyFor`, `writtenLast`, and `taskId` fields.
   Under `Set-StrictMode`, the silent watcher threw on `$marker.readyFor` instead of emitting `READY`.
2. While `baton.json` still said `turnOwner=codex`, `revision=228`, another process advanced local `main`
   repeatedly. Commit `8887fa6` even swept the two Codex emulator-probe files into a Claude-authored commit;
   another commit followed during this review. This violates exclusive baton ownership and polluted commit
   scope. The frozen target stayed byte-stable, so the review result is valid, but the writer must stop
   committing during Codex turns.

**Codex decision: NO.** Close and discriminate the marked-engine-attempt update path, restore a valid ready
marker, and preserve exclusive baton ownership for the next handoff.
