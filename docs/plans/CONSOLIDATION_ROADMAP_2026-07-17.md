> ⚠️ **SUPERSEDED 2026-07-17 by `CONSOLIDATED_ROADMAP_2026-07-17.md`.** This effort ran on a FALSE premise
> ("deepfix undeployed; prod = 14e49a4"). VERIFIED live: client `4b8452a` + deepfix functions are DEPLOYED
> (functions dormant behind false flags); P0/P1/P2 are live. The investigation findings (12 concepts, invariant
> register, the CS-PR reconciliation) remain valid and are carried forward; the deploy-baseline + sequencing are
> corrected in the superseding doc. Kept for the investigation record only.

# VocaBoost Consolidation Roadmap — Effort (shared input)

**Goal:** a strategic, incremental (strangler-fig) roadmap to consolidate the app's divergent domain logic into
single sources of truth — so the class of bug behind today's CS tickets (parts of the app disagreeing about a
simple fact) becomes structurally impossible. The locked CS fixes (`CS_2026-07-17_ROOT_CAUSE_EFFORT.md`, PR-1/2/3)
are the FIRST increments of this roadmap; the roadmap must build ON them, never conflict.

**Methodology (same as the CS effort):** 3 Fable agents per phase (investigation plan → investigate → implementation
plan/roadmap), orchestrator verifies every claim against code/live data and converges. NO codex.

## Diagnosis (orchestrator, verified against code)
It is NOT "spaghetti" (there's careful defensive engineering: reconciliation layer, flag-gating/Run-L byte-equivalence,
the `DailySessionFlow.jsx:816-828` "attempts are the sole authority" doctrine). The real, named problems:
1. **Divergent duplication / missing single source of truth:** "did you finish day N's review?" is defined ~4 ways
   (`studyService.js:240/279`, `db.js:3726`, `foundation.js:568`, session_state) that have DRIFTED.
2. **Shotgun surgery:** one concept (throttle) lives in 5+ sites (`studyAlgorithm.js`, `db.js:3033`, `foundation.js:307/912/1115/1859`)
   → the CS plan needed a "multi-writer completeness table" to avoid regressions.
3. **Inconsistent state ownership:** throttle is recomputed every session (`studyService.js:325`) yet also read from the
   stored field (`db.js:3033`) — is it derived or stored? The ambiguity IS the whack-a-mole bug.
4. **Three sources of truth for progress:** `attempts` (event log), `class_progress` (projection), `session_states`
   (sticky note) — readers bypass the reconciliation "projection builder" and consult whichever is nearest.

## Candidate consolidation targets (to validate/refine in the investigation)
- **Review-pairing** — one `reviewPairsWithAnchor` (CS plan already locks the definition; make ALL readers adopt it).
- **Day-completion** — one `isDayComplete(day)` that reconciliation, `determineStartingPhase`, the re-entry gate, and
  the challenge-accept path all call (kills the I3/I4 "two components disagree" class).
- **Throttle-mode** — one `deriveThrottleMode` + one owner + one stored bit (CS PR-3); retire the 5-site duplication.
- **Session-phase / lifecycle** — model the phases + transitions as one explicit state machine; stop routing off the
  session_state sticky note (honor the `:816-828` doctrine everywhere).
- **State ownership** — make `class_progress` a pure projection of `attempts`, rebuilt by ONE builder; `session_states`
  is display-only. (attempts = event log; class_progress = materialized view.)

## Constraints for the roadmap
- Strangler-fig ONLY (wrap → migrate call sites behind a flag → prove byte-equivalent → delete old). **NO big-bang rewrite.**
- Every step independently shippable + reversible (flag flip), mirrored across the dormant client/server (`foundation.js`)
  so the future P4 server cutover can't reintroduce drift.
- Compatible with the locked CS PR-1/2/3 sequence and the deepfix P0–P10 program (`audit/deepfix/MASTER_TASK_PLAN.md`).
- Ground every claim in real `file:line`; read-only.

