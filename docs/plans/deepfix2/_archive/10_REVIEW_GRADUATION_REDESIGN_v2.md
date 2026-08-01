# DEEPFIX 2 ADDENDUM — Review graduation redesign (10_, v2 — post internal-panel fold 2026-07-26; v1 at `_archive/`)

> **Status: DESIGN CANDIDATE v2.** v1 went through the round-4 internal panel (1 Fable + 2 Opus, adversarial):
> verdicts **"not buildable as-is" / "NO-GO as scoped" / "not decision-ready"** — 5 blockers, ~15 highs. ALL folded
> here: the blockers forced (i) a pure stateless queue derivation, (ii) posture-scoping of every leg, (iii) a fixed
> `unrecovered` predicate, (iv) UNBUNDLING from DF2-10's pin-move, (v) a deadlock escape valve, and (vi) an honest
> stratified evidence section. Codex r45 reviews THIS v2. David's decisions live in §8 — item 15 closes on them.

## 1. Evidence (stratified — the cohort averages in v1 were Simpson-masked [P-2/P-5])

Probe: `scripts/cs/graduation-validity-probe.mjs` on 26SM (907 students, ~341k answered review rows; CS-2026-07-26).
Per-band (student review accuracy, n≥30 rows; 844 banded):

| band | students | proven | untested-aged (what fill trusts) | Δ | afterWrong (= recovery p) |
|---|---|---|---|---|---|
| <50% | 130 | 44.5% (n=4,540) | **24.0%** (n=1,832) | **+20.6pp** | **21.3%** (n=18,521 — BELOW the 25% MCQ chance floor) |
| 50–70% | 61 | 64.2% | 53.8% | +10.3pp | 50.3% |
| 70–85% | 78 | 83.0% | 74.7% | +8.3pp | 68.9% |
| 85%+ | 575 | 96.5% | 94.9% | +1.7pp | 88.2% |

Honest read: **graduating untested words is harmless for the 85%+ majority and materially invalid for the ≤70%
strata (~23% of banded students)** — the cohort +4.2pp average is dominated by the 575 strong students. The weak
band's 21.3% "recovery" is at/below MCQ chance: wrong words show ≈no learning signal there without intervention.
Standing caveats: observational; graduation events themselves unrecoverable (picks unlogged, `masteredAt` nulled on
return); challenge-adjudicated answers read post-flip; "untested" = untested-in-review (new-word test outcomes not
classed). Trajectory evidence: `evidence/review-pool-trajectory.mjs` (rules c0/a/aAd/a60/b) + **`evidence/
review-pool-trajectory-pf.mjs` (THIS design — committed for reproducibility [P-4])**.

## 2. The policy (normative, v2)

