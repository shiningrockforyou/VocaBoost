# DEEPFIX2 · r73 STAGE-2 CHECKPOINT — Opus lane: VERIFYING THE r73 FOLD

> Reviewer: Opus lane. Scope: commit `58af1f1` (`ce09792..58af1f1`, 21 files, 1,099/132).
> Duty: (1) adjudicate my 10 r72 closing conditions; (2) hunt NEW defects; (3) rule on the
> dark-deploy order series.
> Method: full read of the r73 code diff (`completion.js`, `config.js`, `callables.js`,
> `presentations.js`, `monitoring.js`, `firestore.indexes.json`), the whole lap diff, `17_` in full,
> 15_ §3b/§2/§3, and re-verification of the r72 seam surfaces that were NOT touched
> (`foundation.js` `computeAnchorPosition`/`safeValuesForDoc`/`resolveListProgress`/`completeSession`
> day-guard/`RESET_V2_ENABLED`, `composer.js` `resetLockActive`, `reset.js` header,
> `src/services/db.js` attempt writers). `node --check` on all 13 engine/lap sources: 13/13 pass.
> **`npx eslint .` across `functions/`: exit 0.** Receipt re-verified BY VALUE: **16/16 sourceShas
> match the tree**, `version:3`, `total:182`, `failed:0`, `pass:true`. Static check-count of the lap
> = 158 `check(` call sites + 24 `checkTrue(` = **182 exactly**, and the 8 new checks in the diff
> account for 174→182 with no checks inside loops. The emulator was NOT run.

## VERDICT: **NO** — Codex's six FAIL items are genuinely closed in code, but three of my ten
## conditions were never attempted and are not acknowledged anywhere in the packet, and the new
## durable deploy artifact ships with a "fixtured" claim for a leg that has zero coverage.

Let me be precise about the shape of this NO, because it is narrower than r72's.

**The dark deploy itself is inert and I would vote YES on it standing alone.** Functions + rules +
indexes at `enabled:false`, `rehearsalClassIds:[]`, `RESET_V2_ENABLED=false` (`foundation.js:2092-2094`
— emulator-gated override only, verified) is zero-delta for real students: no engine callable is
reachable (`stampingEligible` false ⇒ `review_v2_dark`), the reset stays legacy, and the index
addition is purely additive.

**The series as scoped by `17_` is not inert.** `17_` §1 folds the RESET_V2 flip into "the
sandbox-rehearsal phase" per David's timing ruling — and my condition 2 (N-2) is a defect in exactly
that step, untouched this round, with no code change, no runbook entry, and no fixture. The 25WT
rehearsal also runs the engine on real teacher-edited lists, which is where conditions 1 and 3 bite.
Those were the three I named as deploy-blocking, and none of the three is closed.

---

## 1. WHAT THE FOLD GOT RIGHT (Codex's list, verified line by line)

Every one of Codex's six FAILs is genuinely closed in code. I checked each against the source, not
the packet:

- **C1.1 — the catch-up is now a real sync.** `completion.js:616` writes
  `completedTwi: Math.min(truth.twi + wordsIntroduced, canonicalCap)`, byte-identical to the winner's
  own `advance.totalWordsIntroduced` at `:630`; `:279-281` copies it absolutely with the derive as a
  legacy-record fallback only. Codex's "any pre-existing divergence survives" objection is answered.
- **C1.2 — `teacherEdited ⇒ ZERO graduation.**` `completion.js:532` adds
  `&& consumed.teacherEdited !== true` to the graduation predicate, so A1's "ONE advance + ZERO
  graduation" holds while the below-threshold exemption at `:507` still lets the override progress.
- **C1.3 — the new-test half has the full r48 fence.** `completion.js:456-471`: integer score 0-100,
  integer `totalQuestions ≥ 1`, `answers.length === totalQuestions`, `round(correct/tq*100) === score`,
  and `passed ↔ gatePosture.threshold` with the `teacherEdited` exemption. Symmetric with `:347-358`.
