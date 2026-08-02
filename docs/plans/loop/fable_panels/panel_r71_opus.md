# DEEPFIX2 · r71 STAGE-2 CHECKPOINT — Opus lane: VERIFYING THE r70 FOLD

> Reviewer: Opus lane. Scope: the working tree as handed off
> (`docs/plans/loop/handoffs/claude_to_codex_deepfix2_r71.md`).
> Duty: (1) adjudicate my own 14 r70 closing conditions + Codex's C1-C8; (2) hunt NEW defects the
> fold introduced; (3) rule on the checkpoint.
> Method: full read of `functions/reviewV2/*` (all 10 modules incl. the new `progress.js`), the
> reworked `functions/foundation.js` legs (`resetProgress` in full, the accept writer, the new
> exports), `src/services/db.js`'s accept writer, all three `scripts/deepfix2` scripts, the lap v2
> in full, the committed receipt, and the 15_/16_ supersessions. `node --check` on all 15 files
> (all parse). `npx eslint` inside `functions/` on `reviewV2/*.js` + `foundation.js`: **exit 0, 0
> problems** — the new CommonJS-aware config is real. Receipt `sourceShas` recomputed and compared
> byte-for-byte against the tree: **13/13 match**. The emulator was NOT run (per instruction).

## VERDICT: **NO** — one live-cohort BLOCKER, one HIGH interlock, and three closing conditions
## (C6 · C7 · C8/CC-8/CC-10) are not closed.

This is a very different NO from r70. The engine itself is now, in my judgment, **contract-correct**:
`progress.js` is exactly the day authority both lanes asked for, the completion rebuild closes BL-1
in every leg I could think to attack, the frontier bind is genuinely in-transaction in the composer /
completion / mint-visit, the reuse throw is gone, the strict config schema holds Codex's own repros,
`assertServableInTxn` really is in every minting txn, and read-before-write is clean in all six
reworked transactions (I traced each one). 12 of my 14 conditions and 4 of Codex's 8 landed cleanly.

The NO is driven by **one defect that is not in the engine at all** — the `resetProgress` rewrite is a
LIVE callable (`SERVER_RESET_PROGRESS_ENABLED = true`) and its new fence writes a document that the
pre-P5 read path treats as authoritative — plus a monitoring signal that is provably dead, an
activation receipt whose "source-bound" property is not actually enforced, and a set of packet claims
that the evidence does not support.

---

## 1. BLOCKER

### BL-A — `resetProgress`'s new fence creates `users/{uid}/list_progress/{listId}` pre-P5; the live read path then treats that shell doc as canonical progress **forever**

`functions/foundation.js:2089-2110` (the new §9 fence) does, unconditionally and regardless of
`LIST_PROGRESS_CANONICAL`:

```js
const lpRef = db.doc(`users/${uid}/list_progress/${listId}`);
...
const stamp = {resetEpoch: targetEpoch, resetInProgress: {opId, targetEpoch, at: Timestamp.now()},
               resetAt: Timestamp.now(), resetBy: "resetProgress", listId};
tx.set(pmRef, stamp, {merge: true});
tx.set(lpRef, stamp, {merge: true});     // ← creates the canonical doc pre-P5
```

`LIST_PROGRESS_CANONICAL === false` (`foundation.js:65`). The doc created has **no
`currentStudyDay`, no `totalWordsIntroduced`, no `programStartDate`, no `recentSessions`**.

Both live readers prefer that document **on existence, not on the flag**:

- `resolveListProgress` (`foundation.js:1763-1773`, `SERVER_RESOLVE_LIST_PROGRESS_ENABLED = true`):
  `if (canonicalSnap.exists) return {mode:"canonical", csd: data.currentStudyDay ?? 0,
  twi: data.totalWordsIntroduced ?? 0, data}` — returning **before** the legacy enumeration, the
  anchor computation, the CSD screen, and (critically) the **F4-1 leg that create-on-misses and
  reconciles the launching `class_progress` doc**, which the module's own header at
  `foundation.js:1714-1719` says "keeps the completion day-guard baseline current".
- `progressService.getOrCreateClassProgressViaResolver` (`src/services/progressService.js:423-432`)
  then takes the CANONICAL branch and builds `progress = {id, classId, listId, ...canonicalData}` —
  a progress object with no csd/twi/programStartDate.
- The teacher surface `fetchStudentsProgressForClass`
  (`src/services/progressService.js:788-801`, `SERVER_PROGRESS_WRITE = true`) reads the same doc
  first and returns it as the student's progress.

