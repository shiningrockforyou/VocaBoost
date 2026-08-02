# DEEPFIX2 · r72 STAGE-2 CHECKPOINT — Opus lane: VERIFYING THE r71 FOLD

> Reviewer: Opus lane. Scope: the working tree as handed off
> (`docs/plans/loop/handoffs/claude_to_codex_deepfix2_r72.md`).
> Duty: (1) adjudicate my own 12 r71 closing conditions; (2) hunt NEW defects the fold introduced;
> (3) rule on the checkpoint.
> Method: full read of the r72 diff surface — `functions/foundation.js` (`resetProgress` in full
> both branches, `applyChallengeAdjudication`, the accept writer, `computeAnchorPosition` /
> `safeValuesForDoc` / `resolveListProgress`'s F4-1 leg), all of `functions/reviewV2/*`,
> `scripts/deepfix2/flip-review-v2.mjs`, the lap v3 in full, the committed receipt, 15_ §2/§3b/§9,
> `SUPPORT_RUNBOOK.md`, `functions/package.json`, and the live client word-editing path
> (`src/services/db.js` `addWord`/`deleteWord`). `node --check` on foundation/index/all reviewV2
> modules: all parse. **`npx eslint .` across the WHOLE `functions/` package: exit 0, zero
> findings** — the mask is genuinely gone. Receipt `sourceShas` recomputed and compared by value
> against the tree: **16/16 match**, `pass:true`, `total:174`, `failed:0`. The emulator was NOT run
> (per instruction).

## VERDICT: **NO** — the r71 BLOCKER is genuinely dead, 8 of 12 conditions closed, but the fold
## introduces two HIGH seam defects that land exactly where the deploy-order series runs, and the
## packet-honesty condition recurred inside the packet written to satisfy it.

This is the third consecutive NO of a different character, and I want to be precise about what it is
not. It is not an engine finding. **BL-A is closed properly** — the fence is `progress_meta`-only
pre-P5, the supersession is logged in 15_ §9 *and* `SUPPORT_RUNBOOK.md` (CS-2026-08-03), and the lap
asserts the doc is not created. The `RESET_V2_ENABLED=false` gate is the right call and the legacy
branch is byte-faithful to the pre-r70 body (I diffed it against `ca8d4fe`). The flip's source
binding is now real. The lint mask is gone and the full package is clean. The receipt binds 16 files
including the two that carry the live-cohort change, and every hash checks out.

The NO is driven by **the seam between the engine's new semantics and the live system that will
overwrite them**, plus one lock asymmetry that becomes live the moment David flips the const this
fold is asking him to flip.

---

## 1. HIGH — NEW DEFECTS INTRODUCED BY THIS FOLD

### N-1 — The M-A remedy makes `twi` an ORDINAL COUNT in the engine while the LIVE anchor reconciler keeps it POSITIONAL and **authoritative** — they overwrite each other on any list a word was ever deleted from

The fold took option (b) of my condition 6: slice by ordinal instead of asserting contiguity.
`progress.js:93-95` is now `canonicalWords.slice(0, min(twi, len))` and `callables.js:271-273` is
`canonical.words.slice(truth.twi, truth.twi + pace)`. Internally consistent, gap-tolerant, correct.

But the engine still stamps its new-test attempt with **positions**:

```js
// callables.js:277-278
const rangeStartIndex = dayWords[0].wordIndex;
const rangeEndIndex   = dayWords[dayWords.length - 1].wordIndex;
// callables.js:581-584 — written onto the attempt
? {newWordStartIndex: p.rangeStartIndex, newWordEndIndex: p.rangeEndIndex}
```

and the LIVE reconciler reads that stamp positionally and **wins**:

```js
// foundation.js:930-932   (computeAnchorPosition)
twi = anchorTest.newWordEndIndex + 1;
// foundation.js:959       (safeValuesForDoc)
const safeTWI = anchor.hasValidData ? anchor.twi : Math.max(storedTWI, anchor.twi);
// foundation.js:1882-1886 (resolveListProgress, LIST_PROGRESS_CANONICAL === false)
await launchRef.update({currentStudyDay: safe.safeCSD, totalWordsIntroduced: safe.safeTWI, ...});
```

`SERVER_RESOLVE_LIST_PROGRESS_ENABLED = true` (`foundation.js:47`) — this runs at **every session
entry**. `safeCSD` is non-demoting (`max`), so the engine's day survives; **`safeTWI` is
anchor-authoritative and simply replaces the engine's value.**

**Failure scenario.** List positions `0,1,5,6,7,8,9` (7 words; a teacher deleted the words at 2-4).
Day 1, pace 2: `dayWords = words.slice(0,2)` = positions 0,1 → engine twi 2, anchor `nwei+1` = 2.
Agreed. Day 2: `dayWords = words.slice(2,4)` = positions 5,6 → **engine twi 4**, but the attempt
stamps `newWordEndIndex = 6` → **anchor twi 7**. Next session entry rewrites the progress doc to
twi 7. The engine now reads twi 7 as an ordinal count: `introducedUniverse` returns the first 7 words
— **the whole list, including positions 7,8,9 the student has never seen** — and the next new test is
`words.slice(7,…)` = position 9 only, so positions 7 and 8 are **never introduced, ever**. The two
laws then oscillate on every completion.

**Gaps are not hypothetical — they are the guaranteed result of a routine teacher action.**
`deleteWord` (`src/services/db.js:658-668`) deletes the doc and decrements `wordCount` with **no
reindex** of the survivors' `position` fields.

The map states this as closed: *"C8: ordinal universe slice (twi = COUNT — gap-tolerant, M-A resolved
without refusing gapped lists)"*. It is resolved inside the engine and unresolved across the seam.
There is **no gap fixture anywhere** (`grep -i gap scripts/deepfix2/engine-emulator-lap.mjs` → 0
hits; my condition 6 named one), and — see N-4 — the change of `twi`'s meaning is **not recorded in
15_ §2** despite the map claiming a §2 supersession.

