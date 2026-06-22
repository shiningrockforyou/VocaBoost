# Plan: Server-Side Attempt Write — v2 (grounded in real code)

**Status:** DRAFT for review (3 internal agents + Codex). Nothing implemented. Nothing committed.
**Author:** Claude (orchestrator) · **Date:** 2026-06-22
**Supersedes** `PLAN_server_side_attempt_write.md` (v1), which was drafted against stale names and missed that MCQ has no grading function.

---

## 1. Problem (verified)
A test attempt is graded but the **durable write happens on the client, AFTER the success** — the single point of failure:
```
TYPED:  client → gradeTypedTest (Cloud Fn, AI grade ✓) → returns → client writes attempt → client completeSessionFromTest
MCQ:    client grades locally (deterministic) → client writes attempt → client completeSessionFromTest
                                                          ↑ FAILURE POINT (both paths)
```
If the client drops/refreshes/crashes after grading but before/around the write: the pass is **lost** (and for typed, AI tokens were already spent), the student sees a connection error, and it becomes a **manual-fix ticket** — this is the root of the recurring stuck-student / invalid-anchor CS work (강민서, 이가온, 손지우, 서준혁; CS-2026-06-21).

## 2. Proposed solution (owner's idea, refined)
Move the **durable attempt write into a Cloud Function** so grade+write succeed/fail together and don't depend on the client connection. **The pattern already exists and is proven in this codebase** — apBoost's `submitTest` (`functions/index.js:541`) does exactly this: `runTransaction`, **idempotent via a deterministic result id** (`{uid}_{testId}_{attempt}` → "if exists, return existing"), server-side auth check. We mirror that.

## 3. Verified code inventory (corrects v1)
### Cloud Functions (`functions/index.js`) — admin SDK already initialized (`:19`)
| Function | Reality |
|---|---|
| `gradeTypedTest` (`:70`) | onCall; takes **`{ answers }` only**; AI-grades typed answers; returns grading results. **No write, no context params.** (v1 called this `gradeTypedAnswers` — wrong name.) |
| `submitTest` (`:541`) | **apBoost** (`ap_*` collections) — the reference: transactional, idempotent, server-side write. NOT vocaBoost, but the pattern to copy. |
| (no MCQ grading fn) | **MCQ has NO Cloud Function.** `MCQTest.jsx` computes `isCorrect` locally from `option.isCorrect` and writes client-side. |

### Client paths
| Path | Grade | Write | Files |
|---|---|---|---|
| **Typed** | `gradeTypedTest` (server, AI) `TypedTest.jsx:613-617` | `submitTypedTestAttempt` (`db.js:1276`) `TypedTest.jsx:764` → then `completeSessionFromTest` `:849` | TypedTest.jsx, db.js, studyService.js |
| **MCQ** | **client-side, deterministic** (no fn) | `submitTestAttempt` (`db.js:1158`) → then `completeSessionFromTest` | MCQTest.jsx, db.js, studyService.js |

