# Task 1.1 — Orchestrator's independent issue list (`issues_claude.md`)

**Author:** Claude (orchestrator). **Program:** deepfix (`audit/deepfix/MASTER_TASK_PLAN.md`), Task 1 step 1.1.
**Date:** 2026-07-13.

**What this is.** My OWN extensive, structured issue list, written independently before seeing the fable-agent
(1.2) or Codex (1.3) lists. Divergence between the three is signal for the 1.4 consolidator. This list is
grouped by *structural root cause* (not by symptom) so it feeds the "ideal-app convergence" philosophy: each
issue is measured against what a theoretically well-built VocaBoost would do (§0), and the fix direction points
toward that ideal rather than another responsive patch.

**Sources used (§C):** `TA_CHATLOG_2026-06-30_to_07-13.md` (verbatim primary), `TA_CHATLOG_TRIAGE_2026-07-13.md`,
`NEED_TO_FIX.md`, `SESSION_CONTEXT_2026-07-13.md`, `SUPPORT_RUNBOOK.md` (CS-2026-07-13 a–f + earlier),
`PLAN_review_only_day_completion.md`, `docs/plans/loop/x/plan.md`. Two structural anchors spot-verified against
current code before writing (see legend).

**H1 discipline (David, verbatim: "always verify all claims… Never trust blindly. Always verify").** Every
`file:line` here is tagged with an evidence status. Items marked `[V-prior]` are carried from prior-session
verification and MUST be RE-traced at the 1.5 H1 gate before any of them gates a fix — I do not treat them as
proven merely because a prior digest asserted them. Items I personally traced today are `[V-now]`.

### Evidence legend
- `[V-now]` — I traced it against current code TODAY (this session). High confidence.
- `[V-prior]` — verified in a prior session (digest/runbook/plan); **re-verify at 1.5** before acting.
- `[V-data]` — Firestore read-only finding (prior session); re-confirm if it gates a write.
- `[V-log]` — direct citation from the verbatim TA chat log (primary source).
- `[?]` — plausible but unverified; investigation target.
- `[spec]` — my hypothesis; explicitly speculative.

---

## §0 — The ideal-app north star (the convergence frame)

Every issue below is a deviation from one of these six properties. The fixes should move the app *toward* these,
not bolt another special-case onto the current model.

- **N1 — Progress is student-owned, per list.** One record per `(student, list)`: word-position (`twi`),
  session-count (`csd`), and per-word mastery. A *class* confers only (a) access to a list and (b) a policy
  bundle for sessions launched under it (pace, pass threshold, test mode, test sizes, cycling flag). Nothing
  class-scoped holds position → class moves on a shared list carry automatically, with nothing to reconcile.
- **N2 — Progression is a graph, not a forever-line.** A list can *link* to a next list (explicit per-class
  sequence) and can *cycle* (start over). "Finished a list" is a first-class terminal that offers
  continue-to-next / start-over *continuously*, with zero TA intervention.
- **N3 — Allocation and day-completion are coherent at every boundary.** A day with zero assignable new words
  (list-end OR intervention-throttle) completes on review; the completion gate distinguishes "no new-word test
  was assigned" from "a new-word test was assigned and failed." Test size is deterministic and correct at
  day-1, promotion-retake, list-end remainder, and dup-serve boundaries.
- **N4 — Grading is authoritative but correctable, and never a dead-end.** The AI grader is calibrated; teachers
  have a durable, server-authorized override; challenge-token economics are humane and correctly communicated;
  reviews are retakeable and their quality is visible to teachers. No student can be *permanently* failed by a
  deterministic grader miss.
- **N5 — Writes are server-authoritative and authorized.** Attempts, progress, and role are not client-forgeable;
  role is a custom claim; attempt create/update flows through authorized server paths. Reconciliation and
  completion do not race each other.
- **N6 — The system is observable, provenance-tracked, and legible.** You can see what code/flags are live;
  teacher/student surfaces show *why* a student is in a given state (recovery, finished, low-review); CS has
  read-only signatures for every corruption class, and those signatures don't false-positive on legitimate
  states.

---

## §1 — STRUCTURAL ROOT CLUSTERS

### R-A · The progression model is a forever-linear single list (boundary deadlocks + no continuation)
**Deviates from:** N2, N3. **This is Structural Flaw A** (SESSION_CONTEXT §1). The dominant theme of the week.

The app models a student as advancing linearly through ONE list, one new-words day at a time, forever. It has
no coherent behavior for "the list ended" or "no new words are assignable today," and no first-class way to
continue (next list or start over). Every symptom below is a face of that single missing concept.

