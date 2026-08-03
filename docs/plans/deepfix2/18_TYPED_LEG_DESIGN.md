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
already `rv2_{presentationId}` (1:1 with a composed presentation, per the callables header), so one
presentation = one grade.

> **CORRECTION (typed-fix-audit fold, ledger D1).** This section previously called that key
> "collision-free" and "replay-safe by construction". **That was false.** `claimOrRecoverGradingJob` is
> also reached from the LIVE `gradeTypedTest`, whose job key is **client-supplied** —
> `jobAttemptDocId = (writeContext || gradeContext)?.attemptDocId` (`functions/index.js:1048-1051`),
> with no namespace restriction — and the client knows its own `presentationId`
> (`src/services/reviewV2Client.js:152`). `rv2_` is therefore a **naming convention, not a namespace
> boundary**: a student can claim `rv2_{their presentationId}`, grade answers of their choosing, and
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
  2. jobKey = `rv2_{presentationId}`
     claim = claimOrRecoverGradingJob(uid, jobKey)
       · return_cached  → skip to (4) with the cached rows
       · in_progress    → return {status: 'grading_in_progress'} as DATA (retryable, no write)
       · granted        → (3)
  3. grade the free-text answers with the SAME grader gradeTypedTest uses, then
     persistGradingJobResult(jobKey, leaseId, rows)   // lease-fenced, as today
  4. write the attempt via the engine's existing stamping path, with
     correctnessSource: 'server-ai' and the full gatePosture/resetEpoch stamp set
```

Step 2's `in_progress` branch is a **new protocol status** and must be added to the frozen list in
`src/services/reviewV2Client.js` (`RV2`) — it is the one client-visible contract change.

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
   authority must not mint an attempt.
6. **A cached grade is only usable for the sheet it graded** *(added by the typed-fix-audit fold —
   this is law, not merely code)*. Because the job key is claimable by the client (§3 correction), the
   engine's cached-grade seam (`typedGrading.js` `usableCachedResults`, consumed at BOTH the
   `return_cached` path (`:263`) and its `already_graded` sibling (`:295-308`)) accepts a payload only
   when all three hold:

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

   A payload written by an **older engine build** carries none of the three and is therefore **refused,
   not trusted**. The refusal is `grading_in_progress` (the frozen retryable typed status): it performs
   zero writes, and because a poisoned/stale key can only ever belong to the caller's own uid
   (`index.js:936-938`), the affected student recovers by composing a new test — a new
   `presentationId` is a new job key.

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
