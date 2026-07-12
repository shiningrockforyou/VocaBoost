# Need to Fix — running list of things to actually fix

Real problems surfaced by support tickets, audits, and live use that warrant a code/product fix
(distinct from `scripts/cs/nice-to-haves.md`, which is non-urgent guardrails/UX polish). Newest
items at the top. When one is picked up, link the PR/commit and move it to "Done" at the bottom.

Format per item: **what's broken → why it happens (root cause) → impact → fix direction → effort/risk.**

---

## 8. Gradebook Name/student filter runs client-side on ONE page → inactive students show "no results"  ·  client/query  ·  HIGH

**What's broken.** Opening a student's **Grades** (or filtering the Gradebook by a student **Name**)
shows *"Your search returned no results"* even though the student has valid, graded attempts. The
student's card in **Students** still shows the correct Day (e.g. 이지후 Day 8) — because that reads
`class_progress` directly, a different data source. So progress looks fine but grades look empty.

**Why it happens.** `queryTeacherAttempts` (`db.js:1858`) fetches attempts with a Firestore query
filtered **only** by `teacherId` (+ optional Class/Date), `orderBy('submittedAt','desc')`,
`limit(50)` (`db.js:1943`). The **Name → studentId filter is applied in JS as post-processing on the
returned 50-row page** (`db.js:1982` `if (!filterStudentIds.includes(studentId)) continue`), not
pushed into the Firestore query. So the surface only ever inspects the 50 most-recent attempts
*teacher-wide*. Any student whose latest attempt has aged out of that window yields zero matches after
the post-filter → "no results". (2nd, smaller contributor: `db.js:1968-1977` drops any attempt whose
`testId` doesn't match the `test_`/`typed_`/`vocaboost_test_` regexes before the filter even runs.)

**Impact (measured, 이지후 / justin2jihool@gmail.com, 26SM 미주 SAT Inter.).** 14 clean graded attempts,
all with `submittedAt` Timestamps, correct `teacherId`/`classId` — the ordered query *does* return
them server-side. But his last attempt is 2026-06-09; teacher-wide he ranks **17,236 / 20,029
(page 345)**, and even class-scoped **660 / 753 (page 14)** at 50/page. Page 1 contains none of his →
"no results". **General bug:** hits *any* student who goes quiet ~a month. Not data corruption — no
CS data fix is warranted (verified 2026-07-09, see `SUPPORT_RUNBOOK.md` CS-2026-07-09b).

**Fix direction.** When a Name filter resolves to studentId(s), scope the Firestore query
**server-side** instead of post-filtering a page: for a single student use the existing
`queryStudentAttempts` path (`db.js:~2100`, `where('studentId','==',uid)` + `orderBy submittedAt`);
for multiple, `where('studentId','in', ids)` (≤30) — each with the matching composite index. That
makes pagination walk only that student's attempts, so an inactive student's grades appear on page 1.
Interim TA workaround: filter by **Class + a Date range around the student's active weeks** (or page
forward) — the data is all there.

