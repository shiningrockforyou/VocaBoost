# DEEPFIX 2 — Relevant documents & files (the extensive inventory, 2026-07-25)

> Everything the program builds from, reconciles with, or must not contradict. Grouped by role.
> ★ = a governing source (where docs conflict, ★ wins within its domain).

## A. Design sources (what we're building)

| Doc | Role |
|---|---|
| ★ `docs/plans/UNIFIED_SESSION_STATE_ARCHITECTURE.md` | The container plan of record: §1-§5 architecture · §6-§9 5/5 critic convergence (G0 exit channel, C1 Dashboard exclusion, G1 3-axis hold fields, G3-G7, A1-A5) · §10 mode seam · §11 full surface map + gate glossary + redundancy audit + BlindSpot-hide spec · §12 ship-together model + free-nav UX delta + 15-row messaging register |
| ★ `docs/design/UNIFIED_SESSION_STATE_MAP.md` | **3×-Fable-audited ground truth** of the current system (57✓/1✗/3≈ accuracy; §16 audit log): routes, nav edges, phase machine, Dashboard CTA machine, exit channel, failure/recovery states, results+challenge, review build, teacher levers, gate glossary (G-*), 12-site G-PASS redundancy, dead-code register |
| ★ `docs/design/FREE_NAVIGATION_MODEL.md` | Free-nav design: LAYERED (read the 2026-07-24 banner — top layer superseded); governing layers = RIGOR REVIEW corrections + CODEX HARD GATE + GATE CLOSED (COEXISTENCE) + UI VEHICLE + CONSISTENCY WITH THE SESSION MAP (5 binding requirements) + pass-to-advance **DECIDED YES 2026-07-25** |
| `docs/design/unified-session-state-wireframe.html` | The visual wireframe (published artifact, post-audit): nav graph, CTA machine, entry/exit/failure states, chrome+modal layer, free-mode family, lever table, gate glossary, parked/dead, collapse map |
| `docs/plans/D3.5_WORKITEM_review_pass_threshold.md` | The banked review-pass gate build plan (Codex r36-verified + r37 adversarial: separate `review_retake_required` gate, NOT fpHoldCsd; **exemptions = list-end + the no-score (empty/all-mastered) case; #9-resume NOT exempt** [C4 fix]; §11 reader-correctness trap sites) |
| `docs/plans/PLAN_practice_mode_v2.md` | Practice Mode v2 (David-locked) — shares the dormant `practiceMode` rail; must not fork from free-mode review (Codex caveat 4) |
| `docs/plans/REVIEW_SEGMENT_REDESIGN_PLAN.md` (+ its verification doc) | Prior review-segment design history — background for the G-DUE scheduler design |

## B. Deepfix1 program sources (what we're picking up / reconciling with)

| Doc | Role |
|---|---|
| ★ `docs/plans/MASTER_TASK_LIST.md` | Deepfix1 canonical record: ground-truth anchors (`6bffe1c` client / `0ddbb34` functions pinned), A-E staged plan, D4-D9 remaining items + their gates, E1-E4 backlog, banked items A/D, standing constraints, §7 GO-HOLD convergence |
| `docs/plans/MASTER_TASK_TRACKER.md` | Action log referencing item IDs (deepfix2 items log here with DF2-IDs) |
| ★ `docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md` | The DEPLOY_ORDER spine (Track-2 rows P5→P7) + OC-1..OC-7 reconciliation corrections + freenav COEXISTENCE record |
| `docs/plans/D3.5_RECOVERY_AUDIT_PLAN.md` · `D3.5_FINDINGS.md` · `D3.5_RISK_REMEDIATION.md` (v2) · `D3.5_DEEPFIX_AUDIT_REPORT.md` | The in-flight pre-migration audit + the hardened R1-R16 remediation list (deepfix2 Wave-0 carries it) |
| `docs/plans/FORCED_PATHWAY_FIX_PLAN_2026-07-16.md` | The David-locked binary-throttle policy (forced-mode law) |
| `docs/plans/PLAN_list_progress_persist.md` | P5 canonical migration design (`class_progress → list_progress`, LIST_PROGRESS_CANONICAL) — the server-owned-frontier substrate |
| `docs/plans/PLAN_attempt_write_lockdown.md` + `W3_attempts_lockdown.rules.md` + `firestore.p6.rules` (+ repo `firestore.rules` = P10d draft, NEVER deploy) | The rules lineage free-nav's new artifact must extend, and the traps |
| `docs/plans/PLAN_teacher_grade_override.md` | P10 override/permissions chain (D8) — parallel track, touches challenge/override paths |
| `docs/plans/SESSION_TODO_2026-07-17.md` · `CONSOLIDATION_ROADMAP_2026-07-17.md` | STALE/superseded (kept for record; do not plan from) |

## C. Convergence / coordination

| Doc | Role |
|---|---|
| `docs/plans/loop/baton.json` (+ `docs/plans/loop/win/baton.json`) | Codex + WinClaude coordination batons (round 41 = this program's Codex review; note: Windows-written batons carry a BOM) |
| `docs/plans/loop/handoffs/claude_to_codex_deepfix2_r41.md` | The Codex handoff for this program |
| `docs/plans/loop/codex_reviews/` (esp. `codex_unifiedstate_r40.md`, `codex_reviewpass_r36/r37`) | Codex's standing verdicts the program inherits |
| `docs/plans/loop/CONVERGENCE_REPORT_v4.md` | Deepfix1's GO-HOLD convergence record |

## D. Ops / CS / user-facing

| Doc | Role |
|---|---|
| `SUPPORT_RUNBOOK.md` | CS source of truth — the ticket classes the messaging register targets; gains free-mode + container sections at Wave 6 |
| `change_action_log.md` · `NEED_TO_FIX.md` · `CHANGELOG.md` | Living logs |
| `docs/TA_FAQ.md` · `docs/TA_SUPPORT_GUIDE.md` · `public/help-student-{en,ko}.html` · `public/help-teacher-{en,ko}.html` | TA/student/teacher docs — update at BlindSpot hide (blind-spot mentions) and at Wave 6 (modes + messages); deployed to vocaboostone.netlify.app |
| `scripts/cs/` (esp. `data-integrity-sweep.mjs`, **`census-i4-pairing.mjs`** [the false-CLEAN hazard script, N6], `manual-pass.mjs`, `carry-progress.mjs`, `batch-triage.mjs`, `verify-token-reset.mjs`) | CS toolchain — **canonical retarget OWNED by DF2-40 (pre-flip hard gate); DF2-62 = mode-awareness residuals** (deepfix1 OC-7) |

## E. Code surface (authoritative inventory = MAP.md §1-§10; key entry points)

- **Client session system:** `src/App.jsx` (routes) · `src/pages/DailySessionFlow.jsx` · `src/pages/MCQTest.jsx` ·
  `src/pages/TypedTest.jsx` · `src/pages/Dashboard.jsx` · `src/pages/Settings.jsx` · `src/pages/BlindSpotCheck.jsx` (parked)
- **Services/utils:** `src/services/studyService.js` (initializeDailySession, determineStartingPhase, completeSessionFromTest)
  · `src/services/sessionService.js` · `src/services/progressService.js` · `src/services/db.js` (levers, tokens, challenge,
  attempts reads) · `src/utils/studyAlgorithm.js` (G-ALLOC/G-SCHED/G-TESTSIZE) · `src/utils/testConfig.js` ·
  `src/utils/reviewPairing.js` (G-ENGAGED) · `src/utils/forcedPathway.js` · `src/utils/sessionStepTracker.js` ·
  `src/utils/sessionRecovery.js` · `src/config/featureFlags.js`
- **Chrome/components:** `SessionHeader` · `SessionProgressSheet` · `SessionMenu` · `TestResults` · `AssignListModal`
  (lever surface — gains `navigationMode` + `reviewPassThreshold`) · `ClassDetail` · `HeaderBar`/`HelpModal` ·
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

1. `deepfix2/03_STATE_ENUMERATION.md` — the pre-coding gate: exhaustive view-model field enumeration (§8 tiers + A1-A5 +
   exit statuses + `carriedFrom` + free-mode fields + seen-markers). **(DF2-03)**
2. `deepfix2/04_SCHEDULER_DESIGN.md` — the G-DUE per-word review scheduler (seeded from the 21-day mastery lifecycle),
   forced-mode-compatible, free-mode-primary; full-lifecycle acceptance criteria incl. the G-ENGAGED recording decision.
   **(DF2-42d — pulled forward, parallel with Waves 1-3; no canonical dependency)**
3. `deepfix2/05_RULES_LINEAGE.md` — the coexistence rules artifact plan (extends P6 lineage; free-mode clauses;
   supersession map vs P10d). **(DF2-44)**
4. `deepfix2/06_MESSAGING_COPY.md` — the 15-row register's actual bilingual (ko/en) copy, reviewed before build. **(DF2-32)**
5. `deepfix2/07_FRONTIER_CENSUS_PLAN.md` — the 129/27 twi-divergence adjudication (folds into P5 pre-work). **(DF2-41)**
6. Free-mode wireframe extension of `unified-session-state-wireframe.html` (NavigateHub + picker + mixed-mode dashboard). **(DF2-51)**
7. `deepfix2/08_MODE_RECORD_CONTRACT.md` — the mixed-mode same-list canonical write-policy + flip-mapping + frontier-vs-cycling
   position model (Codex F1/F2 blocker). **(DF2-47 — gates 42/43/50)**
8. `deepfix2/09_FRONTIER_WRITER_SPEC.md` — the server frontier-writer contract incl. challenge/override/manual-pass
   advancement + concurrency (Codex F3/F4). **(DF2-43)**
9. DF2-34's validation matrix + canary/rollout plan, and DF2-61's flip state-loss analysis — both required artifacts (N9). **(DF2-34 / DF2-61)**
