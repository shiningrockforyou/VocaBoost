# DEEPFIX 2 ADDENDUM — Review graduation redesign (10_, v3 — post David decision round 2; v1/v2 at `_archive/`)

> **Status: DESIGN v3 — David's round-2 decisions folded (11_ §1 R2-1..R2-17 is the decision ledger; where this doc
> and the ledger disagree, the LEDGER wins).** v2's panel-driven structure survives; v3 replaces the pace-matched
> queue with TEACHER-SET sizes, sets the LAUNCH POSTURE (gate ON at 92%, all-at-once), and lands the final label
> semantics (asymmetric stamping, blank=fail, uncapped rotation slots). Remaining opens: R2-15's ordering nod +
> R2-10 (challenge-reversal, after A2). Verification tracks + convergence per 11_ (Tracks A/B/C, 🔍6 roster).

## 1. Evidence (stratified — unchanged from v2)

Probe (`scripts/cs/graduation-validity-probe.mjs`, 26SM, 907 students, ~341k review rows; CS-2026-07-26), per band:
<50%: proven 44.5% vs untested-aged 24.0% (Δ+20.6pp), afterWrong 21.3% · 50-70%: Δ+10.3pp, afterWrong 50.3% ·
70-85%: Δ+8.3pp · 85%+ (575 students): Δ+1.7pp, afterWrong 88.2%. Read: unproven graduation is harmless for the
strong majority, materially invalid for the ≤70% strata; wrong words stay wrong without intervention. Caveats: 
observational; graduation events unrecoverable; "untested" = untested-in-review; per-band accuracy pending a
testType stratum [r45-M9 — "chance floor" claim withdrawn until then]. Trajectory sims: `evidence/
review-pool-trajectory*.mjs` — **NOTE: the pf sim models the SUPERSEDED pace-sized queue; the seeded sensitivity
re-run at the REAL values (60/30, uncapped slots, 92% gate) is queued [r45-H8] and re-grounds §3.**

## 2. The policy (normative, v3)

