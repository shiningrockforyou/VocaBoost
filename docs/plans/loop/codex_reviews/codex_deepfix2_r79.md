# Codex review — Deepfix2 round 79

**Verdict: YES. PRESENTABLE: YES.** I reviewed frozen target `be1981f` and the exact merged-rules
artifact at sha16 `f40f91fce3693b82`. Round 79 closes the round-78 blocker on both client update
branches without widening the denial to historical manual/teacher-edited attempts. I found no blocker
to deploying this exact rules artifact as the remaining dark rules leg. Nothing in this verdict
authorizes the client cutover or either activation switch.

## Round-78 closure

The new guard is on the existing resource, not merely the incoming diff:

```rules
allow update: if isAuthenticated()
  && !isEngineStampedAttempt()
  && (
    (owner && answersOnly) ||
    (teacherOfRecord && teacherAllowedDiff)
  );
```

`isEngineStampedAttempt()` checks the shared four-key set (`resetEpoch`, `presentationId`, `queueId`,
`engineResult`). Its position above the owner/teacher OR is the important property: neither an owner nor
the teacher of record can replace `answers` on an engine attempt. The same shared declaration feeds the
request-side create/teacher-update guards, so the three uses cannot silently acquire different engine-key
lists.

The compatibility boundary is also correct. The guard intentionally does **not** use the full
`serverOnlyAttemptKeys()` set, so a historical `manualOverride`/`teacherEdited*`/`gatePosture` document
does not become client-frozen merely because it is marked. AE14 and AE15 pin the owner and teacher allow
directions; the ordinary legacy controls remain present as well.

I reran the round-78 Auth + Firestore emulator probe against the round-79 artifact. The old probe exits
nonzero because it deliberately asserts that the former hole should still be open, but its observed state
is the desired independent result:

```json
{
  "answersUpdateStatus": 403,
  "resetEpochUpdateStatus": 403,
  "storedAnswers": [
    {"wordId":"wordA","isCorrect":true},
    {"wordId":"wordB","isCorrect":false}
  ],
  "resetEpoch": 0
}
```

The grade-bearing rows stayed byte-for-byte in their original semantic order. This is the inverse of my
round-78 reproduction, where the marker write was denied but the same-count row permutation returned 200
and persisted.

## Evidence pressure-test

- The ready marker is protocol-complete and agrees with baton round 79, task, handoff, target, and artifact
  hash. Target `be1981f` is an ancestor of `origin/main`; the later local handoff commit does not change any
  round-79 artifact, harness, receipt, evidence, or target-plan path.
- The artifact, matrix, mutant runner, runner, and diff-helper hashes match the committed receipt. The
  mutant report binds artifact `f40f91fce3693b82` to matrix `c2070cf3e746ce06`, reports canonical
  **244/244**, and records **15/15** applied mutants killed.
- AE1–AE13 exercise direct update, merge, full set, field deletion, array transform, batch, transaction,
  third-party, teacher-of-record, self-asserted-teacher, delete/recreate, and stored-row survival. AE14/AE15
  cover the false-denial direction.
- M15 removes only the new resource-side guard and falls to 234/244. M14 now mutates the single shared
  engine-key declaration and is killed across request- and resource-side uses. The previous false-green
  gap is therefore discriminated rather than merely accompanied by more passing tests.
- This resumed Windows environment still lacks the repository runner's Bash runtime, so I did not claim a
  third full 244-case/mutant regeneration. I did independently verify the committed report's hashes and
  counts and exercised the decisive authorization path through the real local emulators.

## Required later gates, not rules-deploy blockers

Two disclosed items remain hard prerequisites before the engine client can cut over or its evidence can
govern users:

1. `completeDay` must bind every accepted engine row's `wordId` to the claimed server presentation, not
   rely only on count/score arithmetic.
2. An existing deterministic `rv2_{presentationId}` attempt must be accepted as a replay only after its
   full engine stamps and presentation claim are validated; an unstamped/pre-seeded document must fail
   closed.

Their current placement is acceptable sequencing for this dark rules deployment: `WORK_QUEUE.md` puts
both in `typed-fix-audit`, and makes `df2-51-client` depend on that item. The rules now prevent new clients
from creating engine-stamped attempts and freeze future server-stamped attempts against client updates;
the engine remains dark. Moving the two server-side defenses into this rules artifact would not improve
the safety of deploying the artifact itself.

One wording qualification should carry into that audit: before these rules are deployed, the statement
that an engine-key's presence “proves” server authorship is not historically absolute—the live create
rule allowed arbitrary extra fields. The disabled feature flag and source grep establish that normal
clients do not write the four keys, and the B2 sample found zero `resetEpoch` attempts, but that is not a
cohort-wide provenance proof. Before any pre-existing attempt is admitted as engine evidence, scan the
production attempts for all four keys and quarantine anything that is not fully bound to a real server
presentation. This is an activation/cutover prerequisite, not a reason to leave the protective rules
undeployed.

The deploy order must still re-fetch the live rules, refuse on baseline drift, stage this exact artifact
into the configured `firestore.rules` slot, verify sha16 `f40f91fce3693b82`, deploy, and re-baseline. A
plain deploy of the repository's current P10 draft remains unsafe.

**Codex decision: YES.** The round-78 authority flaw is closed and discriminated; the exact round-79
artifact is safe to proceed to its guarded dark deploy order.
