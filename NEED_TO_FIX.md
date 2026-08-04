# Need to Fix — running list of things to actually fix

Real problems surfaced by support tickets, audits, and live use that warrant a code/product fix
(distinct from `scripts/cs/nice-to-haves.md`, which is non-urgent guardrails/UX polish). Newest
items at the top. When one is picked up, link the PR/commit and move it to "Done" at the bottom.

Format per item: **what's broken → why it happens (root cause) → impact → fix direction → effort/risk.**

---

## 22. A classmate can PERMANENTLY BLOCK another student's engine test by squatting the ATTEMPT id · rules/backend · **PRE-FLIP BLOCKER** (found 2026-08-03 by the rv2-collision independent audit, finding F6)

**The twin of card 19, on the other leg.** Card 19 is the `grading_jobs` denial; this is the same shape on
`attempts`. Neither was introduced by the rv2-docid-collision fold, and neither is closed by it.

**The path, verified against the DEPLOYED ruleset:**
1. Attempt CREATE requires only `studentId == request.auth.uid`, no engine keys, and an id not matching
   `manual` (`firestore.live.rules:301-312`). So **any authenticated user may create**
   `attempts/rv2_{victimUid}_{presentationId}` **stamped with their OWN studentId** — nothing about the
   document NAME is checked against the caller.
2. The victim's engine submit then finds that document, and `isEngineAttemptFor` correctly refuses it
   (`callables.js:623-625` ⇒ `presentation_invalid`) because `stored.studentId !== uid`.
3. DELETE requires `resource.data.studentId == request.auth.uid` (`firestore.live.rules:394-396`), so
   **only the squatter can remove it.** The victim is blocked at that `presentationId` permanently.

**The uncomfortable part:** step 2 is the A4 replay-provenance guard shipped by the typed-fix-audit fold.
It is doing exactly the right thing — failing closed rather than serving the victim a stranger's document —
but that converts a would-be data leak into a denial. Fail-closed is correct; it is not free.

**Reachability** is the same as card 19: uids enumerate from `classes.studentIds` (readable by any
authenticated user) and `presentationId` is `{classId}_{listId}_d{day}_e{epoch}_p{seq}` with a small,
predictable seq. Recomposing yields `_p2`, which a squatter can follow.

**Not live today** — the engine is dark, so no student's submit reaches step 2. **Live at the flip.**

**Fix direction (with card 19 — they should be decided together):** the real defect is that a *global*
collection accepts client creates at server-derived names. Options: deny client creates matching the
`rv2_` prefix in rules (cheap, rules-only, and the prefix is already server-reserved by convention);
or require the docId to bind to the caller (rules cannot parse ids, so this means a different id scheme);
or move attempts to a uid-scoped subcollection (the DF2-46 direction, far larger).

**Rehearsal note:** the collision fix removed the *accidental* collisions that would have surfaced this
class of failure during 25WT. The rehearsal must therefore test squatting **deliberately** — it will no
longer happen by itself.

---

## 25. TWO STREAK AUTHORITIES — the server writes one, the dashboard computes another, nothing connects them · dashboard/engine · **SURFACES AT THE FLIP** (found 2026-08-04)

**What's exposed.** The engine already writes a server-side streak credit at day completion —
`functions/reviewV2/completion.js:679`, `users/{uid}/streak_credits/{kstDate}` — under the frozen R2-21
semantics: KST calendar basis, AT MOST one credit per date regardless of multi-advance/class/device,
weekends skipped in gap computation, epoch-scoped, computed inside the day-advance transaction.

Meanwhile the dashboard computes its **own** streak client-side: `calculateStreak`
(`src/pages/Dashboard.jsx:37-123`) with its own weekend-skip logic, consumed at `:1399` as
`progress.streakDays ?? calculateStreak(...)`.

**`grep -rn "streak_credits" src/` returns NOTHING.** The client has never read the server's credit.

**Why it matters at the flip.** Two independent authorities computing the same user-visible number, with
different inputs (the client reads `recentSessions`; the server reads its own credit ledger) and different
rules (the client takes `studyDaysPerWeek`; the server is fixed KST + weekend-skip). They can disagree,
and **the student sees the client's**. This is exactly the "two-done-authorities" class DF2-33 exists to
close, and DF2-33 is not started.

**Why it is not in the cutover folds.** cutover-a/b/c/d re-wire the SESSION (compose → submit → complete).
None of them touches the dashboard, which is a different surface reading different documents. After all
four land, the dashboard would still be showing a client-computed streak while the server writes its own.

**Fix direction.** Read the server credit when the engine owns the day, keeping the client calculation as
the flag-off path — the same shape as every other cutover leg. Sequenced after `cutover-c-complete`,
because the credit only exists once completion runs server-side.

**Tracking note, and the reason this was invisible.** Dashboard work is split across THREE places that
never reference each other: DF2-33 (one-affordance), DF2-10 leg 9 (the streak is server-computed), and
DF2-51 ("Dashboard surface = DF2-51's leg"). It had **no work-queue row at all** and was in no fold's
scope — so it was not late, it was simply unsequenced.

---

## 24. BEHAVIOURAL CHANGE AT THE FLIP: today's failed NEW words no longer enter today's REVIEW · review-v2 engine · **NOT A DEFECT — but it must not be discovered during the rehearsal** (found 2026-08-04, cutover-a-compose)

**Today (legacy).** `buildReviewQueue` takes `todaysNewFailed` as an explicit input and
`selectReviewQueue` pushes those words to the FRONT of the review queue as Priority 1
(`studyAlgorithm.js:289-290`). Fail a new word this morning, review it this afternoon.

**After the flip (engine).** The review universe is canonical positions `< twi`, and `progress.js:20-23`
states plainly that twi counts words introduced through the **COMPLETED** days and is **"STABLE all day
(twi advances only at day completion), so review-first composes identically before/after the day's new
test."** Today's new words are therefore OUTSIDE today's review universe **by design**. A word failed in
today's new test is stamped, and surfaces via `needsPriority` in a LATER day's rotation — not today's.

**So this is a deliberate design property, not an omission** — today's failure becomes tomorrow's
priority. But it IS a visible change in what a student is asked to review, and nobody had written it down.

**Why it is carded rather than fixed.** It follows from the engine's frontier model. "Fixing" it would
mean pulling uncompleted-day words into the review universe, which contradicts the twi definition the
whole completion/graduation chain rests on.

**What it obliges:**
1. **The 25WT rehearsal spec must list this as an EXPECTED difference**, or the first observer reports it
   as a bug — and a real bug hiding behind an expected one is the worst outcome.
2. Any messaging that implies "you'll review what you got wrong today" needs checking (DF2-07 scope).

**Corrects my own analysis.** The cutover-a ledger's V2 row reasoned that composing the review session
lazily (at review-phase entry) would let today's failures be prioritised. The lazy decision **stands and
dominates** — it is still right for every other reason — but that specific mechanism was WRONG: under the
engine those words are not eligible today regardless of compose timing. The live client can advance twi
mid-day via entry-time anchor reconciliation (`progressService.js:187`, `twi = newWordEndIndex + 1`),
which is the only path that changes this, and it is a legacy reconciliation behaviour rather than an
engine one.

---

## 23. The LEGACY `gradeTypedTest` consumes a cached grade with NO acceptance test — the twin of the hole the engine just closed · backend · (found 2026-08-04 by the rv2-refusal-status independent audit, Q2)

**What's exposed.** `functions/index.js:1052` takes the `return_cached` branch of
`claimOrRecoverGradingJob` and returns that payload to the caller **without any acceptance test at all** —
no engine-provenance check, no presentation binding, no answer-sheet binding. The engine's typed leg had
exactly this shape until the typed-fix-audit fold added `usableCachedResults`; the LEGACY path never got
the fix.

**Why it matters.** The grading-job key on that path is client-supplied (`index.js:1048-1051`, the
`gradejob-namespace` card), so the same pre-seeding that the engine now refuses is still accepted here —
the permanent condition reaches that client as an ACCEPTED GRADE rather than a refusal.

**Scope and honesty.** This is the LIVE path 947 students use today, and it is PRE-EXISTING — neither
introduced nor worsened by any fold in this program. I have NOT assessed exploitability end-to-end: the
legacy client also carries a `gradeToken` binding leg that the engine deliberately does not mint, and that
may or may not fence the same case. **That assessment is the first task if this is picked up** — do not
assume the engine's finding transfers without re-deriving it on this path.

**Relationship to the other cards.** Same root as 19 (`gradejob-namespace`): a client-nameable key into a
server-trusted cache. If 19 is fixed by reserving the key namespace at the source, this may close with it —
which is an argument for doing 19 at the source rather than only consumer-side.

---

## 21. ~~`grading_in_progress` is returned for a PERMANENT condition~~ **FIXED 2026-08-04** · client contract · (was: BLOCKS DF2-51; found by the typed-fix-audit independent audit, F3)

**The contradiction.** `src/services/reviewV2Client.js:55-70` freezes `GRADING_IN_PROGRESS` as
*"Retryable, zero writes — the caller polls, it does NOT re-submit with a new composeKey"*. That is
correct for what the status was invented for: a genuinely concurrent worker holding a live 180s lease,
which resolves on its own.

