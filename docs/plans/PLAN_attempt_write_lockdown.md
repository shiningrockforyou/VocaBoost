# PLAN — Attempt write lockdown (client loses authority over grade-bearing fields)

Status: DRAFT — awaiting owner's audit. Nothing implemented. Owner: (orchestrator). Date: 2026-06-26.
**Supersedes** the narrower `PLAN_answers_lockdown.md` (Codex: the lockdown must cover *creates*, not just
`answers[]` updates). This **is** the concrete spec for C+D **Phase D** (`PLAN_grading_writepath_program.md`)
and the hard prerequisite for teacher grade-override (`PLAN_teacher_grade_override.md` §0.4). Closes
NEED_TO_FIX **#1c**.

---

## 0. Goal — make every grade-bearing field server-WRITTEN (only a function can author it)
> Note: "server-written" ≠ "server-derived/trustworthy content" — that stricter provenance is §3 + override §0.5.

No client create or update path may write **grade-authoritative fields** —
`answers[].isCorrect`, `score`, `passed`, `graded`, and the reconciliation anchors
(`newWordStartIndex`/`newWordEndIndex`/`wordsIntroduced`/`studyDay`) — unless a Cloud Function (Admin SDK)
authored or validated it. Today the client can both **create** arbitrary attempts and **mutate**
`answers[]`, so a passing attempt is forgeable two ways. Lock both.

**Why now:** it's a LIVE forgery (NEED_TO_FIX #1c — answers[] laundering through `reviewChallenge`) AND a
direct one (a student can `create` `{passed:true}`), and it's the shared prerequisite for the override
feature and for trusting any server recompute.

## 1. Current client authority over attempts (verified)

| Path | What it writes | File:line |
|---|---|---|
| **create — legacy typed** | full attempt incl. score/passed/answers | `db.js:~1276` (`submitTypedTestAttempt`, writer `:1397`) |
| **create — legacy MCQ** | full attempt incl. score/passed/answers | `db.js:~1158` (`submitTestAttempt`, writer `:1242`) |
| **create — empty-review automarker** | `{score:100, sessionType:'review', passed…}` direct client `setDoc` | `DailySessionFlow.jsx:962` |
| **update — submitChallenge** | rewrites `attempts.answers` (only metadata in-app, but rule is permissive) | `db.js:2614-2624` |
| **server create (already live)** | Admin-SDK `writeAttemptTxn` via `gradeTypedTest(writeContext)` / `submitVocabAttempt` | `functions/index.js` |
| **rule** | `create` if `studentId==uid` (no shape check, `:101`); `update` if `hasOnly(['answers'])` OR teacher (`:109-113`); `delete` own (`:116`) | `firestore.rules` |

So the server write path exists and is live (flag-gated), but the **client paths still exist and the rules
still permit client create + `answers` update** — that's the hole.

## 2. Workstreams (the lockdown)

