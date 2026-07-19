# Codex critic pass — D3.5 recovery/adversarial audit plan

Verdict: GAPS-FOUND.

The plan is directionally strong and broad enough to be worth building, but it is not complete as a pass/fail audit yet. The weak points are not scale; they are assertion precision, mis-scoped “fixed vs observe-only” items, and a few expected outcomes that do not match the deployed P4 resolver semantics.

## 1. Retake-threshold is internally mis-scoped

Where:

- July family scope says `retakeThreshold 0.95 CODE bug, data-mitigated` is **NOT fixed / observe-only**.
- A11 then treats the 93% dual-class threshold case as a recovery scenario.
- B17 treats 91/92/93% as an expected pass/fail regression assertion.
- C8 includes teacher gradebook/AI grading baseline.

Why it matters:

If the code bug is not fixed and only current data is mitigated, a failure here is not the same class as “PR-1/2/3/P4 regressed.” It could be data/config drift, assignment lookup ambiguity, or the known unfixed code path.

Required fix:

- Move threshold display into a separate “data-mitigated canary” bucket, not fixed-family regression.
- For A11/B17, explicitly assert the assignment `passThreshold` read from the active class/list is 92 before judging UI pass/fail.
- If the UI shows fail at 93 while assignment threshold is 92, that is a real UI/config-read bug.
- If the assignment threshold is not 92, the scenario is INVALID, not FAIL.

## 2. Several expected outcomes are unfalsifiable

Where:

- A6: “completable/terminal held state”
- A12: “handles or surfaces cleanly (observe whether cutover self-heals vs still needs manual)”
- B12: “Correct modal”
- B20: “recovers (or documents the env-limit)”
- D2: “new words return”
- D5: “grandfather boundary”

Why it matters:

These cannot drive a deterministic PASS/FAIL. The runner can rationalize almost any result as “surfaces cleanly” or “documents env-limit.”

Required fix:

For each scenario, define concrete UI + state assertions. Examples:

- A6 list-end wall:
  - no “pass new-word test first” blocker
  - no new-word test is required when no new words exist
  - progress CSD/TWI either remains stable with a clear terminal/review state or advances only according to the documented list-end rule
  - no repeated review-only loop after reload
- A12 lost-save corrupt session:
  - either recovery rebuilds a valid session and allows completion, or UI shows a specific blocking recovery message
  - no false success screen
  - no CSD/TWI advance without a valid anchor
  - no duplicate attempt
- B12:
  - exact modal branch and buttons
  - whether retry reuses the same attempt identity
  - no second grade/attempt when the first write actually landed

If a scenario is intentionally observe-only, move it to Part E and do not let it gate D3.5.

## 3. Tier 3 needs stronger client-side falsifiers

The plan correctly says Tier 3 is the real audit, but several client-side behaviors are still too underspecified.

Required additions to Part B / Tier 3:

- Empty-submit guard:
  - MCQ empty review: assert exact UI behavior, attempt fields, `answeredCount`/`engagedReview`, CSD/TWI unchanged, and no runaway after reload.
  - Typed empty review: assert blocked before submit or deterministic non-advance; no attempt/grading side effect if blocked.
- Re-entry render:
  - assert the review queue has visible items, not just “does not bounce.”
  - assert retake path can actually submit and exits the stale state.
- Recovery/malformed payload:
  - seed `localStorage`/recovery state, not only Firestore docs.
  - assert rebuilt definitions are present in the graded payload.
- Modals/frozen buttons:
  - exact modal copy and enabled recovery action.
  - after reload/login, assert the primary action is usable, not just no console error.
- Threshold UI:
  - assert visible pass/fail label, score text, and persisted `passed` agree with assignment threshold.

Without these, Tier 3 can pass while the original student-facing complaint (“screen does not advance / wrong result shown”) still reproduces.

## 4. A2 exact-state clones need a deterministic overlay contract

Where:

Part A2 says clone real 26SM docs, then overlay backups from several backup directories.

Why it matters:

The same uid can appear in multiple backup sets (`backups_throttle`, `backups_throttle_relief`, `backups_csd`, `backups_reconcile`, full backup). If the overlay priority is not deterministic, the harness may seed a post-fix or hybrid state and call it “exact pre-fix.”

Required fix:

Add an A2 manifest per student:

- source uid
- source ticket family
- selected backup directory/file
- overlay priority rule
- precondition hash/summary before drive
- expected recovery family
- whether the case is fixed-gating or observe-only

If no exact backup exists and reconstruction is used, mark the case `SYNTHETIC_FROM_TICKET`, not “exact-state clone.”

## 5. Firestore-only seeding misses client-only failure states

Where:

- A5 score>100 via recovery merge
- B4 submit/reload before grade returns
- B5 reload mid-test malformed payload
- B11 network drop mid-submit
- B15 logout/login mid-session