The typed-fix-audit fold then reused the SAME status for a condition that **never resolves**: a cached
grading-job payload that fails provenance / presentation / answer-sheet binding
(`functions/reviewV2/typedGrading.js` `usableCachedResults`). A job in `status: graded` does not
self-clear, so the refusal is permanent. **A client that obeys the frozen contract polls forever.**
The lap's own recovery fixture (`engine-emulator-lap.mjs:1517-1520`) exercises the recompose that the
contract tells the client not to do — so the code and the published contract disagree today.

**Not a live bug.** No client consumer of the status exists yet (grep: only the definition), and the
engine is dark. It is a **prerequisite for `df2-51-client`**: shipping the cutover against the current
contract would build a poll-forever path for a real student.

**FIXED 2026-08-04 — `grade_unusable` shipped.** The permanent condition now returns its own DATA
status meaning *recompose ONCE, do not poll*, at exactly the two sites where a cached grading-job
payload is refused: `typedGrading.js:299` (the `return_cached` path) and `:343` (its `already_graded`
sibling). The three TRANSIENT sites are untouched and still return `grading_in_progress`:
`typedGrading.js:279` (a live lease), `:350` (persist established no authority), `callables.js:655`
(a concurrent submit). Client side: `GRADE_UNUSABLE` is in the frozen RV2 list with each status naming
the other as its inverse, plus an `isGradeUnusable()` predicate mirroring `isGradingInProgress()`.

**EVIDENCE:** engine lap **453/453** green (was 445) · **11/11** typed-seam mutants killed (was 9).
Two new mutants prove the split in BOTH directions, which a single mutant cannot: reverting the
permanent sites dies on 15 assertions — 13 pinning one seam and S1/S3 independently pinning the
`already_graded` sibling, so a one-seam revert cannot hide behind the other's coverage — and returning
the new status from a transient site dies on exactly the two keep-controls.

**A CENSUS ERROR WORTH KEEPING:** the fold ledger's verify row claimed six lap assertions needed
flipping. There were TWELVE, and two of the missing six (S1, S3) were the ONLY coverage of the
`already_graded` site. Same blind spot as the sibling-seam finding a day earlier: enumerate the obvious
site, undercount its twin. A hand-typed census of fixture sites is a claim that should be derived.

**STILL OWED (carded, not this fold):** the CLIENT handling — recompose exactly once on
`grade_unusable`, never in a loop — belongs to `df2-51b-submit`. This fold shipped the SERVER contract
and its fixtures only.

**The decision, kept for the record:** OPTION 1 — a DISTINCT DATA status, not a discriminator field.

Why option 1 and not the discriminator field: one status that means two opposite things ("keep polling"
vs "stop polling") is precisely the ambiguity that produces the poll-forever bug. The two conditions are
genuinely different and deserve different names. The usual objection — that adding to a versioned frozen
list breaks old clients — **does not apply here**: the engine is dark, `REVIEW_V2_CLIENT=false`, and a grep
finds no consumer of these statuses anywhere except the definition. There is no old client. The FIRST
client to read them is the DF2-51 cutover, so this is the one moment the list can be changed for free.

**CORRECTED by the independent audit (F3): recompose is NOT the card-19 recovery path.** A student
blocked by a classmate's pre-claim gets a THROWN `permission-denied` (`index.js:936-938`), never a data
status — the lap asserts exactly that. So a DF2-51 author who implements "recompose when
`isGradeUnusable`" leaves the card-19 victim stranded: that contract lives in the THROW, not the status.
What `grade_unusable` does fix is the poisoned/foreign-cache case, where the student genuinely does see
the status. Recompose also is not the only recovery there — for a loser-sheet race, resubmitting the
ORIGINAL sheet lands from cache with zero grader calls. **Original claim, kept as the error**: a
grading job stamped with someone else's uid can never be re-claimed, and clients cannot delete it. A
status that tells the client to keep polling would strand that student permanently.

**Implementation belongs with DF2-51**, with a fixture for BOTH legs: the transient case still polls, the
permanent case recomposes exactly once.

**Options as originally carded, kept for the record:**
1. A distinct DATA status for the permanent case (e.g. `grade_unusable`) meaning *recompose, do not
   poll* — costs one entry in the frozen RV2 list, which is a versioned client contract.
2. Keep one status but carry a discriminator field (`retryable: true|false`) the client switches on.
3. Make the engine clear a poisoned job so the condition becomes genuinely transient — rejected on
   first look, because deleting a `graded` job on refusal hands the client a cache-eviction lever.

**Note the interaction with card 18:** the collision defect ALSO routes a second student into a
refusal that only a recompose clears, so whichever option is chosen must cover both.

---

## 20. "An engine key's presence proves server authorship" is TRUE GOING FORWARD, NOT HISTORICALLY · rules/activation · CUTOVER PREREQUISITE (Codex r79, 2026-08-03)

**Status:** carded as an ACTIVATION/CUTOVER prerequisite by Codex's own ruling — explicitly *not* a
rules-deploy blocker. The protective rules should ship regardless; they are what makes the claim true
going forward.

**The claim.** `firestore.merged.rules:133` and `:346` state that because the attempt CREATE guard
denies a client all four engine keys, "the presence of any one of them proves the document was
server-written."

**Why it is overclaimed for HISTORY.** That guard does not exist in production yet. The LIVE create
rule allows arbitrary extra fields, so any attempt written before this ruleset deploys *could* carry a
client-authored `resetEpoch`/`presentationId`/`queueId`/`engineResult`. What we actually have is: the
client feature flag is disabled, a source grep finds no client writer, and the B2 investigation found
zero `resetEpoch` attempts — but B2 is a **sample** (`scripts/deepfix2/b2-database-investigation.mjs:73`
counts `resetEpoch` present/absent only), not a cohort-wide provenance proof, and it does not cover the
other three keys at all.

**CLOSED 2026-08-03 by a cohort-wide read-only scan — the gap is now measured, not argued.**
`scripts/deepfix2/engine-key-provenance-scan.mjs` (NEW, strictly read-only) paged the **entire**
`attempts` collection — **41,680 attempts, 0 quarantine candidates** — and found
**ZERO** documents carrying ANY of the four engine keys: `resetEpoch` 0, `presentationId` 0, `queueId` 0, `engineResult` 0.
Receipt: `audit/deepfix/task3/live_baseline/engine-key-provenance-receipt.json`.

It is a FULL scan on purpose, not an index-backed `orderBy` query: a missing or exempted single-field
index would have silently under-reported exactly the documents being hunted. The script also resolves
any hit against `users/{studentId}/review_presentations/{presentationId}` for existence, ownership and
stamp coherence — that machinery simply had nothing to judge, because there were no hits.

**So the artifact's claim now holds for history too**, and on stronger evidence than the original
argument: not "the flag is off and grep finds no writer", but "no such document exists in the corpus".
**THE CLAIM IS NOW TRUE ON BOTH LEGS, and the owed repair has shrunk accordingly.** The rules DEPLOYED
2026-08-03 (order 97, ruleset `384c9c7a…`), so the attempt-create guard the comment cites now genuinely
exists in production — the claim is true PROSPECTIVELY because the guard is live, and RETROSPECTIVELY
because the cohort scan found zero such documents. When the comment was written, neither leg was
established; both now are.

**What is still owed is small and must NOT become a standalone deploy:** the comment cites only the create
guard, and should also cite this scan as the evidence for pre-existing documents. Editing it changes the
artifact's sha, which would make the artifact diverge from the ruleset now running in production — so a
comment-only edit would either create a false drift signal or force a production redeploy for zero
behavioural change. **BUNDLE IT WITH THE NEXT REAL RULES CHANGE.** Until then the artifact and production
are byte-identical, which is worth more than a tidier comment.

**Comment repair is deliberately deferred.** Correcting the wording at its source would change the
artifact's bytes, and `f40f91fce3693b82` is the exact hash Codex certified and the deploy order
verifies before staging. The correction is therefore a POST-DEPLOY step (the artifact is re-baselined
by `fetch-live-rules.mjs` after deploy anyway) and is written into the deploy order as such.

---

## 19. The live grading-job key namespace is client-chosen — a classmate can PERMANENTLY BLOCK another student's test · backend · **PRE-FLIP BLOCKER** (carded 2026-08-03; severity raised the same day, see below)

**Status:** the consumer-side closure (not trusting a cached grade) shipped in the typed-fix-audit fold.
**But that only stops FORGERY. It does not stop DENIAL — and denial turns out to be reachable, permanent,
and triggerable by a classmate. This is no longer "defense in depth"; it is a pre-flip blocker.**

**THE DENIAL PATH, established 2026-08-03 by reading the code:**
1. `claimOrRecoverGradingJob` stamps the job with the CALLER's uid (`index.js:955-958`), and the live
   `gradeTypedTest` lets the caller name ANY job key (`index.js:1048-1051`, `GRADE_JOB_ENABLED=true`).
2. On every later claim, `if (job.uid && job.uid !== uid) throw permission-denied` (`index.js:936-938`)
   runs **FIRST — before the status and lease checks**. So an expired lease does **NOT** release the
   document to another uid. The block is **permanent**, not a 180-second window.
3. The victim cannot clear it: `grading_jobs` denies every client write (`firestore.live.rules:417`).
   Only an Admin-SDK deletion (a CS intervention) or a recompose to a different `presentationId` recovers.
4. The key is derivable by a classmate. Uids are enumerable from `classes/{id}.studentIds` (readable by
   any authenticated user), and `presentationId` is `{classId}_{listId}_d{day}_e{epoch}_p{seq}` where
   classId/listId are shared, epoch is normally 0 and seq starts at 1. The uid scoping added by the
   rv2-docid-collision fold does not help — it was always a NAMESPACE, not a fence.