- **R-A1 — List-end review-only deadlock (`#11` list-end; the dominant live impact).**
  - *Symptom:* a student who finished a list is frozen on the next (review-only) day. Review submit is refused
    with *"이 날을 완료하려면 먼저 새 단어 시험을 통과해야 합니다 / Day not complete — pass the new-word test first."*
    `csd`/`twi` frozen; permanent stuck.
  - *Evidence:* completion gate `completeSessionFromTest` at `studyService.js:1430` (`if (!reviewOnlyDay &&
    newWordAttemptPassed !== true && newWordScore < threshold) → requiresNewWordRetake`) `[V-now]`; the
    working tree already carries the `reviewOnlyDay` fix predicate at `:1333` `[V-now]`. Live scale: **169
    students** currently at this wall (`scan-reviewonly-frozen.mjs`, all LIST-END) `[V-data]`. Chat-log
    reproductions: 김동현 (Adv B2, Ascent 1600/1600) `[V-log/data]`, 최다온+한예진 (Bridge TOP Base Camp
    1200/1200, Day-21 wall) `[V-log/data]`, 정유나/어재원/김지원/최도훈/안예진/이가온 across the week `[V-log]`.
  - *Suspected layer:* backend completion gate (`studyService.js`) + session-flow terminal
    (`DailySessionFlow.jsx`) + dashboard hero (`Dashboard.jsx`).
  - *Related:* `#11`. Converged fix built (uncommitted): `PLAN_review_only_day_completion.md` Phase 1.
  - *Convergence (N2/N3):* the gate must complete on review when zero new words were *assigned* (not failed);
    then list-end becomes a real terminal that offers next-list / start-over — not a wall.
  - *Open Q:* does the built fix's `reviewOnlyDay` predicate hold on EVERY list-end path (over-introduced list;
    all-mastered empty-review day at `DailySessionFlow.jsx:~826`)? (1.6 investigation; plan §5 flags the
    empty-review branch specifically.)

- **R-A2 — Intervention-throttle review-only deadlock (`#11` throttle; the SAME gate, mid-list).**
  - *Symptom:* a student with 3 consecutive low reviews gets `interventionLevel→1.0 → newWordCount=0` MID-list,
    hits the same completion gate, and freezes — even though they have NOT finished the list.
  - *Evidence:* 김준서 Junseo (Inter B3): last-3 reviews [0.27,0.10,0.40] → interv 1.00 → day-5 allocation
    newWords=0 → frozen `[V-data]`. The freeze is self-reinforcing: the review score that would lower interv is
    only written to `recentSessions` on COMPLETION, which the gate blocks (`#11` root, `NEED_TO_FIX #11`) `[V-prior]`.
  - *Suspected layer:* same gate as R-A1 + `studyAlgorithm.js` intervention math.
  - *Related:* `#11` throttle variant; downstream of R-E (chronic low reviews).
  - *Convergence (N3):* same gate fix un-freezes both; the throttle itself is a *by-design* recovery loop and
    should stay — but it must be able to EXIT (record the recovering review), which the gate fix enables.
  - *Open Q:* after the fix, does one high review reliably drop interv<1.0 next day (plan §8 cadence claim), or
    can a student oscillate paused↔new indefinitely?