Why it matters:

Several July failures were browser-state failures: `localStorage`, in-flight attempt identity, recovery payload shape, and modal state. Admin-seeding Firestore cannot recreate those.

Required fix:

Add a browser-state seeding layer for Tier 3:

- localStorage recovery answers
- saved currentIndex
- attemptDocId / nonce / pending write state
- malformed or partial generated test payload
- stale session cache where applicable

Then assert both UI recovery and server state. Otherwise these scenarios are only approximate.

## 6. F1/F2/F16 expected outcomes conflict with deployed resolver semantics

Where:

- F1 expects “csd reconciled DOWN to the real anchor”
- F2 expects `twi > listSize` “clamped/handled”
- F16 expects absurd `csd=50` “clamped to list-end terminal”

Why it matters:

At P4 with `LIST_PROGRESS_CANONICAL=false`, `resolveListProgress` is read-only/candidate mode for canonical migration. It computes screens/quarantine candidates and writes the launching legacy doc’s safe values, but it does not blindly canonicalize or globally demote arbitrary legacy docs. In `functions/foundation.js`, suspect docs are recorded as `list_progress_quarantine_candidate`; write-capable quarantine is P5+.

Required fix:

Split expected outcomes by mode:

- P4/read-only expected:
  - no canonical write
  - suspect source is logged as `list_progress_quarantine_candidate`
  - launch doc safe values are applied only according to `safeValuesForDoc`
  - UI does not crash or show impossible negative state
- P5/write-capable expected:
  - quarantine or block according to migration contract

Do not assert “reconciled DOWN” unless the exact launched doc’s `safeValuesForDoc` path actually applies that demotion.

## 7. Live UI scenarios must prove the client is using the server path

Where:

Tier 3 says live UI is THE audit, but the observation section only generically says UI + read-back + logs.

Why it matters:

A UI scenario can pass through an unintended legacy path and still show a good screen. P4 specifically cut over client routing to server callables.

Required fix:

For every Tier 3 fixed-family scenario, record at least one server-path proof:

- function invocation/log evidence where available, or
- `system_logs` emitted only by server path, or
- post-state that only server path can produce, plus no legacy-only side effect

Also assert per run:

- no canonical `list_progress` writes while `LIST_PROGRESS_CANONICAL=false`
- no unexpected client-created attempt marker when `SERVER_REVIEW_MARKER=true`
- no client reset delete path when `SERVER_RESET_PROGRESS=true`

## 8. Reset and challenge scenarios need cross-class/list-wide assertions

Where:

- B8/B9/B22 challenge
- B18 reset
- F17 token accounting

Why it matters:

P4 only moved part of the challenge path server-side; full `reviewChallenge` migration is P10. Reset is list-wide across classes. A single-class happy read-back can miss the actual cutover hazards.

Required fix:

- B18 reset:
  - seed two classes sharing the list
  - assert attempts/session_states/progress are reset across all classes for that list
  - assert unrelated list/class data survives
  - assert no canonical `list_progress` write pre-P5
- B9/B22 challenge:
  - assert answer flip/challenges.history/study_states still behave correctly on the hybrid path
  - assert server `advanceForChallenge` is invoked only for day-advance
  - assert held-day persisted CSD/TWI unchanged after challenge accept

## 9. Safety rail needs an output artifact, not just an implementation promise

Where:

Hard safety rails say 25WT only and zero 26SM writes.

Why it matters:

This audit intentionally clones 26SM data. A bug in seed targeting is the highest operational risk.

Required fix:

Every run should produce a safety artifact:

- all write target paths
- all written class names/ids
- regex/proof each target is 25WT/sandbox
- count of 26SM writes attempted = 0
- before/after read-only 26SM write-sensitive collection counts or update timestamps sampled

Fail closed if any write target is not sandbox-shaped.

## 10. Pass/fail authority needs one more category

Current:

- fixed scenario fail = STOP
- B fail = triage
- E observe-only

Add:

- `INVALID_PRECONDITION` — seed did not match the documented broken state, UI did not reach the intended action, or assignment/list/threshold differs from the scenario contract.

This prevents false FAILs from bad seeds and false PASSes from scenarios that never exercised their target.

## Final decision

`codexDecision=GAPS-FOUND`

`codexConverged=false`

The plan should be revised before build/run. The highest-priority fixes are:

1. resolve the retake-threshold fixed-vs-observe contradiction;
2. make A6/A12/B12/B20/D cases falsifiable;
3. add browser-state seeding for client-only recovery bugs;
4. correct F1/F2/F16 expected outcomes to P4 read-only resolver semantics;
5. add server-path proof and safety artifacts to every Tier 3 fixed-family scenario.
