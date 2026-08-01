# DEEPFIX 2 ADDENDUM — Review graduation redesign (10_, David-directed 2026-07-26)

> **Status: DESIGN CANDIDATE, pre-convergence** (internal 1-Fable+2-Opus panel + Codex round; then David's formal
> pick closes register item 15). This is the **resolution candidate for D-2's open clause** (task list §4 item 15 —
> prior options (a)/(a)+adaptive/(c)/(d) retained there as record) and the successor to the throttle-era review
> sizing D-1 retired. Provenance: David session 2026-07-26 (pace-matched proposal → failed-pool → label refinement),
> grounded in the trajectory sims + the 26SM graduation-validity probe.

## 1. Why (evidence)

1. **Real-scale trajectories** (`evidence/review-pool-trajectory.mjs`, real lists Base Camp 1,200w / Ascent 1,600w /
   Summit 800w at 80–100/day): the live 60-studied/30-tested caps BOUND graduation throughput — ≤ ~900 words can rest
   at once, so Ascent can never hold under ~700 active words under ANY 60-test policy; strict-30 is worst everywhere
   (Ascent@50%: 1,390/1,600 circulating).
2. **Graduation-validity probe on 26SM** (907 students, ~341k review rows — `scripts/cs/graduation-validity-probe.mjs`,
   CS-2026-07-26): proven 75.0% vs untested-aged 70.8% (Δ+4.2pp overall; per-student median +1.0pp, 53% positive) —
   **graduating long-studied untested words is NOT the invalidity**; **afterWrong 32.1%** — words answered wrong stay
   wrong ~⅔ of the time — **unrecovered-failed words are the only evidence class the data condemns**.
3. Today's mechanic (floor(segLen×score) random from segment-minus-test-failed, ANY score) excludes only same-day
   failures: an ever-failed word can graduate later via random fill without ever being re-proven.

## 2. The policy (normative)

1. **Daily review queue = pace-sized.** The day's review-study queue = `dailyPace` words (80/100), selected by
   rotating through the ACTIVE pool in position order (cursor advances daily; wraps). Replaces the pool/5 fifth-slice
   + `REVIEW_STUDY_CAP=60` as the day's review sizing. Queue = studied = graduation source (the pinned-set invariant
   "everything that graduates was studied" is preserved — the queue is pinned per day exactly as `segment.wordIds` is
   today). If pool < pace, queue = whole pool.
2. **Test = 30 words from the day's queue** (size unchanged from today's interv-0 test; a knob, §6):
   **priority slots (default 15, knob) for UNRECOVERED words, ordered `reviewFailCount` DESC**; remainder random from
   the rest of the queue. **Retakes (under the DF2-10 gate) re-serve that day's failed words first** — never a blind
   re-roll a student can luck past.
3. **Graduation on a counted test** = `floor(queueSize × testScore)` words:
   - MUST include every word answered correctly on the test (a correct answer always graduates its word);
   - MUST exclude every word answered wrong on the test;
   - remainder fills randomly from the day's queue, **drawing ONLY from words that are not unrecovered** (never-failed,
     or recovered since their last fail).
4. **Word-state labels** (on `users/{uid}/study_states/{wordId}` — no new structure):
   - `reviewFailCount` — LIFETIME count, +1 per wrong review answer, never reset;
   - `lastFailedAt` / `lastPassedAt` — stamped per wrong/correct review answer;
   - **derived, never stored: `unrecovered = lastFailedAt > lastPassedAt`** — drives fill-exclusion + test priority;
   - a correct answer graduates the word regardless of count (count stays as history); a recovered word that later
     returns from rest is fill-eligible again until it fails again.
   - **Backfill:** all three fields are derivable from attempts history (the validity probe's reconstruction is the
     backfill algorithm); existing 26SM students start with TRUE counts, not zero.
5. **Rest cycle unchanged:** graduated → MASTERED, 21-calendar-day rest, returns as NEEDS_CHECK, forever (F01
   still-retired filter untouched).
6. **Gate interaction (D-2/D-4 coherent):** gate-ON = the formula fires only on the PASSING attempt; a below-threshold
   test graduates ZERO and hits the retake wall (retake composition per §2.2). Gate-OFF = every test counts (writer
   auto-passes per D-4). OFF-posture scoping of THIS policy = register item 15's open sub-question (recommended:
   legacy graduation under OFF until per-class enablement).

## 3. Projected dynamics (evidence: failed-pool sim variant, 2026-07-26 session; assumptions §2 + sticky recovery p=0.32)

Steady/late-state ACTIVE pool (of which unrecovered) at d60, by student average — full progressions in the session
record; regenerate via the sim in `evidence/` (rule: pace-queue + failed-label):