- **C2 — the mint boundary is uncrossable with a stale day.** Three binds now:
  `callables.js:275-278` (preflight), `presentations.js:438-444` (claim txn), and the new
  `callables.js:545-551` (submit txn, live-new only). I verified the **idempotent-replay branch at
  `:496-515` returns BEFORE the new frontier check**, so a post-advance retry still replays rather
  than turning into a spurious `day_guard_rejected` — the obvious way to get this wrong was avoided.
  The unclaimed live-new registry replay re-binds at `presentations.js:361-371`, correctly scoped to
  `serverClaim.attemptDocId === null` so claimed replays stay pure §8 reads. All the new
  `readProgressTruthInTxn` calls sit in the read phase, before any `txn.create/update`.
- **C3 — the assignment CONTAINER is authority.** `config.js:129-135` HOLDs on
  `typeof rawAsg !== "object" || Array.isArray(rawAsg)`, which covers all four of Codex's reproduced
  shapes (`true`, `7`, `"assigned"`, `[]`) and, correctly, does not catch `null`/`undefined`.
  `assertServableInTxn:241-243` turns `readStatus !== "ok"` into `config_hold`.
- **C5 — the queue requirement is explicit.** `callables.js:540-542` refuses
  `isReviewType && !isRerun && !p.queueRef` with `queue_invalid`; the optional legs survive only for
  new/rerun, exactly as Codex specified.
- **C7 — rows carry run identity.** `monitoring.js:171` stamps `windowRunId` from the writer's cached
  view; `:200-205` quarantines any row (null included) whose stamp ≠ `window.runId`; `loadShadowRegistry`
  lifts `runId` off the window doc on the same sweep so the stamp is consistent with the generation
  stamp it rides with.
- **C8 — the six completion negatives now cross the public boundary.** `lap:489-501` replaces six
  direct `DONE.completeDay` calls with the `cd()` wrapper over `CALL.reviewV2CompleteDay`.
- **C4's packet correction accepted** ("state-law parity," not byte identity) and **C6 unchanged.**

Also right: `firestore.indexes.json:943-956` adds the `grading_jobs (uid ASC, status ASC)` composite —
purely appended, nothing reordered or removed; `17_` §2 correctly orders its deploy before any
RESET_V2 flip. The receipt is honestly re-bound (16/16 by value). Lint is still clean.

---

## 2. HIGH — NEW

### N-7 — `17_` §3 claims the H-A reverse leg is "fixtured"; it has **zero** coverage, and the freeze it publishes is understated

`17_` §3 (the artifact created to be the durable home for my condition 5):

> *"csd/twi single-line-of-advance is enforced by the mutual day-guards (engine completion refuses a
> legacy-advanced day **and vice versa — fixtured**)."*

