# Batch B_LIST_PROGRESS_PHASE1_UI — LIST_SCOPED_RECON Phase 1 (Runs L + S)

**BINDING POLICY:** `docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md` — read it first; it
overrides anything here on execution rules. Summary of the non-negotiables:
- UI-only interaction: semantic locators, visible controls, real navigation. **NO `page.evaluate` /
  injected JS / storage access / request interception / deep-links to internal routes / `{force:true}`.**
- Admin SDK: **read-only snapshots only** — ONE pre-audit snapshot before any browser opens, ONE
  post-audit snapshot after all browsers close. Never create/update/delete/reset/seed. Never concurrent
  with a browser scenario.
- Personas are **forward-only disposables** prepared through ordinary UI flows (or pre-existing sandbox
  accounts verified read-only). Un-reproducible states (P-PAIR/P-ORPHAN/P-SPARSE without natural
  candidates) are reported **"not UI-reproducible under this audit policy"** — never manufactured.
- Two deployed builds: Run L (flag OFF — current), Run S (flag ON — quiet window). Never flip the flag
  from Playwright. Run S requires all SEVEN attempts indexes ready first.

**Scripts** (this directory's parent): `lsr_ui.mjs` (compliant primitives) · `lsr_snapshot.mjs`
(read-only pre/post evidence) · `lsr_runL.mjs` · `lsr_runS.mjs`.
**Findings:** `audit/playwright/findings/B_LIST_PROGRESS_PHASE1_<runid>.md` per `FINDINGS_TEMPLATE.md`.

---

## MANDATORY FINDINGS PROTOCOL (David, 2026-07-05)

**Record ANY AND ALL bugs that surface — including ones this audit was not looking for.** Anything
anomalous is a finding: console errors, layout breakage, wrong copy, a flickering day badge, slow loads,
a confusing state, an unrelated feature misbehaving mid-flow. Rules:
1. Every anomaly gets a numbered finding (F01…) in the findings file, template format, severity graded
   BLOCKER/HIGH/MEDIUM/LOW/NITPICK — **even if out of scope for Phase 1** (tag `[out-of-scope]` but file it).
2. The runners auto-append raw anomalies (console errors, unexpected error text, failed assertions,
   pages that don't settle) to the findings file; the operator must then triage EVERY entry into a
   proper finding — none may be dropped as "noise" without a written one-line justification.
3. "All passed" findings files must say so explicitly (empty file = smell, per template).
4. Out-of-scope bugs additionally get a one-line pointer added to `NEED_TO_FIX.md` triage or the batch
   findings index, so they survive the audit.

---

## CS-LOG FAILURE TRACEABILITY MATRIX

Every failure mode from `SUPPORT_RUNBOOK.md` / `NEED_TO_FIX.md` that is relevant or tangential to the
Phase-1 deployment, mapped to a case. "EXT-" cases extend the policy doc (same rules).

| # | Source (CS log / NTF) | Failure mode | Case | Notes |
|---|---|---|---|---|
| 1 | CS-2026-06-30 (이주헌), CS-2026-07-02b (손진욱/박주하) | class change resets day / re-feeds words | **S1, S2** | the core Phase-1 fix |
| 2 | CS-2026-07-03 (김나연), CS-2026-07-03b (김호형), NTF #5 | genuine pass (92–94%) DISPLAYED as fail (retakeThreshold default; dual-class resolution) | **EXT-1** (asserted in EVERY pass across L & S: results screen must show PASS whenever score ≥ class threshold; extra weight on dual-class personas P-L2/P-DUAL) | code untouched but same display path; dual-class surface changes flag-on |
| 3 | CS-2026-06-29-A, NTF (nonce/webview) | "Couldn't Save Your Results" / Retry Save dead | **EXT-2** (every submission asserts the saved-results screen appears and NO submitError modal; observational — root cause environmental) | |
| 4 | CS-2026-06-22/23, CS-2026-06-28, NTF #3 | "Grading Failed" loop; crash-recovery malform (thin word pool); listId:null | **EXT-3** mid-test reload → resume via recovery → submit → grades successfully, no gradingError loop (precedent: batch B06/B29) | completion path is adjacent to Phase-1 edits |
| 5 | CS-2026-06-21 (invalid anchor rule) | attempts written without anchor fields | **EXT-4** post-snapshot: every `new` attempt from the runs carries nwsi/nwei/testId/wordsIntroduced; zero `csd_anchor_invalid` logs for audit personas | |
| 6 | CS-2026-06-22 (손지우) | impossible session state (phase=review-study + newWordsTestPassed=false) | **EXT-5** post-snapshot session-coherence assertion after every mutating case | |
| 7 | 2026-06 reconciliation era (orphan cleanup) | valid reviews deleted by reconciliation | **S7** (flag-on: log-only) + **EXT-6** (Run L post-snapshot: zero `orphaned_attempt_deleted` for audit personas during the run) | |
| 8 | CS-2026-06-29-D (김선아) | confirm-modal buttons dead | **EXT-7** observational: every confirm modal in the flows responds to its buttons; root cause (webview freeze) not reproducible — note only | |
| 9 | CS-2026-06-24b/-06-28b (박시은), nice-to-haves #3b | default list silently flips to newest-assigned | **EXT-8** observational on multi-list personas: default list unchanged by the runs (fix de-scoped; regression watch only) | |
| 10 | CS-2026-06-25 (조예서), CS-2026-07-02 (곽경훈), NTF #1 | challenge accept / teacher override day-advance | **DEFERRED with reason:** `reviewChallenge` is untouched in Phase 1 and flag-off identical; its flag-on boundary-guard interaction is plan §7.1 (Phase 2 surface). Post-flip observational note only. |
| 11 | CS-2026-07-04/-04b | threshold outliers (74/90/93) | moot — cohort normalized to 92/0.92; sandbox classes use 92 except where a case tests launching-class policy (policy §3) |
| 12 | CS-2026-06-28b (SUMMIT fallback) | unpinned-list fallback exposes wrong list | out of scope — teacher config/ops procedure, no Phase-1 code adjacency; noted |
| 13 | batches B12 precedent | multi-tab double-submit races | **S3, S9-T, S9-M, S10** | |
| 14 | NTF #4 (provenance) | deployed code ≠ repo | **PRE-GATE** (before any browser): `version` callable sha vs HEAD + client bundle markers — node-side deploy verification, not part of a browser scenario | |
| 15 | NTF #6 quarantine/migration/reset | — | **NOT in Phase 1** (policy §10 defers) — do not claim |

Anything NOT in this table that surfaces during runs → findings protocol above (rule: file it anyway).

---

## Persona plan (policy §5) — forward-only, UI-prepared

Pre-snapshot (`lsr_snapshot.mjs --pre`) classifies the existing 50 seeded 25WT accounts read-only and
proposes assignments; the operator confirms before running:

- **P-L1 / P-L2:** pick from existing seeded accounts whose snapshot state matches (fresh single-class /
  dual-enrolled with progress in A). No resets — pick accounts already in the right state; if none, use
  a never-used seeded account and ADVANCE it via UI (forward-only).
- **P-MOVE / P-DUAL / P-JOIN / P-STALE-T / P-STALE-M:** need the two sandbox classes (A: small pace,
  B: larger pace, same list, typed + MCQ variants — policy §3). Prep = teacher UI session (create/assign/
  configure through visible controls) + student UI joins via class code. This is the **PREP phase**, run
  once before Run S, itself UI-only. Each stale/join case gets its OWN disposable persona (forward-only).
- **P-PAIR / P-ORPHAN / P-SPARSE:** natural candidates only. The pre-snapshot searches the sandbox
  read-only for qualifying histories (mixed-class days, review-beyond-anchor, passed-new missing
  newWordEndIndex). None found → report the case **not UI-reproducible / unavailable** (policy §5, §11).

## Run order

1. PRE-GATE deploy verification (node, no browser).
2. `lsr_snapshot.mjs --pre` (Admin read-only; then Admin process EXITS).
3. Run L: `lsr_runL.mjs` (flag-OFF build) — L1, L2, EXT-1..8 woven in.
4. `lsr_snapshot.mjs --post` → diff vs pre; EXT-4/5/6 assertions run here.
5. [Owner deploys flag-ON build in quiet window; 7 indexes verified ready]
6. PREP phase (UI-only persona building) → fresh `--pre` snapshot.
7. Run S: `lsr_runS.mjs --flag-on-deployed` — S1–S3, S5–S7, S9-T/M, S10 (+S4/S8 if natural personas).
8. `--post` snapshot + diff; findings file finalized; acceptance gate per policy §11.

Viewport/theme coverage (policy §9): the runners repeat the core happy path + S9 at 1440×900 and a
mobile viewport, light+dark where the theme toggle is reachable via UI.

---

## Codex-doc completeness adoptions (second pass, 2026-07-05)

A line-by-line re-diff of the Codex policy doc against the implementation adopted six items that the
first build missed:
1. **MCQ driving** (`answerMcqVisible`/`submitMcqAndObserve`, radio-based per B02 precedent) — L1's
   "MCQ submission remains usable" pass condition gets its own case (**L1-M**, persona `P_L1_MCQ`), and
   **S9-M** now actually drives the MCQ page (both pages consume the rebuild sentinel, policy §8).
2. **Run metadata block** (policy §3): deployment URL, build sha, flag value, browser/version, viewport,
   start/end times, persona ids — recorded in every run report.
3. **Per-case visible-action step logs** (policy §4.5) via `F.step()` into the findings file.
4. **Persona login preflight** (policy §5): every configured persona is logged in via the UI before any
   case runs; failures block with a case-level finding.
5. **S7/S8 runner cases** implemented (natural-persona-gated; skip messages cite the exact policy clause
   and the code-review coverage: [C5-2] orphan log-only, [V7/P1r4-2] sparse fallback).
6. **§9 UX pass**: `--mobile` re-runs core cases at 390×844; `--dark` attempts the visible theme toggle;
   the remaining §9 items (Korean copy wrapping, focus visibility, horizontal overflow) are
   **screenshot-review checklist items** for the operator — they cannot be asserted without injected JS,
   which the policy forbids. Optional context video available via `newAuditPage(..., video=true)`.

**Deletion-failure UI branch (policy §8):** covered by **code review** — the `sessionCleared:false`
distinct message was implemented and Codex-verified in Phase-1 fix round 4 [P1r4-1]; this audit does not
force a deletion failure (forbidden) and will assert the message only if it occurs naturally.
**L1 fidelity note:** "Skip to test" is a visible student control and is used to keep runs tractable;
a full card-flip variant is a documented option if the operator wants maximum fidelity.
`wordmap.json` copied into `audit/playwright/` (reference data; no dsg-edits dependency).