**Not live today** — the engine is dark, so no student's submit reaches the claim. **It becomes live at
the flip**, which is why this must close before activation rather than after. Recomposing gives a new
`_p{seq}` key, but seq is small and predictable, so an attacker can follow.

**What's exposed.** `functions/index.js:1048-1051` derives the grading-job key from client-supplied
`writeContext/gradeContext.attemptDocId` and claims `grading_jobs/{that key}` with no namespace
restriction (`GRADE_JOB_ENABLED = true`, `:104`). A caller may therefore name **any** key, including
the engine's `rv2_{presentationId}` — and the client holds its own `presentationId`
(`src/services/reviewV2Client.js:173`). The payload the live path caches
(`functions/index.js:1136-1141`) satisfies the engine's cached-grade acceptance test
(`functions/reviewV2/typedGrading.js:102-104`), so a pre-seeded grade would be consumed as engine
evidence. The header comment at `typedGrading.js:13-16` calling `rv2_` "collision-free against the
legacy key space" is FALSE as written — it is a naming convention, not a namespace boundary
(corrected at source in the fold).

**Why the fix is split.** The consumer-side check (engine provenance + presentation + answer-sheet
binding, fail-closed) lives entirely in dark code and closes the exploitable path. Restricting the key
namespace inside `gradeTypedTest` changes the LIVE grading callable that all 947 students use today —
a different blast radius, needing its own fold, its own fixtures and its own deploy order.

**Option if it is ever wanted:** refuse a client-supplied `attemptDocId` matching `^rv2_` in
`gradeTypedTest` (server-reserved prefix), with a fixture proving the legacy client flow is unchanged.
Defense in depth only — not a prerequisite for the engine, which fails closed without it.

---

## 18. ~~Engine `rv2_` attempt/job ids COLLIDE ACROSS STUDENTS~~ **FIXED 2026-08-03** · review-v2 engine · (was: BLOCKS THE 25WT REHEARSAL; found by the typed-fix-audit lap)

**What's broken.** Two students in the SAME class + list + day + epoch derive the **same**
`presentationId`, therefore the same `attempts/rv2_{presentationId}` document id and the same
`grading_jobs/rv2_{presentationId}` key.

**Why it happens (root cause).** `presentationId` is
`{classId}_{listId}_d{day}_e{epoch}_p{seq}` (`functions/reviewV2/presentations.js:445`; `_n{seq}` /
`_r{seq}` for new-day and rerun) over a queue id that carries **no uid**
(`functions/reviewV2/composer.js:82-84`). That is sound where it is stored — `review_presentations`
and `review_queues` are under `users/{uid}/` — but `attempts` and `grading_jobs` are **GLOBAL**
top-level collections, and `seq` counts per user, so every student's first review presentation of a
day is `_p1`.

**Impact.** In a class with more than one student:
- MCQ: the second student's submit finds the first student's attempt at that id. **Before the A4
  replay-provenance check it was returned to them as their own "replay" — the first student's
  score/passed/engineResult.** completeDay would then refuse it (`studentId !== uid`), so it did not
  reach graduation, but the student saw a grade that was not theirs.
- Typed: the second student's grading-job claim hits `job.uid !== uid` and throws
  `permission-denied` (`functions/index.js:936-938`) — a hard failure.
- With A4 in place the MCQ case now fails CLOSED (`presentation_invalid`) instead of leaking a grade.
  **CORRECTED 2026-08-03 (independent audit) — an earlier draft of this card said "both students are
  still blocked". That was FALSE, and contradicted by the very fixtures cited below.** What the
  fixtures asserted AT THE TIME: the **FIRST** student's attempt landed normally
  (`attempt_written`, score 100) and remained the only document at the colliding id; only the
  **SECOND** student was refused. **(Line numbers dropped — audit finding F2: the `:1906`/`:1910`/`:1913`
  cited here now land in a different case entirely, and a stale line reference is worse than none.)** That second student is not permanently
  stuck either — recomposing advances their own per-user `presentationCount` to `_p2`, which no longer
  collides. So the real shape is: **one student silently wins the id, the other eats a refusal and a
  forced recompose.** It is a correctness/availability defect, not (post-A4) a data-exposure one — and
  it is a rehearsal blocker because a multi-student class is exactly where it bites.

**How it stayed hidden.** Every engine fixture before this fold used ONE student per class. It was
surfaced by the typed-fix-audit lap only because CASE TG needed seven students.

**(Audit finding F2 — corrected.)** This paragraph used to end *"it is now pinned by the `TR COLLISION`
fixtures … which assert the fail-closed behaviour"*. Present tense, and no longer true: the
rv2-docid-collision fold **inverted** those very assertions. They now assert that BOTH students land,
which makes them the regression witness for this defect rather than a description of it.

**FIXED 2026-08-03 (rv2-docid-collision fold).** Both derived global ids are now
`rv2_{uid}_{presentationId}`, produced by ONE shared function — `engineDocId(uid, presentationId)`
(`functions/reviewV2/composer.js:117`, exported `:448`) — called from BOTH derivation sites:
`callables.js:550` (`attemptId`) and `typedGrading.js:260` (`jobKey`). One function on purpose: a job key
that named a different test from the attempt whose rows it builds would be a worse defect than the one
being fixed, and this is the same structural shape that root-caused the earlier repeat-defect class.
`presentationId` itself is UNCHANGED — it is already uid-scoped by path, and it is stored, registered in
`compose_keys`, echoed to the client and compared in three places, so scoping it there had a far wider
blast radius than the defect warranted. **The principle: when an id crosses from a scoped namespace into
a global one, it must acquire the scope it is losing.**

**NO MIGRATION WAS NEEDED** — a read-only production query found **0** `rv2_` documents in `attempts` and
**0** in `grading_jobs`, so this is a pure forward-scheme change.

**THE UID IS A NAMESPACE, NOT A FENCE** — stated explicitly so nobody later mistakes it for a security
boundary. A student knows their own uid, so the key stays client-derivable; the third-party and teacher
fixtures deliberately name the victim's full uid-scoped key and still reach the document. The fence
remains the job's `uid` FIELD (`index.js:936-938`) and the cached-grade acceptance test (18_ §5.6).

**Fixtures:** lap CASE RC (the bypass set, the single-student control, and the two-student typed leg end
to end), CASE RC0 (a crash-free canary — see below), and CASE TR (10), which is the INVERTED regression
witness: it used to assert the broken behaviour, and now asserts that both students land. Mutant
`M-A1-UID-SCOPE-REVERT` reverts the scoping and is killed.

**Worth keeping:** the implementer found that under a scoping revert the lap dies of a `TypeError` in an
EARLIER case, before the collision fixtures ever run — so the mutant would have been recorded as "killed"
while naming no assertion. CASE RC0 exists to be a crash-free canary that actually names the failure, and
the mutant runner now falls back to in-run RED lines when a lap crashes. A mutant that dies for the wrong
reason is a mutant that proves nothing.

**Original fix direction, kept for the record.** Make the derived document ids uid-scoped — `rv2_{uid}_{presentationId}`, or put the
uid into the presentation id itself. Both `attempts` and `grading_jobs` must move together or the
typed leg splits. NOT a hot fix: it changes the id scheme the whole engine and its evidence chain key
on (completion's `serverClaim.attemptDocId` binding, the lap, the rules artifact's docId reasoning).

**Effort/risk.** Medium effort, contained blast radius while the engine is dark (`REVIEW_V2_CLIENT=false`,
no live student writes an `rv2_` document today), but it MUST land before the 25WT rehearsal, which
runs a real class of students.

---

## 17. Unfiltered `study_states` full-collection scans → 207M Firestore QUERY reads/month (~83% of the GCP bill)  ·  client/query  ·  HIGH (measured 2026-07-30)

**What's broken.** Four call sites read a student's ENTIRE `study_states` subcollection with no `where`,
no `limit` — `getDocs(collection(db,'users',uid,'study_states'))`:

| # | Site | Reads | Actually needs |
|---|---|---|---|
| A | `db.js:1183` `fetchStudentAggregateStats` | all (~1,090–2,240 docs) | ONE integer (count of `status !== 'NEVER_TESTED'`) |
| B | `db.js:1278` + `db.js:1447` (credibility, both submit paths) | all | the ~30 words in THIS test |
| C | `db.js:1129` `fetchStudentStats` | all, then discards everything not in the list | one list's states |

**Why it happens (root cause).** These predate `study_states` carrying a `listId` field (verified present on
live docs) and predate `getCountFromServer`. A. is amplified by `ClassDetail.jsx:225`, which calls
`fetchStudentAggregateStats` **once per class member inside a `Promise.all`** — a 30-student class page is
~45,000 reads to render 30 integers.

**Impact (measured, Cloud Monitoring, 7 days to 2026-07-30).** ~208.7M document reads/month, of which
**QUERY = 206.7M (99.0%)**; LOOKUP is only 1.8M. At $0.06/100k that is **~$124/mo of a ~$150 total GCP bill**
(writes ~$7, storage ~$0.13, Functions effectively free at ~253k invocations/mo vs a 2M free tier).
Weekday ~10M reads/day vs weekend ~320k — a 25–30× ratio confirming session-driven traffic, not batch jobs.
Per active student that is **~10,500 reads/weekday** (≈5–10 full scans each). Also O(n·m): `db.js:1129`
does `wordIds.includes()` inside a `forEach` over every doc (~1,700 × 2,240 comparisons) — should be a `Set`.

