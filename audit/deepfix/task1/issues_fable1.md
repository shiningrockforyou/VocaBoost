# Deep root-cause issue list — VocaBoost (independent investigator: Fable 1)

> Verification stance (David, verbatim): **"always verify all claims by all agents and Codex results. Never trust
> blindly. Always verify."** Every claim below is tagged. `[V-code file:line]` = I opened the file and confirmed the
> line NOW (working tree, uncommitted fix included). `[V-log]` = TA chat log. `[V-doc]` = asserted by a context doc,
> not independently code-traced (flagged as needing verification). `[?]` = plausible, unverified. `[spec]` = my own
> hypothesis. Where a doc asserted a `file:line`, I re-opened it and cite what the code says today.
>
> Independent scope: I did NOT read any `issues_*` peer file or a consolidated list. Divergence from the other two
> investigators is intended.

---

## 0. What the ideal app SHOULD do (north-star properties I measure deviations against)

1. **Progress is a property of (student, list), not (class, list).** A student who moves classes, is dual-enrolled,
   or is promoted on a shared list carries their exact word-position and day forever. A class confers only *access*
   + the daily *policy* (pace / threshold / test mode) for a session launched under it. **One record per (student,
   list).**
2. **A "day" completes when the day's ASSIGNED work is done** — where "assigned work" may be new-words+review,
   review-only (throttle or list-end), or nothing (all mastered). No legitimate day can permanently fail to close.
3. **When a list is finished, the app offers a next step itself** (start over / advance / a teacher-linked next
   list) with zero TA intervention. Linear "one list forever" is not the model.
4. **The server is the single source of truth for grade + pass/fail.** The client renders `passed`; it never
   re-derives a stricter verdict, never invents a threshold, never caps a test at a wrong size.
5. **Every read surface reflects the source of truth for the entity being viewed.** A student's grades query is
   scoped to that student server-side; "no data on page 1" is never mistaken for "no data."
6. **Identity and grade fields are server-authoritative and unforgeable.** Role is a claim, attempts are
   server-written, `isCorrect`/`score`/`passed` are never client-writable.
7. **A student always has a bounded, self-service (or teacher-serviceable) path out of any wrong verdict.** No
   deadlocks from token scarcity, grader strictness, or permission gaps.
8. **HEAD is always safely deployable and the live flag/commit state is observable.** No silent repo↔prod drift; no
   armed enforcement flag whose failure mode is unpatched.

Everything below is framed as a deviation from one of these, and grouped under the **structural root** it shares
with other symptoms.

---

## STRUCTURAL ROOT A — Progress keyed by (class, list) instead of (student, list)

**The single highest-leverage root.** The progress doc id is `{classId}_{listId}` and the session-state doc id is
`{classId}_{listId}`, so anything that changes the class starts a fresh counter at Day 1 / TWI 0, even though the
student's *mastery* (`study_states`, keyed `users/{uid}/study_states/{wordId}` — no classId) already carries.

- `[V-code src/services/progressService.js:33-35]` `getProgressDocId(classId, listId) => \`${classId}_${listId}\``.
- `[V-code src/services/db.js:2886]` `resetStudentProgress(userId, classId, listId)` is class-scoped.
- The `LIST_SCOPED_RECON` flag (`[V-code src/config/featureFlags.js:41]` = `true`) is a **reconciliation-layer
  patch** that re-derives position across classes at session entry — it does NOT change the storage key. So every
  symptom below is the same root leaking through the patch's seams.

### A1 · Class change / promotion resets day+TWI (NEED_TO_FIX #6) — HIGH · data-model
- Symptom `[V-log 6/30, 7/02, 7/06, 7/13]`: 이주헌, 손진욱, 박주하, 구기현, 조준모, 남세이, 신예나, Lucy Son,
  안이연, 유혜준, Kaila, 손지성 — every "승반/반 변경 후 Day 1로 리셋" or "이월 안 됨" ticket. The TA channel is
  saturated with this one shape.
- Evidence: root cause is the doc-id key above `[V-code progressService.js:33]`. Mastery carries because
  `study_states` are student+list `[V-doc — asserted repeatedly in SUPPORT_RUNBOOK; consistent with getStudyStatesForWords using \`users/${userId}/study_states\`, V-code studyService.js:340]`.
- Layer: data model. Ideal convergence: **A** (student-owned `list_progress/{listId}`; the migration in
  `PLAN_list_progress_persist.md`). The flag mitigates read-time; it does not remove the recurring CS treadmill.