The module header at `foundation.js:1720-1721` states the invariant this breaks in terms:
*"Creates NO canonical doc on ANY load (the P4 acceptance asserts the list_progress collection stays
empty until P5)."*

**Failure scenario (live, 26SM, no flag flip required).** CS runs `resetProgress` for a student —
a routine, runbook-prescribed operation. Immediately afterwards csd/twi genuinely are 0, so the next
load looks correct and nothing alerts. The student resumes studying; `completeSession` advances the
**legacy class-scoped** doc (`durableProgressRef` → `class_progress/{classId}_{listId}` pre-P5) while
the canonical shell stays `{resetEpoch, …}`. From that moment `resolveListProgress` reports
`csd: 0, twi: 0` permanently, the session initializes at day 1 with twi 0, the legacy reconciliation
+ CSD screen never run again for that student+list, and the teacher view shows zeroed progress. The
P5 migration's premise ("hydrate only when canonical is absent") is also defeated — these students
now look already-migrated with csd 0.

The fold's only acknowledgement is a code comment (`foundation.js:2079`: *"NOTE [logged
supersession]: writing the lock onto `list_progress` pre-P5 supersedes the P4-era 'collection
provably empty' acceptance assert"*). I searched the docs: **no such supersession is logged.**
`grep -rn "provably empty" docs/` returns nothing; the handoff's doc list is 15_ §2/§3/§7 and 16_ §3
only. It is also absent from `SUPPORT_RUNBOOK.md`, which CLAUDE.md makes the source of truth for the
CS path this change alters.

This is the only finding I consider blocking, and it is blocking because it is **not gated by the
review_v2 dark posture** — `resetProgress` runs today, on the real cohort, the moment this tree
deploys.

Remedies (any one closes it, but it must be a *decision*): (a) keep the pre-P5 lock+epoch on
`progress_meta` only and add the `list_progress` leg at P5 (the engine already reduces `max(both)`,
so a single-doc pre-P5 tombstone is sufficient for every reviewV2 reader); (b) write the full
`defaultProgressShape` zeros alongside the fence so the doc is a *valid* canonical record — this
still breaks the empty-until-P5 acceptance and the migration premise, so it needs its own logged
supersession plus a P5-migration change; (c) make the two readers ignore a canonical doc lacking
`currentStudyDay` while `LIST_PROGRESS_CANONICAL === false`.

---

## 2. HIGH

### H-A — Two uncoordinated writers of `currentStudyDay`/`totalWordsIntroduced` on the same durable doc; the engine's advance is *not* "completeSession's exact law"

`completion.js:511-527` writes `{currentStudyDay, totalWordsIntroduced, lastStudyDate, lastSessionAt,
updatedAt}` to `foundation.durableProgressRef(uid, winningClassId, listId)`. `completeSession`
(`foundation.js:1494-1506`) writes to the **same ref** and additionally owns `recentSessions`, `stats`,
`streakDays`, `interventionLevel` and (under `FORCED_PATHWAY_ENABLED`) `reviewMode`.
`SERVER_COMPLETE_SESSION_ENABLED = true` — it is live.

Neither writer knows about the other. There is no interlock: `completeSession` has never heard of
`day_completions/{listId}_d{N}_e{E}`, and `completeDay` has never heard of `completeSession`'s
day-guard or its `recentSessions`-based idempotency.

Concretely, `completeSession`'s idempotency branch is
`if (dayNumber === currentCsd && last && last.day === dayNumber)` (`foundation.js:1361`). Because the
engine advance does **not** append a `recentSessions` summary, that branch cannot fire after an
engine completion: the engine advances csd 4→5 without touching `recentSessions`, then the client's
`completeSession({dayNumber: 5})` sees `expectedDay = 6`, `last.day === 4`, and returns
`day_guard_rejected` (`foundation.js:1364`). The day's session summary, streak recompute,
intervention/throttle recompute and `reviewMode` recompute are **silently lost for every
engine-completed day**. In the opposite order (legacy first) the engine's frontier has already moved
and `reviewV2CompleteDay` returns `day_guard_rejected`.

The packet claims the advance is "completeSession's exact law incl. shape parity on create"
(handoff C1; `completion.js:507-510`). It is a csd/twi-only subset. The lap cannot see this: nothing
in it exercises `completeSession` and `completeDay` against the same student.