1. **Daily review queue — teacher-set, rotation-selected [R2-4].** Per-assignment `reviewQueueSize` (launch default
   60) words selected from the ACTIVE pool by the pure day-offset rotation (start = ((studyDay−1) × queueSize) mod
   pool.length, wrap; pinned per day via the existing `segment.wordIds` mechanism; re-derivable by every surface +
   the server's B1 `deriveNoScoreEligibility`). If pool < configured size, queue = whole pool. Invariant: graduates
   ⊆ tested ⊆ queue ⊆ studied (same-day failed-NEW prepend stays study-only outside the queue). Labels do NOT
   influence queue membership — rotation fairness is label-blind (bounded sighting interval preserved).
2. **Test — teacher-set size (launch default 30), UNCAPPED priority slots [R2-15]:** the test fills with as many
   FLAGGED (unrecovered) words as today's queue contains — up to the whole test; remainder random from the queue's
   clean words. Ordering [pending R2-15 nod]: **least-recently-tested first** among flagged-in-queue → consecutive
   tests rotate through the entire difficult backlog before repeating; recovered words drop out visibly per retake;
   presentation shuffle retained. Retakes draw from the SAME pinned day-queue (restudy available between attempts).
   Small pools accepted as-is (a 4-word test at the gate is "restudy 4 words" — R2-4; no minimum-count exemption).
3. **Graduation on the day's PASSING attempt** = `min( floor(queueSize_effective × testScore), |correct| +
   |eligible clean fill| )` — include every correct answer; exclude every wrong-or-blank word; fill only from clean
   (never-failed-unrecovered), UNPRESENTED queue words. Both terms logged (supply-floor vs bug distinguishable).
   A FAILED attempt graduates zero (D-2); retake until pass or teacher force-pass.
4. **Labels** on `study_states/{wordId}` (server-written, bound to attempt creation — §4):
   - `reviewFailCount` (lifetime, analytics-only since ordering is recency-based) · `lastFailedAt` · `lastPassedAt`;
     derived `unrecovered = lastFailedAt exists ∧ (lastPassedAt absent ∨ lastFailedAt > lastPassedAt)`.
   - **Asymmetric stamping [R2-16]:** `lastFailedAt` stamps per wrong-or-BLANK presented word on ANY graded attempt
     [R2-17: blank = fail; the submission carries the PRESENTED word set — shared with the composition-verification
     field]; **`lastPassedAt` stamps ONLY from the day's PASSING attempt** (+ accepted challenge per R2-10's pending
     rule; force-pass stamps nothing) — recovery is un-guessable; guess-spam can add only truthful flags (bounded by
     the day's ≤60 queue) and can never launder.
   - **Sticky (b) [R2-2]:** an ever-failed word graduates only by direct proof in every cycle — the `fillEligible`
     predicate excludes ever-failed-unrecovered words from fill permanently (per-cycle re-proof; exact
     effective-history rule incl. challenge reversals = R2-10 + r45-H7, closes after A2).
   - Backfill: FULL history [R2-3], reconstructed from attempts under the SAME asymmetric rule (pre-gate reviews all
     auto-passed ⇒ historically benign), via Track B's converged pipeline.
5. **Rest cycle unchanged** (21-day MASTERED rest → NEEDS_CHECK forever; returns processed at session init).
6. **Launch posture [R2-14/R2-5/R2-6]: ALL-AT-ONCE, GATE ON.** One global config doc `system_config/review_v2`
   {enabled:true, threshold:92, queueSize:60, testSize:30} — David pre-sets via fireadmin before deploy; per-
   assignment fields override where teachers later edit (same class-list menu, simplified per R2-15); `enabled:false`
   = the instant cohort-wide kill switch. The review-pass gate STARTS ON at 92% for every class (supersedes the
   default-OFF posture). Engagement is RETIRED as a completion criterion [R2-11]. LAUNCH BLOCKERS (same release):
   teacher force-pass UI · teacher/TA comms (wall + button + new review mechanics) · day-one monitoring sized for
   mass wall events · the extensive Playwright rehearsal suite [R2-5].

## 3. Dynamics — STALE pending re-sim [r45-H8 + R2 values]

v2's projections modeled pace-sized queues; with teacher-set 60/30 the daily volumes match today's caps (the
workload cliff DISSOLVES — day one changes composition, not volume) and pool dynamics differ. The seeded
sensitivity run at the real values (queue 60 · test 30 · uncapped recency slots · 92% gate ON · full backfill ·
sticky (b) · blank=fail) replaces this section before DF2-14 carding; its per-band inputs use the stratified
transition rates (§1), not the cohort 0.32.

## 4. Write surface + integrity (v2's corrected inventory stands; deltas)

Per-answer writers inventoried in v2 remain accurate. Requirements: label mutations SERVER-written inside the
attempt txn's created-once branch (idempotent under retry — verified return-not-rewrite branch) · rules clause
(DF2-44 lineage) denies client label writes · composition trust: the submission's presented-set + slot composition
validated server-side against the derived queue/labels [r45-M10; same field as R2-17's blank stamping] · no
swallowed failures once labels are behavioral · challenge adjudication stamps per R2-10's outcome · force-pass
writes grade + `teacherEdited` label ONLY (no word statuses, no graduation, resolver-guarded per 11_ A1(vii-ix)).
Backfill = Track B's converged pipeline (expected-result calculation first; full history; freeze/idempotent-resume/
backup/25WT rehearsal/David go).

## 5. Staging

DF2-10 ships the gate machinery at the R2-14 launch posture (ON@92 via the config doc; kill switch; force-pass;
engagement retirement; minimal D-2). **The redesign legs (queue/test sizing, slots, labels, graduation formula,
backfill) = DF2-14, its own card + deploy + cert + soak, after DF2-10 settles** — with the all-at-once flip at
DF2-14's deploy (config pre-set; activation = the deploy; kill switch = revert). r45's surviving staging gates
apply (DF2-12/13 durable write paths, DF2-44 rules clause, cached-client behavior; B1 queue identity via §2.1's
pure derivation + pinned-set validation at attempt/completion).

## 6. Open items

R2-15 ordering nod (least-recently-tested) · R2-10 challenge-reversal (after A2) · the §3 re-sim [H8] · Track A/B/C
execution + the 🔍6 convergences per 11_.