### A2 · Cross-class review completion forces a spurious new-word retake AND double-advances TWI (NEED_TO_FIX #9) — HIGH · reconciliation
- The exact flow the flag exists to fix fails at its LAST step: pass Day-D new words in class A, resume in class B
  (same list), complete the Day-D review in B → told to retake new words, and the retake operates on the WRONG
  day's words.
- `[V-code src/services/studyService.js:1391-1394]` the gate calls `getNewWordAttemptForDay(..., { listScope,
  expectedBase: sessionState.sessionConfig.newWordStartIndex })`. A FRESH class-B session sets
  `newWordStartIndex = totalWordsIntroduced` (the already-advanced TWI) `[V-code studyService.js:248]`, but A's pass
  is anchored at the day's base (one pace lower) → mismatch. The Fix #9 review-resume branch
  `[V-code studyService.js:250-275]` zeroes `nwCount` and restores the anchor range to mitigate, but this depends on
  a REVIEW_STUDY phase being detected on the fresh entry — which is exactly the intermittent seam (see A3).
- Three coupled failure modes (gate lookup / TWI double-advance / cross-class convergence) are documented in
  NEED_TO_FIX #9; I confirmed the gate-lookup and TWI-source lines. Layer: backend reconciliation. Convergence: **A**
  (one record ⇒ no "fresh class-B session" exists).

### A3 · Carry INTERMITTENTLY strands a promoted student at Day 1 (NEED_TO_FIX #12) — MED · reconciliation/client
- `[V-log 7/13]` Lucy Son: finished Inter[한] to day 11 (anchor nwei 879) yet started ADV[한] at Day 1 and re-did
  days 1-5, *while `csd_twi_reconciled` fired on her ADV[한] loads* — reconciliation RAN but applied the native
  position, not the 879 anchor. Same mechanism carried 홍승연 + 6 Final-movers correctly → intermittent.
- Evidence I can confirm: the anchor query IS student+list scoped and paginates for the max valid
  `newWordEndIndex` `[V-code src/services/db.js:3250-3298]`, so a correct cross-class anchor IS returned when the
  query runs. The reconciliation apply is unconditional when `safeCSD/safeTWI` differ `[V-code
  progressService.js:233-270]`. So the strand is NOT in the anchor query or the apply — it is upstream/timing:
  `initializeDailySession` reads `getOrCreateClassProgress` ONCE at entry `[V-code studyService.js:158]`; if the
  first promoted entry races the reconciliation write or reads a cached/duplicate session context, the session is
  built off the pre-reconciled snapshot. **Root cause NOT pinned from code alone** — needs an app repro with
  reconciliation logging.
- `[?]` My leading hypothesis: the SESSION build consumes `progress` from the return value of
  `getOrCreateClassProgress`, which reflects the just-written reconciliation — so a strand implies the FIRST
  post-promotion load hit a `query-error` or `none` status (anchor not yet visible) and fell through to defaults,
  then subsequent loads were non-demoting `Math.max(storedCSD, csd)` where storedCSD was already the native (lower)
  value written on the stranded first day. That would explain "reconciliation ran (later) but never demoted the
  native progress up to the anchor" — because CSD is non-demoting, but TWI is bidirectional and SHOULD have jumped;
  so the real question is why `safeTWI = Math.max(storedTWI, twi)` didn't apply 880. Open question worth an
  instrumented repro.
- Layer: client session-build + reconciliation timing. Convergence: **A** removes the second class_progress doc
  entirely.

### A4 · The (class,list) session_state key + non-demoting CSD ⇒ phantom "day complete" undercount (Kaila-type) — MED · reconciliation
- `[V-doc SUPPORT_RUNBOOK CS-2026-07-13c]` Kaila Chung: Final Ascent reconciled to csd=2 while Day 3 was complete
  (d3 new+review in her old Adv class), because cross-class review-pairing failed → couldn't reach Day 4.
- Evidence: the review-pairing requires an EXACT anchor position-range match `[V-code db.js:3440-3441]`
  (`data.newWordStartIndex === pairing.anchorNewWordStartIndex && data.newWordEndIndex === pairing.anchorNewWordEndIndex`).
  A cross-class review whose stored `newWordStartIndex/EndIndex` don't exactly equal the position-max anchor's range
  (cross-pace, or a review written from a fresh session with a different base) fails to pair → `csd = anchorDay-1`
  `[V-code progressService.js:182]` → the day looks incomplete. Confirmed mechanism; matches the report.
- Layer: reconciliation. Convergence: **A** (one progression ⇒ no cross-class range skew).

