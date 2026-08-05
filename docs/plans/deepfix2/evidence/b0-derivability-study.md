# B0 DERIVABILITY STUDY — can the pre-flip regression baseline be computed from history that already exists?

**Question.** `21_DF2-14_FLIP_ABORT_CARD.md:104-109` makes B0 a HARD pre-flip gate ("Without B0 there is
no regression signal") and states its dependency as *"the `ops_metrics` writers must be emitting R1–R7 in
production, dark, for at least the baseline window before the ACTIVATION go."* NEED_TO_FIX #30 established
that premise is FALSE. This study asks the follow-on: **for each of R1–R7, can a defensible pre-flip
baseline be DERIVED from data already stored — collapsing the "build emitters + wait a week" dependency?**

**Method.** READ-ONLY empirical probing of PRODUCTION Firestore (project `vocaboost-879c2`) via
`scripts/serviceAccountKey.json`, plus a code sweep of every Firestore write path in `/app/src` and
`/app/functions`. Doc shapes below are **sampled from production**, not inferred from code.
**Zero writes.** Read cost: **~37,400 document reads + ~130 `count()` aggregates + 100 Firebase Auth
`getUsers` lookups**. Probe scripts lived in the session scratchpad and are not committed; each was
grep-proved free of any mutating Firestore/Auth verb before execution.

**Date:** 2026-08-05.

---

## 0. THE PRECONDITION, RE-CONFIRMED

Root collections in production, with `count()` totals:

| collection | docs | | collection | docs |
|---|---|---|---|---|
| `system_logs` | **90,774** | | `classes` | 302 |
| `attempts` | **42,682** | | `lists` | 46 |
| `grading_jobs` | **17,291** | | `system_config` | 1 |
| `users` | 1,483 | | `ap_*` (apBoost) | 165 total |

**`ops_metrics` does not appear at all** — it is not merely empty, it has never held a document
(`count()` = 0; `shadow_registry` = 0; `ai_metering` = 0). NEED_TO_FIX #30 is confirmed independently.
`collectionGroup('day_completions')` = 0 and `collectionGroup('streak_credits')` = 0 — the engine's
completion family is likewise dark, as expected under `REVIEW_V2_CLIENT=false`.

**But `system_logs` is not the anomaly-only sink the card assumes.** It already carries three
production-live event families that map directly onto R2/R3/R4/R7, emitted by the **legacy** path — the
exact surfaces R1–R7 are about:

| type | rows | first seen | last seen | writer |
|---|---|---|---|---|
| `attempt_write_failed_client` | **597** | 2026-06-22 | 2026-08-05 | client, `MCQTest.jsx:914` / `TypedTest.jsx:1215`, severity `error` |
| `grading_attempt_failed` | **1,447** | 2026-06-18 | 2026-08-05 | client, `TypedTest.jsx:742`, severity `error` |
| `grading_recovered` | **117** | 2026-06-18 | 2026-08-05 | client, `TypedTest.jsx:732,763,775` |
| `progress_resolver_unavailable` | **99** | — | — | client, `progressService.js:133`, severity `error` |
| `resolve_list_progress` | **36,974** | — | — | server, `foundation.js:1766,1900,1993` (every resolution) |

That changes the answer materially.

---

## VERDICT TABLE

| # | Invariant | Verdict | Source that carries it | Baseline history available |
|---|---|---|---|---|
| **R1** | Auth / session start success | **NOT** | nothing in Firestore; Firebase Auth `lastSignInTime` is a last-write scalar, not a history; failures are GCP-side only | — |
| **R2** | NEW-word (non-review) submit success | **DERIVABLE** | `attempts` (`sessionType='new'`, `submittedAt`) ÷ that + `system_logs.attempt_write_failed_client` (carries `sessionType`) | **44 days** (failure leg from 2026-06-22) |
| **R3** | Attempt-write success rate | **DERIVABLE** | `attempts` (all, `submittedAt`) ÷ that + `attempt_write_failed_client` (carries `errCode`) | **44 days** |
| **R4** | Dashboard load success **+** client JS exception rate | **PARTIAL** — load leg yes, exception leg **NO** | load: `resolve_list_progress` (server) vs `progress_resolver_unavailable` (client). exceptions: **no producer exists anywhere** | load leg: full `system_logs` lifetime; exception leg: none |
| **R5** | Teacher gradebook / analytics load | **NOT** | zero teacher read/page-view telemetry in the entire tree | — |
| **R6** | Non-review-day completions succeeding | **PARTIAL** — successes only, no failure denominator | `users/{uid}/sessions` (17,712 docs; `completedAt`, `dayNumber`, `serverReviewOnlyDay`/`clientReviewOnlyDay`) | full lifetime, but needs one index exemption for cohort-wide reads |
| **R7** | Grading availability — **typed** | **DERIVABLE** (two independent sources) | `system_logs.grading_attempt_failed` (`isFinal`/`timedOut`/`failedFast`/`online`/`errCode`) **and** `grading_jobs` (`status`, `attemptCount`, never pruned) | logs **48 days**; `grading_jobs` **38 days** |
| **R7** | Grading availability — **MCQ** | **VACUOUS** (no grading service exists to be unavailable) | MCQ correctness is client-computed (`functions/index.js:635`); no `grading_jobs` row is ever created | n/a |

**Score: 3 derivable, 2 partial, 2 not derivable, 1 vacuous.**

---

## R1 — Auth / session start success rate · **NOT DERIVABLE**

**(b) Where it would live: nowhere.** `/app/src/contexts/AuthContext.jsx` performs **no Firestore write**
on `login` (:100), `logout` (:101), `signInWithGoogle` (:103), or `onAuthStateChanged` (:23). `signup`
(:69) and first-time Google (:113) call `createUserDocument`, which writes a *profile*, not an event.
Empirically: `system_logs` `count()` for `login` = 0, `auth_error` = 0, `app_load` = 0, and the complete
7-day type census (13,920 rows, §R4 below) contains **no auth-related type at all**. The only
auth-adjacent row that exists in code is `teacher_provisioned` (`index.js:2404`) — production count **0**.

**(c) The metric you cannot compute.** Firebase Auth *does* expose `metadata.lastSignInTime` via the
Admin SDK — I read 100 records (100/100 found, 0 notFound). It is a **single overwritten scalar, not a
history**, and there is no failure counterpart. The sampled KST-day histogram makes the bias visible:
only **4 of 100** students show `2026-08-05` even though ~248 distinct students submitted an attempt that
day. A user who signs in on day D and again on D+1 erases D. So this yields neither a per-day login
volume nor, critically, **any denominator of attempted logins** — a success *rate* is not constructible.

**(d) Window: n/a.** Login *failures* (bad password, expired refresh token, blocked popup, network) are
handled entirely inside Firebase Auth / Identity Platform. They surface in **GCP Cloud Logging /
Identity Platform audit logs**, which are outside Firestore and **cannot be queried from this
environment**. If R1 is to be watched at all, it is a GCP-console/Cloud-Logging task, not a Firestore one.

---

## R2 — NEW-word (non-review) test submit success · **DERIVABLE**

**(b) Source.** Successes: `attempts` where `sessionType == 'new'` (24,668 all-time), bucketed by
`submittedAt` (server `serverTimestamp()`, `functions/index.js:637`). Failures: `system_logs` type
`attempt_write_failed_client` — **and this is the key discovery: the failure doc carries the same
discriminators as the success doc.** Sampled production field tallies over all 597 rows:

```
sessionType: {"new": 489, "review": 108}      testType: {"typed": 513, "mcq": 84}
errCode:     {"functions/permission-denied": 471, "functions/internal": 84,
              "functions/deadline-exceeded": 21, "functions/failed-precondition": 13,
              "functions/invalid-argument": 7, "functions/unauthenticated": 1}
```

So numerator and denominator are on the same axis and a **real per-day new-word submit success rate is
computable**, not a proxy.

**(c) Computed (14-day window, KST days, from probe 06):**

| day | new-word attempts | write failures (new) | R2 success % |
|---|---|---|---|
| 2026-07-23 | 510 | 1 | 99.80 |
| 2026-07-24 | 595 | 7 | 98.84 |
| 2026-07-27 | 569 | 1 | 99.82 |
| 2026-07-28 | 473 | 2 | 99.58 |
| 2026-07-29 | 534 | 1 | 99.81 |
| 2026-07-30 | 417 | 1 | 99.76 |
| 2026-07-31 | 466 | 0 | 100.00 |
| 2026-08-03 | 321 | 1 | 99.69 |
| 2026-08-04 | 276 | 0 | 100.00 |
| 2026-08-05 | 298 | 0 | 100.00 |

**Volume-weighted 14-day B0 candidate: 4,579 / (4,579 + 14) = 99.695 %.**
(Low-volume weekend days — 5 to 20 attempts — are noise and must be volume-weighted, not averaged.)

**Blind spots, stated plainly.**
1. **This is an upper bound on true success.** The failure record is itself a client Firestore write made
   by the client that just failed a Firestore write, it is **not awaited** (`db.js:175`, and the outer
   catches likewise), and `logSystemEvent` swallows its own failure (`db.js:113-115`). The outage window
   most worth measuring is the window least likely to log. A student whose tab dies mid-failure is
   invisible on both sides.
2. **`attempt_write_failed` (the `withRetry` logger, `db.js:175`) has ZERO production rows** against 597
   `_client` rows. The cause is visible in code: `isTransientError` (`db.js:76-89`) matches **bare** codes
   (`'internal'`, `'deadline-exceeded'`, …) while **every observed production errCode carries the
   `functions/` prefix** — so the non-transient branch at `db.js:152-154` rethrows *without logging* on
   the live callable path, and `db.js:175` is effectively unreachable. Coverage is not lost (the outer
   `MCQTest`/`TypedTest` catch logs `_client`), but **`withRetry` is not actually retrying the live
   server-write path** — a secondary finding worth its own card.
3. A student who never reached submit (compose failed, page crashed) counts in neither column.

**Why the bias is nonetheless acceptable for THIS use.** R2 is a **temporal** regression signal, and the
flip does not touch `db.js`'s logger or `MCQTest`/`TypedTest`'s catch structure. The bias is therefore
**common-mode across B0 and the post-flip measurement and largely cancels in the comparison.** An
absolute-truth availability number it is not; a same-instrument before/after delta it is. Note also that
`21_`'s R2 RED rule is "drops **at all**", so a baseline biased high is biased in the *conservative*
direction.

**(d) Window.** Failure leg from **2026-06-22** (44 days). Success leg from 2025-11-24. Any 7–14 day
pre-flip window is fully covered.

---

## R3 — Attempt-write success rate · **DERIVABLE** (and richer than the card asks for)

**(b) Source.** Successes: all `attempts` rows by `submittedAt` (42,682 all-time; 8,315 in the last 14
days). Failures: the same 597 `attempt_write_failed_client` rows. Confirmed production `attempts` shape
(sampled): `studentId, testId, classId, listId, teacherId, testType, sessionType, studyDay, score,
graded, answers[], skipped, totalQuestions, credibility, retention, passed, isFirstDay, listTitle,
segmentStartIndex, segmentEndIndex, interventionLevel, wordsIntroduced, wordsReviewed,
newWordStartIndex, newWordEndIndex, submittedAt`. There is **no status/error field on `attempts`** — a
failed write produces **no document at all**, which is exactly why the `system_logs` leg is load-bearing.

**(c) Computed (14-day, from probe 06):** daily R3 write-success ranged **99.08 %–100 %** on every day
with >100 attempts (the single 97.92 % day, 2026-07-26, had 47 attempts — small-n).
**Volume-weighted 14-day B0 candidate: 8,315 / (8,315 + 43) = 99.486 %.**

**The card asks for an aggregate rate; the data supports something better.** `21_:93` says R3 is "a proxy
for the cutover-b/c seam or the namespace guards misfiring" — and **`functions/permission-denied` is
471 of 597 failures (78.9 %)**, i.e. the guard-rejection class *is* the dominant failure mode already.
So B0 for R3 should be recorded **per `errCode`**, not as one number: a post-flip regression in the
namespace guards would show as a rise in the `permission-denied` bucket specifically, which a blended
99.5 % would dilute. Recommended B0 shape: `{errCode → rate}` over the pre-flip window.

**Blind spots.** Identical to R2's #1 and #3 (self-referential logging, un-awaited writes, invisible
pre-submit failures). Additionally: `attempts` contains **synthetic rows** — auto-marker rows
(`score:100, totalQuestions:0, answers:[]`, `foundation.js:1063-1075`) and manual override rows
(`answers:[]`, dormant). These inflate the *denominator* of R3 slightly. They do not distort R3 (a
count-based rate) meaningfully but **must be excluded from any score-derived metric**.