### Attempt write today
- `submitTestAttempt` (`db.js:1158`) / `submitTypedTestAttempt` (`db.js:1276`) both `setDoc` to `attempts`, and **already accept an optional deterministic `attemptDocId`** → idempotency primitive is **half-built** (reuse it server-side instead of v1's timestamp-minute hash).
- `completeSessionFromTest` (`studyService.js:~1090`) then updates `session_states` + `class_progress` (+ graduation). **This is a second client-write-after-success failure point** (손지우's corrupt session state came from here).
- `firestore.rules:96` — `attempts` are currently **client-writable** (and client-deletable). Tightening is a Phase-4 follow-on, gated on full migration.

## 4. Design (the corrected shape)
A **single shared server-side write** path, reached two ways because the grade sources differ:

### 4a. Shared helper (server) — `writeAttemptTxn(uid, ctx, results)`
In `functions/index.js`. Mirrors apBoost `submitTest`:
- **Auth/membership:** `uid === ctx.studentId`; verify the student is enrolled in `ctx.classId` and the list is assigned (read class doc).
- **Server-authoritative fields (do NOT trust client):**
  - `passThreshold` ← read from `classes/{classId}.assignments[listId].passThreshold` (v1 open-Q1: yes, server-side).
  - **Anchor fields** `newWordStartIndex`/`newWordEndIndex`/`wordsIntroduced` ← **computed server-side** from the session/progress (the function knows the day + pace). ⇒ every attempt it writes is a **valid reconciliation anchor by construction**, killing the invalid-anchor bug class at the source (ties to CS-2026-06-21).
  - `score`/`correctCount` ← from `results` (typed: AI results; MCQ: client-computed — see §6 risk).
  - `passed = score >= passThreshold`.
- **Idempotent transaction:** deterministic doc id `attempts/{uid}_{classId}_{listId}_day{N}_{testType}_{sessionType}` (reuse the existing `attemptDocId` convention). In a `runTransaction`: if the doc exists → return it (`alreadyWritten:true`); else write. A retry no-ops, never duplicates.
- Returns the full attempt (`attemptId`, `score`, `passed`, `results`) so the client just displays.

### 4b. Typed path — fold write into `gradeTypedTest`
Extend `gradeTypedTest({ answers, writeContext })`:
- if `writeContext` present → after grading, call `writeAttemptTxn(uid, writeContext, results)` and return `{ results, score, passed, attemptId, attemptWritten:true }`.
- if absent → current behavior (backward-compatible default).
- This collapses typed into **one round-trip** (grade+write atomic) — eliminates the client write hop entirely, which is the actual failure point.

### 4c. MCQ path — new callable `submitMcqAttempt({ results, context })`
MCQ has no grading fn, so add a small onCall that takes the client-computed `results` (`[{wordId, correct}]`) + context and calls `writeAttemptTxn`. The durable write moves server-side even though grading stays client-side (MCQ is deterministic).

### 4d. Client changes
- TypedTest: pass `writeContext` to `gradeTypedTest`; **drop** the `submitTypedTestAttempt` call; on success display; on failure show retry (idempotent-safe).
- MCQTest: after local grading, call `submitMcqAttempt(...)` instead of `submitTestAttempt`; same retry semantics.
- Keep `completeSessionFromTest` client-side **for now** (§5 phasing) but read the attempt’s server truth.

## 5. Phasing & rollout
- **Phase 1 (non-breaking):** add `writeAttemptTxn` + extend `gradeTypedTest` (flag-gated via presence of `writeContext`) + add `submitMcqAttempt`. Deploy functions. Old client paths still work. → `firebase deploy --only functions`.
- **Phase 2:** switch TypedTest + MCQTest clients to the new flow; keep old `submit*Attempt` as fallback behind a flag.
- **Phase 3 (roadmap, NOT "optional"):** move `completeSessionFromTest`’s progress writes (`session_states`/`class_progress`/graduation) into the **same transaction** — it’s the other client-write-after-success failure point (손지우). Bigger; separate audit.
- **Phase 4:** tighten `firestore.rules` so `attempts` are function-write-only; deprecate/rename client `submitTestAttempt` → `submitManualAttempt` (teacher/CS manual entries, e.g. `scripts/cs/manual-pass.mjs`, stay).

## 6. Risks / decisions
- **MCQ correctness is client-computed → spoofable.** Today it already is (client writes it). Server-side write doesn’t fix trust unless the function **re-derives correctness** from the list’s `option.isCorrect`. Decision: Phase-1 trust client `results` (parity with today, fixes the durability bug); flag server-side MCQ re-grade as a security enhancement (needs the function to load the word/options).
- **`gradeTypedTest` timeout** now also does a txn write — small added time; existing 90s timeout ample.
- **Deploy stakes:** Cloud Functions change affects ALL grading. Backward-compatible Phase 1 + staged client cutover is mandatory; old path stays as rollback.
- **eslint predeploy** is `eslint . || exit 0` (never blocks; known harmless env-gap errors).
- **Anchor computation parity:** the server’s computed `newWordEndIndex` must match what the client/`initializeDailySession` would produce, or reconciliation diverges. Must derive from the same pace/progress source. (Audit focus.)

## 7. Files to modify
| File | Change |
|---|---|
| `functions/index.js` | add `writeAttemptTxn`; extend `gradeTypedTest`; add `submitMcqAttempt` |
| `src/pages/TypedTest.jsx` | pass `writeContext`, drop `submitTypedTestAttempt` |
| `src/pages/MCQTest.jsx` | call `submitMcqAttempt`, drop `submitTestAttempt` |
| `src/services/db.js` | keep `submit*Attempt` for manual/CS; mark deprecated for the test path |
| `firestore.rules` | (Phase 4) attempts function-write-only |

## 8. Validation
- Functions: emulator/dev project — typed grade+write atomic; MCQ write; **retry idempotency** (same deterministic id → no duplicate); server-computed anchor matches `initializeDailySession`; `passed` uses server `passThreshold`.
- E2E (Playwright, post-deploy, audit personas): typed + MCQ full pass; **failure injection** — kill the client right after the function returns → attempt is STILL written (the whole point); confirm no invalid anchor produced (`scripts/cs/data-integrity-sweep.mjs` clean after).
- No duplicate attempts; no increase in function errors.

## 9. Open questions for review
1. Typed: fold write into `gradeTypedTest` (one round-trip, recommended) vs a separate `submitTypedAttempt` the client calls after grading (keeps grading pure, but reintroduces a client hop)?
2. MCQ: trust client `results` in Phase 1 (recommended, parity) vs server re-grade from `option.isCorrect` now (more secure, more scope)?
3. Phase 3 progress-in-txn: same function, or a dedicated `completeSession` callable?
4. Idempotency id: confirm the deterministic `{uid}_{classId}_{listId}_day{N}_{testType}_{sessionType}` matches the existing `attemptDocId` convention so server + any legacy client write collide correctly (no dup).

## 10. Out of scope
- Progress-write migration (Phase 3 — roadmapped, separate).
- Firestore-rules tightening (Phase 4).
- Committing / deploying (owner-gated).

---

# 11. AUDIT CORRECTIONS (3 agents) — these OVERRIDE §4–§9 where they conflict
The inventory (§3) verified accurate. The **design (§4) has two blockers and several high-severity gaps**. Locked corrections below; Codex should verify these too.

### 11.1 🔴 BLOCKER — idempotency id must REUSE the client's existing doc id (not a new scheme)
The real client doc id is **`${uid}_${testId}_${attemptNonce}`** (`TypedTest.jsx:759`, `MCQTest.jsx:600`), where `testId = vocaboost_test_{classId}_{listId}_{testType}` and `attemptNonce` is a **random per-session value in localStorage** (`testRecovery.js:103`). My proposed `{uid}_{classId}_{listId}_day{N}_{testType}_{sessionType}` (§4a/Open-Q4) is WRONG two ways:
- **Migration duplicates:** the server can't reproduce the random localStorage nonce, so during the Phase-1/2 overlap an old client + the server write the *same logical attempt under two different ids* → **duplicate attempt** (not an idempotent no-op). This breaks reconciliation (`getMostRecentPassedNewTest`).
- **Retake data loss:** the model is **multiple attempts per day** — `getNewWordAttemptForDay` (`db.js:3015`) queries `studyDay==N && sessionType=='new'` `orderBy submittedAt desc limit 1` (deliberately "take the latest"). A failed-then-retaken day = two docs today (the nonce rolls on each submit via `clearTestState`). My deterministic id would **overwrite the failed attempt with the retake** — and worse, a stale resubmit could clobber a *passed* anchor with a *failed* one → reconciliation silently regresses CSD/TWI. (apBoost's own id includes `attemptNumber` — `functions/index.js:572` — exactly the dimension I dropped.)
- **FIX:** the **client passes its existing `attemptDocId` (the nonce id) into the function**, and the function honors it as the transaction key. `submit*Attempt` already supports the `attemptDocId` param (`db.js:1245`), so server + any legacy client converge on one id → genuine idempotency on retry, distinct docs on retake. Do NOT invent a new id scheme.

### 11.2 🔴 BLOCKER — do NOT fold the write into grading such that a write failure re-bills the AI grade
§4b (grade → write → return, all in `gradeTypedTest`) regresses failure isolation: if `writeAttemptTxn` throws, the whole onCall throws `HttpsError`, the client's `gradeWithRetry` retries the **entire function including the Anthropic call** (`TypedTest.jsx:609-657`) → **paid tokens re-spent on every write retry**, and on exhaustion the (already-paid, already-computed) grade is discarded as "Grading Failed."
- **FIX:** keep grade and write **separable**. Either (a) `gradeTypedTest` grades, attempts the write, and **returns the grade even if the write sub-step failed** (`{results, score, attemptWritten:false, writeError}`) so the client shows the grade and retries **only** the write via a separate idempotent `submitTypedAttempt` callable; or (b) two callables (grade, then submit). Never re-charge grading on a transient Firestore hiccup. (My §9-Q1 raised this but §4b recommended the wrong side.)

### 11.3 🟠 HIGH — ECHO-and-validate the client anchor; do NOT recompute server-side
§4a's "server computes the anchor, valid by construction" is riskier than stated. The client derives the anchor at **session init** (`initializeDailySession` → `newWordStartIndex = totalWordsIntroduced`, `newWordEndIndex = totalWordsIntroduced + newWordCount − 1`, `studyService.js:252-253`) and the student studies against *that* value. A function recomputing at **submit time** can differ because `getOrCreateClassProgress` reconciliation **mutates `totalWordsIntroduced`** between init and submit (`progressService.js:203`), and `initializeDailySession` is **not pure** (it calls `returnMasteredWords`, which writes a batch). A recomputed-but-different anchor is a *new* corruption class (wrong-valued anchor that reconciliation trusts unconditionally: `twi = newWordEndIndex+1`).
- **FIX:** the function **echoes the client-supplied anchor** (from `sessionContext`, the value actually studied) and may **validate/shadow-log** a server recompute, but writes the client value until parity is proven. Flipping to server-authoritative anchors is a *separate* later step, not bundled with introducing the write. (This still fixes the invalid-anchor CS bug — the function refuses to write an attempt with a missing/invalid anchor, rather than inventing one.)

### 11.4 🟠 HIGH — `passed` must replicate the review-always-passes branch + normalize score range
Server `passed = score >= passThreshold` is incomplete. Today **review attempts force `passed=true` regardless of score** (`db.js:2710`, `TypedTest.jsx:706`, `MCQTest.jsx:527`). The function must use `passed = (sessionType === 'review') ? true : (score >= passThreshold)`. Also normalize ranges: `score` and `passThreshold` are both **0–100** (`db.js:1210`, default 95), but legacy attempts may store `score` 0–1 (`studyService.js:1276` converts defensively) — standardize on 0–100 in the function or a `0.95 >= 95` misfire marks everyone failed.

### 11.5 🟠 HIGH — preserve client `processTestResults` across the retry-returns-existing path
After the attempt write, the client runs `processTestResults` (mutates per-word `study_states` with failed words for the review queue), explicitly sequenced AFTER the write and gated once (`TypedTest.jsx:794-802`, `MCQTest.jsx:658-669` — the comment calls it the "split-brain bug" fix). §4d's "drop the write, just display" is silent on this — if a lost-return retry returns the existing attempt and the client skips its post-write block, **study_states never get the failed-word updates → review queue is wrong.** FIX: `processTestResults` stays client-side and must run on the success path **including when the function returns an already-written attempt** (idempotent-safe), or move it server-side too.

### 11.6 🟡 Corrections / scope
- **Auth pattern:** reuse **`renameStudent` (`functions/index.js:793`)** — enrollment lives on **`users/{uid}.enrolledClasses`** (map) and/or **`classes/{classId}.studentIds`** (array), NOT "the class doc" generically. (`submitTest` does ownership-not-enrollment; wrong model to copy.)
- **MCQ trust:** trusting client `results` in Phase 1 is **strictly equal to today** (rules validate no score — `firestore.rules:101`; client builds `option.isCorrect` itself) → safe. BUT once the function writes valid anchors, a forged MCQ pass becomes a *clean reconciliation-valid* fake (harder to spot than a sloppy hand-write). MCQ **server re-grade** (Open-Q2) is a **fast-follow**. *(Correction: the shared write helper does NOT load list words — it only needs class/enrollment/assignment + anchor validation. Server re-grade is therefore added scope: the MCQ re-grade design must explicitly load `lists/{listId}/words` to re-derive `option.isCorrect`. Not "near-free"; flag the extra reads.)*
- **Phase-4 lockdown = `create` ONLY.** Preserve the student `answers`-only `update` (challenge submission, `firestore.rules:109`) and own-attempt `delete` (progress reset, `:116`). "function-write-only" is too broad as written.
- **Atomicity honesty:** keeping `completeSessionFromTest` client-side opens a new (milder) window. CSD/TWI **self-heal** via reconciliation from the durable attempt (strictly better than today). But `recentSessions` (→ intervention drift) and **graduation** do NOT self-heal — name this residual explicitly; it strengthens the case to bring progress into the txn (Phase 3).
- **Deploy nit:** `gradeTypedTest` has no `timeoutSeconds` → v2 onCall **default 60s** (not 90s); still ample for the txn. Node 24, `maxInstances:10`, default region `us-central1`.

### 11.7 Net design after corrections
Typed: `gradeTypedTest({answers, writeContext})` grades, attempts the write **honoring the client `attemptDocId`** and **echoing the client anchor**, returns the grade **regardless of write success**; client retries only the write. MCQ: `submitMcqAttempt({results, context, attemptDocId})`. Shared `writeAttemptTxn`: auth+enrollment (`enrolledClasses`/`studentIds`), server `passThreshold` with the review-branch, deterministic-id transaction, refuse-on-invalid-anchor. `processTestResults` stays client-side, idempotent across retry. Phase-3 progress-in-txn roadmapped; Phase-4 `create`-only lockdown + MCQ re-grade fast-follow.

---

# 12. CODEX ROUND — additional fixes (verified). Folds with §11.
Codex reviewed the pre-§11 draft; it **independently reproduced §11.1 (idempotency id), §11.3 (anchor source), §11.4 (review-pass)** — strong cross-validation. It also surfaced **4 issues §11 missed**, all verified against code:

### 12.1 🔴 HIGH (NEW) — the no-AI typed branch would BYPASS the write
`gradeTypedTest` short-circuits when every answer is blank/self-referencing: `if (answersToGrade.length === 0) return { results: [...blankResults, ...selfRefResults] }` (`functions/index.js:~155`) — it returns "graded" results **without any Anthropic call**. §4b's "after grading, call writeAttemptTxn" attaches the write to the AI path only, so an all-blank/self-ref typed submission would **return results but never write the attempt**.
- **FIX:** normalize ALL grading outcomes (AI path + no-AI short-circuit) into one **final-results variable**, then do the `writeContext` write once at a single exit point. Preserve the current all-blank result shape intentionally.

### 12.2 🟠 MEDIUM (NEW) — check existence BEFORE the Anthropic call, not only in the write txn
Typed grading retries up to 3× (`TypedTest.jsx:587`). If call #1 grades+writes but the client times out before receiving the response, retry #2 **re-spends AI tokens** before the in-txn idempotency check discovers the attempt already exists. §11.2 fixed write-failure re-billing; this is the **success-but-lost-response** case.
- **FIX:** derive/receive the deterministic `attemptDocId` **up front**; if `writeContext` present AND the attempt already exists, **return the existing attempt before calling Anthropic.** (Cheap one-doc read guards the expensive AI call.)

### 12.3 🟠 MEDIUM (NEW) — preserve (or explicitly deprecate) the user-stats side effect
Both current writers do, AFTER the attempt write, `updateDoc(users/{uid}, { stats: { credibility, retention, … } })` (`db.js:1250`, `:1404`). The plan only writes the attempt → after cutover, **user stats silently stop updating.**
- **Evidence:** a grep of `src/pages` + `src/components` for `credibility`/`retention` consumers returned **nothing** → likely no live UI depends on these. **DECISION (recommend): explicitly deprecate** them in the server path, after a wider grep (gradebook/teacher/analytics/db readers) confirms zero consumers. If any consumer exists, replicate the stats update inside `writeAttemptTxn`. Do NOT silently drop without the grep.

### 12.4 🟡 MEDIUM (NEW) — convert touched raw `Error` throws to `HttpsError`
`gradeTypedTest` throws **raw `Error`** for auth/input (`functions/index.js:77` `throw new Error("Unauthenticated…")`; unknowns re-wrapped at `:398`), surfacing to the client as generic `functions/internal` → unpredictable retry/display. While touching this function, convert validation/auth/permission failures to `HttpsError` (as `submitTest`/`renameStudent` do), so the client can branch on stable error codes.

### 12.5 Framing (Codex) — Phase 1 is a "durable gradebook anchor," NOT a "complete progression fix"
Make this explicit in the rollout: Phase 1 guarantees the **attempt** is durable (so CSD/TWI self-heal via reconciliation — the support-recovery win), but a crash after the function returns still leaves `completeSessionFromTest` (session_states/CSD-increment/graduation) unrun. **True grade+progress atomicity requires Phase 3.** Market accordingly; don't oversell Phase 1.

### 12.6 Codex verdict
"Good architecture direction… After [the must-fixes], Phase 1 is reasonable as a backward-compatible deployment, with Phase 3 still required for full progress-write reliability." Must-fixes = §11.1 id, §11.4 review-pass, §12.1 no-AI write path, §12.2 pre-AI existing-attempt check, §11.3 anchor strategy — all now in the plan.

---

# 13. IMPLEMENTATION SPEC — Phase 1 (SUPERSEDES §4–§9; §11/§12 are the rationale)
This is the executable contract. §4–§9 are kept as history; **implement from §13.** Exact callables, payloads, return shapes, client branches.

## 13.1 Server — `functions/index.js`

### `writeAttemptTxn(uid, ctx, attemptAnswers)` — internal helper (the one true writer)
```
ctx = { studentId, classId, listId, studyDay, sessionType, testType,
        attemptDocId,                       // EXACT client doc id (§11.1) — the txn key
        totalQuestions,                     // REQUIRED — # questions presented (MCQ: testWords.length);
                                            //   score divides by this, NOT attemptAnswers.length (§Codex-High)
        newWordStartIndex, newWordEndIndex, wordsIntroduced,  // ECHOED from client (§11.3)
        segmentStartIndex, segmentEndIndex, interventionLevel }  // echoed
1. assert uid === ctx.studentId  (else HttpsError 'permission-denied')
2. read classes/{classId}; assert student enrolled — classData.studentIds.includes(uid)
   OR users/{uid}.enrolledClasses[classId] exists  (§11.6; pattern from renameStudent:793)
3. passThreshold = classData.assignments[listId].passThreshold ?? 95   // 0–100 (§11.4)
4. // SCORE — must divide by TOTAL questions, not answered (§Codex-High): MCQ scores against
   //   testWords.length, so skipped/unanswered count as incorrect (db.js:1185). attemptAnswers
   //   for MCQ contains ANSWERED rows only (Object.entries(answers), MCQTest.jsx:515) → dividing
   //   by attemptAnswers.length would turn 10/50 into 100%.
   correctCount  = attemptAnswers.filter(a => a.isCorrect ?? a.correct).length
   totalQuestions = ctx.totalQuestions ?? attemptAnswers.length   // REQUIRED in ctx for MCQ
   skipped       = Math.max(0, totalQuestions - attemptAnswers.length)
   score         = Math.round(correctCount / totalQuestions * 100)   // 0–100 (§11.4)
   passed = (ctx.sessionType === 'review') ? true : (score >= passThreshold)   // review branch (§11.4)
   // (Typed is safe with the fallback — answersToGrade is built from ALL words, so
   //  attemptAnswers.length === total — but still pass ctx.totalQuestions explicitly.)
5. REFUSE invalid anchor: if sessionType==='new' and !(Number.isInteger(ctx.newWordEndIndex) && ctx.newWordEndIndex>=0)
   → HttpsError 'invalid-argument' (never write an invalid anchor — §11.3 / CS-2026-06-21)
6. runTransaction:
     ref = attempts/{ctx.attemptDocId}
     existing = await tx.get(ref)
     if existing.exists:
        assert existing.data().studentId === uid       // ownership (same as readExistingAttemptForContext)
        return { ...normalizeExisting(existing), alreadyWritten:true }   // idempotent
     tx.set(ref, {
        ...attemptData,            // same field set as db.js submit*Attempt (studentId, classId, listId,
                                   //   studyDay, sessionType, testType, answers:attemptAnswers, echoed
                                   //   anchor newWordStart/EndIndex/wordsIntroduced, segment*, submittedAt, …)
        totalQuestions,            // EXPLICIT (§Codex) — gradebook/reconciliation read these
        skipped,
        score,                     // 0–100
        passed,
        gradedAt: serverTimestamp(),
     })
   return { attemptId: ctx.attemptDocId, score, passed, results: finalResults, attemptWritten:true }
```

### `gradeTypedTest({ answers, writeContext? })` — extended (typed)
`answers` = the input rows the client already sends: `[{ wordId, word, correctDefinition, studentResponse }]` — note the input field is **`correctDefinition`** (`TypedTest.jsx:677`), which maps to the stored **`correctAnswer`** (`db.js:1311`).
```
1. auth: if !request.auth → HttpsError 'unauthenticated'   // §12.4 (was raw Error)
2. PRE-AI idempotency (§12.2): if writeContext:
     existing = await readExistingAttemptForContext(uid, writeContext)   // §Codex-Medium: OWNERSHIP-checked
     if existing → return normalizeExisting(existing)                    // BEFORE Anthropic — no token spend
3. grade → gradeResults = [{ wordId, isCorrect, reasoning }]   // ONE exit var: AI path AND
                                                                // the all-blank/self-ref no-AI branch (§12.1)
4. // merge INPUT rows + grading → the full stored row set (§Codex-High-1; exact field mapping):
   attemptAnswers = answers.map(a => { const g = gradeResults.find(r => r.wordId === a.wordId) || {}; return {
       wordId: a.wordId, word: a.word,
       correctAnswer: a.correctDefinition,        // correctDefinition (input) → correctAnswer (stored)
       studentResponse: a.studentResponse,
       isCorrect: g.isCorrect ?? false, aiReasoning: g.reasoning || '',
       challengeStatus: null, challengeNote: null, challengeReviewedBy: null, challengeReviewedAt: null,
   }})
5. if !writeContext → return { results: gradeResults }         // backward-compatible (display only)
6. try: r = await writeAttemptTxn(uid, writeContext, attemptAnswers)
        return { results: gradeResults, score:r.score, passed:r.passed, attemptId:r.attemptId, attemptWritten:true }
   catch writeErr:
        return { results: gradeResults, attemptAnswers, attemptWritten:false, writeError: writeErr.message }
        // §11.2 — grade NOT discarded/re-billed; attemptAnswers handed back so the write-only retry
        // can persist WITHOUT re-grading (§Codex-High-1: res.results alone is insufficient)
```

### `readExistingAttemptForContext(uid, writeContext)` — ownership-checked lookup (§Codex-Medium)
Guards the pre-AI/idempotency return so a guessed `attemptDocId` can't leak another student's attempt:
```
doc = await attempts/{writeContext.attemptDocId}.get()
if !doc.exists → return null
if doc.studentId !== uid → throw HttpsError 'permission-denied'     // never normalize someone else's attempt
if doc.classId !== writeContext.classId || doc.listId !== writeContext.listId
   || doc.testType !== writeContext.testType || doc.sessionType !== writeContext.sessionType
   → throw HttpsError 'failed-precondition'   // id reused across a different context
return doc
```
(`writeAttemptTxn`'s in-transaction existence check uses the same ownership assertion.)

### `submitVocabAttempt({ testType, context, attemptAnswers })` — NEW shared write-only callable (§Codex-High-1)
Used by **MCQ** (grade client-side) and the **typed write-retry**. Takes the FULL `attemptAnswers` rows (not just grading outputs), so the doc is reconstructable without re-grading.
```
1. auth check (HttpsError)
2. r = await writeAttemptTxn(uid, context, attemptAnswers)
3. return { results: attemptAnswers.map(toApiResult), score:r.score, passed:r.passed, attemptId:r.attemptId, alreadyWritten:r.alreadyWritten ?? false }
```
- MCQ builds `attemptAnswers = [{ wordId, correct }]` (its row shape, `db.js`/`studyService` use `correct`); typed retry passes the `attemptAnswers` it got back from `gradeTypedTest`.

### §13.5 Canonical field shapes (§Codex-High-2 + Medium-3) — THREE distinct shapes, do not conflate
| Surface | Field | Shape |
|---|---|---|
| **API grading result** (function return `results`, consumed by `TestResults.jsx:14`) | `isCorrect` + **`reasoning`** | `{ wordId, isCorrect, reasoning }` — NOT `aiReasoning` (the live fn returns `reasoning`, `functions/index.js:137`) |
| **Stored attempt `answers` row** (`db.js:1365`) | `isCorrect` + `aiReasoning` (typed) / `correct` (mcq) | typed: `{ wordId, word, correctAnswer, studentResponse, isCorrect, aiReasoning }`; mcq: `{ wordId, correct, ... }` |
| **`processTestResults` input** (`studyService.js:473`) | **`correct`** | `{ wordId, correct }` — derive `correct: isCorrect` from the API result before passing |

- `normalizeExisting(doc)` → API shape: `{ results: doc.answers.map(a => ({ wordId:a.wordId, isCorrect:a.isCorrect, reasoning: a.aiReasoning ?? a.reasoning })), score:doc.score, passed:doc.passed, attemptId:doc.id, alreadyWritten:true }` — maps stored **`aiReasoning` → `reasoning`**.
- Client, before calling `processTestResults`, maps API `results` → `{ wordId, correct: isCorrect }`.

## 13.2 Client branches

### TypedTest.jsx
```
res = await gradeTypedTest({ answers: answersToGrade,
       writeContext:{ ...sessionContext, attemptDocId, totalQuestions: words.length } })  // typed: all words
display(res.results)                                  // res.results = API shape {wordId,isCorrect,reasoning}
if (res.attemptWritten || res.alreadyWritten):
    ptr = res.results.map(r => ({ wordId:r.wordId, correct:r.isCorrect }))   // §13.5 isCorrect→correct
    processTestResults(ptr)  // idempotent (§11.5); then completeSessionFromTest; clearTestState
elif (res.attemptWritten === false):                  // §Codex-Medium-1
    show "graded — saving failed, retrying…"
    DO NOT processTestResults / completeSessionFromTest / clearTestState   // preserve recovery; block progression
    retry: submitVocabAttempt({ testType:'typed', context:{...sessionContext, attemptDocId},
                                attemptAnswers: res.attemptAnswers })   // full rows handed back (§Codex-High-1)
           → on success, run the success branch above
else (no writeContext / legacy): existing path
```

### MCQTest.jsx
```
attemptAnswers = gradeLocally()    // [{ wordId, correct, ... }] — ANSWERED rows only
res = await submitVocabAttempt({ testType:'mcq',
       context:{ ...sessionContext, attemptDocId, totalQuestions: testWords.length },  // MCQ: ALL questions, not answered
       attemptAnswers })
if success → processTestResults(attemptAnswers.map(a=>({wordId:a.wordId, correct:a.correct})));
             completeSessionFromTest; clearTestState
if throws → "saving failed, retrying…"; preserve recovery; retry SAME attemptDocId + attemptAnswers
```
**Invariant (§Codex-Medium-1):** `clearTestState` / `processTestResults` / `completeSessionFromTest` run **only** after a confirmed durable write (`attemptWritten` or `alreadyWritten`), never on `attemptWritten:false`.

## 13.3 Files (Phase 1)
`functions/index.js` (+`writeAttemptTxn`, +`submitVocabAttempt`, extend `gradeTypedTest`, HttpsError-ify touched throws) · `TypedTest.jsx` (pass writeContext+attemptDocId, branch on attemptWritten, write-only retry) · `MCQTest.jsx` (call submitVocabAttempt, retry) · `db.js` (keep `submit*Attempt` for CS/manual + legacy fallback; **decide stats side-effect** per §12.3 grep first). NOT firestore.rules (Phase 4), NOT completeSessionFromTest (Phase 3).

## 13.4 Decisions still open for the owner
- Q (§12.3): deprecate `users.stats.credibility/retention` (grep shows no UI consumer) or replicate server-side? **Verify with a full grep first.**
- Q: legacy-client fallback during overlap — keep old client write path live (risk: needs the same `attemptDocId` to avoid dup), or hard-gate so only one writer per client version (§11.1 fix b, safer)?