### W1 — `submitChallenge` → Cloud Function (the `answers[]` update path)
Move the challenge write server-side so the only writer of `attempts.answers` is trusted. (Detail unchanged
from the superseded plan.)
- New `submitChallenge({attemptId, wordId, note})` callable. Today `submitChallenge` (db.js:2610,2622) does
  **two separate `updateDoc`s** (history + answer) — non-atomic. The callable does all of it in **one Admin-SDK
  `runTransaction`** (reads before writes): (1) load attempt, assert `studentId===uid`; (2) **inside the txn**
  re-check `challengeStatus!=='pending'` (idempotency guard — a retry can't double-append history) and
  re-compute tokens server-side; (3) write `users/{uid}.challenges.history` (append) + `attempts/{id}.answers[i]`
  (set `challengeStatus`/`challengeNote` ONLY — never `isCorrect`). Server stamps `challengedAt`/`replenishAt`.
- **Token parity (audit):** port `getAvailableChallengeTokens` (db.js:177-183) EXACTLY — count only **active
  rejections** (`status==='rejected' && replenishAt.toMillis() > now`), same `.toMillis()` safe-nav. Unit-test
  against fixtures (0 history / active vs expired rejections / boundary time / zero tokens). Don't trust a
  client-sent count.
- **Idempotency:** deterministic on (uid, attemptId, wordId) — a retried call where the answer is already
  `pending` returns success without a second history entry (guard is inside the txn, §above).
- Client: keep `db.js:submitChallenge` as a **thin wrapper** calling the callable with the same
  `(uid, attemptId, wordId, note)` signature → call sites `TestResults.jsx:61` / `Gradebook.jsx:446` unchanged.
  `getAvailableChallengeTokens` stays a client read for UI gating only (callable re-checks authoritatively).
- **Note:** the callable writes `users/{uid}.challenges.history` via Admin SDK (bypasses rules) — the broad
  `users/{uid}/{subcollection}` rule (firestore.rules:45-48) is NOT touched here (still needed by client-side
  `reviewChallenge`; see §3/§5).

### W2 — Server-only attempt creation (close the direct-create forgery)
- **Finish the Phase-2 cutover:** the server create path (`gradeTypedTest(writeContext)` / `submitVocabAttempt`)
  becomes the ONLY creator of test attempts. **Remove the legacy client `submitTestAttempt` (db.js:1158) /
  `submitTypedTestAttempt` (db.js:1276) from the test flow** (`MCQTest.jsx`/`TypedTest.jsx` must call the
  server callables, not these). These are **client-side** functions — they do NOT "stay for CS" (CS manual
  entry is `scripts/cs/manual-pass.mjs`, a *separate Admin-SDK* script). Delete or dead-code them for the test
  path. (= C+D Phase B.)
- **Migrate the empty-review automarker (decision required — audit HIGH).** `DailySessionFlow.jsx:962`
  client-writes a `{score:100, sessionType:'review', passed:true}` attempt with deterministic id
  `${uid}_${classId}_${listId}_day${N}_review_automarker`, and it carries **day-completion semantics**
  (CSD reconciliation counts a Day-2+ day complete only when a day-N review attempt exists, DailySessionFlow
  ~951-954). Under `create:false` (W3) the client write **fails** → students stuck. **DECISION:** add a
  dedicated callable **`markReviewComplete({classId, listId, dayNumber})`** that writes the marker server-side
  with the *server-computed* deterministic id (idempotent: re-call → no dup). The client calls it when the
  review phase completes; remove the `DailySessionFlow.jsx:962` `setDoc`. **Must ship before W3** (else
  completion breaks). *(Do NOT vaguely "fold into the server completion path" — no unified server completion
  exists until Phase C/E; a dedicated callable is the concrete, shippable choice.)*
- **Confirm no other client `attempts` create remains** — grep **the built bundle** (`dist/`), not just
  source, for `submitTestAttempt|submitTypedTestAttempt|collection(db, *'attempts'*)` create paths; the
  rules flip (W3) is unsafe until this returns clean. (`db.js:538` is a read query — fine.)

### W3 — Rules: deny client authority over grade-bearing writes
```
match /attempts/{attemptId} {
  allow read:   ... (unchanged)
  allow create: if false;                    // server (Admin SDK) only; CS scripts bypass rules
  allow update: if isAuthenticated()
        && resource.data.teacherId == request.auth.uid && isTeacher();  // teacher branch ONLY
        //  ^ student `answers`-update branch REMOVED — submitChallenge is now the callable (W1)
  allow delete: if isAuthenticated()
        && resource.data.studentId == request.auth.uid;   // reset — unchanged
}
```
- After W2, no legitimate client creates attempts → `create:false` breaks nothing and kills direct forgery.
- Student `answers`-update branch removed → **the student can no longer write `answers[].isCorrect` at all**,
  which closes **#1c's student vector** (a student could forge the array that `reviewChallenge` then
  launders). Precise scope: the *student forgery input* is gone; `reviewChallenge` (teacher) still recomputes
  from `answers[]`, but its inputs are now only server- or teacher-authored. The teacher-branch breadth is a
  *separate* residual (below), not part of #1c.
