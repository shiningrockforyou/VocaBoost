# PLAN — Teacher/TA Grade Override (server-side, proactive)

Status: AUDITED (3-agent, 2026-06-25) — corrections folded in below; open decisions for David in §0.2.
Owner: (orchestrator). Date: 2026-06-25.
Source ticket: CS-2026-06-25 (조예서, Inter B2) — TA accepted `amnesty`="대사" on paper, but VocaBoost
kept the Day-7 test at 90% (< 92% threshold) and blocked her. Fixed by a manual Firestore edit.
Tracking item: NEED_TO_FIX.md #1.

---

## 0. Summary

Give a class's owning teacher a **proactive, per-answer grade override** in the gradebook, routed
through a **Cloud Function** so it's authorized server-side and can't be forged. When a teacher flips
an answer's correctness, the system recomputes the attempt's score/passed and the student advances
through the **existing reconciliation path** — no hand-written DB fixes, no CS scripts. (v1 is
**correct-only** per D1 — no mark-incorrect/regression; wording tightened to avoid implying it.)

**The machinery already exists.** `reviewChallenge` (`src/services/db.js:2637-2836`) already: finds the
answer by `wordId`, flips `isCorrect`, recomputes `score` with the persisted `totalQuestions`
denominator, recomputes `passed` (respecting `sessionType==='review' → true`), writes the attempt, and
nudges day progression. This plan **generalizes** that operation and **moves it to the server**.

### 0.1 Locked decisions (rationale inline)
1. **Server-side callable**, not a client write. Per NEED_TO_FIX #1, and it lets us close the
   over-broad Firestore rule at `firestore.rules:45-48` (any teacher can currently write any student's
   subcollections). Admin SDK bypasses rules; the **authoritative gate is class ownership**
   (`classes/{classId}.ownerTeacherId === caller`, the `renameStudent` shape at
   `functions/index.js:1227-1255`). The `role==='teacher'` half of that pattern is **NOT trustworthy as-is**
   (doc-role is self-writable — D6/§0.3); the ownership check is the real boundary, and the role check only
   becomes meaningful once D6 lands. Don't read "proven renameStudent pattern" as "doc-role is sufficient."
2. **Per-answer primitive** (mark one word correct/incorrect), not a blunt "mark day passed." It
   recomputes naturally, mirrors `reviewChallenge`, and exactly matches the real case (accept one word).
   *(Audit flagged that TAs often grade holistically and may want a whole-test "mark passed" — raised as
   D5. Per-answer stays the primitive either way; whole-test would be sugar on top.)*
3. **The attempt IS the anchor; reconciliation owns csd/twi.** The override recomputes `score`/`passed`
   on the existing attempt doc (which carries the anchor fields — but those must pass §0.5
   provenance/validation before use; they're client-echoed, not automatically trustworthy), then lets
   `getOrCreateClassProgress` reconcile `currentStudyDay`/`totalWordsIntroduced` from that anchor on
   next load (`progressService.js:123-220`, `twi = newWordEndIndex + 1`). We do **NOT** hand-increment
   `class_progress`. → This deliberately fixes a latent bug in `reviewChallenge` (§4.3).
4. **Immediate UX only:** set `session_states.phase`/`newWordsTestPassed` for the current-day-boundary
   case so the student sees the unblock without waiting for a reconcile pass. Phase is a non-authoritative
   display cache (`DailySessionFlow.jsx:295-298`), so this is safe.
5. **Use `attempt.classId` / `attempt.listId` directly**, never parse `testId` (reviewChallenge's
   `testIdParts` parsing is fragile and assumes a wrong format string — §4.3).
6. **Full auditability:** stamp `overriddenBy`/`overriddenAt`/`overrideReason` on the attempt and an
   `overrideHistory[]` entry per answer; emit a `grade_override` event to `system_logs`.

### 0.2 Decisions (David, 2026-06-25) — D6 still OPEN
- **§0.3 auth prerequisite → STILL UNRESOLVED (D6).** *Preferred recommendation* was "tighten the rule" so
  the callable can trust doc-role — BUT David chose to keep **public teacher self-signup** live, which means
  doc-role can't be trusted by rule-tightening alone (you can't both let anyone self-pick teacher AND trust
  the field). So D6 is a real open decision: out-of-band teacher provisioning OR custom claims (§0.3). This
  is a *preferred direction, not a final decision* — the feature is not implementation-ready until D6 lands.
- **D1. Regression → correct-only in v1.** Build mark-correct only; hide the mark-incorrect button. No
  regression engine. (Rationale below stands.)
- **D2. Scope → bundle.** Same PR: new `overrideAttemptAnswer` callable + migrate `reviewChallenge` onto
  it + tighten `firestore.rules:45-48` to owner-only writes (after the grep-confirm pre-req).
- **D3. Student transparency → yes** (subtle "Adjusted by your teacher" + reason; `fetchAttemptDetails`
  surfaces the top-level override fields).
