# TASK 1 REPORT — Deep analysis of issues (deepfix)

**Completed:** 2026-07-13. **Orchestrator:** Claude. **Workspace:** `audit/deepfix/task1/`.
**Deliverable of record:** `task1/ROOT_CAUSE_FINDINGS.md` (roots + live blast radius + convergence).

## What was done (per the plan's steps)
- **1.1** `issues_claude.md` — orchestrator's independent list (7 root clusters, ideal-app north star).
- **1.2** `issues_fable1.md` — independent fable agent (21 issues / 7 roots; found the G1 deploy landmine).
- **1.3** `issues_codex.md` — independent Codex investigation via the baton (18 issues / 5 roots; current-code
  corrections). Baton flip DEEPFIX_TASK1_ISSUES → Codex → handback (turnOwner=claude, idle now).
- **1.4** `CONSOLIDATED_ISSUES.md` (38 issues / 7 roots CR-1…CR-7, priorities, evidence tags) +
  `INVESTIGATION_PLAN.md` (F-1…F-14 empirical + I-1…I-10 code + waves + 6 Task-2 gates). **David's two
  directives folded in:** the empirical Firebase workstream + planning agents receive the exported data.
- **1.5** `H1_GATE_1.5.md` — PASSED. Every load-bearing claim traced to current code/data. Corrections below.
- **1.6** executed: **8 read-only empirical scans** (F-1/2/3/4/5/6/9/11) + **5 code investigations**
  (I-2/5/6/8/10) → `ROOT_CAUSE_FINDINGS.md`. Status tracker: `INVESTIGATION_STATUS.md`.

## Agent / scan outputs (all files, per H9)
| Artifact | Deliverable |
|---|---|
| issues_{claude,fable1,codex}.md | 3 independent issue lists |
| CONSOLIDATED_ISSUES.md / INVESTIGATION_PLAN.md | consolidation + executable plan |
| verification_ledger.md / H1_GATE_1.5.md | orchestrator H1 traces + gate sign-off |
| firebase/cs_manual_writes_catalog.md | audit of every CS manual write (H/P/B input) |
| firebase/CENSUS_SUMMARY.md + census_rows/classes/syslogs.json | census v1 (deepfix-census.mjs) |
| firebase/CENSUS2_FINDINGS.md + scan_F2/F3/F4/F9/F11.json | census v2 deep pass (deepfix-census2.mjs) |
| firebase/scan_F1_FINDINGS.md + scan_F1_syslog_attribution.json | syslog attribution (deepfix-f1-…mjs) |
| firebase/scan_F5_FINDINGS.md / scan_F6_FINDINGS.md + scan_F6_…json | config drift / tokens (deepfix-f6-…mjs) |
| investigations/inv_I{2,5,6,8,10}.md | code investigations |

## Verification outcomes (H1) — corrected / rejected claims (the load-bearing deltas)
1. **#9 and #10 are FIXED in the working tree** (uncommitted), not open defects — NEED_TO_FIX + issues_claude
   carried them open; fable+Codex corrected; orchestrator re-traced BOTH. I **corrected my own misread of the
   #10 ternary** (`TypedTest.jsx:983-985`). → both `fixed-in-tree-verify-deployed`.
2. **C-27 (#4-UX modal) also fixed-in-tree** (errCode-branched, de-alarmed) — found at the 1.5 gate.
3. **#10 "0 live occurrences" FALSIFIED** by F-1: day_guard_rejected fires for **6 real 26SM students**.
4. **impossible_phase_detected is NOT a direct #12 signal** (I-2 corrected the F-1 hypothesis): it is the
   reset/CS-drop family, class-scoped emitter `Dashboard.jsx:1464`, anomaly-weighted.
5. **C-19 permission gap is rules-scoped too** (I-10 corrected the orchestrator's 1.5 "UI-only" claim):
   3 stacked teacherId predicates incl. `firestore.rules:102-118`.
6. **testSizeMismatch 257 → 18 real** (F-2 killed the dual-enroll cross-class attribution noise).
7. **"104 stranded" → ~42 live** (F-3 split by active-doc: 36 LIVE-STRAND + 6 divergent; 72 latent).
8. **G1 nonce root cause CONFIRMED end-to-end** (I-5): `TypedTest.jsx:767` vs `:869-870` docId divergence.
9. **The review-only plan §5 cites DEAD code** (I-2: `DailySessionFlow.jsx:800-816`; live is `:590-623`).
10. **F-11 census-tension resolved:** twi>mastery is rare (4), 2 are documented patches.
11. Kept OUT (all three lists agree not-bugs): 오하린 640-carry, 손지성 Day-2, 12/12 remainder, review-non-gating
    by design, non-VocaBoost tickets.

## The final verified issue set
The 7 roots (CR-1 progress-identity · CR-2 day-state · CR-3 grading/recourse · CR-4 review-model · CR-5
client-re-derivation · CR-6 write-authority/G1 · CR-7 observability) with live blast radius and convergence are
in `ROOT_CAUSE_FINDINGS.md`. Headline: **H=541 / P=45(24 re-stuck) / B=188**; the data is not corrupt; most
damage is fixed-in-tree-but-undeployed (a **safe hosting-only** deploy per I-5); the structural remainder collapses
onto **one migration** (I-6: student-owned progress + server-authoritative twi).

## Open / deferred (honest ledger)
- **#12 mechanism UNPINNED** — needs the I-1 instrumented repro; **env-blocked** (WSL can't run Vite/Playwright)
  → Codex/David runs it, or the foundation moots it.
- **#13 path UNPINNED but SIZED (18)** → I-3 (deferred, moderate). Grader calibration breadth → F-7+I-4 (deferred).
- Deferred sharpening scans: F-7/F-8/F-12/F-13/F-14; impossible_phase 531-state classification (I-2's pin-check).
- **Config drift (F-5, 12 assignments) and any data fix = SURFACED AS PROPOSALS ONLY** (David: no live writes /
  no CS tickets this program). No live writes were made — the entire investigation was read-only.

## Environment / process notes
- All live-Firebase work was **READ-ONLY** from WSL (`NODE_PATH=/app/node_modules node scripts/cs/deepfix-*.mjs`);
  egress confirmed; new read-only scripts: `deepfix-census.mjs`, `deepfix-census2.mjs`,
  `deepfix-f1-syslog-attribution.mjs`, `deepfix-f6-tokens.mjs`. Agents had NO live access (analyzed exports).
- Baton IDLE (turnOwner=claude). No background agents/watchers left running at Task-1 close.
- Nothing committed / branched (David: local-uncommitted, no branches).

## Next: Task 2 (plan the fixes)
Per I-6's phase order, gated by I-5's deploy checklist + the F-4 H/P/B before/after metric. Task 2 opens with a
fable agent drafting `task2/FIX_PLAN.md` from ROOT_CAUSE_FINDINGS + CONSOLIDATED_ISSUES, then the Codex baton loop.