### A5 · `resetStudentProgress` is a no-op for cross-class students (NEED_TO_FIX "Known consequence") — LOW · by-design under A
- `[V-code db.js:2886]` deletes only class-scoped attempts; under the list-wide anchor the other class's attempts
  resurrect CSD/TWI. **Coherent under student-owned progress** (documented, deferred). Not a bug — listed so it is
  not re-surfaced.

---

## STRUCTURAL ROOT B — The day-completion model has no representation of "a day with zero new words," and no "list finished → what next"

The gate models a day as *introduce new + review*; it conflates "failed/skipped the new-word test" (block) with "NO
new-word test existed" (should complete on review). And the list is a dead-end at its last word.

### B1 · Full-freeze / list-end review-only deadlock (NEED_TO_FIX #11) — HIGH · backend/intervention
- `[V-log all week]` — the DOMINANT theme: 김동현, 최도훈, 정유나, 어재원, 안예진, 이가온, 최다온, 한예진,
  김준서, Bridge TOP finishers — all hit **"이 날을 완료하려면 먼저 새 단어 시험을 통과해야 합니다 (Day not
  complete — pass the new-word test first)"** on a review-only day. `[V-doc SUPPORT_RUNBOOK CS-2026-07-13c]` scan =
  **169 students at the wall, ~all list-end.**
- Evidence (mechanism, fully traced):
  - `newWordCount = min(allocation.newWords, wordsRemaining)` `[V-code studyService.js:235]`; `allocation.newWords =
    round(pace × (1 − interventionLevel))` `[V-code src/utils/studyAlgorithm.js:107]` → **0** at throttle
    (interv=1.0) or list-end (wordsRemaining≤0).
  - `calculateInterventionLevel` reads the last-3 non-null review scores from `recentSessions`
    `[V-code studyAlgorithm.js:66-98]`; `recentSessions` is appended ONLY on completion via `updateClassProgress`
    `[V-code progressService.js:455]`. A frozen day never completes → the 3 low reviews stay pinned → interv stays
    1.0 → self-reinforcing. Confirmed the loop.
- **Uncommitted fix status (verified present in working tree):** `reviewOnlyDay` predicate + confirmed-reason guard
  `[V-code studyService.js:1329-1335]`; gate skip `!reviewOnlyDay &&` `[V-code studyService.js:1430]`; TWI clamp to
  0 `[V-code studyService.js:1339]`; §5 finished terminal `[V-code src/pages/DailySessionFlow.jsx:824-834]` +
  `[V-code src/pages/TypedTest.jsx:2200-2214]` "You finished the list!". This addresses the FREEZE. It is **local,
  uncommitted, undeployed, not acceptance-tested** `[V-code git status: studyService.js / DailySessionFlow.jsx /
  Dashboard.jsx modified]`.
- Layer: backend intervention + client terminal. Convergence: property **2** (day completes on review-only work).

### B2 · Empty-review "all mastered" automarker CANNOT satisfy the flag-on review pairing ⇒ auto-completed day reverts — MED · reconciliation/client · **[NEW — not in NEED_TO_FIX]**
- When today's review segment is empty (every word MASTERED & resting), the app auto-completes and writes a marker
  review attempt. That marker is written WITHOUT `newWordStartIndex`/`newWordEndIndex`:
  `[V-code DailySessionFlow.jsx:984-1000]` (fields: studyDay, testType, sessionType:'review', score, passed,
  totalQuestions:0, answers:[], autoCompleted — **no position range, no testId**).
- But under `LIST_SCOPED_RECON` the reconciliation pairs a review to the anchor ONLY on an exact position-range
  match `[V-code db.js:3440-3441]`. The marker's `newWordStartIndex/EndIndex` are `undefined` ≠ the anchor's
  integers → `getReviewForDay` returns `none` → `csd = anchorDay-1` → **the auto-completed day is reverted on next
  entry.** The code comment at DailySessionFlow.jsx:967-970 even says the marker exists to prevent reversion — but
  the flag-on pairing rule defeats it.
- Reachability: the fresh-entry list-end path was rerouted to a NON-recording terminal `[V-code
  DailySessionFlow.jsx:822-834]`, but the modal→`handleNoReviewModalClose` automarker path is still live for the
  mid-session (`moveToReviewPhase` `[V-code DailySessionFlow.jsx:950-951]`) and REVIEW_STUDY-recovery (`[V-code
  DailySessionFlow.jsx:596-602]`) cases. So a high-mastery student who reaches an empty review mid-session can
  auto-complete and then see the day revert.
