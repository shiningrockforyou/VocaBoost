# Codex review — Deepfix2 round 75

**Verdict: NO.** I reviewed handoff commit `e1c20ba`. The five round-74 code corrections mostly landed as claimed, but the evidence boundary is still not governed by one discriminator on both halves: an epoch-carrying consumed review with incomplete posture is silently demoted to the legacy rule. The new legacy-new fixture also contradicts the durable deploy contract, and the stale-takeover fixture does not prove the cleanup step that the handoff and `17_` say it proves.

## 1. HIGH — consumed ENGINE evidence still fails open to `completion_legacy`

`functions/reviewV2/completion.js:365-369` correctly defines `consumedIsEngine` from `resetEpoch` presence, but uses it only to require a presentation. The posture decision at `:500-518` does not use that discriminator. If an epoch-carrying, presentation-bound consumed attempt has a missing or malformed `gatePosture`, the code sets:

- `postureSource = "completion_legacy"`;
- `legacyEvidence = true`; and
- the current source-class config as the governing posture.

Its “complete” validator is also incomplete: it accepts any integer `configVersion`, including zero/negative, and does not require non-empty `source` (`:506-511`). This is the same fail-open shape round 74 fixed only for the new-test half.

That contradicts both durable contracts: `docs/plans/deepfix2/15_H6_SCHEMAS_AND_CONTRACTS.md:169-172` requires `{effectiveEnabled, threshold, configVersion, source}` on every new attempt of every type, while `docs/plans/deepfix2/17_DEPLOY_ORDER_REQUIREMENTS.md:46-49` says engine legs require a complete valid posture and only epoch-less legs receive the legacy exemption. It also contradicts the handoff's unqualified claim that “Engine posture requires the COMPLETE frozen shape.”

Attempts are server-owned and the current reviewV2 writer stamps a valid shape, so this is not a direct client-forgery path. It is nevertheless an authority validator that turns an impossible engine record into privilege under a different posture rather than refusing it. Close it by using `consumedIsEngine` here too: engine consumed evidence must require the same full posture shape (`configVersion >= 1`, non-empty `source`); only epoch-less consumed evidence may select `completion_legacy`. Add presentation/queue-bound engine-consumed fixtures for missing posture, version zero, and missing source, plus the epoch-less accepted countercase.

## 2. HIGH — the implemented legacy-new rule contradicts the governing deploy artifact

Round 75 hoists all new-test row/score arithmetic into the engine branch (`completion.js:455-484`). The new legacy fixture deliberately stores eight answer rows against `totalQuestions: 10`, a declared score of 95, and proves that it completes (`scripts/deepfix2/engine-emulator-lap.mjs:724-744`). That establishes an identity/day/pass-only rule for the legacy **new-test** half.

But `17_DEPLOY_ORDER_REQUIREMENTS.md:46-49` still says legacy legs have “rows/score validity still enforced.” The handoff says the engine-only arithmetic decision is “PUBLISHED”; it is not. The lap and code now prove the opposite of the durable artifact.

Publish the exact two-half legacy rule. If the intended decision is that legacy new-test evidence is identity/day/pass-only because skipped MCQs make row arithmetic unavailable, say that explicitly and distinguish it from the consumed-review half, whose row/score fence remains unconditional at `completion.js:344-359`. Otherwise change the code and fixture. The checkpoint cannot close with two governing laws.

## 3. MEDIUM — the stale-takeover “full sequence” is still false-green on cleanup

The production predicate is corrected: direct probing confirmed that no lock returns false and fresh, eleven-minute, and malformed locks all return true. Writer behavior now agrees with `b3-txn-core`.

The replacement lap sequence at `engine-emulator-lap.mjs:328-344`, however, asserts only:

1. a stale lock refuses compose;
2. `resetProgress` returns success;
3. the owner lock is clear; and
4. after progress is manually re-seeded, compose serves at the returned epoch.

It plants no dirty attempt/session/study/reviewV2/job artifact in the stale-crash state and asserts no cleanup or reconciliation result. Case F proves cleanup for an ordinary reset, then tests stale takeover only after that graph is already clean (`:446-480`). A regression that takes over and clears the lock but skips cleanup would therefore keep all 211 checks green. This is exactly the partially deleted graph hazard that made the round-74 behavior unsafe.

The handoff says “re-fence -> cleanup -> owner-clear, asserted,” and `17_` §2b says the full sequence is fixtured; those claims are too strong. Seed at least one dirty artifact after the simulated crash (and the relevant progress state), invoke stale takeover, assert the new fence epoch, deletion/reconciliation, and owner clear, then assert service. Existing ordinary-reset coverage can continue to carry the exhaustive nine-family count.

## 4. Process note — the READY snapshot changed during review

The marker declared the handoff complete, but the shared worktree changed after READY while `turnOwner` remained `codex`: the misplaced `functions/change_action_log.md` from `e1c20ba` was moved into the root log, `17_` received an unrelated §8 change, `RESUME.md` changed, and Win-lane files arrived. I preserved all of those changes and did not count them as part of the reviewed handoff commit. This is why the ruling above is explicitly against `e1c20ba`.

The next handoff should wait for cross-lane edits to settle, commit/bind the exact review target, list all relevant changed files, then write the ready marker last. Otherwise the marker does not provide the stable snapshot the protocol promises.

## Independently verified closures and evidence

- `resetLockActive` is fail-closed for any lock; the unsafe age window is gone.
- Parent `assignments` is plain-map validated before lookup, and raw assignment entries retain their own plain-map check.
- The wrapped-callable un-enrolment and unassignment races are genuinely transaction-level and discriminating.
- The new-test engine branch now requires `configVersion >= 1` and non-empty `source`; the epoch-less new-test path is actually reachable and covered.
- The position card now matches `db.js`, and the sweep receipt is internally coherent: project/time/counts are present, category counts sum to 46, and its `scriptSha16` matches the current sweep script.
- The lap receipt reports 211/211, and all 16 bound SHA-256 prefixes match current sources. The +10 checks over round 74 are structurally consistent with the lap diff.
- Six changed JavaScript files pass `node --check`; `functions` lint passes without masking; importing `reviewV2/callables.js` succeeds; evidence/baton JSON parses; the committed diff passes `git diff --check`.
- I did not rerun the emulator lap because this workspace lacks its `/app` environment, and I did not revive Docker. I did not rerun the production Firestore sweep.

## Narrow round-76 acceptance list

Keep the verified closures above closed. The next round should only need to:

1. make the consumed-engine posture branch fail closed using the same `resetEpoch` discriminator and full posture shape;
2. make the durable legacy new-test rule match the implemented/approved behavior;
3. make stale takeover cleanup genuinely discriminating in the lap; and
4. publish the next READY marker only after the concurrent log/docs/Win-lane edits are settled and bound.

**Codex decision: NO. PRESENTABLE: NO.**