*Close it by:* stamping an ordinal-consistent `newWordEndIndex` (i.e. `twi_before + |dayWords| − 1`),
or teaching `computeAnchorPosition` the ordinal law, or refusing non-contiguous lists after all.
Whichever — it needs a gap fixture that runs a full engine day and then `resolveListProgress`.

### N-2 — `resetLockActive` has NO takeover leg while the reset it guards has one: a crashed RESET_V2 reset locks the student out of every engine callable **permanently**

```js
// composer.js:161-163 — the ONLY lock predicate, shared by every engine reader
function resetLockActive(pmData, lpData) {
  return Boolean(pmData?.resetInProgress) || Boolean(lpData?.resetInProgress);
}
```

Used by `callables.js:102` (`deriveEpoch` — the preflight for *all seven* callables),
`callables.js:508` (submit), `composer.js:252`, `presentations.js:372`, `completion.js:268` and
`:294`, `visits.js:61`. **No age check anywhere.**

The reset itself is takeover-tolerant — `foundation.js:2136-2140` rejects only when
`ageOf(l) < RESET_LOCK_TAKEOVER_MS` (10 min). So the two halves of the §9 law disagree: the writer
self-heals after ten minutes; every reader refuses forever.

The window this opens is large and new. Between the fence txn (`foundation.js:2129-2160`) and the
owner-clear (`:2259-2266`) the rebuilt reset now performs **four full collection sweeps + a
whole-history `attempts` read for the student + nine-family stale-epoch deletes + bookmark clears +
a `grading_jobs` query with N sequential `update()`s**. A function timeout or crash anywhere in there
leaves `resetInProgress` set. From that moment the student gets `reset_in_progress` from
`reviewV2ComposeSession`, `ComposeNewTest`, `ComposeRerun`, `SubmitAttempt`, `CompleteDay` and
`MintVisit` — with no self-heal short of a human re-running `resetProgress`.

