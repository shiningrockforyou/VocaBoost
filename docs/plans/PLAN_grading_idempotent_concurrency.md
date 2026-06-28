# PLAN — Idempotent, concurrency-safe grading (single logical outcome per test)

> Naming (Codex recheck #7): "single logical outcome per test," NOT "single-attempt-per-test" — retakes
> intentionally create multiple immutable submission docs (§3.4); the *outcome pointer* (§3.6) is what's
> singular per logical test, not the attempt count.

Status: **v7 — design-only, NOT implemented. Review-complete: Codex verdict implementation-ready**
(3-agent §7a + 6 Codex rechecks §7b-g; 0 remaining design blockers). Implementation gated on (a) the
W3 attempts create-lockdown + G2 enforcement prerequisites, (b) passing the §7 test suite, and (c)
explicit owner go-ahead (no code/commit without it).
Scope: the typed-test grade→write→side-effect path. Sits on top of the existing server-authoritative
work ([[PLAN_server_authoritative_grading.md]], [[PLAN_grading_writepath_program.md]]) and the
malform fix ([[PLAN_typed_grading_malform_fix_v1.md]]). Subsumes NEED_TO_FIX #3 (`listId:null`) and
#4 (error-modal UX), and closes the multi-attempt concurrency hole.

---

## 1. Problem

Two related failures, both traced from the 2026-06-28 grading-failure audit:

1. **Lost-grade / re-grade window.** `gradeTypedTest` grades + returns but does **not** persist; a
   separate `submitVocabAttempt` writes. If the grade response is lost (timeout, tab close, network),
   the client retries and **re-grades from scratch** — there is no "is my grade already done?" check on
   the grade call (the existing `readExistingAttemptForContext` short-circuit only fires for
   `writeContext`, which the current client does not send to `gradeTypedTest`). Surfaces as a false
   "Grading Failed" even when the server succeeded.

2. **Multiple attempts for one logical test ("shoved into the cloud").** The attempt identity is
   `attemptDocId = ${uid}_${testId}_${nonce}` where `nonce` is **random and stored per-browser in
   localStorage** (`getOrCreateAttemptNonce`, `testRecovery.js`). The write transaction
   (`writeAttemptTxn`) is idempotent **only on that exact docId**. So two submissions of the *same*
   test from **different devices / incognito / cleared storage / a second tab that regenerated the
   nonce** produce **different docIds → two separate attempt docs**, each graded, each written, plus
   **client-side study_state side-effects applied twice**.

## 2. Concurrency hazard taxonomy (what actually breaks)

| # | Scenario | Today | Severity |
|---|---|---|---|
| **H1** | Same docId, overlapping calls (double-click, callable retry overlaps the original) | Write is race-safe: `runTransaction` get-then-set, first wins, others read-existing → no-op. Both may still call the AI (cost only). | Low (already safe) |
| **H2** | **Different docId, same logical test** (2 devices, 2 tabs w/ separate storage, incognito, cleared storage mid-test) | **Two attempt docs written for one test.** Idempotency keyed on docId can't see the sibling. | **HIGH — the real bug** |
| **H3** | Client-side study_state effects (`processTestResults` counters, `graduateSegmentWords`) | Guarded only by `resultsProcessedRef` **per React mount**. Two mounts/devices ⇒ **double increment / double graduation**. | **HIGH** |
| **H4** | Day advance + side-effects (`completeSession`) | NOT a simple double-increment: `updateClassProgress` writes an **absolute** `currentStudyDay+1` guarded by an expected-day check (progressService.js:396-415), so concurrent same-day calls usually *converge*. The real risks are: **non-atomic clobber** of progress fields, **duplicate random session/attempt docs**, **repeated randomized graduation** (`graduateSegmentWords` shuffle, studyService.js:1019), and side-effects outside `class_progress`. | **MED/HIGH** |
| **H5** | `listId: null` reaches grade | Server backfill can't run. Must **fail closed** — a class can have multiple assigned lists, so the server cannot safely *infer* listId from assignments (Codex #8). | MED |

Root cause shared by H2–H4: **identity is per-browser-random, and the score + side-effects are applied
client-side after a non-authoritative grade.** The fix is NOT "one doc + fold everything into a
transaction" (that v1 idea is retired — see §7a/§7b: it breaks retakes, can't run AI in a txn, and
trusts client authority). The fix is a **server-owned claim → grade → finalize state machine** with
**immutable submission records** + a **deterministic logical-outcome pointer**.

> **v1 → v2.** §3 below is the rewritten design (post 3-agent + Codex review). The retired v1 (single
> overwritable doc, AI-in-transaction, fold-all-side-effects) is preserved only as the review records in
> §7a/§7b so the reasoning trail survives. Do not implement v1.

## 3. Design (v7 — claim / grade / finalize state machine; incorporates 6 Codex rechecks, see §7b-g)

Seven components (Codex "Required architecture"). The throughline: **AI runs outside any transaction;
transactions only do fast claim + finalize; identity for *dedup* is a logical key, but submissions
themselves are immutable and history-preserving.**

### 3.1 Server-owned test session / generation (authoritative `startTest`, server-allocated generation)
A trusted record the **server derives** — NOT a persisted copy of the client payload. **`startTest` is a
server callable invoked BEFORE questions are presented** (Recheck-3 Blocker 2): it independently
re-derives `{uid, classId, listId, studyDay, sessionType, testType, segment, wordAllocation,
totalQuestions, isFinalTestOfDay, currentGeneration}` from server-trusted state (enrollment + assignment
+ reconciliation/anchor → the authoritative studyDay/segment/allocation), persists it, and returns it to
the client to drive the test. Persisting a client-supplied payload at first-grade does **not** establish
authority, so "create at first grade" is removed — the snapshot must exist (via `startTest`) before any
grading. This is the anti-forgery spine: **claim/grade/finalize trust THIS, not client-sent
studyDay/segment/final-test fields** (`assertCanWriteAttempt` validates enrollment + list entitlement
only, NOT studyDay/segment/anchors/eligibility, functions/index.js:254). It also fixes the day-derivation
problem: studyDay is *derived/corrected* client-side today (TypedTest.jsx:749-790, logs
`attempt_day_fallback`/`attempt_day_context_invalid`, written `studyDay || null`) — unreliable as an
identity source; `startTest` makes the server the single authority for it.

> **Re-derivation must be complete.** `startTest` has to reproduce what the client currently computes for
> segment/word-allocation (the study-set builder) on the server. If that re-derivation is not fully
> specified/portable, this blocks — do not fall back to trusting the client payload.

