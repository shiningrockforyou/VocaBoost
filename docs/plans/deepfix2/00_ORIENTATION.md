# DEEPFIX 2 — Orientation (2026-07-25)

> **What this is:** the consolidated forward program that merges (a) the REMAINDER of the deepfix server-authoritative
> cutover, (b) the unified session-state container, (c) ~~free-navigation as a per-class mode~~ → the UNIVERSAL day-structured model (R2-24/26/27), and (d) the UX/status-messaging
> layer — into ONE plan of record with one task list (`02_TASK_LIST.md`). David-directed 2026-07-25.
> **Companions:** `01_SOURCES.md` (every relevant document/file) · `02_TASK_LIST.md` (the consolidated task list).
> **Status (2026-08-01, post-checkpoint-1): DECISIONS COMPLETE — the plan of record is v5, matched to the
> binding ledger (`deepfix2/11_` §1, R2-1..R2-47; ratified through Codex r48 + the r50-r56 closures).** THE MODEL IS UNIVERSAL (one model, no per-class
> modes — see §3 supersessions): day-structured, free within the day, backward re-study/re-test, BOTH tests gate
> day-advance. THE LAUNCH = DF2-14 (one audited cohort-wide flip: gate ON@92 + redesign + label backfill).
> Authorization = the §4 matrix (post-r48 reissue); production/backfill/activation arrive at David's
> ask-at-implementation gates. Rounds 6-8 COMPLETE (2026-07-26/27): r49 → correction fold → r50 → residue fold → r51 + panel (R2-38 ratified by David) → r52 + final panel: **PRESENTABLE — presented 2026-07-27**.

## 1. Goals (plain language)

1. **Finish the deepfix**: complete the server-authoritative cutover that deepfix1 carried through D3/P4 (certified) —
   the one-way data migration (P5 canonical), rules lockdown, and retirement — because both the unified container and
   the universal model's delivery (E4's successor — DF2-14 + the container line) stand on that foundation
   (single-writer record, server-owned frontier).
2. **One session container**: replace the ~13 redundant screens / 12-site duplicated derivations with ONE
   `deriveSessionState` (entry) + ONE `deriveWriteOutcomeView` (exit) + ONE `<SessionStage>` — the audited design in
   `UNIFIED_SESSION_STATE_ARCHITECTURE.md` §1-§12 + `UNIFIED_SESSION_STATE_MAP.md`.
3. ~~Two modes, one system~~ → **ONE UNIVERSAL MODEL (R2-24/26/27, 2026-07-26): day-structured for every class;
   free movement within the day; backward re-study/re-test; BOTH tests gate day-advance at the class threshold
   (review default 92, ON at launch). The per-class `navigationMode`/COEXISTENCE architecture is OBSOLETE; the
   binary throttle is RETIRED (D-1); ENGAGEMENT is retired as a completion criterion (R2-11).**
4. **Kill the black boxes**: ship the status-messaging register — every hold/refusal renders a reason + next step, ENGLISH-ONLY per R2-44 (ARCH §12.3 rows 4-14 + 16 = DF2-32; rows 1-3 retired [D-1 + R2-11]; row 15 re-homed to DF2-32 (past-day-browser messaging — DF2-50 dissolved [R2-24]); row 16 = the retake-wall) so every hold/refusal/carry renders a bilingual reason + next step — targeting the real CS ticket classes
   (SUPPORT_RUNBOOK), with the quick-win subset pulled forward to Wave 0 (DF2-07).
5. **Two trains (post-R2):** THE LAUNCH (DF2-14) = the review redesign's ONE audited cohort-wide flip; the
   CONTAINER line = SINGLE-TRAIN (DECIDE-0 CLOSED = (b), R2-25) assembling at DF2-60. Byte-identity absolute except
   each train's named delta set (the launch set lives on the DF2-14 card).

## 2. Where deepfix2 picks up from (verified deepfix1 position, per MASTER_TASK_LIST.md)

- **DONE / LIVE:** A (prep) · B (decisions) · C (PR-1/2/3 — pairing V2, engagement stamp, binary throttle hold-csd) ·
  D1 · D2/P3 (server surface, 7 flags, M4 shadow clock running ~ends 2026-08-01) · **D3/P4 CERTIFIED** (10/10 behavioral
  cert; functions pinned `0ddbb34`, client `6bffe1c`; posture GO-HOLD, no rollback signal).