**Fix direction.**
- **A** → `getCountFromServer()` (~2–3 reads instead of ~2,240, a ~750× cut) **or** maintain
  `users/{uid}.stats.totalWordsLearned` as a counter. ⚠ Prefer the counter: the reader tests
  `data.status && data.status !== 'NEVER_TESTED'`, and the `normalizeStudyState` fallback to `box` implies
  legacy docs with NO `status` field — a `!=` count query would silently drop them. Verify field coverage
  before choosing the query route.
- **B** → fetch only the answered word IDs (~30 docs) instead of the whole collection. ~50× cut on EVERY
  test submission. Clearest single win.
- **C** → add `where('listId','==',listId)`; swap the `includes()` scan for a `Set`.

**Effort/risk.** ~1 day. Low risk, contained to `db.js` + one `ClassDetail.jsx` call site; no schema change
and no data migration. **Sequencing caveat:** `db.js` is inside deepfix2's blast radius — land these
deliberately rather than dropping them into a moving tree.

**Strategic note.** This is the whole basis of the "should we leave Firebase?" question (2026-07-30). At 1,452
users / ~1M docs / 0.73 GiB, the platform is not the problem — these four queries are. Expect ~$150 → ~$25.
Full measurement + reproduction: `docs/audits/FIRESTORE_COST_AUDIT_2026-07-30.md`.

---

## 11. Full-freeze intervention is a PERMANENT stuck state — a maxed-out student can never self-recover  ·  backend/intervention  ·  HIGH (confirmed by persona-fleet audit)

**Credit: surfaced by the Run S-Long persona expansion (persona L14); confirmed from fleet3 data; triaged by Codex 2026-07-12.**

**What's broken.** Once `interventionLevel` reaches 1.0 (≥3 recent review scores ≤~0.30), `calculateDailyAllocation`
gives `newWordCount = 0`. On Day 2+, `completeSessionFromTest` blocks completion (no same-day passed new-word
attempt) → retake-required, csd/twi FROZEN. The student can still DO the review, but the day never COMPLETES.

**Why it happens (root cause).** `calculateInterventionLevel` reads the last 3 non-null review scores from
`class_progress.recentSessions`, which is appended ONLY in `recordSessionCompletion` (a COMPLETED day). A
full-freeze day never completes, so even high-scoring reviews are NEVER recorded → the intervention window stays
pinned on the old low reviews → interv stays 1.0 → newWordCount stays 0 → every next day re-blocks. Self-reinforcing.

**Evidence (fleet3 / L14, 2026-07-12).** Student froze at day 5. `recentSessions` ends at day 4 (reviews
0.27/0.27/0.27). On the stuck day the student submitted 4 review attempts, ALL `passed=true score=100` — NONE
appended to `recentSessions`; csd frozen at 4 throughout. High reviews had zero effect on intervention.

**Impact.** A student who hits full-freeze is PERMANENTLY STUCK — no self-service path out; only a manual/admin
progress fix or a teacher class-change reconciliation unsticks them. Silent (looks like "review required" daily).
Rare trigger (needs ≥3 very low reviews) but a total dead-end when hit.

**Fix direction (Codex).** Floor `newWordCount ≥ 1` on any day that still gates completion on a same-day new pass
(don't let intervention zero it out); OR add a recovery path that lets sustained high reviews lower intervention
WITHOUT requiring day completion (record blocked-day review scores into the intervention window, or a separate
recovery signal). **Effort/risk:** backend logic + careful validation against the freeze/throttle personas; not a
one-liner. Its own plan + go-ahead before any code (per standing rule).

## 10. Flag-ON self-race: pre-completion reconciliation advances CSD → session completion is stale-blocked → "session refreshed" rebuild  ·  backend/reconciliation  ·  MEDIUM (latent; harness-surfaced)

**Credit: Codex root-caused this; Claude verified against code (corrects an earlier wrong "harness-only" conclusion).**

**What's broken.** On a session-final test completion (Day 1 new test; and the review test on later days),
the app can BLOCK its own completion and show the "세션 정보가 갱신되었습니다 / Your session was refreshed" rebuild
screen — even though the student did nothing wrong. The day completes (CSD advances once, attempt saved), but
the student sees a confusing mid-completion interruption and must "return to the study screen."

**Why it happens (root cause, verified).** In `TypedTest.jsx` handleSubmit → `doWriteAndFinalize`, the order is:
(1) write the passed attempt (`submitTypedTestAttempt`, `TypedTest.jsx:919`); (2) take a "snapshot BEFORE
completion" via `getOrCreateClassProgress` (`:979`) — but under `LIST_SCOPED_RECON` that call **reconciles and
WRITES** the advanced counter (`progressService.js:258` `updateDoc({currentStudyDay: safeCSD})`) off the
just-written attempt, so CSD goes 0→1; (3) `completeSessionFromTest` (`:1015`) → `updateClassProgress` now sees
CSD already 1, so `expectedDay=2` but the completion says day 1 → the day-guard rejects it
(`progressService.js:442` "Duplicate day completion blocked: expected day 2, got day 1") → `dayGuardRejected`
→ session rebuild. **Same pattern in `MCQTest.jsx:717`** → affects typed AND MCQ. It is an app-side self-race
between attempt-based reconciliation and session completion, NOT a double user-submit.

**Impact.** Currently **0 occurrences on the 26SM live cohort** (`day_guard_rejected_session_cleared` system_log:
5 events all-time, ALL from sandbox audit runs). So it is **latent in production today** — likely because the
fast same-region audit driver reliably makes the just-written attempt visible to the snapshot read, while real
students' timing/path differs. But the mechanism is a genuine correctness smell that could surface (a confusing
"session refreshed" on a normal day completion), and it is deterministic enough to block the Run S-Long audit
driver (~5/5 harness runs). Possibly related: `impossible_phase_detected`/`day1_with_passed_new_test` (406
recent) — a separate high-volume day-1 signal worth its own look.

**Fix direction (Codex).** Don't call reconciling `getOrCreateClassProgress` between the attempt write and
`completeSessionFromTest` for a final-test completion (take the snapshot WITHOUT reconciling, or before the
attempt write); OR make completion idempotent — accept "already reconciled from THIS same day's attempt" as a
success instead of routing to the day-guard rebuild. Route through the loop/Codex before shipping (it's on the
hardened LIST_SCOPED_RECON path).