1. **Queue — PURE, stateless, pace-sized [F-1/S-10 fix].** The day's review queue = `pace` words from the
   position-ordered ACTIVE pool, selected by a **pure function of the day**: `start = ((currentStudyDay − 1) × pace)
   mod pool.length`, take `min(pace, pool.length)` wrapping. NO stored cursor: every surface (DSF, MCQTest,
   TypedTest, and the server's B1 `deriveNoScoreEligibility`) re-derives the identical queue from
   (currentStudyDay, pool snapshot), exactly as today's slicer is a pure function of the day — same per-class
   `currentStudyDay` over the per-user+list pool and same `resetEpoch` semantics as today. The queue is PINNED per
   day in session config (the `segment.wordIds` mechanism, unchanged). **Invariant [F-9/P-12]: graduates ⊆ tested ⊆
   queue ⊆ studied — the same-day failed-NEW prepend stays study-only OUTSIDE the queue (never tested/graduated/
   counted in `queueSize`), exactly as today (DSF:505-527).**
2. **Test = 30 from the queue**, priority slots (default 15 🧭) for UNRECOVERED words **ordered `lastFailedAt` ASC
   (oldest failure first — bounded wait per word [S-7/P-9]; `reviewFailCount` is analytics/teacher surface ONLY,
   never ordering)**; remainder random from the rest of the queue. **Retakes under the gate are NOT
   strictly-harder [P-1]: failed-first capped at the slot ratio, remainder drawn from that day's answered-correct +
   clean words; plus the ESCAPE VALVE (§8-1): after N failed retakes (default 3) the day completes WITHOUT
   graduation, holdReason `review_retake_exhausted` (server-owned, teacher-visible, joins H4's vocabulary) — no
   standstill, no evidence minted.**
3. **Graduation on a counted test = `min( floor(queueSize × testScore), |correct| + |eligible clean fill| )`
   [F-10/S-15/P-7 — the clamp is explicit; BOTH terms logged so the soak can tell a supply floor from a bug].**
   Include every correct answer; exclude every wrong answer; fill only from non-unrecovered untested queue words.
   Note [P-3]: priority slots depress `testScore` for weak students by construction (the test carries their hard
   words); the feedback IS modeled in the pf sim (observed score drives the formula) and is intended — unproven
   volume shrinks exactly when proof is failing.
4. **Labels** on `users/{uid}/study_states/{wordId}` (fields additive; existing per-answer writers inventoried §4):
   - `reviewFailCount` — lifetime, +1 per wrong review answer, never decremented (adjudication annotates, §4);
   - `lastFailedAt` / `lastPassedAt` — stamped per wrong/correct review answer;
   - **`unrecovered` (derived, never stored) = `lastFailedAt` EXISTS ∧ (`lastPassedAt` ABSENT ∨ `lastFailedAt` >
     `lastPassedAt`)** — [S-2 fix: a never-passed failed word IS unrecovered];
   - **challenge/override adjudication hook [F-3]:** an accepted challenge stamps `lastPassedAt` at adjudication
     time (mirror of the existing `status: PASSED` stamp, foundation.js:2642-2647) + a `challengeReversed`
     annotation; backfill-equivalence criteria apply to unadjudicated answers only;
   - **post-return stickiness 🧭 (§8-2, [P-6]):** (a) a single correct clears fill-eligibility (simple;
     chance-vulnerable on 4-option MCQ) vs **(b) an ever-failed word stays fill-EXCLUDED in every later cycle — after
     each 21-day return it graduates only by direct proof [RECOMMENDED — targets the 21.3%-at-chance band]**.
5. **Rest cycle unchanged** (21-day MASTERED rest → NEEDS_CHECK forever; F01 filter untouched).
6. **Posture scoping [S-1 fix — was a blocker]: ALL redesign legs (queue size, test composition, label BEHAVIOR,
   graduation formula) key to ONE per-class enablement flag.** Disabled ⇒ byte-identical today-behavior (slicer,
   30-random test, legacy graduation). No leg is posture-independent; the D-2 minimal rule (gate-ON fail ⇒ zero
   graduation) ships with DF2-10 regardless (§5). Label WRITES may accrue dark ahead of enablement (additive fields,
   no reader) — stated per §4's writer decision.

## 3. Dynamics (reproducible: `evidence/review-pool-trajectory-pf.mjs`)

d60 ACTIVE pool (of which unrecovered), sticky recovery p=0.32 cohort / see per-band caveat (rerun-able:
`node review-pool-trajectory-pf.mjs [rFail]`): BC@80 50%→701 (312) · 70%→571 (136) · 90%→278 (32) · 100%→0;
Ascent@80 50%→1,121 (377) · 100%→400; Summit@80 50%→397 (252) · 90-100%→0-80 waves.
**Divergence honesty [S-6]: the unrecovered set does NOT stabilize by d60 at ≤70% avg — that is ~23% of the banded
live cohort, and their true recovery p is ~0.21-0.50, worse than the sim's 0.32 cohort constant. Therefore
enablement REQUIRES a per-class staged rollout with a CIRCUIT BREAKER: abort/disable signals = per-student
unrecovered-set growth rate ∨ `review_retake_exhausted` rate ∨ review-score trend ∨ label-write failure rate —
these join the delta-scoped soak list of whatever card ships it.**

## 4. Write surface — CORRECTED inventory [F-2/S-8: v1's premise was false] + requirements

**Today's per-answer writers already exist:** `processTestResults` (studyService:763-799) writes `status
PASSED/FAILED`, `timesTestedTotal`/`timesCorrectTotal` (increment), `lastTestedAt`, `lastTestResult` per answered
word as a CLIENT writeBatch after EVERY test (MCQTest:779-790 / TypedTest:~806) — with failures caught and
SWALLOWED after the attempt is durable; plus `updateQueueTracking` (:811-827), `initializeNewWordStates`, and the
server-side challenge stamp (foundation:2642-2647). The labels are therefore an EXTENSION of an existing per-answer
write path, not a new one — and they duplicate part of `lastTestResult`'s information, so a **field-precedence rule
is required** (labels are authoritative for recovery/fill; `lastTestResult` stays legacy-informational until DF2-46
consolidates).

**Requirements (preconditions, not open questions [F-4/F-5/S-9]):**
1. **Label integrity = server-write-only**: a rules clause (DF2-44 lineage) denies client writes to the label
   fields; the label mutation binds to ATTEMPT-DOC CREATION (inside `writeAttemptTxn`'s created-once branch —
   D-3-aligned, idempotent under retry by construction; the client-batch option is acceptable ONLY dark/advisory
   pre-enablement, with an attemptId-keyed ledger for idempotency [F-5]).
2. **No swallowed failures once labels are behavioral**: a failed label write on an enabled class is surfaced +
   retried, never dropped (the current catch-and-continue is only acceptable while labels are dark).
3. **Composition trust**: test composition (priority slots) is client-built today (selectTestWords in the test
   pages); under the gate the server must either VERIFY composition from the attempt's word set vs its own derived
   queue/labels, or the plan explicitly accepts a client-trust posture — "a client assertion is never proof" [B1]
   applies. Tamper fixture required (§7).
4. **Backfill = a real write plan [S-4/S-5/F-6], not "run the probe":** resetEpoch-scoped replay ·
   adjudication-aware · `listId` keying verified against `study_states` docIds · concurrency freeze or
   idempotent-resume · pre-image backup · 25WT rehearsal · David authorization (cohort-wide 26SM writes). **Day-1
   shock 🧭 (§8-3): full-history backfill seeds ~tens of thousands of unrecovered words (79,201 wrong review answers
   on record; 613/907 students ≥1) — options: (a) full history · (b) start labels EMPTY (no shock; history accrues
   forward) · (c) counts backfilled, unrecovered seeded only from the last K days [RECOMMENDED (b) or (c)].**

## 5. Staging — UNBUNDLED from DF2-10 [S-3 fix — was a blocker]

DF2-10 ships exactly as carded in the plan of record (gate + kill switch + D-1 throttle retirement + B1 hardening +
R8 stamp), with the **minimal D-2 leg only**: gate-ON fail ⇒ zero graduation; graduation mechanics otherwise legacy.
**This addendum becomes its OWN build card (proposed DF2-14) with its own deploy + cert + soak, sequenced after
DF2-10 settles, enabled per-class behind §2.6's flag with §3's circuit breaker.** Known skew note [S-11], now
DF2-10's to carry: during DF2-10's cached-bundle window an old client can run legacy any-score graduation on an
attempt the server walls — bounded by the immediate hosting deploy, self-healing (wrongly-rested words return in
21d), fixtured, teacher override unaffected.

## 6. Workload + comms (corrected numbers [S-14/P-8]; comms leg required [S-13/P-11])

Per-stratum review-leg change at pace 80: large pools 60→80 (+33%); SMALL pools up to ×4-5 (min(pool,pace) replaces
min(pool/5,60): a 100-word pool jumps 20→80); total daily items ≈ +9-14% for most. David signs off on THESE numbers,
not v1's "doubling". **Comms leg (new, required):** bilingual student/TA explainer for the new review mechanics +
the retake-exhausted message (a NEW register row — v1's "no register-row changes" claim is withdrawn) + teacher
surface: per-student unrecovered counts and the escape-valve visibility fold into DF2-35's follow-through when
DF2-14 ships; timing coordinated with DF2-07(e)'s deletion of the old review copy (no explanation gap on enabled
classes).

## 7. Acceptance criteria seed (v2)

All v1 fixtures, PLUS: unrecovered predicate truth-table incl. absent-`lastPassedAt` [S-2] · clamp fixtures with
both terms logged [F-10] · adjudication transitions (challenge accept ⇒ lastPassedAt stamp; failCount never
decrements; `challengeReversed` present) [F-3] · queue-derivation EQUALITY across DSF/MCQ/Typed/server for the same
(day, pool) [S-10] · escape valve: N fails ⇒ `review_retake_exhausted`, no evidence minted, day completes [P-1] ·
tamper: client-minted `lastPassedAt`/zeroed count REJECTED by rules [S-9] · label idempotency under attempt retry
(bound to created-once) [F-5] · backfill equivalence on unadjudicated answers, resetEpoch-scoped, 25WT sample [F-6]
· circuit-breaker signals emit [S-6] · disabled-class byte-identity (slicer/test/graduation) [S-1].

## 8. Open decisions 🧭 (David — these close item 15)

1. **Escape valve**: N failed retakes ⇒ `review_retake_exhausted` day-completion-without-graduation (default N=3)
   — accept shape + N? (The alternative — an unpassable wall for the ≤50% band — is the #11 deadlock class.)
2. **Post-return stickiness**: (a) one correct clears vs **(b) ever-failed words graduate only by direct proof in
   every cycle [RECOMMENDED]**.
3. **Backfill**: (a) full-history / **(b) start empty / (c) bounded last-K-days seed [RECOMMENDED (b) or (c)]**.
4. **Priority-slot count** (default 15 of 30) + test size 30 (fixed vs scale-with-pace).
5. **Per-class enablement order** for DF2-14 (suggest: pilot the 85%+ -heavy classes first — lowest divergence risk,
   then weak-band classes once the circuit breaker has data).
6. Inherited: item-15 OFF scoping (moot for the redesign under §2.6's flag — the flag IS the scoping; confirm).