The lap never plants a stale lock against the engine: the only engine-facing lock fixture
(`engine-emulator-lap.mjs:296`) uses `Timestamp.now()`, and the stale-lock fixtures (`:432`, `:437`)
exercise only the reset callable's own takeover.

This is dark today and `RESET_V2_ENABLED=false` today. It goes live at the **named, David-authorized
const flip** that the handoff schedules into the deploy order — i.e. it is a defect in the deploy
order's first substantive step. Either give `resetLockActive` the same `RESET_LOCK_TAKEOVER_MS`
window, or publish that a crashed reset is a CS-recoverable lockout and put the recovery in
`SUPPORT_RUNBOOK.md`.

---

## 2. MEDIUM — NEW

### N-3 — The `grading_jobs (uid,status)` index is claimed as existing; it does not exist, and neither does any prior query of that shape

`functions/reviewV2/reset.js:17-18` (in-code):

> *"pending `grading_jobs` cancellation via the named (uid,status) index (an EXISTING top-level
> pipeline leg)"*

and the handoff's CC-14 block:

> *"the grading_jobs `(uid,status)` query is live-verified in production (session-start pickup)"*

Both are false.
- `firestore.indexes.json` contains **no `grading_jobs` entry at all** (indexed collection groups are
  only `attempts`, `study_states`, and the `ap_*` families).
- Every other `grading_jobs` access in the tree is a **`.doc()` get** — `index.js:929`, `:980`,
  `:1149`, `:1564`. There is no pre-existing collection query on `grading_jobs` anywhere.

The only query of that shape in the codebase is the one this fold added
(`foundation.js:2225-2226`). Equality-only conjunctions are usually served by zigzag merge, so it
will probably work — but it is unverified, it sits on a live path **after the fence has stamped the
epoch and taken the lock**, and a failure there leaves the lock held (see N-2). This is exactly my
r71 L-G, restated as settled fact rather than verified.

### N-4 — The ordinal law is unpublished: 15_ has **no §2 supersession**, contrary to the map

The map's headline is *"15_ §2/§3b/§9 supersessions"* and `change_action_log.md:1482` repeats it.
`grep -n "r72" docs/plans/deepfix2/15_H6_SCHEMAS_AND_CONTRACTS.md` returns exactly **two** hits:
line 147 (§3b, the H-B PROPOSED law) and line 273 (§9, the fence-scope + gate + dual-lock). §2 —
which is where the review universe and the match tuple are frozen — carries nothing. So the single
most consequential semantic change in this fold, *`twi` is a COUNT, not a position bound*, exists
only in a code comment (`progress.js:88-92`) and a handoff bullet. That is precisely the gap N-1
falls through.

### N-5 — The two evidence halves discriminate engine-vs-legacy on **different fields**

- Consumed half (`completion.js:360`): branches on **`presentationId` present** ⇒ full binding;
  absent ⇒ `legacyEvidence = true`, no queue, and graduation then runs with
  `orderedQueueWordIds = presentedWordIds = rows.map(r => r.wordId)` (`:511-513`) — the client's own
  row list defines the queue.
- New-test half (`completion.js:421-430`): branches on **`resetEpoch` present** ⇒ requires a claimed
  live presentation; absent ⇒ `legacyEvidence = true`, and `wordsIntroduced` comes from the
  **client-written** `newWordEndIndex − newWordStartIndex + 1` (`:554-556`).

So an attempt carrying a real `presentationId` but no `resetEpoch` gets *full* binding as consumed
evidence and *zero* presentation binding as new evidence — the presentation is right there and never
read. The reverse hybrid (`resetEpoch` present, `presentationId` absent) is refused on the new side
but passes as legacy on the consumed side.

Engine-minted attempts always carry both, so this is not reachable from the engine. It is reachable
from a hand-written attempt while `attempts` remains client-writable (until P6), which is the whole
rehearsal window. The map's claim *"a client-shaped range can no longer inflate twi"* holds only for
the `resetEpoch`-present leg; the legacy leg still drives twi from a client range (clamped to
`canonicalWordCount`, which is the only thing bounding it). Pick one discriminator and name it.

