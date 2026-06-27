# DESIGN: Asynchronous, write-triggered AI grading (+ the consolidation it enables)

Status: DRAFT for review. No code yet. Author: session 2026-06-17.
Supersedes the synchronous client-held grading path; folds in "ask teacher to grade" as a fallback.

---

## 0. Guiding principle (READ FIRST)

**REPLACE, DON'T PARALLEL.** This refactor is only worth doing if the server becomes the single
authority for grade → score → pass-gate → day-completion, and the corresponding *client* logic is
**deleted**, not left running beside a new path. If async grading ships next to the synchronous path,
we get two grading flows, two completion paths, and the existing duplication doubles. That outcome is
explicitly out of scope — see §8 (Consolidation inventory) for the list of client logic this MUST remove.

Success test: after this lands, "what is the student's grade / did they pass / did the day complete" has
**exactly one** answer, computed **server-side**, read everywhere else.

---

## 1. Problem (why async)

AI grading is the only operation in the app that holds a **single long-lived HTTPS request** (10–90s) to
a Cloud Function while it waits on the Anthropic LLM. Everything else (Firestore reads/writes, MCQ
grading, assets) is either millisecond-scale, auto-retried/offline-queued, or client-side. So a momentary
network blip, a function cold start, Anthropic latency/overload, or a school proxy that kills long POSTs to
`cloudfunctions.net` = a hard "connection error" — even though the student's navigation and MCQ work fine.

Current synchronous flow (`TypedTest.jsx` → `gradeWithRetry` → `gradeTypedTest` callable @ `functions/index.js:70`):
client holds the request 3×(up to 90s) → on failure shows a one-button "Grading Failed / Try Again" modal
that re-runs the same failing call under the same conditions. The diagnosis: failures are
disproportionately timeout/upstream, NOT device connectivity. (The connection-logging patch shipped this
session will quantify the split; this design assumes it confirms timeout-dominant.)

MCQ is unaffected — it is graded entirely client-side (no cloud call). Scope here is **typed tests only**.

---

## 2. Target architecture

**Synchronous (today):** `client holds 10–90s request → grader → returns → client writes attempt`
**Asynchronous (target):**
1. **Client writes** the attempt doc with raw answers + `gradingStatus: 'pending'` (tiny, resilient,
   offline-queued Firestore write).
2. **Firestore trigger** (`onDocumentCreated` on the attempts collection) fires server-side, calls
   Anthropic, writes back `score` / `results` / `passed` / `gradingStatus: 'graded'`.
3. **Client subscribes** (`onSnapshot`) to that attempt doc; when status flips to `graded`, it renders
   results. ("…and return" = listen for the writeback, not hold a request open.)

The fragile part (the long LLM round-trip) leaves the client entirely. The student's only network
dependency becomes the short write, which Firestore already makes resilient.

---

## 3. Data model

### 3.1 Attempt doc (typed tests) — new/changed fields
Existing attempt (`submitTypedTestAttempt`, `db.js:1276`) already builds an `answers` array of
`{wordId, word, correctAnswer, studentResponse, isCorrect, challengeStatus}`. Async changes:

| Field | Sync (today) | Async (target) |
|---|---|---|
| `answers[].studentResponse` | present | present (the grading input — must persist BEFORE grading) |
| `answers[].isCorrect` | set by client from grader result | **set by the trigger** (null at write time) |
| `score` | client-computed | **null at write; trigger writes it** |
| `passed` | client-computed vs threshold | **null at write; trigger writes it** (vs server-resolved threshold) |
| `gradingStatus` | (none) | **NEW**: `'pending' → 'graded' \| 'error'` |
| `gradingMeta` | (none) | **NEW**: `{ attempts, lastError, gradedAt, gradedBy: 'auto'\|'teacher', model }` |
| `gradeRequestedFromTeacher` | (none) | **NEW (bool)**: set when student taps "ask teacher to grade" |

`testType: 'new' \| 'review'`, `studentId/classId/listId/studyDay` unchanged (studyDay stamped by the
Fix-H derivation — which moves server-side too, see §8).

### 3.2 Status lifecycle
```
                         ┌─────────────► graded (auto)  ──► student advances on snapshot
write (pending) ──trigger┤
                         └─► error / stays pending ──► teacher queue ──► graded (teacher) ──► advances
```
- `pending`: written, not yet graded. Review is LOCKED (see §5).
- `graded`: trigger (or teacher) wrote score/passed. Terminal.
- `error`: trigger exhausted retries / unparseable / upstream down. Surfaces to teacher queue; also a
  scheduled sweeper (§7) re-pokes stale `pending` docs that never got an `error` written.

### 3.3 Threshold
The trigger resolves the pass threshold **server-side** from the class doc
(`classes/{classId}.assignments[listId].passThreshold`, fallback DEFAULT). This becomes the **single**
threshold-resolution authority for the gate (see §8 — the ~8 client sites collapse to display-only).

---

