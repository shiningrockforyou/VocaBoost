# DEEPFIX2 · r74 STAGE-2 CHECKPOINT — Opus lane: VERIFYING THE r74 FOLD

> Reviewer: Opus lane. Scope: commit `e9e8ac4` (`58af1f1..e9e8ac4`, 22 files, 920/79).
> Duty: (1) adjudicate my own eleven r74 closing conditions (`panel_r73_opus.md` §6, incl. the minors
> line); (2) judge each of the three EXPLICIT DEFERRALS on its merits; (3) hunt NEW defects; (4) rule
> on the dark-deploy series; (5) David's calibration standing order.
> Method: full read of the r74 code diff (`composer.js`, `completion.js`, `config.js`, `callables.js`,
> `reset.js`), the full lap diff, `17_` in full, `15_` §2/§3b/§4, `NEED_TO_FIX`, the new
> `list-position-sweep.mjs`, the baton/change-log/README/RESUME deltas, and re-verification of the
> surfaces the fold *claims about* but did not touch (`foundation.js` `resetProgress` fence law
> 2079-2150, `completeSession` day-guard 1355-1377, `deriveThrottleModeServer`/
> `calculateInterventionLevel`, `monitoring.js` registry-cache TTL, `src/services/db.js`
> `addWord`/`deleteWord`/`addWordsBatch`, the client tree).
> **`npx eslint .` across `functions/`: exit 0.** `node --check` on all 14 engine/lap/sweep sources:
> 14/14 pass. Receipt re-verified BY VALUE: **16/16 `sourceShas` match the tree**, `version:3`,
> `total:201`, `failed:0`, `pass:true`. Static check-count of the lap: 172 textual `check(` − 1 (the
> occurrence inside `checkTrue`'s body, `:82`) = 171 direct sites, + 26 `checkTrue(` sites = 197
> sites; one site (`container ${label} ⇒ HOLD`) runs 5× in a loop ⇒ **197 − 1 + 5 = 201 exactly**.
> The same arithmetic reproduces r73's 182 from its source, so the method is calibrated.
> **The emulator was NOT run** (no Firestore emulator in this environment); the production sweep was
> NOT re-run (I cross-checked its *logic* against `db.js` instead — see N-13).

## VERDICT: **YES** — the checkpoint closes; the dark-deploy series proceeds per `17_`.

Ten of my eleven conditions are met, the three deferrals are all defensible and I accept all three,
and the process fix I demanded (a written ledger built from the FULL panel, with a separate verify
pass) is visible in the output: every item I named — including the ones the r72/r73 folds never
mentioned — is either closed with a file:line and a fixture, or deferred **by name, with a reason**.

This YES is **not** "no defects." Two findings ride with it, one of them a real behavioral defect in
new code (**N-12**), and both must land before the client integration or the 25WT rehearsal touches
new-test evidence. I am voting YES anyway, and I want to be explicit about why, because last round I
said a false claim in the governing artifact was disqualifying:

- **The deploy this authorizes is inert and stays inert.** `enabled:false`, `rehearsalClassIds:[]`,
  `RESET_V2_ENABLED=false`, `stampingEligible` false ⇒ `review_v2_dark` on every callable. Re-verified.
- **There is no caller.** `grep -rn "reviewV2" src/` returns **zero hits** — the client has no wiring
  to any engine callable. N-12 cannot be reached by any deployed path today; it arms only when the
  client integration lands or a rehearsal script feeds legacy evidence to `completeDay`.
- **N-12's failure mode is a loud typed refusal** (`no_evidence`), not silent corruption.

Last round's four unattempted conditions were a *process* failure that would have repeated. This
round's two findings are a scoping line and a wrong sentence in a card. That is a different animal,
and it does not warrant another full panel round (see §5).

---

## 1. MY ELEVEN CLOSING CONDITIONS — item by item

### Deploy-blocking (the three)

**1. N-2 — `resetLockActive` takeover window. ✅ MET.**
`composer.js:159-170` replaces the unconditional `Boolean(pmData?.resetInProgress)` with a liveness
predicate against `RESET_LOCK_TAKEOVER_MS = 10 * 60 * 1000` — the same constant and the same window
the writer fence already used (`foundation.js:2081, 2137-2140`). A crashed reset now stops locking a
student out of the engine permanently. The predicate propagates to all six read sites
(`composer.js:259`, `presentations.js:385`, `completion.js:268, 300`, `visits.js:61`,
`callables.js:115, 537`) because they share the import. Fixtured: `lap:315-321` plants an 11-minute-old
`{opId:"crashed"}` lock and asserts `composeDayQueue` returns `created|exists` — **"stale crashed lock:
engine SERVES."** Fail-closed on the degenerate shape: a lock whose `at` is missing or not a Timestamp
yields age `0` ⇒ live ⇒ refuse. Two lines, exactly as I scoped it.

**2. N-1 / condition 1 — publish-and-warn, done properly. ✅ MET (with deferral 1 accepted).**
The fold took the "publish and warn" ruling and then actually did the three things that make that
ruling honest:
- **The warn reaches the paths that cause it (L-7).** `callables.js:284-287` (ComposeNewTest — the
  callable that stamps the positional anchor at `:305-314 → :636-638`, i.e. the sole mechanism of the
  divergence), `:366-369` (ComposeRerun), `:741-744` (CompleteDay), and `:191-193` (ComposeSession).
  **All four are `emitOpsAwait`**, including ComposeSession's, which was the only fire-and-forget
  `list_words_malformed` emission left. My exact ask.
- **The 15_ §2 supersession is recorded** (`15_:52-56`): "ENGINE `twi` IS AN ORDINAL COUNT over the
  canonical word order… the legacy anchor reconciliation (`twi = nwei + 1`, CS runbook) remains
  positional — exact on contiguous lists only." `grep -i ordinal 15_` now returns a hit; last round it
  returned zero.
- **The end-to-end fixture is deferred, with an empirical reason.** Judged in §2.

**3. Duplicates (condition 3) — ruled, swept, carded. ✅ MET (the card's mechanism is wrong — N-13).**
- **Ruled:** `17_` §5 — "DUPLICATE positions KEEP refusing (`list_words_malformed`) — a duplicate
  breaks grading-key identity." Refuse-over-degrade, stated as a ruling with a reason. Accepted; it is
  the right call (a duplicate position makes the grading key ambiguous, and the engine's universe is a
  positional slice).
- **Swept:** `scripts/deepfix2/list-position-sweep.mjs` (NEW, 22 lines, read-only, `select("position")`,
  no uids, no writes). **RESULT filed in `17_` §5: 46 lists — 42 clean, 4 empty, ZERO duplicated, ZERO
  gapped.** I read the script line by line: its gap predicate (`:17`) is stricter than the name implies
  — it catches non-contiguity, a non-zero first position, *and* `pos.length !== words.size` (i.e. any
  missing or non-integer `position`), so it cannot under-report. This is the first empirical population
  measurement in the series and it is the right instrument.
- **Carded:** `NEED_TO_FIX.md` §"[2026-08-03, DEEPFIX2 r74/O3]". Present, dated, with a proposed fix
  and a pre-rehearsal action. **Its stated mechanism is factually wrong — see N-13.**

### Checkpoint-blocking (items 4-11)

**4. N-7 — `17_` §3. ✅ MET.** "and vice versa — fixtured" is **deleted**. The replacement (`17_` §3)
says the engine side is fixtured, the completeSession side is "the SAME transactional day-guard
(`foundation.js:1356-1364`) verified by code reading," and names the lap fixture as EXPLICITLY DEFERRED
with a reason and a target phase. I verified the citation resolves: `foundation.js:1355-1365` is the
transactional day-guard (`expectedDay = currentCsd + 1`; `dayNumber !== expectedDay ⇒
day_guard_rejected`, with an idempotency branch ahead of it). The freeze note is amended exactly as I
asked — "they are not display-only: `deriveThrottleModeServer` and the intervention derivation CONSUME
recentSessions" — and that resolves to `foundation.js:1373-1377`. Claim → file → line, all three.

**5. N-8 — discriminating `completedTwi` fixture. ✅ MET, and it genuinely discriminates.**
`lap:704-716`. I traced the arithmetic against the seeds rather than trusting the comment: CASE E seeds
`uE/cE` at `{csd:4, twi:40}`; the day-5 new presentation `npE2` carries 10 word ids, so
`wordsIntroduced = |presentedWordIds| = 10` (`completion.js:590-591`) and
`completedTwi = min(40+10, 60) = 50` (`:629`). The loser view is then seeded **divergent** at
`{csd:4, twi:45}`, and the check asserts the written `totalWordsIntroduced` equals `done5.completedTwi`
(read from the record, not hard-coded). The additive law would write `min(45+10,60) = 55`. **50 ≠ 55**
— the fixture fails under the old implementation. That is exactly what Codex's C1.1 and my N-8 asked
for, and the guard `checkTrue("day-5 record carries completedTwi + wordsIntroduced>0")` keeps it from
silently degenerating into an autopass day.

**6. N-11 — 15_ §3b field list. ✅ MET.** `15_:137-142` adds `wordsIntroduced`, `completedTwi`,
`postureSource`, `legacyEvidence`, and `twiHeld`, each with its derivation law and the legacy fallback.
I checked the list against what `completion.js:618-633` actually writes: all five present, no drift
left. The R2-51 law's input is now in the frozen schema that governs it.

**7. N-9 — the ≤60s `windowRunId` skew. ✅ MET (by publication, which is the option I offered).**
`17_` §7 publishes the skew as fail-closed ("their rows quarantine — never misclassified") plus a
PROCEDURE: "after writing `shadow_registry/window`, WAIT > the 60s TTL before starting batteries; same
on teardown." I verified this actually closes it: `monitoring.js:61` `REGISTRY_REREAD_TTL_MS = 60000`
and `:106-112` re-read the whole registry (including the window doc's `runId`, `:93-97`) once the TTL
expires — so a >60s wait drains every warm instance's stale `windowRunId` before the first battery row
is written. The procedure is sufficient, not merely a disclaimer.

**8. N-10 — scope the new-test r48 fence to the engine leg, or publish the legacy refusal. ❌ NOT MET
— and it regressed.** The fold chose to *publish* (`17_` §6) — but what it published is an **exemption
the code does not implement**, and the code got stricter, not looser. **This is N-12 below.**

**9. Condition 7 / N-5 — one evidence discriminator. ✅ MET.**
`completion.js:360-369`: `consumedIsEngine = consumed.resetEpoch !== undefined && !== null`, and an
epoch-carrying consumed attempt without a `presentationId` now returns
`no_evidence / "engine review attempt lacks presentation"`. That makes `resetEpoch` the **single**
discriminator on both halves (the new-test half already branched on it at `:431`), replacing the old
`presentationId`-vs-`resetEpoch` asymmetry I flagged. Fixtured at `lap:557-561` ("engine review without
presentation refused") with the exact reason string asserted. The downstream consequence is coherent:
`completion.js:410-412`'s `else { legacyEvidence = true }` is now reachable only for epoch-less
attempts, which were already flagged legacy at `:341-343`. After a full round unaddressed, this is
closed properly.

**10. Condition 6 — the two queue legs I named. ✅ MET.**
`lap:562-576`, both **through the wrapped `reviewV2SubmitAttempt` callable**, both asserting the exact
typed reason: `["queue_invalid", "non-canonical queueRef"]` (`callables.js:581-583`) and
`["queue_invalid", "pool-hash mismatch"]` (`:591-593`). The remaining three legs (queue missing,
identity mismatch, presented-subset, threshold bounds) are still unfixtured — but I named these two as
the minimum and they are the two that matter (path forgery and content substitution).

**11. Minors — ✅ MET (L-6 partially).**
- **L-1** `completion.js:282` adds `lastStudyDate: Timestamp.fromMillis(nowMs)` to the catch-up. I
  verified this is genuine winner parity: the winner's advance writes it at `:644`.
- **L-4** `lap:841` — the false `pace = ceil(50/5) = 10` comment is replaced with the ordinal wording.
- **L-5** `presentation_invalid` is now fixtured (`lap:962-970`, "fingerprint-less presentation
  refused", through `submit`).
- **L-6** `callables.js:544-548` derives `isRerunTxn`/`isNewSessionTxn`/`isReviewTypeTxn` from the
  **in-txn** `p`, and all eleven downstream uses were converted (`:564, 569, 604, 627, 629, 631, 635,
  658, 662, 663, 674`). **Partial:** `:571` still passes `pres.classId`/`pres.listId` (the pre-txn read)
  into `readProgressTruthInTxn`. See N-15 — trivial, but it is the same class of mixing the fix was
  about. The fold's change-log note that this exposed "a real ReferenceError on first run" is a good
  sign: the hoist was verified by execution, not by eye.
- **L-8** `lap:928-934` replaces `setTimeout(700)` with a bounded 20×150ms poll on the actual query.
- **L-9** `lap:913-915` — the orphaned continuation lines now sit under a restored lead comment.
- **L-10** `reset.js:16-19` — "an EXISTING top-level pipeline leg" is gone, replaced with "ADDED to
  firestore.indexes.json at r73 (it did NOT pre-exist; 17_ orders its deploy before any RESET_V2 flip)."
  The in-code false claim my r72 condition 4 named is finally dead.
- **L-11** `docs/README.md:15` links `17_`.

### Also verified (Codex's r73 remainder, since the fold answered it in the same commit)

- **C3a — plain-map container.** `config.js:135-142`: `isPlainMap` requires
  `Object.getPrototypeOf(v) === Object.prototype || null`. Codex's `Timestamp`/`GeoPoint` probes now
  HOLD, as do `DocumentReference` and Firestore bytes, by the same rule. Five container fixtures +
  a plain-map-serves fixture in CASE A (`lap:194-204`).
- **C8a — the race through the PUBLIC boundary.** `callables.js:55-65` `_testHooks.afterPreflight`,
  gated on `process.env.FIRESTORE_EMULATOR_HOST` **at call time** and one-shot (nulled before invoke).
  Inert in production by construction, and — I checked — **`functions/index.js:2200-2207` re-exports
  only the seven callables**, so `_testHooks` never reaches the deploy surface. The fixture
  (`lap:940-947`) un-enrolls `uX` mid-call and asserts `r.status === "not_enrolled"` as **data** — the
  preflight path throws `HttpsError("permission-denied")` instead, so this assertion can only be
  satisfied by the txn-level `assertServableInTxn`. It is genuinely discriminating. This closes the C8
  gap that survived r72 and r73.
- **C8b** — stale unclaimed live-new replay and the submit-txn frontier bind, both `day_guard_rejected`
  with `expectedDay: 5` (`lap:948-960`).
- **C1a** — engine new-test posture missing and malformed, both fixtured (`lap:545-556`). Correct for
  the engine leg; the problem is the leg it also catches (N-12).

**Score: 10 MET / 1 NOT MET (item 8 / N-10, regressed). All three deferrals accepted.**

---

## 2. THE THREE EXPLICIT DEFERRALS — judged on their merits

**Deferral 1 — the end-to-end gapped-day fixture (gapped list → engine day → `resolveListProgress`).
Reason given: "the sweep proves the hazard population is empty in production; the loader-level fixture
+ the warn stand." → ACCEPT, with a rehearsal-phase condition.**

The reason is real evidence, not a rhetorical move: the sweep is a genuine read-only measurement of the
whole `lists` collection and it came back **0 gapped / 0 duplicated across 46 lists**. That is a much
stronger answer than a fixture would have been for the *risk* question.

But it is a *population* argument, and the fixture was about *semantics* — whether an engine day on a
gapped list writes back a `twi` the legacy CS anchor law can still read. The population is not
statically empty: `deleteWord` leaves a gap and never renumbers (N-13), so a single teacher deletion
creates one, and the reindex bug is carded but unfixed. What makes the deferral acceptable **now** is
the surrounding belt: duplicates refuse outright, every canonical load emits an awaited `positionGap`
warning to `ops_metrics`, the supersession is published, and the population is measured at zero.

*Condition I attach:* re-run the sweep immediately before 26SM meets the engine, and treat a
`list_words_malformed` / `positionGap` emission during 25WT as a stop-and-fixture trigger. Both are
already implied by `17_` §5's "the read-only position sweep runs pre-rehearsal"; I am asking that the
*post*-rehearsal re-run be explicit too.

**Deferral 2 — the completeSession-side interlock fixture, deferred to 25WT. Reason: "the callable is
live-flagged and its flow needs a full legacy session context (`17_` §3 states why)." → ACCEPT,
without conditions.**

My N-7 objection was never "build this fixture"; it was "`17_` claims it is fixtured and it is not."
That claim is deleted and replaced with an honest statement of method (code reading), a named reason,
and a named target phase. I then did the code reading myself and it holds: `foundation.js:1355-1365`
is the same transactional day-guard, and it does refuse a day the engine already advanced. The 25WT
rehearsal will exercise it with real legacy session flow, which is *better* evidence than a synthetic
fixture that would have had to fake half the context. This is the right call, correctly disclosed.

**Deferral 3 — the baton `wslNote` refresh, "applied at THIS flip." → ACCEPT (verified applied).**
Not really a deferral. `baton.json` `wslNote` now reads "R2-51 RATIFIED (David 2026-08-03, receipts in
15_ §3b); RESET_V2 flip = the rehearsal phase per David" — Codex's packet-consistency item is closed,
and `claudeStatus` explicitly notes it supersedes the PROPOSED wording. Revision 220, round 74, handoff
and readyMarker paths both correct.

---

## 3. NEW DEFECTS

### N-12 — HIGH — the C1a posture fence is **not** scoped to the engine leg; it refuses every LEGACY new-test attempt, and `17_` §6 publishes the opposite

`completion.js:471-481`:

```js
// [r74 C1a] the ENGINE leg (epoch-carrying — this branch) REQUIRES a
// COMPLETE valid gatePosture; … The legacy (epoch-less) leg is published-exempt in 17_ [N-10].
const ntGp = newTest.gatePosture;
const ntPostureValid = ntGp && typeof ntGp.effectiveEnabled === "boolean" && …;
if (!ntPostureValid) {
  return {status: "no_evidence", reason: "impossible_record (new-test posture missing/malformed)"};
}
```

The comment says "this branch." **It is not in that branch.** The `resetEpoch` discriminator block
opens at `:431` and closes at `:455-457` (`} else { legacyEvidence = true; }`). Lines 461-484 sit one
indent level out, in the body of `if (newTestAttemptId !== null)` — they govern **both** legs. The
epoch-less path reaches `:479` and returns `no_evidence`.

And legacy new-test attempts have no `gatePosture`, universally:
`grep -rn "gatePosture" src/ functions/ | grep -v functions/reviewV2` → **zero hits**. Only
`callables.js:646-651` (the engine submit) ever writes one. `15_` §4 itself frames the field as
"stamped going forward," the same wording it uses for `resetEpoch`.

So the code now says: *an epoch-less new-test attempt is always an impossible record.* Meanwhile
`17_` §6 — the durable deploy artifact, written this round to satisfy this very item — says:

> "legacy (epoch-less) legs keep the published boundary rules (rows/score validity still enforced;
> **posture/presentation requirements exempt** — they predate the engine)."

Presentation is exempt (that check is correctly inside the branch, `:438-440`). Posture is not. Half
the published rule is false.

**Failure scenario.** Flip week, `stampingEligible` true. A student takes the new test on the legacy
client (attempt has `score`, `answers`, `totalQuestions`, no `resetEpoch`, no `gatePosture`) and the
day is completed through `reviewV2CompleteDay` with that attempt as `newTestAttemptId`. r73 accepted it
(`ntGp && …` was false ⇒ the threshold check was skipped) and advanced `twi` via the legacy range at
`completion.js:592-595`. r74 returns `no_evidence` and the day never completes. The student is stuck
until the attempt is hand-repaired.

**Corroborating evidence that this is unintended, not a design change:**
1. `completion.js:592-595` still contains the legacy `wordsIntroduced` derivation
   (`newWordEndIndex − newWordStartIndex + 1`) for exactly this case. The fence at `:479` makes that
   branch **dead code** for any attempt without a posture — i.e. for every legacy attempt.
2. The consumed half handles the identical situation the opposite way: `:503-513` demotes an incomplete
   posture to `postureSource: "completion_legacy"` rather than refusing. The two halves now disagree
   about what a missing posture means.
3. `seedAttempt` (`lap:138-151`) **always** writes `resetEpoch: epoch` (default 0) and **always**
   writes a complete `gatePosture`. There is not one epoch-less attempt anywhere in the 201 checks —
   which is precisely why this shipped green (N-14).

**Severity and why it is not a YES-blocker.** No deployed path can reach it: `grep -rn "reviewV2" src/`
returns zero — the client has no wiring to any engine callable, so nothing can hand `completeDay` a
legacy attempt today, and the dark posture refuses the callables anyway. When it does arm, it produces
a typed refusal, not corruption.

**Close it by:** hoisting the fence into the epoch branch (or gating it on the same
`newTest.resetEpoch != null` predicate the presentation check uses) — one line — and, if the intent is
instead that legacy new-test evidence be refused, then say *that* in `17_` §6 and delete the dead
legacy `wordsIntroduced` branch. Either way, add one epoch-less attempt to the lap.

### N-13 — MEDIUM — the reindex card and `17_` §5 both state a mechanism that does not exist in `db.js`

`NEED_TO_FIX.md` (new card) and `17_` §5 both say:

> "`deleteWord` **renumbers** the remaining words' `position`s, but `addWord` appends at `count`"
> / "db.js deleteWord **renumbers**, addWord appends at count"

`src/services/db.js:658-668` is the whole of `deleteWord`:

```js
await deleteDoc(doc(db, 'lists', listId, 'words', wordId))
await updateDoc(doc(db, 'lists', listId), {
  wordCount: increment(-1), updatedAt: serverTimestamp(),
})
```

It deletes and decrements. **It does not renumber anything** — there is no reindex/renumber code
anywhere in `src/` or `functions/`. The real mechanism is the other one: a delete leaves a **gap**
(`0..n-1` minus the removed position) *and* decrements `wordCount`; the next `addWord` then writes
`position: currentCount` (`:601, :614`) — now `n-1` — colliding with the word already at `n-1`. Same
outcome (a duplicate), completely different cause.

This matters for three reasons, which is why it is MEDIUM and not a nit:
1. **The card's own proposed fix is half a no-op.** "make `addWord` allocate `max(position)+1`, and/or
   make `deleteWord` **not renumber**" — the second clause asks for behaviour that already exists.
   Whoever picks this card up will look for the renumbering loop and not find it.
2. **It hides a second failure mode.** Under the stated (false) mechanism, a plain delete is safe
   because everything is renumbered. Under the actual code, a plain delete with no subsequent add
   leaves a **permanent gap** — the exact N-1 condition `17_` §5's warn-and-serve rule governs. The
   card implies deletes are only dangerous in combination with an add; they are not.
3. It is a factual error in the artifact created *this round* to be durable, in the same
   NEED_TO_FIX/`17_` pair, on the same item. Fifth consecutive round in which a spot-check of a packet
   claim found one that does not resolve to the code — though this is by a wide margin the least
   consequential instance of it, and the *ruling* it accompanies (refuse on duplicates) is right.

`addWordsBatch` (`:709-711, :744`) has the same shape (`nextPosition = wordCount`, then `++`), so a
bulk import after a delete mints a whole run of duplicates. Worth a sentence in the card.

**Close it by:** correcting both sentences to "`deleteWord` deletes without reindexing and decrements
`wordCount`; `addWord`/`addWordsBatch` allocate from `wordCount` — so a delete leaves a gap and the
next add collides," and dropping the no-op half of the proposed fix.

### N-14 — LOW — the published legacy leg has **zero** coverage in the lap

`seedAttempt` (`lap:138-151`) unconditionally stamps `resetEpoch` and a complete `gatePosture`, and
nothing else in the lap creates an attempt document. So of the 201 checks, **none** exercises an
epoch-less attempt. `17_` §6 now publishes a two-legged evidence fence; the lap tests one leg. This is
the mechanism by which N-12 shipped green, and it is the same "green over untested code" shape I have
now flagged in r71 (H-C), r72 (`queue_invalid`) and r73 (`presentation_invalid`) — each time on the
leg that was newest. One `seedAttempt(… , {epoch: null})` variant plus two checks (legacy new-test
serves; legacy consumed demotes to `completion_legacy`) would close it.

### N-15 — LOW — `resetLockActive`'s missing-`at` default is the inverse of the writer's, undocumented

`composer.js:168` treats a lock with no parsable `at` as age `0` ⇒ **live** ⇒ readers refuse forever.
`foundation.js:2137` treats the same lock as `Infinity` ⇒ **stale** ⇒ the next reset takes it over.
The pair is complementary and safe by accident (readers fail closed, the writer repairs), but it is the
one shape that reinstates exactly the permanent lockout N-2 just removed, and nothing says so. In
practice unreachable — the only lock writer (`foundation.js:2145`) always stamps `at: Timestamp.now()`,
and the legacy reset path writes no lock at all — so this is a comment, not a code change: note in
`composer.js:159-165` that a malformed lock is deliberately treated as live and is cleared only by the
next reset op's takeover.

### N-16 — LOW — `L-6` residual: the truth read still keys off the pre-txn snapshot

`callables.js:571`: `readProgressTruthInTxn(txn, db, {uid, classId: pres.classId, listId: pres.listId})`
— `pres` is the preflight read; `p` is the in-txn snapshot two lines above. Presentation records are
immutable in `classId`/`listId` (nothing writes them post-create), so this cannot currently diverge,
but it is the same mixing the L-6 fix was about and it is a one-word change to `p.classId`/`p.listId`.

### N-17 — INFORMATIONAL — the parent `assignments` container is still unvalidated (unchanged code)

`config.js:129`: `(classSnap.data().assignments || {})[listId]`. If `assignments` itself is a Timestamp,
a scalar, or an array, the index yields `undefined` ⇒ `asg = null` ⇒ `readStatus: "ok"` with
`assignmentExists: false`. For uid-carrying resolves that is **fail-closed** — `assertServableInTxn`
returns `list_not_assigned` (`config.js:258`) and the preflight throws (`callables.js:98`) — so
Codex's "and the parent `assignments` map" concern is functionally answered even though the container
is not type-checked. The one uid-less resolve (`completion.js:245`, source-class posture only) would
fall to defaults instead of holding; authorization binds on the serving class, so the blast radius is a
default threshold on cross-class evidence. Pre-existing, not touched this round, and I am recording it
as informational rather than as a finding — see §5.

---

## 4. THE PROCESS FIX — it worked, and the evidence is checkable

I demanded that the fold run from a written ledger built from the FULL panel, because r72 and r73 both
folded from truncated summaries and lost items (N-2 and N-5 each survived a full round *unmentioned*).
The r74 handoff opens with the ledger path and the change-log row enumerates every item with its
disposition. The checkable consequences:

- **Nothing is silently dropped.** All eleven of my items appear by name in the handoff, the change
  log, or `17_` — including the three deferrals, each with a reason. Last round three conditions were
  invisible; this round zero are.
- **The deferrals are the strongest signal.** "DEFERRED — the sweep proves the hazard population is
  empty" is a claim I can attack. "Not mentioned" is not. This is the packet rule working as intended.
- **The verify pass caught a real bug.** The change log records that L-6's hoist produced "a real
  ReferenceError on first run." A fold that runs its own code finds that; a fold that eyeballs a diff
  does not.
- **The receipt is honest.** 16/16 by value, and the static check-count reproduces 201 exactly by an
  arithmetic that also reproduces r73's 182 from r73's source. I did not run the emulator and I am not
  treating 201/201 as executed evidence — but every structural property I *can* check from outside is
  consistent.

The one thing the process did not catch is N-12, and it is worth naming why: the ledger row was "C1
new-test posture REQUIRED + validated **for engine legs**." The implementation satisfied the
"REQUIRED + validated" half and dropped the "for engine legs" half, and the verify pass checked the
row against a fixture that only ever seeds engine attempts. A ledger verifies what it says; it does not
verify the negative case unless a row demands one. **Suggested amendment: for any row that narrows a
rule to one leg, the ledger requires a fixture on the *other* leg.** That single rule would have caught
N-12, N-14, and r71's H-C.

---

## 5. CALIBRATION (David's standing order)

**Classification of my own findings this round:**

| Finding | Class |
|---|---|
| N-12 (legacy posture refusal) | **New-code defect** — introduced by the r74 diff, contradicting the r74 doc |
| N-13 (deleteWord "renumbers") | **New-doc defect** — a factual error in an artifact written this round |
| N-14 (no legacy fixture) | **Incomplete fold** — the evidence gap that let N-12 ship green |
| N-15 (missing-`at` divergence) | **New-code nit** — unreachable; a comment, not a change |
| N-16 (L-6 residual) | **Incomplete fold** — one word |
| N-17 (parent container) | **Late catch on unchanged code** — pre-existing, fail-closed, informational |

One genuine new-code defect, one genuine doc defect, one evidence gap that explains the first, and
three items that are notes. Compare r73: three conditions never attempted, a false "fixtured" claim in
the governing artifact, and five partials.

**Would another round catch meaningful problems? No — it would be over-auditing.**

The remaining work is a one-line hoist in `completion.js`, two corrected sentences in
`NEED_TO_FIX`/`17_` §5, one `seedAttempt` variant with two checks, and two comment/word changes. None
of it needs a panel to find (it is written above with file:line), none of it needs Codex to
adjudicate, and none of it is reachable by any deployed path. Spending a full convergence round —
panel + Codex + fold + lap + flip — on that is the definition of over-auditing, and it would burn a
round while the *actual* next source of information sits unexercised: the 25WT rehearsal, which will
tell us more about the H-A interlock, the RESET_V2 fence, and the legacy/engine boundary in one day
than three more static rounds would.

The honest read of the curve: r70-r72 were finding authority defects (fail-opens, unbound evidence,
races). r73 was finding process defects (unattempted conditions, unresolvable claims). r74 is finding
scoping slips and wrong sentences. The class of finding has degraded twice in a row while the fold
quality has improved — that is convergence, and the correct response is to close the checkpoint and
let the rehearsal generate the next real signal.

**What I ask instead of a round:** carry N-12 and N-13 as named corrections on the *next* flip
(whichever WinClaude order carries the rehearsal prep), with no review cycle attached. Verify them by
diff. If N-12 is not fixed before a client integration or a rehearsal script feeds legacy evidence to
`completeDay`, that is a stop.

---

## 6. Statement for the fold

This is the fold I asked for. Every item on my list is answered by name, the three I could not have
expected to be closed are deferred **with reasons I can argue with**, and two of them I accept without
reservation. The takeover window is two lines and a fixture that proves a crashed reset no longer
locks a student out. The discriminator is one field on both halves, and it refuses an epoch-carrying
attempt with no presentation. The catch-up fixture now fails under the old implementation — I checked
the arithmetic (50 vs 55), not the comment. The authority race finally runs through the wrapped
callable, and the assertion it makes (`not_enrolled` as *data*) can only be satisfied by the txn check,
not the preflight. And someone actually went and measured the production lists instead of reasoning
about them: 46 lists, zero gapped, zero duplicated.

Two things ride out with it. `17_` §6 says legacy legs are exempt from the posture requirement and
`completion.js:479` refuses them — the comment three lines above it says "this branch" about code that
is not in that branch. And the reindex card describes a `deleteWord` that renumbers, which `db.js` has
never done. Neither is reachable today; both are one-line corrections; both should land on the next
flip without a review cycle.

I said last round I expected to vote YES on a much shorter review. This is that review. **YES.**
