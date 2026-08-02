# DEEPFIX2 · r70 STAGE-2 CHECKPOINT — Opus lane review (build-vs-frozen-contract fidelity)

> Reviewer: Opus lane (roster: Opus + Codex, simultaneous; WSL folds after both return).
> Scope: `functions/reviewV2/*` · the one `functions/index.js` wiring block ·
> `scripts/deepfix2/flip-review-v2.mjs` · `scripts/deepfix2/engine-emulator-lap.mjs`.
> Law: 15_ (primary) · 10_ §2 · 11_ rows R2-29/32/38/39/41/42/43/46/47/48/49/50 · 14_ §4 · 16_ ·
> the r70 handoff packet. Product decisions are FROZEN and were not re-litigated.
> Method: full read of all nine engine modules + the wiring block + both scripts, cross-read against
> the frozen sources, plus `node --check` on all 11 files (all parse). The emulator was NOT run.

## VERDICT: **NO** — the engine may not proceed to the WinClaude dark-deploy order series yet.

Two BLOCKERs. Both are in the callable layer — which is precisely the layer the 68/68 lap
**does not cover** (`engine-emulator-lap.mjs:8-11` states this explicitly). The engine
transactions themselves are, module for module, the best-fidelity build this program has produced:
read-before-write is clean in all four transactional modules, the §9 fence is genuinely in every
engine txn, the R2-48 eligibility gate does hard-gate the label writer and both rru paths, the
cursor transitions are exactly r59-B3, the reuse law is exactly r60/r62, the evidenceKind matrix is
exactly r55/r56, the counter allocator is exactly r57/r59-B4, and the flip txn is exactly R2-48.
The defects are concentrated where the packet's own evidence stops.

The NO is a **completeness** NO, not a rejection of the build: the closing-condition list below is
proactive and complete against everything I found, so the fold can be one pass.

---

## 1. BLOCKERS

### BL-1 — Day-completion evidence has NO day / epoch / type binding (forgeable completions, graduations, rest, streak)

`functions/reviewV2/completion.js:252-276` verifies the consumed review attempt against
`{studentId, listId, sessionType==='review', type!=='retest', passed===true, classId}` and the
new-test attempt against `{studentId, listId, passed===true}` — and **nothing else**.

Missing, all of them required by frozen law:
- **`studyDay === logicalDay`.** r48/R2-37 Q3 (11_ row R2-37) freezes the rule: *"a valid cross-class
  pass satisfies the shared logical day on uid/list/day/epoch match"*; 10_ §2.6 repeats it with the
  anchor/generation tuple. Neither the day nor the tuple is compared against the attempt.
- **`resetEpoch` match.** R2-34 Q5 / 15_ §9: *"resetEpoch stamped on … completion requests, mismatch
  ⇒ reject/cancel."* The completion's OWN epoch is server-derived (good), the evidence attempt's is
  never read.
- **`newTestAttemptId` type binding.** No `sessionType === 'new'` check and no `type !== 'retest'`
  check. A passing **rerun** new-word attempt therefore satisfies `standard`,
  `first_day_new_only` and `gate_off_autopass` — directly contradicting R2-41(d)/R2-40
  ("reruns stay NON-ADVANCING").

Consequence, reachable from an authenticated student through `reviewV2CompleteDay`
(`callables.js:512-542`, which validates only `Number.isInteger(d.logicalDay) && ≥1`): ONE passing
review attempt plus ONE passing new attempt — of any day, any epoch, any rerun-ness — can be
replayed to mint `day_completions/{listId}_d{N}_e{epoch}` for **every** N. Each mint is a fresh CAS
docId, so `already_completed` never fires. Each mint runs `computeGraduation` (the queue for day N
usually does not exist, so the boundary leg sets `qe = |presented|`, `completion.js:301`), mints
`reviewRestingUntil = now+21d` on the graduated set (`completion.js:361-367`), and writes a
`streak_credits` doc. The whole list can be graduated and rested, and the streak fabricated, from a
single legitimate attempt.