- **Teacher update branch stays** (reviewChallenge still client-side; tightening it is the override plan's
  job, not this one — §5). CS `manual-pass.mjs` is Admin SDK → unaffected.

## 3. What this closes / leaves
- **Closes:** direct forged `create`; `answers[].isCorrect` laundering via reviewChallenge (#1c). Makes grade
  fields **server-WRITTEN** — i.e. only a Cloud Function/Admin SDK can author them.
- **Does NOT make them server-DERIVED (Codex — important distinction).** "Server-written" ≠ "trustworthy
  content." Three levels (see override §0.5): *server-written* (`writtenBy:'cloud-function'`), *server-graded*
  (correctness actually computed by the server), *server-validated-anchor* (`studyDay`/`newWordEndIndex`
  derived/validated server-side). This plan delivers only the **first**. Specifically still untrusted:
  - **MCQ `isCorrect`** is client-*computed*; `submitVocabAttempt` even preserves caller-supplied typed
    `isCorrect` (`sanitizeStoredRows`, functions/index.js:441) and still stamps `writtenBy:'cloud-function'`
    — so `writtenBy` alone doesn't certify grading (this is **R7**). **Typed** correctness is fixed by G2
    (`correctnessSource:'server-ai'` + gradeToken, in `PLAN_server_authoritative_grading.md`). **MCQ
    correctness authority is deferred to Phase E** (server-owned option token / init snapshot) — NOT a
    "fast-follow" and NOT closed by `selectedOptionId` (that's forgeable; see the server-auth plan §1/§8.3).
  - **Anchors are client-echoed** (v2 §11.3), so even server-written attempts can carry a client anchor.
  - The broad **teacher** update branch (rules:112) — any teacher-of-record can still update the whole attempt;
    tightened by the override plan (after `reviewChallenge` → server).
  - **The broad `users/{uid}/{subcollection}` teacher-write rule (firestore.rules:45-48) is NOT closed here**
    (audit) — client-side `reviewChallenge` writes `study_states`/`class_progress` via it. Closing it requires
    migrating `reviewChallenge` to the server, which is the **override plan's** job (its D2). Named so it isn't
    assumed closed.
  Downstream consumers (override #1) must gate on the **stricter** markers, not on `writtenBy` alone (override
  §0.5). Flagged so "locked down" isn't overread.

## 4. Deploy choreography (order is the footgun)
Owner deploys. The honest framing (audit): this is **forward-compatible with a mid-flight window** — once W3
rules are live, an *old cached client* that still calls a legacy direct write will be **rejected** until it
reloads. Minimize, don't pretend it's zero:
1. **Behind a server feature flag**, deploy callables (W1 `submitChallenge`, W2 `markReviewComplete`) — old
   client paths still valid; non-breaking.
2. Ship client cutover (build+push): challenge + review-marker + test-submit all go through server callables;
   delete the legacy create/`answers`-update calls. Old cached clients still work via current rules until reload.
3. **Verification gate (audit — required, not optional):** before flipping rules, confirm legacy paths are
   actually dead in production — grep the built `dist/` bundle (zero `submitTestAttempt`/`submitTypedTestAttempt`/
   direct `attempts` writes) AND watch Firestore request metrics / `system_logs` for ~a usage cycle to confirm
   near-zero legacy client `create`/`answers`-update traffic. Only then proceed.
4. **Remove rule authority LAST** (W3 rules deploy). W3 is **staged in `docs/plans/W3_attempts_lockdown.rules.md`**,
   NOT in the live `firestore.rules` — so the repo stays deploy-safe until this step (Codex). Apply that block
   to `firestore.rules` + deploy only now. Accept that any straggler old-cached client fails its next direct
   write until reload (small, monitored window).
- **Rollback:** re-adding the rule branches is fast and restores old client paths — BUT if the *callable* has a
  bug, rules-revert doesn't fix it (the client already calls the callable); that's why W1/W2 ship **behind a
  feature flag** (flip the flag off → clients fall back, no rebuild needed). Validate callables in the 25WT
  sandbox before flag-on.
- I cannot build/deploy — owner runs all of it; I verify via bundle grep + live repro + sweep.

## 5. Scope boundary + cross-plan coordination (audit)
- **This plan = W1+W2+W3 only.** NOT migrating `reviewChallenge`; NOT tightening the teacher update branch or
  the `45-48` broad-write rule; NOT MCQ server re-grade; NOT the override callable/UI (#1); NOT D6; NOT Phase E.
- **Necessary, NOT sufficient for the override (audit).** This plan makes grade fields *server-written*, but
  the (typed) override gates on the *server-graded* marker `correctnessSource:'server-ai'` from
  **`PLAN_server_authoritative_grading.md` (G2)** — which **ships WITH this lockdown** (its §5). So typed
  override needs lockdown **+ G2 + D6**. **MCQ override is NOT unblocked** — G1 is cleanup only (no trusted
  marker); MCQ correctness authority waits for **Phase E**.
- **Teacher-branch handoff (single place).** This plan deliberately leaves the teacher attempt-update branch
  (rules:112) and the `45-48` broad-write intact (client `reviewChallenge` needs them). The **override PR** is
  the single place that migrates `reviewChallenge` → server and narrows both — and it can't ship until **D6**.
  So the broad teacher writes persist between this lockdown and the override; that's an accepted, named interim
  residual, not a gap this plan can close without breaking `reviewChallenge`.

## 6. Tests (forgery must be denied at the rule boundary)
- **Rules:** student direct `create(attempts, {passed:true,score:100…})` → DENIED (was allowed). Student
  direct `update(attempts/own, {answers:[…isCorrect:true…]})` → DENIED. Student delete (reset) still allowed;
  teacher update still allowed; Admin-SDK (manual-pass) still writes.
- **Callables:** `submitChallenge` happy path (atomic metadata+history), not-owner → `permission-denied`,
  already-pending → `failed-precondition`, zero tokens → `failed-precondition`, retry idempotent; marker
  callable idempotent on its deterministic id.
- **End-to-end regression:** forged create AND forged answers update both denied → no client path *writes*
  a grade field directly. This closes the direct create/update forgery. **Caveat (Codex):** it does NOT make
  `reviewChallenge`'s recompute fully trusted — **MCQ-derived correctness is still client-computed** via the
  server write path (named residual, §3). So "recomputes only from server-*written* values," not
  server-*derived* — **MCQ correctness trust needs Phase E server-owned option/init authority** (not a
  separate re-grade; `selectedOptionId` is forgeable — see server-auth plan §1/§8.3).
- **Post-rules happy-path (audit — prove legit flows survive W3):** with W3 live, a student submits a test via
  the server callable → attempt written; submits a challenge via the new `submitChallenge` **callable** →
  history appended + answer marked `pending` (atomic); a **non-owner** calling `submitChallenge` on another's
  attempt → `permission-denied`; teacher `reviewChallenge` (still client-side) still works.
- **Empty-review completion E2E (audit):** a Day-2+ student with an empty review queue completes review →
  `markReviewComplete` writes the marker → the next day unlocks (completion semantics preserved under
  `create:false`). Re-call → idempotent (no dup).
- **No-regression:** normal submit (typed+MCQ via server path), normal challenge→review (accept advances,
  reject doesn't), progress reset (delete). `data-integrity-sweep` clean before/after.

## 7. Risks
- **Ordering** (callables → client → rules) is the only real footgun; §4 fixes it. The `create:false` flip is
  irreversible-feeling — verify zero client creates in the live bundle before flipping.
- **Token-logic parity** server-side (W1) — port + unit-test `getAvailableChallengeTokens` against fixtures.
- **Empty-review marker** must keep its completion semantics (it's part of day completion) — fold carefully;
  test Day-2+ review completion end-to-end.
- **Residuals named in §3** (MCQ compute, teacher branch) must be tracked so the lockdown isn't oversold.
