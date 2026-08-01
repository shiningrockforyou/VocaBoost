# DEEPFIX 2 — Consolidated task list (v2, 2026-07-26 — post round-1 convergence fold)

> **The one forward program**: deepfix remainder + unified container + free-nav mode + UX/messaging, sequenced as waves.
> **v2 folds the round-1 six-way convergence** (3 Fable + 2 Opus + Codex r41 — see §6). v1 verdicts: Codex UNSOUND-as-executable/
> direction-SOUND · Opus-A GO-WITH-CONDITIONS · Fable-B ordering-GO-with-corrections · Fable-A/C GAPS/CONDITIONAL — all folded.
> Legend: ✅ done · 🔄 in progress · ⛔ not started · ⚠️ one-way door · 🔵 WinClaude deploy / David authorization ·
> 🧭 David decision needed · 🔍 convergence checkpoint. Deepfix1 IDs cited as `[D4/P5]` — **original gate text governs**
> (this file is a summary layer; where thinner than a gate-bearing source, the source wins — orientation §5).
> Actions log to `MASTER_TASK_TRACKER.md` under DF2-IDs.

## 0. Program invariants (apply to every item)

- 26SM read-only; 25WT sandbox; deploys via WinClaude 🔵; **commit on `main`, never branch**; targeted `git add` only;
  a passed `new` attempt is the CSD/TWI anchor (`twi = newWordEndIndex + 1`).
- **Pin discipline:** the CERTIFIED CORE (completeSession/resolveListProgress, `foundation.js`) is pinned `0ddbb34`
  (grader `gradeTypedTest`→`0992f5f` r63 and `submitChallenge`→`6094cdd` r65 already moved surgically). Any move of the
  core = deliberate, David-authorized, clean tree, behavioral re-cert on the new pin. **A `foundation.js` edit is NEVER
  surgical** — it rides in every callable's bundle, so the deploy set must be the full no-skew set (see DF2-10) with a
  post-deploy same-commit check (`version` callable) + fail-closed flag-posture probe + `ANCHOR_VALIDATION_SHADOW`/M4-clock
  continuity assertion. Off-peak + pre/post live scans (`data-integrity-sweep` + `system_logs`) for every deploy touching
  completeSession or rules (DF2-10/43/44/45).
