# DEEPFIX2 · 18_ — THE ENGINE'S TYPED LEG (DF2-12/13 for review-v2)

**Status:** design, grounded in code read 2026-08-03. Blocks the 25WT rehearsal: typed review is the
one modality the engine refuses today, so a typed class cannot rehearse.

## 1. What refuses today, exactly

`functions/reviewV2/callables.js:458-462`, inside `reviewV2SubmitAttempt`, after the queue/presentation
fence passes:

```js
if (pres.testType === "typed") {
  // DF2-12's grading-jobs integration lands in-train — refuse as DATA
  // [C5/L-3], zero writes, rather than mint an unstamped typed attempt.
  return {status: "typed_modality_deferred"};
}
```

That refusal is correct as written — minting a typed attempt with no server grade would create exactly
the unstamped evidence the completion fence exists to reject. It has to be *replaced*, not deleted.

## 2. Why MCQ needed no grader and typed does

The engine grades MCQ itself, in-process: `callables.js:464+` builds the answer key from the **canonical
`definition`** and never trusts a client verdict. Typed answers are free text — correctness comes from
the AI grader in `exports.gradeTypedTest` (`functions/index.js:1005`), which is a *separate callable*,
takes `{answers, writeContext, gradeContext}`, and is not reachable from inside another callable's
transaction.

## 3. The decision: reuse the grading job, do NOT re-implement grading

`grading_jobs` is live in production and already solves the hard part — idempotency across a lost
response. `claimOrRecoverGradingJob(uid, jobKey)` (`index.js:928`) returns `return_cached` when a grade
already exists, so a retry never re-grades and never double-charges the AI.

**The engine must reuse that machinery, keyed on its own identity.** The engine's attempt docId is
`rv2_{uid}_{presentationId}` (`functions/reviewV2/composer.js` `engineDocId`), so one student's one
presentation = one grade.

> **CORRECTION (rv2-docid-collision fold, ledger D2).** Both this section and §4 said the key was
> `rv2_{presentationId}` and called it **"1:1 with a composed presentation"**. That was **true per user
> and FALSE globally — which was the whole defect.** `presentationId` is
> `{classId}_{listId}_d{day}_e{epoch}_p{seq}` (`presentations.js:445`; `_n{seq}`/`_r{seq}` at
> `:474`/`:489`) over a queue id carrying no uid (`composer.js:82-84`), and `seq` counts **per user** —
> so every student in the same class+list+day+epoch derived the **same** string, while `attempts` and
> `grading_jobs` are **top-level** collections. Observed consequence (lap CASE TR (10), pre-fix): the
> first student's attempt landed and the second was refused `presentation_invalid`; before the
> typed-fix-audit's A4 guard, worse — the second student was served the first's grade as their own
> "replay". On the typed leg the second student hit `permission-denied` from the grading-job uid fence
> (`index.js:936-938`) on their own test.
>
> **THE FIX, and where it was NOT applied.** The uid went into the **derived** id, not into
> `presentationId`. `presentationId` is already uid-scoped **by path** (`users/{uid}/…`), and it is
> stored in `review_presentations`, registered in `compose_keys`, echoed to the client and compared in
> `completion.js:412`/`:482` and `presentations.js:365` — scoping it there has a far wider blast radius
> than the defect warrants. **The principle: when an id crosses from a scoped namespace into a global
> one, it must acquire the scope it is losing.** Both derivation sites call the one `engineDocId`
> function, because a job key that named a different test from its attempt would be a worse defect than
> the one being fixed. No migration was needed: a read-only production query found **0** `rv2_`
> documents in `attempts` and **0** in `grading_jobs`, so this is a pure forward-scheme change.
> Fixtures: lap **CASE RC** (the bypass set, the single-student control, and the two-student typed leg
> end to end) and **CASE TR (10)** (the inverted regression witness); mutant
> **`M-A1-UID-SCOPE-REVERT`**.
>
> The uid in the key is a **namespace, not a fence** — the key stays client-derivable (a student knows
> its own uid), so §5.6's acceptance test still trusts nothing about who claimed it.

> **CORRECTION (typed-fix-audit fold, ledger D1).** This section previously called that key
> "collision-free" and "replay-safe by construction". **That was false.** `claimOrRecoverGradingJob` is
> also reached from the LIVE `gradeTypedTest`, whose job key is **client-supplied** —
> `jobAttemptDocId = (writeContext || gradeContext)?.attemptDocId` (`functions/index.js:1048-1051`),
> with no namespace restriction — and the client knows its own `presentationId`
> (`src/services/reviewV2Client.js:173`). `rv2_` is therefore a **naming convention, not a namespace
> boundary**: a student can claim `rv2_{any uid}_{any presentationId}` — their own key or a
> classmate's, since the uid scoping added by the rv2-docid-collision fold is a namespace and not a
> fence — grade answers of their choosing, and
> the payload the live path caches (`index.js:1136-1141`) satisfied the engine's entire acceptance test
> (`Array.isArray(payload.results)`). The engine now trusts nothing derived from the key — see §5.6.
> Restricting the live key namespace **at its source** is a separate fold (it touches the path 947
> students use today) and is carded in `WORK_QUEUE.md` / `NEED_TO_FIX.md`.