**Effort/risk.** Small, but reconciliation-adjacent — must be reviewed + regression-tested (Run L flag-off
equivalence + the #9 acceptance). Run S-Long S-? day-completion smoke is the natural regression once built.

---

## 8. Gradebook Name/student filter runs client-side on ONE page → inactive students show "no results"  ·  client/query  ·  HIGH

**What's broken.** Opening a student's **Grades** (or filtering the Gradebook by a student **Name**)
shows *"Your search returned no results"* even though the student has valid, graded attempts. The
student's card in **Students** still shows the correct Day (e.g. 이지후 Day 8) — because that reads
`class_progress` directly, a different data source. So progress looks fine but grades look empty.

**Why it happens.** `queryTeacherAttempts` (`db.js:1858`) fetches attempts with a Firestore query
filtered **only** by `teacherId` (+ optional Class/Date), `orderBy('submittedAt','desc')`,
`limit(50)` (`db.js:1943`). The **Name → studentId filter is applied in JS as post-processing on the
returned 50-row page** (`db.js:1982` `if (!filterStudentIds.includes(studentId)) continue`), not
pushed into the Firestore query. So the surface only ever inspects the 50 most-recent attempts
*teacher-wide*. Any student whose latest attempt has aged out of that window yields zero matches after
the post-filter → "no results". (2nd, smaller contributor: `db.js:1968-1977` drops any attempt whose
`testId` doesn't match the `test_`/`typed_`/`vocaboost_test_` regexes before the filter even runs.)

**Impact (measured, 이지후 / justin2jihool@gmail.com, 26SM 미주 SAT Inter.).** 14 clean graded attempts,
all with `submittedAt` Timestamps, correct `teacherId`/`classId` — the ordered query *does* return
them server-side. But his last attempt is 2026-06-09; teacher-wide he ranks **17,236 / 20,029
(page 345)**, and even class-scoped **660 / 753 (page 14)** at 50/page. Page 1 contains none of his →
"no results". **General bug:** hits *any* student who goes quiet ~a month. Not data corruption — no
CS data fix is warranted (verified 2026-07-09, see `SUPPORT_RUNBOOK.md` CS-2026-07-09b).

**Fix direction.** When a Name filter resolves to studentId(s), scope the Firestore query
**server-side** instead of post-filtering a page: for a single student use the existing
`queryStudentAttempts` path (`db.js:~2100`, `where('studentId','==',uid)` + `orderBy submittedAt`);
for multiple, `where('studentId','in', ids)` (≤30) — each with the matching composite index. That
makes pagination walk only that student's attempts, so an inactive student's grades appear on page 1.
Interim TA workaround: filter by **Class + a Date range around the student's active weeks** (or page
forward) — the data is all there.

**Effort/risk.** Small, localized to `queryTeacherAttempts`; needs a `(studentId, submittedAt)` /
`(teacherId, studentId, submittedAt)` composite index. Low risk (narrows, doesn't widen). Validate the
single-student "Grades" click and multi-tag Name filters still page correctly.

---

## 7. Empty `assignedLists: []` hides ALL assigned lists (dashboard shows "0 assigned lists")  ·  data-compat  ·  MEDIUM-HIGH

**What's broken.** A class whose `assignments` map is populated (lists genuinely assigned) but whose
`assignedLists` array is **empty (`[]`)** renders as having NO lists — the student dashboard shows
"0 assigned lists" and no studyable state, even though the class has a valid assignment. Surfaced by the
Run L audit (2026-07-05): `25WT LSR-A TYPED` had `assignments[TOP]` set but `assignedLists: []`, so fresh
students saw no Start button (L1-T/L1-R "test not reached").

**Why it happens (root cause).** `db.js:502` — `const assignedListIds = classData.assignedLists || Object.keys(assignments)`.
An empty array `[]` is **truthy**, so `[] || Object.keys(assignments)` returns `[]` — the fallback to
`assignments` keys never fires. The intent was "use assignedLists if present, else derive from assignments,"
but `||` doesn't treat `[]` as absent.

**Impact.** Any class that ends up with `assignedLists: []` + a non-empty `assignments` (an ordering/write
split-brain) becomes unstudyable for its students until repaired. Silent — looks like "no lists assigned."

**Fix direction.** `db.js:502` → `const assignedListIds = (classData.assignedLists?.length ? classData.assignedLists : Object.keys(assignments))`.
Consider a data sweep for existing classes in this split-brain state.

**Effort/risk.** Tiny code change, low risk. Audit added a `--pre` effective-assignment precondition that
replicates the *current* (buggy) Dashboard semantics so it catches this state rather than masking it.

---

## 6. Class change resets list progress (day/`totalWordsIntroduced`) → students re-study words  ·  data model  ·  HIGH

**What's broken.** When a student moves between classes that share the same list, their day counter
and word position reset to Day 1 — the app re-feeds words they already studied. Fixed by hand 3× so far:
이주헌 (CS-2026-06-30), 손진욱 + 박주하 (CS-2026-07-02b). Recurring; each needs a manual carry-forward.

**Why it happens (root cause).** Progress is keyed by **class + list**, not student + list. The
`class_progress` doc id is `{classId}_{listId}` (`progressService.js:32 getProgressDocId`), and
`session_states` is `{classId}_{listId}` too (`sessionService.js:55 getSessionDocId`). A new class ⇒ a
fresh `{classId}_{listId}` doc ⇒ `currentStudyDay=0`, `totalWordsIntroduced=0`. **Mastery already
persists correctly** — `study_states` are keyed `users/{uid}/study_states/{wordId}` (has `listId`, no
`classId`), so the known-words carry; only the *counter* resets. That asymmetry is the whole bug.

**Impact.** Any class change on a shared list (common: Base Camp→Ascent promotion, section transfer)
silently rewinds progress; students redo mastered words, morale/억울함 hit, TA + ops time per case.

**Fix direction (settled model, 2026-07-04 — David).** **List progress is student-owned; a class confers
only list ACCESS + the daily quota/policy (pace/threshold/testMode) for a session launched under it.** No
class owns progress state → one record per (student, list): `class_progress/{classId}_{listId}` →
`users/{uid}/list_progress/{listId}` (position only). Settings/quota resolve from the launching class;
teacher gradebook = the shared position + a view over class-tagged `attempts` (no per-class progress doc);
"day" = session count. `totalWordsIntroduced` is a pace-independent word position (carried verbatim);
`currentStudyDay` is a stored counter (carried verbatim, NOT relabeled from pace). One-time migration
collapses `{classId}_{listId}` docs → `{listId}` taking the anchor-validated `max(totalWordsIntroduced)`.
**Full plan (v3, 3-agent + Codex×2 audited):** `docs/plans/PLAN_list_progress_persist.md`.

**Effort/risk.** Medium. Real scope: (1) list-scope the reconciliation/anchor readers (anchor by
`newWordEndIndex`, not `studyDay`) — the load-bearing piece; (2) route the full composition surface
(`getProgressDocId` + blindSpot + `reviewChallenge` R+W + `TypedTest`×4 + `MCQTest`×4 + automarker) to
`{listId}`; (3) migration on live data (backup + verify); (4) gradebook/pacing become views. The
shared-live-position/server-claim architecture the audit explored was dropped as unnecessary under the
student-owned model (see plan Appendix A). Cross-plan: list-scope the grading session key
(`PLAN_grading_idempotent_concurrency.md`).

---

## 5. `retakeThreshold` defaults to 0.95 → a genuine pass (92–94%) can show as "fail"  ·  client  ·  HIGH

**What's broken.** A student scores at/above the class pass threshold (e.g. 93% vs a 92% threshold), the server writes `passed:true` and advances them, but the **results screen shows "fail"** and loops them into retakes.

**Why it happens (root cause).** `TypedTest.jsx` initializes `retakeThreshold` to **0.95** (line ~87) and only lowers it to the real value once it resolves the class/list `passThreshold` (→ `/100`). If that resolution fails or is skipped, it stays at **0.95**, and the pass check `summary.score >= retakeThreshold` compares the fraction score (0.93) against 0.95 → "fail". Because **0.95 is higher than the actual class thresholds (commonly 92)**, ANY threshold-load hiccup turns a real pass into a displayed fail. Observed for **김나연** (CS-2026-07-03): threshold load fell back to the default because she was enrolled in **two** Base Camp classes, breaking the class resolution.

**Impact.** Students who genuinely pass (92–94%) get told they failed and are forced to retake in a loop, even though the server marked them passed and advanced their day. Confusing, generates CS tickets, and mis-signals to students.

**Fix direction.** (1) Default `retakeThreshold` to a **safe low value** (e.g. the cohort-min, or 0) — never above real class thresholds — so a load failure fails *open* (pass) not *closed* (fail); or block the results-screen verdict until the threshold is actually loaded. (2) Harden the threshold resolution for **multi-class** students (pick the class the attempt was taken under; don't fall through to the default when one path returns null). (3) Ideally, make the results screen trust the server's `passed` field rather than recomputing client-side.

**Precise source (traced 2026-07-03 via 김호형/Adv E).** The client new-word gate's threshold = `assignment.newWordRetakeThreshold || DEFAULT_RETAKE_THRESHOLD(0.95)` (`studyService.js:267` → `sessionConfig.retakeThreshold` → `DailySessionFlow.jsx:1316` + `TypedTest.jsx:291`). Class assignments store `passThreshold` (which the SERVER uses) but historically **never stored `newWordRetakeThreshold`**, so it fell to 0.95. (`studyService.js:1282` already comments this and `completeSessionFromTest` was fixed to trust the attempt's `passed` flag — but the DailySessionFlow gate + TypedTest results screen were not.)

**Interim mitigation APPLIED (2026-07-03, no deploy).** Wrote `newWordRetakeThreshold = passThreshold/100` onto all 61 class assignments (39 classes), per-assignment (92→0.92, 90→0.9, 74→0.74, …). Client now reads the real threshold on the NEXT session build. **Durable code fix still needed** so new/edited assignments don't reintroduce the gap and so the gate trusts the server `passed` flag regardless.

**Effort/risk.** Low effort (a constant + a resolution guard); risk is low and strictly in the safe direction.

---

## 4. No way to tell which commit/flags are actually LIVE (deploy provenance)  ·  ops/backend  ·  HIGH  ·  **fix written, awaiting deploy**

**What's broken.** The deployed Cloud Functions had no signal of what code/flags they're running, so the repo can silently diverge from production with nobody noticing.

**Why it happens (root cause).** Two concrete 2026-06-29 instances: (a) the grader "accept answers matching the Korean definition" rule was committed **2026-03-10** (in a mislabeled commit `0de81fb "apboost audit and updates"`) yet production kept emitting the old "restating the Korean definition" failures through 06-28→06-29 11:14 KST — prod ran a **stale artifact** and there was no way to see it (this is what wrongly failed 박시은); (b) `/app` `functions/index.js:45` reads `GRADE_TOKEN_ENFORCED = true` while production *behaves* as `false` (verified by a mismatched-token save succeeding) — repo↔prod drift with no live readout.

**Impact.** Silent regressions and "fixed in repo, broken in prod" — a fix can land in git and never reach users, or a flag's live value is unknowable without behavioural probing. Directly caused a wrongful grade.

**Fix direction (implemented 2026-06-29, not yet deployed).** `scripts/stamp-build.mjs` stamps `functions/buildInfo.json` (git sha/branch/dirty/builtAt) via `firebase.json` `predeploy`; `functions/index.js` logs it on cold start and exposes `exports.version` returning the live sha + runtime flags. **Post-deploy verify:** call `version` → `sha` must equal `git rev-parse HEAD` of the deployed checkout, and `flags.GRADE_TOKEN_ENFORCED` must be `false`. Follow-ups (process, not code): deploys must build from HEAD and redeploy `gradeTypedTest`; stop hiding functional grader changes in unrelated commit messages.

**Effort/risk.** Low effort, additive/no-behaviour-change (one new read-only callable + a predeploy stamp); risk is only that the deployed checkout must carry these files.

---

## 3. Grading can still hard-fail on `listId: null` (residual after the 06-22 malform fix)  ·  backend+client  ·  MED

**What's broken.** `gradeTypedTest` rejects an entire test ("Unresolvable grading payload (all answers
malformed post-resolution)") when the call arrives with `listId: null`. The student gets "Grading
Failed."

**Why it happens (root cause).** The 06-22 crash-recovery malform incident (313 failures / 21 students —
see CS-2026-06-28) was fixed two ways: the client now persists `definition/definitions/partOfSpeech` in
recovery markers, and the server `resolveAnswerDefinitions` backfills canonical defs from
`lists/{listId}/words`. But the **server backfill is gated on `listId`** — when the client sends
`listId: null` (a recovery/resume path or stale bundle), backfill can't run, every row stays
unresolvable, and the softened "throw only if EVERY row is unprocessable" still throws. Audit found this
is the residual tail: ~12 such errors 06-23→06-28 across 2 students (+ 3× `401 auth/id-token-expired`
mid-test). **All recovered via retry — 0 permanent loss.**

**Impact.** Low volume now, no data loss, but a real "Grading Failed" until the student retries — the last
gap in the otherwise-robust server-authoritative grade path.

**Fix direction.** Guarantee the client always passes `listId` to `gradeTypedTest` (it's always known on
the session route); and/or a server fallback — resolve the list via the attempt's `classId`→assignments,
or grade against client-sent defs when present, instead of throwing. For the 401s, refresh the ID token
before submit (or catch + re-auth + retry). **Effort/risk:** small; read-only-audit confirmed.

---

## 4. Grading-error pop-up overstates failure / loops on deterministic errors  ·  frontend UX  ·  MED

**What's broken.** On a grading error the student sees a red **"Grading Failed"** modal that reads as a
categorical loss — even when (a) the server may have actually graded (transient/timeout: the response was
lost, no durable attempt written yet) or (b) the error is **deterministic** (malform / `invalid-argument`)
where the 3× auto-retry + the "Try Again" button loop forever with no progress. The body line "Your
answers are saved" is misleading (no graded attempt exists when grading truly failed). *(The separate
"Couldn't Save Your Results" modal — grading succeeded, durable save failed — is well-worded and correct;
this item is specifically the `gradingError` modal in `TypedTest.jsx`.)*