---
<!-- PHASE 1 / 2 / 3 OUTPUTS appended below as the effort converges -->

# PHASE 1 OUTPUT — Converged Investigation Plan (3 Fable agents CR-A/B/C + orchestrator verification)

**Convergence: CR-A (concept inventory), CR-B (sequencing/safety), CR-C (adversarial) agree on method; CR-A widened the
concept list 5→12, CR-C supplied the invariant register + baseline reframe. Orchestrator verified all load-bearing claims.**

## Orchestrator verification stamp (re-read at HEAD 4b8452a, 2026-07-17)
- **Doctrine is at `DailySessionFlow.jsx:816-828`** ("ATTEMPTS ARE THE SOLE AUTHORITY"); `db.js:808-830` is assignment-write
  code (corrected the shared doc). ✓
- **HEAD `4b8452a` = "deepfix P0–P10 staged, Codex-converged", UNDEPLOYED**; prod runs `14e49a4` (deploy commit a967f54).
  Every byte-equivalence claim is vs the DEPLOYED artifact, not HEAD. ✓
- **CS PR-1/2/3 flags ABSENT from tree** (`grep` = 0) — designed, not written. ✓
- **#10 re-mint:** routing all readers through the reconciling builder re-introduces the self-race; `MCQTest.jsx:761-763`
  deliberately uses non-reconciling `getClassProgress` under `LIST_SCOPED_RECON`. ✓
- **"review always passes" ≥4 sites**: `MCQTest.jsx:537`, `TypedTest.jsx:832`, `db.js:2917`, `functions/index.js:403`
  (live) [+ dormant `foundation.js:2252`]. ✓

