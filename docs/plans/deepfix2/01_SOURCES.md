# DEEPFIX 2 — Relevant documents & files (the extensive inventory, 2026-07-25)

> Everything the program builds from, reconciles with, or must not contradict. Grouped by role.
> ★ = a governing source (where docs conflict, ★ wins within its domain).

## A. Design sources (what we're building)

| Doc | Role |
|---|---|
| ★ `docs/plans/UNIFIED_SESSION_STATE_ARCHITECTURE.md` | The container plan of record: §1-§5 architecture · §6-§9 5/5 critic convergence (G0 exit channel, C1 Dashboard exclusion, G1 3-axis hold fields, G3-G7, A1-A5) · ~~§10 mode seam~~ (superseded — universal model) · §11 full surface map + gate glossary + redundancy audit + BlindSpot-hide spec · §12 messaging register (rows 4-14+16 live) — mode-seam supersession banner in-file |
| ★ `docs/design/UNIFIED_SESSION_STATE_MAP.md` | **3×-Fable-audited ground truth** of the current system (57✓/1✗/3≈ accuracy; §16 audit log): routes, nav edges, phase machine, Dashboard CTA machine, exit channel, failure/recovery states, results+challenge, review build, teacher levers, gate glossary (G-*), 12-site G-PASS redundancy, dead-code register |
| `docs/design/FREE_NAVIGATION_MODEL.md` | **⛔ SUPERSEDED IN FULL (R2-24/26/27 — the ⛔ banner in-file): design history only**; descendants = the past-day browser + phase toggle (DF2-51) and universal pass-to-advance |
| `docs/design/unified-session-state-wireframe.html` | The visual wireframe (published artifact, post-audit): nav graph, CTA machine, entry/exit/failure states, chrome+modal layer, free-mode family, lever table, gate glossary, parked/dead, collapse map |
| ★ `docs/plans/deepfix2/11_REDESIGN_VERIFICATION_AND_FOLD_PLAN.md` | **THE BINDING DECISION LEDGER (R2-1..R2-47)** — where any doc disagrees, the ledger wins |
| ★ `docs/plans/deepfix2/12_R2_DISCUSSION_TRACE.md` | The per-exchange audit record (row count grows per exchange — standing rule) — David's completeness check |
| `docs/plans/deepfix2/13_ROUND5_PANEL_RECORD.md` | The round-5 internal panel's full findings (adjudicated by r46) |
| ★ `docs/plans/deepfix2/10_REVIEW_GRADUATION_REDESIGN.md` | **The redesign spec v4 FINAL (ledger-matched)**: universal model · teacher-set 60/30 · class-scoped queue identity · four `review*` labels + three strata · recompute-at-92 backfill w/ the r48 exclusion filter · delivered by DF2-14 |
| `docs/plans/D3.5_WORKITEM_review_pass_threshold.md` | ⛔ superseded in-file — BECAME the R2 program (the gate ships ON@92 inside DF2-14); historical build plan (Codex r36-verified + r37 adversarial: separate `review_retake_required` gate, NOT fpHoldCsd; **exemptions = list-end + the no-score (empty/all-mastered) case; #9-resume NOT exempt** [C4 fix]; §11 reader-correctness trap sites) |
| `docs/plans/PLAN_practice_mode_v2.md` | Practice Mode v2 (David-locked) — shares the dormant `practiceMode` rail; must not fork from the universal model's review/re-test surfaces (Codex caveat 4; ~~free-mode review~~ R2-24) |
| `docs/plans/REVIEW_SEGMENT_REDESIGN_PLAN.md` (+ its verification doc) | Prior review-segment design history (G-DUE cancelled R2-27 — historical only) |

## B. Deepfix1 program sources (what we're picking up / reconciling with)

| Doc | Role |
|---|---|
| ★ `docs/plans/MASTER_TASK_LIST.md` | Deepfix1 canonical record: ground-truth anchors (`6bffe1c` client / `0ddbb34` functions pinned), A-E staged plan, D4-D9 remaining items + their gates, E1-E4 backlog, banked items A/D, standing constraints, §7 GO-HOLD convergence |
| `docs/plans/MASTER_TASK_TRACKER.md` | Action log referencing item IDs (deepfix2 items log here with DF2-IDs) |
| ★ `docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md` | The DEPLOY_ORDER spine (Track-2 rows P5→P7) + OC-1..OC-7 reconciliation corrections + freenav COEXISTENCE record |
| `docs/plans/D3.5_RECOVERY_AUDIT_PLAN.md` · `D3.5_FINDINGS.md` · `D3.5_RISK_REMEDIATION.md` (v2) · `D3.5_DEEPFIX_AUDIT_REPORT.md` | The in-flight pre-migration audit + the hardened R1-R16 remediation list (deepfix2 Wave-0 carries it) |
| `docs/plans/FORCED_PATHWAY_FIX_PLAN_2026-07-16.md` | ~~The David-locked binary-throttle policy (forced-mode law)~~ — **SUPERSEDED by D-1 (2026-07-26): the throttle is removed entirely (task list §4); historical record only** |
| `docs/plans/PLAN_list_progress_persist.md` | P5 canonical migration design (`class_progress → list_progress`, LIST_PROGRESS_CANONICAL) — the server-owned-frontier substrate |
| `docs/plans/PLAN_attempt_write_lockdown.md` + `W3_attempts_lockdown.rules.md` + `firestore.p6.rules` (+ repo `firestore.rules` = P10d draft, NEVER deploy) | The rules lineage the program's new artifacts must extend (DF2-44 universal-model clauses; DF2-14's `firestore.review_v2.rules` enters FIRST), and the traps |
| `docs/plans/PLAN_teacher_grade_override.md` | P10 override/permissions chain (D8) — parallel track, touches challenge/override paths |
| `docs/plans/SESSION_TODO_2026-07-17.md` · `CONSOLIDATION_ROADMAP_2026-07-17.md` | STALE/superseded (kept for record; do not plan from) |