This is exploitable through the callable, i.e. it survives every rules-level control (16_ battery M
is about direct client writes; this is server-mediated). It is also a plain correctness bug on the
honest path: a student who legitimately passes day 5's review and then reloads on day 6 can have the
client re-send the day-5 attempt id.

**Evidence gap that hid it:** the lap's CASE E (`engine-emulator-lap.mjs:258-273`) seeds `attE1`
with `studyDay: 5` and completes `logicalDay: 5`, so a check that never happens still passes.

### BL-2 — Anchor-less days review the WHOLE LIST (the normal pre-new-test path), and the queue is immutable

`callables.js:150-169` derives the day's review universe from
`foundation.deriveDayAnchorRange(uid, listId, logicalDay)`. That helper
(`functions/foundation.js:996-1007`) returns **null** unless `getDayNewPass` finds a *passed* `new`
attempt for that day (`foundation.js:819-836` — `.filter(a => a.passed === true && …)`).

The build's fallback (`callables.js:161-163`) is:

```js
const introducedWords = startIdx === null ? canonicalWords : canonicalWords.filter(w => w.wordIndex < startIdx);
```

i.e. **the whole list**. But an anchor-less day is not only the list-end/review-only day the
derivation was written for — it is **every day before the student passes that day's new-word test**.
10_ §1 / R2-26 Q11 / R2-12 explicitly permit review-first ("students move freely between review and
new-word work within the day"; "allow REVIEW-phase entry while new-test grading is pending"). So on
the ordinary review-first path:

- the day-queue is composed over **un-introduced words** (violating 10_ §2.1's "over the ACTIVE
  pool" of the introduced range, and R2-41(f)'s introduced-range bound);
- the student is tested on words never studied, and R2-17 blank=fail stamps `reviewFailCount` on
  future words — permanently, since fails are history (§6b);
- the queue doc is **immutable per logical day** (15_ §2), so the wrong universe is frozen for the
  whole day and pinned through every retake;
- the cursor advances across the whole list, corrupting the r58 sweep;
- on **day 1 with gate ON**, a review session is composed at all — `callables.js:193-196` only
  returns `empty_pool` when the anchor exists and `startIdx === 0`. The `first_day_new_only`
  evidence kind assumes day 1 has no review (15_ §3b).

Derivation #6's *arithmetic* is right (`position` is 0-based and `newWordStartIndex = (day-1)*pace`
is 0-based — `foundation.js:2805`, `studyService.js:677`). The defect is the **input**: the day's
introduced bound must come from server progression truth (twi / pace), not from a *passed* attempt.

---

## 2. HIGH

### H-1 — `logicalDay` is unbound to the student's frontier; a forward compose poisons the cursor permanently
`callables.js:180-182` / `254-261` / `517-519` / `553-555` validate only `≥ 1`. `composeDayQueue`
guards only *backward* composes (`composer.js:270-274`). A compose for `logicalDay = 999` therefore
succeeds, writes `cursor.lastLogicalDay = 999` (`composer.js:349-355`), and **every** subsequent
compose for the student's real day returns `day_guard_rejected` forever — for that (uid, list,
epoch), across all classes (the cursor is list-scoped, r58). The only recovery is a reset. Combined
with BL-1 this is also the day-skipping vector.

### H-2 — `gradingPreimageWrites` is shipped but wired NOWHERE; R2-49's "the class never grows" is already being violated
`stamping.js:189-204` implements §6b (1) correctly (append-only, first adjudication wins). But
`grep -rn gradedIsCorrect functions src` returns **only** the helper, the replay lib and a fixture.
The LIVE accept writer still destroys the preimage in place:
`functions/foundation.js:2600` — `if (accepted) updatedAnswers[answerIndex].isCorrect = true;`
(and the client path at `src/services/db.js:2912`). 15_ §6b: *"the dark-build accept writer copies
the pre-accept value into `gradedIsCorrect` BEFORE flipping `isCorrect`"*; R2-49 (11_): *"Going
forward the dark-build accept writer preserves `gradedIsCorrect` … so the class never grows."*
Every acceptance between now and the wiring permanently grows `legacyAcceptedReconstructed` and
drifts the published census that the 947-student baseline already fixed. This one is
**time-sensitive** — it degrades on the live cohort every day the wiring waits.