- Layer: reconciliation ↔ client marker. Convergence: server marker (`SERVER_REVIEW_MARKER`, `[V-code
  featureFlags.js:28]` = false / not live) should stamp the anchor range; or the pairing should accept an
  `autoCompleted` marker without a range. Open question: is this masked in practice because such students are also
  at list-end (routed to the non-recording terminal)? Needs a mid-list all-mastered repro.

### B3 · No "list finished → start over / advance / linked next list" (David's forward design) — HIGH · product
- `[V-log 7/10, 7/13]` 이가온 "Ascent+Summit 다 100%, 이후 뭘 내야?"; David repeatedly: *"목록 끝나고 다시 처음부터
  하는 기능은 오늘 밤 업데이트 예정"* and *"summit finishers 수동으로 시험 만들어서."* 5 students finished
  EVERYTHING; the only interim answer is off-platform manual tests.
- Evidence the dashboard has no "done, go next" notion: `getPrimaryFocus` ranks progress candidates by **recency**
  `[V-code src/pages/Dashboard.jsx:1104-1108]`, so a FINISHED list (most recent activity) stays the focus and the
  student keeps clicking Start on the finished card → re-hits the B1 wall (`[V-doc CS-2026-07-13f]` describes exactly
  this for Bridge TOP). "Next list" is inferred Base→Ascent→Summit by convention only; Summit (800) < Ascent (1600)
  so size can't order them.
- Layer: product/UX + data model (list linking). Convergence: properties **3** (per-class explicit list sequence +
  a finished-hero offering start-over/advance) — `docs/plans/loop/x/plan.md` (cycling capstone) + list-linking.

### B4 · Chronic low reviews silently drive the throttle-freeze; reviews are non-gating and un-retakeable (NEED_TO_FIX #15) — MED · product
- `[V-log 7/07]` 박서준 accidentally submitted a Day-7 review, scored 2%, no retake exists. `[V-doc triage N4]`
  이서현 reviews 13/20%, Junseo 27/10/40 → interv 1.0.
- Evidence: review ALWAYS passes — `passed = currentTestType === 'review' ? true : ...` `[V-code TypedTest.jsx:817]`
  and `[V-code MCQTest.jsx:529]`. So a 2% review advances the day AND (via recentSessions) is exactly what feeds the
  B1 throttle. There is no review-retake affordance and no surfacing of review quality to teachers.
- Layer: product. Convergence: property **7** (a review-retake affordance) + surface review quality (a student
  "passing" reviews at 13% is a pedagogy signal the model hides).

---

## STRUCTURAL ROOT C — Grading is AI-only, immutable from the teacher side, strict, and the only recourse (challenge) can deadlock

### C1 · No teacher/TA grade-override path (NEED_TO_FIX #1) — HIGH · product+backend
- `[V-log 7/06, 7/08]` 김재민, 윤여진 "한글 뜻 맞게 썼는데 오답" → David: "challenge하고 accept." Every override is a
  hand-written Firestore fix today (`[V-doc SUPPORT_RUNBOOK CS-2026-06-25 조예서, CS-2026-07-02 곽경훈]`).
- Evidence: grading is AI-only; the only server-side recompute is `reviewChallenge` (below), and it is unsafe.
  There is no override callable. Layer: product + Cloud Function. Convergence: property **4/7** — a teacher "accept
  this answer / mark day passed" control that writes a VALID anchor via the server path.
