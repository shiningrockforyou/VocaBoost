# Need to Fix — running list of things to actually fix

Real problems surfaced by support tickets, audits, and live use that warrant a code/product fix
(distinct from `scripts/cs/nice-to-haves.md`, which is non-urgent guardrails/UX polish). Newest
items at the top. When one is picked up, link the PR/commit and move it to "Done" at the bottom.

Format per item: **what's broken → why it happens (root cause) → impact → fix direction → effort/risk.**

---

## 3. Grading can still hard-fail on `listId: null` (residual after the 06-22 malform fix)  ·  backend+client  ·  MED

**What's broken.** `gradeTypedTest` rejects an entire test ("Unresolvable grading payload (all answers
malformed post-resolution)") when the call arrives with `listId: null`. The student gets "Grading
Failed."

**Why it happens (root cause).** The 06-22 crash-recovery malform incident (313 failures / 21 students —
see CS-2026-06-28) was fixed two ways: the client now persists `definition/definitions/partOfSpeech` in
recovery markers, and the server `resolveAnswerDefinitions` backfills canonical defs from
`lists/{listId}/words`. But the **server backfill is gated on `listId`** — when the client sends
`listId: null` (a recovery/resume path or stale bundle), backfill can't run, every row stays
unresolvable, and the softened "throw only if EVERY row is unprocessable" still throws. Audit found this
is the residual tail: ~12 such errors 06-23→06-28 across 2 students (+ 3× `401 auth/id-token-expired`
mid-test). **All recovered via retry — 0 permanent loss.**

**Impact.** Low volume now, no data loss, but a real "Grading Failed" until the student retries — the last
gap in the otherwise-robust server-authoritative grade path.

**Fix direction.** Guarantee the client always passes `listId` to `gradeTypedTest` (it's always known on
the session route); and/or a server fallback — resolve the list via the attempt's `classId`→assignments,
or grade against client-sent defs when present, instead of throwing. For the 401s, refresh the ID token
before submit (or catch + re-auth + retry). **Effort/risk:** small; read-only-audit confirmed.

---

## 4. Grading-error pop-up overstates failure / loops on deterministic errors  ·  frontend UX  ·  MED

**What's broken.** On a grading error the student sees a red **"Grading Failed"** modal that reads as a
categorical loss — even when (a) the server may have actually graded (transient/timeout: the response was
lost, no durable attempt written yet) or (b) the error is **deterministic** (malform / `invalid-argument`)
where the 3× auto-retry + the "Try Again" button loop forever with no progress. The body line "Your
answers are saved" is misleading (no graded attempt exists when grading truly failed). *(The separate
"Couldn't Save Your Results" modal — grading succeeded, durable save failed — is well-worded and correct;
this item is specifically the `gradingError` modal in `TypedTest.jsx`.)*

**Why it happens.** `gradeWithRetry` catches all errors uniformly → one "Grading Failed" modal; it doesn't
branch on `errCode` (transient vs deterministic), doesn't tell the student retry is idempotent/safe, and
doesn't suggest a reload (which rebuilds the payload and fixes deterministic cases). change_action_log
already flagged "client `gradeWithRetry` should not retry on `invalid-argument` — deferred."

**Impact.** Student anxiety + needless retakes; deterministic errors produced the old "stuck clicking Try
Again" loop (drove "stuck on loading" CS tickets). No data loss (idempotent), but bad UX + CS load.

**Fix direction.** Branch modal copy by `errCode`: transient (`deadline-exceeded`/`unavailable`) → "Connection
hiccup — your work is safe, tap Try Again"; deterministic (`invalid-argument`) → stop auto-looping and show
"Please reload this page and submit again." Reassure in both that progress isn't lost; fix the contradictory
"Your answers are saved" line. **Effort/risk:** small, frontend-only.

---

## 1. No teacher/TA grade-override path → single disputed answer blocks the whole day  ·  product+backend  ·  HIGH

**What's broken.** When a teacher/TA decides an AI-graded answer should count (lenient acceptance,
typo tolerance, partial credit), there is **no way to push that decision into VocaBoost.** The stored
attempt keeps the AI's original verdict, the score stays below the pass threshold, and the student is
stuck on that day. The only resolution today is a manual Firestore edit by CS.

**Why it happens (root cause — 3 layers):**
1. **Grading is AI-only and immutable from the teacher side.** No override UI, no API surface. A
   teacher's "I accept this" exists only on paper; the system never learns about it.
2. **The pass gate is strict + binary with no manual lever.** One item dropping 93% → 90% against a
   92% threshold fails the whole day. There's no "teacher marks this day passed/adjust score" control
   short of a script.
3. **The AI grader is strict enough that TAs routinely want to override.** It rejects defensible
   answers, which is what *generates* the override in the first place — so even a perfect override UI
   doesn't remove the underlying calibration pressure (see item 2 below).

**Impact.** Recurring CS load; every override = a hand-written DB fix (risk of invalid anchors).
Real case: **CS-2026-06-25, 조예서 (Inter B2)** — TA accepted `amnesty`="대사", but the Day-7 test
stayed at 90% (27/30, threshold 92) and she couldn't advance until I corrected the attempt by hand.

**Fix direction.** A teacher-facing **"accept this answer / re-grade / mark day passed"** control on
the grading/gradebook view that writes the override durably:
- per-item: flip `isCorrect`, recompute score + `passed`, stamp `manualOverride` + who/when/why
  (mirror exactly what the CS script does, so it produces a **valid anchor** — preserve
  `newWordEndIndex`/`testId`/`wordsIntroduced`);
- must go through the **server write path** (`submitVocabAttempt`/a new callable), NOT a client write,
  so it's authorized and can't be forged (ties into PLAN_server_side_attempt_write_v2.md);
