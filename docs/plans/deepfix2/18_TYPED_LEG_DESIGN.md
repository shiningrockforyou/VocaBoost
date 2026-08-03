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
already `rv2_{presentationId}` (1:1 with a composed presentation, per the callables header), which is a
natural, collision-free job key: one presentation = one grade, replay-safe by construction.

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