- **Blocked on C-security (#1b + #1c) below** — the override callable inherits the same forgery surface.

### C2 · Permanent-fail deadlock: grader false-negative + token exhaustion + no override + promotion permission gap (NEED_TO_FIX #14) — HIGH · grader/product
- `[V-log 7/08]` 양서현 (Final A 승반생): *"정답과 똑같이 써도 오답… no matter how many times, always fail"* and
  *"승반한 친구라 단어 권한이 없습니다"* (can't even manual-fix). Recurred all week (이서현, 김재민, 윤여진).
- Evidence, three compounding parts I traced:
  1. **Grader deterministically rejects correct Korean** — `[V-doc CS-2026-06-29B, CS-2026-07-06b]`: grader marks
     `autobiographical←자전적인`, `indifferent←무관심한` wrong ("just restating the word"). NEED_TO_FIX #2. Not
     code-traced by me (it's a prompt), so `[V-doc]`.
  2. **Token math is rejection-scoped, 30-day, and easily exhausted** — `[V-code db.js:179-185]`
     `getAvailableChallengeTokens = max(0, 5 − activeRejections)` where `activeRejections` counts
     `status==='rejected' && replenishAt > now`; `[V-code db.js:2612]` `replenishAt = challengedAt + 30 days`. So 5
     rejections in 30 days = locked. `submitChallenge` throws at 0 tokens `[V-code db.js:2581-2583]`.
  3. **Promoted students lack grade/challenge permission in the new class** — `[V-log 7/08]` confirmed; the class
     they're graded under isn't the one they now belong to.
- **Contradiction I want to flag (independent value):** TAs AND the CS docs describe tokens as "5 challenges, spend
  one each; resets next week." The code says something different and more subtle: only **REJECTED** challenges (in a
  rolling 30-day window) reduce availability — **accepted and pending challenges cost nothing** `[V-code
  db.js:181]`. So (a) the "resets next week" guidance is wrong (30-day, per #14) AND (b) the "you used all 5"
  framing is wrong for accepts — a student who challenged 10 times and got them accepted still has 5 tokens. The
  real lock is specifically ≥5 rejections/30d. This is a product-model↔mental-model mismatch worth fixing in copy
  and UX, not just in TA guidance.
- Layer: Cloud Function (grader) + product. Convergence: property **7** (a recourse that can't deadlock) = override
  (#1) + grader calibration (#2) + fix promotion permission + correct the token model/UX.

### C3 · AI grader over-rejects defensible answers (NEED_TO_FIX #2) — MED · backend/prompt
- `[V-doc CS-2026-06-25, CS-2026-07-06b]` — the calibration pressure that GENERATES the override volume C1 absorbs.
  Not code-traced (prompt lives in the Cloud Function). Convergence: labeled eval set + prompt rubric + re-measure.

---

## STRUCTURAL ROOT D — Client re-derives pass/fail + thresholds + test size the server already knows, with unsafe defaults

### D1 · `retakeThreshold` defaults to 0.95 → a genuine 92–94% pass displays as "fail" (NEED_TO_FIX #5) — HIGH · client
- `[V-log 7/03]` 김나연 28/30 shows fail; 김호형 93% "cutoff became 95%."
- Evidence: `[V-code TypedTest.jsx:87]` `const [retakeThreshold, setRetakeThreshold] = useState(0.95)`. If the class
  threshold fails to resolve it stays 0.95 (> real 92) so the results screen fails a real pass. The **primary path
  now derives it from `passThreshold`** `[V-code DailySessionFlow.jsx:562-563]` and `[V-code studyService.js:980,
  1026, 1220]`, and PATH B resolves from the class doc `[V-code TypedTest.jsx:316-325]` — BUT the TypedTest
  smart-selection path still passes the literal `DEFAULT_RETAKE_THRESHOLD` (0.95) into initializeDailySession
  `[V-code TypedTest.jsx:375, 391]`, and the initial useState(0.95) is the fail-closed default whenever any
  resolution path is skipped. The interim data fix (`newWordRetakeThreshold` written onto assignments) is not a code
  guarantee.
- Root deviation from property **4/8**: a load failure fails **closed** (fail) instead of **open** (pass); the
  results screen recomputes instead of trusting the server `passed` flag.
- Layer: client. Convergence: default to a safe-low value (cohort-min or 0), OR block the verdict until the
  threshold loads, OR trust the server `passed`.

### D2 · Test size mis-generated at boundaries (NEED_TO_FIX #13) — MED · backend/test-gen
- `[V-log 7/07, 7/09]` 이혜성 Day-1 new test totalQ=10 vs config 30; 김호형 promotion-retake 30≠35; 이서현 d9
  "15문제만" (David: dup re-serve).
- Evidence for the mechanism (two capping points I traced): the new-word test pool is `newWords` (length =
  `newWordCount`) `[V-code DailySessionFlow.jsx:1122-1123]`, and `buildTestConfig` caps at
  `selectTestWords(wordPool, min(testSizeNew, pool.length))` `[V-code src/utils/testConfig.js:40-44]`. So totalQ =
  `min(testSizeNew, newWords.length)`. A day-1 student with 80 introduced words being tested on 10 means the
  **pool** had 10 (not the config) — consistent with a cross-class TWI over-advance (`newWordCount =
  min(allocation.newWords, wordsRemaining)` `[V-code studyService.js:235]` collapses when `wordsRemaining` is small
  because another class already advanced TWI). **Root cause NOT pinned** — 이혜성's "introduced 80 day-1" is in
  tension with "wordsRemaining=10." `[?]` Needs a read-only cohort audit of `attempts.totalQuestions` vs class
  `testSizeNew` + the enrollment-race path. This is a real deviation from property **4** but I will not assert the
  exact generation bug without the audit.
- Layer: backend test-gen + the cross-class TWI double-advance (shares ROOT A). Convergence: size from the class
  config, resolved against the launching class, decoupled from a racing sibling class's TWI.

---

## STRUCTURAL ROOT E — Read surfaces are point-in-time / non-authoritative and diverge from the source of truth

### E1 · Gradebook Name filter is client-side on ONE page → inactive students show "no results" (NEED_TO_FIX #8) — HIGH · client/query
- `[V-log 7/09]` 이지후 "Students=Day 8, Grades=no results"; 최도훈 "gradebook only shows review, new test missing."
- Evidence: `queryTeacherAttempts` filters the Firestore query by `teacherId` (+ optional Class/Date), orders by
  `submittedAt desc`, pages 50 `[V-code db.js:1924-1943]`, then applies the **Name→studentId filter in JS on the
  returned page** `[V-code db.js:1982-1984]`. A student whose latest attempt aged out of page 1 yields zero matches
  after the post-filter. Secondary contributor: any attempt whose `testId` doesn't match the `test_/typed_/
  vocaboost_test_` regexes is dropped before the filter `[V-code db.js:1968-1977]`.
- **New sub-finding:** the empty-review automarker (B2) and CS manual-pass attempts are written **without a
  parseable `testId`** `[V-code DailySessionFlow.jsx:984-1000 — no testId field]`, so `if (!listId) continue`
  `[V-code db.js:1977]` drops them → these completions are **invisible in the gradebook** even when the student is
  active. This is a second, independent cause of "gradebook missing rows" beyond the aging-out window.
- Layer: client/query. Convergence: property **5** — when a Name filter resolves to studentId(s), scope the
  Firestore query server-side (`where('studentId','=='/'in')` + composite index) so pagination walks that student.

### E2 · Empty `assignedLists: []` hides ALL assigned lists (NEED_TO_FIX #7) — MED-HIGH · data-compat
- Evidence: `[V-code db.js:502]` `const assignedListIds = classData.assignedLists || Object.keys(assignments)`. An
  empty array is truthy → returns `[]` → the `Object.keys(assignments)` fallback never fires → "0 assigned lists,"
  unstudyable. **Still present in the working tree** (not fixed by the uncommitted diff).
- Layer: data-compat. Convergence: `(classData.assignedLists?.length ? classData.assignedLists :
  Object.keys(assignments))` + a sweep for classes already in this split-brain.

### E3 · "Students" tab vs "Grades" tab read different sources → progress looks fine, grades look empty — MED · UX/architecture
- The Students card reads `class_progress` (the shared position) while Grades reads the paginated `attempts` query
  (E1). `[V-doc CS-2026-07-09b]` names this divergence explicitly. Deviation from property **5** (one source of
  truth per surface). Folds into E1's fix (attempts view over the shared position).

---

## STRUCTURAL ROOT F — Identity and grade fields are client-writable (security)

### F1 · Doc-`role` is self-writable → student self-promotes to teacher (NEED_TO_FIX #1b) — HIGH
- `[V-code firestore.rules:34-37]` `allow write: if isAuthenticated() && (isOwner(userId) || ...)` — no field
  whitelist, so a student can set `role:'teacher'` on their own `users/{uid}`. Every teacher gate that reads the
  DOC role is bypassable: `[V-code firestore.rules:18-20]` `isTeacher()` (`getUserData().role == 'teacher'`) and
  `[V-code functions/index.js:1849]` `renameStudent` (`callerSnap.data().role !== "teacher"`).
- Layer: Firestore rules + Cloud Function auth. Convergence: property **6** — tighten the user-doc rule to exclude
  authority fields, OR move role to a Firebase **custom claim** and check `request.auth.token.role`. Blocks C1.

### F2 · Student-writable `answers[]` + open attempt CREATE → forgeable passing score (NEED_TO_FIX #1c) — HIGH
- `[V-code firestore.rules:114-116]` student update allows `hasOnly(['answers'])` with no sub-field restriction, so
  a direct Firestore write can rewrite `answers[].isCorrect`. `[V-code firestore.rules:106-107]` `allow create: if
  ... request.resource.data.studentId == request.auth.uid` — no shape check → a student can create
  `{passed:true,score:100}` directly.
- **Laundering vector confirmed:** `reviewChallenge` recomputes `correctCount = updatedAnswers.filter(a =>
  a.isCorrect).length` and writes `score`/`passed` **on both accept AND reject** `[V-code db.js:2704-2731]` — so a
  student forges several `isCorrect:true`, files one challenge, and even a REJECTED review launders the forged array
  into a passing score. The server-side path exists but is OFF: `SERVER_CHALLENGE_WRITE` `[V-code
  featureFlags.js:20]` = false, so the legacy client `answers` write is live `[V-code db.js:2624-2638]`.
- Legacy client attempt-CREATE paths still live: the empty-review automarker `setDoc(doc(db,'attempts',markerId))`
  `[V-code DailySessionFlow.jsx:984]` (fires when `SERVER_REVIEW_MARKER` is false — it is `[V-code
  featureFlags.js:28]`).
- Layer: Firestore rules + Cloud Function. Convergence: property **6** = `PLAN_attempt_write_lockdown` (W1 challenge
  callable + remove client `answers` rule; W2 server marker; W3 `create:false` + teacher-only update). Until then,
  any recompute (reviewChallenge, a future override) must NOT trust client grade fields.

---

## STRUCTURAL ROOT G — Repo↔prod drift + no deploy provenance + an ARMED enforcement flag whose failure mode is unpatched

### G1 · `GRADE_TOKEN_ENFORCED = true` in HEAD is a deploy landmine — HIGH · ops/backend · **[sharper framing than NEED_TO_FIX #4]**
- `[V-code functions/index.js:58]` `const GRADE_TOKEN_ENFORCED = true;`. When on, a typed attempt without a valid,
  fresh token is **rejected** `[V-code functions/index.js:511-514]` (`permission-denied`), and the writer guard also
  refuses it `[V-code functions/index.js:392-399]`.
- But production was set to **`false`** by the owner on 2026-06-29 to STOP a mass save-failure outage (118
  `permission-denied` "requires a valid, fresh server grade token") `[V-doc SUPPORT_RUNBOOK CS-2026-06-29A]`. So
  **repo HEAD (true) ≠ prod (false)** — deploying `functions/index.js` as-is re-arms the enforcement in prod.
- The 06-29 ROOT CAUSE IS UNPATCHED: the token binds `attemptDocId = ${uid}_${testId}_${nonce}`
  `[V-code functions/index.js:491, TypedTest.jsx:767, 870]`, and the nonce is `localStorage`-persisted with an
  **in-memory fallback on failure** `[V-code src/utils/testRecovery.js:98-110]`. In in-app webviews / private mode
  the grade-time nonce and save-time nonce can diverge → token minted for docId-A, save attempted as docId-B →
  verify fails → `permission-denied`. No fix routes the server-returned docId back to the client. **Deploying HEAD
  reintroduces the 06-29 outage.**
- Layer: ops + backend + client. Convergence: property **8** — keep enforcement `false` until the nonce/docId
  binding is hardened (submit with the server-returned `attemptDocId`; sessionStorage/in-memory nonce that survives
  the grade→save gap), and make the live flag value observable (`exports.version` exists `[V-code
  functions/index.js:1900-1905]` — good, but the drift shows it isn't consulted as a deploy gate).

### G2 · No deploy provenance / silent repo↔prod divergence (NEED_TO_FIX #4) — HIGH · ops
- `[V-code functions/index.js:23-30]` `buildInfo.json` stamping + `[V-code functions/index.js:1900-1905]`
  `exports.version` returning `GRADE_TOKEN_ENFORCED` etc. is BUILT — but the G1 drift and the 2026-03-10
  grader-change-hidden-in-an-"apboost audit"-commit `[V-doc CS-2026-06-29B]` show the process gap persists: a fix
  can land in git and never reach users, or a flag's live value is unknowable without probing. Convergence: deploys
  build from HEAD, post-deploy verify `version.sha == git HEAD` and assert the intended flag values.

---

## Contradictions / mis-statements vs my own code read (the independent-value section)

1. **NEED_TO_FIX #10 (self-race) is listed OPEN, but the specific snapshot self-race is MITIGATED in the working
   tree.** The doc says the pre-completion snapshot calls reconciling `getOrCreateClassProgress` at TypedTest:979 /
   MCQTest:717. The code NOW uses read-only `getClassProgress` under `LIST_SCOPED_RECON`:
   `[V-code TypedTest.jsx:983-985]` and `[V-code MCQTest.jsx:722-724]`. So the "reconcile-then-complete" self-race
   the item describes cannot occur on the flag-on path. (The day-guard rebuild machinery still exists
   `[V-code progressService.js:442-452, studyService.js:624-655]`, so a DIFFERENT reconciliation-advance path could
   still trigger it — but not the snapshot one #10 documents.) **Recommend re-verifying/closing #10 against current
   code.**

2. **The `getPrimaryFocus` "newest-assigned, progress-blind" footgun (SUPPORT_RUNBOOK CS-2026-06-24b / 06-28b,
   filed as a nice-to-have) is largely FIXED.** `[V-code Dashboard.jsx:1085-1108]` §2a now PREFERS a list the
   student has active progress on, ranked by recency, before falling back to newest-assigned. So adding a new list
   no longer silently bumps a mid-progress student. HOWEVER — because it ranks by **recency**, a just-FINISHED list
   remains the focus (feeds B3). The footgun moved from "new list steals focus" to "finished list won't yield
   focus."

3. **Challenge-token model is OVER-stated by TA/CS guidance.** Docs and TAs treat it as "5 uses, one per
   challenge, weekly reset." Code: only ACTIVE REJECTIONS (30-day window) reduce availability; accepted/pending are
   free `[V-code db.js:179-185, 2612]`. Both the period ("next week" → 30 days) and the accounting ("used all 5" for
   accepts) are wrong in guidance. (NEED_TO_FIX #14 has the 30-day part; the accept-is-free part I add here.)

4. **SESSION_CONTEXT says "#12 cause NOT pinned; ruled out anchor-query errors (0 cohort-wide)."** I concur the
   anchor query is correct `[V-code db.js:3250-3298]` and the apply is unconditional `[V-code
   progressService.js:248-270]`; my independent read narrows the suspect to the FIRST-load `query-error`/`none`
   fallthrough + non-demoting CSD (A3). Not a contradiction, a sharpening — and it means the fix must ensure the
   first post-promotion load's anchor read is not silently defaulted.

5. **SESSION_CONTEXT numbers are internally inconsistent** ("≈169–172 students… 169 first scan; 170 re-scan; 172
   total finishers"). Minor, but flag: the deploy case rests on a headcount that isn't stable across scans — worth a
   single authoritative re-scan before citing a number to David.

---

## Out of scope / non-VocaBoost / resolved-by-design (do NOT re-surface as bugs)

- **Non-VocaBoost systems** `[V-log]`: 로워모듈 "풀었는데 결과 안 나옴" (6/30), Canvas/캔버스 login (7/01), 스킬마스터리
  / Skill Mastery 교재 (7/01, product change David is authoring), DSG "module 2 Upper 안 보임" (7/07 — 신우진: "들어가
  있어요"), math 모의고사 decimal places (7/03). Different products/content ops.
- **Review below-cutline advance rollback** (김지오, 7/06) — reviews are non-gating **by design** `[V-code
  TypedTest.jsx:817 / MCQTest.jsx:529]`; the *lack of a retake* is the real gap (B4), not the advance itself.
- **Adv A2 "12/12 pass" and "12개짜리 시험"** (7/13) — legit list-end remainder (fewer words left than test size);
  benign, expected under `min(testSize, pool)` `[V-code testConfig.js:40-44]`.
- **손지성 "Day 2 not Day 1"** (7/13) — carry working CORRECTLY; the student forgot a prior 6/29 session
  `[V-doc CS-2026-07-13c]`. Not a bug.
- **`resetStudentProgress` no-op for cross-class** (A5) — coherent consequence of student-owned progress; documented
  + deferred to the epoch/reset work.
- **박현율 "어제 본 단어 또 뜸"** (7/01) — that's the Review test (normal), David confirmed; not a bug.
- **고아연 "wrong list"** (7/08) — student selected Base Camp instead of Ascent; user-selection, not a fault (though
  B3's "no clear next list" makes wrong-list selection more likely — noted under B3).

---

## Summary of layers touched
| Root | Primary layer | Durable convergence target |
|---|---|---|
| A (class-keyed progress) | data model | `PLAN_list_progress_persist` — student-owned `list_progress/{listId}` |
| B (no zero-new-word day / no list-end) | backend + product | review-only completion (built) + cycling capstone + list-linking |
| C (grading override/recourse) | Cloud Function + product | teacher override callable (after F) + grader calibration + token/permission fix |
| D (client re-derives verdict) | client | trust server `passed`; safe-open threshold default; server-scoped test size |
| E (non-authoritative reads) | client/query | server-scoped student query; `assignedLists?.length` fallback |
| F (client-writable identity/grades) | rules + CF | role custom-claim; `PLAN_attempt_write_lockdown` W1-W3 |
| G (repo↔prod drift / armed flag) | ops + backend + client | keep enforcement off until nonce hardened; deploy from HEAD + version gate |