This is not live today (the engine is dark). It is squarely a **deploy-order** blocker for the
WinClaude series: the order must either name the interlock (which callable owns the advance in the
rehearsal window, and what happens to `recentSessions`/`streakDays`/`interventionLevel`) or defer it
to DF2-46 with the consequence published.

### H-B — Dual-enrolled students are locked out by construction: the CAS winner advances only its **own class-scoped** progress doc, and every later compose by the second class is then refused

Pre-P5 `durableProgressRef` is class-scoped (`foundation.js:292-296`). `completeDay` advances
`truth.progressRef` = the **winning class's** doc; the CAS loser returns `already_completed`
(`completion.js:256-258`) and, correctly per "one advance per shared logical day", writes nothing.

The consequence with a class-scoped truth source is that class B's csd never moves. Its
`frontierDay` stays at the already-completed day, its `twi` stays one day behind, and therefore:

- `composeDayQueue` for B on the shared next day ⇒ `day_guard_rejected` (`composer.js:273-275`);
- on the same day, B's tuple `t{twi}` no longer equals A's ⇒ the reuse path returns
  `reuse_anchor_mismatch` (`composer.js:308-317`);
- B can never complete anything again (`already_completed` for the old day, `day_guard_rejected` for
  the new one) — the state is terminal short of a reset.