**Effort/risk.** Small, localized to `queryTeacherAttempts`; needs a `(studentId, submittedAt)` /
`(teacherId, studentId, submittedAt)` composite index. Low risk (narrows, doesn't widen). Validate the
single-student "Grades" click and multi-tag Name filters still page correctly.

---

## 7. Empty `assignedLists: []` hides ALL assigned lists (dashboard shows "0 assigned lists")  ·  data-compat  ·  MEDIUM-HIGH

**What's broken.** A class whose `assignments` map is populated (lists genuinely assigned) but whose
`assignedLists` array is **empty (`[]`)** renders as having NO lists — the student dashboard shows
"0 assigned lists" and no studyable state, even though the class has a valid assignment. Surfaced by the
Run L audit (2026-07-05): `25WT LSR-A TYPED` had `assignments[TOP]` set but `assignedLists: []`, so fresh
students saw no Start button (L1-T/L1-R "test not reached").

**Why it happens (root cause).** `db.js:502` — `const assignedListIds = classData.assignedLists || Object.keys(assignments)`.
An empty array `[]` is **truthy**, so `[] || Object.keys(assignments)` returns `[]` — the fallback to
`assignments` keys never fires. The intent was "use assignedLists if present, else derive from assignments,"
but `||` doesn't treat `[]` as absent.

**Impact.** Any class that ends up with `assignedLists: []` + a non-empty `assignments` (an ordering/write
split-brain) becomes unstudyable for its students until repaired. Silent — looks like "no lists assigned."

**Fix direction.** `db.js:502` → `const assignedListIds = (classData.assignedLists?.length ? classData.assignedLists : Object.keys(assignments))`.
Consider a data sweep for existing classes in this split-brain state.

**Effort/risk.** Tiny code change, low risk. Audit added a `--pre` effective-assignment precondition that
replicates the *current* (buggy) Dashboard semantics so it catches this state rather than masking it.

---

## 6. Class change resets list progress (day/`totalWordsIntroduced`) → students re-study words  ·  data model  ·  HIGH

**What's broken.** When a student moves between classes that share the same list, their day counter
and word position reset to Day 1 — the app re-feeds words they already studied. Fixed by hand 3× so far:
이주헌 (CS-2026-06-30), 손진욱 + 박주하 (CS-2026-07-02b). Recurring; each needs a manual carry-forward.

**Why it happens (root cause).** Progress is keyed by **class + list**, not student + list. The
`class_progress` doc id is `{classId}_{listId}` (`progressService.js:32 getProgressDocId`), and
`session_states` is `{classId}_{listId}` too (`sessionService.js:55 getSessionDocId`). A new class ⇒ a
fresh `{classId}_{listId}` doc ⇒ `currentStudyDay=0`, `totalWordsIntroduced=0`. **Mastery already
persists correctly** — `study_states` are keyed `users/{uid}/study_states/{wordId}` (has `listId`, no
`classId`), so the known-words carry; only the *counter* resets. That asymmetry is the whole bug.

**Impact.** Any class change on a shared list (common: Base Camp→Ascent promotion, section transfer)
silently rewinds progress; students redo mastered words, morale/억울함 hit, TA + ops time per case.

**Fix direction (settled model, 2026-07-04 — David).** **List progress is student-owned; a class confers
only list ACCESS + the daily quota/policy (pace/threshold/testMode) for a session launched under it.** No
class owns progress state → one record per (student, list): `class_progress/{classId}_{listId}` →
`users/{uid}/list_progress/{listId}` (position only). Settings/quota resolve from the launching class;
teacher gradebook = the shared position + a view over class-tagged `attempts` (no per-class progress doc);
"day" = session count. `totalWordsIntroduced` is a pace-independent word position (carried verbatim);
`currentStudyDay` is a stored counter (carried verbatim, NOT relabeled from pace). One-time migration
collapses `{classId}_{listId}` docs → `{listId}` taking the anchor-validated `max(totalWordsIntroduced)`.
**Full plan (v3, 3-agent + Codex×2 audited):** `docs/plans/PLAN_list_progress_persist.md`.

**Effort/risk.** Medium. Real scope: (1) list-scope the reconciliation/anchor readers (anchor by
`newWordEndIndex`, not `studyDay`) — the load-bearing piece; (2) route the full composition surface
(`getProgressDocId` + blindSpot + `reviewChallenge` R+W + `TypedTest`×4 + `MCQTest`×4 + automarker) to
`{listId}`; (3) migration on live data (backup + verify); (4) gradebook/pacing become views. The
shared-live-position/server-claim architecture the audit explored was dropped as unnecessary under the
student-owned model (see plan Appendix A). Cross-plan: list-scope the grading session key
(`PLAN_grading_idempotent_concurrency.md`).

---

## 5. `retakeThreshold` defaults to 0.95 → a genuine pass (92–94%) can show as "fail"  ·  client  ·  HIGH

**What's broken.** A student scores at/above the class pass threshold (e.g. 93% vs a 92% threshold), the server writes `passed:true` and advances them, but the **results screen shows "fail"** and loops them into retakes.

**Why it happens (root cause).** `TypedTest.jsx` initializes `retakeThreshold` to **0.95** (line ~87) and only lowers it to the real value once it resolves the class/list `passThreshold` (→ `/100`). If that resolution fails or is skipped, it stays at **0.95**, and the pass check `summary.score >= retakeThreshold` compares the fraction score (0.93) against 0.95 → "fail". Because **0.95 is higher than the actual class thresholds (commonly 92)**, ANY threshold-load hiccup turns a real pass into a displayed fail. Observed for **김나연** (CS-2026-07-03): threshold load fell back to the default because she was enrolled in **two** Base Camp classes, breaking the class resolution.

**Impact.** Students who genuinely pass (92–94%) get told they failed and are forced to retake in a loop, even though the server marked them passed and advanced their day. Confusing, generates CS tickets, and mis-signals to students.

**Fix direction.** (1) Default `retakeThreshold` to a **safe low value** (e.g. the cohort-min, or 0) — never above real class thresholds — so a load failure fails *open* (pass) not *closed* (fail); or block the results-screen verdict until the threshold is actually loaded. (2) Harden the threshold resolution for **multi-class** students (pick the class the attempt was taken under; don't fall through to the default when one path returns null). (3) Ideally, make the results screen trust the server's `passed` field rather than recomputing client-side.

**Precise source (traced 2026-07-03 via 김호형/Adv E).** The client new-word gate's threshold = `assignment.newWordRetakeThreshold || DEFAULT_RETAKE_THRESHOLD(0.95)` (`studyService.js:267` → `sessionConfig.retakeThreshold` → `DailySessionFlow.jsx:1316` + `TypedTest.jsx:291`). Class assignments store `passThreshold` (which the SERVER uses) but historically **never stored `newWordRetakeThreshold`**, so it fell to 0.95. (`studyService.js:1282` already comments this and `completeSessionFromTest` was fixed to trust the attempt's `passed` flag — but the DailySessionFlow gate + TypedTest results screen were not.)

**Interim mitigation APPLIED (2026-07-03, no deploy).** Wrote `newWordRetakeThreshold = passThreshold/100` onto all 61 class assignments (39 classes), per-assignment (92→0.92, 90→0.9, 74→0.74, …). Client now reads the real threshold on the NEXT session build. **Durable code fix still needed** so new/edited assignments don't reintroduce the gap and so the gate trusts the server `passed` flag regardless.

**Effort/risk.** Low effort (a constant + a resolution guard); risk is low and strictly in the safe direction.

---

## 4. No way to tell which commit/flags are actually LIVE (deploy provenance)  ·  ops/backend  ·  HIGH  ·  **fix written, awaiting deploy**

**What's broken.** The deployed Cloud Functions had no signal of what code/flags they're running, so the repo can silently diverge from production with nobody noticing.

**Why it happens (root cause).** Two concrete 2026-06-29 instances: (a) the grader "accept answers matching the Korean definition" rule was committed **2026-03-10** (in a mislabeled commit `0de81fb "apboost audit and updates"`) yet production kept emitting the old "restating the Korean definition" failures through 06-28→06-29 11:14 KST — prod ran a **stale artifact** and there was no way to see it (this is what wrongly failed 박시은); (b) `/app` `functions/index.js:45` reads `GRADE_TOKEN_ENFORCED = true` while production *behaves* as `false` (verified by a mismatched-token save succeeding) — repo↔prod drift with no live readout.

**Impact.** Silent regressions and "fixed in repo, broken in prod" — a fix can land in git and never reach users, or a flag's live value is unknowable without behavioural probing. Directly caused a wrongful grade.

**Fix direction (implemented 2026-06-29, not yet deployed).** `scripts/stamp-build.mjs` stamps `functions/buildInfo.json` (git sha/branch/dirty/builtAt) via `firebase.json` `predeploy`; `functions/index.js` logs it on cold start and exposes `exports.version` returning the live sha + runtime flags. **Post-deploy verify:** call `version` → `sha` must equal `git rev-parse HEAD` of the deployed checkout, and `flags.GRADE_TOKEN_ENFORCED` must be `false`. Follow-ups (process, not code): deploys must build from HEAD and redeploy `gradeTypedTest`; stop hiding functional grader changes in unrelated commit messages.

**Effort/risk.** Low effort, additive/no-behaviour-change (one new read-only callable + a predeploy stamp); risk is only that the deployed checkout must carry these files.

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

## Known flag-ON consequence — per-class progress reset is a no-op for cross-class students  ·  data-model  ·  LOW (revisit with epoch)

**Not a bug — a coherent consequence of student-owned progress.** `resetStudentProgress` (student self-serve,
`Settings.jsx:90`, students-only) deletes only class-scoped attempts (`db.js:2886` `where('classId','==',
classId)`). Under flag-ON's list-wide anchor, a student's attempts on the same list in ANOTHER class survive,
so the next session re-finds that anchor and `Math.max` resurrects CSD/TWI — the per-class reset appears to do
nothing. **Under student-owned progress this is correct** (there is one list-progress record; you can't
half-reset one class). It's a student self-serve feature (no teacher reset), so exposure is low.

**Disposition (David 2026-07-11):** document + defer. The coherent "true reset" is a full list-progress reset —
owned by the **grading-concurrency Phase 2 `resetProgress` epoch** work. Run S overlay **S-9** certifies the
current interim behavior so it isn't a silent surprise. No fix now.

## 9. Flag-ON: cross-class review completion forces a spurious new-word retake  ·  backend/reconciliation  ·  HIGH

**What's broken.** Under `LIST_SCOPED_RECON=true` (LIVE 2026-07-11), the exact flow the flag was built to fix
fails at its LAST step. Student passes Day-D new words in class A → leaves before the review → resumes in class
B (same list) → **completes the Day-D review in B** → is incorrectly told to **retake the new words** (and the
retake operates on the WRONG day's words, since B's session base is the post-pass TWI).

**Why it happens (root cause, traced).** The review-completion gate `getNewWordAttemptForDay(..., { listScope,
expectedBase: sessionState.sessionConfig.newWordStartIndex })` (`studyService.js:1318-1321`) requires a
same-day passed-new attempt at `newWordStartIndex == expectedBase` (`db.js:3055-3064`). But B is a FRESH
session (session_states are `{classId}_{listId}`-keyed, so B has no persisted Day-D session) → `initializeDailySession`
sets `sessionConfig.newWordStartIndex = totalWordsIntroduced = reconciled TWI = D·p` (`studyService.js:253,185`).
A's passed attempt is at the DAY's base `(D-1)·p`, not `D·p`. Mismatch by one day's pace → gate finds nothing →
list-scoped fallback is launching-class-only (B, no pass) → `newWordScore = 0` → `requiresNewWordRetake`.
(Single-class same-session works because `newWordStartIndex` is frozen at the day's base at session start; only
a FRESH cross-class resume reads the already-advanced TWI — hence flag-ON + cross-class specific.)

**Impact.** The partial-day-switch cohort (이주헌/박주하/손진욱 pattern) — pass new in one class, finish the
review in another — hits a spurious retake, and the retake advances into the next day's words (content skip).
Still net-better than flag-OFF (which reset the whole day counter), so keep the flag ON; but this is a real
flagship-flow defect to fix.

**THREE coupled failure modes (all must be fixed together) [Codex RS3-1 / RS4-1]:**
1. **Gate lookup** — the cross-class position-consistency check should verify the passed attempt is consistent
   with the CURRENT reconciled position by `attempt.newWordEndIndex + 1 == currentTWI` (A's `2p-1+1 == 2p` ✓),
   OR pass the completing DAY's base (`TWI_at_start_of_day_D`) as `expectedBase` instead of the post-pass TWI
   (`sessionConfig.newWordStartIndex`).
2. **TWI double-advance** — even if (1) lets the review complete, `completeSessionFromTest` takes
   `wordsIntroduced = sessionConfig.newWordCount` (`studyService.js:1269`) → summary → `recordSessionCompletion`
   ADDS it to twi (`progressService.js:462`). B's fresh session computed `newWordCount = pace` at the advanced
   base `2p`, so completing the B review pushes twi `2p → 3p` — the student **skips Day-3's words** (marked
   introduced without study). Root cause = B re-inits a resumed review as a fresh new-word day; the fix must
   make a cross-class REVIEW resume carry `newWordCount = 0` (new already done in A) so twi is NOT re-added.
3. **Cross-class convergence** — the review is paired to the ANCHOR's class (`getReviewForDay`
   `where classId == anchorClassId`, `db.js:3407-3416`), but phase detection is list-scoped
   (`getRecentAttemptsForClassList`, `db.js:3119-3128`). So a Day-D review completed in B (non-anchor) is NOT
   found when reconciling the anchor in A → `A_L` stays `csd=D−1` (review pending) while `B_L` is `csd=D` → the
   classes DIVERGE and re-entering A can re-prompt the review. The fix must ensure a review completed in ANY of
   the student's classes resolves the day for BOTH class_progress docs.

**Fix direction.** All three; touches the reconciliation-adjacent gate + session-init/`recordSessionCompletion`
+ review-pairing → route through the loop/Codex review. **Acceptance: after a cross-class review completion,
entry from EITHER class on that list resolves to the same completed-day state.**

**Effort/risk.** Small code change, but on the hardened list-scoped path — must be reviewed + regression-tested.
**Run S overlay S-1/S-3 is the regression test** — asserts CORRECT behavior (review completes, no retake, AND
final `twi` stays the anchor TWI `2p`, not `3p`) → expected-RED against current code until this ships.