**(d) Window.** 44 days.

---

## R4 — Dashboard load success **+** client JS exception rate · **PARTIAL** (split verdict)

`21_:94` bundles two different things. They have opposite answers.

### R4a — Dashboard load success: **DERIVABLE AS A PROXY**

**(b) Source.** `resolveListProgress` is a Cloud Function the Dashboard calls on load
(`Dashboard.jsx:1323`) and `progressService.getOrCreateClassProgress` calls on progress load
(`progressService.js:414-416`, twice with a retry). **Every** resolution writes a server-side
`resolve_list_progress` row (`foundation.js:1766, 1900, 1993`; comment at `:1896` — "EVERY resolution
logs its candidate"). When **both** calls fail, the client writes `progress_resolver_unavailable`
(`progressService.js:132-136`, severity `error`) and throws a user-visible "please reload".

**(c) Computed — full 7-day `system_logs` census (13,920 rows read):**

```
resolve_list_progress 10785 | impossible_phase_detected 2065 | csd_twi_reconciled 681
review_recorded 109 | challenge_day_advance 92 | grading_attempt_failed 49
list_progress_quarantine_candidate 29 | attempt_day_fallback 26
progress_resolver_unavailable 25 | reviewonly_derivation_mismatch 20
attempt_write_failed_client 20 | grading_recovered 15 | anchor_rejected 2
day_guard_rejected_session_cleared 2
severity: warning 13717 · info 109 · error 94
```

| day | `resolve_list_progress` | `progress_resolver_unavailable` | R4a success % |
|---|---|---|---|
| 2026-07-30 | 2,184 | 2 | 99.909 |
| 2026-07-31 | 2,564 | 4 | 99.844 |
| 2026-08-02 | 147 | 1 | 99.324 |
| 2026-08-03 | 2,116 | 5 | 99.764 |
| 2026-08-04 | 1,528 | 2 | 99.869 |
| 2026-08-05 | 1,671 | 11 | 99.346 |

**7-day B0 candidate: 10,785 / (10,785 + 25) = 99.769 %.**

**Blind spots — three, and the third is the one that matters.**
1. This measures **the progress resolver**, a load-bearing dashboard dependency, **not the dashboard
   render**. A dashboard that loads its data and then fails to paint scores 100 %.
2. **The two legs are not the same unit.** `resolve_list_progress` counts *successful callable
   invocations* (a load may make several); `progress_resolver_unavailable` counts *load attempts that
   failed twice*. A single failure that succeeds on retry counts as a success — correct for a
   user-visible availability metric, but the ratio is not a clean per-page-load rate.
3. **The denominator can move at the flip for benign reasons.** If the review-v2 client changes how many
   resolver calls a dashboard load makes (the DF2-33 dashboard fold and DF2-11 menu ride this train),
   the raw call count shifts without any regression. **B0 for R4a must therefore be normalised
   per-distinct-active-student-day, not per raw call** — otherwise the metric alarms on its own unit
   changing.

### R4b — Client JS exception rate: **NOT DERIVABLE, AND NO PRODUCER EXISTS**

There is **no `window.onerror`, no `unhandledrejection` listener, no `addEventListener('error')` anywhere
in `/app/src`**, and **no root ErrorBoundary** — `/app/src/main.jsx` renders `<App/>` bare. The only
boundary in the tree is apBoost's (`APErrorBoundary.jsx:26-31`, wrapping only `APTestSession`), and its
handler `logError` (`/app/src/apBoost/utils/logError.js:48-69`) writes to **`console.error` only**; lines
63-66 are literally a comment reading *"In production, could send to: Sentry/LogRocket/Crashlytics"*.

So an uncaught exception, a render crash, or a rejected promise outside the explicit `logSystemEvent`
call sites leaves **zero durable trace anywhere** — not in Firestore, not GCP-side (nothing reports to
it). **Absence of rows is not evidence of health here.** R4b has neither history nor a live producer;
it is the one invariant that would genuinely require new instrumentation (and the cheapest form of that
is a client error reporter, not an `ops_metrics` emitter).

---

## R5 — Teacher gradebook / analytics load · **NOT DERIVABLE**

**(b) There is zero teacher read telemetry in the product.** Verified across every teacher surface:
`Gradebook.jsx`, `ClassDetail.jsx`, and the query helpers they use (`db.js:queryTeacherAttempts` :2066,
`db.js:getTeacherData` :1960-2060, `db.js:1725` fan-out) and `apBoost/services/apAnalyticsService.js`
contain **no `logSystemEvent`, no `recordOpsMetric`, and no Firestore write of any kind**. Teacher
*actions* would log, but the three that exist are dormant or unused in production:

| event | gate | production count |
|---|---|---|
| `teacher_override` | `SERVER_OVERRIDE_ENABLED=false` (`foundation.js:99`) | **0** |
| `challenge_reviewed` | `SERVER_REVIEW_CHALLENGE_ENABLED=false` (`foundation.js:94`) | **0** |
| `teacher_provisioned` | live | **0** (`teacher_invites` collection = 0 docs) |

**(c) The metric you cannot compute.** A teacher opening the gradebook produces **no artifact**. There is
no numerator (successful loads) and no denominator (attempted loads). Nothing derivable, nothing to
proxy — and unlike R1 there is not even a GCP-side fallback, because these are direct Firestore SDK reads
from the browser, not callables, so they do not appear in Cloud Functions logs either.

**(d) Window: n/a.**

---

## R6 — Classes NOT yet at a review day complete normally · **PARTIAL** (successes only)

**(b) Source — found, and better than `class_progress`.** `users/{uid}/sessions` is an **append-one-doc-
per-completed-session** history: `collectionGroup('sessions')` = **17,712 docs**. Sampled production
shape (real doc):

```json
{"classId":"…","listId":"…","dayNumber":19,"interventionLevel":0,
 "newWordScore":null,"reviewScore":0.9666…,"segment":{"wordIds":[…]},
 "completedAt":{"_seconds":…},"serverWordsIntroduced":80,"wordsIntroduced":80,
 "wordsReviewed":0,"cyclingActive":false,
 "serverReviewOnlyDay":false,"clientReviewOnlyDay":false}
```

`serverReviewOnlyDay` / `clientReviewOnlyDay` give exactly the review-vs-non-review-day discriminator
R6 needs. Over a 120-student sample, **870 completions in 14 days, 0 missing `completedAt`**:

| day | completions | NON-review-day | review-only-day |
|---|---|---|---|
| 2026-07-23 | 92 | 43 | 49 |
| 2026-07-24 | 109 | 47 | 62 |
| 2026-07-27 | 100 | 54 | 46 |
| 2026-07-29 | 100 | 56 | 44 |
| 2026-07-31 | 90 | 43 | 47 |
| 2026-08-04 | 53 | 27 | 26 |
| 2026-08-05 | 42 | 22 | 20 |

Note: `class_progress.recentSessions[]` is **NOT** usable for this — it is capped at
`MAX_RECENT_SESSIONS = 10` (`src/types/studyTypes.js:292`, sliced at `progressService.js:597`). It is a
rolling window, not a history. `users/{uid}/sessions` is the correct source.

**(c) The metric you can compute, and the one you cannot.**
- **CAN:** non-review-day **completion VOLUME** per day, and completions-per-active-student. As a
  temporal regression signal this is real: if the flip breaks non-review completions, volume falls.
- **CANNOT: a completion SUCCESS RATE.** `sessions` records only completions that **succeeded**. A day
  completion that failed writes nothing, and **no `completion_failed` event type exists anywhere in the
  tree**. A collection of successful completions cannot by itself yield a success rate — there is no
  denominator. This is the single most important honesty point in this study, and it applies verbatim to
  R6 as `21_:96` words it.
- **Best available construction of a denominator** (inference, not measurement): for each student-day
  that has a passed `sessionType='new'` attempt in `attempts`, check whether a matching `sessions` doc
  exists. That yields an *attempted-day → completed-day* conversion ratio. It is a defensible proxy and
  should be labelled as one; it is not the rate the card names.

**(d) Window + one real blocker.** Full lifetime is available. **But
`collectionGroup('sessions').orderBy('completedAt')` fails with `FAILED_PRECONDITION (9)` — it requires
a `COLLECTION_GROUP_ASC` single-field index exemption for `sessions.completedAt` that does not exist
today.** Cohort-wide time-ranged reads must either fan out per user (609 distinct students in a 14-day
window — workable but slow) or the exemption must be added. **That is a one-line
`firestore.indexes.json` change plus a deploy, not an emitter build** — but it *is* a production config
change and must be sequenced before the flip if R6 is to be watched live during the 7-day soak.

---

## R7 — Grading availability (MCQ + typed) · **typed DERIVABLE (two independent sources) · MCQ VACUOUS**

### R7-typed: **DERIVABLE**, and this is the best-instrumented invariant of the seven

**(b) Source 1 — `system_logs.grading_attempt_failed`** (`TypedTest.jsx:742`, severity `error`), 1,447
rows, 2026-06-18 → 2026-08-05. The doc was purpose-built for exactly this question; production field
tallies over all 1,447:

```
isFinal:    {"false": 1101, "true": 346}     ← 346 = grades that never recovered
timedOut:   {"false": 1412, "true": 35}
failedFast: {"false":  307, "true": 1140}    ← died <2s ⇒ unreachable/offline
online:     {"true":  1306, "false": 141}    ← 141 fired while navigator.onLine === false
errCode:    {"functions/internal": 744, "functions/invalid-argument": 336,
             "functions/aborted": 331, "functions/deadline-exceeded": 30,
             "functions/unauthenticated": 6}
```
Plus `grading_recovered` (117 rows) for the recovery leg. `21_:97` asks for "grader error/timeout rate" —
`timedOut` and `errCode` are stored fields, so the exact metric is directly available.

**(c) Computed (14-day, denominator = `attempts` where `testType='typed'`, numerator of failures =
`isFinal:true`):** daily R7-typed success **97.40 %–100 %**.
**Volume-weighted 14-day B0 candidate: 4,568 / (4,568 + 25) = 99.456 %.**

**(b) Source 2 — `grading_jobs`, and it is the STRONGER baseline.** 17,291 docs, server-written by the
Admin SDK only, **never pruned** (`typedGrading.js:396-397`: "nothing deletes a `graded` job … no TTL is
configured"; no `onSchedule` touches it; `firebase.json` has no TTL config). Confirmed production shape:
`{uid, status, leaseId, leaseExpiresAt, attemptCount, aiCallCount, version, createdAt, updatedAt,
gradedAt, payload}`.

Full-collection `count()` census — **only three statuses exist in code and two in production**:

| status | count | meaning |
|---|---|---|
| `graded` | **17,236** | terminal success (`index.js:1194`) |
| `claimed` | **55** | claimed, lease expired, **never produced a grade** (`index.js:1120,1133`) |
| `cancelled_reset` | **0** | (`foundation.js:2231`) |
| `failed` / `error` / `pending` / `in_progress` | **0** | *these statuses do not exist* |

| `attemptCount` | 1 | 2 | 3 | 4 | **>1** |
|---|---|---|---|---|---|
| docs | 17,207 | 46 | 22 | 9 | **84** |

Derived, whole-collection: **never-graded rate = 55 / 17,291 = 0.318 %**; **lease-takeover rate
(a previous attempt died mid-grade) = 84 / 17,291 = 0.486 %**. Docs with `gradedAt` = 17,236, exactly
matching `status=='graded'` — internally consistent.

**Why source 2 beats source 1:** `grading_jobs` is **server-written and immune to the client-side
logging blind spot** that caps R2/R3/R4a/R7-source-1 at "upper bound". If the client dies, the job doc
still shows `claimed`-and-never-graded. **Recommend B0 for R7 be anchored on `grading_jobs`, with the
`system_logs` family as the diagnostic breakdown.**

**Blind spots.**
1. A metering-**capped** claim returns before `tx.set` (`index.js:1131`) and creates **no doc** — spend
   refusals are invisible to `grading_jobs`. (They are also not availability failures, so this is a
   scoping note, not a hole.)
2. `persistGradingJobResult` outcomes `already_graded | superseded | lease_expired | absent | error`
   (`index.js:1183-1200`) are **returned, never stored** — a stale worker's discarded grade leaves no
   record.
3. `getGradingStatus`'s `stale` (`index.js:1826`) is a computed view of `claimed`+expired, not a stored
   value — so "never graded" must be derived as `status=='claimed' AND leaseExpiresAt < now`, not read.

**(d) Window.** `grading_attempt_failed` from **2026-06-18** (48 days); `grading_jobs` from
**2026-06-28** (38 days). Both far exceed any plausible baseline window.

### R7-MCQ: **VACUOUS — there is no MCQ grading service**

`functions/index.js:635` states it directly: `correctnessSource` is `'server-ai'` for AI-graded typed
attempts and **`null` for "client-computed (MCQ)"**. MCQ correctness is computed in the browser; no
callable is invoked, **no `grading_jobs` doc is ever created**, and no grader can be unavailable.
The 84 `attempt_write_failed_client` rows with `testType:'mcq'` are **write** failures (already counted
in R3), not grading failures.

**R7's MCQ leg should be struck from the card as vacuous, not carded as a gap.** Writing an emitter for
it would emit a constant.

---

## BOTTOM LINE

### 1. Can the flip proceed without a waiting week? **YES — the week is not needed.**

Five of the seven invariants (R2, R3, R4a, R6-volume, R7-typed) can be computed **retrospectively, over
any window, on the day before the flip**, from `attempts`, `system_logs`, `grading_jobs` and
`users/{uid}/sessions` — all of which already hold **38–44+ days** of continuous history covering exactly
these legacy surfaces. **`21_:104-109`'s hard sequencing dependency is dissolved for those five.** The
two that remain (R1, R5) are not fixed by waiting a week either: **no emitter that could be built and
left dark for a week would produce a *retrospective* baseline** — building them still costs a full
baseline window *plus* the build. So "derive what exists now" strictly dominates "build and wait" for
every invariant where derivation is possible, and for R1/R5 the choice is *build-and-wait* versus *narrow
the R-set* — never *wait*.

### 2. Does a narrowed R-set make sense? **YES. This is the recommendation.**

**Ship the flip gate as R2 · R3 · R4a · R6 · R7-typed, computed from history.** That is not a compromise
set — it is precisely the set `21_:99-102` itself calls the ones that matter most:
> *"Why R2/R3/R6 matter most: the cutover folds (a/b/c/d) rewire compose→submit→complete and the
> namespace fold guards the write path; a defect there shows first as a write/submit/completion
> regression on students who are NOT even at a review day yet."*

All three of those are in the derivable set, and R3 comes out **stronger** than specified (per-`errCode`,
with `permission-denied` — the namespace-guard class — already 78.9 % of observed failures and therefore
directly watchable). Candidate B0 values, volume-weighted, ready for ratification:

| invariant | B0 candidate | window | source |
|---|---|---|---|
| R2 new-word submit success | **99.695 %** | 14 d | `attempts` + `attempt_write_failed_client` |
| R3 attempt-write success | **99.486 %** (+ per-`errCode` split) | 14 d | same |
| R4a progress-resolver availability | **99.769 %** | 7 d | `resolve_list_progress` + `progress_resolver_unavailable` |
| R6 non-review completion volume | per-day table above (volume, **not** a rate) | 14 d | `users/{uid}/sessions` |
| R7-typed never-graded rate | **0.318 %** (takeover 0.486 %) | all-time / 38 d | `grading_jobs` |
| R7-typed final-failure rate | **0.544 %** (1 − 99.456 %) | 14 d | `grading_attempt_failed` |

Three scoping corrections belong in the card alongside them:
- **R6 is a VOLUME signal, not a success rate.** A store of successful completions cannot yield a rate.
  Word the RED accordingly (a volume/conversion drop vs B0), or it will be un-evaluable on day 1.
- **R4 must be split.** R4a (load) ships; R4b (uncaught JS exceptions) has no history *and no producer*.
- **R7-MCQ is vacuous** and should be struck rather than carded.

### 3. What genuinely needs something built?

Only three items, none of them an `ops_metrics` R-series emitter:

| # | What | Why it is not derivable | Cost / shape |
|---|---|---|---|
| **R4b** | a **client error reporter** (`window.onerror` + `unhandledrejection` + a root ErrorBoundary → `system_logs`) | zero producer today; `apBoost/utils/logError.js:63-66` is a TODO comment | small client fold; **cannot** produce a retrospective baseline — if it is a gate, it costs a real waiting window |
| **R1** | auth success/failure | Firestore holds nothing; failures live in **GCP Cloud Logging / Identity Platform**, outside Firestore and outside this environment | either accept as **GCP-console-only, watched manually** during the soak, or build a client `login_ok`/`login_failed` emitter (again, no retrospective baseline) |
| **R5** | teacher gradebook load | zero teacher telemetry; direct browser Firestore reads, so not even Cloud Functions logs see them | a small client emitter; **or drop R5** — it is a read surface with no write path, the least likely to break at a compose/submit-focused flip |
| **(config)** | `sessions.completedAt` **COLLECTION_GROUP_ASC index exemption** | `collectionGroup('sessions').orderBy('completedAt')` returns `FAILED_PRECONDITION (9)` today | one line in `firestore.indexes.json` + deploy; needed only for cohort-wide R6 reads (per-user fan-out works without it) |

**Proposed sequencing.** Compute B0 for R2/R3/R4a/R6/R7-typed from history the day before the flip
(no wait). Deploy the one index exemption with the flip's own deploy. Treat **R1 as GCP-console-watched**
and **R5 as dropped or accepted-unwatched**, both recorded as explicit, named narrowings rather than
silent gaps. Build the R4b client error reporter as a **post-flip observability improvement**, not a flip
blocker — gating on it buys a waiting week for the one invariant whose absence is also the least
diagnostic of a compose/submit regression.

**The one sentence `21_` must lose:** *"the `ops_metrics` writers (DF2-10 dark build) must be emitting
R1–R7 in production, dark, for at least the baseline window before the ACTIVATION go."* It is false today
and, for five of the seven, unnecessary in principle.

---

### Evidence appendix — what was actually read

| probe | what it did | cost |
|---|---|---|
| 01 | `listCollections` + `count()` on all 14 root collections | 14 aggregates |
| 02 | doc-shape sampling: `system_logs`, `attempts`, `grading_jobs`, user/class subcollections, `system_config/review_v2` | 14 reads |
| 03 | time bounds + value tallies over newest/oldest 200–400 of each collection | 3,808 reads, 4 aggregates |
| 04 | full-collection `count()` census by status / sessionType / testType / type | 57 aggregates |
| 05 | `count()` for all 39 `system_logs` types the code can emit (client + server) | 39 aggregates |
| 06 | 14-day B0 derivation: 8,315 attempts + all 597/1,447/117 failure-log rows + 100 Auth records | 10,493 reads, 100 auth |
| 07/07b | R6 `sessions` history (120-student sample) + full 7-day `system_logs` census (13,920 rows) | 23,107 reads, 16 aggregates |

**Total ≈ 37,400 document reads, ~130 `count()` aggregates, 100 Auth lookups. Zero writes.**

---

## ⚠ ORCHESTRATOR VERIFICATION (2026-08-05, independent re-execution) — CONCLUSION UPHELD, NUMBERS NOT REPRODUCIBLE

I re-derived the headline figures myself, read-only, against production. **The structural conclusion
survives; the candidate B0 values do NOT reproduce and must not be frozen as-is.**

**UPHELD — the data exists, so the waiting week is genuinely unnecessary:**
- `system_logs.attempt_write_failed_client`: **597 rows, and ALL 597 carry `sessionType`/`testType`** —
  the failure denominator the R2/R3 derivation depends on is real and complete, not sampled.
- `errCode` distribution confirms the study's sharpest point: **`functions/permission-denied` = 471/597
  (78.9%)**, so the namespace-guard failure class is directly watchable per-code.
- `attempts` = **42,690** (24,672 `sessionType:'new'`); `grading_jobs` = **17,295** (server-written,
  immune to the client-logger blind spot).

**NOT REPRODUCED — the specific rates differ materially:**
| metric | study | my recomputation (all-time) | delta |
|---|---|---|---|
| R2 new-word submit success | 99.695% | **98.057%** | 1.6 pts |
| R3 attempt-write success | 99.486% | **98.621%** | 0.9 pts |
Almost certainly a WINDOW definition difference (the study volume-weighted a bounded window; I used
all-time totals). **That is exactly why this matters:** R2's abort trigger is *"new-word submit success
drops at all"*, so a 1.6-point ambiguity in the baseline is larger than the signal it must detect. An
unpinned window makes B0 unfalsifiable.

**CONSEQUENCE — B0 needs a COMMITTED, DETERMINISTIC producer, not a study figure.** Before the flip:
write `scripts/deepfix2/b0-baseline.mjs` (read-only) that takes an explicit window, computes R2 · R3 ·
R4a · R6 · R7-typed by a documented formula, and writes a receipt — so B0 is re-derivable by anyone and
the gate can diff it. Freezing a hand-quoted rate would repeat the never-hand-type-a-score failure this
program already has a rule about.