### H-3 — The same-day reuse anchor-tuple mismatch THROWs, and is reachable on the honest path
`composer.js:294-300` throws (⇒ callable `internal`) when the reused queue's `anchorNwei`/`generation`
differ. 15_ §2b keys the reuse law on `lastLogicalDay === the composing logicalDay` **only** — the
equality assertion is a build addition, and its "impossible by construction" premise is false:
because of BL-2 the tuple is `(-1, "none")` before the day's new test passes and `(nwei, "s..e..")`
after. Class A composing at 10:00 and class B at 11:00 on the same shared day therefore hard-fail
class B's compose. R2-36 binding condition (i) is explicit: *"no crash, no false server rejection"*
for the dual-class case. Even after BL-2 is fixed, a genuine mismatch should be a typed refusal, not
an abort.

### H-4 — Rerun pool is day-scoped through the visited day, against R2-41(h) and trace row 71
`callables.js:164-167` + `280` set the rerun-review pool to `wordIndex <= anchorNwei` (the visited
day's `newWordEndIndex`). R2-41(h) (11_): *"regenerated PURE-RANDOM draw over the **FULL** introduced
range (incl. resting words)"*; 15_ §3: *"`poolHash` = the INTRODUCED-RANGE hash"*; 10_ §1 repeats
"full introduced range". Trace row 71 (`12_:109`) records David **rebutting** the day-scoping
rationale in terms ("all pool words are introduced words") and WSL's accepted resolution as "over
the introduced range" — the day-scoping concern from row 70 is the one David dismissed.
Two further internal inconsistencies: (a) the rerun pool uses `<= newWordEndIndex` while the live
review universe uses `< newWordStartIndex`, so the rerun review **overlaps the rerun new-word half**
of the same visit — against R2-40(c)-ii's "mirroring a real day"; (b) R2-46 names the rerun path
"the always-open proof route" for saturation-deferred words, which the narrow pool closes unless the
student happens to restudy the exact introducing day.

---

## 3. MEDIUM

| # | Finding | Evidence |
|---|---|---|
| M-1 | **The 68/68 evidence does not assert several things the packet claims.** Count verified: 68 `check()` calls (A6 · B13 · C10 · D6 · E11 · F4 · G6 · H12). But: **no callable coverage at all** (script header, lines 8-11) — every derivation minted in `callables.js` is untested; the **wrapped-window** cursor case (r59-B3's "last traversed, NOT the numeric max") is never produced (queueSize 4 over 8 words tiles exactly, so no window ever wraps mid-segment); "no active at all ⇒ cursor unchanged" untested; the **R2-42/46 LRT selection order** (absent-first, tie-wordIndex, priority prefix) is never asserted — CASE C checks only cardinality and subset; the seeded fallback is never exercised; COMPLETE-ROWS *violation* refusals are never exercised; same-KST-date streak idempotency is never exercised (CASE E's second completion uses `nowMs: NOW+DAY`); `compose_keys` deletion via `fingerprint.listId` is never exercised (CASE F runs on `uE`, which has no compose_keys, and asserts only `r.deleted >= before`); the r64 injection matrix plants G−1 and unstamped but **not G+1**; derivation #3's OFF-source **consumed** attempt is never produced (CASE E's `gate_off_autopass` has `consumedAttemptId: null`, so graduation is zero by construction, not by the derivation). | `engine-emulator-lap.mjs:8-11, 143-161, 183-184, 288-290, 318-326, 337-344` |
| M-2 | **Contract-named monitoring signals are never emitted.** `priority_saturation_day` (R2-46: "a MONITORED signal (server-only sink)") and `rerun_graduation` (R2-41(g): "rerun-graduation volume = a monitoring signal") exist in `SIGNAL_TYPES` but no writer calls `recordOpsMetric` with them; `composeLiveReviewTest` returns `priorityCount` and the callable discards it. Only `composition_fallback` is wired — and it is unreachable (see L-7). | `monitoring.js:65-77`; `presentations.js:197`; `callables.js:216-224` |
| M-3 | **Quarantine fails OPEN on a malformed window.** `getAuditWindow` maps a non-integer `generation` to `null`, and `classifyRows` then skips quarantine entirely. r64 makes the window's `generation` *the* registered generation; a malformed window should fail closed (quarantine everything), not silently disable the protection that keeps stale-cache shadow rows out of production classification. | `monitoring.js:126, 175` |
| M-4 | **`mintRestudyVisit` writes outside any transaction and outside the §9 fence.** 15_ §9(2): *"while locked, EVERY server op for that (uid,list) … rejects `reset_in_progress` (each writer's FINAL txn re-reads the epoch + lock)."* The visit doc is a plain `ref.set()`; the only lock check is the non-transactional courtesy read in `deriveEpoch`. | `visits.js:45-53`; `callables.js:560-563` |
| M-5 | **`graduationCount` can exceed `|graduatedWordIds|`.** `graduationCount` counts `correctIds`, but the emitted set is `correctInQueueOrder` (filtered to queue members) + fill. A correct row outside the queue makes the record internally inconsistent, and `graduatedWordIdsHash` then hashes a set that does not match the count. No assert. | `completion.js:160-165` |
| M-6 | **The R2-48 eligibility gate does not reach the adjudication label path.** `challengeAcceptPlan` takes `r2_10Active`/`gateEffectiveEnabled` but no `stampingEligible`. R2-10 is dormant so nothing is live-wrong today, but the duty ("the eligibility gate reaches EVERY label write path") is discharged by convention, not by construction, exactly where R2-10 will one day activate. | `stamping.js:220-229` |
| M-7 | **Canonical word loading is lossy.** `orderBy("position")` silently **excludes** any `lists/{id}/words` doc lacking `position`, and the map coerces a missing/non-integer `position` to `0` — which then trips `assertParams`' strict-ascending check and throws a `TypeError` (⇒ `internal`) instead of a typed refusal. | `callables.js:140-147`; `composer.js:185-197` |
| M-8 | **Compose txn read-set size.** `composeDayQueue` transactionally `getAll`s up to `MAX_INTRODUCED_WORDS = 5000` study_states in 300-doc chunks inside one transaction. Correct (and the `exists` short-circuit keeps replays cheap — `composer.js:258-266`), but on a 1,300-word list every first-compose of a day is a 1,300-doc transactional read set that any concurrent label stamp aborts. Worth a sizing/contention note in the deploy order, not a redesign. | `composer.js:79, 316-327` |

---

## 4. LOW

- **L-1** Live-review composeKey replay skips the `testType` leg of the fingerprint comparison
  (`presentations.js:320`, `mode === "live-review" || f.testType === params.testType`). Safe today
  (modality comes from the immutable queue snapshot, and `(sessionType, kind)` fully determines the
  mode), but 15_ §3 freezes modality as a *separately compared* fingerprint field.
- **L-2** `minClientVersion: null ⇒ fence disarmed` (`config.js:173`) is an **unflagged derivation** —
  it is not in the packet's NAMED list, and the dark-deploy config ships `null`, so contract (5) is
  off at deploy. Defensible; must be *decided*, not inherited.
- **L-3** Frozen statuses surface inconsistently: `client_version_stale` and
  `typed_modality_deferred` are thrown as `HttpsError`s while every other frozen status returns as
  `{status}` data — the module's own stated rule is "statuses are protocol, not errors"
  (`callables.js:129-132, 101-105, 354-358`).
- **L-4** Flip-script hygiene: the micro-lap freshness gate uses the receipt **file mtime**
  (`flip-review-v2.mjs:90`), so a `touch` defeats it — prefer a timestamp inside the receipt; and
  `--kill`/`--reenable` do not require `--yes-i-am-david` (defensible for kill, less so for
  re-enable).
- **L-5** Rerun **new-word** attempts are stamped `testId: vocaboost_test_{class}_{list}_review`
  (`callables.js:448`) regardless of half.
- **L-6** `queueId` is left `null` on the attempt when `p.queueRef` exists but the queue snapshot
  lacks an integer `threshold` (`callables.js:427-434`), so §4's `queueId|null` can be null on a
  review-type attempt that *has* a queue.
- **L-7** The R2-42 "post-compose INVARIANT CHECK" is structurally unfalsifiable:
  `effectiveTestSize = min(testSize, |members|)` and queue ids are unique by construction, so
  `compositionInvariantHolds` can never fail and the seeded fallback is dead code
  (`presentations.js:152-190`). Not wrong — but the packet's "INDEPENDENT invariant check" claim
  should be stated honestly, and the fallback should get a fixture that forces the branch.
- **L-8** Rerun attempts are written into the top-level `attempts` collection with
  `sessionType:'review'`/`'new'` + `type:'retest'` and `studyDay = visitedDay`. `getDayNewPass` is
  safely blind to them (no `newWordEndIndex`), but `dayReviewExists` (`foundation.js:840-855`) is
  not. DF2-10 rewrites those readers in-train; flagged so the ordering is deliberate.

---

## 5. What the build gets RIGHT (so the fold does not disturb it)

- **Read-before-write is clean in all four transactional modules** (composer, presentations,
  completion, the submit callable). I traced each: every conditional read precedes every write.
- **§9 fence** genuinely in every engine txn (both tombstones, lock predicate, epoch reduction);
  replay/CAS-loser paths correctly precede the *write* fence (§8), and the *write* paths correctly
  follow it.
- **R2-48 eligibility** hard-gates `stampLabelsInTxn` (`stamping.js:150-152`), the live rru mint
  (`completion.js:361`) and `graduateRerunInTxn` (`completion.js:404`) — the three rru/label write
  paths. Serving ≡ stamping in `resolveAndGate` (`callables.js:106-110`).
- **Cursor transitions** are exactly r59-B3, including last-traversed-not-numeric-max
  (`composer.js:145`), top-ups excluded from advancement, unchanged-on-empty-A, and no advance on
  the reuse path.
- **Reuse law** exactly r60/r62: verbatim content, `snapshot.queueSize = |reused|`,
  `configQueueSize` audit-only, receiver keeps its own threshold/testSize/modality
  (`composer.js:301-311`).
- **Counter allocator** exactly r57/r59-B4 (create-`{next:2}`-allocate-1, txn read-modify-write, no
  count queries anywhere) and `_p{seq}` from `presentationCount` (`presentations.js:394-417`).
- **evidenceKind matrix** exactly r55/r56 with the r57 bindings, and `gate_off_*` provably implies
  `gateEffectiveEnabled === false` because the same `config` produces both
  (`completion.js:109-116, 337-344`).
- **Predicate byte-match verified against the published baseline**: `needsPriority`
  (`presentations.js:96`) and `fillEligible` (`completion.js:102`) are character-identical to
  `b1-expected-labels.mjs:169-170`.
- **Graduation vectors**: `min(floor(60 × 0.93), 28+30) = 55` is asserted live in CASE E; the
  `clamp/100` unit law and malformed-score invalidity are exactly r49-B1.
- **rru twin law**: `completedAt = Timestamp.fromMillis(nowMs)` and `rru = nowMs + 21d` are exact
  twins, asserted at `engine-emulator-lap.mjs:277-280`.
- **The flip txn** is exactly R2-48: both fields in ONE `txn.update`, re-asserted inside the txn,
  write-iff-absent, marker never cleared by `--kill`/`--reenable`, rehearsal-list-empty and
  no-window asserts on both sides, DRY by default, `--yes-i-am-david` + fresh lap receipt required.
  CASE H is the strongest case in the lap.
- **ops_metrics, never system_logs** (§6c) — correctly honored, including the `.catch(()=>{})` so
  monitoring can never fail a compose.

---

## 6. Rulings on the 10 NAMED-HERE derivations

| # | Derivation | Ruling | Reason |
|---|---|---|---|
| 1 | Typed statuses minted (`reset_epoch_mismatch`, `config_hold`, `empty_pool`, `invalid_compose_key`, `attempt_exists`/`attempt_written`, `typed_modality_deferred`) | **ACCEPT** | §8's frozen list is a list of *responses to named situations*, not a closed vocabulary for engine-internal refusals; none of the six collides with or weakens a frozen name, and each is a refusal that mints nothing. One caveat carried to L-3: `typed_modality_deferred` and `client_version_stale` are surfaced as `HttpsError`s while the rest are data — make the surface uniform. |
| 2 | Graduation fill pick = QUEUE ORDER (tested-correct first, then fill, both queue-ordered) | **ACCEPT** | 10_ §2.5 bounds the fill **set** ("fill from fill-eligible UNPRESENTED queue words") and the **count** (the min formula); it never names an order. Queue order is the only order already server-authoritative and immutable for the day, so it is deterministic, replayable and audit-stable. Correct choice. |
| 3 | **PRIVILEGE-REQUIRES-ON**: OFF-source consumed attempt ⇒ day advances, graduation ZERO | **ACCEPT** | Sound and conservative. R2-32 freezes proof under OFF and says graduation "reverts to legacy"; R2-38 grants an OFF-source attempt evidence status but explicitly withholds proof-minting; A1's override pattern is "ONE advance + ZERO graduation". Graduation mints `reviewRestingUntil` — protected state — so minting it from an ungated score is precisely the laundering R2-16/R2-32 exist to prevent. The alternative (grade by the *target* class's posture) would let an OFF auto-pass's score drive an ON class's rest schedule. **Condition:** the consequence must be published — a student dual-enrolled with an OFF class can complete days that graduate nothing, permanently (the completion is exactly-once), so the ON class's pool never drains. And it must be **fixtured**: the lap's `gate_off_autopass` case has `consumedAttemptId: null`, so the derivation is currently asserted by nothing (M-1). |
| 4 | `restudy_completions` path = `users/{uid}/restudy_completions/...` | **ACCEPT** | §6's docId `{classId}_{listId}_d{day}` carries no uid; a top-level collection would collide across students. The per-student subcollection is the only collision-free reading, it keeps the §9 reset reach uniform with the other eight families, and `visits.js:97-104` and `reset.js:54` agree. |
| 5 | Shadow-registry ids field name = `ids` | **ACCEPT** | 16_ §2.11 fixes the shape (`shadow_registry/{n}`, ≤500 ids/doc, `generation` on doc 0) but not the field name. `ids` is the obvious minting. **Condition:** pin it into 16_ §2.11 in this fold so the stage-3.5 driver cannot diverge — a mismatch is a silent empty registry, i.e. every shadow row classified as production. |
| 6 | Review universe = positions < the day-anchor's `newWordStartIndex`, anchor-less ⇒ WHOLE list; rerun pool = through the visited day's `newWordEndIndex` | **REJECT** (both halves) | (a) The universe *formula* is right, but its **input** is wrong: `deriveDayAnchorRange` requires a *passed* new attempt (`foundation.js:997` → `getDayNewPass` `passed===true`), so "anchor-less" is the ordinary review-first state, not just list-end. Whole-list is then a live defect (BL-2), frozen for the day by queue immutability. The bound must come from server progression truth (twi/pace), with "whole list" reserved for the genuine zero-new-words/list-end day. (b) The rerun pool contradicts R2-41(h)/10_ §1's "**FULL** introduced range" and 15_ §3's "INTRODUCED-RANGE hash", and trace row 71 records David rebutting exactly the day-scoping rationale. It is also self-inconsistent with (a) — `<= end` vs `< start` — making the rerun review overlap its own visit's new-word half, against R2-40(c)-ii's "mirroring a real day", and it closes R2-46's "always-open proof route" for saturation-deferred words. |
| 7 | `generation = "s{start}e{end}"` of the (uid,list,day)-scoped anchor ("none" anchor-less); `anchorNwei = −1` sentinel | **AMEND** | The *minting formula* is fine, and basing it on the (uid,list,day)-scoped helper is the right instinct — it is class-agnostic, so two classes with different `dailyPace` still agree, which is what r48's match tuple needs. But the derived **value is not stable within a day**: it flips `(-1,"none") → (nwei,"s..e..")` the moment the new test passes. That instability is what arms H-3's throw, and it also means a queue doc and its own `day_completions` record can carry different tuples with no check. Keep the format; re-source it from the same server progression truth as CC-2 so it is constant for a (uid, list, day), and record the `-1`/`"none"` sentinels as the *list-end* encoding only. |
| 8 | Callable serving gate ≡ `stampingEligible` | **ACCEPT** | Correct and load-bearing: R2-41 makes every graded test a stamping event, so serving a test the engine cannot stamp would mint ungradeable history in the dark window that B3 owns exclusively (R2-48 / 14_ §4). The construction also gets the post-flip kill-switch right — the durable marker keeps `stampingEligible` true, so an OFF window keeps *serving* under the R2-32 per-field law instead of going dark (`config.js:96` vs `:100-107`). |
| 9 | The rotation clock keeps writing under gate-OFF (only `lp` freezes) | **ACCEPT** | R2-32/R2-35 Q4 enumerate the OFF law field by field — "fail AND correct stamps keep writing, proven freezes" — and name only proof as frozen. The clock is rotation bookkeeping, not privilege: freezing it under OFF would corrupt the R2-42 LRT ordering for the whole OFF window and then mis-order the sweep on re-enable, which R2-32's "re-enable resumes in place" forbids. `stamping.js:118` is right, and its comment states the rationale correctly. |
| 10 | Streak credits are posture-independent (every valid advance credits) | **ACCEPT** | R2-21 defines a streak day as "the student PROGRESSED that day"; nothing in R2-32/R2-38 conditions progression credit on gate posture, and 15_ §6 makes the KST docId the idempotence mechanism, which the build honors (`completion.js:331-333, 369-376` — read in-txn, `create` only when absent, credited only when the CAS wins). Note for the record: the credit carries `listId`, and §9 reset deletes by `listId`, so a same-date credit earned on a *different* list survives that list's reset — correct, and worth stating. |

