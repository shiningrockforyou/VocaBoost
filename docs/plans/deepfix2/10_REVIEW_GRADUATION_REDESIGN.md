# DEEPFIX 2 ADDENDUM — Review graduation redesign (10_, v4 FINAL — the ledger-matched spec; v1-v3 at `_archive/`)

> **Status: DESIGN FINAL.** Every rule below is DECIDED (ledger `11_` §1, R2-1..R2-47; ratified through Codex r48 + the r50-r56 closures).
> Delivery = **THE LAUNCH (DF2-14)** in `02_TASK_LIST.md` — one audited cohort-wide activation. Where this doc and
> the ledger disagree, the ledger wins. The one deferred rule: challenge-reversal label stamping (R2-10 — BUILT per r47; activation = the FOUR r53
> conditions on 11_ §2 A2 — (i)(ii)(iii) CLOSED; (iv) B1 challenge-adjudication replay OPEN — never A2's report alone).

## 1. The model (universal — one model for every class, R2-24/26/27)

Day-structured study for everyone: **One Day = one `dailyPace` increment** (pace changes are PROSPECTIVE — past
days keep their historical ranges, R2-27 Q12=A). Within the day the student moves freely between review and
new-word work (R2-26 Q11); **backward** they may re-study and re-test any past day (retests: `type:'retest'`,
non-advancing, gradebook-preserving, AI-metered, **STAMPING like any graded test [R2-41 — supersedes the R2-26
label-neutrality]; rerun review = a regenerated PURE-RANDOM draw over the full introduced range (no priority
slots, fresh shuffle per rerun); rerun graduation = tested-correct only, no fill**. **Restudy navigation = the R2-40
package: state-aware resume sheet (bookmark vs frontier) · five-state TOC day grid (no phantom chapters
post-intake) · re-completion pips (a segment fills when BOTH rerun tests of the day's visit pass — new-word retest + review rerun, session-paired, each attempt counts once [R2-40c-ii]; server-written display-only counter)
· ~~historical replay~~ rerun review is REGENERATED (pure-random over the introduced range, R2-41(h)) — the ONE
live day-advancing review exists only at the current day · gradebook
shows original scores by default, with a teacher toggle (default OFF) revealing stored re-run attempts (D-3).** **Forward day-advance requires BOTH
tests passed at the class thresholds**; **a day with ZERO new words (post-intake/list-end) advances on the REVIEW
TEST ALONE — the day counter, rotation, and streak continue; no phantom empty-day wall [R2-39]; same-list cycling
is RETIRED (list-finished end screen offers the teacher-set NEXT LIST via `nextListId`)** (new-word + review; ANY-passing semantics — one passing record satisfies a
day forever, later attempts inert; code-anchored at the `getDayNewPass` filter pattern). No modes, no mode lever,
no pilot; COEXISTENCE and G-DUE are dead (R2-27). Walls are HARD: relief = restudy-and-retake (same pinned queue)
or the teacher force-pass (error-correction ONLY — R2-27 Q8). Streak = progression-based, weekends never break
(R2-21).

## 2. Review mechanics (normative)

0. **The BOUNDED PINNING THEOREM (normative [R2-10 condition (i), A2-certified]):** within one composed
   presentation, membership and grading are IMMUTABLE (the presentation record); the day's QUEUE is immutable
   per logical day (the queue record); graduation eligibility and next-day composition read live server truth
   at their transactions. Label/status changes between compose and submit never alter a pinned presented set —
   and a challenge acceptance on a RESTING word applies the grade fix only (the status write is skipped;
   `reviewRestingUntil` stands — R2-43).

1. **Queue** — teacher-set `reviewQueueSize` (launch default 60) selected by **CURSOR-CHAINED rotation
   [FIXTURE-DRIVEN MECHANISM FIX 2026-08-02, r58-verify: positional day-offset modulo over a MUTATING pool
   provably SKIPS words — 143 counterexamples; the cursor sweep is skip-proof, proven by
   `scripts/deepfix2/rotation-cyclicity-fixture.mjs` (2,671 checks)]: day N's queue = the next `queueSize`
   ACTIVE words in wordIndex order STRICTLY AFTER the persisted ROTATION CURSOR (wrapping; absent ⇒ smallest
   index). **The cursor is STUDENT+LIST+EPOCH-scoped — SHARED ACROSS CLASSES [r58: a class-scoped chain
   restarts on dual-enrollment class switches, repeating queues] — an EXPLICIT server-only doc
   (`review_cursors/{listId}_e{epoch}`, H6 §2b) advanced transactionally at compose; UNDERFLOW top-ups never
   move it (the cursor tracks the ACTIVE sweep only). The certified property is LAP-based [r58 — the
   fixed-day-count cycle claim was falsified by burst returns]: every word active across a full cursor lap
   (variable length under insertion) is served within it; mid-lap returns wait ≤1 lap.** Over the ACTIVE pool; **pool < size ⇒ whole pool + UNDERFLOW TOP-UP from graduated (resting) words, earliest-graduated
   first, up to size [R2-41(e)]**; pinned per day. **Identity is CLASS-SCOPED and immutable
   [r48]: `{uid, classId, listId, logicalDay, resetEpoch, algorithmVersion, configVersion}`** with the day's
   effective values snapshotted (mid-day teacher edits affect the NEXT queue). **Persisted CONTENT — TWO immutable records [r46-H2, FF1-07, r50-B3]: the DAY-QUEUE record `{…identity,
   anchor/generation, orderedQueueWordIds, poolHash, snapshot{threshold,queueSize,testSize,reviewTestType},
   createdAt}` (ONE per logical day) + the PER-ATTEMPT PRESENTATION record `{presentationId, queueRef + poolHash,
   presentedWordIds, compositionVersion, serverClaim, createdAt}` (ONE per composed test — every retake composes a
   NEW presentation under the R2-15 rotation; each attempt validates against ITS OWN presentation record).
   COMPOSE-TO-SUBMIT DRIFT RULE: label changes between composition and submit never alter that presentation's
   pinned set (validation runs against the attempt-time snapshot).** Same queue until the day passes
   (R2-26 Q5 — walled = frozen, intentionally).
2. **Test** — teacher-set `reviewTestSize` (default 30) from the queue; **UNCAPPED priority slots** for
   needs-priority words, ordered **least-recently-tested first** (clock = **`reviewLastTestedAt`** [RENAMED r53-B3: a NEW server-only
   field — legacy `lastTestedAt` is client-written today, stays untouched and UNREAD by the redesign until
   DF2-46 retires it], SERVER-written in the accepted-attempt txn; review-type tests INCLUDING reruns advance
   it [R2-41]; backfill-seeded from review-type history, unseeded ⇒ absent; tie-break: equal/absent → `wordIndex`);
   remainder selected DETERMINISTICALLY least-recently-tested from presentable words [R2-42 — same clock+tie-break
   as the slots; presentation order still shuffled]; `effectiveTestSize = min(testSize, |pinned queue|)`; the
   priority LRT prefix always included [R2-46]; post-compose INVARIANT CHECK ⇒ SEEDED-RANDOM FALLBACK on the
   REMAINDER ONLY (priority prefix preserved; seed recorded; `compositionVersion:'fallback-random'`; server-only
   metric — selection is not correctness-critical). **EXPOSURE LAW [R2-47 — the numeric promise is RETIRED]: the certified guarantee is STRUCTURAL — the rotation
   reaches every pool word each cycle (arithmetic fixture); under priority saturation the test is 100% failed
   words BY DESIGN; unproven words keep unconditional STUDY exposure + the rerun proof path; all exposure
   timings are MONITORING BASELINES (H8-generated), never pass/fail criteria.** Modality = `assignment.reviewTestType ∥ 'mcq'` — the hidden
   3-attempt typed→MCQ fallback is DELETED (r47 Q6). The submission carries the PRESENTED word set;
   `totalQuestions` derives server-side from it; composition is server-verified against the queue identity [r48].
3. **Labels** (on `study_states/{wordId}`; server-written inside the attempt txn; rules-locked; zero legacy readers):
   `reviewFailCount` (per reset-epoch, +1 per wrong-or-BLANK presented word, any attempt — blank=fail, R2-17) ·
   `reviewLastFailedAt` (any attempt) · `reviewLastCorrectAt` (any correct answer — clears PRIORITY) ·
   `reviewLastProvenAt` (correct on a PASSING attempt, or accepted challenge per the deferred R2-10) — recovery is
   un-guessable. **Stamping sources [R2-41]: EVERY graded test (live new · live review · rerun new · rerun review) — reruns included; proof pass-gated as above.** Derived (never stored): `needsPriority = failed ∧ (¬correct ∨ failed >
   correct)`; `fillEligible = ¬failed ∨ proven ≥ failed` (tie ⇒ ELIGIBLE — the ledger R2-29 formula governs [FF2-11]).
4. **Three composition strata [r48]:** PRIORITY (needs-priority — slotted first) · RECOVERED-EVER-FAILED
   (presentable in the LRT remainder [R2-42] so it can earn proof; FILL-INELIGIBLE **until proven-after-fail** [r49-H4]
   — recoverable, not permanent: fail → correct-but-unproven → proof on a passing test → fill-eligible) · PROVEN-OR-NEVER-FAILED
   (fill-eligible). The word "clean" is retired.
5. **Graduation** — on the day's PASSING attempt only (fail ⇒ ZERO), with the score UNIT explicit [r49-B1]:
   `scoreFraction = clamp(scorePercent, 0, 100) / 100` (attempt scores persist as 0-100);
   `graduationCount = min( floor(queueSize_effective × scoreFraction), |correct| + |eligibleFill| )`, fill from
   fill-eligible UNPRESENTED queue words; both terms logged. Vectors frozen pre-code (AT THE DEFAULT 92 THRESHOLD — teacher-tunable per R2-26 Q3, so 91 no-passes only at default): 91→no-pass ⇒ 0; 92 @ queue
   60 ⇒ floor(55.2)=55 cap; 100 ⇒ 60 cap; malformed/missing score ⇒ attempt invalid, no graduation. **Rerun branch [R2-41(c)]: rerun review tests graduate TESTED-CORRECT only, no fill.** Graduated ⇒
   21-day rest ⇒ returns forever (unchanged; early pull-back only via the R2-41(e) underflow top-up).
6. **Gate** — `reviewPassThreshold` starts ON at 92 for every class-list at the flip; teacher-tunable per
   class-list afterward (R2-26 Q3). Dual-enrolled same-list students: per-class sessions over shared word truth
   (R2-36 accepted ambiguity), fenced by the r48 error contracts — attempts validate against their OWN class queue;
   a valid cross-class pass satisfies the shared logical day on `{uid,listId,logicalDay,resetEpoch,anchor/generation}` match [r48]; **evidence validity follows the SOURCE class's effective posture — an OFF-source auto-pass IS cross-class evidence (PROGRESS IS INDIVIDUAL; teacher escape hatch = a class-only list) [R2-38]**;
   exactly-one advance + one graduation per logical day (idempotent winner; loser `already_completed`); the student
   steers via the persisted Dashboard focus (`primaryFocusClassId/ListId`) which is NEVER server authority.

2b. **UI language [R2-44]: all NEW launch surfaces are ENGLISH-ONLY** (teacher settings, resume sheet, TOC,
   pips, grading-recovery states, wall states); Korean = vocabulary content only; existing screens untouched.

## 3. Config, kill switch, reset, recovery

- **Rules**: the labels/queues/jobs are locked by the NAMED artifact `audit/deepfix/task3/firestore.review_v2.rules` (additive lineage entry pre-R3; deploys in the dark train) [r49-B3].
- **Config**: ONE doc `system_config/review_v2` `{enabled, threshold:92, queueSize:60, testSize:30}` + per-assignment
  overrides; ONE versioned helper; per-request snapshot; attempt-time posture+configVersion stamped and governing
  through completion; cold start w/o cached posture ⇒ HOLD, mint nothing [r48].
- **Kill switch** = `enabled:false` (instant, state-preserving): fail + correct stamps keep writing; **proven
  FREEZES** (OFF auto-passes never prove); reruns follow the SAME OFF law (fail+correct write, proven freezes) [R2-41]; legacy behavior reads none of the labels (David's
  inertness premise, confirmed); re-enable resumes in place [R2-32/r48 final law]. **Per-assignment disable [FF1-14, r50-H4]: `reviewGateEnabled`
  (boolean, DEFAULT TRUE; missing/null ⇒ true); precedence: global `enabled=false` ⇒ OFF everywhere, else
  `reviewGateEnabled=false` ⇒ OFF for that assignment under this SAME label law (never overload the global field;
  never threshold-0-means-off). OFF-source attempts mint no proof but ARE cross-class completion evidence [R2-38].**
- **Reset** (`resetProgress` — student-self-service today; **redesigned to the LOCKED FENCE-FIRST law of 15_ §9
  [r55/r56]: fence (epoch bump + `resetInProgress`, BOTH tombstone docs) → reject ops while locked → stale-only
  deletes → reconcile → owner-clear w/ TTL takeover**): the labels die with the epoch ("lifetime" = one epoch). `resetEpoch` is stamped on
  queues, attempts, grading jobs, and completion requests; mismatch ⇒ reject/cancel; reset cancels pending jobs
  [r47 Q5].
- **Grading recovery** (typed): answers-on-the-job at claim (rows + full writeContext + queryable ids +
  `lastError`); one-call grade+write; write-only retry from the cached grade; "SUBMITTED — NOT YET GRADED" state
  with [Try again]/[Wait — try later]; review-first unblocking; day-advance re-grade prompt; session-start pickup
  (both branches). **Recovery window = 12 HOURS logical (server-authored `expiresAt`, checked transactionally at
  every pickup; expiry ⇒ transactional mark + redact, student takes a new test; native TTL = async physical
  backstop)** [R2-35/r48]. AI-grading calls METERED per-student + global [R2-20].

## 4. Backfill (Track B; David-authorized at execution)

FULL history (R2-3), reconstructed under **R2-35's law: unqualified recompute-at-92** — a historical correct answer
proves its word iff its attempt's stored score ≥ 92; fails/corrects backfill as facts; symmetric across all four
labels; reset-epoch-scoped. **r48's validity filter (error-fencing, NOT provenance): internally-impossible records
are EXCLUDED from all four labels, never clamped into proof** (finite score 0-100; sane totals; numerator ≤
denominator; score↔rows agreement; no conflicting duplicates) with **published exclusion counts**. Cutover per
r46-B2: durable high-watermark · idempotent replay · late-write capture · activation barrier · post-activation
reconciliation · reset/challenge/override ordering + retry semantics · expected-result equality at the watermark (Track B1's artifact = the launch baseline for wall-rate
monitoring).

## 5. Launch + verification

Delivery/choreography/cert/monitoring/rollback = **the DF2-14 card** (02_TASK_LIST): dark-deploy → verify →
backfill+delta → ONE audited flip; the 10-case dual-class oracle; the extensive Playwright suite [R2-5]; R2-18
monitoring (CS tickets = David's primary; "stuck despite ≥92%" = the shelved probe's reopen trigger); PITR enabled
pre-launch + one restore rehearsal; kill switch as above. **Dynamics re-sim [r45-H8 ⟶ recast by R2-47: the BASELINE GENERATOR + structural cyclicity fixture — no fairness oracle] runs at THE FINAL VALUES**
(60/30 · uncapped recency slots · 92 gate · full backfill under the r48 filter · three strata · per-band transition
rates) with Track B1's predicted label state as input — **a STAGE-1 FROZEN DELIVERABLE of DF2-14 [r49-H5/r50]: it must
demonstrate BOUNDED SIGHTING INTERVALS under mutable pools, size changes, the walled frozen-queue rule, and
equal/missing timestamps with the frozen tie-break** — it replaces all earlier projections (v1-v3 sims modeled
superseded policies; evidence scripts retained in `evidence/` as history).

## 6. Evidence index

`scripts/cs/graduation-validity-probe.mjs` + `evidence/graduation-validity-26SM.json` (the stratified per-band
data) · `evidence/review-pool-trajectory*.mjs` (superseded-policy sims, historical) · the r46-r48 reviews
(`docs/plans/loop/codex_reviews/`) · the panel record (`13_`) · the ledger + trace (`11_`/`12_`).
