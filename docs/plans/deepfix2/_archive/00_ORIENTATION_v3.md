# DEEPFIX 2 — Orientation (2026-07-25)

> **What this is:** the consolidated forward program that merges (a) the REMAINDER of the deepfix server-authoritative
> cutover, (b) the unified session-state container, (c) free-navigation as a per-class mode, and (d) the UX/status-messaging
> layer — into ONE plan of record with one task list (`02_TASK_LIST.md`). David-directed 2026-07-25.
> **Companions:** `01_SOURCES.md` (every relevant document/file) · `02_TASK_LIST.md` (the consolidated task list).
> **Status: DESIGN/PLANNING — pending the 6-way convergence audit (3 Fable + 2 Opus + Codex) before anything builds.**

## 1. Goals (plain language)

1. **Finish the deepfix**: complete the server-authoritative cutover that deepfix1 carried through D3/P4 (certified) —
   the one-way data migration (P5 canonical), rules lockdown, and retirement — because both the unified container and
   free-nav stand on that foundation (single-writer record, server-owned frontier).
2. **One session container**: replace the ~13 redundant screens / 12-site duplicated derivations with ONE
   `deriveSessionState` (entry) + ONE `deriveWriteOutcomeView` (exit) + ONE `<SessionStage>` — the audited design in
   `UNIFIED_SESSION_STATE_ARCHITECTURE.md` §1-§12 + `UNIFIED_SESSION_STATE_MAP.md`.
3. **Two modes, one system**: `navigationMode: 'forced' | 'free'` per class. Forced stays the default (binary throttle,
   day-gated, pass-to-advance). Free = frontier-based navigation (day/segment picker, always-on review, offered-never-forced
   segments) with **pass-to-advance = YES** (decided 2026-07-25) — the teacher pass-contract survives in both modes.
4. **Kill the black boxes**: ship the status-messaging register (§12.3's 15 rows + row 16, the forced retake-wall — task
   list DF2-32) so every hold/refusal/carry renders a bilingual reason + next step — targeting the real CS ticket classes
   (SUPPORT_RUNBOOK), with the quick-win subset pulled forward to Wave 0 (DF2-07).
5. **One release LINE, activation staged** (reworded post round-1 — C1/C2): the container lands via gated increments and
   the free branch rides dark from Wave 5; the Wave-6 train is where BOTH branches co-ship and free-nav never ships without
   the container. **What reaches production before Wave 6 is 🧭 DECIDE-0** (task list §4.1): incremental-line (Wave-3 deltas
   live after validation — Fable-C/Opus-B recommendation) vs strict single-train (all visible change waits for DF2-60 —
   Codex's literal reading). Byte-identity is absolute EXCEPT the per-wave approved-delta list, each delta named.

## 2. Where deepfix2 picks up from (verified deepfix1 position, per MASTER_TASK_LIST.md)

- **DONE / LIVE:** A (prep) · B (decisions) · C (PR-1/2/3 — pairing V2, engagement stamp, binary throttle hold-csd) ·
  D1 · D2/P3 (server surface, 7 flags, M4 shadow clock running ~ends 2026-08-01) · **D3/P4 CERTIFIED** (10/10 behavioral
  cert; functions pinned `0ddbb34`, client `6bffe1c`; posture GO-HOLD, no rollback signal).
- **IN FLIGHT:** D3.5 recovery/adversarial audit (13 behaviors validated; the hardened to-do list is
  `D3.5_RISK_REMEDIATION.md` v2, R1-R16). Grader thread: r63 prompt fix live (`0992f5f`), but the 홍석현
  verbatim-English false-negative family re-opened it — prompt fix round 2 pending David's go (parallel CS track).
- **NOT STARTED (deepfix1 remainder — absorbed by this program):** D4/P5 ⚠️ one-way canonical migration · D5/P6 rules
  cutoff · D6/P8 continuation (shippable early) · D7/P9 cycling · D8 P10 teacher-permissions chain · D9/P7 retirement ·
  E1-E4 backlog (E2's machine → the container, its dead-API deletion → DF2-02a; **E1 day-dispatch → DF2-46**
  (`deriveCompletionDecision`); **E3 → DF2-08** (the policy module — gate-override vs its old "(after D5)" approved,
  task list §3); E4 free-nav is the program's design track + Waves 4-6).
- **BANKED, now activated by this program:** (Item A) review-pass threshold gate — plan Codex-verified ×2
  (`D3.5_WORKITEM_review_pass_threshold.md`), sequenced FIRST (§8-G6: it edits the same lines the extraction touches).
  (Item D) the unified container — design 5/5-converged + 3×Fable-audited; its build increments are Waves 2-3.

## 3. Governing decisions (all closed — the program builds on these)

| Decision | Answer | When |
|---|---|---|
| FREENAV direction | COEXISTENCE — per-class option, forced default | 2026-07-17 (B1) |
| Forced-mode pass-to-advance | YES | deepfix1 B2 |
| **Free-mode pass-to-advance** | **YES** — frontier advances only on a passed segment test | **2026-07-25** |
| Ship model | ONE release LINE; Wave-6 both-branches co-ship; **pre-Wave-6 production exposure = DECIDE-0, OPEN** (task list §4.1) | 🧭 OPEN |
| Throttle policy (forced) | BINARY (reviewMode → 0 new words, hold-csd) | David-locked 07-16 |
| Continuation/list-end | auto-advance nextListId; cycling on re-select (B4) | deepfix1 B4 |
| BlindSpot | HIDDEN from UI (survival undecided); 21-day data model KEPT (it seeds the G-DUE scheduler) | 2026-07-24 (§11.1) |
| Review-pass gate | build (default-OFF lever `reviewPassThreshold`) — **1 open sub-decision** (throttle-day y/n, register §4.2; retake-surface resolves inside DF2-10) | banked 07-19, activated here |

## 4. Standing constraints (inherited unchanged from deepfix1 — BINDING)

- **26SM (~824 real students) is live: read-only diagnosis; NO writes without explicit authorization. 25WT = sandbox.**
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
  **the audited source wins** and the task list gets corrected.

## 6. Convergence protocol for THIS program

Per David 2026-07-25: **everything goes through the convergence audit = 3 Fable + 2 Opus + Codex** (WSL synthesizes; WinClaude
is deploy executor, not a standing critic). Lenses: completeness (Fable-A) · sequencing/dependencies (Fable-B) ·
deepfix1-reconciliation fidelity + internal consistency (Fable-C) · live-cohort risk/safety (Opus-A) · product/scope fit
(Opus-B) · architecture + sequencing (Codex, baton round 41). Verdicts fold into these docs before any build starts; the
same 6-way panel re-runs at each wave boundary marked 🔍 in `02_TASK_LIST.md`.

**Round 1 RAN 2026-07-25/26** (Codex r41 + 5 internal → task list §6; v2 = that fold). **Round 2 RAN 2026-07-26**
(Codex r42 + 5 internal → task list §7; **v3 = that fold**, v2 archived). Remaining before Wave-0/1 build authorization:
Codex r43 fold-verification + David's DECIDE-0 + register items 2/3/4.