## THE REFRAME (critical, verified) — the consolidation is already substantially staged
There are **THREE layers**, not a greenfield baseline:
1. **Deployed prod = `14e49a4`** (has: LIST_SCOPED_RECON on, #9 cross-class fix, #10 non-reconciling read).
2. **Staged in HEAD `4b8452a`, UNDEPLOYED = the deepfix P0–P10 program** — the ONE server-authoritative `list_progress`
   migration (server surface `foundation.js` → client cutover → data migration → rules cutoff → retire). **This IS the C5
   state-ownership consolidation** (class_progress → a single canonical projection with one server builder). Most of what the
   agents call "dormant `foundation.js` mirror" is this staged, awaiting-deploy work.
3. **CS PR-1/2/3 = designed, unwritten** — the predicate-consolidation increments (C1 pairing, C3 throttle, C2/C10 completion).
⇒ The roadmap is a SEQUENCING problem across three layers, not a from-scratch design: **land the staged deepfix → ship the CS
PRs → do the remaining domain-logic unifications (C2 day-completion, C4 session state-machine, C6–C11) on the now
server-authoritative base.** A naive "rewrite to one source of truth" would fight a migration that's already ~80% built.

## Converged concept list (12 domain facts; Phase 2 builds one dossier each, ranked by a D1–D5 drift scoreboard)
Core (shared-doc 5, all confirmed): **C1** review-pairing · **C2** day-completion + day-guard · **C3** throttle/intervention
mode · **C4** session phase/lifecycle · **C5** progress-state ownership (SIX stores, not 3: attempts, class_progress,
session_states, sessions-history, sessionStorage.dailySessionState + localStorage recovery, dormant list_progress/progress_meta).
Extended (CR-A, verify each): **C6** anchor selection & validity (≥5 selectors, 4 validity defs) · **C7** attempt day-stamping
(the write-time minter of pairing failures; test pages derive their own studyDay) · **C8** pace & allocation (3 pace
conventions incl. challenge-accept's divergent `assignment.pace`-as-daily `db.js:3037`) · **C9** review-only-day (3-reason
predicate) · **C10** pass-semantics & score-units ("review passes" ≥4 sites; 0–1 vs 0–100 duality; I6 clamp) · **C11** streak
(deliberate client-local vs KST divergence). **C12** word-mastery/segment selection = the CONTROL — already consolidated via
choke-points (`studyAlgorithm.js:372-401`, `studyService.js:611/696/1448/1517`); use it as the "done right" template.

## Converged investigation methodology (Phase 2 = 5 workstreams over the 12 concepts)
- **WS-1 Dependency graph** (CR-B): per-concept complete reader/writer/mirror census (LIVE|dormant|flag); derive edges
  (predicate / write-shape / flag dependency); answer "can day-completion unify before pairing?" (hypothesis NO — built on C1)
  and "does the state-machine need throttle as a single bit first?" (hypothesis YES).
- **WS-2 Blast-radius scorecard** (CR-B): per candidate step — call-site count (live/dormant), write-path touch, flag-wrappability
  (byte-equiv), rollback tier T0–T3, data-shape delta, deploy surface; + retirement blast radius; + live-data disagreement census.
- **WS-3 Flag surface** (CR-B): full catalog (10 client + 11 server, only SERVER_ATTEMPT_WRITE + LIST_SCOPED_RECON live);
  how Run-L byte-equivalence is proven today (M-STATIC/diff harness); flag-lifecycle rules; retirement shortlist.
- **WS-4 Compatibility constraints** (CR-B): file×program overlap matrix vs {CS PR-1/2/3, deepfix P0–P10}; the mirror-parity
  obligation per step; specific conflicts (state-ownership vs P5 LIST_PROGRESS_CANONICAL; state-machine vs P2/resolveListProgress;
  day-completion vs P4's dormant readers `foundation.js:615/638` that go live at cutover; throttle vs P9 cycling lap-reset).
- **WS-5 Gates & metrics** (CR-B): the per-step gate ladder — G-BYTE (flag-off diff), G-CENSUS (offline replay w/ numeric
  criteria, `census-i4-pairing.mjs` precedent), G-INVARIANT (Track-1 register), G-PARITY (client↔foundation fixture diff),
  G-SOAK (system_logs deltas), G-FLAGTABLE. Investigate exists-vs-must-build for each.
- **Per-concept DOSSIER schema** (CR-A): row-per-site {file:line · DEFINE/READ/WRITE/MIRROR · store · liveness triple · scope ·
  exact predicate variant · consumers} + drift metrics **D1** definition count · **D2** reader fan-out · **D3** bypass rate ·
  **D4** empirical disagreement (live 26SM read-only) · **D5** mirror fidelity. + 4 cross-cutting censuses (store, flag-branch,
  bypass, CS-script-mirror).

## HARD CONSTRAINTS Phase 2 & the roadmap MUST respect (CR-C invariant register, verified)
1. **class_progress is NOT a pure attempts-projection.** `streakDays` (path-dependent on policy history), `reviewMode`
   (hysteresis), `recentSessions` (session-only fields), `blindSpotCount` (from study_states) are NOT attempts-derivable. The
   "pure projection" target must be narrowed to csd/twi (the only cleanly-derivable fields); everything else needs an event/cache
   discipline. Field-derivability audit is Phase-2 task #1.
2. **The non-demoting ratchet hides ~3,400 unpairable legacy reviews.** A from-scratch projection has no `storedCSD` to
   `Math.max` against → mass csd DEMOTION. Quantify cohort-wide (read-only) before any projectionization; decide the
   replacement high-water-mark.
3. **"One reconciling reader" re-mints #10** (verified). A sanctioned non-reconciling read must survive, or completion must
   become idempotent-by-design.
4. **Two facts, not one:** "day is complete" ≠ "day advances the counter" (throttle-hold vs list-end advance, #11/#16).
5. **Projectionization sequences AFTER/WITH the attempt-write lockdown** — attempts are forgeable today (residual client
   writers `db.js:1242/1397`, automarker `DailySessionFlow.jsx:962`); making them the sole truth concentrates the forgery surface.
6. **Frozen interfaces:** `system_logs` event names/payloads (18 types) and the 31 CS scripts that read class_progress are
   ADDITIONAL callers of every predicate — a consolidation that renames/relocates a predicate or event silently breaks ops.
7. **Deliberate duplicates NOT to unify yet:** flag-off legacy branches (retire the flag first); `interventionLevel` kept as a
   derived {0,1} compat field post-PR-3; `passed` vs `isEngagedReview`; the THREE csd write policies (one function, distinct reasons).
8. **apBoost verified isolated** — no `src/apBoost` file imports vocaBoost services → consolidation doesn't touch it.

## Phase-2 execution (3 Fable agents, split per CR-B's note)
- **Agent D:** WS-1 + WS-2 (dependency graph + blast-radius scorecard) over C1–C5 (the core), consuming the dossier schema.
- **Agent E:** WS-3 + WS-5 (flag surface + gate ladder) + C6–C11 dossiers (the extended concepts).
- **Agent F:** WS-4 (compatibility vs deepfix P0–P10 + CS PRs + mirror parity) + the CR-C Track-1 invariant register +
  Track-4 migration hazards, running the READ-ONLY live-Firebase censuses (field-derivability, ratchet-demotion, unpairable
  cohort-wide, manual-write audit). 26SM read-only; sandbox for anything else.
Orchestrator verifies every dossier row's file:line + every D4 census against live data, then converges → Phase 3 (the roadmap).

# PHASE 2 OUTPUT — Converged Investigation (3 Fable agents D/E/F + orchestrator LIVE verification)

**Convergence: D (dependency graph/blast-radius), E (flag surface/gates/C6–C11), F (compatibility/invariants/live censuses)
align. Orchestrator independently RE-RAN F's two urgent live censuses; syslogs matched to the digit, demotion reconciled below.**

## Orchestrator LIVE verification stamp (read-only, 2026-07-17)
- **#10 self-race is LIVE at cohort scale — CONFIRMED EXACTLY:** `day_guard_rejected_session_cleared` = 124 events, ALL in
  last 14d, 28 users → **23 real 26SM students across 12 classes** (미주 Final, 유라시아 Top/Core, Inter A1/A2/A3/E, Adv A1/A2,
  Final A, 제주 TOP). `NEED_TO_FIX #10` ("5 all-time, all sandbox") is STALE. Onset ≈ the 07-12 LIST_SCOPED_RECON flip.
  **The committed fix is in the staged deepfix (P1 bundle) — undeployed.**
- **`impossible_phase_detected` firehose — CONFIRMED:** 19,642 total / 11,445 (14d) / 7,086 (7d), all `day1_with_passed_new_test`
  (payload has no userId — Dashboard-emitter noise; retired by P4's resolver read). Do NOT build metrics on it.
- **Ratchet-demotion — qualitatively confirmed, magnitude RECONCILED DOWN:** my direct census over ACTIVE 26SM primary docs
  (359 started) = **14 demote under P0 (3.9%), 5 under V2 (1.4%), 0 deep**. F's 103/23 spans ALL class_progress docs
  (incl. secondary/stale) over 1,116 pairs. Both agree: **naive pure-projection rebuild DEMOTES real students; V2 is ~3–4× safer
  than P0; the non-demoting ratchet must survive** (my 07-12 relief already pulled the worst runaway primaries down → active harm
  is ~5, not 23). Cohort-wide unpairable = 35.5% (F) generalizes the 26SM 34.5%; V2 pairs 92.2%.

## Verified drift picture (the 12 concepts)
- **C1 pairing:** D1=4 in-app definitions; 2 of 3 live readers bypass the authoritative exact-range def (`studyService.js:240`
  day-only, Dashboard via same). Locked V2 predicate empirically drains 13/14 stuck, pairs 92.2% cohort-wide, 0 false-pairs.
- **C2 day-completion:** 6 live definitions using 3 different review predicates; must return TWO facts ("complete" ≠ "advances").
- **C3 throttle:** the split-brain is symmetric — init recomputes (ignores stored), challenge-accept trusts stored;
  `interventionLevel` recompute==stored 60/60 sampled (stored is a write-only cache).
- **C4 lifecycle:** 3 phase vocabularies + a DEAD 7-export transition API (free deletion); `session_states` routing violates the
  `DailySessionFlow.jsx:816-828` doctrine at exactly 2 sites (I3).
- **C5 ownership:** SIX stores; **5 live csd writers** (D found the retake-rewind restore `MCQTest.jsx:960`/`TypedTest.jsx:1261` +
  the ops channel beyond the known 3). Field-derivability: ONLY csd/twi cleanly attempts-projectable; `streakDays`/`reviewMode`/
  `recentSessions`(session-fields)/`blindSpotCount` need event/cache discipline.
- **C6–C11 (E):** anchor selection = 7 rules / 6 validity defs; day-stamping = 4 rules (server trusts client stamp); pace = 4
  conventions w/ 3 defaults (80/20/undefined — same fact, 4× divergent); "review always passes" = 6 sites; pass-threshold 95/92/0.95;
  score-unit duality + `toFraction` unit-sniffing (`s>1?s/100:s`) live ambiguity; streak client-local vs KST (deliberate).
- **C12 CONTROL confirmed consolidated** (`studyAlgorithm.js:372-411` choke-points, one store, one writer per transition, pure
  fns, ZERO server sites) — the template properties to copy.

## Flag surface & proof machinery (E, verified)
- **Server surface is 17 flags, not 11** (11 FOUNDATION_FLAGS + 6 in `functions/index.js`: GRADE_TOKEN_ENFORCED/MINT/JOB, LEASE,
  TEACHER_PROVISIONING/CLAIM). A "flip table" keyed to 11 silently omits the grade/teacher flags gating P6/P10 rules.
- **Run-L byte-equivalence** is proven by: authoring discipline + M-STATIC (`lsr_deepfix_static.mjs`) + the Run-L pipeline
  (certified PASS 2026-07-06) + runtime parity tripwires (`reviewonly_derivation_mismatch`). Browser matrices run on Codex/Windows.
- **G-INVARIANT is the ONE wholly-missing gate — no test suite exists** (0 `*.test.js`; only `data-integrity-sweep.mjs`'s 10
  signatures + `p9_assert.mjs` extract-and-eval). ⇒ "build the invariant suite" is a legitimate roadmap Step 0 (its spec = the
  CR-C invariant register). **M-STATIC FLAG_TABLE is STALE** (missing 9 flags; asserts GRADE_TOKEN_MINT=true but it's false since
  07-15) → G-FLAGTABLE is red today; cheap refresh is a prerequisite to reusing the machinery for any new consolidation flag.

## Verified invariant register (12) any single-definition must preserve
#9 cross-pace · #11 review-only 3-reason gate · #16 two-facts (complete≠advances) · #10 sanctioned NON-reconciling read (LIVE bug) ·
day-guard idempotency · non-demoting csd + fail-closed · cycling lap-reset (server mirror ABSENT) · anchor validity + csd_anchor_invalid
(=0, discipline holds) · day-1 asymmetry (impossible_phase firehose) · recentSessions append-cadence · engagement grandfather ·
session_states display-only-except-challenge-accept. (Frozen interfaces: ~18 client + 15 server system_logs events; 31 CS scripts.)

## Ordering constraints for the roadmap (F, the load-bearing 7)
- **OC-1 (master):** PR-3 hold-csd (`recordReviewOutcome`) must exist in dormant `completeSession` (new `review_recorded` status —
  absent today) BEFORE `SERVER_PROGRESS_WRITE`/P4 flips, else the cutover silently reverts hold-csd (I2/#16 regress).
- **OC-2:** V2 pairing must be mirrored into `foundation.js:546-581` in PR-2/P3, never after P4 (server pairing drives W2-marker
  suppression + resolver csd → P0-on-server re-mints I4 at the server).
- **OC-3:** engagement predicate + grandfather constant must land in foundation before P4 (dormant `dayReviewExists:615`/
  `countPostAnchorReviewDays:638` go live at cutover and today count skips as done).
- **OC-4:** binary throttle's owner must own 3 lap-boundary pieces (reviewMode bit / derived interventionLevel / lap clears) in BOTH
  writers; the **server lap-reset mirror is ABSENT today** (precondition for SERVER_PROGRESS_WRITE ∧ CYCLING).
- **OC-5:** PR-1 re-entry `===csd` conjunct must source csd from the P4-routed accessor, not a raw read (else misfires post-P5).
- **OC-6:** PR-2 IS the P3 functions deploy (same artifact) — don't double-deploy; full flag-table gate applies.
- **OC-7:** CS tooling (`census-i4`, `data-integrity-sweep`, `manual-pass`) is class_progress-shaped → retarget at P5 (FIX_PLAN F6-3).

## Adjudications for Phase 3
- **C5 state-ownership IS the staged deepfix P3–P7** (`durableProgressRef` is the single doc-target switch; a separate C5 workstream
  would build a 2nd canonical builder fighting `resolveListProgress`). ⇒ C5 = "finish/deploy deepfix + fold V2 + the csd/twi-only
  field carve-outs into the resolver," NOT a new workstream.
- **C4 state-machine sequences AFTER P4**, consuming the resolver + callable statuses (incl. `no_evidence`) as its interface; PR-1 WI-3
  is a compatible pre-step.
- **C2 `isDayComplete` must be day-type-dispatched** (anchored → V2 pairing; anchor-less review-only → coarse/engaged existence) and
  return {complete, advances}.
- **Divergent DEFAULTS are their own drift class** (pace 80/20/undefined; threshold 95/92/0.95) — unify defaults, not just predicates.

## Phase-3 execution (3 Fable agents write the ROADMAP; orchestrator converges + verifies)
Roadmap = a sequenced strangler-fig plan across the THREE layers (deploy staged deepfix → CS PRs → remaining unifications), honoring
OC-1..7 + the invariant register, with Step 0 = build the invariant suite + refresh M-STATIC. Agents: (A) sequence & phasing; (B)
reversibility/gates/"what ships when"; (C) adversarial — what ordering violates an OC or invariant, and the "already-live #10 wave"
urgency. Orchestrator verifies every ordering claim against the deepfix FIX_PLAN + the verified constraints, then presents.

# PHASE 3 OUTPUT — Converged Consolidation Roadmap (3 Fable agents RA/RB/RC + orchestrator verification)

**Convergence: RA (phasing) + RB (ship-order/gates) agree on a 13-phase strangler-fig plan; RC (adversarial) supplied
ordering corrections + 4 unscheduled-residue items. Orchestrator verified the load-bearing NEW claims below.**

## Orchestrator verification stamp (2026-07-17)
- **7 dead `sessionService` exports = 0 external refs** (free deletion). ✓
- **M-STATIC FLAG_TABLE is RED today**: `GRADE_TOKEN_MINT` asserted `baseline:true` (`lsr_deepfix_static.mjs:143`) but is `false`
  (`functions/index.js:80`, disarmed 07-15) → would fail DG-1 on the next gated deploy. Step-0a is on P1's critical path. ✓
- **`foundation.js:479`**: server is always list-scoped → after P4, `LIST_SCOPED_RECON` can never flip off (one-way). ✓
- **Tree `firestore.rules` = the P10-cutover FINAL artifact** (`:4`) → never bare-deploy; P6/P10c use separate snapshot files. ✓
- **Recent-window `8` hard-coded at 4 sites** (`progressService.js:229/423/441/449`, 3 in P4 resolver helpers) — RC's NEW gap;
  the WI-2 8→12 widening must hit all four or silently reverts at P4. ✓
- **`getClassProgress` is a pure getDoc** (`progressService.js:632`) — the #10 sanctioned non-reconciling bypass. ✓

## RC ordering corrections (verified, folded into the final sequence)
- **RC-O1 (B):** "CS-PRs-first" is structurally impossible — ANY functions deploy from HEAD ships the whole staged P3 surface +
  activates the grading job. ⇒ PR-2 has NO independent existence; it is legs folded into the P3 artifact (OC-6 hardened). First
  hosting deploy = deepfix P1.
- **RC-O2 (B):** deploy-all-deepfix-then-CS silently reverts hold-csd — `completeSession` writes `csd+1` unconditionally and the
  PR-3 shape (`recordReviewOutcome`/`review_recorded`/`reviewMode`) has 0 hits in tree. ⇒ PR-3's SERVER write-shape lands in the
  P3/PR-2 artifact; PR-3 client flips + soaks BEFORE P4.
- **RC-O6 (B):** "make all readers adopt the one builder" re-mints #10 — the protected bypass (`MCQTest.jsx:762`,
  `TypedTest.jsx:1041`) must survive, enforced by a Step-0 invariant + a P4/P7 grep whitelist; re-targets to a pure canonical
  getDoc at P5.
- **RC-O3/O5/O7 (H):** PR-1 (+census) strictly before P5; C2 unifies only after PR-3+P4 and returns `{complete, advances}`; M4
  soak starts only after PR-1's writer changes (M4's `studyDay===csd+1` assert must gain a retake/V2 carve-out — a P6 precondition).
- **Split Step 0:** 0a (flag-table refresh, gates P1, ships this week) + 0b (full 12-invariant suite, gates P3+, runs in parallel).

## 4 unscheduled-residue items RC found in code (roadmap MUST add beyond "deploy deepfix")
1. **Retake-rewind writer (5th csd writer) + `progressSnapshot`** (`MCQTest.jsx:955-970`/`TypedTest.jsx:1256-1271`) — never in
   FIX_PLAN; route/retarget server-side at P4/P5, add to P7 retirement, PR-3 must add `reviewMode` to the snapshotted/restored set.
2. **Recent-window literal `8` at 4 sites** → one shared constant + multi-review-day parity fixture (else 8→12 reverts at P4).
3. **`census-i4-pairing.mjs`** must join the OC-7/F6-3 P5 tooling-retarget list (it's class_progress-shaped; predates F6-3).
4. **`countPostAnchorReviewDays:638`** (P5 evidence counter) must adopt the grandfathered engagement predicate (else RO-unfrozen
   cohort false-quarantines).

## THE CONVERGED ROADMAP (safe ordering, verified)
**Frame:** 3 layers — deployed `14e49a4` < staged deepfix P0–P10 (HEAD, = C5 consolidation, ~80% built) < CS PR-1/2/3 (unwritten).
Roadmap = **prove → deploy the staged layer in order → write the CS PRs INTO it → unify the rest on the server-authoritative base
→ retire duplicates.** Every step flag-gated, independently reversible; NO big-bang rewrite; no phase builds a 2nd source of truth.
Rollback tiers T0 (client flag+Netlify) / T1 (functions) / T2 (rules/indexes) / T3 (data migration). Prod = **Netlify**.

| # | Phase | Maps to | Consolidates → single owner | Build/Deploy | Rollback | Key gate |
|---|---|---|---|---|---|---|
| 0a | Gate repair | NEW+P0 | M-STATIC flag-table refresh (17+10 flags, fix MINT) | BUILD (no deploy) | T0 | self (FLAGTABLE green) |
| 0b | Invariant suite | NEW | the 12-invariant register → runnable `p9_assert`-style asserts | BUILD | T0 | baseline green |
| 1 | **Wave-stopper** | **P1**(+P2 RS) | harm-stop: live **#10** (23 students) + #11 wall (183); C9/C10 first slices | **DEPLOY** (staged) | T2 | SOAK (dgr→0), CENSUS(F-4) |
| 2 | CONT-A | P8 | finished-list continuation (63 pending) | DEPLOY (staged) | T0 | — |
| 3 | **CS PR-1** | NEW | **C1** → `reviewPairsWithAnchor` (+WI-3 re-entry, WI-4 recovery, F2, 8→12×4, impossible_phase userId) | BUILD→Netlify | T0 | **CENSUS 13/14+0FP** |
| 4 | **P3 ⊕ PR-2** (ONE fn deploy) | P3+PR-2 | **C5 core** + ALL mirrors: V2 pairing, engagement+grandfather→:620/:638, `review_recorded`+reviewMode+lap-reset (OC-1/2/3/4), I6 clamp | BUILD-delta→functions | T1 | FLAGTABLE(17), **PARITY**, SOAK(M4 14d) |
| 5 | **CS PR-3** | NEW | **C3** → `deriveThrottleMode`+`reviewMode` bit; C2/C10 partial (hold-csd) | BUILD→Netlify | T0 | BYTE, INVARIANT(#11/#16) |
| 6 | Client cutover | **P4** | **C5 routing**; retires impossible_phase firehose; retake-rewind routed | BUILD-delta→Netlify+flags | T0* | PARITY(runtime≈0), canonical=∅ |
| 7 | **THE migration** | **P5** | **C5 data** → one `list_progress` doc; demotee ledger (≤5); tooling+census-i4 retarget | script→CS event | **T3 one-way** | CENSUS(0 demote/strand) |
| 8 | Rules cutoff | **P6** | **C7 authority**; forgery closed; M4-enforce (retake/V2 respec) | rules deploy (p6 file) | T2 | INVARIANT(rules matrix) |
| 9 | Retire | **P7** | flag/branch burn-down; grandfather const on keep-list | Netlify+script | T0/T3 | zero-refs grep |
| 10 | isDayComplete | NEW | **C2** → `{complete, advances}` day-dispatched | BUILD→Netlify | T0 | CENSUS(replay) |
| 11 | State machine | NEW | **C4** → one lifecycle owner (consumes resolver); delete dead 7-API | BUILD→Netlify | T0 | INVARIANT |
| 12 | Defaults & anchors | NEW+P10 | **C6/C8/C10-rem** → `resolveAssignmentPolicy` (unify DEFAULTS 80/20; 95/92/0.95) | BUILD | T0 | CENSUS(verdict-flips) |
| — | CYC / OVR | P9/P10 | forward features on the consolidated base | BUILD | T0/T1 | INVARIANT(lap) |
*After P4, the rollback lever for the progress stack is `SERVER_PROGRESS_WRITE` only; `LIST_SCOPED_RECON` is retired-in-place.

## Minimum shippable THIS WEEK (reversible, high-benefit, zero migration)
0a flag-table refresh → **deepfix P1 hosting deploy** (the committed #10 fix for 23 live students + the #11 wall — already staged,
Codex-GO, Netlify-restore rollback) → P2 RS + CONT-A → **CS PR-1 written & shipped dark** (the sole remediation for the 14 stuck).
The dead-7-API deletion rides the next bundle (free). NOT today: any functions/rules deploy, P5.

## Deliberately NOT unified (guardrails): C11 streak (deliberate tz) · `passed` vs `isEngagedReview` (two facts) ·
`interventionLevel` compat {0,1} (until post-P7 cleanup) · the 3 csd write policies (one fn, distinct reasons) · C12 = finished template.