- **D5. Whole-test "Mark test passed" → YES, as an explicit FORCE-PASS (not fake-all-correct).** See §3.7.
  Set `passed=true`, keep the real score + per-answer marks, stamp `overriddenBy`/reason. Rationale:
  faking every answer correct would corrupt the gradebook AND flush genuinely-missed words out of the
  review queue (their `study_states` would go PASSED). Force-pass keeps analytics honest, keeps missed
  words in review, and is forward-only so it needs no regression engine. The system already permits
  "passed with sub-threshold score" (review sessions always pass), so no new invariant. Covers the
  recurring "the TA passed the whole test on paper" CS pattern in one click.

### 0.2.1 Original rationale retained
- **D1. Regression (mark-incorrect) → Audit says NO.** Marking an answer wrong can drop a passed
  anchor below threshold. **Verified BLOCKER:** reconciliation CANNOT pull a student back this way — if
  the only passed-new attempt flips to `passed:false`, `getMostRecentPassedNewTest` returns null →
  `hasValidData=false` → `safeCSD = Math.max(storedCSD, 0)` leaves the day **unchanged**
  (`progressService.js:140,179,192`). So regression would need its own active csd/twi rewrite (read the
  *prior* passed anchor and write csd directly), plus a hard second confirm. **Recommend correct-only in
  v1** (covers the ticket, no regression engine); regression is a separate, deliberately-scoped follow-up.
- **D2. Migrate `reviewChallenge` onto the same callable now, or fast-follow?** Doing it now closes the
  `firestore.rules:45-48` security hole in one shot (the rule exists *only* for reviewChallenge) but adds
  scope. Recommend: build the callable to serve both, migrate reviewChallenge in the same PR, tighten the
  rule. **Pre-req (audit):** before tightening to `isOwner(userId)`, grep-confirm reviewChallenge is the
  ONLY teacher→student-subcollection client writer (student self-writes via `saveSessionState` etc. stay
  fine under `isOwner`). (If we ship override first, the rule stays until the migration.)
