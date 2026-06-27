# PLAN — Server-authoritative grading (server-written ⇒ server-DERIVED)

Status: AUDITED (3-agent + Codex rounds, 2026-06-27). Nothing implemented. Owner: (orchestrator).
The **root fix** David asked for. **What it actually delivers (post-audit, narrowed):** server-authoritative
**TYPED** correctness (G2 — AI-graded, gradeToken-bound) + the typed-retry bridge + a **writer-API guard**.
**Deferred to Phase E** (all need the same server-owned test-init snapshot the sync world lacks): **MCQ
correctness anti-forgery** (G1 is only a derivation *cleanup*, NOT a security fix — Codex), the **score
denominator**, and the **anchor** (G3). So this plan makes *typed* correctness server-derived; MCQ/denominator/
anchor authority is Phase E. Closes the typed half of **R7**.

> **Hard dependency (audit):** this plan is **NOT independent of `PLAN_attempt_write_lockdown.md`**. Deriving
> correctness server-side is meaningless while a client can still write `answers[].isCorrect` (rules:109) or
> `create` an attempt (rules:101). **G2 + the provenance markers require the lockdown's W1/W3** to be
> enforceable. Ship together (or lockdown-first). Earlier "independent, run in parallel" was wrong.

---

## 0. Goal

Make grade-bearing **correctness** not just server-*written* (lockdown's job) but server-*DERIVED* — computed
by a function from authoritative data, not echoed from the client. Then a `correctnessSource` marker actually
means "trustworthy," and downstream consumers stop carrying the 3-level provenance model for live data.

Two correctness gaps (verified); the anchor gap (G3) is split out to E.

| Gap | Today | File:line |
|---|---|---|
| **G1 MCQ correctness** | client computes `isCorrect`; server echoes the client's `correct`/`isCorrect` | `MCQTest.jsx:472,517-526` (sends `studentResponse`=chosen definition + `isCorrect`); `sanitizeStoredRows` `functions/index.js:441` |
| **G2 typed correctness** | `submitVocabAttempt` preserves caller `isCorrect` + stamps `writtenBy:'cloud-function'` → forgeable (**R7**) | `functions/index.js:291,441,278`; retry `TypedTest.jsx:823` |
| ~~G3 anchor~~ | echoed, only integer-checked → **deferred to Phase E (§4)** | `functions/index.js:272-275,234` |

## 1. Fixes

### G1 — MCQ derivation cleanup (NOT anti-forgery) · true MCQ authority → Phase E
- **Audit correction:** lists do NOT store an option set with per-option `isCorrect` — MCQ distractors are
  generated **client-side** from *other words' definitions*; the correct option is the word's own `definition`.
  The server can re-derive correctness from `selectedOptionId` (= the `wordId` whose definition was picked):
  `isCorrect = (selectedOptionId === questionWordId)`, removing the raw client-`isCorrect` echo. Text match
  (`normalize(studentResponse) === normalize(word.definition)`) is a **fail-closed** fallback (ambiguous/
  duplicate → mark incorrect). Small client-contract change (send the selection identity, not `correct`).
- **🔴 BUT this is NOT a security fix (Codex-High).** A direct caller already knows the question's `wordId`, so
  they can submit `selectedOptionId: <questionWordId>` for every row and "pass" without answering — structurally
  the same forgeable trust as client `isCorrect`, one step removed. So **G1 does NOT make MCQ correctness
  server-authoritative**; it's a *cleanup* (no raw `isCorrect` echo, cleaner derivation), not anti-forgery.
- **True MCQ anti-forgery needs a server-owned question→answer mapping** — either an **opaque option token
  minted at test setup** (server knows which token is correct; client can't), or the **Phase-E server-owned
  test-init snapshot** (server records, at init, the correct option per question and validates the submission
  against it). MCQ options are generated client-side today, so a token requires the server to own MCQ setup —
  i.e. the **same** server-owned-init mechanism as the denominator/anchor. **DECISION: defer true MCQ
  correctness authority to Phase E** (same root). Therefore **do NOT stamp a "trusted" `server-mcq` marker for
  forgery purposes** here — G1 ships as derivation cleanup only; MCQ correctness is **untrusted until E**.

### G2 — typed correctness only from the AI grader  ·  ships WITH the lockdown
- **`gradeTypedTest` is the sole setter of typed `isCorrect`** (it ran the AI); stamp
  `correctnessSource:'server-ai'` in the `gradeTypedTest → writeAttemptTxn` path after grading.
- **`submitVocabAttempt` must NOT persist client `isCorrect` for `testType:'typed'`** (today
  `sanitizeStoredRows:441` echoes it — that's R7). Reject typed grade fields, or drop them and require the
  attempt to come from `gradeTypedTest`. The legitimate typed **write-retry** must resolve correctness from
  the server grade, not re-supply it. (Audit F6: wire `writeContext` into the `gradeTypedTest` client call —
  `TypedTest.jsx:623` doesn't pass it today, so the no-rebill path isn't actually used.)
- **Write-failed-after-grade case (Codex-High):** existing-attempt idempotency does NOT cover "grading
  succeeded but write failed" — there's no attempt yet, and today the server returns graded `attemptAnswers`
  to the client to retry via `submitVocabAttempt` (`functions/index.js:516`), the exact path G2 must stop
  trusting. So "no re-bill via existing-attempt" is **insufficient**. **Resolved (§8.1): server-signed
  `gradeToken`** bound to `attemptDocId` — the retry re-presents the graded rows + token, the server verifies
  the HMAC and writes the server-authentic values (no re-bill, no trusting unsigned client `isCorrect`).
- **Enforceability depends on the lockdown:** "only `gradeTypedTest` sets typed `isCorrect`" holds only once
  the client can't write `answers[]`/`create` directly (lockdown W1/W3). Without it, R7 stays open. → ship G2
  with the lockdown.

## 2. Provenance markers + writer-API enforcement (server-only)
- `correctnessSource: 'server-ai'` — an **attempt-level top-level field** (NOT inside `answers[]`, which is
  client-writable pre-lockdown), set ONLY by `gradeTypedTest` (the AI is the authority). Its integrity depends
  on the lockdown denying client grade-field writes. Absent on legacy/forged attempts → downstream treats
  absence as untrusted. **No `server-mcq` trust marker** — G1 isn't anti-forgery (§1), so MCQ correctness has
  no trusted marker until Phase E mints one (option token / init snapshot). Don't stamp a marker that implies
  trust it doesn't have.
- **API-level guard, not caller discipline (Codex-Medium):** `writeAttemptTxn` today blindly trusts
  `a.isCorrect ?? a.correct` (`functions/index.js:223`). Change the **writer API** to require an explicit
  `correctnessSource` argument and **reject grade-bearing writes that lack it** (post-lockdown). So the hole
  can't be re-opened by a future caller forgetting to re-derive — the one true writer enforces it structurally.
- (`anchorSource` belongs to G3 → Phase E.)

## 3. Downstream simplifications this UNLOCKS (apply AFTER this + lockdown land; precise wording per audit)
- **Override §0.5:** the correctness gate resolves to `correctnessSource === 'server-ai' && post-fix` for
  **typed** attempts. **MCQ per-answer override still waits for Phase E** (NOT unlocked here — G1 isn't
  anti-forgery, so there's no trusted MCQ marker). So override v1 stays **typed-only (D7 holds)**. Historical
  attempts still need `legacy_attempt_untrusted`/`canForcePass`. The **anchor** half is also deferred (§3.1).
- **Lockdown §3:** the "MCQ correctness still client-computed" residual is **NOT resolved** by G1 — correct it
  to "MCQ correctness authority deferred to Phase E (option token / init snapshot)." Only the *typed* residual
  is closed (G2).
- **C+D §7-G:** Phase D doesn't close MCQ forgery and G1 doesn't either; true MCQ anti-forgery = Phase E.
  ✅ Reconciled: C+D §1 Phase D / §6 / §7-G now point to Phase E (not "fast-follow"); override §0.5 likewise.
- **Honest note (enables ≠ already-shipped):** these are edits to make in **step 2**, after this plan is
  audited/agreed and lands — not before.

### 3.1 Consequence for the override's ANCHOR gate (important)
Deferring G3 to E means there is **no server-validated anchor** in the synchronous world. The override's
day-advancing operations (per-answer flip that crosses threshold; force-pass) require a server-validated
anchor (override §0.5/§3.7). So **pre-E, those operations have nothing to validate against** → they'd return
`legacy_attempt_untrusted`. Options for the override (decide in step 2): (a) accept that **day-advancing
override waits for Phase E** (correctness-only, non-advancing edits work sooner), or (b) the override callable
does a **best-effort anchor re-derive+match with tolerance** at override time (accepting the residual init-vs-
submit risk the audit flagged). Recommend (a) — clean — and let E unlock advancing override. This makes the
override's natural home **after E**, which several audit rounds already pointed to.
- **HARD INVARIANT (Codex):** pre-Phase-E, an override may change **correctness/score only, NEVER advance a
  day**, unless the attempt carries a server-validated anchor source. Encode this as an invariant in the
  override plan (§0.5), not a soft preference — so no implementer ships day-advancement on an untrusted anchor.

## 4. G3 (anchor) — DEFERRED to Phase E (rationale)
A safe *synchronous* anchor validation needs to compare the echoed anchor to what the student studied at
init — but (i) no init snapshot is recorded server-side today, (ii) a client-held snapshot is forgeable
(`class_progress` is client-writable pre-lockdown), and (iii) a naive submit-time recompute legitimately
differs from init because `getOrCreateClassProgress` reconciliation mutates `totalWordsIntroduced` between
init and submit and `initializeDailySession` isn't pure (`returnMasteredWords`). Phase E's `onDocumentCreated`
trigger owns the whole lifecycle and can author the anchor authoritatively — so **G3 = derive the anchor in
E's trigger**, not a bolt-on sync validation. Interim posture: anchors stay server-*written* (lockdown) but
not server-*derived*; the override gates day-advancement on E (§3.1).

## 5. Sequencing (corrected)
- **G1** — **cleanup only; NO trusted marker until Phase E.** Drops the raw client-`isCorrect` echo for MCQ,
  but `selectedOptionId` is forgeable (§1), so it confers no trust. Optional to ship anytime; doesn't unlock
  MCQ override.
- **G2** — typed correctness authority. **Ship with the lockdown (W1/W3)**; not enforceable before it.
- **MCQ correctness / denominator / G3 anchor** — **with Phase E** (server-owned test-init).
- Net order: lockdown (W1/W2/W3) + G2 (+ optional G1 cleanup) → override (typed, correctness-only) + D6 →
  Phase E (MCQ auth, denominator, anchors) → advancing/MCQ override. Owner deploys; I verify via behavior + sweep.

## 6. Risks
- **Marker integrity hinges on the lockdown** — if shipped before client writes are denied, a client can
  create an attempt with a forged `correctnessSource`; never trust the marker pre-lockdown.
- **G1 selection identity** — **prefer `selectedOptionId`/token**; text matching is only a fail-closed
  fallback (define normalization; on ambiguous/duplicate-definition matches, mark incorrect → never guess
  correct). Handle resume/recovery so the selection survives a reload.
- **G2 no-rebill** — wiring `writeContext` into `gradeTypedTest` must preserve idempotency and not lose a
  grade when the first write failed.
- **Historical attempts** stay marker-less forever — the override's `legacy_attempt_untrusted` path is
  permanent, not transitional.

## 7. Tests
- **G1 (cleanup only, NOT forgery):** client sends `selectedOptionId` for a wrong option but `isCorrect:true`
  → server re-derives from `selectedOptionId` (raw client `isCorrect` ignored). **NO trusted marker stamped.**
  Explicitly document the still-open hole: `selectedOptionId === questionWordId` is forgeable (a caller can
  send the question's own wordId) → **MCQ anti-forgery is a Phase-E test, not here.**
- **G2:** direct `submitVocabAttempt({testType:'typed', attemptAnswers:[forged isCorrect:true]})` with no/
  invalid `gradeToken` → typed grade NOT persisted (rejected / no `server-ai` marker); legit write-failed
  retry **with a valid `gradeToken`** → server verifies HMAC, writes `correctnessSource:'server-ai'`, **no AI
  re-bill**; **tampered signed field** (`isCorrect`/`studentResponse`/`reasoning`/context — token no longer
  matches) → rejected; **tampered UNSIGNED display field** on retry (`correctAnswer`/`word` changed but
  `isCorrect` unchanged) → the server **reconstructs them from Firestore and ignores the client values**
  (stored row is correct regardless); **replay across a different attempt/uid** → rejected (uid from
  `request.auth.uid`). **Pre-lockdown control:** the forge is only fully closed once lockdown rules are live.
- **Marker placement:** `correctnessSource` is top-level + not client-writable post-lockdown (rules test).
- **No-regression:** normal typed + MCQ submit, scoring, day advancement, reconciliation; sweep clean.
- (Moved to the Phase-E plan: MCQ anti-forgery, the denominator test (§8.2), and the G3 anchor tests — this
  plan delivers *typed* correctness authority only.)

---

## 8. Residual grade authority after G1/G2 (REQUIRED — Codex)
Per-answer correctness being server-derived is necessary but **not sufficient** for "server-authoritative":
several inputs to the *outcome* can still be client-shaped. List + resolve each, or mark it an explicit,
named residual — so the system isn't "server-authoritative in appearance, client-shaped in outcome."

- **8.1 Typed retry — DECIDED: server-signed grade artifact + server-RECONSTRUCTED rows (Codex).** The
  write-failed-after-grade retry can't lean on existing-attempt idempotency (no attempt exists yet).
  **Mechanism:** after AI grading, `gradeTypedTest` returns `gradeToken = HMAC(secret, canonical(artifact))`.
  - **Signed artifact (grade-bearing subset ONLY):** `{ tokenVersion, uid, attemptDocId, classId, listId,
    testId, testType:'typed', totalQuestions, createdAt, rows: ordered [{wordId, studentResponse, isCorrect,
    aiReasoning}] }`. `uid` is `request.auth.uid` (server-side — **never** a client-supplied uid). `canonical`
    = stable key order + normalization. Include a `tokenVersion` (rotation) + `createdAt` with a short expiry
    (debug/rotation; same-`attemptDocId` idempotency doesn't strictly need it).
  - **On retry the server RECONSTRUCTS all other stored fields** — `word`, `correctAnswer`, challenge fields,
    etc. — from Firestore/defaults, and **ignores those fields if the client sent them**. So the token only
    authorizes the grade-bearing subset; **unsigned display/gradebook fields can't be tampered** (Codex).
    **Impl note (Codex-Medium):** the current `sanitizeStoredRows` only backfills **when missing** (`word: a.word
    || …`, `functions/index.js:436`), so it would PRESERVE a non-empty tampered client `word`/`correctAnswer`.
    Add a **typed-retry reconstruction mode that OVERWRITES** those from Firestore/defaults (authoritative),
    distinct from the backfill-when-missing default — don't reuse the helper as-is.
  - **Verify:** recompute the HMAC over the artifact (using `request.auth.uid`); valid ⇒ rows are
    server-authentic for this exact uid/context ⇒ write with `correctnessSource:'server-ai'`, **no AI re-bill**;
    any tamper to a *signed* field, replay across a different attempt/uid, or absent/expired token ⇒ reject.
  - The secret is a v2 **`defineSecret`/Secret Manager** secret (codebase already uses secrets, e.g.
    `anthropicApiKey`), NOT legacy runtime config. **Both `gradeTypedTest` AND the retry/write callable
    (`submitVocabAttempt`) need `secrets:[gradeTokenSecret]`** — `submitVocabAttempt` has none configured today
    (Codex-Low), so add it. No extra Firestore docs/TTL.
  *Alt considered:* a server-only pending-grade cache keyed by `attemptDocId` (server never reads client rows;
  adds write/read/TTL). **Phase E supersedes both** (the trigger is the sole writer; no client round-trip), so
  the token is the minimal synchronous bridge until E.
- **8.2 Score denominator (Codex-High) — DECIDED: deferred to Phase E (named residual).** `writeAttemptTxn`
  uses `score = correctCount / (ctx.totalQuestions ?? attemptAnswers.length)` (`functions/index.js:223-224`).
  Even with per-answer correctness derived, a client path can **understate `totalQuestions`** or **omit wrong
  rows** to inflate the score. A *complete* fix requires knowing how many questions were presented = the
  server-owned **test-init snapshot**, which is the Phase-E mechanism (same root as the anchor). So **G1/G2
  do NOT fix the denominator** — they make per-answer *correctness* server-derived, not the full *score
  outcome*. The denominator stays a **named residual until E**; its test lives in the Phase-E plan (§7).
- **8.3 MCQ correctness authority → Phase E (Codex-High).** `selectedOptionId` is a derivation cleanup, NOT
  anti-forgery — `selectedOptionId === questionWordId` is forgeable (caller knows the question wordId). True
  MCQ authority needs a server-owned question→answer mapping (opaque option token at setup, or the Phase-E
  init snapshot). **Deferred to Phase E** (same root as 8.2/8.5). No trusted `server-mcq` marker until then.
- **8.4 Writer-API source enforcement (Codex-Medium).** `writeAttemptTxn` must **require** `correctnessSource`
  and **reject** grade-bearing writes lacking it (post-lockdown) — structural, not caller discipline (§2).
- **8.5 Anchor (G3).** Deferred to Phase E (§4); pre-E the override may not advance days off it (§3.1 hard
  invariant).

**Bottom line:** this plan makes **TYPED** correctness server-authoritative (G2 — AI-graded, `gradeToken`-bound),
bridges the typed retry synchronously (8.1), and adds the writer-API guard (8.4). **MCQ correctness (8.3),
denominator (8.2), and anchor (8.5) all land with Phase E** — they share one root: the server doesn't own the
test-init/question setup synchronously. G1 is MCQ *derivation cleanup*, not a security fix. So: typed = secured
now; MCQ/denominator/anchor = Phase E.