Rejected alternatives:
- *Grade inside the submit transaction* — an AI call inside a Firestore transaction is a non-starter
  (latency, retries re-invoking the model).
- *A second engine-specific grader* — duplicates the prompt, the token metering, and the
  `correctnessSource: 'server-ai'` provenance that `index.js:452` enforces on the typed write path.

## 4. Shape

```
client → reviewV2SubmitAttempt({presentationId, answers})   // typed
  1. fence exactly as today (queue/presentation/claim — unchanged)
  2. jobKey = `rv2_{uid}_{presentationId}`      // composer.js engineDocId — the
                                               // SAME function callables.js
                                               // derives attemptId with [D2]
     claim = claimOrRecoverGradingJob(uid, jobKey)
       · return_cached  → the payload must pass §5.6's acceptance test:
           - usable    → skip to (4) with the cached rows
           - unusable  → return {status: 'grade_unusable'} as DATA (PERMANENT —
                         recompose once, do NOT poll; a `graded` job never
                         self-clears) [rv2-refusal-status]
       · in_progress    → return {status: 'grading_in_progress'} as DATA
                          (TRANSIENT — poll the SAME submit; no write)
       · granted        → (3)
  3. grade the free-text answers with the SAME grader gradeTypedTest uses, then
     persistGradingJobResult(jobKey, leaseId, rows)   // lease-fenced, as today
  4. write the attempt via the engine's existing stamping path, with
     correctnessSource: 'server-ai' and the full gatePosture/resetEpoch stamp set
```

Step 2 contributes TWO **frozen protocol statuses** to `src/services/reviewV2Client.js` (`RV2`), and
they are exact inverses — the client-visible contract change of this leg:

- `grading_in_progress` — TRANSIENT (a live lease, or step 3 established no authority): retry the
  SAME submit; never recompose.
- `grade_unusable` — PERMANENT (a cached payload that failed §5.6's acceptance test; it can never
  become usable): recompose ONCE with a new composeKey; never poll.

> **CORRECTION (rv2-refusal-status fold).** This step originally described a SINGLE status:
> `grading_in_progress` was returned for both conditions, and its frozen client contract — poll the
> same submit, never recompose — is correct only for the transient one. For an unusable cached payload
> (a `graded` job never self-clears) it told a conforming client to poll forever. The split above is
> the fix; the single-status protocol previously written here was the defect, not merely an omission.

## 5. What must be true before this is safe

1. **The engine's stamp set survives the grading round-trip.** The attempt must still carry
   `resetEpoch`/`gatePosture`/`presentationId`/`queueId` — the completion fence keys off `resetEpoch`
   presence to decide engine-vs-legacy (`completion.js:340`), and the rules artifact now makes all four
   server-only.
2. **Row shape identical to MCQ's.** `completion.js` applies the COMPLETE-ROWS law to engine evidence
   (`rows.length === totalQuestions`); a typed grade that drops an ungradeable row would strand the day.
   Ungradeable ⇒ row present, marked incorrect.
3. **The preimage law holds.** `gradedIsCorrect` is written only where absent (first adjudication wins).
   A re-grade after a challenge must not launder it.
4. **Metering is charged once.** The cached-return path must not increment `ai_metering`.
5. **Every non-authoritative outcome is a DATA refusal.** A live lease held by a concurrent submit, and
   any persist outcome that did not establish authority (`superseded`/`lease_expired`/`absent`/`error`),
   return `{status: 'grading_in_progress'}` with zero writes — a worker that never established
   authority must not mint an attempt. (These are the TRANSIENT conditions — polling resolves them.
   Contrast the PERMANENT refusal in point 6 below (§5.6): `grade_unusable`.)