- **IN FLIGHT:** D3.5 recovery/adversarial audit (13 behaviors validated; the hardened to-do list is
  `D3.5_RISK_REMEDIATION.md` v2, R1-R16). Grader thread: r63 prompt fix live (`0992f5f`), but the 홍석현
  verbatim-English false-negative family re-opened it — prompt fix round 2 pending David's go (parallel CS track).
- **NOT STARTED (deepfix1 remainder — absorbed by this program):** D4/P5 ⚠️ one-way canonical migration · D5/P6 rules
  cutoff · D6/P8 continuation (shippable early) · ~~D7/P9 cycling~~ (retired R2-39) · D8 P10 teacher-permissions chain · D9/P7 retirement ·
  E1-E4 backlog (E2's machine → the container, its dead-API deletion → DF2-02a; **E1 day-dispatch → DF2-46**
  (`deriveCompletionDecision`); **E3 → DF2-08** (the policy module — gate-override vs its old "(after D5)" approved,
  task list §3); E4 free-nav → the UNIVERSAL MODEL (R2-24/26/27): delivered via DF2-14 + DF2-51-in-train + the container line; ~~design track~~ retired).
- **BANKED, now activated by this program:** (Item A) review-pass threshold gate — plan Codex-verified ×2
  (`D3.5_WORKITEM_review_pass_threshold.md`), sequenced FIRST (§8-G6: it edits the same lines the extraction touches).
  (Item D) the unified container — design 5/5-converged + 3×Fable-audited; its build increments are Waves 2-3.

## 3. Governing architecture decisions (closed) — open EXECUTION/PRODUCT decisions live in the task-list §4 register [r43 L9]