### N-6 — `deleteWord` + `addWord` produce a DUPLICATE position, and the strict loader turns that into a whole-list engine outage

`addWord` sets `position: currentCount` where `currentCount = list.wordCount`
(`src/services/db.js:600-614`); `deleteWord` decrements `wordCount` without reindexing (`:658-668`).
So delete-then-add on an N-word list writes a new word at position `N−1` — **which already exists**.
`loadCanonicalWordsStrict` (`callables.js:134-138`) refuses duplicates with
`{status: "list_words_malformed", duplicatePosition}`, and every engine callable returns that
refusal for **every student on that list**, permanently, until the data is repaired.

This is r70's CC-13 fence behaving as designed, not new code — but the map's claim that the fold is
now safe on *"real lists with historical deletions"* is only half true. The real-world signature of a
teacher edit session is a duplicate, not a gap, and a duplicate is a total refusal. This needs a
read-only sweep of the 26SM/25WT lists for duplicate and gapped positions **before** the rehearsal
window opens, and a decision on whether `list_words_malformed` should degrade rather than refuse.

---

## 3. LOW — NEW

- **L-1** The H-B view catch-up writes `currentStudyDay/totalWordsIntroduced/lastSessionAt/updatedAt`
  (`completion.js:274-279`) but **not `lastStudyDate`**, which the winner's advance does write
  (`:605`). `calculateUpdatedStreak` (`foundation.js:400,1450`) keys off `lastStudyDate`, so the
  caught-up class carries a null/stale streak base while its `currentStudyDay` has moved. Harmless
  today (the catch-up deliberately writes no streak), but it is an asymmetry between two writers of
  the same doc — the exact shape of H-A.
- **L-2** `callables.js:262-264` still reads *"the frontier bind is HERE plus the completion's; a
  stale-day claim dies at completion. Preflight bind:"* — directly contradicted by
  `bindFrontier: true` three lines below at `:287`. The comment describes the r71 defect, not the
  r72 code.
- **L-3** The receipt records `kind:"engine-emulator-lap", version: 2` and the lap prints
  `"ENGINE LAP v2"` (`engine-emulator-lap.mjs:932, 938`) while the map, the change log and the
  handoff all call it **LAP v3**. Cosmetic, but the receipt is the audit artifact.
- **L-4** My r71 L-C survives verbatim: `engine-emulator-lap.mjs:713` still comments
  *"pace = ceil(50/5) = 10"* while `deriveDailyPace` reads `assignment.pace` (absent ⇒ weekly 400 ⇒
  daily 80); the `[10,19]` assertion passes only because `LX` runs out of words.

---

## 4. What the fold got right

- **BL-A is closed at the source, not patched.** `foundation.js:2150-2158` fences `progress_meta`
  only while `LIST_PROGRESS_CANONICAL` is false, with the reasoning inline; 15_ §9 line 273 carries
  the supersession in the doc (not just a code comment, which was my r71 complaint); `SUPPORT_RUNBOOK`
  CS-2026-08-03 tells CS both the rule and the repair ("if a stray pre-P5 list_progress doc is ever
  found, delete it"); `engine-emulator-lap.mjs:423` asserts the doc is not created.
- **The RESET_V2 gate is the right answer to a live-callable change.** I diffed the false branch
  against `ca8d4fe`: deletes 1-4 are identical, `const now` is hoisted but still evaluated after the
  deletes, and the `epochStamp`/`LIST_PROGRESS_CANONICAL` block is byte-faithful. The only deltas are
  additive telemetry/return fields, and `db.js:3188-3195` reads only `success` and `deleted`. The
  `reviewV2/reset` module is `require`d **inside** the gate, so production never loads it. Genuinely
  zero-delta.
- **The flip's source binding is now real** (`flip-review-v2.mjs:102-121`): seven enumerated sources,
  `sha256` recomputed from the repo, compared by value, with a hash-mutated *real* receipt fixtured
  refused (`lap:882-887`). The chain rule at `:124-132` is exactly `B4(→B1→B3→B4)+` with cycle
  consistency, `['B4']` refuses, and the activation receipt comes from a genuine cycling chain driven
  by a live post-watermark delta.
- **C3's remainder is fully closed.** `uid` is threaded into every minting resolve (7/7 call sites
  verified), `assertServableInTxn` binds `class_not_found`/`not_enrolled`/`list_not_assigned`
  (`config.js:242-244`), and present-but-malformed assignment overrides HOLD (`:136-147`) instead of
  coercing.