6. **A cached grade is only usable for the sheet it graded** *(added by the typed-fix-audit fold —
   this is law, not merely code)*. Because the job key is claimable by the client (§3 correction), the
   engine's cached-grade seam (`typedGrading.js` `usableCachedResults`, consumed at BOTH the
   `return_cached` path (`:263`) and its `already_graded` sibling (`:295-308`)) accepts a payload only
   when all three hold:

   > **CORRECTION (independent audit F2).** That sentence read as a CLOSED SET of two. There are
   > **THREE** transient conditions. The missing one is `callables.js:655` — `gradeSkippedForReplay`:
   > the submit pre-read saw a stored attempt, so grading was skipped, and by txn time the attempt was
   > GONE. Transient (a retry re-composes the read and lands), fixtured as lap CASE GU. It appears
   > nowhere else in this document, and `df2-51b-submit` is instructed to handle every protocol status
   > from exactly this paragraph — which is how an omission here becomes a client bug there.
   > **A fourth exists as of the audit fix:** the `already_graded` re-read finding the job VANISHED
   > (`typedGrading.js`) is also transient. Full transient set: live lease · persist-established-no-
   > authority · vanished-job-on-re-read · replay-pre-read-then-gone.

   > **On the word "BOTH"** — it was published here before it was true as *evidence*. An independent
   > audit reverted only the sibling call site and the entire lap stayed green, proving the battery was
   > blind to it. It is now pinned by **CASE TS** (which reaches `already_graded` through production
   > code: the engine's lease lapses mid-grade and a competitor takes the key over) and by the mutant
   > **`M-A1-SIBLING-CALL-SITE`**, which reverts *only* that branch and dies on 4 TS assertions.
   > Corroboration that TS reaches a genuinely new seam: `M-A1-PREFIX-CONSUMER` went from 21 red to 25.

   | clause | what it proves | what backs it |
   |---|---|---|
   | `source === 'reviewV2'` | the ENGINE wrote this cache | **not forgeable today**, and the scope of that word is exact: the live grader builds its payload as one hard-coded object literal (`index.js:1136-1141`) that has no `source` field, `foundation.js:2225-2237` writes only status/cancelledAt/resetEpoch/rows, and rules deny every client write to `grading_jobs`. It rests on a literal in a file this fold did not touch and **no fixture pins it** — a future field added there would silently defeat the clause. Do not upgrade this to "unforgeable" without one [audit F4] |
   | `presentationId === this presentation` | it is THIS test's grade | blocks cross-presentation replay |
   | `answerSheetKey === this sheet` | it is a grade OF what is being submitted now | binds verdicts to the text they were computed from |

   **Answer-sheet identity** is the sha256 of the (presented `wordId` → normalized response) pairs,
   **sorted by `wordId`**. Therefore, as law: presentation **order is not identity** (a reordered sheet
   still reuses the cache); **blanks are part of the sheet** (a presented word with no answer is the
   pair `(wordId, "")`, so blank→filled drift fails closed even though blanks never reach the AI);
   **whitespace is not identity but case is** — the grader already treats a response as blank on
   `.trim()`, and a legitimate replay must not fail closed on a trailing space, whereas no legitimate
   replay re-types an answer in different case.

   A payload failing ANY clause is refused as **`grade_unusable`** — the PERMANENT refusal (recompose
   once with a new composeKey, do NOT poll), because a `graded` job never self-clears, so retrying the
   same submit can never succeed. *(CORRECTION, rv2-refusal-status fold: until that fold this refusal
   returned the transient `grading_in_progress`, whose frozen client contract — poll the same submit,
   never recompose — told a conforming client to poll forever.)* A payload written by an **older
   engine build** carries none of the three and is therefore **refused, not trusted** — the same
   status. Refusal performs zero writes.

   > **CORRECTION (rv2-collision independent audit, finding F1 — 2026-08-03).** This paragraph used to
   > end: *"because a poisoned/stale key can only ever belong to the caller's own uid
   > (`index.js:936-938`), the affected student recovers by composing a new test."* **Both halves were
   > false, and this fold's own fixtures are the counter-example.**
   >
   > *It is NOT always the caller's own uid.* `index.js:936-938` only bites once the document EXISTS. A
   > third party who claims FIRST creates it with **their** uid (`index.js:955-958`) — fixtured at
   > `engine-emulator-lap.mjs:2546-2548` (a classmate) and `:2561-2563` (a teacher), where the job
   > records the ATTACKER's uid against the victim's key.
   >
   > *And the victim does not get this DATA refusal at all.* They get a THROWN `permission-denied` from
   > that same uid check (`:2549-2552`), because it runs BEFORE the status and lease checks — so an
   > expired lease never releases the document. The block is **permanent**; clients cannot delete
   > `grading_jobs` (`audit/deepfix/task3/live_baseline/firestore.live.rules:417` — the DEPLOYED ruleset; there is no `firestore.live.rules` at the repo root).
   >
   > Recomposing does yield a new key, so it remains the student-side recovery — but as an escape from
   > someone else's denial, not as a tidy self-service reset, and `_p{seq}` is predictable enough to
   > follow. **That is card 19 (`gradejob-namespace`), now a PRE-FLIP BLOCKER.** The sentence removed
   > here is the exact reasoning that let card 19 sit as "defense in depth" for a day.

## 6. Test plan (before any review round)

Extend `scripts/deepfix2/engine-emulator-lap.mjs` (currently 220/220) with a typed battery, and prove
the failure modes rather than the happy path:
- typed submit → graded rows persisted → day completes; **replay of the same presentationId returns the
  normalized envelope with ZERO new writes and ZERO extra metering**;
- lost response: claim granted, process dies, retry → `return_cached`, no re-grade;
- concurrent double-submit → one grades, the other gets `grading_in_progress` (never two attempts);
- an ungradeable answer → row present + incorrect, `rows.length === totalQuestions` still holds;
- a typed attempt whose grade never lands → completion refuses (`no_evidence`), student not stranded on
  a later retry.

## 7. Sequencing

Behind the same dark posture as the rest of the engine — it changes no legacy path, and
`gradeTypedTest` itself is untouched. Lands before the 25WT rehearsal (the rehearsal cannot cover typed
classes without it) and needs its own review round, because it is the first engine change that reaches
outside the transaction.