**`startTest` must itself be concurrency-safe (Recheck-4 Blocker 1)** — otherwise two devices each call
`startTest`, get different snapshots/generation, and re-fork the very thing this plan closes. Define:
- **Deterministic session key (epoch-scoped):**
  `test_sessions/{uid}_{classId}_{listId}_day${studyDay}_${sessionType}_e${resetEpoch}`.
  **NOT keyed by testType** — a typed→mcq review retake (after 3 tries, sessionService.js:343-356) is the
  *same logical session*; it updates this one doc (bumps `testType`/generation), it does not create a new
  session. studyDay here is the server-derived value (so two tabs can't key on different days). The
  **`resetEpoch` suffix is the integration fix (Recheck-5 Blocker)**: after a reset bumps the scope epoch
  (§3.6), a brand-new test keys on the NEW epoch, so it can never collide with stale pre-reset
  session/job/submission docs still awaiting async cleanup, nor read a pre-reset result.
- **Transactional create-or-return reading the live epoch:** `startTest` reads the **current scope
  `resetEpoch` transactionally**, builds the epoch-scoped key, then reads the session ref; if absent,
  derive + create it (`currentGeneration: 1`, stamped with `resetEpoch`); if present, return it. Two
  concurrent `startTest` calls converge on one session/generation. The returned snapshot carries
  `resetEpoch` so all downstream keys (job, submission, ledger) inherit it.
- Generation increments (retake, §3.2) are transactions on **this** session doc, so allocation authority
  and the session snapshot live in the same place.

**Generation allocation is server-only and transactional (Recheck Blocker 2).** The client NEVER chooses
a generation. Rules:
- A **retry** of an in-flight/lost grade reuses the **current** generation (→ same jobKey → dedup).
- A **genuine retake** allocates a **new** generation, but only when the current generation's job is
  `finalized` AND retake-eligible (e.g. finalized-but-failed, or product allows re-attempt of a pass).
  Allocation = a transaction on the test-session doc: `currentGeneration += 1` gated by "current job
  finalized + eligible." This is how concurrent devices distinguish *retry* (no finalized job yet → same
  gen) from *retake* (finalized → one device wins the increment, the other sees the new gen and joins it).
- Until the current generation is finalized, **no new generation can be allocated** — so two devices
  hammering submit converge on one job, never fork into parallel retakes.