The lap **fixtures exactly this refusal as correct** (`engine-emulator-lap.mjs:219-221`: seed cB3 at
`twi: 6` against cB1's `twi: 8`, assert `reuse_anchor_mismatch`) without noting that divergent
class-scoped twi is the *steady state* after the first engine completion, not a pathological seed.
`progress.js:35-39` does declare the boundary ("the cross-class csd-view reconciliation is
adoption-layer work (P5/DF2-46)") — but r70 made the day authority **hard**, so the declared soft
divergence is now a hard, permanent server refusal for a population R2-36 exists to serve. That
change of character needs an explicit ruling before the deploy order, and a cross-class **complete**
fixture (the lap has cross-class *compose* only).

### H-C — `priority_saturation_day` is unreachable: `composePresentation` never returns `priorityCount`

`callables.js:201-206` guards on `Number.isInteger(p.priorityCount) && Number.isInteger(p.effectiveTestSize)
&& p.priorityCount >= p.effectiveTestSize`. But `composeLiveReviewTest` returns `priorityCount`
(`presentations.js:203`) into a local that is **discarded**: `presentations.js:423-428` lifts only
`presentedWordIds / compositionVersion / fallbackSeed / effectiveTestSize`, and the `created` return
object (`presentations.js:522-531`) has no `priorityCount` field. `p.priorityCount` is therefore
always `undefined`, the guard is always false, and the signal can never be emitted.

This is verbatim the r70 M-2 finding — `priorityCount` discarded by the callable — surviving the
fold. `grep -n "priority_saturation_day" scripts/deepfix2/engine-emulator-lap.mjs` returns **zero
hits**: the lap does not test it either, which is why 148/148 is green over dead code. The handoff
(C7) and `change_action_log.md` both assert it is emitted.

---

## 3. MEDIUM

| # | Finding | Evidence |
|---|---|---|
| M-A | **`twi` (a COUNT) is used as a POSITION bound with no contiguity assertion.** `introducedUniverse` filters `wordIndex < twi`; `ComposeNewTest` slices `wordIndex >= twi` and stamps `rangeStartIndex/rangeEndIndex` = *positions*; `completeDay` then computes `wordsIntroduced = end - start + 1` = a *position span*. All three agree only when positions are exactly `0..n-1`. `loadCanonicalWordsStrict` was written for this fold and validates integer ≥ 0 + no duplicates — but **not** contiguity or 0-basing, the invariant the engine actually depends on. A list with a deleted word (positions `0,1,2,4,5`) silently mis-slices the universe and mis-counts `wordsIntroduced`; a 1-based list drops the last word from the universe forever. Assert `words[i].wordIndex === i` (typed refusal + ops signal, like the duplicate leg) or slice by ordinal. | `progress.js:85-87`; `callables.js:123-140, 271-279`; `completion.js:462-472` |
| M-B | **`reviewV2ComposeNewTest`'s frontier bind is PREFLIGHT-ONLY.** `readProgressTruth` (non-transactional) at `callables.js:265-268`; the `new-day` claim txn never reads progress truth. The code comment admits it ("the frontier bind is HERE plus the completion's; a stale-day claim dies at completion"). Every other mint binds in-txn per C2/C3. Fail-closed at completion, so bounded — but it is the one remaining preflight-only authority check and should be named in the packet rather than discovered. | `callables.js:260-279`; `presentations.js:432-483` |
| M-C | **Enrollment/assignment are still preflight-only in every txn.** The in-txn resolve is `resolveReviewConfig(db, {classId, listId, txn})` — no `uid`, so `authFacts` is `{}` and `config.enrolled`/`assignmentExists` are undefined; `assertServableInTxn` checks only hold / `stampingEligible` / version. Codex C3 names "enrollment/assignment" in the in-txn list explicitly. An un-enrol between preflight and commit mints one queue/presentation/attempt. | `config.js:134-141, 218-228` |
| M-D | **Assignment-level authority overrides are still coerced, not held.** C3's strict-schema bullet covers "typed assignment overrides"; `num()` silently falls a malformed `asg.reviewPassThreshold` / `reviewQueueSize` / `reviewTestSize` back to the global default, and a malformed `reviewTestType` to `"mcq"`. The *config-doc* half of C3 is strict; the *assignment* half is not. A garbage `reviewPassThreshold` becomes 92 instead of HOLD. | `config.js:143-150` |
| M-E | **The flip's `sourceShas` are counted, never checked.** `flip-review-v2.mjs:105-109` asserts only `typeof lap.sourceShas === "object" && Object.keys(...).length >= 5`. No value is compared to anything on disk. The lap's own `goodShape` fixture (`engine-emulator-lap.mjs:691-693`) uses `{a:"1",b:"2",c:"3",d:"4",e:"5"}` and is rejected only for staleness/project/stages/failures — i.e. a hand-written receipt with fake hashes, a real `projectId`, `stages:["B4"]` and a fresh `contentTimestamp` **activates**. Codex C6 says in terms: "hash-mismatched receipts refuse". Related: the stage rule enforces only `stages[0] === stages[at-1] === "B4"`, so a single-element `["B4"]` satisfies the "ordered B4→B1→B3→B4" requirement. | `flip-review-v2.mjs:93-118` |
| M-F | **`checks` in the Track-B receipt is the student count, not a check count.** `b-delta-cycle.mjs:60-61` parses `"students": N` from B4's stdout into the field the flip validates as `checks >= 1`. Honest naming or an honest validator — not both. | `b-delta-cycle.mjs:57-79`; `flip-review-v2.mjs:100` |
| M-G | **The package lint mask survives.** `functions/package.json:5` is still `"lint": "eslint . || exit 0"`. The new `functions/eslint.config.js` is genuine and the targeted run is clean (I verified: exit 0), but the deploy precheck still cannot go red — the exact thing Codex flagged in r70 §6. | `functions/package.json:5` |
| M-H | **`already_completed` does not return "the SAME envelope shape as the winner"** despite the in-file claim. Winner: `{status, completionId, completion, evidenceKind, graduationCount, graduatedWordIds, correctCount, eligibleFillCount, streakCredited, advancedToDay, newTwi, sourceConfig, config}`. Loser: `{status, completionId, completion}`. Harmless, but the comment asserts a property the code does not have. | `completion.js:254-258` vs `:548-562` |
| M-I | **`sourceConfig.queueSize` on the completion record silently changed meaning.** It reads `consumedQueue?.snapshot?.queueSize`, which after the C2 supersession is *content* truth (`|orderedQueueWordIds|`), not the configured size. `snapshot.configQueueSize` now carries the configured value and is not used. Published audit-record semantics drifted with the supersession; either is defensible, but the completion record should say which. | `completion.js:481-488`; `composer.js:363-370` |

---

## 4. LOW

- **L-A** `gradingPreimageWrites` still has **zero callers** (`grep` across `functions/ src/ scripts/`
  returns only its definition and export). Both accept writers got a hand-inlined equivalent
  (`foundation.js:2675-2683`, `db.js:2904-2910`) rather than a call. Behaviour is right and
  append-only in both; the packet's "`gradingPreimageWrites` WIRED into BOTH live writers" is not
  what the code does, and the helper is now dead.
- **L-B** No fixtures exist anywhere for the preimage (`grep gradedIsCorrect
  scripts/deepfix2/engine-emulator-lap.mjs` → 0). My CC-5 asked for two specific ones. Also,
  `foundation.js` and `src/services/db.js` are **not** in the receipt's `sourceShas`, so the two
  files that carry the live-cohort change are outside the hash binding.
- **L-C** The lap's `new-day range` assertion is vacuous with respect to pace. It seeds
  `{weeklyPace: 50, studyDaysPerWeek: 5}`, but `deriveDailyPace` reads `assignment.pace`
  (`foundation.js:373-375`) — absent ⇒ `DEFAULT_WEEKLY_PACE = 400` ⇒ `dailyPace = 80`. The check
  passes as `[10, 19]` only because list `LX` has 20 words and runs out. The comment says "pace =
  ceil(50/5) = 10". `engine-emulator-lap.mjs:614-616`.
- **L-D** `queue_invalid` validates only `Number.isInteger(snapshot.threshold)`; it never checks that
  `p.queueRef` is the queue for `queueDocId(p.classId, p.listId, p.logicalDay, p.resetEpoch)` — and
  then stamps the attempt with a `queueId` *derived* from that tuple rather than from `p.queueRef`.
  Unreachable today (queueRef is server-minted), but C5 asked for "queue identity/hash". Also
  untested. `callables.js:521-528`.
- **L-E** `{status: "list_end"}` (`callables.js:276`) is a new typed status minted by this fold,
  outside the r70 derivation list and outside 15_ §8.
- **L-F** `computeGraduation`'s rerun branch returns no `formulaCount` while the live branch does; the
  completion record publishes neither `formulaCount` nor `correctCount`/`eligibleFillCount` even
  though the header says "both terms published". `completion.js:134-177, 489-504`.
- **L-G** The `grading_jobs` cancellation query (`.where("uid","==").where("status","==")`,
  `foundation.js:2172-2174`) has no matching entry in `firestore.indexes.json`. Equality-only
  conjunctions are usually served by zigzag merge, so this is probably fine — but it is a new query
  on a live path that runs *after* the fence has stamped the epoch, so a failure leaves the lock held
  and the cleanup half-done. Worth one verification in the deploy order.
- **L-H** `postureSource:"attempt"` governs `gateEffectiveEnabled`/`threshold`/`configVersion` on the
  completion's `sourceConfig`, but `reviewGateEnabled` on the same object comes from the *current*
  source config (`completion.js:486`). One record, two provenances.

---

## 5. What the fold got right (so nothing here is disturbed by the fixes)

- **`progress.js` is the right module.** One truth source, read in-txn by composer, completion,
  mint-visit and the rerun-review claim; frontier `csd+1`; universe `positions < twi`; tuple
  `twi−1 / t{twi}` constant within a day. The review-first instability that armed r70's BL-2 and H-3
  is structurally gone, not patched.
- **C1's evidence binding is thorough beyond what I asked.** Day, epoch (with a *named, published*
  legacy leg rather than a silent one), type/retest, presentation identity, `serverClaim` foreign-claim
  refusal, and the queue tuple against the txn-derived truth tuple. The r48 impossible-record fence
  runs before any privilege and includes a score↔rows agreement check I had not asked for.
- **Attempt-time posture genuinely governs.** `postureSource ∈ {attempt, completion_legacy,
  completion_autopass}` is published on the record; the legacy fallback is narrow and flagged.
- **The advance is in the CAS txn and the loser runs none of it** — fixtured with an explicit
  no-double-advance assertion (`engine-emulator-lap.mjs:480-482`).
- **Read-before-write is clean in all six reworked transactions.** I traced `composeDayQueue`,
  `composePresentation`, `completeDay`, the submit callable, `mintRestudyVisit`, and both
  `resetProgress` transactions individually. The deferred `counterWrite`/`queueCountWrite` closures
  are the right pattern. Replay/CAS-loser paths still correctly precede the §9 **write** fence.
- **The strict config schema holds Codex's exact repros** (`firstEnabledAt:'bad'` and
  `minClientVersion:'bad'` ⇒ HOLD, both fixtured), and `assertServableInTxn` is in every minting txn
  including the submit txn *before* the attempt is created.