The "vice versa" half is `foundation.js:1356-1364` (`completeSession`'s transactional day-guard). I
grepped the lap for `completeSession`: **0 hits.** The lap never loads it, never calls it, and cannot
observe it. The claim resolves to no file and no line.

The half that *was* fixtured is thin. `lap:636-639`:

```js
await seedProgress("uE", "cE", "LE", {csd: 11, twi: 60});
r = await DONE.completeDay(db, {... logicalDay: 10 ...});
check("H-A interlock: legacy-advanced day refused", [r.status, r.expectedDay], ["day_guard_rejected", 12]);
```

This exercises `completion.js:304-306` — the same predicate already asserted at `lap:492`
(`check("non-frontier refused (wrapped)", …)`). It is a legitimate *simulation* of the legacy-advanced
state (a legacy writer's only effect on the engine IS the csd bump), so I am not calling it a fake
check; but it adds no coverage, and the named assertions from my condition 5 — *which* of
`recentSessions`/`stats`/`streakDays`/`interventionLevel`/`reviewMode` freeze — are absent.

**And the freeze is more than display.** `17_` §3 publishes it as *"teacher-facing legacy stats
under-report engine-day activity."* But the engine's advance (`completion.js:628-634`) writes only
`{currentStudyDay, totalWordsIntroduced, lastStudyDate, lastSessionAt, updatedAt}` — no
`recentSessions` — and `recentSessions` is a **derivation input** to the legacy path, not just a
display field:

```js
// foundation.js:1372-1374
const fpReviewMode = FORCED_PATHWAY_ENABLED
  ? deriveThrottleModeServer(current.recentSessions || [], current.reviewMode === true)
  : false;
```

So during a mixed window, a legacy `completeSession` on day D+1 (which passes its guard) derives
intervention level / throttle mode from a `recentSessions` window that skipped every engine day. That
is a behavioral consequence of the freeze, and the published limitation does not name it.

*Close it by:* deleting "and vice versa — fixtured" or fixturing it (load `foundation.completeSession`,
run engine-advance-then-legacy and legacy-advance-then-engine for the same day); and amend `17_` §3 to
say the frozen fields feed `deriveThrottleModeServer`/`calculateInterventionLevel`, not only display.

---

## 3. MEDIUM — NEW

### N-8 — the `completedTwi` absolute copy has **no discriminating fixture**: the H-B fixture passes identically under the old derive

`lap:648-658` is the only catch-up fixture. It seeds `cE2` at `{csd: 7, twi: 60}` and completes day 8
with `consumedAttemptId: null, newTestAttemptId: null` — an autopass day, so `wordsIntroduced = 0`
and `done.completedTwi = min(60+0, 60) = 60`; the fallback derive gives `min(truth.twi + 0, 60) = 60`
for a loser view that is *also* at twi 60. **Both branches return 60.** The check only asserts
`currentStudyDay === 8` — it never reads `totalWordsIntroduced`.

Codex's exact C1.1 objection was *"there is no proof that this is actually a view sync."* The code now
answers it; the evidence still does not. A discriminating fixture needs the loser's view twi to differ
from the winner's pre-advance twi (e.g. cE at 50, cE2 at 40) on a day with `wordsIntroduced > 0`, then
assert the loser lands on the winner's absolute value, not `40 + wi`.

### N-9 — the run-binding quarantine opens a ≤60s classification blackout at every window open/roll, for **both** scopes

`monitoring.js:200-205` quarantines every row whose `windowRunId` ≠ the live `window.runId`. Writers
stamp from the ≤60s cached registry view (`:105-112, :171`).

`registryGeneration` was safe under this design because the generation is bumped by registry writes,
which happen **outside** run windows by schedule — a warm cache always carried the right one.
`runId` changes **at window open**, inside the window's own lifetime. So every warm instance keeps
stamping `null` (or the previous run's id, on a roll) for up to the full TTL, and every row it emits
in that period is quarantined — including in `scope: "production"`, which is the alerting path.

Net: production monitoring is indeterminate for up to 60 seconds at each window open, **by
construction**. `quarantined_row_count` makes it visible, which is the r64 law working, but the r64
intent was that quarantine be exceptional. Nothing in `16_` or `17_` records the skew. `evaluateThresholds`
bounds by `startedAt`, so those rows are inside the time bound and outside the run bound — for a short
shadow-audit run this systematically drops the opening slice.

*Close it by:* forcing a registry re-read when a writer's cached view has no `windowRunId` but a window
doc exists, or grace-classifying rows whose `createdAt < window.startedAt + TTL`, or publishing the
60s skew as a window-open protocol step.

### N-10 — the new-test r48 fence is applied to the LEGACY leg too, and legacy MCQ attempts store the **answered subset**

The C1.3 fence at `completion.js:456-471` sits *after* the `resetEpoch`-present/absent branch at
`:426-452`, so it governs both legs. The legacy MCQ writer stores:

```js
// src/services/db.js:1288, 1310-1317
const score = answeredWords.filter((a) => a.isCorrect).length / totalQuestions
…
score: Math.round(score * 100), answers: answeredWords, skipped: skippedCount, totalQuestions,
```

`answers` is `answeredWords` — the subset with a non-empty response — while `totalQuestions` counts
all presented. So **any legacy new-test attempt with a skipped question fails
`ntRows.length !== ntq` ⇒ `impossible_record (new test)`**. (The score↔rows leg is fine: the stored
score is derived over `totalQuestions`, so it agrees. The AI-graded path at `:1415-1441` builds
`answers` from all `words`, so it is unaffected.)

The consumed half has carried this since r70 and both lanes signed it off, so this is a widening, not a
new law. But it widens the flip-week refusal surface on the exact leg `legacyEvidence` exists to serve,
and `17_` — the deploy-requirements artifact — says nothing about it. Either scope the fence to the
engine leg, or publish "legacy attempts with skips are refused" as a deploy-order card.

### N-11 — `completedTwi` is a new field on the §3b **immutable** completion record and is not in the schema

`15_` §3b's field list (`:126-134`) enumerates the completion record and does not contain
`completedTwi` — nor `wordsIntroduced`, `twiHeld`, `postureSource`, `legacyEvidence`, which have been
drifting since r70. `completedTwi` matters more than the others because the **ratified R2-51 law reads
it**: the catch-up at `:279-281` branches on `Number.isInteger(done.completedTwi)`. The R2-51 note was
edited into §3b this round (`:146-152`) without adding its own input field to the schema three
paragraphs above it. A ratified law whose input is not in the frozen schema is the same defect class
as r72's N-4.

---

## 4. LOW — NEW

- **L-5** `presentation_invalid` (`callables.js:535-537`) is a new typed refusal on the live mint
  path, introduced reactively to a red, with **no fixture** (`grep presentation_invalid` over the lap
  → 0 hits). Same "green over untested code" shape as r71's H-C and r72's `queue_invalid`.
- **L-6** The submit txn mixes read sources for the facts that *select* which guard applies:
  `isRerun`/`isNewSession`/`isReviewType` derive from the **pre-txn** `pres` (`callables.js:480-482`)
  while the r73 guards test the **in-txn** `p` (`:535-551`). Derive all three from `p` inside the txn.
- **L-7** The `positionGap` warning fires only from `reviewV2ComposeSession` (`callables.js:177-180`).
  `ComposeNewTest` (`:264-269`) and `ComposeRerun` (`:342-347`) emit only on refusal — so the callable
  that actually **stamps the positional anchor** (`:287-288 → :613`), i.e. the sole mechanism of the
  N-1 divergence, never surfaces the gap. It is also the only `list_words_malformed` emission that is
  fire-and-forget (`emitOps`) rather than awaited (`emitOpsAwait`, used at `:170, :266, :344, :713`).
- **L-8** `lap:868` adds `await new Promise((res) => setTimeout(res, 700))` as a synchronization
  primitive for a fire-and-forget ops assertion. A wall-clock sleep is a flake vector in the artifact
  the whole checkpoint rests on; poll the query instead.
- **L-9** Comment orphan at `lap:848-850`: the lead line `// [r72 C7] ops emissions through the
  callables: rerun_graduation (from the` was deleted in the move, leaving two dangling continuation
  lines under an unrelated block.
- **L-10** `reset.js:17-18` still reads *"pending `grading_jobs` cancellation via the named
  (uid,status) index (an **EXISTING** top-level pipeline leg)"* — the exact in-code false claim my
  condition 4 named. It is now false in a new way: the index exists in `firestore.indexes.json` and
  has never been deployed.
- **L-11** `17_` is referenced only from handoffs and `RESUME.md`; it is not linked from
  `docs/README.md` or any `docs/plans/deepfix2/` index.

---

## 5. CONDITION-BY-CONDITION (my 10 from r72)

| # | Condition | Verdict |
|---|---|---|
| 1 | Reconcile the ordinal/positional `twi` split (N-1); 15_ §2 supersession; gap fixture through `resolveListProgress` | **NOT MET.** None of the three named remedies was taken. `callables.js:287-288` still stamps positional `rangeStartIndex/rangeEndIndex` onto the attempt (`:611-614`); `foundation.js:930` still computes `twi = nwei + 1`; `:959` still makes the anchor authoritative (`safeTWI = anchor.hasValidData ? anchor.twi : …`); `:1882-1886` still writes it back; `SERVER_RESOLVE_LIST_PROGRESS_ENABLED = true` (`:47`). The fold's answer is to **publish** the divergence (`17_` §5) and emit a warning. That is a durable home, and I credit it — but the remedy asked for was reconciliation, and the corruption path is byte-identical to r72. No 15_ §2 supersession (`grep -i ordinal 15_` → 0 hits). **The named fixture does not exist**: `lap:882-891` calls `loadCanonicalWordsStrict` directly and asserts the return shape; it never runs an engine day and `resolveListProgress` appears nowhere in the lap (0 hits). See also L-7. |
| 2 | Give `resetLockActive` the takeover window (N-2), **or** publish the crashed-reset lockout in `SUPPORT_RUNBOOK.md` with the repair; fixture an 11-minute-old lock | **NOT MET — untouched, and unacknowledged.** `composer.js:161-163` is unchanged; its comment now *states* the design ("takeover belongs to the next reset op, never to a composer"), which is a defensible position but makes the permanent reader-side lockout a **chosen** behaviour with no published recovery. `SUPPORT_RUNBOOK.md` is not in the r73 commit at all. No fixture. `RESET_LOCK_TAKEOVER_MS` (`foundation.js:2081`) is still writer-only (`:2138`). This condition is not mentioned in the handoff, the change log, or `17_`. |
| 3 | Sweep real lists for duplicate/gapped positions (N-6); rule refuse-vs-degrade; card the `deleteWord`/`addWord` reindex bug | **PARTIALLY MET.** The **gap** rule is published (`17_` §5: servable, warn, no refusal). **Duplicates still refuse the whole list for every student on it** (`callables.js:136-138`) — and a duplicate, not a gap, is the real-world signature of a delete-then-add teacher edit (`src/services/db.js:600-614` sets `position: wordCount`; `:658-668` decrements without reindex). No sweep was run, no ruling on duplicates, and the reindex bug has no card in `17_`, `NEED_TO_FIX.md`, or the change log. |
| 4 | Verify the `grading_jobs (uid,status)` index; correct the two claims that assert it verified | **PARTIALLY MET.** The composite is added (`firestore.indexes.json:943-956`) and `17_` §2 orders its deploy before any RESET_V2 flip — that is the better answer than "prove zigzag serves it," and the handoff's CC-14 claim is honestly corrected. But `reset.js:17-18` still says "an EXISTING top-level pipeline leg" (L-10). One of two corrected. |
| 5 | Fixture the H-A interlock both ways + the field freeze; record the ruling durably | **PARTIALLY MET.** Durable home landed (`17_` §3) — that half is done properly. The fixture is one direction only, adds no coverage beyond `lap:492`, the reverse leg has none, the field-freeze assertion is absent, and `17_` §3 claims "and vice versa — fixtured." See **N-7**. |
| 6 | Fixture `queue_invalid` — at minimum the non-canonical-path and pool-hash legs | **PARTIALLY MET.** The **missing-queue** leg is fixtured through the wrapped callable (`lap:641-647`) and Codex's C5 optionality defect is genuinely closed. The two legs I actually named — `"non-canonical queueRef"` (`callables.js:557-559`) and `"pool-hash mismatch"` (`:567-569`) — remain unfixtured, along with queue-missing, identity-mismatch, subset and threshold-bounds. Five of six legs of the fence are still untested. |
| 7 | Name one engine/legacy evidence discriminator (N-5) or publish the asymmetry | **NOT MET — untouched, unacknowledged.** `completion.js:365` still branches the consumed half on `presentationId`; `:426` still branches the new half on `resetEpoch`. Not mentioned in the handoff, the change log, or `17_`. |
| 8 | Land the CC-14 sizing note in a durable artifact | **MET.** `17_` §4, with the chunking and the contention note. |
| 9 | Sweep the packet: every "EXISTING" / "live-verified" / "supersession in §X" claim resolves to a file and a line | **PARTIALLY MET.** The r72 recurrence is corrected honestly and the receipt is genuinely re-bound (I verified 16/16 by value). But the sweep produced **two new unsupported claims in the very artifacts created to satisfy it**: `17_` §3's "and vice versa — fixtured" (N-7), and the R2-51 ratification edited into 15_ §3b without adding `completedTwi` to the §3b schema its own law reads (N-11). Plus L-10's survivor. Third consecutive round where a spot-check of packet claims found one that does not resolve. |
| 10 | Minor: L-1 `lastStudyDate`; L-2 comment; L-3 receipt version; L-4 pace comment | **HALF MET.** **L-2 MET** — `callables.js:271-274` now describes the three binds correctly. **L-3 MET** — header, `version: 3`, the `ENGINE LAP v3` log line, and the receipt all agree. **L-1 NOT MET** — `completion.js:277-284` still omits `lastStudyDate`, and no reason is stated. **L-4 NOT MET** — `lap:775` still reads `pace = ceil(50/5) = 10`. |

**Score: 2 MET (8, and 10 at half) / 5 PARTIAL (3, 4, 5, 6, 9) / 3 NOT MET (1, 2, 7).**

Mapped to the items my brief named: **#2 H-A** partial (home yes, fixture no — N-7); **#9
`queue_invalid`** partial (Codex's leg yes, my two legs no); **#10** met on the sizing card and the
index, partial on the false-claim correction (L-10); **N-1** not met (published, not reconciled);
**N-3** met in code, unmet in the comment; **L-2** met; **v3 relabel** met.

---

## 6. CLOSING CONDITIONS FOR r74 (complete — nothing held back)

**Deploy-blocking (these three go live in the rehearsal phase `17_` §1 now schedules):**

1. **N-2.** Give `resetLockActive` (`composer.js:161-163`) the `RESET_LOCK_TAKEOVER_MS` window, **or**
   write the crashed-reset lockout into `SUPPORT_RUNBOOK.md` as a CS-recoverable state with the exact
   repair. Fixture an 11-minute-old lock and assert the engine callables serve. Two lines or one
   paragraph — but it cannot stay silent while the flip moves into 25WT.
2. **N-1 / condition 1.** Either take one of the three remedies, or — if "publish and warn" is the
   ruling — make the warning reach the path that causes it (`ComposeNewTest`/`ComposeRerun`, L-7),
   award it a 15_ §2 supersession, and add the fixture I named (gapped list → one full engine day →
   `resolveListProgress` → assert the written-back twi). Today the fixture proves only that a helper
   returns a struct.
3. **Duplicates (condition 3).** Rule on refuse-vs-degrade for `list_words_malformed` on a duplicate
   position, run the read-only sweep of 26SM/25WT, and card the `deleteWord`/`addWord` reindex bug.

**Checkpoint-blocking:**

4. **N-7.** Delete "and vice versa — fixtured" from `17_` §3 or fixture it; amend the freeze note to
   name `deriveThrottleModeServer`/`calculateInterventionLevel` as consumers of the frozen fields.
5. **N-8.** Give `completedTwi` a discriminating fixture (divergent class views, `wordsIntroduced > 0`).
6. **N-11.** Add `completedTwi` (and `wordsIntroduced`/`twiHeld`/`postureSource`/`legacyEvidence`) to
   the 15_ §3b completion-record field list.
7. **N-9.** Handle or publish the ≤60s `windowRunId` skew at window open/roll.
8. **N-10.** Scope the new-test r48 fence to the engine leg, or publish the legacy-skip refusal in `17_`.
9. **Condition 7 (N-5).** Name one discriminator, or publish the asymmetry and its twi consequence.
   It has now been unaddressed and unacknowledged for a full round.
10. **Condition 6.** Fixture the `non-canonical queueRef` and `pool-hash mismatch` legs.
11. **Minor:** L-5 fixture `presentation_invalid`; L-6 derive the three session booleans from the
    in-txn `p`; L-8 replace the 700ms sleep with a poll; L-9 the orphaned comment; L-10 `reset.js:17`;
    L-11 link `17_` from the docs index; and the r72 survivors L-1 (`lastStudyDate`) and L-4 (pace).

**On the packet:** three of my ten conditions (2, 7, and the duplicates half of 3) are not mentioned
anywhere in the handoff, the change log, or `17_`. An unmentioned condition is worse than a declined
one, because it is indistinguishable from an overlooked one. If a condition is being deferred, defer
it explicitly with a reason — that alone would move two of these from NOT MET to accepted.

---

## 7. Statement for the fold

This is the strongest fold of the series on the axis it was aimed at. Codex's six FAILs are closed at
the source, not patched: the catch-up copies an absolute value instead of re-deriving, the override
graduates nothing, the new half carries the same fence as the review half, the mint boundary binds the
frontier three times with the replay branch correctly ordered ahead of it, the container is authority,
the live review requires its queue, and the audit rows carry run identity. I checked each of those
against the code and every one of them is real. The receipt is honest, the lint is clean, and the
index that r72 claimed falsely now exists with a deploy ordering around it.

What did not happen is that my three unattempted conditions became invisible. N-2 is two lines or one
runbook paragraph, and David has now scheduled the exact flip that arms it. N-5 has survived a full
round without a sentence. The duplicate-position refusal — a total outage for every student on a list
a teacher edited — is still unruled and unswept while `17_` publishes a rule for the *gap* case that
almost never occurs alone.

And the artifact created to end packet drift shipped with a claim that does not resolve. `17_` §3 says
the reverse interlock is fixtured; the lap has never loaded `completeSession`. That is the fourth
consecutive round in which a spot-check of the packet found a claim with no file and no line behind it,
and it is the reason this is a NO rather than a YES-with-conditions: the deploy itself is inert, but
the document that governs the deploy has to be true.

Close items 1-3 and correct `17_` §3, and I expect to vote YES next round on a much shorter review.