### 3.2 Transactionally-claimed grading job (the dedup + single-flight primitive)
Key the job by the **logical test**, INCLUDING testType to avoid the typed/mcq collision Codex #5 found
(review retakes switch typed→mcq after 3 tries, sessionService.js:343-356; the empty-review automarker
— today `${uid}_${classId}_${listId}_day${N}_review_automarker`, :356 — is also in this namespace and
MUST become epoch-scoped too, `…_review_automarker_e${resetEpoch}` (Recheck-6), so a post-reset marker
can't collide with the pre-reset one before cleanup finishes):

```
jobKey = `${uid}_${classId}_${listId}_day${studyDay}_${sessionType}_${testType}_gen${generation}_e${resetEpoch}`
```

`claimJob` runs a **tiny, fast** transaction over `grading_jobs/{jobKey}`. **No AI, no slow work inside
this txn** (Codex #1: Firestore re-runs txn callbacks + ~20s lock deadline; grading runs far longer →
AI-in-txn aborts under the very contention we target). The jobKey carries `resetEpoch`; **claim and
finalize both re-read the scope's current epoch in their txn and reject on mismatch** (`failed-
precondition`), so a job minted under a pre-reset epoch cannot finalize into a reset scope (Recheck-5
Blocker; complements the §3.6 epoch assertion).

**LEASE_MS requirement (Recheck-5):** set `LEASE_MS` **longer than the maximum grading duration**, OR
**renew the lease during grading** (heartbeat the `leaseExpiresAt` while the AI call is in flight).
Otherwise a normal (non-stalled) grade can outlive its lease and be fencing-rejected at the
`claimed→graded` write. Pin LEASE_MS against the gradeTypedTest p99 latency + margin.

**Lease + fencing (Recheck Blocker 1)** — a bare `status:'claimed'` strands every retry forever if the
worker crashes. The job carries `{status, leaseId, leaseExpiresAt, attemptCount, workerResult}`:
- **Claim:** create-if-absent with `status:'claimed'`, a fresh `leaseId` (fencing token),
  `leaseExpiresAt = now + LEASE_MS`, `attemptCount: 1`.
- **Expired-lease takeover (claimed):** if present AND (`status:'claimed'` AND `leaseExpiresAt < now`),
  the txn **takes over**: new `leaseId`, extend lease, `attemptCount += 1`, AND re-grade (the AI result
  was never persisted). A live (unexpired) claim → return "in progress" (caller waits/polls; §3.7).
- **Graded-recovery takeover (Recheck-3 Blocker 1):** if present AND `status:'graded'` (worker persisted
  the AI result onto the job, then crashed before finalize) — regardless of lease expiry — a retry txn
  **issues a NEW finalize lease** (`leaseId`, `leaseExpiresAt`, `attemptCount += 1`) WITHOUT re-running
  AI, then proceeds to finalize (§3.5) using the **persisted** `workerResult`. This is the missing branch:
  `graded` is a durable checkpoint, so recovery from it must never re-grade, only re-acquire finalize
  authority. A live finalize lease on a `graded` job → "in progress". A `finalized` job → return result.
- **Conditional transitions only:** `claimed → graded → finalized`, each a transaction that asserts the
  expected current status (no skips, no backward moves). The graded checkpoint persists `workerResult`
  so finalize is replayable from durable state.
- **Stale-worker rejection (fencing) — explicit policy (Recheck-4 High 2):** a write transition
  (`claimed → graded`, `graded → finalized`) requires **BOTH** (a) the job's `leaseId` equals the worker's
  held `leaseId` **AND** (b) `leaseExpiresAt >= now`. Requiring *only* matching leaseId was inconsistent:
  if no takeover occurred, an expired worker still matches its own leaseId and would wrongly be allowed to
  finalize. Under the chosen policy, a worker that stalled past its lease — even with no competing takeover
  yet — **cannot complete**; it must first re-acquire via the takeover path (§3.2 claimed/graded takeover,
  which mints a new leaseId / extends the lease), then proceed. This makes "your lease expired" always mean
  "stop and re-acquire," never "finish anyway." Use the **server timestamp** for all lease math (not client
  clocks). Test this exact policy (an expired holder with no competitor is rejected, then succeeds after
  re-acquire).

After a successful claim, return the jobKey + leaseId; the same authed call proceeds to §3.3 grading.

### 3.3 AI grading OUTSIDE any transaction (lease holder ONLY)
**Only the current lease holder invokes the AI** (Recheck-3 correction — this is what makes it true
single-flight; the earlier "a concurrent loser may also grade is harmless" line was wrong and is
removed). A caller that did not win the claim/takeover never reaches grading — it polls job status
(§3.7). The lease holder grades via the AI (server-authoritative defs from `resolveAnswerDefinitions`,
functions/index.js:678), then transitions `claimed → graded` persisting `workerResult` onto the job
(fencing-checked, §3.2) so a lost-response retry resumes from the graded checkpoint without re-grading.
If the lease expired mid-grade, the `claimed → graded` write is fencing-rejected and the takeover worker
(which re-grades, §3.2) wins — so a stalled grade is never double-counted.

### 3.4 Immutable submission attempt (history-preserving — fixes B2/Codex #2)
Each finalize writes a **new immutable** `attempts/{submissionId}` doc where `submissionId = ${jobKey}`
(job-derived for idempotency — one submission per job/generation, a NEW job/generation per retake).
Because `jobKey` now carries `resetEpoch`, the submissionId and the §3.5 ledger keys (also
`${submissionId}`-derived) **inherit the epoch automatically** — so no post-reset submission/ledger can
collide with a pre-reset immutable attempt awaiting cleanup (Recheck-5 Blocker). This preserves what the
system actually requires:
- `studyService.js:69-78` selects the **best passed** new-word attempt (sort passed, then score) — needs
  *all* attempts present, not one overwritten doc.
- Gradebook/history expose individual attempts; `timesTestedTotal` counts them; challenges + teacher
  adjustments are tied to a specific attempt ID.
- A failed→passed retake works because each is its own doc (first-write-wins on a *single* doc would
  drop the passing retake → stuck student; last-write-wins would lose history — both rejected).

### 3.5 Finalize transaction (verifies job, writes deterministic effect ledgers)
A second **fast** transaction: read the job (must be `graded`, owned by uid), then atomically:
`status: finalized` + write the submission + apply side-effects **via deterministic per-effect ledgers**
so replay is a no-op. Side-effects are NOT a naive helper-move (Codex #9: `processTestResults` is shared
by BlindSpotCheck.jsx:128 + MCQTest.jsx:698 — moving it would break the non-test consumer; and
`graduateSegmentWords` is random, studyService.js:1019, so not idempotent):
- **study_state counters:** write a ledger keyed by `(submissionId)` so a given submission's deltas
  apply once; keep the client `processTestResults` for BlindSpot or have it call the same server path —
  decide in impl, but do NOT silently change the shared helper.
- **graduation:** make deterministic first (seed shuffle from submissionId, or stable word order) so a
  txn retry / replay graduates the *same* words.
- **day-advance:** the real failure is non-atomic clobber, not double-increment (H4 corrected;
  updateClassProgress writes absolute `currentStudyDay+1` with an expected-day guard,
  progressService.js:396-415). Advance inside a txn on `class_progress`: set `currentStudyDay =
  job.studyDay` (absolute, from the *server* session) iff `currentStudyDay == job.studyDay-1`, and record
  `lastFinalizedJob` to make replay a no-op. Reconcile the two "current day" notions (stored CSD vs
  attempt studyDay) or derive CSD purely from the anchor query (reconciler already does, :131-155).

### 3.6 Deterministic logical-outcome pointer (+ mutation/deletion maintenance)
A small doc `attempt_outcomes/{uid}_{classId}_{listId}_day${studyDay}_${sessionType}_e${resetEpoch}`
(**epoch-scoped — Recheck-6**; per session-type, spanning its typed+mcq submissions) pointing to the
**accepted/best** submission for that logical test. Readers (reconciliation anchor, day-gate, gradebook
summary) consult the pointer while raw submissions remain the immutable audit trail.

> **Epoch on the pointer + automarker closes the last two races (Recheck-6).** Without it: (1) a
> post-reset completion overwrites the *epochless* outcome pointer, then the async old-epoch cleanup
> deletes that just-written pointer; (2) a post-reset empty-review automarker collides with the
> pre-reset marker before cleanup finishes. Fix = **both** belt-and-suspenders:
> - **Identity:** the outcome pointer key AND the automarker id (§3.2 namespace) carry `_e${resetEpoch}`,
>   so post-reset writes land on a different doc than anything awaiting cleanup.
> - **Conditional cleanup:** the idempotent batched cleanup (§3.6 reset) deletes a doc **only if its
>   `resetEpoch < currentEpoch`** (verify epoch in the delete), so it can never delete a current-epoch doc.
> - **Readers select only the current epoch** (read the scope's `resetEpoch`, then the epoch-scoped key) —
>   a stale-epoch pointer/marker is invisible to readers even before cleanup runs.

**"Best" needs an exact total ordering (Recheck-4 Medium 4)** — ambiguous for multiple passed attempts,
equal scores, force-pass, challenge changes, and typed/mcq ties. Deterministic comparator (first wins):
1. **accepted/force-pass flag** (teacher override / force-pass beats organic) — define the force-pass
   policy explicitly (does a later organic pass supersede an earlier force-pass? default: force-pass is
   sticky unless re-overridden);
2. **passed** (true > false);
3. **score** (higher);
4. **generation** (higher = more recent retake);
5. **submissionId** (lexical) as the final deterministic tiebreaker.
This must be a pure function so recompute is stable regardless of which path triggers it.

**The pointer is derived state, so EVERY path that mutates/deletes a submission must maintain it
(Recheck Blocker 3 — verified these paths exist and touch attempts post-finalization):**
- `reviewChallenge` accept flips `isCorrect`/recomputes `score`/`passed` (db.js:1212-1219, 1376-1383) →
  can change which submission is "best passed" → must recompute the pointer in the same write.
- the planned **teacher grade-override / force-pass** ([[PLAN_teacher_grade_override.md]]) → same.
- **orphaned-review deletion** (progressService.js:77, logs `orphaned_attempt_deleted`) and **class/list
  progress reset** batch-delete (db.js:2957-3014) and **student self-delete** (firestore.rules:120-121)
  → can delete the pointed-at submission → pointer dangles.
**Rule:** make the pointer a **server-recomputed projection** maintained **transactionally**, not by an
async trigger as the authoritative path (Recheck-3 Blocker 3). A trigger can leave the pointer
referencing an existing-but-no-longer-best attempt, which a reader **cannot** detect as stale without
querying all submissions — defeating the point of the pointer. Therefore, **as a hard precondition of
Phase 2:**
- **Remove direct client attempt deletion** — `firestore.rules:120-121` currently lets a student
  `delete` their own attempt (progress reset). Under outcomes this races the pointer. Replace with a
  **server `resetProgress` callable**.
- **Reset is an epoch/tombstone, NOT one giant transaction (Recheck-4 High 3)** — a scope can hold
  hundreds of attempts/jobs/sessions/ledgers/outcomes; Firestore can't promise that all-or-nothing in a
  single transaction (today's reset, db.js:2957-3014, batch-deletes attempts only). Instead: **(1)** one
  small transaction bumps a `resetEpoch` (or writes a scope tombstone) on the class_progress/session
  scope — this **immediately invalidates the scope and blocks finalization** (finalize asserts its
  session's epoch == current epoch in its txn, else aborts → no zombie finalize writes into a
  being-reset scope); **(2)** then **idempotent batched cleanup** deletes attempts + jobs + sessions +
  ledgers + outcomes in chunks, re-runnable to completion — **each delete conditionally verifies
  `doc.resetEpoch < currentEpoch`** so cleanup can never delete a doc written under the new epoch
  (Recheck-6 race #1). Readers treat a tombstoned/epoch-stale scope as empty AND select only
  current-epoch keys. Atomic *invalidation* without an unbounded atomic *delete*, safe to interleave
  with post-reset writes.
- **Every mutation path maintains attempts + outcome in the same transaction** — `reviewChallenge`,
  teacher override/force-pass: write the attempt change and `recomputeOutcome(uid,class,list,day,
  sessionType)` atomically.
- **Triggers are repair-only**, never the consistency authority — a backstop that reconciles drift, not
  the path readers depend on.
- Readers still fall back to the live best-passed query if the pointer is absent, so a missed repair
  degrades rather than corrupts — but correctness does **not** rely on that fallback (it's defense in
  depth, since a *stale-but-present* pointer wouldn't trigger the fallback).

### 3.7 Owner-readable job/status channel (lost-response recovery)
Replaces the v1 onSnapshot-on-attempt idea, which Codex #6 showed is unsound: rules authorize attempt
reads using fields *of an existing attempt* (firestore.rules:102), so a listener attached **before**
creation isn't demonstrably authorized, and it can deliver a stale prior doc. Instead: the client
listens to its **own grading-job** record (owner-readable by `job.uid == auth.uid`, created by the claim
it triggered) OR polls an idempotent `getGradingStatus(jobKey)` callable. A lost callable response is
recovered by reading job status → `finalized` returns the result; `graded` means "resume finalize";
`claimed` means "in progress, wait." This is the concrete answer to the user's "can the client find out
if its request is in the cloud being worked on?" — **yes, via the job record's status.**

### 3.8 Error-modal restructure (NEED_TO_FIX #4)
Driven by job status, not a bare catch:
- result arrived (callable or job=`finalized`) → results, no modal.
- transient errCode (`deadline-exceeded`/`unavailable`) AND job exists/in-progress → "Connection hiccup
  — your work is safe." (poll/await job).
- deterministic errCode (`invalid-argument`/`failed-precondition`, incl. `listId:null` fail-closed) →
  stop auto-retry; "Please reload this page and submit again."
- Drop the misleading "Your answers are saved" line on the true-failure path.

## 4. Why v2 is safe-by-construction
- **Claim txn** (fast, no AI) → exactly one job per logical test ⇒ single-flight, dedup. (H1/H2)
- **AI outside txn** ⇒ no deadline/abort under contention (Codex #1).
- **Immutable submissions + best-passed pointer** ⇒ retakes & history preserved; failed→passed works;
  gradebook/challenges/`timesTestedTotal` intact. (B2/Codex #2)
- **Server session snapshot** ⇒ finalize trusts server authority, not forged client studyDay/segment. (Codex #3)
- **Deterministic effect ledgers** ⇒ side-effects apply once even on replay; graduation deterministic. (H3/H4)
- **listId fail-closed** ⇒ never guess a list when a class has several. (H5/Codex #8)
- **job-status channel** ⇒ lost-response recovery without an unauthorized/stale snapshot. (Codex #6)

## 5. Migration / rollout (must not break in-flight students)
1. **Atomic logical-key claim, NOT a field-query dual-read** (Codex #4 / H-DUALREAD): a field query
   can't prevent an old client / old `submitVocabAttempt` Admin-SDK write from creating a nonce-ID
   attempt *right after* the query. While both schemes are accepted, the **claim/job transaction is the
   uniqueness authority** — every write path (new + legacy finalizer) must go through it. Make
   reconciliation/anchor/gradebook readers **dedup-aware** (collapse to one logical outcome per
   `(class,list,day,sessionType)`, prefer best-passed) for the mixed-scheme window.
2. **W3 attempts create-lockdown is a HARD precondition** (B4): the logical key is guessable, so without
   `allow create: if false` (W3_attempts_lockdown.rules.md) a student can pre-create
   `{passed:true,score:100}` at the predictable id and the idempotent path adopts the forgery
   (firestore.rules:106-107). W3 has its own preconditions → this couples to that chain.
3. **G2 enforcement stays ON** (B3): the finalize write MUST stamp `correctnessSource:'server-ai'` (the
   writer-API guard hard-rejects typed writes without it, functions/index.js:354-361 with
   GRADE_TOKEN_ENFORCED=true:45). Do not remove the guard/flag; retire `submitVocabAttempt`/the wire
   token ONLY after confirming zero client callers. Note the dormant `writeContext` direct-write branch
   (:837-840, 909-924) already stamps provenance — reuse, don't rebuild.
4. **Deploy order: functions-first, server-honored flag** (H-SKEW): never let a new client emit the new
   scheme before the server owns claim+finalize+side-effects, or new-client/old-server double-applies.
5. **Pre-cutover 26SM census + cleanup** (H-DUPS): read-only `data-integrity-sweep` for existing
   duplicates + invalid anchors (null `newWordEndIndex`); converge only onto *valid* anchors (repair,
   don't adopt). Enumerate + deploy the composite indexes the dedup-aware reads need BEFORE code
   (project has an index-before-deploy dependency).
6. **grade-binding id == finalize id** throughout migration (split-id token risk): a token bound to one
   id but written under another fails verification.

## 6. Edge cases to nail in review
- **Retake = new job/generation = new immutable submission**; the outcome pointer re-points to best-passed.
  No overwrite, no first-vs-last ambiguity.
- **typed↔mcq review switch** (after 3 tries): different `testType` → different jobKey/submission, same
  outcome-pointer (per sessionType). Verify the pointer's "best" logic spans both modes correctly.
- **Empty-review automarker** shares the review namespace — its id must be epoch-scoped
  (`…_review_automarker_e${resetEpoch}`, Recheck-6) so a post-reset marker can't collide with a
  pre-reset one, and so it doesn't collide with a real review submission's outcome pointer.
- Practice mode (no durable write) — unchanged, no job needed.
- **studyDay disagreement across tabs:** resolved by the server session (§3.1) owning studyDay, not the
  client — the id is built from server authority, so two tabs can't fork the logical test.
- BlindSpot's use of `processTestResults` (Codex #9) — must keep working; don't move the shared helper
  without a plan for that consumer.

## 7. Test plan (pre-ship) — v2
Codex: existing tests give NO deterministic function-level concurrency / txn-retry / migration-race /
rules-listener coverage. Add:
- **Claim concurrency (emulator/function-level, deterministic):** fire N concurrent `claimJob` for one
  jobKey → exactly one `claimed`, rest converge; assert one finalize, one submission per job/generation.
- **Txn-retry safety:** force finalize-txn contention → assert effect ledgers apply once, graduation
  picks the SAME words (deterministic seed), csd advances once.
- **Retake model:** fail→pass produces TWO immutable submissions; outcome pointer = best-passed;
  `timesTestedTotal` counts both; anchor/day-gate read the pointer correctly. typed→mcq review switch
  produces distinct submissions under one outcome.
- **Lost-response recovery:** drop the callable response → client reads job status → `finalized` returns
  result, no false "Grading Failed", no duplicate submission on retry.
- **Migration race:** old client (nonce) + new client (logical key) submit same test concurrently →
  claim txn is the uniqueness authority → one logical outcome; dedup-aware readers show one row.
- **Rules-listener auth:** verify the owner can read its own `grading_jobs/{jobKey}` (job.uid==auth.uid)
  and CANNOT read others'; verify the attempt-listener-before-create gap is gone.
- **(Recheck-5) Server-collection write-lockdown rules tests:** prove clients **cannot
  create/update/delete** `test_sessions`, `grading_jobs`, `attempt_outcomes`, or the effect `ledgers` —
  these are server-only (Admin SDK) collections. Owner *read* of jobs/sessions is allowed; ALL client
  writes denied. (Not merely "owner can read jobs" — the deny-write coverage is the security core, since
  the deterministic keys are guessable.)
- **(Recheck-5) Epoch identity isolation:** reset (epoch bump) mid- or post-test, then start a NEW test
  → new session/job/submission key on the new epoch; assert it never reads the pre-reset result and never
  collides with a pre-cleanup immutable attempt; assert a pre-reset job's finalize is rejected on epoch
  mismatch.
- **(Recheck-5) Lease vs grading duration:** assert a normal (non-stalled) grade at p99 latency does NOT
  get fencing-rejected — i.e. LEASE_MS > max grade duration, or lease renewal works.
- **(Recheck-6) Outcome/automarker epoch races:** (a) reset, then a post-reset completion writes the
  new-epoch outcome pointer; run old-epoch cleanup concurrently → assert cleanup's conditional
  `resetEpoch < currentEpoch` delete does NOT remove the new pointer. (b) reset, then a post-reset
  empty-review automarker → assert it keys on the new epoch and never collides with the pre-reset marker
  pending cleanup. (c) readers return only current-epoch outcome/marker.
- **`listId:null` → fail-closed** typed reload-error (NOT a guess from assignments).
- **Forge-by-pre-create blocked** once W3 is on (assert client create of a logical-key attempt is denied).
- **(Recheck) Worker crash + expired-lease takeover:** kill a claimed worker → assert lease expires, a
  retry takes over, exactly one finalize.
- **(Recheck) Stale-worker finalize rejected:** worker A stalls past lease, B takes over + finalizes,
  then A returns → A's write rejected by fencing (`leaseId` mismatch), B's result stands.
- **(Recheck) Concurrent retake-generation allocation:** two devices request a retake of a finalized job
  → exactly one generation increment, both converge on the new gen's job.
- **(Recheck) Challenge/override changes best outcome:** accept a challenge that flips best-passed →
  assert `attempt_outcomes` pointer recomputes; gradebook/anchor follow.
- **(Recheck) Reset during grading AND after finalization:** progress reset purges attempts + jobs +
  sessions + ledgers + outcomes (no dangling pointer, no zombie job).
- **(Recheck) Empty-review automarker participation:** assert the automarker
  (`..._review_automarker`) and a real review submission resolve to one correct outcome (no collision).
- **(Recheck) Old-client compat:** an old-client submit with NO server-session metadata still grades +
  persists (P1 keeps nonce identity) and is dedup-aware at read time.
- **(Recheck-4) Concurrent `startTest` convergence:** two devices call `startTest` for the same logical
  test simultaneously → exactly one session doc, one generation; both receive identical snapshots.
- **(Recheck-4) Expired-lease policy:** an expired lease holder with NO competitor is rejected on
  finalize, then succeeds after re-acquiring via takeover.
- **(Recheck-4) Reset epoch blocks finalize:** trigger reset (epoch bump) while a job is mid-grade →
  that job's finalize aborts (epoch stale); batched cleanup completes idempotently when re-run.
- **(Recheck-4) Outcome comparator total-order:** multiple passed attempts with equal scores + a
  force-pass + a typed/mcq tie → the comparator picks one deterministic winner regardless of recompute
  trigger/order.
- Rerun the multi-day longitudinal walk + grading-failure audit after rollout → expect 0 dup attempts,
  0 final failures. Production client build + backend syntax validation must pass (Codex verification).

## 7a. 3-agent review findings (2026-06-28) — MUST resolve before implementation

Three independent reviewers (concurrency-correctness, codebase-grounding, migration/security/rollout)
validated this plan against the live code. Consensus blockers + corrections below. Several §1–§6 claims
were **wrong or overstated** — flagged inline. Cited file:line are from the reviewers.

### Blockers (regress live students or security if shipped as written)
- **B1 — Retake "overwrite" (§3.1/§6) is BROKEN against the current writer.** `writeAttemptTxn`
  (functions/index.js:366-370) returns existing as an idempotent **no-op** when the doc exists. So with
  a deterministic `..._dayN_new` id, a student who FAILS then RETAKES-and-PASSES hits `existing.exists`
  → the passing retake **never persists** → anchor query (`passed==true`, db.js:3206-3215) finds nothing
  → CSD never advances → **stuck student** (the exact CS class in the runbook). The plan's "default
  overwrite" and "lean first-wins" are mutually contradictory AND neither is what the code does. **Fix:**
  either (a) make the passing retake a distinct queryable doc (outcome/generation in the id; keep
  `passed==true` anchor), or (b) conditional-upsert "overwrite only if new=pass and existing=fail." Pick
  one explicitly; spec the txn `update` path (current writer has none).
- **B2 — Folding study_state + graduation into the attempt txn is a cross-SDK rewrite, violates
  all-reads-before-writes, and graduation is non-deterministic.** `processTestResults` (studyService.js
  :465-501) and `graduateSegmentWords` (:986-1045) are **client `writeBatch`** code on a different
  doc-set (`users/{uid}/study_states/*`, segment reads); "fold into one transaction" = port both to
  Admin SDK with all segment reads hoisted before the attempt `tx.set` (inflates read-set to the whole
  segment, hot-doc contention). Worse, graduation picks words via `shuffleArray(...).slice` (:1019) →
  **not idempotent**; a Firestore txn auto-retries its body on contention, re-shuffling each retry. §8's
  "reuses existing helpers" is false for this piece. **Fix:** make graduation deterministic (seed from
  attemptDocId, or stable word order) BEFORE folding; OR keep side-effects out of the txn and make each
  independently idempotent + single-doc-scoped. Also note (codebase reviewer): `graduateSegmentWords` is
  **NOT** under `resultsProcessedRef` — §2/H3 overstates the guard; the graduation path is separately
  (weaker) gated.
- **B3 — Collapsing grade+write breaks the LIVE G2 enforcement contract.** `GRADE_TOKEN_ENFORCED=true`
  (functions/index.js:45) and `writeAttemptTxn:354-361` **hard-rejects** any typed write lacking
  `correctnessSource:'server-ai'`. The §3.2 pseudocode never stamps it → literal impl = **total typed
  grading outage** (permission-denied on every write). **Fix:** the in-txn write MUST pass
  `{correctnessSource:'server-ai'}` (as the existing direct-write branch does, :911-913); keep the
  writer-API guard + enforcement flag; retire `submitVocabAttempt`/token ONLY after confirming zero
  client callers. Do not frame the token as merely-removable (§5.5 overstated).
- **B4 — Predictable deterministic id + current rules = forge-by-pre-create.** Rules still allow client
  create (`firestore.rules:106-107`, create if `studentId==uid`). A guessable id (`uid_class_list_dayN_
  new`) lets a student `setDoc({passed:true,score:100})` BEFORE the test; the txn then sees
  `existing.exists` (own uid) → returns the forged doc as a no-op; real grade never overwrites. The
  random nonce was accidental protection this removes. **Fix:** the deterministic-id path MUST NOT ship
  before the **W3 attempts create-lockdown** (`W3_attempts_lockdown.rules.md`, `create: if false`) is
  live. Name W3 as a hard precondition (it has its own preconditions → couples to that chain).

### High
- **H-AI — Do NOT put the AI call inside `runTransaction`.** Txn bodies retry on contention (≤5×);
  a multi-second AI call inside re-invokes on each retry and blows the txn deadline → spurious failures
  under exactly the multi-device contention we target. §3.2 pseudocode ("graded = AI grade ... inside
  runTransaction") is a correctness hazard. **Fix:** grade OUTSIDE the txn; txn does get → if exists
  return → else set(graded). (The same-docId get-then-set idempotency itself IS sound — credit.)
- **H-DUALREAD — Migration dual-read (§5.1) as written does NOT dedup.** You cannot point-read a legacy
  `..._<random nonce>` id. The dual-read MUST be a **field query** (`studentId+classId+listId+studyDay+
  sessionType`) and the anchor/gradebook readers (db.js:3206-3215, 3041-3050, 1446-1500 — gradebook does
  NO dedup) must be made dedup-aware while mixed-scheme docs coexist, else duplicates persist and the
  `orderBy studyDay desc limit 1` anchor picks nondeterministically on ties.
- **H-DAYADVANCE — The idempotent day-advance guard does not exist as described, but a DIFFERENT real
  guard does.** Real CSD advance is a **non-transactional read-modify-write** on `class_progress`
  (progressService.js:415), gated by a day-NUMBER check (`:396-401`: skip if `sessionSummary.day !==
  storedCSD+1`). So §H4's "no date gate → double-advance" is overstated (there IS a same-day guard,
  race-losable), AND the plan's proposed `attempt.advancedDay` flag can't guard a write on a *different*
  doc. **Fix:** spec advance as a txn on `class_progress` (advance iff `currentStudyDay==attempt.studyDay-1`,
  record `lastAdvancedFromAttempt`); reconcile the TWO "current day" notions (stored-CSD vs attempt-studyDay)
  — or drop the stored counter and always derive CSD from the anchor query (reconciler already does, :131-155).
- **H-SKEW — Pin deploy order.** Client (Netlify) + functions (firebase) ship independently. New-client
  (deterministic id, expects server-side side-effects) + old-server (side-effects still client-side) =
  guaranteed double-apply of H3/H4. **Fix:** functions-first behind a **server-honored** flag; no client
  emits the deterministic id until the server txn owns the side-effects.
- **H-DUPS — Pre-existing 26SM duplicates/invalid-anchors not addressed.** Audit found dups; legacy
  `csd_anchor_invalid` docs exist (null `newWordEndIndex`). Dual-read could "adopt" an invalid anchor and
  never repair it (server refuses to *write* one, :343-348, but adoption skips that). **Fix:** read-only
  `data-integrity-sweep` census before cutover; collapse each `(uid,class,list,day,sessionType)` to one
  valid doc; converge only onto a *valid* anchor (repair, don't adopt).

### Medium / corrections to plan claims
- **studyDay is NOT reliably "known at submit"** (§3.1 keystone). It's derived/corrected at
  TypedTest.jsx:749-790 (logs `attempt_day_fallback` / `attempt_day_context_invalid`) and written as
  `studyDay || null`. The deterministic id MUST consume the post-correction studyDay; two tabs that
  disagree on the day produce divergent ids → the "one doc per logical test" invariant (§4) does **not**
  hold for that case (§6 hand-waves it). Resolve before relying on it.
- **The "single server op" already half-exists** — `gradeTypedTest` has a dormant `writeContext`
  direct-write branch (functions/index.js:837-840, 909-924) that already does grade→writeAttemptTxn and
  stamps provenance. §3.2/§8 present this as new; it's mostly *activating* a deployed path → effort for
  piece (a) is overstated.
- **`markReviewComplete` already uses the exact deterministic id scheme** this plan proposes
  (`${uid}_${classId}_${listId}_day${N}_review_automarker`, :521). Cite as precedent, and reconcile the
  mcq/review path with it (§6 "apply symmetrically" must account for this existing id).
- **onSnapshot completion-discovery (§3.3) has a stale-doc race.** `onSnapshot` fires immediately with
  the *current* doc on attach — under deterministic ids a prior/failed doc delivers instantly and the
  `Promise.race` resolves on the STALE result. **Fix:** resolve only on a freshness predicate (e.g.
  `gradedAt > submitStart` / a generation token / ignore `hasPendingWrites`), not on any snapshot.
- **Split-id token risk during migration:** client binds the gradeToken to one docId (TypedTest.jsx:695)
  but writes another (:798) if migration runs nonce-path and deterministic-path concurrently → token
  verify fails. Ensure grade-binding id == write id throughout.
- `totalQuestions` is client-supplied (writeAttemptTxn:335) — on the create path derive it from resolved
  server definitions, not `ctx`, so first-writer-wins can't be gamed.
- Enumerate + deploy the **composite indexes** the field-query dual-read needs BEFORE code (project has a
  documented index-before-deploy dependency); wrap the dual-read in the existing query-error catch pattern.

### Net reviewer verdict
Fixing identity genuinely closes **H2** (duplicate attempt docs). **H3/H4 do NOT "collapse"** — they need
independently-idempotent, deterministic, single-doc-scoped guards; the "one big transaction" approach to
them is the riskiest, least-worked part. **Block on B1 and B4 specifically** (they regress live progress /
reopen forgery). Treat §3.2's "fold everything into one txn" as the hypothesis to redesign, not a settled
approach.

## 7b. Codex project-wide review (2026-06-28) — drove the v1→v2 rewrite

Codex reviewed application, backend, rules, progress/reconciliation, challenge, gradebook, scripts, tests
(excl. apBoost) and concluded **§7a is a useful audit record but the v1 design itself must be rewritten
around a claim/grade/finalize state machine** — which §3 (v2) now is. Codex blockers (all verified
against code before the rewrite):
1. **AI cannot run inside the transaction** — Firestore reruns txn callbacks + ~20s lock deadline vs
   grading's far-longer budget; "single-flight for free" invalid. → v2 §3.2/§3.3 (claim fast, grade out).
2. **"One attempt per test" conflicts with real retake semantics** — app keeps multiple attempts +
   selects best-passed (studyService.js:69-78, verified), review switches typed→mcq after 3
   (sessionService.js:343-356, verified), gradebook/`timesTestedTotal`/challenges are per-attempt. →
   v2 §3.4 immutable submissions + §3.6 outcome pointer.
3. **Server-side side-effects would still trust client authority** — `assertCanWriteAttempt`
   (functions/index.js:254) validates enrollment/list only, NOT studyDay/segment/final-test/anchors. →
   v2 §3.1 server-owned session snapshot.
4. **Migration lacks atomic uniqueness** — field-query dual-read can't stop an old client/Admin-SDK
   write right after the query; W3 only blocks client creates. → v2 §3.2/§5.1 transactional claim is the
   uniqueness authority.
5. **Key omits testType** — `uid_class_list_day_sessionType` collides typed vs mcq (reachable via review
   mode switch) and with the empty-review automarker. → v2 jobKey includes `testType_gen`.
6. **Snapshot completion discovery not viable** — rules authorize attempt reads via existing-attempt
   fields (firestore.rules:102); a pre-create listener isn't authorized + can return stale. → v2 §3.7
   owner-readable job/status channel.
7. **H4 describes the wrong failure** — `updateClassProgress` writes absolute `currentStudyDay+1` with an
   expected-day guard (progressService.js:396), so the real risks are non-atomic clobber / dup random
   docs / repeated randomized graduation. → corrected in §2 H4 + §3.5.
8. **`listId:null` can't be inferred** — a class has multiple lists; must fail closed. → §3.8/§5.
9. **Side-effect migration is broader** — `processTestResults` also used by BlindSpotCheck.jsx:128;
   graduation random + not under `resultsProcessedRef`. → v2 §3.5 (don't silently move the shared helper;
   make graduation deterministic). All four spot-checked claims (B1-timeout, best-attempt, review
   mode-switch, BlindSpot consumer) verified true against code.

## 7c. Codex recheck of v2 (2026-06-28) — four blockers, resolved into v3 (above)

Codex re-reviewed the v2 state machine: "architecturally sound direction, but not implementation-ready
until lease/fencing, generation allocation, pointer maintenance, and safe phase boundaries are
specified." All four folded into §3/§8 (verified the mutation/deletion paths against code first):
1. **Stranded claimed jobs** (no lease/takeover/fencing) → **§3.2** lease + `leaseId` fencing + expired-
   lease takeover + conditional `claimed→graded→finalized` + stale-worker rejection.
2. **Undefined generation allocation** → **§3.1** server-allocated generation; retry reuses current gen,
   retake transactionally increments only when current job finalized+eligible; client never chooses.
3. **Outcome pointers omit mutation/deletion** (verified: reviewChallenge db.js:1212-1219, orphan delete
   progressService.js:77, reset db.js:2957-3014, self-delete rules:120) → **§3.6** pointer is a
   server-recomputed projection; every mutation/deletion recomputes; reset purges jobs/sessions/ledgers/
   outcomes; readers fall back to live best-passed query.
4. **Unsafe phase boundaries** → **§8** P1 = recovery only, NO identity change, side-effects client-only;
   P2 = identity + immutable-retake + pointer **together**; P3 = atomic client→server side-effect flip.
Additional recheck tests folded into §7.

## 7d. Codex recheck #3 of v3 (2026-06-28) — three blockers + one correction, resolved into v4

Codex re-reviewed v3: "nearly ready, but wait until graded-job takeover, authoritative test
initialization, and transactional deletion/reset semantics are specified." Folded into §3/§8 (v4):
1. **Recovery from `status:'graded'` undefined** (lease takeover only covered `claimed`; a crash after
   persisting the AI result but before finalize had no recovery) → **§3.2 graded-recovery takeover**:
   issue a new finalize lease WITHOUT re-running AI, finalize from the persisted `workerResult`.
2. **"Session at first-grade" not authoritative** (persisting client payload ≠ authority) → **§3.1**:
   an authoritative **`startTest` server op** re-derives studyDay/segment/allocation before questions;
   removed "or first-grade"; flagged that server re-derivation of the study-set builder must be complete
   or it blocks.
3. **Outcome consistency vs direct deletion** (async trigger can leave a stale-but-present pointer
   readers can't detect) → **§3.6 + §8 P2 preconditions**: remove direct client attempt deletion, migrate
   reset to a server callable, maintain attempts+outcomes transactionally, triggers are repair-only.
4. **Correction:** §3.3 "a concurrent loser may also grade is harmless" contradicted single-flight →
   fixed: **only the lease holder invokes AI**; non-holders poll status.
## 7e. Codex recheck #4 of v4 (2026-06-28) — one blocker + three specs, resolved into v5

Codex re-reviewed v4: "architecturally strong; resolve deterministic startTest convergence before
implementation; lock the other three in the implementation spec." Folded into §3/§8 (v5):
1. **Blocker — `startTest` lacked concurrency-safe identity** (two devices → different snapshots/gen →
   re-fork) → **§3.1**: deterministic session key
   `test_sessions/{uid}_{class}_{list}_day${studyDay}_${sessionType}` (NOT testType-keyed — typed→mcq
   retake updates the same session) + transactional create-or-return so concurrent `startTest` converge.
2. **High — lease-expiry inconsistency** (matching-leaseId alone lets an expired-but-uncontested worker
   finalize) → **§3.2**: transitions require **matching leaseId AND unexpired lease**; an expired holder
   must re-acquire via takeover before completing. Test that exact policy.
3. **High — unbounded transactional reset** (hundreds of docs can't be one atomic txn) → **§3.6**:
   transactional **reset epoch/tombstone** that instantly invalidates the scope + blocks finalize
   (finalize asserts current epoch), then **idempotent batched cleanup**.
4. **Medium — outcome "best" ambiguous** → **§3.6**: exact total-order comparator (force-pass → passed →
   score → generation → submissionId); **§8 P2** now explicitly depends on migrating `reviewChallenge` +
   override + reset to server transactions.
**This is v5.** Re-review v5 before implementation.

## 7f. Codex recheck #5 of v5 (2026-06-28) — one integration blocker + two impl requirements → v6 (implementation-ready)

Codex re-reviewed v5: "resolve epoch propagation; after that, the plan is implementation-ready." Folded
into §3/§7 (v6):
1. **Blocker — resetEpoch not in deterministic identity** (a post-reset test could hit a stale
   pre-cleanup session/job/submission and return the pre-reset result or collide with the immutable
   attempt) → **epoch now suffixes ALL identity keys**: session `_e${resetEpoch}` (§3.1), jobKey
   `_e${resetEpoch}` (§3.2), submission+ledger inherit via `${jobKey}` (§3.4/§3.5). `startTest` reads the
   epoch transactionally; **claim AND finalize reject epoch mismatch** (§3.2).
2. **Impl req — lease vs grading duration** → **§3.2**: `LEASE_MS` > max grading duration OR renew lease
   during grading (so a normal grade isn't fencing-rejected). Test added (§7).
3. **Impl req — rules deny-write tests** → **§7**: prove clients cannot create/update/delete
   `test_sessions`/`grading_jobs`/`attempt_outcomes`/`ledgers` (server-only), not merely owner-read jobs.
**This is v6 — Codex verdict: implementation-ready** (pending the locked impl spec + the §7 test suite).

## 7g. Codex recheck #6 of v6 (2026-06-28) — final epoch-propagation gap → v7

Codex: "v6 otherwise implementation-ready; close this final epoch gap." The v6 epoch propagation missed
two docs — the **outcome pointer** and the **empty-review automarker** were still epochless, creating two
races: (1) a post-reset completion overwrites the epochless outcome pointer, then async old-epoch cleanup
deletes that new pointer; (2) a post-reset automarker collides with the pre-reset marker before cleanup.
Resolved (v7), belt-and-suspenders:
- **§3.6** outcome pointer key → `…_${sessionType}_e${resetEpoch}`; **§3.2** automarker id →
  `…_review_automarker_e${resetEpoch}`.
- **§3.6 cleanup** deletes only when `doc.resetEpoch < currentEpoch` (never deletes a current-epoch doc).
- **Readers select only the current epoch** (read scope epoch → epoch-scoped key), so a stale doc is
  invisible even pre-cleanup.
- Tests added (§7). **This is v7 — every identity (session, job, submission, ledger, outcome, automarker)
  is now epoch-scoped; Codex verdict carried: implementation-ready.**

## 8. Effort / risk — v7
**Larger than v1's estimate** (v1 understated it). New server surface: a test-session/generation record,
`grading_jobs` collection + claim/finalize transactions, deterministic effect ledgers, an
`attempt_outcomes` pointer, a job-status callable/listener, and dedup-aware readers. Reuses
`resolveAnswerDefinitions`, the dormant `writeContext` direct-write branch, and `markReviewComplete`'s
existing deterministic-id precedent. Hard preconditions: **W3 create-lockdown** (B4) and **G2 enforcement
stays on** (B3). Highest-risk pieces: the finalize-side-effect ledgers (incl. making graduation
deterministic without changing BlindSpot) and the migration claim authority. Gate behind a
server-honored flag, functions-first, validate on 25WT before 26SM.

**Phased build — corrected for safe boundaries (Recheck Blocker 4).** The naive 1→2→3 split is unsafe:
shipping claim/dedup (P1) before the immutable-retake model (P2) risks first-write-wins retake behavior,
and deferring ledgers (P3) leaves cross-device study_state/graduation duplication live. So:
- **Phase 1 — recovery only, NO identity change.** Add the server session, `grading_jobs`, lease/fencing,
  generation, grade-out-of-txn, and the job-status recovery channel — but keep writing attempts under the
  **existing nonce identity** and keep all side-effects **client-only**, unchanged. This closes the
  lost-response/false-"Grading Failed" problem and AI-in-txn risk without touching retake semantics.
  (If P1 must dedup, it dedups the *grade call* via the job, not the attempt identity.)
- **Phase 2 — identity + retake model, shipped together with the immutable submissions + outcome pointer
  + transactional pointer-maintenance on all mutation/deletion paths.** Never introduce the
  logical/deterministic identity without the immutable-submission + best-passed-pointer model in the same
  release — otherwise first-write-wins strands failed→passed retakes. **Hard preconditions of this phase:**
  (i) W3 attempts create-lockdown; (ii) the authoritative **concurrency-safe `startTest`** op (§3.1,
  deterministic session key + create-or-return txn) so identity is built from server-derived
  studyDay/segment and two devices converge; (iii) **direct client attempt deletion removed + reset
  migrated to the server `resetProgress` epoch/tombstone callable** (§3.6); (iv) **`reviewChallenge` AND
  teacher override/force-pass migrated to server transactions** that maintain attempt+outcome atomically
  (the outcome pointer is only safe if every writer of `passed`/`score` recomputes it transactionally).
  Async triggers are repair-only, not the consistency path.
- **Phase 3 — move side-effects server-side via deterministic ledgers + day-advance.** Side-effect
  ownership stays **unambiguously client-only** until this phase flips; the flip must be atomic
  (server owns them) with the client side-effects disabled in the same release to avoid double-apply.
Each phase flag-gated (server-honored), functions-first, 25WT→26SM.