- **`reuse_anchor_mismatch` is typed, fail-closed and leaves the cursor byte-unchanged**; the
  overshot-cursor repair leg exists and is fixtured.
- **`mintRestudyVisit` is now a real §9 writer** — tombstones + epoch + serving authority + `day ≤ csd`.
- **The receipt is genuinely source-bound to this tree.** I recomputed all 13 sha256 prefixes: 13/13
  match. That is real, and it is the first time in this program a lap artifact has been verifiable
  after the fact.
- **The flip's window read is now inside the activation txn**, `--reenable` requires the flag,
  `--kill` correctly does not, and CASE H consumes a receipt from an actual B1→B3→driver chain.
- **The monitoring quarantine now fails CLOSED in both scopes**, evaluation is bounded to
  `window.startedAt`, and the G−1/G+1/unstamped/pre-window matrix is fixtured properly.
- **Lint is real**: `functions/eslint.config.js` is CommonJS-aware with no rule-masking, and the
  targeted run is genuinely 0 problems.

---

## 6. Condition-by-condition (my 14, then Codex C1-C8)

### My r70 closing conditions

| # | Condition | Verdict |
|---|---|---|
| CC-1 | Bind completion evidence (BL-1) | **MET.** Day/epoch/type/presentation/queue-tuple all bound in-txn; fixtures (a) wrong-day, (b) rerun-as-new, (c) cross-epoch, (d) honest same-day all present (`lap:441-472`). |
| CC-2 | Re-source the review universe (BL-2) | **MET.** `positions < twi` from progress truth; review-first stability, day-1 `empty_pool`, list-end-only whole-list all fixtured (`lap:186-227`). Carries M-A (contiguity unasserted). |
| CC-3 | Bind `logicalDay` to the frontier + define cursor repair | **MET.** In-txn in composer/completion/mint-visit; `cursor unchanged by refusals` and `overshot cursor repaired` fixtured. Carries M-B (new-test bind is preflight-only). |
| CC-4 | Stabilize the tuple, demote the throw | **MET.** `t{twi}`/`twi−1`; typed `reuse_anchor_mismatch`, cursor untouched, fixtured. |
| CC-5 | Wire the grading preimage | **NOT MET.** Behaviour is correct in both live writers, but the condition's two named fixtures do not exist (0 hits for `gradedIsCorrect` in the lap), and neither writer's file is inside the receipt's hash binding. The exported helper remains uncalled (L-A). |
| CC-6 | Adjudicate + implement the rerun pool | **MET.** Full introduced range, both lanes' ruling recorded in 15_ §3, sliced in-txn, fixtured against the exact expected `poolHash`. |
| CC-7 | Fence `mintRestudyVisit` | **MET.** |
| CC-8 | Emit the contract-named signals + quarantine fails closed | **NOT MET.** `rerun_graduation` and `cursor_repaired` are emitted; **`priority_saturation_day` is unreachable** (H-C). Quarantine-fails-closed half is met and fixtured. |
| CC-9 | Assert completion-record self-consistency | **MET.** `graduationCount ≡ |graduatedWordIds|` by construction; fixtured. |
| CC-10 | Close the evidence gaps | **NOT MET (mostly closed).** Landed: callable boundary, wrapped cursor, no-active-cursor, LRT order, forced fallback with recorded seed, same-KST streak, `compose_keys` via `fingerprint.listId` with real claims and per-collection counts, G+1, OFF-source consumed attempt. Missing: COMPLETE-ROWS **violation** refusals (only the drift case; no missing-row / duplicate-row / blank-with-isCorrect-true), the CC-5 preimage fixtures, the ON→OFF posture direction (only OFF→ON exists — the packet's "fixtured BOTH directions" is not supported), a cross-class **complete**, and `priority_saturation_day`. |
| CC-11 | Give `challengeAcceptPlan` the R2-48 input | **MET.** `stampingEligible` is a parameter and hard-gates both label legs. |
| CC-12 | Decide the unflagged derivations (L-2, L-3) | **MET.** `minClientVersion: null ⇒ disarmed` recorded in 15_ §7; every protocol status now returns as `{status}` data, fixtured for `review_v2_dark`, `client_version_stale` and `typed_modality_deferred`; the version-fence fixture sets the field. |
| CC-13 | Handle malformed canonical word data | **MET.** `list_words_malformed` typed + duplicate-position leg + AWAITED ops signal, fixtured end-to-end through the callable. |
| CC-14 | Record the compose read-set sizing in the deploy order | **NOT MET.** No sizing/contention note exists in 15_ or anywhere under `docs/plans/deepfix2/`. `MAX_INTRODUCED_WORDS = 5000` is still an un-noted 1,300-doc transactional read set on real lists. |

### Codex C1-C8

| # | Condition | Verdict |
|---|---|---|
| C1 | One authoritative completion transaction | **MET.** Every bullet: in-txn frontier, full evidence binding incl. presentation + source queue + tuple, attempt-time `gatePosture` with a narrowly-named published boundary rule, advance + CAS + graduation/rest + streak in one txn with the loser writing nothing, impossible-shape rejection, and `graduationCount === graduatedWordIds.length`. (H-A/H-B are consequences of *how* the advance interacts with the rest of the system, not failures of C1's text.) |
| C2 | Authoritative day, universe, rerun, match tuple | **MET.** Frontier-only live compose, progress-truth introduced bound, day-1 no review, whole-list only at `twi === |list|`, restudy `day ≤ csd`, full-current-introduced rerun pool with resting included, stable tuple, typed non-mutating reuse refusal, bounded cursor repair, `snapshot.queueSize = |orderedQueueWordIds|` + separate `configQueueSize`. Carries M-B. |
| C3 | Strict, transaction-bound config/serving authority | **NOT MET.** The two headline items landed (strict config-doc schema; `assertServableInTxn` in compose / claim / submit / complete / mint-visit, and the submit txn refuses before creating the attempt). Unmet: **enrollment/assignment are not enforced in the minting txn** (M-C) — named explicitly in C3 — and malformed **assignment-level** overrides still coerce to defaults rather than HOLD (M-D). The race battery is partial: rehearsal-removal and reset-between-preflight-and-commit are fixtured; assignment removal and an in-txn version change are not. |
| C4 | Wire the frozen writers and reset, not only helpers | **NOT MET.** Live-new route ✓, visit binding at claim and submit ✓, preimage behaviour in both live writers ✓, `resetProgress` rebuilt to the fence-first owned-lock law with nine-family cleanup, job cancellation, bookmarks, owner-clear and 10-min takeover ✓ (live-lock rejection and stale takeover both fixtured through the callable). **But the reset rewrite introduces BL-A** — a live-cohort regression on the very callable this condition asked to be rewritten. Also L-A/L-B. |
| C5 | Immutable-record and retry consistency | **MET.** Normalized replay envelope with zero writes (fixtured), `queue_invalid` fail-closed, modality leg preserved for every mode with the live-review decision recorded in-file, malformed positions typed + ops-signalled. Partial only on "queue identity/hash" (L-D). |
| C6 | Source-bound, atomic activation proof | **NOT MET.** Schema defined and largely validated; bare `{pass:true}`, bare `{failed:0}`, stale-by-content, wrong-project, non-B4-bounded and `failures>0` all refuse and are fixtured; the window doc joins the activation txn; CASE H consumes a real chain receipt. **But "source-bound" is not enforced** — `sourceShas` is only counted, never compared (M-E), so a hand-written receipt with fake hashes activates; and the "ordered B4→B1→B3→B4" requirement is reduced to "first and last are B4". |
| C7 | Complete, fail-closed monitoring | **NOT MET.** `priority_saturation_day` is unreachable (H-C). Everything else landed: `rerun_graduation` from the successful txn, `composition_fallback` retained, `cursor_repaired` added, malformed window fails closed in both scopes, evaluation bounded to `window.startedAt`, and the G−1/G+1/unstamped/missing matrix with a pre-window exclusion. The published `quarantined_row_count` write is never exercised (the lap only runs `dryRun`). |
| C8 | Evidence that reaches the authority boundary | **NOT MET (large advance).** The callable boundary is genuinely covered by `firebase-functions-test` across all seven callables, `node --check` is green, the CommonJS-aware lint is real and clean, and the committed receipt's hashes verifiably bind this tree. Unmet: ON→OFF source posture, wrong-queue binding, complete-row drift/duplicate/blank negatives beyond the single drift case, the preimage fixtures, cross-class complete, `priority_saturation_day`, and the package lint mask (M-G). The packet also still contains claims the evidence does not support — "fixtured BOTH directions", "`gradingPreimageWrites` WIRED", "`priority_saturation_day` … emitted" — which is precisely the failure mode C8's last bullet was written against. |

---

## 7. CLOSING CONDITIONS FOR r72 (complete — nothing held back)

1. **Fix BL-A.** Decide and implement how the §9 fence tombstones pre-P5 without creating a
   `list_progress/{listId}` doc that `resolveListProgress` (`foundation.js:1763`) and
   `fetchStudentsProgressForClass` (`progressService.js:791`) treat as canonical. Log the
   supersession in the docs (not only in a code comment) and add the runbook note. Fixture: reset a
   student, advance the legacy doc, then assert `resolveListProgress` still returns the reconciled
   legacy csd/twi — not `mode:"canonical", csd:0`.
2. **Rule on the advance interlock (H-A).** Name the single owner of `currentStudyDay`/
   `totalWordsIntroduced` for the rehearsal window, and state what happens to `recentSessions`,
   `stats`, `streakDays`, `interventionLevel` and `reviewMode` on an engine-completed day — either by
   giving the engine advance shape parity or by carding the loss in the deploy order. Fixture: one
   student, `completeDay` then `completeSession` for the same day, and the reverse.
3. **Rule on the dual-class steady state (H-B).** Either make the advance reach every enrolled
   class's progress doc for the shared day, or publish that dual-enrolled students are served by
   exactly one class until P5 and make the second class's refusal diagnosable (a typed status the UI
   can act on, not a bare `day_guard_rejected`). Fixture: two classes, one shared day, complete via A,
   then compose **and** complete via B.
4. **Make `priority_saturation_day` reachable (H-C).** Return `priorityCount` from
   `composePresentation` and fixture the saturation emission (and, while there, the `rerun_graduation`
   and `cursor_repaired` emissions, none of which the lap asserts today).
5. **Enforce the receipt's source binding (M-E).** Recompute the bound files' hashes in
   `flip-review-v2.mjs` and refuse on mismatch; enforce the full `B4→B1→B3→B4` ordering or amend C6's
   text to the B4-bounded rule with the reason recorded. Fixture: a hash-mismatched receipt refuses.
6. **Assert canonical position contiguity (M-A)** in `loadCanonicalWordsStrict` — `wordIndex === i` —
   with the same typed refusal + ops signal as the duplicate leg, or slice by ordinal instead of by
   position. Fixture: a list with a gap.
7. **Close the C3 remainder (M-C, M-D):** enrollment/assignment enforced inside every minting txn
   (pass `uid` to the in-txn resolve), and malformed assignment-level overrides resolve HOLD.
   Fixtures: un-enrol between preflight and commit ⇒ nothing minted; `reviewPassThreshold:'bad'` ⇒ HOLD.
8. **Bind the new-test frontier in-txn (M-B)** — or state, in 15_, that the live-new day is
   preflight-bound and fail-closed at completion by design.
9. **Close the named evidence gaps (CC-10 / C8):** ON→OFF source posture; COMPLETE-ROWS violation
   refusals (missing row, duplicate row, blank-with-`isCorrect:true`); the two preimage fixtures from
   CC-5; a `queue_invalid` fixture; the non-dry `quarantined_row_count` publish. Add `foundation.js`
   and `src/services/db.js` to the receipt's `sourceShas`.
10. **Record the compose read-set sizing (CC-14)** in the deploy order, and verify the
    `grading_jobs (uid,status)` query serves without a composite index (L-G).
11. **Drop the `|| exit 0` mask (M-G)** from `functions/package.json`'s lint script now that the
    targeted config is clean.
12. **Correct the packet.** "fixtured BOTH directions", "`gradingPreimageWrites` WIRED into BOTH live
    writers", "`priority_saturation_day` … emitted", "completeSession's exact law", and
    "`already_completed` returns the SAME envelope shape" are each contradicted by the code. The
    checkpoint's credibility now rests on the packet being auditable, and this fold's receipt proved
    that is achievable — the prose has to match it.

Items 1 is the blocker. Items 2-5 are required before the dark-deploy order series opens. Items 6-12
must close for the checkpoint but do not, on their own, hold the deploy once 1-5 land.

---

## 8. Statement for the fold

The r70 NO said the failure mode was "the wiring layer mints the derivations the engine trusts, and
the wiring layer has no evidence behind it." That is fixed. `progress.js` is the right abstraction,
the completion rebuild is the strongest transaction in this program, and for the first time the lap
covers the layer where the defects were and hands back an artifact I could verify against the tree
without running it.

What is left is a different shape entirely: **one live-path change made in service of a dark build**
(the reset fence writing a document the pre-P5 world reads as authority), a **dual-writer question
the fold answered inside the engine but not across the system** (completeSession, dual-enrolment),
and **three claims in the packet that the code does not support** (saturation emission, preimage
wiring, both-direction posture fixtures). None of those is a re-architecture. The engine is ready;
the seam between the engine and the live system is not, and the seam is where the deploy order runs.