**Why it happens.** `gradeWithRetry` catches all errors uniformly → one "Grading Failed" modal; it doesn't
branch on `errCode` (transient vs deterministic), doesn't tell the student retry is idempotent/safe, and
doesn't suggest a reload (which rebuilds the payload and fixes deterministic cases). change_action_log
already flagged "client `gradeWithRetry` should not retry on `invalid-argument` — deferred."

**Impact.** Student anxiety + needless retakes; deterministic errors produced the old "stuck clicking Try
Again" loop (drove "stuck on loading" CS tickets). No data loss (idempotent), but bad UX + CS load.

**Fix direction.** Branch modal copy by `errCode`: transient (`deadline-exceeded`/`unavailable`) → "Connection
hiccup — your work is safe, tap Try Again"; deterministic (`invalid-argument`) → stop auto-looping and show
"Please reload this page and submit again." Reassure in both that progress isn't lost; fix the contradictory
"Your answers are saved" line. **Effort/risk:** small, frontend-only.

**Reliability baseline (persona-fleet audit, fleet3 2026-07-12).** Across ~220 test-days: ~3 transients, all
RECOVERED by client retry — `gradeTypedTest` → `FirebaseError: internal` (grading-retry N/3) ×2, and one
"Couldn't Save Your Results"/Retry-Save (grading OK, durable save failed). ≈1.4% recovered-transient rate; no
data loss. Track as a baseline; escalate to its own item only if a future run shows UNrecovered grading/save
failure, data loss, or a materially higher rate. (Codex disposition: fold here, don't open a new root-cause bug.)

---

## 1. No teacher/TA grade-override path → single disputed answer blocks the whole day  ·  product+backend  ·  HIGH

**What's broken.** When a teacher/TA decides an AI-graded answer should count (lenient acceptance,
typo tolerance, partial credit), there is **no way to push that decision into VocaBoost.** The stored
attempt keeps the AI's original verdict, the score stays below the pass threshold, and the student is
stuck on that day. The only resolution today is a manual Firestore edit by CS.

**Why it happens (root cause — 3 layers):**
1. **Grading is AI-only and immutable from the teacher side.** No override UI, no API surface. A
   teacher's "I accept this" exists only on paper; the system never learns about it.
2. **The pass gate is strict + binary with no manual lever.** One item dropping 93% → 90% against a
   92% threshold fails the whole day. There's no "teacher marks this day passed/adjust score" control
   short of a script.
3. **The AI grader is strict enough that TAs routinely want to override.** It rejects defensible
   answers, which is what *generates* the override in the first place — so even a perfect override UI
   doesn't remove the underlying calibration pressure (see item 2 below).

**Impact.** Recurring CS load; every override = a hand-written DB fix (risk of invalid anchors).
Real case: **CS-2026-06-25, 조예서 (Inter B2)** — TA accepted `amnesty`="대사", but the Day-7 test
stayed at 90% (27/30, threshold 92) and she couldn't advance until I corrected the attempt by hand.

**Fix direction.** A teacher-facing **"accept this answer / re-grade / mark day passed"** control on
the grading/gradebook view that writes the override durably:
- per-item: flip `isCorrect`, recompute score + `passed`, stamp `manualOverride` + who/when/why
  (mirror exactly what the CS script does, so it produces a **valid anchor** — preserve
  `newWordEndIndex`/`testId`/`wordsIntroduced`);
- must go through the **server write path** (`submitVocabAttempt`/a new callable), NOT a client write,
  so it's authorized and can't be forged (ties into PLAN_server_side_attempt_write_v2.md);
- audit-log every override to `system_logs`.

**Effort/risk.** Medium (UI + one callable + reconciliation reuse). Risk: must not create invalid
anchors or let a non-teacher call it — gate by class ownership server-side. **Blocked on #1b (role trust)
AND #1c (answers[] forgeability) — see below.**

---

## 1c. LIVE: student-writable `answers[]` → forgeable passing score via reviewChallenge  ·  security  ·  HIGH

**What's broken (and it's live, not hypothetical).** `firestore.rules:109` lets a student update an attempt
with `hasOnly(['answers'])` but does **not** restrict which sub-fields of `answers[]` change. The app's
`submitChallenge` (db.js:2614-2624) only edits challenge metadata, but the rule is the security boundary and
it's permissive — a student calling Firestore directly can rewrite the whole array, including
`answers[].isCorrect`. Then `reviewChallenge` (db.js:2690-2717) recomputes `correctCount` from the stored
`answers[].isCorrect` and writes `score`/`passed` **unconditionally on both accept AND reject**. So a student
forges several `isCorrect:true`, files one challenge, and the teacher reviewing it (even rejecting the bogus
challenge) launders the forged array into a passing score. The teacher's UI shows only the one challenged word.

**Why it happens.** Challenge state lives *inside* `attempts.answers[]`, which the client must write for
`submitChallenge` → the rule has to allow client `answers` writes → it can't cheaply restrict sub-fields →
`isCorrect` is client-writable → any server recompute that trusts it (reviewChallenge today, the planned
override callable tomorrow) launders the forgery.

**Impact.** A student can convert a failed test into a passing one with one teacher interaction. Defeats the
"server-side, can't be forged" goal of the override feature, and is exploitable in production now via
reviewChallenge. (Reconciliation reads top-level `passed`, which the student can't write directly — so the
recompute step is the laundering vector.)

**Also forgeable via CREATE (Codex, broader).** `firestore.rules:101` lets a student `create` ANY attempt
with their own `studentId` and no shape check → direct `{passed:true,score:100}` forgery, no challenge
needed. Legacy client create paths still live: `db.js:1242/1397`, `DailySessionFlow.jsx:962` (empty-review
automarker). So the fix is the **full attempt-write lockdown** (create AND update), not just submitChallenge.

**Fix direction.** See **`docs/plans/PLAN_attempt_write_lockdown.md`** (the concrete spec; = C+D Phase D):
W1 `submitChallenge`→callable + remove student `answers`-update rule; W2 server-only attempt creation
(finish cutover + migrate the automarker); W3 rules `create:false` for clients + teacher-only update. Then
`answers[].isCorrect`/`score`/`passed` are all server-trusted. Until it lands, any server recompute
(reviewChallenge, override) must NOT trust client-written grade fields.

**Effort/risk.** Medium. Closes the live forgery; gates the override feature (#1); IS C+D Phase D (don't
solve twice). Flag the live reviewChallenge + direct-create exposure to the owner now.

---

## 1b. Doc-`role` is self-writable → student can self-promote to teacher  ·  security  ·  HIGH (blocks 1)

**What's broken.** `firestore.rules:34-35` lets a user write **any** field of their own `users/{uid}`
doc (`allow write: if isOwner(userId)` with no field whitelist) — including `role`. A student can set
their own `role:'teacher'`. Every server/rule check of the form `users/{caller}.role === 'teacher'`
(`functions/index.js:1228` `renameStudent`; rule-level `isTeacher()` at rules:18-20) is therefore
**bypassable**. Surfaced while designing the grade-override callable (item 1), which inherits the hole.

**Why it happens.** Role is stored as a plain user-doc field, not a Firebase **custom claim**, and the
owner-write rule never excluded it. AuthContext reads it as a doc field (`AuthContext.jsx:39`).

**Impact.** Pre-existing privilege-escalation surface for any teacher-gated callable. Blocks shipping
item 1 (grade override) safely.

**Fix direction.** Either (a) tighten the user-doc rule so self-writes exclude `role` (and other
authority fields): `isOwner(userId) && diff().affectedKeys().hasOnly(['profile','stats','settings','challenges', ...])`
— small, also retro-fixes `renameStudent`; or (b) move teacher identity to a **custom claim**
(`request.auth.token.role`) set by a privileged path, and check that in callables. (a) is the smaller win;
(b) is the more robust long-term answer.