- **Frontier-before-exists** (`composer.js:263-265` ahead of the replay return at `:268`) and the
  **in-txn new-day frontier bind** (`presentations.js:438-444`) both landed; M-B is gone.
- **The full queue fence is fail-closed on every leg** (`callables.js:522-549`) and `engineResult`
  now persists on the attempt (`:628-631`) so replay returns stored facts.
- **`priorityCount` is live** (`presentations.js:428, 543` → `callables.js:201-206`) and the
  saturation, rerun-graduation and cursor-repair ops rows are all asserted (`lap:787-802`).
- **Monitoring fails closed on any malformed window leg** (`monitoring.js:180-183, 241-247`) and the
  non-dry `quarantined_row_count` publish is exercised (`lap:643-647`).
- **`applyChallengeAdjudication` is a real extraction** (`foundation.js:2066-2077`), called by the
  server writer at `:2750`, exported at `:3038`, and the CC-5 fixtures run against it
  (`lap:441-449`) — copy-once, never-overwrite, reject-preserves.
- **The lint mask is gone.** `functions/package.json:5` is `"lint": "eslint ."` and I ran
  `npx eslint .` across the whole package: exit 0, zero findings.
- **COMPLETE-ROWS negatives are structurally satisfied.** Rows are server-generated one-per-presented-
  word with a server-derived `isCorrect` (`callables.js:452-465`), so "missing row" and
  "blank-with-`isCorrect:true`" are unreachable at that boundary; duplicate-row and drift are both
  fixtured through the wrapped callable (`lap:709-711, 773-776`).

---

## 5. Condition-by-condition (my 12)