## C. Convergence / coordination

| Doc | Role |
|---|---|
| `docs/plans/loop/baton.json` (+ `docs/plans/loop/win/baton.json`) | Codex + WinClaude coordination batons (round 41 = this program's Codex review; note: Windows-written batons carry a BOM) |
| `docs/plans/loop/handoffs/claude_to_codex_deepfix2_r41..r52.md` (+ r53 when raised) | The Codex handoffs; reviews at `codex_reviews/codex_deepfix2_r41..r52.md` — **r46 (decision-state check + the 28-item fold checklist) · r47 (owner-answer adjudication) · r48 (FINAL RATIFICATION + the 8 launch contracts + FOLD GO)** |
| `docs/session_state/2026-07-26_4817fc5a/` — **`STATE_BRIEF.md`** + `scratchpad/review-pool-sim.mjs`/`sim2.mjs`/**`sim3.mjs`** | The 07-24→26 session capture: David decisions D-1..D-4 provenance, the review-pool steady-state simulators behind register item 15's projections, and the shadow-orbit starvation tracer behind DF2-0P/DF2-42d's fairness criterion |
| `docs/plans/loop/codex_reviews/` (esp. `codex_unifiedstate_r40.md`, `codex_reviewpass_r36/r37`) | Codex's standing verdicts the program inherits |
| `docs/plans/loop/CONVERGENCE_REPORT_v4.md` | Deepfix1's GO-HOLD convergence record |

## D. Ops / CS / user-facing

| Doc | Role |
|---|---|
| `SUPPORT_RUNBOOK.md` | CS source of truth — the ticket classes the messaging register targets; gains universal-model + container sections at Wave 6 (~~free-mode~~ — R2-24) |
| `change_action_log.md` · `NEED_TO_FIX.md` · `CHANGELOG.md` | Living logs |
| `docs/TA_FAQ.md` · `docs/TA_SUPPORT_GUIDE.md` · `public/help-student-{en,ko}.html` · `public/help-teacher-{en,ko}.html` | TA/student/teacher docs — update at BlindSpot hide (blind-spot mentions) and at Wave 6 (the universal model + messages; ~~modes~~ R2-24/27); deployed to vocaboostone.netlify.app |
| `scripts/cs/` (esp. `data-integrity-sweep.mjs`, **`census-i4-pairing.mjs`** [the false-CLEAN hazard script, N6], `manual-pass.mjs`, `carry-progress.mjs`, `batch-triage.mjs`, `verify-token-reset.mjs`) | CS toolchain — **canonical retarget OWNED by DF2-40 (pre-flip hard gate); DF2-62 = universal-model doc/CS residuals [FF2-13]** (deepfix1 OC-7) |

## E. Code surface (authoritative inventory = MAP.md §1-§10; key entry points)

- **Client session system:** `src/App.jsx` (routes) · `src/pages/DailySessionFlow.jsx` · `src/pages/MCQTest.jsx` ·
  `src/pages/TypedTest.jsx` · `src/pages/Dashboard.jsx` · `src/pages/Settings.jsx` · `src/pages/BlindSpotCheck.jsx` (parked)
- **Services/utils:** `src/services/studyService.js` (initializeDailySession, determineStartingPhase, completeSessionFromTest)
  · `src/services/sessionService.js` · `src/services/progressService.js` · `src/services/db.js` (levers, tokens, challenge,
  attempts reads) · `src/utils/studyAlgorithm.js` (G-ALLOC/G-SCHED/G-TESTSIZE) · `src/utils/testConfig.js` ·
  `src/utils/reviewPairing.js` (G-ENGAGED) · `src/utils/forcedPathway.js` · `src/utils/sessionStepTracker.js` ·
  `src/utils/sessionRecovery.js` · `src/config/featureFlags.js`
- **Chrome/components:** `SessionHeader` · `SessionProgressSheet` · `SessionMenu` · `TestResults` · `AssignListModal`
  (lever surface — DF2-11 rebuild: review threshold/queue/test fields; `navigationMode` dead) · `ClassDetail` · `HeaderBar`/`HelpModal` ·
  dead set per MAP §13 (SessionSteps, SessionProgressBanner, BlindSpotsCard, MasteryBars, RetakePrompt branch,
  StudySelectionModal)
- **Server:** `functions/index.js` (submitVocabAttempt/writeAttemptTxn G-PASS :433-434, gradeTypedTest, submitChallenge,
  tokens) · `functions/foundation.js` (completeSession, resolveListProgress+G-QUAR, deriveThrottleModeServer, day-guard,
  hold branch, resetProgress, mondayOfWeek/KST helpers) — **pinned `0ddbb34`**
- **Rules artifacts (paths per N7):** `audit/deepfix/task3/firestore.p6.rules` · `audit/deepfix/task3/firestore.p10c.rules`
  · `audit/deepfix/task3/DEPLOY_ORDER.md` · `audit/deepfix/task3/phase7_retirement.patch` · repo `firestore.rules`
  (P10d draft — trap, to be SUPERSEDED by the DF2-44 final artifact) · `firestore.indexes.json`
- **Evidence:** `audit/playwright/findings/deepfix_*` · `audit/playwright/lsr_deepfix_p4cert.mjs` (the runnable 10/10 cert
  instrument) · 26SM backup at `scripts/cs/backups_full_26sm_20260717-165840/`

## F. Gaps this program must CREATE (new documents; owners in 02_TASK_LIST)

> **Post-R2 (2026-07-26): CREATED since this list was written — `10_` (addendum v4 FINAL) · `11_` (the BINDING
> ledger, §1 R2-1..R2-47) · `12_` (discussion trace) · `13_` (round-5 panel record) · `evidence/graduation-validity-26SM.json`
> · the r44-r49 review set. Items below carry their own supersession marks; the ledger governs.**

1. `deepfix2/03_STATE_ENUMERATION.md` — the pre-coding gate: exhaustive view-model field enumeration (§8 tiers + A1-A5 +
   exit statuses + `carriedFrom` + ~~free-mode fields~~ universal-model fields (ONE model, R2-24) + seen-markers). **(DF2-03)**
2. ~~`deepfix2/04_SCHEDULER_DESIGN.md` — the G-DUE per-word review scheduler~~ **DEAD (R2-27 Q4: G-DUE CANCELLED;
   DF2-42d dissolved; engagement retired R2-11 — the DF2-14 day-offset rotation IS the review scheduler).**
3. `deepfix2/05_RULES_LINEAGE.md` — the rules-lineage plan (extends P6; ~~coexistence/free-mode clauses~~ →
   universal-model clauses [DF2-44b rescope]; supersession map vs P10d). **DF2-14's NAMED artifact
   `audit/deepfix/task3/firestore.review_v2.rules` enters the lineage FIRST [r49-B3]; the DF2-44 final artifact
   re-baselines on top.** **(DF2-44)**
4. `deepfix2/06_MESSAGING_COPY.md` — the register's actual ~~bilingual~~ ENGLISH-ONLY [R2-44] (was: ko/en) copy (rows 4-16 — rows 1-3 retired [D-1 + R2-11]; row 15 re-homed = the past-day browser), reviewed before build; **supersedes §12.3's draft strings** [Fable-2 M5]. **(DF2-07/DF2-32)**
5. `deepfix2/07_FRONTIER_CENSUS_PLAN.md` — the 129/27 twi-divergence adjudication (folds into P5 pre-work). **(DF2-41)**
6. ~~Free-mode wireframe extension (NavigateHub + picker + mixed-mode dashboard)~~ **DEAD as scoped (R2-24);
   DF2-51 rescoped = the past-day browser + retest UI INSIDE DF2-14's train.**
7. ~~`deepfix2/08_MODE_RECORD_CONTRACT.md`~~ **DEAD (DF2-47 dissolved, R2-24/27 — no modes).** ~~The F2 cycling/lap question survives on [D7/P9]~~ — F2 DIED with cycling's retirement (R2-39); dual-enrolled
   same-list = R2-36/38 + the r48 contracts (DF2-14).
8. ~~`deepfix2/09_FRONTIER_WRITER_SPEC.md`~~ **DEAD standalone (DF2-43 dissolved) — its surviving contracts
   (challenge/override/manual-pass advancement + concurrency + canonical audit rules) live on DF2-46.**
9. DF2-34's validation matrix (~~canary/rollout plan~~ — canary DEAD, R2-5/24) + DF2-61's CONTAINER-exposure
   analysis [FF2-01 rescope; DF2-14 owns the review flip]. **(DF2-34 / DF2-61)**
10. `deepfix2/evidence/` — probe/census outputs created by the program (~~DF2-0P starvation distribution~~ — shelved, R2-22; **created: the graduation-validity probe + trajectory sims**; DF2-10's
    uniform-reader `passed`-values census; DF2-08's verdict-flip census). **(DF2-0P / DF2-10 / DF2-08)**