---

## 7. CLOSING CONDITIONS (complete — this is the full list; nothing is held back for a second pass)

1. **Bind completion evidence (BL-1).** In `completeDay`, require of the consumed attempt:
   `studyDay === logicalDay`, and `resetEpoch === resetEpoch` **where the field is present** (absent
   ⇒ the named flip-week legacy leg, published). Require of the new-test attempt: everything the
   consumed attempt requires **plus** `sessionType === 'new'` and `type !== 'retest'`. Fixtures:
   (a) day-N attempt against day N+1 ⇒ `no_evidence`; (b) rerun (`type:'retest'`) new attempt ⇒
   `no_evidence`; (c) pre-reset-epoch attempt post-reset ⇒ `no_evidence`; (d) the honest
   same-day case still completes.
2. **Re-source the review universe (BL-2).** Derive the day's introduced bound from server
   progression truth (twi / pace-derived start), not from a *passed* new attempt. "Whole list" must
   be reachable only on a genuine zero-new-words / list-end day. Fixtures: compose review **before**
   the day's new test on day 5 ⇒ the universe is exactly positions `< (day-1)*pace`; day 1 before
   the new test ⇒ `empty_pool`; list-end day ⇒ whole list.
3. **Bind `logicalDay` to the frontier (H-1)** on compose, complete and mint-visit: reject
   `logicalDay > frontier` with a typed refusal, and define the repair path for a cursor whose
   `lastLogicalDay` has already overshot (a cursor-repair leg, since today only a reset clears it).
   Fixture: `compose(day = frontier + 1)` ⇒ typed refusal, cursor byte-unchanged.
