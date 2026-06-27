# PLAN — Typed-Grading "Malformed Payload" Fix (v5)

Status: v5 — 3-agent audit (§0) + Codex rounds 1 (§0.1), 2 (§0.2) & 3 (§0.3) applied.
Implementation-ready. One fix already applied (Fix 1, see §4.1).

## 0.3 Changelog v4→v5 (from Codex round 3)
- **§4.2b ordering fix (MED): sanitize AFTER enrollment, not before.** `sanitizeStoredRows` does
  Admin-SDK reads of `lists/{listId}/words/{wordId}`. If run before `writeAttemptTxn`'s
  enrollment/assignment validation, any authed user could force reads on arbitrary lists before
  the write is rejected (read/cost abuse, even though no definitions are returned). Fix: factor the
  enrollment+assignment check out of `writeAttemptTxn` into a shared `assertCanWriteAttempt(uid,
  ctx)`, call it FIRST in `submitVocabAttempt`, then `sanitizeStoredRows`, then `writeAttemptTxn`.
  (Mirrors the grade path, where the `callerMayResolveList` gate already precedes resolution.)
- §4.2 wording: "optional §4.2b" → "mandatory §4.2b" (stale after v4).

## 0.2 Changelog v3→v4 (from Codex round 2)
- **§4.2b promoted OPTIONAL → MANDATORY (HIGH).** Grading and the durable write are separate
  calls; the live write (`submitVocabAttempt`) uses client-built `attemptAnswers`
  (`correctAnswer: word.definition`, TypedTest.jsx:771). A student carrying an OLD thin recovery
  marker (saved before Fix 1 ships) would, post-deploy, get grading fixed (server-resolved) but
  the WRITE would still receive `correctAnswer: undefined` → write fails → the exact "graded but
  not written" bug. So write-path resolution/sanitization is required, not optional.
- **§4.3 coalescing extended to the write path (MED).** The live write does not go through
  `buildTypedAttemptAnswers`; it persists client `attemptAnswers` via `submitVocabAttempt`
  (functions/index.js:226→writeAttemptTxn). The same non-undefined coalescing + Firestore backfill
  must run there. Covers BOTH typed and MCQ (shared write path), so any thin-pool MCQ recovery is
  also protected.
- Note: write-path resolution carries NO oracle concern — `submitVocabAttempt` returns only
  `{wordId, isCorrect, reasoning}` (functions/index.js:238), never definitions, and
  `writeAttemptTxn` already enforces enrollment. So §4.2b needs no extra authz gate.

## 0.1 Changelog v2→v3 (from Codex review)
- **§4.5 reshaped (HIGH): write-failure retry must NOT re-grade/re-bill AI.** `handleSubmit`
  grades first (gradeWithRetry, L685) then writes, so a post-grade write failure + `handleSubmit`
  retry re-calls Anthropic. The stable `attemptDocId` dedups the WRITE but not the grade call.
  New shape: extract a `persistAndFinalize(payload)` from handleSubmit (everything from the
  durable write onward); on failure stash `{attemptAnswers, context, results}` in state and the
  modal's button calls `persistAndFinalize(stashed)` — retry only `submitVocabAttempt`, never
  re-grade. Button label → "Retry Save".
- **§4.3 hardened (HIGH): safe stored rows for malformed.** `buildTypedAttemptAnswers` maps
  `correctAnswer: a.correctDefinition` (functions/index.js:260); an unresolved partial row writes
  `undefined` → Firestore write fails / stores a malformed attempt. Coalesce ALL stored fields to
  non-undefined (`a.word||''`, `a.correctDefinition||''`, `a.studentResponse||''`).
- **§4.2 broadened (MED): `gradeAnswers` must be the single canonical array** for ALL downstream
  uses, not just filters — incl. final result ordering and post-grading validation that looks up
  the original answer (functions/index.js:565 region), plus finishGrading row construction.
- **§4.4 (MED): don't make grading an unauthenticated answer-key oracle.** Admin SDK bypasses
  rules; if any authed user can pass any `listId`, the function grades guesses against that list's
  canonical defs. Pass `classId` too and verify enrollment + list-assignment BEFORE resolving;
  if the check fails, skip server-resolution (grade against client values) rather than hard-fail.