| list | 50% | 70% | 90% | 100% |
|---|---|---|---|---|
| Base Camp @80 | 690 (350) | 564 (218) | 259 (96) | 0 |
| Ascent @80 | 1095 (422) | 965 (281) | 629 (112) | 400 |
| Summit @80 | 336 (267) | 197 (92) | 14 (9) | 0 |

Properties: self-adaptive by skill — strong students clear lists fast (fill does the volume; review ≈ same-day
formality at ~100%); weak students converge to a proof-grind (unrecovered words cycle through priority slots until
proven). **The unrecovered set does NOT stabilize by d60 at ≤70% avg** (recovery throughput = slots × 0.32 ≈ 4.8/day
vs failure inflow up to ~7.5/day at 50%) — the priority-slot count is the control knob (§6).

## 4. What this REPLACES / RIPPLES (for convergence)

| Dies | Where it lives today |
|---|---|
| pool/5 fifth-slice + `REVIEW_STUDY_CAP=60` as daily review sizing | `computeUnmasteredSegmentIds` + `studyService.js:414-435` |
| floor(segLen×score)-on-ANY-score random graduation incl. unproven fill of ever-failed words | `graduateSegmentWords` (studyService:1500-1570) |
| `REVIEW_TEST_SIZE_MIN/MAX` interventionLevel scaling (already dead per D-1) | `studyAlgorithm.js:20-21,254-260` |

Ripples: **DF2-10** (the graduation leg of the pin-move implements THIS policy once item 15 closes; retake
composition joins the retake-UX spec; the B1 `deriveNoScoreEligibility` contract [r44] must reproduce THIS queue's
effective composition once adopted) · **DF2-42d** (the rotation cursor is the INTERIM selector — G-DUE remains the
target scheduler; the addendum's fairness property (bounded sighting interval = pool/pace study days) becomes a
DF2-42d acceptance floor; mastery transitions consume §2.4's labels) · **DF2-08** (test-size + slot policy land in
the assignment-policy resolver) · **DF2-02a** (dead levers `reviewTestSizeMin/Max`: the 30-test + slot knobs are the
natural wiring target or the levers die — register item 3 rides item 15) · **messaging** (retake-wall copy cites the
per-test bar; no register-row changes beyond row-16 copy) · **DF2-35** (teacher panel may surface per-student
unrecovered counts later — out of v1 scope).

**Write-surface (NEW — needs convergence):** §2.4's labels are written per REVIEW ANSWER (today `study_states` is
written only at graduation/return). Questions the panel must rule on: (i) writer = client batch vs server inside the
attempt txn (D-3/server-authority direction says server — but that grows DF2-10's diff; alternative: client-stamped
now, server-adopted at DF2-46); (ii) rules implications (W3 attempts-lockdown lineage: `study_states` write clauses);
(iii) write volume (≈30 label merges/test — batchable in one `writeBatch`); (iv) backfill script gating (read-only
derive + David-authorized write, 25WT rehearsal first, per the one-way-door ritual it is NOT — it's additive labels,
but cohort-wide writes to 26SM need David + rehearsal regardless).

## 5. Acceptance criteria seed (for the eventual build card)

Fixtures: fill NEVER selects an unrecovered word · a correct answer graduates + stamps `lastPassedAt` regardless of
count · `reviewFailCount` never decrements · priority slots = unrecovered, failCount-DESC, capped at the knob ·
retake test serves that-day-failed first · queue = pace, rotation cursor advances/wraps, pinned per day · pool<pace ⇒
queue=pool · returns re-enter clean-eligible iff recovered · gate-ON fail ⇒ zero graduation + retake wall · gate-OFF
⇒ formula on every test (or legacy per item-15 scoping) · backfill reproduces probe-reconstructed counts on a 25WT
sample byte-exactly · label writes idempotent under attempt-write retry (D-3 alignment).

## 6. Open knobs (decide at convergence or with item 15)

1. Priority-slot count (default 15 of 30; more slots = faster recovery, harder tests — drags scores + graduation).
2. Test size 30 fixed vs scale-with-pace (30@80 tests 37% of the queue; 30@100 = 30%).
3. Workload honesty: pace-sized review DOUBLES daily study volume vs today's 60-cap (80 new + 80 review at pace 80,
   every day, plus the unrecovered grind for weak students) — David sign-off on student load is part of item 15.
4. OFF-posture scoping (item 15 sub-question, unchanged).
5. Backfill timing (with DF2-10's ship vs later; counts start true either way from attempts).
6. Recovery probability is measured cohort-wide (0.32) — per-student sims may need the student's own r; affects knob-1
   tuning only, not the design.