**Effort/risk.** (a) is a one-rule change + a sweep to confirm nothing legitimately self-writes `role`.
Low risk, high value.

---

## 2. AI grader rejects defensible answers (calibration)  ·  backend/prompt  ·  MED — investigate

**What's broken.** The typed-test grader marks reasonable answers wrong, forcing teacher overrides.
In the 조예서 attempt it failed `migratory`="animal that migrates" and `synthetic`="통합적인" — both
arguably acceptable. (`amnesty`="대사" was genuinely wrong, so that one was a real miss, not grader
error.)

**Why it happens.** Grader strictness/calibration — exact-ish match expectations, possibly weak on
Korean near-synonyms / paraphrase-style definitions / partial credit. Root cause needs data: pull a
sample of teacher-overridden items and see what classes of answer the grader over-rejects.

**Impact.** Drives the override volume that item 1 then has to absorb. Better calibration shrinks the
whole problem.

**Fix direction.** (a) Collect overridden items as a labeled eval set; (b) measure grader
false-negative rate by answer type; (c) tune the grading prompt / add a partial-credit or
synonym-tolerance rubric; (d) re-measure against the eval set before/after.

**Effort/risk.** Investigation-first; prompt change is low-risk but must be validated against the
eval set so we don't swing into false-positives (accepting wrong answers).

---

## Done

_(none yet)_

## Known flag-ON consequence — per-class progress reset is a no-op for cross-class students  ·  data-model  ·  LOW (revisit with epoch)

**Not a bug — a coherent consequence of student-owned progress.** `resetStudentProgress` (student self-serve,
`Settings.jsx:90`, students-only) deletes only class-scoped attempts (`db.js:2886` `where('classId','==',
classId)`). Under flag-ON's list-wide anchor, a student's attempts on the same list in ANOTHER class survive,
so the next session re-finds that anchor and `Math.max` resurrects CSD/TWI — the per-class reset appears to do
nothing. **Under student-owned progress this is correct** (there is one list-progress record; you can't
half-reset one class). It's a student self-serve feature (no teacher reset), so exposure is low.

**Disposition (David 2026-07-11):** document + defer. The coherent "true reset" is a full list-progress reset —
owned by the **grading-concurrency Phase 2 `resetProgress` epoch** work. Run S overlay **S-9** certifies the
current interim behavior so it isn't a silent surprise. No fix now.

## 9. Flag-ON: cross-class review completion forces a spurious new-word retake  ·  backend/reconciliation  ·  HIGH

**What's broken.** Under `LIST_SCOPED_RECON=true` (LIVE 2026-07-11), the exact flow the flag was built to fix
fails at its LAST step. Student passes Day-D new words in class A → leaves before the review → resumes in class
B (same list) → **completes the Day-D review in B** → is incorrectly told to **retake the new words** (and the
retake operates on the WRONG day's words, since B's session base is the post-pass TWI).

**Why it happens (root cause, traced).** The review-completion gate `getNewWordAttemptForDay(..., { listScope,
expectedBase: sessionState.sessionConfig.newWordStartIndex })` (`studyService.js:1318-1321`) requires a
same-day passed-new attempt at `newWordStartIndex == expectedBase` (`db.js:3055-3064`). But B is a FRESH
session (session_states are `{classId}_{listId}`-keyed, so B has no persisted Day-D session) → `initializeDailySession`
sets `sessionConfig.newWordStartIndex = totalWordsIntroduced = reconciled TWI = D·p` (`studyService.js:253,185`).
A's passed attempt is at the DAY's base `(D-1)·p`, not `D·p`. Mismatch by one day's pace → gate finds nothing →
list-scoped fallback is launching-class-only (B, no pass) → `newWordScore = 0` → `requiresNewWordRetake`.
(Single-class same-session works because `newWordStartIndex` is frozen at the day's base at session start; only
a FRESH cross-class resume reads the already-advanced TWI — hence flag-ON + cross-class specific.)

**Impact.** The partial-day-switch cohort (이주헌/박주하/손진욱 pattern) — pass new in one class, finish the
review in another — hits a spurious retake, and the retake advances into the next day's words (content skip).
Still net-better than flag-OFF (which reset the whole day counter), so keep the flag ON; but this is a real
flagship-flow defect to fix.

**THREE coupled failure modes (all must be fixed together) [Codex RS3-1 / RS4-1]:**
1. **Gate lookup** — the cross-class position-consistency check should verify the passed attempt is consistent
   with the CURRENT reconciled position by `attempt.newWordEndIndex + 1 == currentTWI` (A's `2p-1+1 == 2p` ✓),
   OR pass the completing DAY's base (`TWI_at_start_of_day_D`) as `expectedBase` instead of the post-pass TWI
   (`sessionConfig.newWordStartIndex`).
2. **TWI double-advance** — even if (1) lets the review complete, `completeSessionFromTest` takes
   `wordsIntroduced = sessionConfig.newWordCount` (`studyService.js:1269`) → summary → `recordSessionCompletion`
   ADDS it to twi (`progressService.js:462`). B's fresh session computed `newWordCount = pace` at the advanced
   base `2p`, so completing the B review pushes twi `2p → 3p` — the student **skips Day-3's words** (marked
   introduced without study). Root cause = B re-inits a resumed review as a fresh new-word day; the fix must
   make a cross-class REVIEW resume carry `newWordCount = 0` (new already done in A) so twi is NOT re-added.
3. **Cross-class convergence** — the review is paired to the ANCHOR's class (`getReviewForDay`
   `where classId == anchorClassId`, `db.js:3407-3416`), but phase detection is list-scoped
   (`getRecentAttemptsForClassList`, `db.js:3119-3128`). So a Day-D review completed in B (non-anchor) is NOT
   found when reconciling the anchor in A → `A_L` stays `csd=D−1` (review pending) while `B_L` is `csd=D` → the
   classes DIVERGE and re-entering A can re-prompt the review. The fix must ensure a review completed in ANY of
   the student's classes resolves the day for BOTH class_progress docs.

**Fix direction.** All three; touches the reconciliation-adjacent gate + session-init/`recordSessionCompletion`
+ review-pairing → route through the loop/Codex review. **Acceptance: after a cross-class review completion,
entry from EITHER class on that list resolves to the same completed-day state.**

**Effort/risk.** Small code change, but on the hardened list-scoped path — must be reviewed + regression-tested.
**Run S overlay S-1/S-3 is the regression test** — asserts CORRECT behavior (review completes, no retake, AND
final `twi` stays the anchor TWI `2p`, not `3p`) → expected-RED against current code until this ships.