## 0. Changelog v1→v2 (from 3-agent audit)
- §2 step 3: corrected TypedTest entry branch — recovery flows through **PATH B (legacy
  wordPool nav-state)**, NOT PATH A. Recovery `navigate` passes `state.wordPool`, never builds a
  `testConfig`. Mechanism/fix unchanged.
- §4.2: **`gradeTypedTest` is never called with `writeContext` by the live client** — the durable
  write is a SEPARATE `submitVocabAttempt` call. So server resolution fixes GRADING only; the
  WRITE's stored `correctAnswer` is fixed at source by Fix 1 (client), and optionally by §4.2b
  (resolve in the write path too). `writeContext?.listId` fallback is inert today.
- §4.4: **promoted to MANDATORY + deploy-ordering note** — without the client `listId`,
  `resolveAnswerDefinitions` early-returns and Fix 2 is a no-op. Server-only deploy = zero effect.
- §4.6: reworded rationale (the gap is "non-transient write failures bypass `withRetry`'s log +
  page catch only console.errors", NOT "only old path logs"); use a DISTINCT event name to avoid
  double-counting with `withRetry`'s `attempt_write_failed`.
- §4.5: added in-memory-nonce-fallback edge note (one non-idempotent retry path).
- §8: R1/R6 verified CONFIRMED; added R7 (write-path forgery of `isCorrect`) and R8 (dead L393
  effect cleanup).
Owner: (server-attempt-write follow-up) · Flag context: `SERVER_ATTEMPT_WRITE = true` (live)
Scope: typed (AI-graded) tests only. MCQ does not call `gradeTypedTest`.

---

## 1. Incident summary (evidence)

Source: Cloud Functions logs for `gradeTypedTest`, 2026-06-22 (uploaded), plus Firestore
`system_logs` + `attempts`.

- **230 malformed grading rejections** on 2026-06-22, `errCode = functions/invalid-argument`.
- **100% all-or-nothing**: every rejection had `malformedCount === totalAnswers`
  (sizes 25/30/35/50 = the test sample sizes). Zero partial cases.
- **14 distinct real students** in class **26SM SAT Inter B2** (`CKDTCxTTvscEZAY1DbUN`),
  lists `RmNNkuLPectBlBPiLbAJ` (Base Camp) + `dVliNv0p9jqZYp9rfLpN` (Ascent).
- **10 of 14 also had successful grading calls** same day → intermittent per student.
- **2 students fully stuck** (0 attempts written all day): 정다인 (`da.xn1j@gmail.com`,
  uid `Zuc4iziJ…`), 서준혁 (`gejh0131@gmail.com`, uid `nzfM76at…`).
- **Chronic, not a regression**: on 2026-06-19 the same failures appeared as 64 opaque
  `functions/internal`. The Phase-1 deploy HttpsError-ified the throw → it now surfaces as
  `invalid-argument` with an actionable message. Underlying bug predates the server-write work.
- **Word data is clean**: 0 of 1,200 + 1,600 words missing `definition`. Every malformed
  `wordId` resolves to a real word+definition in Firestore (`disorder`, `reproduction`, `elicit`…).

Conclusion: the client submits a payload where **every** answer is missing `correctDefinition`
(and `koreanDefinition`); `wordId` and `word` are present. The server's `gradeTypedTest`
rejects the whole batch.

---

## 2. Root cause (definitive)

The grading payload is built in `src/pages/TypedTest.jsx` (~L677):

```js
const answersToGrade = words.map((word) => ({
  wordId: word.id, word: word.word,
  correctDefinition: word.definition,           // <-- undefined when `words` is "thin"
  koreanDefinition: word.definitions?.ko || '',
  studentResponse: responses[word.id] || '',
}))
```

`words` becomes "thin" (objects with `id`+`word` but no `definition`) only on the
**crash-recovery path**:

1. On committing to a typed test, `DailySessionFlow.jsx` `navigateToTest` writes a
   crash-recovery marker to localStorage (`saveLocalSessionState`, ~L1165) with the pool
   **thinned to `{ id, word }`** (was L1168). Definitions stripped (localStorage size).
2. Tab crash / reload / reopen mid-test (no intentional exit) → recovery reads that thin
   pool: `recoveredWordPool = testRecovery.localState?.wordPool` (L678).
3. The recovery `navigate` (~L706-724) passes `state: { testType, wordPool: recoveredWordPool,
   … }` — it does NOT build a `testConfig`. In TypedTest, `testConfig` is therefore undefined,
   so `loadTestWords` skips PATH A and lands in **PATH B (legacy wordPool, L306-335)**, setting
   `words` = the thin objects → submit → `correctDefinition: word.definition` undefined for ALL
   → 100% malformed. (The sessionStorage `newWords: recoveredWordPool` at L698 is consumed only
   by DailySessionFlow's return-from-test handler, not by TypedTest.)

Why this is the bug and not the sibling save sites:
- Two autosave `useEffect`s (L362 study-phase, L401 test-phase-entry) were ALREADY patched to
  persist `definition`/`definitions`/`partOfSpeech` (they carry a comment describing this exact
  malform). **But** per the in-code comment at L1157-1162, those effects **never fire for the
  test phase** — the test runs on a separate route (`/typedtest`,`/mcqtest`), so this
  component's `phase` never becomes `NEW_WORD_TEST`/`REVIEW_TEST`. The **only** marker that
  actually gets written for the test is the explicit `navigateToTest` save (L1168) — and it
  was the one left thin. The fix had landed on two dead-code paths and skipped the live one.

Matches all evidence: intermittent (only post-crash), all-or-nothing (whole snapshot thin),
day-1-new heavy (most reload churn), `wordId`/`word` present but `definition` absent
(saved fields were exactly `{id, word}`).

---

## 3. Design decisions

### 3.1 Two-layer fix (root cause + defense in depth)
- **Client root cause (Fix 1):** stop thinning the recovery marker — persist the fields
  grading needs. Makes both the grade payload AND the durable write correct at the source.
- **Server resilience (Fix 2):** make the answer key **server-authoritative** — resolve
  `correctDefinition`/`koreanDefinition` from Firestore by `(listId, wordId)` rather than
  trusting the client. Eliminates the whole failure class regardless of any future client
  regression.

### 3.2 Server-primary vs client-primary (decided: server-primary, client fallback)
Resolve from Firestore as the primary source; use the client-supplied value only as a fallback
when a word can't be resolved (deleted word, or old client that didn't send `listId`). Reasons:
1. **Grading integrity / anti-forgery.** Today the AI grades against the client-supplied
   `correctDefinition`; a tampered client could send `correctDefinition === studentResponse`
   and force a "correct". Server-resolution closes this.
2. **Single source of truth** — fixes all 14 students and any future client thinning bug in one place.
3. **Cost is negligible** — one batched `getAll()` of ≤50 refs (~tens of ms, ~50 reads) is
   dwarfed by the multi-second Anthropic call.

### 3.3 All-or-nothing rejection (decided: soften, now that resolution makes it safe)
Pre-resolution, softening alone would hand these students 0% (no good answers). POST-resolution,
total-malformed should be ~never. So: after resolution, **drop** still-unresolvable answers to
auto-incorrect (with clear reasoning) and grade the rest; only throw the clear `invalid-argument`
if **every** answer is still unresolvable (a genuinely unprocessable payload — don't silently 0).

---

## 4. Changes

### 4.1 Fix 1 — client root cause (APPLIED) — `src/pages/DailySessionFlow.jsx` (~L1168)
Persist grading fields in the test-recovery marker, mirroring the already-patched siblings:
```js
wordPool: (wordPool || []).map(w => ({
  id: w.id,
  word: w.word,
  definition: w.definition,
  definitions: w.definitions,
  partOfSpeech: w.partOfSpeech,
})),
```
(+ explanatory comment that this is the ONLY marker that fires for the test phase.)
Status: **DONE** in working tree (not committed, not deployed).

Size check for Codex/agents: the two sibling sites already persist these fields, so the size
delta is accepted precedent. Heavy field `samples` remains dropped.

### 4.2 Fix 2 — server-primary definition resolution — `functions/index.js` (`gradeTypedTest`)
New module-level helper (before `exports.gradeTypedTest`):
```js
// Server-authoritative answer key: resolve canonical definitions from Firestore by
// (listId, wordId). Fixes client "thin pool" malform AND removes the grading-integrity
// hole of trusting a client-supplied answer key. Client values are fallback-only.
async function resolveAnswerDefinitions(listId, answers) {
  if (!listId) return answers;                       // old client / no context → fallback
  const ids = [...new Set(answers.map((a) => a.wordId).filter(Boolean))];
  if (ids.length === 0) return answers;
  const refs = ids.map((id) =>
    db.collection("lists").doc(listId).collection("words").doc(id));
  const snaps = await db.getAll(...refs);
  const byId = new Map();
  snaps.forEach((s) => { if (s.exists) byId.set(s.id, s.data()); });
  return answers.map((a) => {
    const w = byId.get(a.wordId);
    if (!w) return a;                                 // unresolved → keep client fallback
    return {
      ...a,
      word: a.word || w.word,
      correctDefinition: w.definition ?? a.correctDefinition,
      koreanDefinition: (w.definitions && w.definitions.ko) ?? a.koreanDefinition,
    };
  });
}
```
Wiring inside `gradeTypedTest` (after the pre-AI idempotency block ~L312):
```js
const listId = request.data.listId || writeContext?.listId || null;
const classId = request.data.classId || writeContext?.classId || null;
// Authz gate (Codex MED): only resolve canonical defs for a list the caller is entitled to,
// so the function isn't an answer-key oracle for arbitrary lists. On failure, fall back to
// client-supplied defs (parity with old behavior) rather than blocking a legit student.
const mayResolve = await callerMayResolveList(uid, classId, listId);
const gradeAnswers = mayResolve
  ? await resolveAnswerDefinitions(listId, answers)
  : answers;
```
`callerMayResolveList(uid, classId, listId)`: returns true iff the class doc exists AND
(`classData.studentIds.includes(uid)` OR `users/{uid}.enrolledClasses[classId]`) AND
`classData.assignments[listId]` exists. Mirrors the enrollment logic already in `writeAttemptTxn`.
Returns false (→ skip resolution) on any miss; logs `grade_resolve_denied` for visibility.

**`gradeAnswers` is the single canonical array after resolution.** Replace `answers` with
`gradeAnswers` at EVERY downstream use (Codex MED — not just filters): `finishGrading`'s
`buildTypedAttemptAnswers(gradeAnswers,…)` (L320), the malformed check (L350), blank/nonBlank
filters (L370/L373), the AI `wordsJson` build (already via answersToGrade←nonBlank), the FINAL
result ordering/return, and the post-grading validation that finds the original answer
(~L565 region). Leave only the input-validation checks (L295/299/303) on the raw `answers`.

**IMPORTANT (audit finding): this fixes GRADING, not the durable WRITE.** The live client never
passes `writeContext` to `gradeTypedTest`; `finishGrading`'s write branch (`if (writeContext)`)
is dead on today's path. The durable attempt is written by a SEPARATE `submitVocabAttempt` call
(`TypedTest.jsx:792`) whose `attemptAnswers` carry `correctAnswer: word.definition` built from
the client's (possibly thin) `words`. So the stored `correctAnswer` is made correct by **Fix 1**
(client, at source) AND by **mandatory §4.2b** (server write-path sanitize/backfill, which also
covers clients still carrying an OLD thin marker post-deploy).

### 4.2b (MANDATORY) — resolve + sanitize in the write path — `submitVocabAttempt` (functions/index.js:226)
WHY mandatory: the live durable write uses client-built `attemptAnswers`, NOT
`buildTypedAttemptAnswers`. A client with a pre-Fix-1 thin recovery marker still sends
`correctAnswer: undefined`; without this, grading is fixed but the write fails ("graded but not
written"). This also protects MCQ (shared write path).

New helper (reuses the same `getAll` shape as §4.2):
```js
async function sanitizeStoredRows(listId, rows) {
  let byId = new Map();
  if (listId) {
    const ids = [...new Set(rows.map((a) => a.wordId).filter(Boolean))];
    if (ids.length) {
      const refs = ids.map((id) =>
        db.collection("lists").doc(listId).collection("words").doc(id));
      (await db.getAll(...refs)).forEach((s) => { if (s.exists) byId.set(s.id, s.data()); });
    }
  }
  return rows.map((a) => {
    const w = byId.get(a.wordId);
    return {
      ...a,
      word: a.word || w?.word || "",
      // backfill canonical definition when client omitted it; never write undefined
      correctAnswer: a.correctAnswer || w?.definition || "",
      studentResponse: a.studentResponse || "",
      isCorrect: a.isCorrect ?? a.correct ?? false,
      aiReasoning: a.aiReasoning ?? a.reasoning ?? "",
    };
  });
}
```
**Ordering (Codex round 3): authorize BEFORE sanitizing**, since `sanitizeStoredRows` issues
Admin-SDK reads. Factor the enrollment+assignment validation currently inside `writeAttemptTxn`
into a shared `assertCanWriteAttempt(uid, ctx)` (throws `permission-denied`/`failed-precondition`
on miss; may return the fetched `classData`/`passThreshold` so `writeAttemptTxn` doesn't re-read).
Wire in `submitVocabAttempt` after the idempotency check (L235):
```js
await assertCanWriteAttempt(uid, context);                 // enrollment + assigned list FIRST
const rows = await sanitizeStoredRows(context.listId, attemptAnswers);   // reads only after authz
const r = await writeAttemptTxn(uid, context, rows);        // reuses the validated context
```
`context.listId` is guaranteed (writeAttemptTxn hard-requires it). Backfill-when-missing (not
always-override) preserves any valid client `correctAnswer` (e.g. MCQ option text) while fixing
the thin-pool `undefined` case. Idempotency unchanged (still keyed on `context.attemptDocId`).
(Alternative: move `sanitizeStoredRows` INSIDE `writeAttemptTxn` after its enrollment checks and
before the write — same guarantee, no extracted helper. Implementer's choice; either keeps
reads strictly post-authorization.)

### 4.3 Fix 3 — soften the malformed check — `functions/index.js` (~L350)
Replace the hard "any malformed → throw" with:
```js
const malformed = gradeAnswers.filter(
  (a) => !a.wordId || !a.word || !a.correctDefinition || a.studentResponse === undefined);
if (malformed.length === gradeAnswers.length) {
  // EVERY answer unprocessable even after server resolution → surface clearly, don't 0 silently
  logger.error("Unresolvable grading payload (all answers malformed post-resolution)", {
    uid: request.auth.uid, totalAnswers: gradeAnswers.length, listId,
    wordIds: malformed.map((a) => a.wordId || "(no id)").join(", "),
  });
  throw new HttpsError("invalid-argument", "Cannot grade: no resolvable word/definition data. Please reload the test page and submit again.");
}
const malformedIds = new Set(malformed.map((a) => a.wordId));
if (malformed.length > 0) {
  logger.warn("Partial malformed grading payload — auto-marking unresolved words wrong", {
    uid: request.auth.uid, malformedCount: malformed.length, totalAnswers: gradeAnswers.length, listId });
}
// downstream: grade only !malformedIds; emit auto-incorrect results for malformedIds
```
`malformedResults` (auto-incorrect, reasoning "Could not verify this word — please reload and
retry.") merge into the final results alongside blank/self-ref. Scoring denominator stays
`ctx.totalQuestions` (unchanged), so a dropped word counts as wrong — acceptable as a rare
last-resort, and far better than blocking the whole batch.

**Safe stored rows (Codex HIGH).** `buildTypedAttemptAnswers` (functions/index.js:255-271) maps
`correctAnswer: a.correctDefinition` etc.; an unresolved malformed row would persist `undefined`
fields → Firestore write fails or stores a malformed attempt. Coalesce ALL stored fields to
non-undefined so a softened partial batch always writes cleanly:
```js
wordId: a.wordId, word: a.word || "",
correctAnswer: a.correctDefinition || "",
studentResponse: a.studentResponse || "",
isCorrect: g.isCorrect ?? false,
aiReasoning: g.reasoning || "",
```
(Apply the coalescing in `buildTypedAttemptAnswers` itself, so every row — graded, blank,
self-ref, or malformed — is undefined-safe.) **The live durable write does NOT use
`buildTypedAttemptAnswers`** — it persists client `attemptAnswers` via `submitVocabAttempt`, so
the same coalescing+backfill is applied there by §4.2b's `sanitizeStoredRows` (mandatory).

### 4.4 Fix 4 — client passes `listId` + `classId` on the grade call — `src/pages/TypedTest.jsx` (~L618) — MANDATORY
```js
const result = await gradeTypedTest({ answers: answersToGrade, listId, classId: classIdParam })
```
`listId` and `classIdParam` are already in scope (used in `context.listId`/`context.classId`).
`classId` feeds the §4.2 authz gate. **This is not optional / not just an
"until clients update" nicety**: `gradeTypedTest` currently destructures only `{answers,
writeContext}` and no client sends `writeContext`, so `request.data.listId` is the SOLE source of
`listId`. Without §4.4, `resolveAnswerDefinitions` hits `if (!listId) return answers` and Fix 2
is a complete no-op. **Deploy ordering:** server (Fix 2/3) is backward-compatible (fallback to
client value), but the resolution only activates once the client carrying §4.4 is live. Ship
both; resolution turns on when the client lands.

### 4.5 Fix 5 — render the write-failure UI — `src/pages/TypedTest.jsx`
Bug: `submitError` banner + "Retry Submission" button are nested inside the
`{isSubmitting && (…)}` modal (L1525→1558), but the catch sets `setIsSubmitting(false)` (L824)
before returning → the modal unmounts → the affordance never renders. The student is silently
dumped back on the test screen (verified via adversarial Playwright run).
Fix (reshaped per Codex HIGH — retry must NOT re-grade/re-bill AI):
- **Do NOT wire the retry to `handleSubmit`.** `handleSubmit` grades first (`gradeWithRetry`,
  L685) then writes; a post-grade write failure retried via `handleSubmit` makes a fresh Anthropic
  call (the stable `attemptDocId` only dedups the WRITE). 
- **Extract `persistAndFinalize(payload)`** from `handleSubmit` — everything from the durable
  write onward (the `submitVocabAttempt` call L792-798, then `processTestResults` L832, session
  completion L848+, `setShowResults`/navigation). `handleSubmit` calls it once after grading.
- On write failure, **stash** `{ attemptAnswers, context, results }` in state
  (e.g. `setPendingSave(payload)`) and set `submitError`. The standalone modal
  (`{submitError && !isSubmitting && (…)}`, mirroring `gradingError` L1575) shows a **"Retry
  Save"** button whose `onClick` calls `persistAndFinalize(pendingSave)` — write-only, no
  re-grade. Clear `pendingSave`/`submitError` on success.
- Idempotency on the write retry is still guaranteed by the stable `attemptDocId` +
  `resultsProcessedRef` guard (L832). 
Edge note (pre-existing, not introduced): if `localStorage` is blocked,
`getOrCreateAttemptNonce` (testRecovery.js:106-110) falls back to a fresh in-memory nonce per call
→ a write retry there could double-write. Out of scope; flagged.

### 4.6 Fix 6 — observability for server-write failures — `TypedTest.jsx` + `MCQTest.jsx`
Bug (corrected rationale per audit): `attempt_write_failed` (db.js:158) lives inside `withRetry`
and is emitted by BOTH the server and old paths — but ONLY when the retry loop exhausts on a
*transient* error. The actual write failures are *non-transient* HttpsErrors (e.g.
`invalid-argument`), which `isTransientError` (db.js:60-68) excludes → `withRetry` re-throws them
WITHOUT logging, and the page-level catch (TypedTest L819-826 / MCQTest L662-678) only
`console.error`s. Net: non-transient durable-write failures are invisible (today's
`attempt_write_failed = 0` despite forced adversarial write failures).
Fix: in the page-level catch on both pages, add
`logSystemEvent('attempt_write_failed_client', {…}, 'error')` with
{userId, classId, listId, studyDay, sessionType, testType, errCode, errName}. Use the **distinct
event name** (`…_client`) so it does not double-count with `withRetry`'s `attempt_write_failed`
on the transient-exhaustion case. `logSystemEvent` is already imported in both files.

---

## 5. Ordering / rollout
1. Fix 1 (client root cause) — highest leverage, stops new thin payloads at the source.
2. Fix 2+3+4 (server resolution + soften + client listId) — deploy together; server resolution
   is backward-compatible (fallback) so client/server deploy order is safe.
3. Fix 5+6 (UX + observability) — independent, low risk.
Server (`functions`) deploy + client (Netlify) deploy are both done by the user on Windows.
No commits / no deploys without explicit say-so.

## 6. Post-fix CS (separate from code)
Manually unstick the 2 students (정다인, 서준혁) once live, via `scripts/cs/manual-pass.mjs`
with a VALID anchor (per `SUPPORT_RUNBOOK.md` / CS-2026-06-21). Re-run the data-integrity sweep
before/after. Log a `CS-2026-06-23` entry.

## 7. Validation plan
- `node --check functions/index.js`; esbuild syntax check of the 3 client files from /tmp.
- Live typed E2E via Playwright (audit student, both EN/KO) — confirm grade + writtenBy:cloud-function.
- **Recovery reproduction**: drive a typed test, simulate crash (reload mid-test without
  intentional exit), resume, submit → confirm grading succeeds (previously malformed). Verify the
  localStorage marker now contains definitions.
- Adversarial: forge `correctDefinition` in the grade payload → confirm server ignores it
  (grades against Firestore) → anti-forgery proven.
- Confirm softened path: inject one bad wordId → other answers still grade.

## 8. Risks / open questions (for Codex)
- R1 (VERIFIED CONFIRMED by audit): `db = admin.firestore()` exists at module scope;
  `getAll` is valid Admin SDK (already used at functions/index.js:859 as `tx.getAll`); ref path
  `lists/{listId}/words/{wordId}` matches storage. No change needed — included for Codex sanity.
- R2: Do any typed tests span MORE than one list (so a single top-level `listId` is insufficient)?
  Assumption: typed test = one assignment = one list. Confirm.
- R3: Soften-vs-throw semantics: is auto-marking an unresolvable word "wrong" (vs skipping +
  shrinking denominator) the desired behavior? (Plan chooses auto-wrong; rare post-resolution.)
- R4 (RESOLVED): Grade path = server-authoritative via §4.2; WRITE path = hardened via §4.2b
  (mandatory `sanitizeStoredRows` in `submitVocabAttempt`). Fix 1 stops NEW thin markers at source;
  §4.2b protects clients still carrying OLD thin markers post-deploy (and MCQ). No residual gap.
- R5: Any other reader of the thin localStorage `wordPool` shape that now gets extra fields?
  (Audit found no other thin-pool source reaching TypedTest; confirm no size regression in
  localStorage for large lists — `samples` still omitted, so delta is small.)
- R6 (VERIFIED CONFIRMED by audit): storage has `definition` (string) + `definitions.ko` (map);
  client `word.definitions?.ko` and server `w.definitions?.ko` agree.
- R7 (NEW, from audit): grading-integrity residual — even with §4.2, the WRITE
  (`submitVocabAttempt`) trusts client-supplied `isCorrect` in `attemptAnswers`, so a forger could
  flip `isCorrect` on the write regardless of grading. This is the broader "forgeable attempts"
  concern (tracked separately); NOT solved here. Note so Codex knows §4.2's anti-forgery win is
  scoped to the grade call. Also: the resolve fallback (omit `listId` / deleted word) remains a
  forger escape hatch for the grade call.
- R8 (NEW, from audit): the autosave `useEffect` at DailySessionFlow L393-421 is effectively dead
  code for the test phase (never fires — test is a separate route). Not load-bearing; flag as a
  cleanup candidate so a future maintainer doesn't mistake it for the live test-recovery marker.
- R9 (NEW, Codex MED): answer-key oracle. Admin SDK bypasses Firestore rules, so server-resolving
  any `listId` the caller names would let an authed user grade guesses against arbitrary lists'
  canonical defs. Mitigated by §4.2 `callerMayResolveList` (enrollment + assignment gate; skip
  resolution on failure). Codex to confirm the gate is sufficient and that "skip-resolution on
  denial" (vs hard-fail) is the right posture (keeps legit students unblocked; denies the oracle).
- MCQ parity (note): the same client-supplied-answer-key trust exists conceptually for MCQ, but
  MCQ grades client-side / stores via `submitVocabAttempt`; server-side MCQ re-grade is the
  separately-tracked Phase-4 item, not in this plan's scope.