4. **Stabilize the match tuple and demote the throw (H-3, derivation #7 AMEND).** Re-source
   `anchorNwei`/`generation` from the same truth as CC-2 so they are constant within a (uid, list,
   day); convert the reuse anchor-tuple mismatch from `throw` to a typed refusal. Fixture: class A
   composes pre-anchor, class B composes post-anchor on the same shared day ⇒ no `internal`.
5. **Wire the grading preimage (H-2).** `gradingPreimageWrites` must be called by BOTH live accept
   writers (`functions/foundation.js:2600` and the client path at `src/services/db.js:2912`, or
   close the client path) — or the deferral must be explicitly carded with the R2-49
   census-drift consequence published, since the class grows daily until it lands. Fixtures: accept
   ⇒ `gradedIsCorrect` present and equal to the pre-accept `isCorrect`; a second accept never
   overwrites it.
6. **Adjudicate and implement the rerun pool (H-4, derivation #6b).** Rule between R2-41(h)'s "FULL
   introduced range" (row 71's reading) and the day-scoped reading. Whichever is chosen, log the
   supersession and — if day-scoped survives — state why the rerun review overlaps its own visit's
   new-word half and how R2-46's "always-open proof route" stays open.
7. **Fence `mintRestudyVisit` (M-4):** move it into a transaction whose read set includes both
   tombstones, rejecting `reset_in_progress` / epoch drift like every other §9 writer.
8. **Emit the contract-named signals (M-2)** — `priority_saturation_day` (R2-46) and
   `rerun_graduation` (R2-41(g)) — and **fail the audit-window quarantine CLOSED** when
   `window.generation` is not an integer (M-3).
9. **Assert completion-record self-consistency (M-5):** `graduationCount === graduatedWordIds.length`
   inside the txn (or clamp the count to the emitted set) so the hash can never describe a different
   set than the count.
10. **Close the evidence gaps (M-1).** Extend the lap (or a named successor) to cover, at minimum:
    the callable layer end-to-end for every derivation it mints; a **wrapped** cursor window where
    last-traversed ≠ numeric max; "no active at all ⇒ cursor unchanged"; the R2-42/46 LRT selection
    order (absent-first, tie-wordIndex, priority prefix at saturation and below); a forced
    invariant-fallback branch with its recorded seed; COMPLETE-ROWS **violation** refusals (drift,
    missing row, duplicate row, blank-with-isCorrect-true); same-KST-date streak idempotency;
    `compose_keys` deletion via `fingerprint.listId` on a student that actually has claims (and
    replace `r.deleted >= before` with per-collection expected counts); a **G+1**-stamped quarantine
    row; and derivation #3's OFF-source **consumed** attempt (day completes, graduation zero).
11. **Give `challengeAcceptPlan` the R2-48 input (M-6)** so writer eligibility reaches the
    adjudication label path by construction rather than by caller convention.
12. **Decide the unflagged derivations (L-2, L-3):** `minClientVersion: null ⇒ fence disarmed` must
    be a recorded decision (and the shadow battery-L `client_version_stale` test must set the
    field); and make `client_version_stale` / `typed_modality_deferred` surface like every other
    frozen status.
13. **Handle malformed canonical word data (M-7):** words missing `position` are silently dropped by
    `orderBy` and then collide at `wordIndex 0`, throwing a `TypeError` ⇒ `internal`. Detect and
    return a typed refusal plus an ops signal.
14. **Record the compose read-set sizing (M-8)** in the deploy order (per-day transactional read
    cost and abort/contention behavior on 1,000+ word lists) — a note, not a redesign.

Items 1-6 are the NO. Items 7-14 are required for the checkpoint to close but do not, on their own,
block the dark deploy if 1-6 land first and 10 covers them.

---

## 8. Statement for the fold

The engine transactions are contract-faithful and, in several places (cursor law, reuse law,
allocator, evidence matrix, flip txn), exact to the letter of r57-r64. The failure mode of this
build is uniform and diagnosable: **the wiring layer mints the derivations the engine trusts, and
the wiring layer has no evidence behind it.** Every BLOCKER and three of four HIGHs live in
`callables.js`, and the 68/68 lap says in its own header that it does not test `callables.js`. Close
conditions 1-6, extend the lap over the callable boundary per condition 10, and this reaches YES —
in my judgment in one fold, not a re-architecture.