- **R-A3 — No continuation: finished list dead-ends, no next-list and no start-over.**
  - *Symptom:* students who finish every assigned list have nothing to do; TAs hand-build manual tests daily.
    David promised a "repeat / 처음부터 다시" feature "tonight/this weekend" repeatedly across the week.
  - *Evidence:* 5 Summit-finishers stranded (함지민†, Soul Kim, 유찬†, 이가온, Young Cho) `[V-data/log]`; David
    07-10 *"주말 동안 같은 목록 repeat할 수 있게 할건데요"*, 07-13 *"목록 끝나고 나서 다시 처음부터 하게 하는 기능은
    오늘 밤에 업데이트 예정"* `[V-log]`. Legacy dead-end: `DailySessionFlow.jsx:817-826` → COMPLETE with no
    continuation; legacy `MCQTest.jsx:322-324` throws `[V-prior]`.
  - *Suspected layer:* product/design — the whole forward model (session-flow + allocation + display).
  - *Related:* David's feature request (SESSION_CONTEXT §6); cycling capstone `docs/plans/loop/x/plan.md`.
  - *Convergence (N2):* list-end terminal → "start over (cycle)" OR "advance to next list," continuous, no TA.
  - *Open Q:* student-chooses-each-time vs teacher-set auto-advance (David's open sub-decision).

- **R-A4 — No explicit list-linking / sequence within a class.**
  - *Symptom:* "next list" is inferred by convention only (Base→Ascent→Summit), which TAs and students get
    wrong; there's no per-class declared sequence. Size can't order it (Summit 800 < Ascent 1600).
  - *Evidence:* David's feature request #3 (SESSION_CONTEXT §6) `[V-prior]`; repeated wrong-list confusion in
    chat (고아연 Base-vs-Ascent 07-08; 최다온/한예진 clicking finished Base Camp card 07-13) `[V-log]`; TAs
    manually assigning the next list and telling students to pick it top-right (David 07-06) `[V-log]`.
  - *Suspected layer:* data model (class assignment) + dashboard list-selection UX.
  - *Related:* feature request; N2.
  - *Convergence (N2):* an explicit `nextListId` (or ordered sequence) on the class assignment drives automatic,
    correct continuation and removes the "which list is next?" TA burden.

- **R-A5 — Wrong-list-selection is easy and the finished list stays clickable.**
  - *Symptom:* students keep selecting/among a finished or wrong list and hit the wall; the app doesn't steer
    them to the correct next list.
  - *Evidence:* 최다온/한예진 "keep clicking Start Session on the finished Base Camp card → wall" (CS-2026-07-13f)
    `[V-data]`; 고아연 wrong-list (David: "make sure she selected ASCENT instead of BASE CAMP") `[V-log]`.
  - *Suspected layer:* dashboard list-selection UX + list-state legibility.
  - *Related:* R-A3/R-A4; N2/N6.
  - *Convergence:* a finished list renders a clear terminal + a prominent "continue here →" pointing at the
    linked next list; you can't accidentally dead-end on the finished card.

### R-B · Progress is class-scoped, not student-scoped (cross-class carry is fragile)
**Deviates from:** N1. **This is Structural Flaw B** (SESSION_CONTEXT §1). Second-most-common theme.

Progress state is keyed `{classId}_{listId}`, so a class move on a shared list creates a FRESH progress doc and
relies on reconciliation to re-derive position from attempts. That reconciliation works *most* of the time but
fails at edges — and the whole fragile machinery only exists because progress isn't student-owned.

- **R-B1 — Class change resets list progress (`#6`).**
  - *Symptom:* moving between classes that share a list resets day/word-position to Day 1; app re-feeds studied
    words. Hand-fixed ≥3× (이주헌, 손진욱+박주하).
  - *Evidence:* `getProgressDocId(classId,listId) → `${classId}_${listId}`` at `progressService.js:33-34` `[V-now]`;
    session doc same at `sessionService.js:55-56` `[V-now]`; mastery survives (keyed
    `users/{uid}/study_states/{wordId}`) so only the counter resets `[V-prior]`.
  - *Suspected layer:* data model (progress/session doc key).
  - *Related:* `#6`; converged plan `docs/plans/PLAN_list_progress_persist.md` (student-owned re-key).
  - *Convergence (N1):* re-key to `{listId}` under `users/{uid}` (or list-progress collection); class confers
    policy only. This is the FOUNDATION that also unblocks cycling (`x/plan.md` §3g server-auth twi).
  - *Note:* persona-fleet F2 found same-list/same-pace moves DO carry under LIST_SCOPED_RECON now — so `#6`
    reproduces only on different-pace / list-switch / flag-off / stale-view paths (`x/plan.md` banner) `[V-prior]`.

- **R-B2 — Cross-class carry INTERMITTENTLY strands promoted students at Day 1 (`#12`).**
  - *Symptom:* an INT→ADV promotion on the same Ascent list sometimes shows Day 1 / 0 introduced instead of
    carried progress. CS-confirmed for 안이연/유혜준/Lucy; reconciled manually.
  - *Evidence:* Lucy (luckyjiu1004) finished Inter[한] to day 11 (nwei 879) then re-did days 1–5 in ADV[한]
    despite `csd_twi_reconciled` firing on her ADV[한] loads — recon RAN but applied her ADV-native position,
    not the 879 anchor `[V-data]`. Same mechanism carried correctly for 홍승연, 6 Final-movers, Sarah Sung →
    INTERMITTENT. Ruled out (read-only): missing index (`#13` composite present), anchor-query error
    (`csd_anchor_query_error`=0 cohort-wide), anchor query itself (returns correct cross-class anchor when run
    directly) `[V-data]`.
  - *Suspected layer:* app-level session build / class-switch ordering / progress-caching on the promoted entry
    (`initializeDailySession → getOrCreateClassProgress` ordering; sessionStorage/context caching of a prior
    class's session). **Root cause NOT pinned.**
  - *Related:* `#12`.
  - *Convergence (N1):* student-owned progress makes this class of bug *structurally impossible* (there is no
    per-class doc to be stale). Interim: needs an app repro with reconciliation logging.
  - *Open Q (KEY):* what makes recon apply the native position instead of the anchor on first entry? Caching?
    Ordering? A read-before-write race? (1.6 investigation — likely needs a live repro, per SESSION_CONTEXT.)

- **R-B3 — Cross-class CSD undercount → phantom "day complete" loop (Kaila-type).**
  - *Symptom:* a promoted student shows the day as complete but can't advance — `start session → completion
    screen → dashboard`, never reaches the next day.
  - *Evidence:* Kaila Chung (Final): Ascent reconciled to csd=2 while Day 3 was complete (d3 new+review exist in
    her old Adv class) because position-range review-pairing failed cross-class → csd=anchorDay−1 phantom loop
    `[V-data]`. Fixed by setting csd=3 (non-demoting).
  - *Suspected layer:* reconciliation review-pairing (`getReviewForDay` pairs to anchor class;
    `db.js:3407-3416` per `#9`) — cross-class review not found → CSD one short.
  - *Related:* `#9` (same review-pairing root, different face), `#12`, Structural Flaw B.
  - *Convergence (N1):* a review completed in ANY of the student's classes on that list must resolve the day for
    the list-owned progress record. Under student-owned progress there's one record to resolve.

- **R-B4 — Cross-class review completion forces a spurious new-word retake + TWI double-advance (`#9`).**
  - *Symptom:* pass new in class A → finish the review in class B (same list) → told to RETAKE new words, and
    the retake operates on the WRONG day's words (skips a day of content).
  - *Evidence:* three coupled failure modes traced in `NEED_TO_FIX #9`: (1) gate lookup uses post-pass TWI as
    `expectedBase` (`studyService.js:1318-1321`) `[V-prior]`; (2) TWI double-advance via
    `wordsIntroduced=sessionConfig.newWordCount` re-added in a fresh B session (`progressService.js:462`)
    `[V-prior]`; (3) review paired to anchor's class only → classes diverge `[V-prior]`.
  - *Suspected layer:* reconciliation gate + session-init + review-pairing.
  - *Related:* `#9` (HIGH). Run S overlay S-1/S-3 is its regression test.
  - *Convergence (N1/N3):* all three fixed together; acceptance = entry from EITHER class resolves to the same
    completed-day state with `twi` at the anchor TWI (not +1 day). Student-owned progress subsumes it.

### R-C · Grading is strict + immutable-from-teacher + forgeable → permanent-fail
**Deviates from:** N4, N5. Combines the second stuck-state class (`#14`) with the override/security gap.

- **R-C1 — Permanent-fail deadlock: grader false-negative + token exhaustion + no override (`#14`).**
  - *Symptom:* the AI grader deterministically marks a correct answer wrong AND the student is out of challenge
    tokens → they can NEVER pass. Only escape is off-platform 수기채점.
  - *Evidence:* 양서현/Final A: *"정답과 똑같이 써도 오답… no matter how many times she takes it's always a fail"*
    `[V-log]`. Recurred all week: 김재민, 윤여진, 이서현, 안예진's class `[V-log]`. This is a SECOND stuck-state
    class distinct from `#11`.
  - *Suspected layer:* Cloud Function grader (calibration) + product (no override + token economics + promotion
    permission gap).
  - *Related:* `#14` = `#1`(no override) + `#2`(grader calibration) + token-replenish-misinfo + promotion
    permission gap.
  - *Convergence (N4):* teacher override (durable, server-authorized, valid-anchor-preserving) + grader
    calibration + humane token economics. No deterministic miss should be a dead-end.

- **R-C2 — No teacher/TA grade-override path (`#1`).**
  - *Symptom:* a teacher who decides an AI-graded answer should count has no way to push that into VocaBoost; the
    only fix is a manual Firestore edit by CS (risking invalid anchors).
  - *Evidence:* `NEED_TO_FIX #1`; grading is AI-only + immutable + strict-binary gate `[V-prior]`. Real case
    조예서 (CS-2026-06-25).
  - *Suspected layer:* product + backend (a new authorized callable + gradebook UI).
  - *Related:* `#1`; blocked on `#1b` (role trust) AND `#1c` (answers[] forgeability).
  - *Convergence (N4/N5):* a server-write override that mirrors the CS script's valid anchor
    (`newWordEndIndex`/`testId`/`wordsIntroduced`), authz'd by class ownership, audit-logged.

- **R-C3 — AI grader rejects defensible answers (calibration) (`#2`).**
  - *Symptom:* grader marks reasonable answers wrong (Korean near-synonyms, paraphrase, partial credit),
    generating the override volume `#1`/`#14` then absorb.
  - *Evidence:* 조예서 `migratory`="animal that migrates", `synthetic`="통합적인" `[V-prior]`; 김재민 "교재에
    있는 한글 뜻을 적었는데 틀렸다" `[V-log]`; 윤여진 "뜻 맞게 썼는데 오답" `[V-log]`.
  - *Suspected layer:* Cloud Function grading prompt/rubric.
  - *Related:* `#2`; feeds `#14`.
  - *Convergence (N4):* collect overridden items as a labeled eval set; measure false-negative rate by answer
    type; tune prompt with a synonym/partial-credit rubric; re-measure. Better calibration shrinks the whole
    override problem.
  - *Open Q:* what classes of answer does it over-reject? Needs a data pull of teacher-overridden items.

- **R-C4 — Challenge-token economics are opaque + punitive + mis-communicated.**
  - *Symptom:* students run out of tokens and are told "resets next week," but replenish is actually 30 days;
    rejected challenges ALSO consume a token; so students stay tokenless far longer than expected.
  - *Evidence:* VERIFIED in `users/{uid}.challenges.history`: `replenishAt = challengedAt + 30 days` (이서현)
    `[V-data]`; TAs told "다음 주에 challenge reset" (David 07-01) `[V-log]` — wrong guidance. 이서현 07-13
    "challenge를 저번주부터 못 하고 있대요. no tokens" `[V-log]`.
  - *Suspected layer:* product (token model) + CS guidance.
  - *Related:* `#14` (compounding factor); triage N2.
  - *Convergence (N4):* humane token economics — don't consume a token on a *justified* (accepted) challenge, or
    on a grader-error challenge; surface the real replenish date to the student; correct the CS guidance NOW.

- **R-C5 — Promotion permission gap: promoted students lack challenge/grade permission in the new class.**
  - *Symptom:* "승반한 친구라 저희가 단어 권한이 없습니다" — TAs can't even manual-fix a promoted student's grade.
  - *Evidence:* 양서현 07-08 `[V-log]`; triage N2 `[V-prior]`.
  - *Suspected layer:* permission model — challenge/grade permission is CLASS-scoped, but the student's progress
    is (should be) student+list-scoped, so on promotion they lose the ability to act on words they're studying.
  - *Related:* `#14`.
  - *Convergence (N1/N4):* permission to challenge/grade a word should follow the (student, list) the attempt was
    taken on, not a specific class enrollment.

### R-D · Test generation is non-deterministic at boundaries (`#13`)
**Deviates from:** N3.

- **R-D1 — Wrong test size at day-1 / promotion-retake / dup-serve.**
  - *Symptom:* students get a wrong-sized test at an edge while the class config is correct.
  - *Evidence:* VERIFIED 이혜성 (미주 INT): class `testSizeNew=30` but Day-1 new test totalQ=10 (introduced 80),
    Days 2-4 correct, self-healed `[V-data/log]`. 김호형 (Adv E→Final A promotion): retake out-of-30 not
    out-of-35 (could NOT verify — email has no auth record) `[V-log]`. 이서현 (INT B3 d9): 15 questions,
    David *"같은 시험을 여러번 보게 돼서 꼬였다"* = dup/re-serve `[V-log]`. (Adv A2 12/12 = legit list-end
    remainder, benign.)
  - *Suspected layer:* backend test-generation (first-day/enrollment race? cross-class config pick? retake size
    source?).
  - *Related:* `#13`; triage N1.
  - *Convergence (N3):* test size is a deterministic function of (list-position, pace, remaining) resolved from
    the launching class's policy — no enrollment race, no cross-class config bleed, no dup.
  - *Open Q:* which generation path produces the wrong size at each edge? Needs a read-only cohort audit of
    `attempts.totalQuestions` vs class `testSizeNew` to size + localize it.

### R-E · The review model is non-gating + non-retakeable + silently feeds the throttle (`#15`)
**Deviates from:** N3, N4, N6.

- **R-E1 — No review-retake path; a mis-submitted review is permanent.**
  - *Symptom:* a student accidentally submits a review, scores near-zero, wants a retake — no mechanism exists;
    and because reviews are non-gating, the near-zero review still advances the day.
  - *Evidence:* 박서준 (INT B3) Day-7 review submitted by accident, 2% `[V-log]`; 김지오 asked to roll back a
    below-cutline review-advance (by design, but exposes the gap) `[V-log]`.
  - *Suspected layer:* product (review lifecycle).
  - *Related:* `#15`; triage N3.
  - *Convergence (N3/N4):* a review-retake affordance; optionally a minimum review bar; either way, an accidental
    garbage review shouldn't be unrecoverable.

- **R-E2 — Chronic low review scores silently drive the `#11` throttle (N4 signal).**
  - *Symptom:* reviews always "pass" (non-gating), so chronically low reviews (13–40%) don't block directly but
    push interv→1.0 → the R-A2 throttle freeze; teachers have no visibility that a student is "passing" at 13%.
  - *Evidence:* 이서현 reviews 13%/20%; Junseo 27/10/40 → interv 1.0 `[V-data]`.
  - *Suspected layer:* product (review quality surfacing) + the intervention pipeline.
  - *Related:* `#15`/N4; feeds R-A2.
  - *Convergence (N6):* surface review quality to teachers (a student passing reviews at 13% is a pedagogy signal
    the current model hides).

### R-F · Writes are client-authoritative (self-race, forgery, role escalation)
**Deviates from:** N5. The security/authority foundation that gates the override feature AND cycling.

- **R-F1 — Doc-`role` is self-writable → student self-promotes to teacher (`#1b`).**
  - *Symptom:* a user can set their own `users/{uid}.role='teacher'`, bypassing every `role==='teacher'` check.
  - *Evidence:* `firestore.rules:34-35` owner-write with no field whitelist `[V-prior]`; AuthContext reads role
    as a doc field (`AuthContext.jsx:39`) `[V-prior]`.
  - *Suspected layer:* Firestore rules + auth model.
  - *Related:* `#1b` (HIGH, blocks `#1`).
  - *Convergence (N5):* exclude authority fields from owner self-write, or move role to a custom claim
    (`request.auth.token.role`).

- **R-F2 — Student-writable `answers[]` → forgeable passing score via reviewChallenge / direct create (`#1c`).**
  - *Symptom:* a student can rewrite `answers[].isCorrect` (rule allows `hasOnly(['answers'])` without sub-field
    restriction) then launder it into a passing score via `reviewChallenge`'s unconditional recompute; and can
    directly `create` any attempt with `{passed:true}` (no shape check).
  - *Evidence:* `firestore.rules:109` (update) + `:101` (create) `[V-prior]`; `reviewChallenge` recompute
    `db.js:2690-2717` `[V-prior]`; legacy client create paths `db.js:1242/1397`, `DailySessionFlow.jsx:962`
    `[V-prior]`. **LIVE, not hypothetical.**
  - *Suspected layer:* Firestore rules + attempt-write path.
  - *Related:* `#1c` (HIGH, LIVE); gates `#1`. Plan `PLAN_attempt_write_lockdown.md` (W1/W2/W3).
  - *Convergence (N5):* server-only attempt create + teacher-only update + remove client `answers` write →
    `isCorrect`/`score`/`passed` become server-trusted.

- **R-F3 — Flag-ON self-race: pre-completion reconciliation advances CSD → completion stale-blocked → "session
    refreshed" rebuild (`#10`).**
  - *Symptom:* a normal final-test completion can block itself and show the "세션 정보가 갱신되었습니다 / session
    refreshed" rebuild screen.
  - *Evidence:* order in `TypedTest.jsx` handleSubmit: attempt write (`:919`) → reconciling
    `getOrCreateClassProgress` snapshot (`:979`, which WRITES advanced CSD under the flag,
    `progressService.js:258`) → `completeSessionFromTest` sees CSD already advanced → day-guard rejects
    (`progressService.js:442`) `[V-prior]`. Same in `MCQTest.jsx:717` `[V-prior]`. **0 occurrences on 26SM
    live** (5 events all-time, all sandbox) — latent `[V-data]`.
  - *Suspected layer:* client completion ordering vs reconciliation.
  - *Related:* `#10` (MEDIUM, latent).
  - *Convergence (N5):* don't reconcile between attempt-write and completion; OR make completion idempotent
    (accept "already reconciled from THIS day's attempt" as success). Server-authoritative completion removes the
    race entirely.

- **R-F4 — Server-authoritative twi is the missing foundation (gates cycling + override).**
  - *Symptom:* `class_progress`/`study_states` are student-writable and anchors are client-echoed, so removing
    the allocation cap (needed for cycling) activates unbounded progress-forgery.
  - *Evidence:* `x/plan.md` §3g `[V-prior]`; `safeTWI=max(storedTWI,twi)` honors a forged `storedTWI`
    (`progressService.js:231`) `[V-prior]`.
  - *Suspected layer:* rules + server write path + reconciliation.
  - *Related:* the FOUNDATION under `#6` re-key, cycling (`x/plan.md`), and `#1` override.
  - *Convergence (N5):* server-owned progress writes + server-validated anchor. This one foundation subsumes
    R-B, unblocks R-A3 cycling, and secures R-C2 override — the highest-leverage structural investment.

### R-G · Observability / provenance / legibility gaps
**Deviates from:** N6.

- **R-G1 — No deploy provenance: can't tell which commit/flags are LIVE (`#4`).**
  - *Symptom:* deployed Cloud Functions have no signal of what code/flags they run; repo silently diverges from
    prod (wrongly failed 박시은; `GRADE_TOKEN_ENFORCED` repo=true vs prod-behaves-false).
  - *Evidence:* `NEED_TO_FIX #4` `[V-prior]`; fix written (`stamp-build.mjs` + `exports.version`) not deployed.
  - *Related:* `#4`.
  - *Convergence (N6):* build-stamped functions + a `version` callable; deploy-from-HEAD discipline.

- **R-G2 — Gradebook "no results" for an inactive-but-real student (`#8`).**
  - *Symptom:* a student's Grades/Name-filter shows "no results" though they have valid graded attempts.
  - *Evidence:* `queryTeacherAttempts` (`db.js:1858`) filters only by teacherId, `limit(50)`, then applies the
    Name→studentId filter CLIENT-side on that page (`db.js:1982`) `[V-prior]`; 이지후 last attempt 2026-06-09,
    ranks 17,236/20,029 teacher-wide → page 1 has none `[V-data]`. 최도훈 "gradebook shows only review" is the
    same surface `[V-log]`.
  - *Related:* `#8`; triage N5.
  - *Convergence (N6):* push the studentId filter server-side (`where studentId ==/in`) so pagination walks only
    that student.

- **R-G3 — Teacher surfaces don't show WHY a student is in a state (recovery/finished/low-review legibility).**
  - *Symptom:* a recovering/finished student renders as a false "behind"/"New: ✗" signal; teachers can't tell a
    review-only recovery day from failure, or see that a student "passes" reviews at 13%.
  - *Evidence:* `CurrentSessionCell` renders `newWordsTestScore:null` as red "New: ✗ -"; `StudentProgressCell`
    shows frozen-% with no "why" (`ClassDetail.jsx:56-102`) `[V-prior]`; review quality invisible (R-E2).
  - *Related:* `PLAN_review_only_day_completion.md` §6 (Phase 2 UX); R-E2.
  - *Convergence (N6):* teacher legibility — tag high-intervention/recovery/finished states; surface review
    quality.

- **R-G4 — CS integrity tooling false-positives on legitimate review-only days.**
  - *Symptom:* `data-integrity-sweep`'s `reviewNoNewPass` check flags legitimate review-only completions
    (김준서 d5, manual list-end finishers) as corruption; will flag EVERY review-only day once the fix ships.
  - *Evidence:* CS-2026-07-13c "KNOWN BENIGN ARTIFACT" `[V-data]`; SESSION_CONTEXT §4.
  - *Suspected layer:* CS tooling (`scripts/cs/data-integrity-sweep.mjs`).
  - *Related:* the deploy of `#11` fix.
  - *Convergence (N6):* the sweep must learn the `reviewOnlyDay` marker so a legitimate review-only completion
    isn't a finding.

---

## §2 — DISCRETE / PERIPHERAL ISSUES (smaller, concrete)

- **D1 — Empty `assignedLists: []` hides ALL assigned lists (`#7`).** `db.js:502` `classData.assignedLists ||
  Object.keys(assignments)` — `[]` is truthy so the fallback never fires → "0 assigned lists." `[V-prior]`
  Fix: `?.length ? … : …`. Convergence (N3): coherent assignment resolution + a data sweep.
- **D2 — `retakeThreshold` defaults to 0.95 → a genuine 92–94% pass shows as "fail" (`#5`).** `TypedTest.jsx`
  inits `retakeThreshold=0.95`; if class threshold resolution fails it stays 0.95 (> real 92) → fails *closed*.
  `[V-prior]` Real case 김나연 (dual Base Camp class). Interim mitigation applied (wrote `newWordRetakeThreshold`
  to 61 assignments) but durable fix (fail *open* + trust server `passed`) still needed. Convergence (N4): the
  results screen trusts the server's `passed`.
- **D3 — Grading can hard-fail on `listId:null` (`#3`).** `gradeTypedTest` backfill gated on `listId`; a
  recovery/resume call with `listId:null` → "Unresolvable grading payload." `[V-prior]` ~12 errors, 0 permanent
  loss. Convergence: always pass `listId`, or server-resolve via classId.
- **D4 — Grading-error modal overstates failure / loops on deterministic errors (`#4`-UX, the `gradingError`
  modal).** `gradeWithRetry` catches all errors uniformly → one "Grading Failed" modal, misleading "Your answers
  are saved," and a Try-Again loop on deterministic `invalid-argument`. `[V-prior]` Convergence (N4): branch copy
  by errCode; stop looping deterministic errors; suggest reload.
- **D5 — Grading/save transients (reliability baseline).** ~1.4% recovered-transient rate across ~220 test-days
  (fleet3): grading-retry N/3, one Retry-Save; all recovered, 0 loss. `[V-prior]` Chat: 이충한, 신세라, 김나연,
  유라시아 Top "Connection Issue" ×several (server-side, David "fixed"). Track as baseline; escalate only on an
  UNrecovered failure. Convergence (N5): server-authoritative + idempotent retry.
- **D6 — `newWordsTestPassed` derived from score, not the authoritative flag (pre-existing latent).**
  `completeSessionFromTest` derives persisted `newWordsTestPassed` from `newWordScore >= threshold` → a
  manual/lower-threshold pass can persist `COMPLETE + passed:false`. `[V-prior]` (plan §11 deferred). Convergence
  (N4): persist the authoritative `newWordAttemptPassed`.
- **D7 — Test step-navigation can't go back (minor UX).** 이서윤: "step 3에서 넘어갔는데 안 되돌아가진다" (07-08);
  이서윤(fiveluckyoon) again "실수로 step 3에서 넘어갔는데 안 되돌아가진다" `[V-log]`. A student who advances a test
  step by accident can't return. `[?]` unverified in code. Convergence (N6): allow safe back-nav or confirm.
- **D8 — "Test not visible / already completed" transient states.** 문시후 "오늘 시험 안 보인다" (07-07); 정유나
  "new vocab test가 이미 완료되어있다고 나옴" (= list-end, resolved); 박건형 "dsg 계속 이렇게 떠서 review를 못한다 /
  시험 종료 처리 가능?" (07-10, teacher asks to force-end a stuck review). `[V-log]` Mostly R-A faces or focus
  issues; 박건형 may be a distinct stuck-session. `[?]`
- **D9 — Position-vs-day display confusion.** 오하린 (Bridge, 60/day): "660번부터 해야하는데 640번부터 시작" — David:
  640 is correct (individual progress carries). `[V-log]` No bug (carry working) but the position/day surfacing
  confuses TAs. Convergence (N6): clearer position display on class move.

---

## §3 — CROSS-CUTTING SEQUENCING / DEPENDENCY ISSUES (not code bugs, but real program risks)

- **X1 — W3 sequencing blocker.** Once the `class_progress` lockdown (W3) ships, forging a `reviewOnlyDay`
  becomes the SOLE remaining way to advance CSD without passing the new-word test. So
  `completeSessionFromTest` must re-derive `reviewOnlyDay` from SERVER-side allocation before W3's class_progress
  lockdown lands (plan §4 W3 hard dependency) `[V-prior]`. A tracked cross-work ordering constraint.
- **X2 — Deploy posture: fix built but deliberately deferred; CS is reactive.** The Phase-1 `#11` fix is
  uncommitted + undeployed by David's choice ("we'll just fix as requests come in"), with ≈169 students at the
  wall handled one-by-one via `scripts/cs/*` `[V-data]`. Not a code bug — a program constraint (H3/H11): the
  deepfix program is the durable answer, and live CS interrupts will keep arriving during it.
- **X3 — Foundation gate for cycling.** Cycling (`x/plan.md`) cannot ship before server-authoritative twi (R-F4);
  it removes the allocation cap that today makes forgery self-defeating `[V-prior]`. Sequencing: foundation →
  review-only-completion (Phase 1, built) → cycling capstone.
- **X4 — Non-regression constraints for ANY fix (H10).** Must not regress: the uncommitted Phase-1 fix; the
  LIST_SCOPED_RECON invariants (twi monotonic, csd non-demoting, anchor semantics `twi=nwei+1`). Any plan that
  touches the reconciliation path re-verifies §7 (review-only × recovery × cycling).

---

## §4 — OUT OF SCOPE / NON-VB / RESOLVED-BY-DESIGN (recorded so they aren't re-surfaced as bugs)

- Non-VocaBoost products: 로워모듈 (06-30), 박현율 스킬마스터리 (07-01), 정승민 "module 2 Upper" DSG visibility
  (07-07), math 모의고사 decimal formatting (07-03). `[V-log]` — out of program scope.
- Review test IS the normal next step, not a bug: 박현율 "어제 단어 그대로 뜬다" → David "Review test일거에요"
  (07-01). `[V-log]` A legibility nit (review test under-labeled), not a defect.
- Reviews don't gate CSD BY DESIGN: 김지오's rollback ask (07-06). `[V-log]` The *gap* (no retake / no bar) is
  R-E1, but the non-gating itself is intended.
- Per-class `resetStudentProgress` is a no-op under student-owned progress (documented, deferred, David 07-11).
  `[V-prior]` Coherent consequence, not a bug; true reset belongs to the grading-concurrency epoch work.
- 12/12 list-end remainder (김소윤, Adv A2) = benign (David confirmed). `[V-log]`

---

## §5 — TOP OPEN QUESTIONS FOR THE INVESTIGATION (feed 1.4 INVESTIGATION_PLAN + 1.6)

1. **R-B2 (`#12`) root cause** — why does reconciliation apply the promoted class's NATIVE position instead of
   the cross-class anchor on first entry, intermittently? (Caching / ordering / read-before-write race.) Likely
   needs a live app repro with reconciliation logging — can't be pinned from Firestore data alone.
2. **R-D1 (`#13`) generation path** — which code path yields the wrong test size at each boundary (day-1
   enrollment race / cross-class config pick / retake size source / dup re-serve)? Start with a read-only cohort
   audit of `attempts.totalQuestions` vs class `testSizeNew`.
3. **R-A1/R-A2 fix completeness** — does the built `reviewOnlyDay` predicate cover EVERY zero-new-word path
   (over-introduced, all-mastered empty-review `:826`, throttle-then-recover cadence)? Re-verify §7 recon.
4. **R-C3 (`#2`) grader false-negative profile** — pull teacher-overridden items; measure over-rejection by
   answer type (Korean synonym / paraphrase / partial).
5. **R-F4 foundation shape** — the minimum server-authoritative-twi design that subsumes R-B, unblocks cycling,
   and secures the override — is it the same migration as the student-owned re-key (`#6`)?
6. **R-F3 (`#10`) prod latency** — why 0 live occurrences despite a deterministic mechanism? (Timing/visibility
   of the just-written attempt to the snapshot read.) Confirm it stays latent or fix idempotently.

---

## §6 — Structural synthesis (my one-paragraph thesis for the consolidator)

The week's ~50 tickets are not 50 problems — they are **five** structural gaps and their faces: (A) a
forever-linear progression model with no coherent list-end / no-new-words behavior and no continuation
(R-A → `#11`, feature request, cycling); (B) class-scoped instead of student-scoped progress, making cross-class
carry a fragile reconciliation problem instead of a non-problem (R-B → `#6/#9/#12`, Kaila); (C) grading that is
strict + immutable-from-teacher + forgeable, producing a second permanent-fail dead-end and blocking a safe
override (R-C/R-F → `#1/#1b/#1c/#2/#14`); (D) non-deterministic test generation at boundaries (R-D → `#13`); and
(E) a review model that neither gates, retakes, nor surfaces quality while silently driving the throttle freeze
(R-E → `#15`). The **highest-leverage convergence** is the pair **student-owned progress + server-authoritative
twi** (R-F4): it dissolves cluster B entirely, unblocks the continuation/cycling that dissolves cluster A's
dead-end, and provides the write-authority that makes the override (cluster C) safe — three clusters bought with
one foundation, versus the tech-debt path of patching each face as it surfaces in CS.