## 12. Cross-class list carry INTERMITTENTLY strands class-promoted students at Day 1  ·  reconciliation/client  ·  MED (real, CS-confirmed 2026-07-13)
**Symptom:** a student promoted to a new class on the SAME list (e.g. INT→ADV, both Ascent `dVliNv0p`) sometimes sees the list at **Day 1 / 0 introduced** in the new class instead of their carried progress. CS-confirmed for 3 of 안이연/유혜준/Lucy (26SM ADV[한]); reconciled manually (SUPPORT_RUNBOOK CS-2026-07-13).
**What it is NOT (ruled out read-only):** not a missing index (composite #13 present), not an anchor-query error (`csd_anchor_query_error` = 0 cohort-wide), not the anchor query itself (`getMostRecentPassedNewTest`, db.js:3250, IS student+list scoped and returns the correct cross-class anchor when run directly). The reconciliation is designed to carry (safeTWI = anchor `nwei+1` when found).
**Evidence it's real:** Lucy (luckyjiu1004) finished Inter[한] to day 11 (nwei 879, by 7/06), then on 7/07 started ADV[한] at **Day 1** and re-did days 1–5 — despite `csd_twi_reconciled` firing on her ADV[한] loads (7/09–7/13). So the reconciliation RAN but applied her ADV[한]-native position, not the 879 Inter[한] anchor. Meanwhile the SAME mechanism carried correctly for 홍승연 (Inter→Adv), 6 Final-movers, and Sarah Sung (into ADV[한]) → INTERMITTENT.
**Where to look:** app-level session build / class-switch / progress-caching on the promoted entry (initializeDailySession → getOrCreateClassProgress ordering; getPrimaryFocus/class context; any sessionStorage/context caching of a prior class's session). Needs an app repro with reconciliation logging (can't pin from Firestore data alone). Blast radius: every class-promotion on a shared list; silent (student just re-does words). Workaround: manual reconcile (`scripts/cs/reconcile-ascent-carry.mjs`) or possibly a plain re-entry.

## 13. Test size mis-generated at boundaries (day-1 enrollment / post-promotion retake / dup re-serve)  ·  backend/test-gen  ·  MED (CS-observed 2026-07-13)
Multiple students got a WRONG-sized test at an edge, while the class config was correct. VERIFIED: 이혜성
(hyeseong1028, 미주 INT, cross-class Inter+Adv) — class `testSizeNew=30` but her **Day-1 new test = totalQ=10**
(introduced 80 words), Days 2-4 correct at 30 → self-healed. 김호형 (Adv E→Final A promotion, David self-flagged
UNRESOLVED) — retake showed out-of-30 not out-of-35 (Final pace-100 → 35); could NOT verify (email no auth record).
이서현 (INT B3 d9) — 15 questions, David: "같은 시험을 여러번 보게 돼서 꼬임" = duplicate/re-serve. (Adv A2 12/12 =
legit list-end remainder, benign.) Pattern = test-generation size wrong at day-1 / promotion-retake / dup.
**Action:** read-only cohort audit of `attempts.totalQuestions` vs the class's `testSizeNew` to size it, then
find the generation path (first-day/enrollment race? cross-class config pick? retake size source?). See
`docs/audits/TA_CHATLOG_TRIAGE_2026-07-13.md` N1.

## 14. Permanent-fail deadlock: grader false-negative + challenge-token exhaustion + no teacher override  ·  grader/product  ·  HIGH (recurring, CS-2026-07 heavy load)
A SECOND stuck-state class (distinct from #11). When the AI grader DETERMINISTICALLY marks a correct answer wrong
AND the student has no challenge tokens left, they can NEVER pass ("정답과 똑같이 써도 오답, no matter how many times,
always fail" — 양서현, Final A). Recurred all week (이서현, 김재민, 윤여진, 안예진's classmate). Compounding factors:
(a) grader calibration false-negatives on defensible/Korean-def answers (existing #2); (b) NO teacher grade-override
path (existing #1) — only escape is off-platform 수기채점; (c) challenge tokens **replenish 30 days** after use
(VERIFIED in `users/{uid}.challenges.history` replenishAt = +30d), but TAs were told "resets next week" → wrong
guidance, students tokenless far longer; rejected challenges ALSO consume a token; (d) **promoted students often
lack challenge/grade permission in the new class** ("승반한 친구라 단어 권한이 없습니다") → TA can't even manual-fix.
**Action:** the durable fix is the teacher grade-override (#1) + grader calibration (#2); short-term, fix the CS
guidance (30-day replenish) and the promotion permission gap. See triage N2.

## 15. No review-RETAKE path; reviews are non-gating so an accidental/garbage review is permanent  ·  product  ·  MED
박서준 (INT B3) accidentally submitted his Day-7 review, scored 2%, wants a retake — no mechanism exists. Because
reviews always "pass" (non-gating; they don't block CSD), a mis-submitted or near-zero review still advances the
day and can't be redone (김지오 asked to roll back a below-cutline review-advance — that's by DESIGN, not a bug,
but it exposes the gap). Also ties to #11-throttle: chronic near-zero reviews (이서현 13/20%, Junseo 27/10/40)
that still "pass" drive intervention→1.0 → newWordCount=0 → the #11 review-only freeze MID-list. **Action:**
consider a review-retake affordance + surfacing review quality to teachers (a student passing reviews at 13% is a
pedagogy signal the current model hides). See triage N3/N4.

## 16. #11-fix flaw: csd advances on THROTTLE review-only days → recovery-defeating "review-racing" loop  ·  backend/intervention  ·  MED-HIGH (CS-observed 2026-07-16)
The deployed review-only completion fix advances csd on ALL review-only days, incl. THROTTLE ones (words remaining). Throttle should HOLD the student on review to recover; instead they sprint through Day N→N+1→N+2 Review, rush, score 0, and the rushed 0s refill the last-3 review window and cancel their good scores → they can't recover despite scoring 77-100% on the days they engage (이아연/김시연/조예서). Recovery DOES work (reviews save; 1-2 genuine good reviews → new words next day) so it's UX-defeating, not a dead-end. Fix: don't advance csd on throttle review-only days (only list-end); and/or exclude rushed/auto-advanced review-only days from the intervention window; and/or soften throttle for the high-new/low-review profile. Full writeup: `audit/deepfix/THROTTLE_REVIEWONLY_ADVANCE_FLAW.md`. Decision 2026-07-16 (David): no manual override — self-heal.

## [2026-08-03, DEEPFIX2 r74/O3; mechanism CORRECTED r75] addWord-after-delete position COLLISION
`src/services/db.js`: `deleteWord` (:658-668) deletes the doc and decrements `wordCount` — it does NOT
reindex, so a middle deletion leaves a permanent GAP. `addWordToList` (:599-621) and `addWordsBatch`
(:709-744) allocate `position: wordCount` — the DECREMENTED count — so the next add after a middle
deletion COLLIDES with the word already holding that position (a batch add mints a RUN of duplicates).
The review-v2 engine refuses duplicated lists whole (`list_words_malformed` — ruled refuse, 17_ §5);
gaps are servable + warned (`positionGap`). Fix when carded: allocate `max(existing position)+1` in both
add paths (a delete with no subsequent add stays a gap, governed by warn-and-serve). The read-only sweep
(scripts/deepfix2/list-position-sweep.mjs, receipt in docs/plans/deepfix2/evidence/) re-runs before 26SM
meets the engine; any flagged list needs repair first.

---

## #NN — TEACHER IS SELF-ASSERTED AT SIGNUP, AND ANY TEACHER CAN WRITE ANY STUDENT'S DATA
**Found:** 2026-08-03, DEEPFIX2 rules panel (round-2 reviewers, independently). **Live today. Not caused
by DEEPFIX2.** **DAVID'S DECISION — a product call, not a code fix I should make unilaterally.**

**What's broken.** `src/pages/Signup.jsx:124-149` renders a public **"Teacher" radio** on the signup form;
`src/pages/Signup.jsx:38` passes it to `createUserDocument`, and `src/services/db.js:254` writes
`role: docOverrides.role ?? 'student'` **verbatim** — no invite code, no approval, no verification. Anyone
with an email address holds `role: 'teacher'` from account creation.

Security rules resolve `isTeacher()` off that same self-asserted field, and the LIVE ruleset grants
(`firestore.live.rules:45-48`, carrying its own `TODO(security)` admitting the grant is overly broad):

```
match /users/{userId}/{subcollection}/{docId} {
  allow read:  if isAuthenticated() && (isOwner(userId) || isTeacher());
  allow write: if isAuthenticated() && (isOwner(userId) || isTeacher());
}
```

⇒ **a self-registered "teacher" can read and write EVERY student's `study_states`, `class_progress`,
`list_progress` and session records — regardless of class membership** — plus read every student's
attempts surface and rewrite `ap_answer_keys` (`ap_answer_keys` is `read, write: if isTeacher()`).

**What the DEEPFIX2 rules artifact does and does not do.** It closes in-place elevation of an EXISTING
account (`role` unchangeable on update; user-doc delete closed so delete-then-recreate cannot bypass it)
and it keeps the nine engine subcollections + six label fields unwritable **by teachers too**. It does
**not** make `teacher` a privilege boundary, and it must not be described as doing so. The artifact's new
`ai_metering` / `ops_metrics` teacher-reads inherit the same weakness (both hold usage/ops counters, no
student-identifying content).

**Options for David (roughly increasing effort):**
1. **Remove the teacher radio from public signup** — teachers created by an admin/CS flow or an invite
   code. Smallest change; closes open registration immediately. (Existing teacher accounts unaffected.)
2. **Scope the teacher grant to class membership** — replace the blanket `isTeacher()` branch with a
   membership check (`studentIds`/`members`). Correct fix; needs a careful audit of every teacher surface
   that reads student subcollections, so it wants its own workstream.
3. **Move `role` to a custom auth claim** — set server-side, unforgeable, and rules read `request.auth.token.role`. Strongest, biggest migration.

**Interaction with DEEPFIX2:** none blocking. The engine's own authority is server-side (Admin SDK), and
its label fields are already denied to teachers. This is an independent, pre-existing exposure.

---

## #NN — GATE-4 BACKFILL TRUSTS A CLIENT-WRITABLE FIELD (`answers[].gradedIsCorrect`)
**Found:** 2026-08-03, DEEPFIX2 rules panel r5. **Rules CANNOT fix this** — Firestore rules cannot
inspect fields inside array elements. It must be handled in the backfill.

**What's exposed.** `functions/reviewV2/stamping.js:46` describes `gradedIsCorrect` as "append-only
grading truth… the preimage is written ONLY where absent (first adjudication wins; a second accept
cannot launder the preimage)". It lives *inside* the `answers` array. The live attempts rule lets a
student replace that whole array on their own attempt:

```
allow update: if ... (resource.data.studentId == request.auth.uid
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['answers'])) ...
```

`hasOnly(['answers'])` constrains WHICH top-level key changes, not what goes inside it. So a student
can rewrite every `gradedIsCorrect` value in their own attempt history.

**Why it matters at GATE 4.** `scripts/deepfix2/b1-replay-lib.mjs:99` consumes it as authority:
`if (typeof r.gradedIsCorrect === "boolean") gradedOk = r.gradedIsCorrect;` — so the backfill would
mint forged history into the six server labels, which the new ruleset then freezes as immutable server
truth. **This is the same laundering shape as the reset fence**, which was closed at the rules layer;
this one cannot be.

**Options before the backfill runs:**
1. **Backfill ignores it** — recompute correctness from the stored answer + the word, never trust the
   stored boolean. Safest; changes replay semantics, so it needs its own verification.
2. **Cross-check** — trust `gradedIsCorrect` only when a `challenges.history` / `system_logs`
   adjudication record corroborates it; treat uncorroborated values as absent.
3. **Read-only sweep first** — scan 26SM for attempts whose `gradedIsCorrect` disagrees with a
   recomputation, and quantify the population before deciding. (Cheapest first step.)

**Not urgent for the rules deploy** — the ruleset is strictly safer than live either way. It IS a
prerequisite for **gate 4 (the 26SM backfill)**, alongside the rules leg itself.