## 4. Session phase: the `AWAITING_GRADE` state

Current `SESSION_PHASE`: `NEW_WORDS_STUDY → NEW_WORDS_TEST → REVIEW_STUDY → REVIEW_TEST → COMPLETE`.
Add a derived state **`AWAITING_GRADE`** that sits between "new-word test submitted" and "passed".

`determineStartingPhase` (`studyService.js:57`) gains one rule, evaluated from attempts:
- current-day new attempt with `gradingStatus === 'pending'` → **`AWAITING_GRADE`** (do NOT route to
  new-word study — the submission exists — and do NOT route to review).
- current-day new attempt `graded` + `passed` + no review → `REVIEW_STUDY` (unchanged).
- current-day new attempt `graded` + `!passed` → `NEW_WORDS_STUDY` (retake; Fix #1 path).
- else fresh → `NEW_WORDS_STUDY`.

This makes the lock survive re-entry: a student who closes the tab mid-grade and comes back lands on the
grading screen, not a fresh test, and cannot re-take while pending.

---

## 5. UX — the grading screen + the gate

### 5.1 In-session grading screen (`AWAITING_GRADE`)
Replaces the synchronous spinner. Non-blocking, self-resolving via `onSnapshot`:
- Title: `New Words Test · Day N`
- Spinner + `채점 중이에요… (Grading your answers…)`
- `결과가 곧 표시됩니다. 이 화면을 떠나셔도 결과는 자동으로 반영돼요.`
- Forward affordance: **only** `대시보드로 / Dashboard` (leaving is safe).
- Transitions (listener-driven, no refresh):
  - `graded` + passed → normal results screen → **"Continue to Review" works**.
  - `graded` + failed → results → **"다시 시도 / Retake"** → new-word study.
  - slow (>~30–60s pending) or `error` → reveal **"선생님께 채점 요청 / Ask teacher to grade"**
    (sets `gradeRequestedFromTeacher: true`; routes the doc into the teacher queue).

### 5.2 The Review CTA — VISIBLE but GATED (per owner decision)
Do **not** hide "Continue to Review." Keep it rendered; gate the click with a state-aware message
(inline note/toast, not a scary modal); show a lock icon / muted styling so it doesn't read as broken:

| State | Click shows |
|---|---|
| pending | `채점이 끝나야 복습 단어가 열려요. 잠시만 기다려 주세요. (Review unlocks once grading finishes.)` |
| graded-failed | `새 단어 시험을 먼저 통과해야 해요 (N%+). 통과 후 복습이 열립니다. (Pass the new-word test first.)` |
| slow/error | pending message + the "ask teacher to grade" option |

The instant a passing grade arrives via the listener, the CTA un-mutes and navigates normally.

### 5.3 Dashboard surfacing (ties to the Day-card checklist — separate spec)
The Day-card checklist item is the same live status off the same attempts:
`⏳ New-Word Test — 채점 중` / `☑ New-Word Test (92%+) — passed 94%` / `☐ Review Test`.

---

## 6. The lock (hide ≠ block — defense in depth)

The visible-gated CTA (§5.2) is the **courtesy**. The real lock is enforced at two layers so NO navigation
path (browser back/forward, stale tab, bookmarked `?type=review`, history) can advance a day without a
server-written passing grade:

1. **Phase-resolution lock (entry):** `determineStartingPhase` refuses to return `REVIEW_STUDY` unless a
   `graded`+`passed` new attempt exists for the day. `pending`/`failed`/`error` → never review.
2. **Completion-gate lock (consequence):** `completeSessionFromTest` already returns
   `{ requiresNewWordRetake: true }` and refuses to complete the day when the new-word test isn't passed
   (Fix #2, live). Extend "not passed" to explicitly include `pending` and `error`. Even if a review test
   is submitted via a side door, the day will not advance.
3. **Tamper lock (bonus):** grades are **server-written-only** (Admin SDK in the trigger). A student can't
   fabricate a passing new attempt to unlock review. Rules (§9) forbid client writes to `score`/`passed`/
   `gradingStatus:'graded'`.

`pending`, `failed`, and `error` all map to "review blocked" — one rule, three inputs.

---

## 7. Idempotency, errors, and the sweeper

- **Grade exactly once:** the trigger must transition `pending → graded` inside a transaction (or guard on
  `if (status !== 'pending') return`), so a function retry / duplicate event can't double-grade or
  re-introduce words. Idempotent on the attempt docId (already deterministic via the per-session nonce).
- **Explicit error state:** on exhausted retries / unparseable LLM output / upstream down, the trigger
  writes `gradingStatus:'error'` + `gradingMeta.lastError`. Never leave a doc silently stuck.
- **Stale-pending sweeper:** an `onSchedule` function (pattern already in use — `functions/index.js:12`)
  periodically finds `pending` docs older than T minutes with no `error` (e.g. the trigger never fired) and
  re-enqueues or marks `error`. Backstop against lost events.
- **Completion timing (v1):** the day completes when the *graded* attempt lands; the client reacts to the
  `graded` snapshot and runs the existing `completeSessionFromTest`. (v2 option: move completion INTO the
  trigger for full server-authoritative completion — the ultimate #7 — but keep v1 client-reactive to bound
  scope.)

---

## 8. Consolidation inventory (THE PROOF THIS REDUCES COMPLEXITY)

This is the contract that this refactor is a *net removal*. Measured this session:
- threshold resolution: ~37 refs, the resolve pattern hand-written in ~8 sites across 4 files.
- "is the new-word test passed?" decision: 27 independent computations.
- studyDay derivation: identical block copy-pasted into TypedTest **and** MCQTest (Fix H).
- TypedTest (1570 lines) / MCQTest (1438) implement submit/attempt/studyDay/threshold/completion as twins.

**What MUST be deleted or collapsed when the server becomes authoritative:**
| Client logic today | After async |
|---|---|
| `gradeWithRetry` (3×90s hold + retry loop) in TypedTest | **DELETED** — replaced by write + `onSnapshot` |
| client score computation (`correctCount/words.length`) | **DELETED** — trigger computes score |
| client `passed = score >= retakeThreshold` (27 sites incl. resume, persist, handleReturnFromTest) | **COLLAPSE** to reading `attempt.passed` |
| ~8 client threshold-resolution sites | **COLLAPSE** to one server resolve; client keeps threshold ONLY for display copy |
| Fix-H studyDay derivation duplicated in 2 files | **MOVE** into a shared helper used at write time (or into the trigger) |
| the synchronous "Grading Failed / Try Again" modal | **REPLACED** by the AWAITING_GRADE screen + teacher fallback |

**Pre-req helper extractions (do BEFORE async, shaped to fit it):**
- `resolvePassThreshold(assignment) → fraction` — single util; client uses for *display only*, trigger
  uses (port to functions) for the *verdict*.
- `deriveStudyDay({ progress, sessionContext, testType, getNewWordAttemptForDay }) → number` — kills the
  Fix-H copy-paste; one implementation, used at attempt-write time.

If a proposed change does NOT reduce the counts above, it is the wrong shape — revisit §0.

---

## 9. Firestore rules diff (sketch — validate against actual `firestore.rules`)

Students may **create** a typed attempt with `gradingStatus:'pending'`, their own `studentId`, the raw
`answers` (incl. `studentResponse`), and `score/passed = null`. They may **NOT**:
- write `gradingStatus:'graded'`, `score`, `passed`, or mutate `answers[].isCorrect` (server-only fields);
- update an attempt once `graded` (terminal).
Teachers (existing `isTeacher`) may write the grade fields (powers the manual-grade fallback).
The trigger runs with Admin privileges (bypasses rules). Add validation that a `pending` create can't
preset server-only fields.

---

## 10. Migration / coexistence

- **MCQ untouched** (client-graded; no cloud call).
- **In-flight synchronous attempts** at deploy time: the old path still resolves them; new submissions use
  the async path. Because attempts are append-only and the gate reads status, mixed old/new coexist safely
  (old attempts simply have no `gradingStatus` → treat missing as `graded` for legacy).
- **Deploy order:** (1) deploy the trigger + sweeper + rules (`firebase deploy --only functions,firestore:rules`),
  (2) THEN ship the client that writes `pending` + listens. Never ship the client first (would write
  pending docs nothing grades). Owner runs the firebase deploys (I cannot).
- **Rollback:** if the trigger misbehaves, revert the client to synchronous grading; pending docs get swept
  to `error` → teacher queue. No data loss (answers are persisted).

---

## 11. Open decisions for owner

1. **Waiting UX:** pure hold (grading screen only) vs. allow re-studying new-word flashcards while it grades
   (no review, no re-test). Recommend **pure hold** (simpler; makes "you can leave" the natural escape).
2. **Completion in trigger (v2) now or later?** Recommend **later** — v1 keeps completion client-reactive to
   bound scope; v2 moves it server-side as the final #7.
3. **Teacher grade fallback: auto-route on `error`, or only on student request?** Recommend **both** — auto
   into the queue on `error`, plus the explicit student button for slow cases.
4. **Practice Mode grading** (separate spec) should reuse the SAME async pipeline with `mode:'practice'` +
   the 5×/day server cap, writing to a non-authoritative path. Keep the pipelines unified.

---

## 12. Build order (after spec sign-off)
1. Helper extractions (§8 pre-reqs) — small, immediately de-duplicating, independently verifiable.
2. Trigger + sweeper + rules (server) — deploy, test with hand-written pending docs.
3. Client: write-pending + `onSnapshot` + `AWAITING_GRADE` screen + gated CTA; DELETE the sync grading
   logic per §8 (this is where the net-removal happens).
4. Teacher "Pending grading" queue (absorbs "ask teacher to grade").
5. Verify the §8 counts actually dropped. If they didn't, the refactor failed its purpose.