- **Byte-identity falsifier:** forced-mode behavior provably unchanged (differential fixtures) **until a wave EXPLICITLY
  changes it via its approved-delta list** (Wave 3's deltas: messaging, one-affordance, chrome/derived copy — each named).
- **One G-PASS predicate** (as of DF2-08; consolidation completed by DF2-46): every consumer (review gate, SegmentTest,
  challenge/regrade) uses the ONE module incl. the authoritative `passed:true` short-circuit — never a new copy.
- Rules: named artifacts only; never bare-deploy; never the repo P10d draft; **no rules deploy after R3** (see DF2-44).

## Wave 0 — Ready now (mostly parallel) 🔍 at wave end

| ID | Task | Notes / gates | Surface |
|---|---|---|---|
| DF2-01 ⛔ | **BlindSpot hide** — `BLINDSPOTS_UI=false`: Dashboard link (:2172), route (App:91→redirect), HelpModal copy (:250); help-site pages + **TA_FAQ/TA_SUPPORT_GUIDE blind-spot mentions** ride the same release | Spec §11.1; code + 21-day data model KEPT (G-DUE seed) | hosting 🔵 |
| DF2-02a ⛔ | **Safe dead-code deletions** — SessionSteps, SessionProgressBanner, BlindSpotsCard, MasteryBars, MasterySquares import, StudySelectionModal, **the dead 7-export sessionService transition API incl. `recordNewWordsTestResult` (sessionService.js:268, dead G-PASS copy)**; 🧭 dead levers `reviewTestSizeMin/Max`: wire or remove (+ `assignment.testSizeReview` ghost-read) | MAP §13 + [E2] deletion leg | hosting 🔵 |
| DF2-02b ⛔ | **RetakePrompt + REVIEW_TEST phase deletion** — per spec (branch DSF:1952-1969 + def :2367; KEEP the live localStorage marker vocab) — **HELD until DF2-10's retake-surface decision** (same UI area; delete or replace ONCE) | Codex S5 | hosting 🔵 |
| DF2-03 ⛔ | **Full state enumeration** (`03_STATE_ENUMERATION.md`) — §8 tiers 0-3 + A1-A5 + exit statuses + `carriedFrom` + free-mode fields + event-seen markers + **`resetEpoch` tombstone** (§11.3). **PRE-CODING GATE for Waves 2+** | — | doc |
| DF2-04 ⛔ | **Golden/differential fixture harness** — initializeDailySession outputs across flag matrix + the 9 scenario fixtures + PDF/debug callers (A4); full-config compare; **PLUS: review-gate OFF-path with legacy `passed:undefined` AND new `passed:true` reviews byte-identical (Opus-A R-C) · grandfather-epoch × review-gate precedence (R-K) · `validateAttemptAnchorShadow` dependency-closure identity across pin-moves (M4-clock protection)** | accepted only after DF2-03 freezes the inventory | test infra |
| DF2-05 🔄 | **D3.5 risk remediation** (R1-R16) — **R1, R2, R7, R8 are designated HARD ENTRY GATES for Wave 4** (they size/repair the inflated pool the migration freezes) | Opus-A R-L | scripts/sandbox |
| DF2-06 🧭 | **Grader prompt fix round 2** (verbatim-English family) + regression extension; surgical `--only functions:gradeTypedTest`. **Interleave rule: must deploy BEFORE DF2-10's server commit or inside DF2-10's set** (shared `writeAttemptTxn`). Confirm verbatim-vs-paraphrase grading intent with David at go | Fable-B corr.8 | functions 🔵 |
| DF2-07 ⛔ | **QUICK-WIN messaging patches on EXISTING screens** (Opus-B; no container dependency): (a) threshold copy derives from real `passThreshold` — SessionProgressSheet "95%" + results "below X%" (kills the 93%-shows-fail cluster); (b) review-only-day reason banner w/ the CORRECT exit condition ("avg of last 3 reviews **above 50%**" — never 30%); (c) **list-end special-case message** ("You finished the list — pick your next list", replaces the pass-the-test wall copy for `isListComplete`); (d) token copy "resets every Monday" (timezone-safe, no "4 AM KST" for 미주/베트남); (e) **TA_FAQ/TA guide 30%→50% reconciliation rides the SAME release** (the 소지훈 dead-band harm case). 25WT check first | message⇔reason binding rules apply (no throttle copy on listComplete/resume) | hosting + docs 🔵 |
| DF2-42d ⛔ | **G-DUE scheduler DESIGN** (`04_SCHEDULER_DESIGN.md`) — pulled forward (NO canonical dependency — the 21-day `study_states` lifecycle is untouched by P5). Acceptance = full lifecycle: due calc, selection, answer/engagement recording (**closes the G-ENGAGED-in-free 🧭**), mastery/graduation/return, TZ/clock injection, idempotency, server-vs-client authority, rules permissions. 🔍 own design convergence before build (DF2-42) | Fable-B corr.7 · Codex F5/F6 | doc |

## Wave 1 — Policy module + review-pass gate [§8-G6: BEFORE any extraction] 🔍

| ID | Task | Notes / gates | Surface |
|---|---|---|---|
| DF2-08 ⛔ | **THE policy module: one G-PASS predicate + assignment-policy resolver** (absorbs [E3] `resolveAssignmentPolicy`): score/threshold units (0-1 vs 0-100), threshold source/fallback chain (kills the 4-deep per-page duplication + 80/20 pace + 95/92/0.95 drift), test type + navigationMode, **authoritative persisted `passed:true` short-circuit** (F1 tripwire), challenge/regrade/override behavior; delivered to client AND the CommonJS `functions/` package (generated-copy + equality test); differential tests prove no 13th copy | Codex R2/R6 · first consumer = DF2-10 | client+functions modules |
| DF2-10 ⛔ | **Review-pass gate build** per `D3.5_WORKITEM_review_pass_threshold.md` — pass-1 core (`reviewPassThreshold` per-class default-OFF + **global kill switch**; separate `review_retake_required` gate, NOT fpHoldCsd; **exemptions = list-end + the NO-SCORE case (empty/all-mastered review); #9-resume NOT exempt** [C4 fix]) + pass-2 reader-correctness (studyService:312, getReviewForDay, foundation marker-suppression :1638, challenge path — ALL gated on `passed===true`, byte-equivalent when OFF) + retake UX (resolves the 🧭 retake-surface decision → unblocks DF2-02b). **DEPLOY (first CORE pin-move):** atomic no-skew set = `submitVocabAttempt, gradeTypedTest, completeSession, resolveListProgress, advanceForChallenge, reviewChallenge, overrideAttempt, markReviewComplete` (the automarker must not mint completion evidence for a failed review); functions BEFORE client; post-deploy same-commit skew check + posture probe + shadow continuity; **extended behavioral cert at CURRENT prod posture**: review-fail→`review_retake_required` w/ no csd/twi/recentSessions pollution · review-pass→advance · OFF byte-identical incl. legacy reviews · challenge-crossing · grandfather precedence · idempotent retry · typed+MCQ; defined soak + rollback pin; off-peak + pre/post scans. 🧭 throttle-day gate y/n | Opus-A R-A/R-B/R-C · Codex S4 · Fable-B corr.1 | functions+hosting 🔵⚠️ |
| DF2-11 ⛔ | **`reviewPassThreshold` teacher lever UI** — AssignListModal + ClassDetail + validation; **ships DARK/disabled until DF2-10 atomicity + cert proven** | Opus-A R-A(2) | hosting 🔵 |

## Wave 2 — Unification increment 1 (byte-identical; DARK) [gates: DF2-03+04 done, DF2-10 certified] 🔍

| ID | Task | Notes / gates | Surface |
|---|---|---|---|
| DF2-20 ⛔ | **Client-only `initializeDailySession` core extraction** → `deriveSessionState` (entry) — constraints C1/C2/G4 (ordered assembly, double-call preserved)/G5/G7/A2/A3; anomalies returned (G3); `navigationMode` constant `'forced'`; differential CI green (flag matrix + both record shapes). Exit channel = DF2-31 (G0 owned there) | §8/§9 verbatim | hosting 🔵 (no visible change) |

## Wave 3 — Container + exit channel + messaging (BUILD + VALIDATE; production visibility per DECIDE-0) 🔍

> **Ship-model resolution (C1/C2):** this wave BUILDS and validates on 25WT + preview. What reaches production, when, is
> 🧭 **DECIDE-0**: (a) *incremental line* — Wave-3 deltas go live per approved-delta list after DF2-34 (Fable-C position;
> §8/§9 shippable-increment doctrine; earlier CS relief), or (b) *strict single-train* — container stays dark behind an
> activation gate until DF2-60 (Codex position; matches "ship together" literally). Approved-delta list either way:
> messaging rows, one-affordance Dashboard, chrome/derived copy — each a NAMED exception to byte-identity (§0).

| ID | Task | Notes / gates | Surface |
|---|---|---|---|
| DF2-30 ⛔ | **One `<SessionStage>`** — enum fold, sub-views, collapse per MAP §15 **referencing the FULL MAP §3 chrome+modal inventory** (SessionMenu, Watermark, card-settings, drawer, Complete variants — nothing dropped untracked); chrome mode-aware + threshold-derived copy; `session_state.phase` DEMOTED; unify the inconsistent test-error exits (MCQ returnPath vs Typed navigate(−1), MAP §14.7); absorbs [E1]/[E2-machine] | | hosting 🔵 |
| DF2-31 ⛔ | **Exit channel** `deriveWriteOutcomeView` — explicit `advanced:false`+reason (A1); DSF `day_guard_rejected` gap fix; **pre-authorized client inference: row-2-vs-row-3 disambiguation derives from `entryState` (server return carries no throttle/engaged fields — foundation:1575-1583); NO improvised server tweak** | Fable-B corr.9 | hosting 🔵 |
| DF2-32 ⛔ | **Messaging register rows 1-14** (quick-win rows re-home from DF2-07; row 15 = DF2-50) + **row 16: the forced retake-wall (`review_retake_required`) message** [C8] — row 2 copy disambiguated (throttle rolling-average ≠ per-test bar); **message ⇔ `reviewOnlyReason` 1:1 binding table + per-reason fixture ORACLE** (allocationZero copy NEVER renders for listComplete/reviewStudyResume) [Opus-A R-E]; `06_MESSAGING_COPY.md` (ko/en) reviewed first w/ Opus-B copy rules (no "frontier/segment" jargon → "next 20 words unlocked"; quarantine reframed non-disciplinary; row 3 forward-framed; timezone-safe); `carriedFrom` attribution derives from resolve `sources` (pre-authorized inference); seen-markers for event rows (4/14/15/16) | G2 net-new UX | hosting 🔵 |
| DF2-33 ⛔ | **Dashboard one-affordance** — hero + per-list unified on the ONE derivation; two-done-authorities closed; **state whether Dashboard gets a READ-ONLY assembly variant** (the G4 ordered-write pipeline must not run writes from a dashboard render) | Fable-B claim-2 note | hosting 🔵 |
| DF2-34 ⛔ | **Validation matrix + canary** — enumerated live-routed E2E matrix: every exit status × both test types × crash-recovery restore × every modal path × dual-class; canary/staged rollout (1 class → N) w/ defined regression signal + rollback; streak weekend-skip verify | Opus-A R-D; entry fixtures are NOT sufficient for the UI swap | 25WT → staged |
| DF2-35 ⛔ | **Teacher hold-visibility panel** (forced) — ClassDetail list of currently-held students + reason (review-only / below-gate / quarantined): the accountability surface teachers lack | Opus-B decision 6 | hosting 🔵 |
| DF2-36 ⛔ | **G-QUAR minimal blocking screen on the LEGACY UI** — build, deploy, behaviorally verify **BEFORE DF2-40** (fail-closed hard gate; the container absorbs it later). "DF2-32 or minimal" is not a gate | Codex S2 | hosting 🔵 |

## Wave 4 — Substrate [execution order: 47 → 41 → 40 → 46 → 42 → 43 → 44 → 45] 🔍
**Entry gates: DF2-05's R1/R2/R7/R8 closed · DF2-36 live · D3 certified + C1 live (inherited).**

| ID | Task | Notes / gates | Surface |
|---|---|---|---|
| DF2-47 ⛔ | **MODE-RECORD CONTRACT** (`08_MODE_RECORD_CONTRACT.md`) — the design gate Codex F1 blocks on: same student+list in forced class A + free class B against ONE canonical record — mode resolution (one-mode-wins-list-wide vs dual-write), per-mode field semantics (csd/reviewMode/recentSessions/day-guards), in-flight session invalidation/versioning, **flip mappings BOTH directions** (free→forced re-hydration: derive csd from twi+attempts, never read the frozen value; review-debt handling; **boundary-only flips, never mid-session** [Opus-A R-I]), transactional concurrency/idempotency for concurrent submits; **owns F2**: physical free frontier vs forced cycling virtual position/lap (no naive `min(twi,N)`; stable segment identity under pace change; attempt-range→picker mapping). 🔍 own convergence before DF2-42/43/50 | BLOCKS 42/43/50 | doc |
| DF2-41 ⛔ | **Frontier adjudication census** (`07_FRONTIER_CENSUS_PLAN.md` — 🔍 its own convergence = hard gate): 129 divergent / 27 active dispositioned via the FULL CS ritual (read-only → 25WT rehearsal → named per-student ledger → David authorization → derived/verified per-student values, never blanket max → sweep before/after) | Opus-A R-H | scripts 🔵 |
| DF2-40 ⛔⚠️ | **[D4/P5] Canonical migration + flip** — original gate text governs (MASTER D4): --catchup MED-3/4 · toolchain retarget (**DF2-40 OWNS it, pre-flip hard gate — `data-integrity-sweep.mjs`, `census-i4-pairing.mjs`, `manual-pass.mjs`**; DF2-62 = mode-awareness residuals only) · demotee ledger · 25WT rehearsal · fresh census+backup before/after · **carry `reviewMode` into canonicalDoc at hydration · apply the FIX-1 engagement gate to bestCsd** [C5] · off-peak David-authorized · **TOCTOU discipline: re-verify twi INSIDE the migration transaction + drift-diff vs pre-census that ABORTS on any change (the 27 keep studying)** [R-F] · **restore window: clean restore ONLY until the FIRST post-flip completion — named monitor owns that boundary** [R-G] · quarantine=0 acceptance · client-reader cutover per P5 plan | dual-purpose: single writer + frontier home | migration 🔵⚠️ |
| DF2-46 ⛔ | **Server unification + twin retirement** (the missing increment — Codex R1, Fable-A H1): shared-module/generated-copy boundary (flags/epoch/now/timestamps/policy as explicit inputs); route forced `completeSession` policy + `getDayNewPass` + engaged-paired-review reader + challenge/override policy through the ONE derivation + DF2-08 module; consolidate the 4-writer allocation math (studyAlgorithm:107 / foundation:913 / foundation:1861 / db:3038); **retire the flag-suppressed client twins** (progressService:160/570/663) + legacy client progression writers; equality-tested artifacts; full server re-cert; 🧭 **interventionLevel float fate decided here** (challenge-advance still scales by persisted float; hydration copies legacy floats) [M5] | after DF2-40, before 43/44 | functions 🔵⚠️ |
| DF2-42 ⛔ | **G-DUE scheduler BUILD** (design DF2-42d accepted) — per-word due engine; forced-compatible, free-primary | | functions+client 🔵 |
| DF2-43 ⛔ | **Server-owned frontier writer** — **own reviewed contract** (`09_FRONTIER_WRITER_SPEC.md`, Codex F3): callable name + auth/mode checks, immutable segment identity validated vs current frontier, attempt/idempotency contract, txn preconditions + concurrent submits, authoritative `passed:true` consumption, list-end clipping, **challenge/regrade/override/manual-pass frontier advancement** (current `overrideAttempt`/`advanceForChallenge` are day-based — NOT reusable unchanged; a corrected segment must advance or the student locks despite passed:true) [F4/M3], stale-client/mode-switch rejection + explicit exit status, canonical writes + audit logs. **Gates: DF2-40 flipped + DF2-41 applied + DF2-47 closed** | Fable-B corr.3 | functions 🔵 |
| DF2-44 ⛔⚠️ | **Rules lineage** (`05_RULES_LINEAGE.md`): **44a = [D5/P6]** with the FULL choreography restored by pointer (MASTER D5 + roadmap Track-2 row 5: `TEACHER_PROVISIONING_ENABLED` functions-redeploy FIRST → named P6 artifact (`audit/deepfix/task3/firestore.p6.rules`) + matrix + bundle-grep → rules deploy → THEN flip `ANCHOR_VALIDATION_ENFORCE` → starts P7 clocks; F1 Signup-train re-apply; 26SM quarantine=0 acceptance) · **44b = coexistence clauses** (free-mode reads/denied writes) · **the FINAL artifact re-baselines and SUPERSEDES the P10d draft; D8g's R3 is RE-POINTED at it; HARD interlock: no R3 deploy until this lineage is final** [Fable-B corr.2, Codex R5] · D8's own server-flag flips are foundation pin-moves — the "parallel" track SERIALIZES on the deploy artifact · off-peak | rules 🔵⚠️ |
| DF2-45 ⛔⚠️ | **[D9/P7] Retirement** — ≥14d post-rules + ≥7d zero `legacy_write_denied`; apply `phase7_retirement.patch`; delete `class_progress` (backups first); off-peak | verbatim | functions+data 🔵⚠️ |

## Wave 5 — Free-nav UI (DARK behind `navigationMode:'free'`) [gates: DF2-30/31/**33** live-or-DECIDE-0-dark · DF2-47 closed · DF2-42d accepted · DF2-43 spec final] 🔍

| ID | Task | Notes / gates | Surface |
|---|---|---|---|
| DF2-50 ⛔ | **Free branch of the derivations** — frontier fields + thin exit set + SegmentTest retake wall (row 15; consumes DF2-08; wall is on the NEW-segment test only — review never gates in free mode, `reviewPassThreshold` inert for free classes [M2]) | §10.2-10.4 | hosting 🔵 (dark) |
| DF2-51 ⛔ | **NavigateHub + free UX** — day/segment picker ({re-study, re-test, review-due}), offer + nudge, always-on Review, segment map, free hero CTA order, hub edge states, mode indicator, mixed-mode Dashboard (**builds ON DF2-33**); wireframe extension first; 🧭 **re-test gradebook semantics** (default: `type:'retest'`, non-advancing, original pass = accountability score) | Opus-B decision 4 | hosting 🔵 (dark) |
| DF2-52 ⛔ | **`navigationMode` teacher lever** — dark/disabled until program enables | | hosting 🔵 |
| DF2-53 ⛔ | **Teacher monitoring BOTH modes** — held-students panel follow-through + frontier-vs-expected pacing 🧭 (metric def) + mastery/due analytics + **mixed forced+free class view** (per-class metric sets, mode badge, no cross-mode global column) | Opus-B decisions 1/5 | hosting 🔵 |
| DF2-54 ⛔ | **PDF segment-based** + **PMv2 rail ruling 🧭** — PMv2 explicitly **non-progress / non-gradebook by default** (Codex caveat 4) or it recreates the fork; shared `practiceMode` rail | | hosting 🔵 |
| DF2-55 ⛔ | **Mode-flip student explainer** — one-time dismissible bilingual full-screen on first load after a flip (BOTH directions); pairs with DF2-47's boundary-only flip ceremony | Opus-B decision 3 | hosting 🔵 |

## Wave 6 — Train + activation 🔍 (final full-panel convergence)

| ID | Task | Notes / gates | Surface |
|---|---|---|---|
| DF2-60 ⛔ | **Release-train assembly + container ACTIVATION** (§12.1 stage 2; under DECIDE-0(b) also stage 1) — **build-identity binding**: golden/differential evidence ↔ deployed client bundle ↔ server callable set+flags ↔ rules artifact ↔ pilot config, one attested identity | Codex §3 | hosting 🔵 |
| DF2-61 ⛔ | **Activation ladder** — 25WT free class E2E → 🧭 pilot class → per-class enablement. **Gates: DF2-40/42/43/44 LIVE + the DF2-47 flip ceremony (boundary-only, re-hydration step) + state-loss analysis doc.** **Pilot success criteria (defined BEFORE pilot):** 4 weeks · zero integrity-sweep findings attributable to free mode · pilot-class CS tickets ≤ its own forced baseline · teacher confirms accountability (who's behind + who passed) · ≥X% of actives advance frontier via a PASSED segment test · no rollback triggered | Opus-B metrics | per-class config |
| DF2-62 ⛔ | **Docs + CS readiness residuals** — SUPPORT_RUNBOOK both-modes, help-site modes sections, CS toolchain **mode-awareness** (canonical retarget lives in DF2-40), token-diag predicate; **CS-metrics instrumentation**: baseline tickets/week per register class (4 pre-launch weeks from SUPPORT_RUNBOOK) → ≥60% reduction target on the quick-win classes → in-app "still confused → contact" tap for direct deflection measurement | quick-win TA updates already shipped w/ DF2-07 | 🔵 |

## Parallel deepfix1 tracks (own gates; serialize on shared artifacts)

- **[D6/P8] CONT-A** — shippable early; **ship BEFORE Wave 3 or fold INTO DF2-30** (same DSF Complete surface — don't run concurrent).
- **[D7/P9] Cycling** — post-rules; position model per DF2-47's F2 resolution.
- **[D8] P10 chain** — R3 re-pointed at the DF2-44 final artifact (hard interlock); D8a/D8e flag flips = foundation pin-moves, serialized with the wave track's deploy discipline.
- **PMv2** — David-locked plan; rail ruling at DF2-54; non-progress/non-gradebook condition binding.
- **M4 shadow clock** (ends ~2026-08-01) — gates DF2-44a; continuity asserted at every pin-move (DF2-04).
- **Grader thread** (DF2-06) — interleave rule with DF2-10.

## 3. Reconciliation table (v2 — corrected rows only; rest as v1)

| Deepfix1 item | Disposition |
|---|---|
| D4/P5 | ABSORBED → DF2-41+DF2-40 (census FIRST; hydration items + restore-window + TOCTOU restored to the card) |
| D5/P6 | ABSORBED → DF2-44a (full choreography by pointer; quarantine=0 + P7-clock-start restored) |
| E2 | ABSORBED → DF2-30 (machine) + **DF2-02a (the dead 7-export API, now named)** |
| E3 | **ABSORBED → DF2-08** (the policy resolver IS the module) |
| — NEW | **DF2-46 = the §5(c)/(d) server-unification + twin-retirement increment** (was missing entirely) |
| Housekeeping §4.3 | Wave 0 — incl. **(d) cite B2/B4 closures + PR-1 anecdote**; D3.5 report/FINDINGS honest reconciliation → DF2-05 scope |

## 4. Open decisions register 🧭 (David)

1. **DECIDE-0 · Ship model** — (a) incremental line (Wave-3 deltas live after DF2-34; recommended by Fable-C + Opus-B) vs (b) strict single-train (all visible change waits for DF2-60; Codex's literal reading of "ship together"). **Blocks Wave-3 production exposure, not the build.**
2. DF2-10: throttle-day review-gate y/n (retake-surface N resolved inside DF2-10).
3. DF2-02a: dead levers — wire or remove.
4. DF2-06: grader round 2 go + verbatim-vs-paraphrase intent.
5. DF2-42d: G-ENGAGED 0.8 for free-mode review RECORDING (closed inside the scheduler design).
6. DF2-46: interventionLevel float fate.
7. DF2-51: re-test gradebook semantics (default proposed) · hub layout/nudge strength.
8. DF2-53: free-mode pacing metric · mixed-class teacher view shape.
9. DF2-54: PMv2 rail ruling (with the non-progress condition).
10. DF2-61: pilot class selection.
11. **Forced-mode task selection** — is the day/segment picker intentionally free-mode-exclusive, or does forced mode get a bounded re-study/re-test affordance? (Opus-B: the majority cohort otherwise never gets goal 3.)
12. Free-mode challenge/tokens — default: identical machinery (segment tests are challengeable; weekly reset unchanged).
13. Streak definition — default: calendar-days-with-any-graded-activity, decoupled from day-completion (+ fixture: a daily free-mode studier keeps the streak).

## 5. Program exit criteria (v2)

One release line live where: forced mode byte-identical-verified through the container (approved deltas excepted, each named);
**every G-* gate computed at exactly ONE site — the client/server twins RETIRED (DF2-46) and the G-PASS module the only pass
predicate**; every hold/refusal/carry renders a reason (rows 1-16 live) with the **CS baseline→target metric met**; canonical
record single-writer with the frontier server-owned; ≥1 real class through the **defined pilot success criteria** in free mode
(pass-to-advance) on due-based review; rules lineage final (P10d superseded, R3 last, never bare-deployed); `class_progress`
retired; CS toolchain + docs speak both modes.

## 6. Round-1 convergence record (2026-07-25/26)

| Panelist | Verdict | Folded as |
|---|---|---|
| Codex r41 | UNSOUND-as-executable / direction SOUND | S1→DECIDE-0+Wave-3 reframe · S2→DF2-36 · S3→41-before-40 · S4→DF2-10 v2 · S5→DF2-02b · R1→DF2-46 · R2/R6→DF2-08 · R3/R4→DF2-40/44 restorations · R5→R3 interlock · F1/F2→DF2-47 · F3/F4→DF2-43 contract · F5/F6→DF2-42d |
| Fable-A | GAPS-FOUND | H1→DF2-46 · M1→DF2-03 · M2→DF2-42d/50 · M3→DF2-43 · M4→exemption fix · M5→reg.6 · M6→DF2-02a · M7→PMv2 track · L1-L6 swept |
| Fable-B | ordering GO w/ corrections | corr.1→DF2-10 · corr.2→DF2-44 · corr.3→DF2-43 gates · corr.4→Wave-4 order+gates · corr.5→DF2-08 · corr.6→Wave-5 gates · corr.7→DF2-42d · corr.8→DF2-06 · corr.9→DF2-31/32 seams · corr.10→DF2-02b |
| Fable-C | CONDITIONAL YES | C1/C2→DECIDE-0+§0 · C3→pin language · C4→exemptions · C5→DF2-40 · C6→§0 never-branch · C7→DF2-02a · C8→row 16 · C9→DF2-44a · N1-N12 swept |
| Opus-A | GO-WITH-CONDITIONS | R-A/B/C→DF2-10+DF2-04 · R-D→DF2-34 · R-E→DF2-32 oracle · R-F/G/H→DF2-40/41 · R-I→DF2-47/55/61 · R-J→§0 off-peak · R-K→DF2-04 · R-L→Wave-4 entry gates |
| Opus-B | delivered-but-back-loaded | quick-wins→DF2-07 · decisions 1-8→register/DF2-35/51/53/55 · copy rules→DF2-32/06_MESSAGING_COPY · metrics→DF2-61/62 · 50/30 fix→DF2-07(e) |

**Round-2 re-converge required before Wave-1 build authorization** (Codex's decision; panel re-runs on this v2).