| # | Condition | Verdict |
|---|---|---|
| 1 | Fix BL-A + log the supersession + runbook + fixture | **MET.** `foundation.js:2150-2158`; 15_ §9:273; `SUPPORT_RUNBOOK` CS-2026-08-03; `lap:423`. My fixture asked for a reader-level assertion (`resolveListProgress` after a legacy advance); the delivered one asserts the doc is never created, which closes the defect class at its source. Accepted. |
| 2 | Rule on the advance interlock (H-A) | **NOT MET.** The *ruling* is correct and I verified it in code — `completeDay` refuses a legacy-advanced day (`completion.js:299-301`) and `completeSession` refuses an engine-advanced day (`foundation.js:1361-1364`), so csd genuinely moves once. But it lives only in the handoff and the change log; 15_ carries nothing, and there is no deploy-order artifact yet (`docs/plans/deepfix2/` has no such file). The condition's **named fixture — `completeDay` then `completeSession` for the same student/day, and the reverse — does not exist**; the lap never invokes `completeSession`. H-A was flagged precisely because the lap cannot see it, so a ruling with no fixture and no durable home does not close it. |
| 3 | Rule on the dual-class steady state (H-B) | **MET.** The catch-up is implemented (`completion.js:257-292`), writes csd/twi only — I verified no graduation, no rest, no streak in that branch and that the epoch/lock checks run inside it (`:268-270`) — is published as PROPOSED candidate R2-51 with ratification pending (15_ §3b:147), and is fixtured (`lap:595-605`). Gap: my fixture said "compose **and** complete via B"; only the complete leg exists. Not blocking — I traced the compose path and B self-heals through one session. |
| 4 | Make `priority_saturation_day` reachable (H-C) | **MET.** `presentations.js:428` lifts it, `:543` returns it, `callables.js:201-206` emits it, `lap:789-800` drives an all-priority compose and asserts the ops row; `rerun_graduation` and `cursor_repaired` rows asserted at `:787-788, 801-802`. |
| 5 | Enforce the receipt's source binding (M-E) | **MET.** Value-level comparison of seven enumerated sources (`flip-review-v2.mjs:105-121`), hash-mutated receipt fixtured refused (`lap:882-887`), and the full `B4(→B1→B3→B4)+` ordering enforced with cycle consistency (`:124-132`) rather than amended away. |
| 6 | Assert contiguity **or** slice by ordinal (M-A) | **MET AT THE LETTER, BUT SEE N-1.** The ordinal slice is real and correct in `progress.js:93-95` and `callables.js:271-273`. The condition's **gap fixture does not exist**, and the remedy creates a live contradiction with `foundation.js:932`'s positional, authoritative `twi = nwei + 1`. I am scoring the condition met because it asked for exactly one of two remedies and got one; the consequence is filed as a new HIGH. |
| 7 | Close the C3 remainder (M-C, M-D) | **MET.** `uid` in all seven resolves; typed `class_not_found`/`not_enrolled`/`list_not_assigned` at txn time (`config.js:242-244`); strict assignment overrides HOLD (`:136-147`); un-enroll and un-assign races fixtured at the txn level (`lap:766-771`). |
| 8 | Bind the new-test frontier in-txn (M-B) | **MET.** `callables.js:287` passes `bindFrontier: true`; `presentations.js:438-444` re-reads progress inside the claim txn and returns `day_guard_rejected`. (Carries L-2 — the comment above it still describes the old behaviour.) |
| 9 | Close the named evidence gaps (CC-10 / C8) | **NOT MET (one item).** Landed: ON→OFF posture (`lap:575-593`), the two CC-5 preimage fixtures (`:441-449`), the non-dry `quarantined_row_count` publish (`:643-647`), duplicate-row and drift through the wrapped callable, and `foundation.js` + `src/services/db.js` inside the receipt's `sourceShas` (I verified 16/16 by value). Missing-row and blank-with-`isCorrect:true` are structurally unreachable — accepted. **The `queue_invalid` fixture does not exist**: `grep -c queue_invalid engine-emulator-lap.mjs` → **0**. The full five-leg queue fence (`callables.js:522-549`) is entirely untested, which is the same "green over untested code" shape as r71's H-C. |
| 10 | Record the compose read-set sizing (CC-14) + verify the `grading_jobs` index | **NOT MET.** The sizing note exists only in the handoff's "collected for the WinClaude series" block — nothing in 15_ or anywhere under `docs/plans/deepfix2/`, and no deploy-order artifact exists to hold it. The index half is worse than unmet: it is asserted as already-verified and **is false** (N-3). |
| 11 | Drop the `\|\| exit 0` lint mask (M-G) | **MET.** `functions/package.json:5` = `"eslint ."`; I ran the full-package lint myself — exit 0, zero findings. |
| 12 | Correct the packet | **NOT MET.** The five named claims are each corrected honestly and specifically in the map's "Packet corrections" block — that part is exactly what I asked for and it is the best packet this program has produced. But the same document introduces a **new** unsupported claim (the `grading_jobs` index, N-3, restated in-code at `reset.js:17`), and claims a **15_ §2 supersession that does not exist** (N-4) for the fold's most consequential semantic change. The condition was about the packet being auditable end-to-end, and it audited as 2 new defects. |

**Score: 8 MET / 4 NOT MET (2, 9, 10, 12).**

---

## 6. CLOSING CONDITIONS FOR r73 (complete — nothing held back)