- **D3. Student-facing transparency?** Show "adjusted by your teacher" on the student's own gradebook
  row/answer? Recommend yes, subtle — it's their grade. Requires `fetchAttemptDetails` to return the
  top-level `overriddenBy/At/reason` (audit: student can't read `system_logs`, rules:120-124).
- **D4. TA vs teacher.** Single-owner model today (`ownerTeacherId`). TAs act *as* the owner account in
  practice. v1 authorizes the class owner only; no separate TA role. (Note for later if TA accounts split.)
- **D5. Whole-test "mark passed" → RESOLVED: IN SCOPE for v1** as an explicit force-pass (see §0.2 D5 +
  §3.7). *(This supersedes the earlier "evaluate as a fast-follow" note that used to sit here — that was
  stale; David put force-pass in scope. Force-pass is the safe escape hatch for MCQ/untrusted-correctness
  attempts since it ignores `answers[]`, gated on anchor provenance.)*

### 0.3 Hard prerequisite — doc-`role` is forgeable AND entangled with signup (Codex blocker)
`firestore.rules:34-35` lets a user write any field of their own `users/{uid}` doc, including `role` — a
student can self-promote to `teacher`. Every `users/{caller}.role === 'teacher'` check (§3.2, and existing
`renameStudent`) is bypassable. **But the naive fix breaks signup:** public **teacher self-signup is
live** — `Signup.jsx:38` sends a client-chosen `role`, `db.js:219` persists `docOverrides.role ?? 'student'`,
and the owner-write rule (rules:34) permits it. So we can't just forbid self-`role`-writes without first
deciding **teacher provisioning** (DECISION D6, needs David):
- **(rec) Provision teachers out-of-band:** public signup always creates `student`; teacher role is set
  only by an admin/invite/server path. Then split the user-doc rule: `create` may set role only to
  `student`; `update` self-writes exclude `role` + authority fields. Callable may then trust doc-role.
- **(alt) Keep public teacher signup:** then doc-role stays untrusted → the callable MUST use a Firebase
  **custom claim** (`request.auth.token.role`) set server-side, not the doc field.
Either way this gates shipping; pre-existing hole, surfaced here. Tracked in NEED_TO_FIX #1b.

### 0.4 Hard prerequisite #2 — client authority over attempts makes recomputation forgeable (Codex blocker, LIVE)
The override recomputes `score`/`passed` from `attempt.answers[].isCorrect` (§3.3), but the client can forge
that input **two ways** today, so the recompute can't be trusted until both are closed:
- **Forged update:** `firestore.rules:109` lets a student update with `hasOnly(['answers'])` and does NOT
  restrict sub-fields → a direct write can set `answers[].isCorrect`. This is **already LIVE in
  `reviewChallenge`** (db.js:2690-2717): it recomputes `score`/`passed` from the stored array on **both
  accept AND reject**, laundering a forged array into a passing score.
- **Forged create:** `firestore.rules:101` lets a student `create` ANY attempt with their own `studentId` and
  **no shape check** → a student can directly create `{passed:true, score:100, sessionType:'review'…}`. More
  direct than the update path. (Legacy client create paths still exist: `db.js:1242/1397`,
  `DailySessionFlow.jsx:962`.)
- **Fix = the full attempt-write lockdown, NOT just submitChallenge** (Codex). It must deny client *create*
  AND client grade-field *update*: server-only attempt creation + `submitChallenge`→callable + remove the
  student `answers` rule branch. Detailed in **`PLAN_attempt_write_lockdown.md`** (W1/W2/W3) — which is also
  the concrete spec for C+D Phase D.
- **Sequencing consequence:** the override is **downstream of** `PLAN_attempt_write_lockdown.md`, not parallel
  to it. Build/ship that lockdown first (it also closes the live #1c hole); override follows. Plus D6 (§0.3).
  **But lockdown ≠ "all inputs trusted"** — see §0.5.

### 0.5 Hard prerequisite #3 — PROVENANCE: the recompute may only trust server-authored inputs (Codex)
There are **THREE distinct provenance levels** (Codex) — don't conflate them; `writtenBy:'cloud-function'`
only certifies the weakest:
- **server-written** = `writtenBy:'cloud-function'`. Necessary but **NOT sufficient**: `submitVocabAttempt`
  is a Cloud Function that accepts caller-supplied `attemptAnswers` and **preserves client `isCorrect`**
  (`sanitizeStoredRows`, functions/index.js:441 `isCorrect: a.isCorrect ?? a.correct`) then stamps
  `writtenBy:'cloud-function'` (functions/index.js:278). It's the typed **write-retry** path
  (`TypedTest.jsx:823`), so an adversary can call it directly with `testType:'typed'` + forged answers and
  mint a "cloud-function" attempt with fake correctness. (This is the deferred **R7**.)
- **server-graded** = correctness actually computed by the server AI. Only `gradeTypedTest` (which runs the
  AI) can certify this. **Add a marker — `correctnessSource:'server-ai'` — set ONLY when `writeAttemptTxn`
  is called from `gradeTypedTest` after grading**, never from generic `submitVocabAttempt` (unless it
  carries a server-issued grade artifact/token). MCQ is `correctnessSource:'client-mcq'` (re-derivable from
  `option.isCorrect`); typed write-retries lacking the AI artifact are not server-graded.
- **server-validated anchor** = `studyDay`/`newWordEndIndex` derived or validated server-side. Today the
  anchor is **echoed from the client** (v2 §11.3), so even server-written attempts can carry a client anchor
  — anchors are NOT automatically trustworthy either.

**Gates (locked).** Two independent provenance requirements — correctness (for the recompute) and anchor
(for any day advance). Apply BOTH where relevant:
- **Per-answer recompute** requires **server-graded** (`correctnessSource:'server-ai'`) AND post-lockdown to
  recompute `score` from `answers[]`. Else → `legacy_attempt_untrusted` → CS. **v1 (D7, recommend): typed
  AI-graded only**; MCQ waits for **Phase E** (server-owned option/init authority — `selectedOptionId` is
  forgeable, so there's no trusted MCQ marker before E).
- **Per-answer ALSO requires a server-validated anchor when it can advance a new-word day** (Codex). A
  per-answer flip can take `passed` false→true, and reconciliation then advances off the attempt's
  `studyDay`/`newWordEndIndex` — so a trusted AI-graded array could still advance off a **bogus client-echoed
  anchor**. Therefore: for any `sessionType:'new'` attempt whose resulting `passed` is or may become `true`,
  require the same server-validated anchor as force-pass (marker present, OR re-derive from class/list/day and
  match); mismatch/untrusted → `legacy_attempt_untrusted` → CS. (Correctness gate ⇒ trusts the array; anchor
  gate ⇒ trusts the advance. Both needed when advancing.)
- **Force-pass (D5) is NOT exempt** (Codex). It doesn't recompute `score`, but it sets `passed=true` and lets
  reconciliation advance from the attempt **anchor** — and `PLAN_attempt_write_lockdown.md` classifies anchors
  as grade-authoritative. A historical/forged attempt can have a bogus `studyDay`/`newWordEndIndex`. So
  force-pass requires a **server-validated anchor**: either the attempt carries the server-validated marker,
  or the callable **re-derives the expected anchor from class/list/day context and matches it** before
  advancing; mismatch/untrusted → `legacy_attempt_untrusted` → CS.
- **Clean provenance for both is exactly what async grading (Phase E) gives** (the server trigger authors
  grade *and* anchor). In the synchronous world, the strict `correctnessSource` marker + anchor re-validation
  are the interim gates; if they prove too narrow, sequence override **after** Phase E.
- **HARD INVARIANT (Codex, from `PLAN_server_authoritative_grading.md` §3.1):** because G3 (server-derived
  anchors) is deferred to Phase E, **pre-Phase-E an override may change correctness/score ONLY and MUST NOT
  advance a day** unless the attempt carries a server-validated anchor source. This is an invariant, not a
  preference — the callable must refuse day-advancement on an untrusted anchor (`legacy_attempt_untrusted`),
  so day-advancing override (per-answer crossing threshold, force-pass) effectively lands **with/after E**.
  Correctness-only, non-advancing edits work sooner.

---

## 1. Current state (what exists)

- **Gradebook UI** `src/pages/Gradebook.jsx` — teacher route `/teacher/gradebook` (App.jsx:131-145),
  gated by `TeacherRoute` (`user.role==='teacher'`) + prop `challengeMode='review'`. A right-side
  **drawer** (lines 1220-1472) already renders each answer: word, correct answer, student response,
  correct/incorrect badge, AI reasoning, and a **challenge accept/reject** control for *pending*
  challenges. Loads via `queryTeacherAttempts` (db.js:1856) + `fetchAttemptDetails` (db.js:2233).
- **Challenge review** `reviewChallenge` (db.js:2637-2836) — the recompute+advance template. Client-side.
- **Server grading/write** `functions/index.js` — `gradeTypedTest` (454), `submitVocabAttempt` (291),
  `writeAttemptTxn` (216, score/passed at 222-228), `assertCanWriteAttempt` (143), anchor-validity guard
  (232-237). `renameStudent` (1205-1273) is the teacher-auth reference.
- **Reconciliation** `progressService.js:123-220` — anchor = most-recent **passed new** attempt
  (`db.js:3192-3201`); `twi = newWordEndIndex+1`; Day-1 vs Day-2+ branch via `getReviewForDay`;
  `hasValidData` requires integer `studyDay>0` + `newWordEndIndex>=0`; logs `csd_anchor_invalid`.
- **Rules** `firestore.rules`: attempts updatable by `teacherId===caller && isTeacher()` (96-118);
  `users/{uid}/{subcollection}` writable by **any** teacher (39-48, flagged TODO).

## 2. The gap

A teacher can only affect a grade the **student challenged first** (`challengeStatus==='pending'`).
When the TA simply decides "I'll accept this" (no student challenge), there is **no path in** — hence
the manual DB edit. There is also no way to view-and-adjust an answer that was never challenged.

## 3. Design — Cloud Function `overrideAttemptAnswer`

### 3.1 Signature
```
exports.overrideAttemptAnswer = onCall({enforceAppCheck:false}, async (request) => {...})

request.data = {
  attemptId: string,          // attempts/{id}
  wordId: string,             // which answer
  isCorrect: boolean,         // target correctness (v1: true only unless D1=both)
  reason?: string             // optional teacher note (audit)
}
returns {
  attemptId, wordId, isCorrect, score, passed,
  oldStudyDay, newStudyDay,   // so the client can phrase "advance to Day N" WITHOUT fetching class_progress
  status,                     // 'ok' | 'noop' | 'legacy_attempt_no_anchor' | 'legacy_attempt_untrusted'
  statusReason,               // machine cause (NOT the teacher's note): 'untrusted_correctness'|'untrusted_anchor'|'pre_lockdown'|'mcq_v1'
  canForcePass                // boolean — TRUE only when anchor provenance passes (block was on correctness,
                              //   not anchor); the drawer offers force-pass iff this is true (§4.2)
}
```
`legacy_attempt_untrusted` has multiple causes; the client cannot infer force-pass eligibility from the
status alone (Codex), so the callable returns `statusReason` + the explicit `canForcePass` (force-pass is
gated on the anchor, §3.7 — offered only when the anchor is trusted but correctness wasn't). **Name note
(Codex):** the response field is `statusReason`, distinct from the request's teacher-note `reason`/
`overrideReason` — don't conflate the machine rejection cause with the teacher's free-text note.
(Audit: the drawer does not load `class_progress`, so the consequence message needs the day from the
server — return both old and projected new day.)

### 3.2 Authorization (reuse renameStudent pattern, functions/index.js:1227-1255)
1. `request.auth` present, else `unauthenticated`.
2. Teacher check — see §0.3: doc-`role` is forgeable, so this MUST read the trusted source
   (custom claim `request.auth.token.role==='teacher'`, or doc-role only AFTER the rule is tightened to
   make `role` non-self-writable). Do not ship trusting raw doc-role.
3. Load `attempts/{attemptId}`; 404 → `not-found`. Guard `attempt.classId` present, else
   `failed-precondition` (corrupt/legacy doc).
4. Load `classes/{attempt.classId}`; require **live** `ownerTeacherId === caller`, else
   `permission-denied`. Use live ownership, NOT the denormalized `attempt.teacherId` (which goes stale if
   a class is re-owned). `attempt.classId`/`listId` are read off the stored doc, never from client input.

### 3.3 Recompute (mirror db.js:2684-2710, server-side)
- **Provenance gate FIRST (§0.5):** the recompute trusts the whole `answers[]` array, so before recomputing,
  require **server-graded** provenance — `correctnessSource:'server-ai'` (set only by `gradeTypedTest`, NOT by
  generic `submitVocabAttempt`) AND post-lockdown. `writtenBy:'cloud-function'` alone is insufficient (R7).
  Else return `status:'legacy_attempt_untrusted'` → CS. (v1 = typed AI-graded only, D7; MCQ later.)
- Find `answers[i]` by `wordId`; 404 if absent.
- No-op fast path: if `answer.isCorrect === isCorrect`, return `status:'noop'` + current score/passed.
- Set `answers[i].isCorrect = isCorrect`. **Audit fix:** do NOT store the override trail inside
  `answers[]` — students can write `answers[]` (`firestore.rules:109-113`, `hasOnly(['answers'])`) and
  could forge it. Keep the trail in **top-level** attempt fields (`overriddenBy/At/overrideReason`) plus a
  top-level `overridesLog[]` array (`{wordId,by,at,from,to,reason}`); both are outside the student-writable
  key set. (`system_logs` is the tamper-evident copy, §3.5.)
- `correctCount = answers.filter(isCorrect).length`; `denom = attempt.totalQuestions || answers.length`
  (use persisted `totalQuestions` — `answers.length` under-counts skipped questions and inflates score,
  per db.js:2684-2689); `score = round(correctCount/denom*100)`.
- `passThreshold = classes/{classId}.assignments[listId].passThreshold ?? 95`. **Audit correction:** the
  defaults are NOT mismatched — `functions/index.js:191` and `reviewChallenge` (db.js:2695,2702) both fall
  back to **95**; `manual-pass.mjs` uses 92 only because it reads the live 26SM assignment (which stores
  92). Use `?? 95` here too so override never diverges from the submit/challenge paths; real classes carry
  their own value (92 for 26SM) and the default is a last-resort only for misconfigured assignments.
- `passed = sessionType==='review' ? true : score >= passThreshold`. (Review attempts always pass; the
  confirm dialog should say so to avoid "score is 55% but it passed?" confusion — §4.2.)
- **Anchor provenance for `sessionType:'new'` when this flip can advance the day** (§0.5, Codex): not just
  "integer `newWordEndIndex>=0` & `studyDay>0`" — when the resulting `passed` is/becomes `true`, require the
  **server-validated anchor** (marker present, OR re-derive expected `studyDay`/`newWordEndIndex` from
  class/list/day and match). Missing/legacy/mismatch → `legacy_attempt_untrusted` → CS (don't silently skip,
  and don't advance off a bogus anchor). Same gate force-pass uses (§3.7).
- Write attempt: `{answers, score, passed, gradeAdjusted:true, overriddenBy:caller, overriddenAt:now,
  overrideReason:reason||null}`.

### 3.4 Study-state + progression (mirror db.js:2742-2832, corrected)
Wrap the attempt write + study_state write **+ the student-visible audit fields** in a **single Firestore
transaction** so a partial failure can't leave score/study_state/audit disagreeing (reviewChallenge does
sequential awaits — we improve on it). **In the transaction (Codex-High):** `answers`, `score`, `passed`,
`gradeAdjusted`, `overriddenBy/At`, `overrideReason`, `overridesLog[]`, the `study_states/{wordId}` status,
and (if applicable) the challenge supersede + `challenges.history[]` write (§6.7). **Best-effort AFTER the
txn:** only `system_logs` (it's the redundant tamper-evident copy; reconciliation self-heals from the
committed anchor regardless).
- Update `users/{studentId}/study_states/{wordId}`: `status = isCorrect ? 'PASSED' : 'FAILED'`
  (reviewChallenge only handled PASSED — we handle both so the review queue stays honest).
- **Do NOT hand-increment class_progress.** The now-passed attempt IS the anchor; let
  `getOrCreateClassProgress` reconcile `currentStudyDay`/`totalWordsIntroduced` from it on next load
  (single source of truth; avoids reviewChallenge's divergent `pace*(1-intervention)` twi formula).
- **session_states is belt-and-suspenders, not the mechanism.** `determineStartingPhase`
  (studyService.js:59-137) re-derives phase from durable attempts on every load and will overwrite
  whatever we write — so for a forward unblock it's *redundant* (the passed attempt alone yields
  `review-study`). We still set it for the current-day boundary so the student sees the unblock without a
  reconcile round-trip, but correctness does not depend on it. Compute `newStudyDay` here for the return
  value (§3.1) by running the same reconciliation math, not by trusting the cached phase.
- **Regression (passed true→false), only if D1=both — needs its own engine.** Reconciliation will NOT
  pull the day back (verified: zero passed attempts → `hasValidData=false` → `Math.max(storedCSD,0)` keeps
  the old day, `progressService.js:192`). So regression must *actively*: find the prior passed-new anchor,
  compute the correct lower csd/twi, and write `class_progress` + clear forward `session_states`
  (`newWordsTestPassed:false`). This is exactly why D1 recommends correct-only for v1 — regression is a
  separate mechanism, not a free side effect.

### 3.5 Audit
- `system_logs` event `grade_override`: `{attemptId, studentId, classId, listId, wordId, by:caller,
  from, to, oldScore, newScore, oldPassed, newPassed, reason}`. Teacher-readable only (rules:120-124) →
  this is the tamper-evident trail.
- Top-level `overridesLog[]` on the attempt (NOT inside `answers[]`, §3.3) is the student-visible trail
  for D3. One `system_logs` event per transition; `overridesLog[]` appends each transition.

### 3.6 Idempotency / re-override
Deterministic on (attemptId, wordId, isCorrect): re-calling with the same target is a no-op (fast path).
**v1 is correct-only (D1)** — the only transition is incorrect→correct; "mark incorrect" is not built, so do
NOT implement toggle/regression behavior here. Each (idempotent) call is logged. No new docs created.

### 3.7 Whole-test force-pass mode (D5)
Same callable, alternate input `{attemptId, markTestPassed:true, reason?}` (no `wordId`). Auth identical
(§3.2). Logic:
- Load attempt; if already `passed`, `status:'noop'`.
- **Anchor-provenance gate (§0.5, Codex):** force-pass does NOT recompute `score`, but it advances the day
  from the attempt **anchor**, so the anchor must be trustworthy. Require a **server-validated anchor** —
  either the attempt carries the server-validated marker, OR the callable **re-derives the expected
  `studyDay`/`newWordEndIndex` from class/list/day context and matches** the stored values. Missing/bogus/
  mismatched (historical or forged) → `legacy_attempt_untrusted` → CS (do not advance on an untrusted anchor).
  Force-pass does NOT require *server-graded* correctness (it ignores `answers[]`), so it works for MCQ —
  but it is **not** exempt from anchor provenance.
- Set top-level `passed=true` + `overridePassed:true` + `overriddenBy/At/overrideReason`; append
  `overridesLog[]` entry `{type:'force-pass', by, at, reason}`. **Do NOT touch `answers[]` or `score`** —
  the gradebook shows the true score with a "teacher-passed" marker; missed words keep their FAILED
  `study_states` and stay in the review queue.
- Forward-only (false→true). Reconciliation advances csd/twi from this now-passed anchor on next load;
  set the boundary `session_states` for immediate UX exactly as §3.4. Return `oldStudyDay`/`newStudyDay`.
- Idempotent; one `grade_override` (`type:'force-pass'`) `system_logs` event.

## 4. Client — gradebook drawer control

### 4.1 Where
`src/pages/Gradebook.jsx`, inside each answer card in the details drawer (~lines 1320-1459). Gated
`challengeMode==='review'` (teacher only). **Audit: unify with the existing challenge controls** — don't
add a second green/red button pair next to the challenge accept/reject (lines 1366-1411). Render ONE
"Review / Override" control per answer:
- if `challengeStatus==='pending'` → the existing **Accept / Reject challenge** buttons (unchanged);
- else if teacher → an **Override** affordance (below).
Stamp a small badge on a corrected answer so the source is always legible: "Student challenge" vs
"Teacher override" (reads from `challengeStatus` vs `overriddenBy`).

**Drawer header — whole-test (D5):** a **"Mark test passed"** action (teacher-only, hidden if already
passed) → confirm showing the true score + consequence ("Pass {student}'s test at {score}% and advance to
Day N? Missed words stay in their review queue.") → calls the callable with `markTestPassed:true`. On a
force-passed attempt the header shows a "Teacher-passed at {score}%" marker.

### 4.2 UX
- Per answer: current verdict + override affordance. Incorrect → **"Mark correct"**. Correct →
  **"Mark incorrect"** (hidden entirely if D1=correct-only, which is the v1 recommendation).
- Click → confirm dialog with optional reason. The consequence line uses the server-returned
  `oldStudyDay`/`newStudyDay` (§3.1): "This will let {student} advance to Day N" / (review session) "This
  is a review test — accepting auto-passes it." For regression (if ever enabled), a **second** confirm
  spelling out "This moves {student} BACK to Day N."
- On success: refresh via `fetchAttemptDetails(attemptId)` (the existing pattern, Gradebook.jsx:1380/1396).
  Use the app's **toast**, not `alert()` (the current challenge handlers use `alert` at 1385/1401 — don't
  copy that). Disable the button + show in-flight state while the call is pending (guard against
  double-click; the server is idempotent but the UI shouldn't flicker).
- **Design tokens only** (CLAUDE.md): use `Button` `variant="success"` / `variant="danger"`,
  `Modal` (`bg-surface`/`text-text-primary`), semantic `bg-success`/`bg-error` for badges — never raw
  `bg-blue-600`/`bg-slate-600`.
- Error handling: on `status:'legacy_attempt_no_anchor'` **or** `'legacy_attempt_untrusted'` show "Can't
  auto-adjust this attempt — contact support". Offer force-pass **iff the callable returned
  `canForcePass:true`** (§3.1) — do NOT have the client infer it from `reason`/status. (`canForcePass` is true
  only when the block was on *correctness* and the anchor is server-validated; an untrusted anchor → false →
  CS.) Optionally tailor copy by `statusReason` (e.g. `mcq_v1` → "MCQ override isn't available yet").
  On `permission-denied` (teacher isn't the class owner) hide/disable the button up
  front by checking the loaded class `ownerTeacherId` against `user.uid`, so they don't discover it only
  on failure.
- **Student side (D3):** if `overriddenBy` is set, the student's own gradebook answer shows "Adjusted by
  your teacher" (+ reason if present). Requires `fetchAttemptDetails` to surface the top-level
  `overriddenBy/At/overrideReason` + `overridesLog[]`.

### 4.3 Bug this corrects in reviewChallenge (capture for the migration, D2)
`reviewChallenge` (db.js:2755-2761) derives `listId`/`phase` by splitting `testId` and *assumes* format
`test_recovery_classId_listId_phase`; the real `testId` is `vocaboost_test_{classId}_{listId}_{type}` and
the attempt already stores `classId`/`listId`. It also hand-increments `class_progress.currentStudyDay`
+ `totalWordsIntroduced += round(pace*(1-intervention))` (2817-2822) — a **second, divergent** twi
formula vs. reconciliation's `newWordEndIndex+1`. The new callable uses the stored fields and defers
csd/twi to reconciliation, eliminating both issues. Migrating reviewChallenge onto it (D2) inherits the fix.

## 5. Security
- Closes (D2) the `firestore.rules:45-48` broad-teacher-write hole: with override + reviewChallenge on
  the server (Admin SDK), tighten the subcollection rule to `isOwner(userId)` (read may stay
  `isOwner||isTeacher` for gradebook reads, but writes → owner-only).
- **Tighten the direct attempt-update rule (Codex-High).** `firestore.rules:108-113` currently lets a
  teacher-of-record update the WHOLE attempt doc (score/passed/answers/override fields) with no
  affected-key allowlist, keyed off the *stale* denormalized `attempt.teacherId`. Once grade mutation is
  callable-only, **remove the teacher-update branch entirely** (or restrict to a tiny allowlist) so the
  only path to score/passed is the Admin-SDK callable that verifies *live* ownership. **The student
  `answers`-update branch is also REMOVED** — `submitChallenge` becomes a callable per
  `PLAN_attempt_write_lockdown.md` (W1/W3), so no client writes `attempts.answers`. (Earlier draft said this
  branch "stays"; that was the bug Codex flagged — it's the forgery vector, so it must go.)
- No client write to another student's docs. Caller can only touch attempts in a class they own
  (verified against *live* `ownerTeacherId`, not the denormalized `attempt.teacherId`).
- `isCorrect`/`score`/`passed` become server-computed for overrides — narrows the forgeable-attempt
  surface (related: NEED_TO_FIX item, PLAN_server_side_attempt_write_v2.md).

## 6. Edge cases
1. **Denominator** — use persisted `totalQuestions` (not `answers.length`); skipped-question attempts
   otherwise inflate the score (the exact bug reviewChallenge's comment warns about, db.js:2684-2689).
2. **Review attempts** — `passed` stays `true` regardless; override still corrects `isCorrect` + study_state.
3. **Stale-day attempt** — overriding an OLD day's answer corrects score/study_state but must NOT bump the
   current day (mirror the `isCurrentBoundary` guard, db.js:2792-2794).
4. **Legacy anchor-less attempt** — structured error, no silent no-op (§3.3).
5. **Answer already at target** — idempotent no-op.
6. **passThreshold** — resolved (§3.3): defaults are aligned at 95 across submit/challenge; override uses
   `?? 95` too; real assignments carry their own value (92 for 26SM). No mismatch to "decide."
7. **Word also has a pending student challenge** — overriding it must resolve the challenge too, **in the
   same transaction** (Codex-Medium): set `answers[i].challengeStatus='superseded'` and update the user's
   `challenges.history[]` entry, so challenge tokens/history can't disagree with the attempt
   (reviewChallenge guards `challengeStatus!=='pending'` at db.js:2666 — the override is the only other
   writer of that field).
8. **Multiple lists / wrong class** — read `attempt.classId`/`listId` off the stored attempt; never trust
   a client-passed classId (the ownership check keys off the stored value).
9. **Future-day attempt** — overriding a day *beyond* the boundary corrects score/study_state but must not
   advance the day (`studyDay === csd+1` guard, db.js:2792-2794); confirm message must not falsely claim
   advancement.
10. **Corrupt/missing `attempt.classId`** — fail fast with `failed-precondition` before loading the class.
11. **Partial-write safety (Codex-High, corrected)** — attempt + study_state + ALL student-visible audit
    fields (`overridesLog[]`, `overriddenBy/At/Reason`, `gradeAdjusted`) + challenge-supersede in ONE
    transaction. Only `system_logs` is best-effort after. (`overridesLog[]` is the D3 explanation the
    student sees — it must not be able to lag the grade change.)
12. **Drawer listId parsing (Codex-Medium)** — `fetchAttemptDetails` (`db.js:2241`) derives listId from
    `testId`, which drives list-name + fallback definition reads (`db.js:2272,2353`) and breaks on
    malformed `testId`. Fix to `attemptData.listId ?? parsedListId` + use `attemptData.classId` directly
    (mirror the fetchUserAttempts fix). Needed because the drawer is where overrides happen.

## 7. Testing
- **Server E2E (25WT sandbox, audit student):** (a) below-threshold new attempt → mark one wrong answer
  correct → score recomputes, passed flips, reconcile advances day; (b) non-owner teacher → denied;
  (c) **self-promoted student** (set own role=teacher) → still denied (validates §0.3 mitigation);
  (d) idempotent re-call → `status:'noop'`; (e) legacy anchor-less attempt → `legacy_attempt_no_anchor`,
  UI shows the specific message; (e2) **provenance (§0.5):** MCQ attempt → `legacy_attempt_untrusted` (v1);
  pre-lockdown / non-`cloud-function` attempt → `legacy_attempt_untrusted`; typed post-lockdown → recompute
  allowed; (e3) **per-answer anchor split-brain (Codex):** typed `correctnessSource:'server-ai'` BUT
  untrusted/mismatched new-word anchor + flip would advance the day → `legacy_attempt_untrusted` (correctness
  trusted, anchor not → no advance); same attempt where the flip does NOT cross the threshold → recompute
  allowed, no advance, no anchor gate; (e4) **`canForcePass` branches (Codex):** per-answer blocked on
  *untrusted correctness* but *valid anchor* → `statusReason:'untrusted_correctness'`, `canForcePass:true`
  (UI may offer force-pass); per-answer blocked on *untrusted anchor* → `statusReason:'untrusted_anchor'`,
  `canForcePass:false` (UI must NOT offer force-pass → CS); (e5) **force-pass with bad/mismatched anchor** →
  `legacy_attempt_untrusted`, `statusReason:'untrusted_anchor'`, no advance; (f) stale-day (old day) attempt → score fixed, day unchanged; (g)
  future-day attempt → score fixed, day unchanged, no false "advanced" message; (h) threshold-boundary
  (93 vs 95-default vs 92-assignment) → pass/fail matches submit path; (i) word with pending challenge →
  challenge marked `superseded`; (j) class re-owned after attempt → only current owner can override;
  (k) [only if D1=both] regression → day actively drops to prior anchor;
  (l) **force-pass (D5):** below-threshold new attempt → "Mark test passed" → `passed=true`, `score`
  unchanged, missed words still FAILED in `study_states` (review queue intact), reconcile advances day;
  (m) force-pass idempotent + forward-only (re-call → noop); (n) gradebook shows "teacher-passed at N%",
  not 100%. Reuse diag/sweep; sweep CLEAN before/after.
- **Browser E2E:** teacher opens gradebook drawer, marks answer correct, sees toast + refreshed verdict;
  log in as the student → unblocked to next day. Console clean.
- **Rules test (if D2):** student still can't write another student's subcollection; teacher write to
  subcollection now denied (server-only).

## 8. Rollout
- Flag-gate the client control (reuse the existing feature-flag pattern from the server-write cutover).
- Deploy function + rules (rules only if D2) — user deploys (I can't from container).
- Ship behind flag → validate in sandbox → enable for the owner of 26SM.

## 9. Out of scope (v1)
Bulk/multi-attempt override; TA sub-accounts; student self-serve. (Whole-test force-pass IS in scope per
D5/§3.7 — the earlier "out of scope" line was stale and is removed. Codex-Low.)

## 10. Codex pass corrections (2026-06-25) — folded above
- **Blocker (role/signup):** public teacher self-signup is LIVE (`Signup.jsx:38` sends `role`,
  `db.js:219` persists it, `firestore.rules:34` allows owner full-doc write). So "exclude role from
  self-writes" can't ship alone — it would break teacher signup. → Provisioning fork in §0.3, needs David.
- **High (attempt rules):** after migrating reviewChallenge, REMOVE the broad teacher attempt-update
  (`firestore.rules:108-113`, whole-doc, keyed off stale `attempt.teacherId`). Grade mutation becomes
  callable-only. → §5.
- **High (audit txn):** `overridesLog[]`/`overriddenBy/At/Reason`/`gradeAdjusted` are student-visible
  (D3), so they go IN the same transaction as `score/passed/answers`; only `system_logs` is best-effort.
  → §3.4/§6.11 corrected.
- **Medium:** `fetchAttemptDetails` still parses listId from testId (`db.js:2241`) → prefer
  `attemptData.listId ?? parsed`, use `attemptData.classId` directly (mirror the fetchUserAttempts fix).
- **Medium:** challenge-supersede + `challenges.history[]` write also inside the transaction. → §6.7.