- audit-log every override to `system_logs`.

**Effort/risk.** Medium (UI + one callable + reconciliation reuse). Risk: must not create invalid
anchors or let a non-teacher call it — gate by class ownership server-side. **Blocked on #1b (role trust)
AND #1c (answers[] forgeability) — see below.**

---

## 1c. LIVE: student-writable `answers[]` → forgeable passing score via reviewChallenge  ·  security  ·  HIGH

**What's broken (and it's live, not hypothetical).** `firestore.rules:109` lets a student update an attempt
with `hasOnly(['answers'])` but does **not** restrict which sub-fields of `answers[]` change. The app's
`submitChallenge` (db.js:2614-2624) only edits challenge metadata, but the rule is the security boundary and
it's permissive — a student calling Firestore directly can rewrite the whole array, including
`answers[].isCorrect`. Then `reviewChallenge` (db.js:2690-2717) recomputes `correctCount` from the stored
`answers[].isCorrect` and writes `score`/`passed` **unconditionally on both accept AND reject**. So a student
forges several `isCorrect:true`, files one challenge, and the teacher reviewing it (even rejecting the bogus
challenge) launders the forged array into a passing score. The teacher's UI shows only the one challenged word.

**Why it happens.** Challenge state lives *inside* `attempts.answers[]`, which the client must write for
`submitChallenge` → the rule has to allow client `answers` writes → it can't cheaply restrict sub-fields →
`isCorrect` is client-writable → any server recompute that trusts it (reviewChallenge today, the planned
override callable tomorrow) launders the forgery.

**Impact.** A student can convert a failed test into a passing one with one teacher interaction. Defeats the
"server-side, can't be forged" goal of the override feature, and is exploitable in production now via
reviewChallenge. (Reconciliation reads top-level `passed`, which the student can't write directly — so the
recompute step is the laundering vector.)

**Also forgeable via CREATE (Codex, broader).** `firestore.rules:101` lets a student `create` ANY attempt
with their own `studentId` and no shape check → direct `{passed:true,score:100}` forgery, no challenge
needed. Legacy client create paths still live: `db.js:1242/1397`, `DailySessionFlow.jsx:962` (empty-review
automarker). So the fix is the **full attempt-write lockdown** (create AND update), not just submitChallenge.

**Fix direction.** See **`docs/plans/PLAN_attempt_write_lockdown.md`** (the concrete spec; = C+D Phase D):
W1 `submitChallenge`→callable + remove student `answers`-update rule; W2 server-only attempt creation
(finish cutover + migrate the automarker); W3 rules `create:false` for clients + teacher-only update. Then
`answers[].isCorrect`/`score`/`passed` are all server-trusted. Until it lands, any server recompute
(reviewChallenge, override) must NOT trust client-written grade fields.

**Effort/risk.** Medium. Closes the live forgery; gates the override feature (#1); IS C+D Phase D (don't
solve twice). Flag the live reviewChallenge + direct-create exposure to the owner now.

---

## 1b. Doc-`role` is self-writable → student can self-promote to teacher  ·  security  ·  HIGH (blocks 1)

**What's broken.** `firestore.rules:34-35` lets a user write **any** field of their own `users/{uid}`
doc (`allow write: if isOwner(userId)` with no field whitelist) — including `role`. A student can set
their own `role:'teacher'`. Every server/rule check of the form `users/{caller}.role === 'teacher'`
(`functions/index.js:1228` `renameStudent`; rule-level `isTeacher()` at rules:18-20) is therefore
**bypassable**. Surfaced while designing the grade-override callable (item 1), which inherits the hole.

**Why it happens.** Role is stored as a plain user-doc field, not a Firebase **custom claim**, and the
owner-write rule never excluded it. AuthContext reads it as a doc field (`AuthContext.jsx:39`).

**Impact.** Pre-existing privilege-escalation surface for any teacher-gated callable. Blocks shipping
item 1 (grade override) safely.

**Fix direction.** Either (a) tighten the user-doc rule so self-writes exclude `role` (and other
authority fields): `isOwner(userId) && diff().affectedKeys().hasOnly(['profile','stats','settings','challenges', ...])`
— small, also retro-fixes `renameStudent`; or (b) move teacher identity to a **custom claim**
(`request.auth.token.role`) set by a privileged path, and check that in callables. (a) is the smaller win;
(b) is the more robust long-term answer.

**Effort/risk.** (a) is a one-rule change + a sweep to confirm nothing legitimately self-writes `role`.
Low risk, high value.

---

## 2. AI grader rejects defensible answers (calibration)  ·  backend/prompt  ·  MED — investigate

**What's broken.** The typed-test grader marks reasonable answers wrong, forcing teacher overrides.
In the 조예서 attempt it failed `migratory`="animal that migrates" and `synthetic`="통합적인" — both
arguably acceptable. (`amnesty`="대사" was genuinely wrong, so that one was a real miss, not grader
error.)

**Why it happens.** Grader strictness/calibration — exact-ish match expectations, possibly weak on
Korean near-synonyms / paraphrase-style definitions / partial credit. Root cause needs data: pull a
sample of teacher-overridden items and see what classes of answer the grader over-rejects.

**Impact.** Drives the override volume that item 1 then has to absorb. Better calibration shrinks the
whole problem.

**Fix direction.** (a) Collect overridden items as a labeled eval set; (b) measure grader
false-negative rate by answer type; (c) tune the grading prompt / add a partial-credit or
synonym-tolerance rubric; (d) re-measure against the eval set before/after.

**Effort/risk.** Investigation-first; prompt change is low-risk but must be validated against the
eval set so we don't swing into false-positives (accepting wrong answers).

---

## Done

_(none yet)_