| Decision | Answer | When |
|---|---|---|
| FREENAV direction | ~~COEXISTENCE (2026-07-17)~~ → **SUPERSEDED: ONE UNIVERSAL MODEL — no per-class modes (R2-27 Q2, explicit owner reversal)** | **2026-07-26** |
| Forced-mode pass-to-advance | YES | deepfix1 B2 |
| ~~Free-mode pass-to-advance~~ | ~~YES — frontier advances only on a passed segment test~~ **SUBSUMED (R2-24c/26): BOTH tests gate day-advance in the ONE universal model; the frontier concept dissolved with DF2-43** | **2026-07-25 → superseded 2026-07-26** |
| Ship model | **CLOSED: SINGLE-TRAIN (R2-25)** for the container line; the review redesign = its own earlier one-flip train (DF2-14, R2-26 Q6) | **2026-07-26** |
| Throttle policy (forced) | ~~BINARY (reviewMode → 0 new words, hold-csd), David-locked 07-16~~ → **SUPERSEDED by D-1: throttle REMOVED entirely** (rides DF2-10's pin-move; review-pass gate is the sole mechanism) | **2026-07-26 (D-1)** |
| Continuation/list-end | the list-end END SCREEN offers `nextListId` [R2-39]; ~~cycling on re-select~~ RETIRED (R2-39 — zero live usage; restudy = the R2-40 package) | deepfix1 B4 → R2-39 |
| BlindSpot | **Hide FINAL (R2-22)**; 21-day data model KEPT (feeds the labels/mastery cycle; G-DUE itself cancelled R2-27) | 2026-07-24 → **2026-07-26** |
| Review-pass gate | **STARTS ON at 92 for every class-list at the flip; teacher-tunable after (R2-14/R2-26)**; graduation/labels per the addendum v4 FINAL; kill-switch law R2-32/r48 | **2026-07-26** |

## 4. Standing constraints (inherited unchanged from deepfix1 — BINDING)

- **26SM (~907 real students — CS-2026-07-26 probe count) is live: read-only diagnosis; NO writes without explicit authorization. 25WT = sandbox.**
- **Commit on `main`, never branch.** A passed `new` attempt is the CSD/TWI anchor (`twi = newWordEndIndex + 1`).
- **Deploys route through WinClaude** (WSL has no push/firebase creds). The **CERTIFIED CORE** (completeSession/
  resolveListProgress via `foundation.js`) is pinned `0ddbb34`; `gradeTypedTest` (`0992f5f`, r63) and `submitChallenge`
  (`6094cdd`, r65) already moved surgically under the same discipline. Any CORE move is deliberate, David-authorized, from
  a CLEAN tree (resolves R-2), with behavioral re-cert on the new pin — and **a `foundation.js` edit is never surgical**:
  it requires the full no-skew callable set + post-deploy same-commit check (task list §0).
- **Rules:** never bare-deploy; never deploy the repo `firestore.rules` (P10d end-state draft); every rules change is a
  named artifact in a reviewed lineage.
- **One-way doors (P5 migration, P6 rules, P7 retirement):** fresh reinstatable backup + 25WT rehearsal + census
  before/after + a fresh Codex-GO'd, David-authorized plan — per door, at execution time.
- **Byte-identity falsifier:** forced-mode behavior provably identical (golden/differential fixtures) **until a wave
  EXPLICITLY changes it via its named approved-delta list** (C2 resolution — Wave 3's deltas: messaging, one-affordance,
  chrome/derived copy). The falsifier is what makes the release line safe for 26SM.
- `git add -A` hazardous (CRLF renorm); targeted adds only. Logging: code → `change_action_log.md` · CS/data →
  `SUPPORT_RUNBOOK.md` · task actions → `MASTER_TASK_TRACKER.md` (deepfix2 items use their DF2-IDs there).

## 5. Relationship to deepfix1 documents

- `MASTER_TASK_LIST.md` remains the **deepfix1 record** (everything through D3/D3.5 + the banked items' history). It gains
  a pointer here; its REMAINING items (D4-D9, E1-E4) are absorbed into `02_TASK_LIST.md` with their original IDs cited —
  **their gates travel intact, and v3 ADDS gates/resequencing on top** (census-first, atomic deploy sets, TOCTOU — task
  list §0/§6/§7); the two approved gate-overrides (E3's "(after D5)", the DF2-08 sequencing) are named in §3.
- `CONSOLIDATED_ROADMAP_2026-07-17.md` Track-2 (the DEPLOY_ORDER spine) is the skeleton Waves 4+ inherit.
- Where any deepfix2 doc disagrees with an audited source (`UNIFIED_SESSION_STATE_MAP.md` is 3×-audited ground truth),
  **the audited source wins** and the task list gets corrected. **Post-R2 caveat: the DECISION LEDGER (`deepfix2/11_` §1, R2-1..R2-47) outranks everything — the audited docs stay ground truth for CODE ANATOMY, but their superseded design content (modes, levers, engagement, G-DUE) yields to the ledger.**

## 6. Convergence protocol for THIS program

Per David 2026-07-25: **everything goes through the convergence audit = 3 Fable + 2 Opus + Codex** (WSL synthesizes; WinClaude
is deploy executor, not a standing critic). Lenses: completeness (Fable-A) · sequencing/dependencies (Fable-B) ·
deepfix1-reconciliation fidelity + internal consistency (Fable-C) · live-cohort risk/safety (Opus-A) · product/scope fit
(Opus-B) · architecture + sequencing (Codex, baton round 41). Verdicts fold into these docs before any build starts; the
same 6-way panel re-runs at each wave boundary marked 🔍 in `02_TASK_LIST.md`.

**Round 1 RAN 2026-07-25/26** (Codex r41 + 5 internal → task list §6; v2 = that fold). **Round 2 RAN 2026-07-26**
(Codex r42 + 5 internal → task list §7; v3 = that fold). **Round 3 RAN 2026-07-26** (Codex r43 fold-verification:
plan-of-record ACCEPTED, Wave-0 partial GO, Wave-1 needs fixes) — **v4 = that fold** (+ David D-1..D-4 + the
last-exchange findings; task list §8; v3 archived). Authorization is TASK-SCOPED (task list §4 matrix — r43 M6):
~~Wave-0 GO rows build now; Wave-1 waits on the bounded r44 + register item 15; DECIDE-0 gates Wave-3 exposure only~~ (v4 tail — the CURRENT instrument = the §4 post-r48 REISSUE in the task list).

**Post-R2 record (2026-07-26):** Round 4 = r44 (D-1..D-4 fold-verification). The R2 DECISION ROUNDS = r46
(decision-state check) · r47 (owner-answer adjudication) · r48 (final ratification → FOLD GO) — David's answers =
the ledger `11_` §1 (R2-1..R2-47; R2-38..47 ratified post-presentation, through 2026-08-02). The mechanical fold ⇒ v5 + addendum v4 FINAL. **Round 6** = fold verification
(3-Fable FF1/FF2/FF3 + Codex r49, simultaneous): NOT-YET-PRESENTABLE → the bounded CORRECTION FOLD (applied,
change-log 2026-07-26). **Round 7** (4-entity per David's standing order: 3 Fable via Workflow + Codex r50, handed off AS the agents
launch) → the residue fold → **round 7b** (r51 + closure panel; r51-B1 → **R2-38 ratified by David 2026-07-27**;
streak semantics frozen) → **round 8** (r52 + final panel): **PRESENTABLE — presented 2026-07-27.** Panel lenses:
ledger fidelity · executable coherence · ecosystem consistency · fresh-eyes.