1. **Reconcile the ordinal/positional `twi` split (N-1).** Either stamp an ordinal-consistent
   `newWordEndIndex` on the engine's new-test attempt, or teach `computeAnchorPosition`
   (`foundation.js:930-932`) / `safeValuesForDoc` (`:955-959`) the ordinal law, or reinstate a
   contiguity refusal. Record the chosen law as a **15_ §2 supersession**. Fixture: a list with a
   position gap, one full engine day, then `resolveListProgress` — assert the twi it writes back
   equals the twi the engine advanced to.
2. **Give `resetLockActive` the takeover window (N-2)** — the same `RESET_LOCK_TAKEOVER_MS` the
   reset's own fence uses — or publish the crashed-reset lockout as a CS-recoverable state in
   `SUPPORT_RUNBOOK.md` with the repair. Fixture: plant an 11-minute-old lock and assert the engine
   callables serve rather than return `reset_in_progress`.
3. **Sweep the real lists for duplicate and gapped positions (N-6)** before the rehearsal window, and
   rule on whether `list_words_malformed` should refuse the whole list or degrade. The
   `deleteWord`/`addWord` reindex bug (`db.js:600-614, 658-668`) needs its own card either way.
4. **Verify the `grading_jobs (uid,status)` query (N-3)** — add the composite index or prove zigzag
   merge serves it — and correct the two places that assert it is already verified
   (`reset.js:17-18`, the handoff's CC-14 block).
5. **Fixture the H-A interlock (condition 2)**: one student, `completeDay` then `completeSession` for
   the same day, and the reverse; assert `day_guard_rejected` both ways and assert exactly which of
   `recentSessions`/`stats`/`streakDays`/`interventionLevel`/`reviewMode` are frozen. Record the
   ruling in 15_ or in the deploy-order artifact — not only in a handoff.
6. **Fixture `queue_invalid` (condition 9)** — at minimum the non-canonical-path and
   pool-hash-mismatch legs of `callables.js:522-549`.
7. **Name one engine/legacy evidence discriminator (N-5)** and apply it to both halves of
   `completeDay`, or publish the asymmetry and its twi consequence.
8. **Land the CC-14 sizing note (condition 10)** in a durable artifact. If the deploy-order document
   does not exist yet, that document is the missing artifact.
9. **Sweep the packet again (condition 12)**: every "EXISTING", "live-verified", "supersession
   recorded in §X" claim must resolve to a file and a line. Two of the three I spot-checked this
   round did not.
10. **Minor:** add `lastStudyDate` to the view catch-up or state why it is omitted (L-1); fix the
    `callables.js:262-264` comment (L-2); align the receipt's `version` with the announced lap
    generation (L-3); fix the lap pace comment (L-4).

Items 1-3 must close before the dark-deploy order series opens — 1 and 3 because the 25WT rehearsal
runs the engine on real lists with real teacher-edit history, 2 because it is a defect in the deploy
order's own first step. Items 4-10 must close for the checkpoint but do not, on their own, hold the
deploy once 1-3 land.

---

## 7. Statement for the fold

The r71 NO said the engine was ready and the seam between the engine and the live system was not.
This fold fixed the specific seam I named — BL-A is dead, properly, with a supersession and a runbook
entry and a fixture — and then gated the whole reset rebuild behind a const so the dark deploy is
provably zero-delta. That is the right instinct and it was executed well. Eight of twelve conditions
closed cleanly, the receipt binds sixteen files and every hash verifies, and the lint mask is
genuinely gone.

But the seam is wider than one document. The M-A remedy changed what `twi` *means* inside the engine
without changing what it means to the live reconciler that overwrites it at every session entry, and
without publishing the change in the contracts doc where §2 would have caught it. The §9 lock got a
takeover law on the writer and not on the seven readers. And the packet-honesty condition — the one
condition whose whole purpose was to make the other eleven auditable — produced a corrected packet
that still contains a claim about a Firestore index that no file in this repository supports.

None of that is architecture. All of it is the same lesson at a smaller radius: **when this build
changes a meaning, the change has to reach every consumer of that meaning, and the packet has to say
where.** Two more rounds of that discipline and the deploy order can open.
