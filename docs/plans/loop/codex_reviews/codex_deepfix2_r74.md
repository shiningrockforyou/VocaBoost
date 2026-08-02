# Codex review — Deepfix2 round 74

**Verdict: NO.** Reviewed commit `e9e8ac4` and the round-74 handoff independently. The 201/201 lap receipt is internally consistent and this fold closes several real items from round 73, but it also turns a crashed reset into a timed fail-open path before reset cleanup has completed. Completion still contradicts the published legacy boundary, the parent assignment container remains fail-open, and the assignment-removal authority race is still not exercised through the public boundary.

## Deployment blockers

### 1. A stale reset lock now expires for ordinary engine writers before takeover/cleanup

`functions/reviewV2/composer.js:159-170` treats a `resetInProgress` lock older than ten minutes as inactive. The lap at `scripts/deepfix2/engine-emulator-lap.mjs:303-318` explicitly ratifies that an internal composer call **SERVES** with an eleven-minute-old lock.

That is not the frozen reset contract. `docs/plans/deepfix2/15_H6_SCHEMAS_AND_CONTRACTS.md:317-320` says an old lock is takeover-eligible: the next reset re-fences and re-runs cleanup, while write operations remain rejected until takeover succeeds. `functions/foundation.js:2167-2266` confirms why the distinction matters: reset fences first, then deletes attempts/session/study/class progress/reviewV2 jobs and reconciles state, and only clears the owner lock at the end. A crash after the fence but before those operations leaves a partially reset graph. Letting compose/mint/complete write through it at T+10 minutes permits those writes to be consumed or later deleted by the eventual takeover. `scripts/deepfix2/b3-txn-core.mjs:22-29` also still refuses any lock, so writer semantics now disagree.

Direct predicate probing confirmed the new behavior: a nine-minute lock is active, an eleven-minute lock is inactive, and a malformed lock remains active. The liveness mechanism must be stale-owner **takeover**, not ordinary writer admission. Keep all engine writers fail-closed while either reset lock exists; prove stale takeover re-fences, completes cleanup/reconciliation, clears the owner lock, and only then permits service. Replace the eleven-minute `SERVES` fixture with that sequence.

### 2. C1 is not implemented as published, and the claimed “complete valid posture” is incomplete

`functions/reviewV2/completion.js:431-456` uses `resetEpoch` presence as the new-engine discriminator, but the new-test row and posture fences at `:458-483` run after that branch and therefore apply to epoch-less legacy attempts too. In particular, an old new-test attempt with no `gatePosture` is rejected by `ntPostureValid` even though the handoff and `docs/plans/deepfix2/17_DEPLOY_ORDER_REQUIREMENTS.md §6` publish a legacy posture/presentation exemption. The legacy MCQ writer also stored only answered rows while `totalQuestions` could include skips, so the unconditional row-count rule requires an explicit published decision rather than an exemption claim.

The engine posture validator accepts any integer `configVersion`, including zero or negative values, and does not require `gatePosture.source` (`completion.js:475-480`). That conflicts with the posture schema at `15_H6_SCHEMAS_AND_CONTRACTS.md:169-172` and the global `configVersion >= 1` rule at `:267-271`. The lap tests only missing posture and a string threshold (`engine-emulator-lap.mjs:545-555`); it has no epoch-less posture-free case and no zero/negative-version or missing-source case.

Define the engine/legacy discriminator once, apply the complete posture requirement only to the engine leg, and make the legacy branch match the exact published boundary. For an engine posture, require the full frozen shape, including positive `configVersion` and non-empty `source`, or narrow the schema and claims consistently.

### 3. C3 still indexes an unvalidated parent `assignments` container

The new raw-entry prototype check is useful: direct Timestamp and GeoPoint entries now HOLD. But `functions/reviewV2/config.js:128-143` still evaluates `(classSnap.data().assignments || {})[listId]` before validating the parent container. A direct resolver probe with `assignments: [{reviewPassThreshold: 92}]` and `listId: "0"` returned `readStatus: "ok"`, `assignmentExists: true`, and no serving error. A malformed array therefore masquerades as the assignment map.

Validate `assignments` itself as absent/null or a plain map before property lookup, then validate the entry. Add malformed parent array/Timestamp/GeoPoint fixtures. The round-74 lap's five-container loop covers raw entry values, not the parent, and despite the handoff wording it fixtures Timestamp but not GeoPoint.

### 4. C8's assignment-removal race remains a direct helper test

The new emulator-only `afterPreflight` hook and wrapped-callable un-enrolment test at `engine-emulator-lap.mjs:939-947` correctly close the public enrolment race. Assignment removal is still mutated and then checked by direct `COMP.composeDayQueue` at `:892-904`; it does not exercise removal between the public callable's preflight and transaction reread. Add the corresponding wrapped-callable mid-call unassignment fixture and assert the typed refusal.

## Evidence and packet accuracy

- `scripts/deepfix2/list-position-sweep.mjs` is a reasonable read-only scanner, but neither its production output nor a receipt binding project, time, counts, and script hash is committed. The engine lap artifact does not hash it. I therefore cannot independently promote the prose-only “46 lists, zero duplicates/gaps” claim to verified evidence.
- The new card is factually inverted. `NEED_TO_FIX.md:531-537` and `17_DEPLOY_ORDER_REQUIREMENTS.md:31-33` say `deleteWord` renumbers positions and propose making it not renumber. Actual `src/services/db.js:658-668` only deletes the word and decrements `wordCount`; it does not reindex. `addWordToList` at `:599-621` appends at the decremented count, which can reuse an existing position after a middle deletion. Correct the diagnosis and choose a coherent repair: reindex after deletion, or allocate from a safe monotonic/max position and explicitly support/surface gaps.
- The end-to-end gapped-list → engine-day → progress fixture and completeSession-side interlock fixture remain explicitly deferred. The prose is now honest, so I am not treating the latter as a new hidden claim. The gapped-list path remains a named deploy risk until the 25WT gate or equivalent proof closes it.

## Independently verified closures

- The evidence artifact is version 3, reports 201/201, and all 16 recorded source SHA-256 prefixes match the current files.
- The apparent 201-versus-197 static assertion-site difference is explained by one container assertion executing five times.
- All 17 relevant JavaScript files pass `node --check`; `functions` lint passes without masking; importing `functions/reviewV2/callables.js` succeeds; `firestore.indexes.json` parses; `git diff --check` exits zero.
- C2 stale live-new replay and submit-frontier day guards are fixtured.
- H-B now discriminates absolute `completedTwi` from the additive bug (45/50 versus 55).
- Noncanonical queueRef and pool-hash mismatch fixtures landed.
- Awaited position-gap warnings reach all current canonical loaders, monitoring skew is published, the completion write includes `lastStudyDate`, and the transaction booleans now derive from the in-transaction progress snapshot.
- I did not rerun the emulator lap: this workspace does not provide the `/app` environment, and the standing instruction forbids reviving the old Docker workflow. I also did not issue an independent production Firestore read.

## Next-round acceptance list

Keep the verified closures above closed. A narrow next round should:

1. restore reset fail-closed behavior until successful stale takeover/cleanup/owner-clear and fixture that complete sequence;
2. align the legacy new-test branch and full engine posture validation with the published contract;
3. validate the parent `assignments` container before lookup and cover malformed parents;
4. run the unassignment race through the wrapped callable; and
5. correct the position-bug card and bind any production sweep claim to reviewable evidence.

**Codex decision: NO. PRESENTABLE: NO.**
