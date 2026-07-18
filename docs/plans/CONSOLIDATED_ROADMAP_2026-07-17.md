# VocaBoost — CONSOLIDATED Roadmap, grounded in the LIVE deploy (2026-07-17)

**This is the single reconciled roadmap.** It supersedes `CONSOLIDATION_ROADMAP_2026-07-17.md` (which was built on a
FALSE "deepfix undeployed" premise), folds in `CS_2026-07-17_ROOT_CAUSE_EFFORT.md` (PR-1/2/3), and puts the **deepfix
program** (`audit/deepfix/`, `task3/DEPLOY_ORDER.md`) back at the center as the authoritative spine — because the deepfix
IS the "consolidation." Every fact below was verified live by 4 Fable agents (RC-1..4) + orchestrator probes on 2026-07-17.

> ✅ **SEQUENCING GATE: Codex GO (baton round 10, `codexConverged: true`, 2026-07-18)** — `codex_reviews/codex_review_010.md`.
> The deploy sequencing (folding CS PR-1/2/3 into the deepfix DEPLOY_ORDER) is blessed after a 3-round loop (8 NEEDS_FIXES →
> 9 NEEDS_FIXES → 10 GO). NOTE: each PR-1/2/3 **code diff** still needs its OWN Codex implementation review + evidence gate when built.

---

## 1 · TRUE CURRENT POSITION (verified live)

- **Client = `4b8452a`, clean, live since 2026-07-15 22:46Z** (prod bundle `window.__VOCABOOST_BUILD__ = {shortSha:"4b8452a",dirty:false}`; == HEAD == origin/main).
- **Functions = the deepfix tree, DEPLOYED, DORMANT** (orchestrator probe: prod `completeSession` → `FAILED_PRECONDITION: SERVER_COMPLETE_SESSION_ENABLED=false`, a string only in deepfix `foundation.js:1048`; `foundation.js` absent at `14e49a4`). All 11 `FOUNDATION_FLAGS` false; **`ANCHOR_VALIDATION_SHADOW=false` → the 14-day M4 shadow-soak clock has NOT started.**
- **Rules = pre-deepfix** (P6/R1, R2, R3 all un-deployed; the repo `firestore.rules` is the P10d FINAL artifact — never bare-deploy).
- **Client flags:** only `SERVER_ATTEMPT_WRITE` + `LIST_SCOPED_RECON` true; the rest false and **dead-code-eliminated from the bundle** (flipping needs a rebuild+redeploy, not a config toggle).
- **DEPLOY_ORDER position: between rows 2 and 3** — the initial release (P0/P1/P2 + the dormant P3–P10 code) is fully SHIPPED; the server-authoritative *activation* (P3 flag flips → P4 → P5 → P6 → P7; P8/P9/P10) is all that remains.

### Deepfix program status (RC-1, authoritative)
| Task | State |
|---|---|
| 1 Investigation / 2 FIX_PLAN / 3 Implementation | COMPLETE + signed off (P0–P10+P7 Codex-converged; 2-Fable+Codex final review, 13 findings folded) |
| 4 Audit design / 5 Harness | COMPLETE |
| **6 Audit RUN** | **SUBSTANTIALLY RUN, NOT CLOSED** — M-STATIC 27/0, M-CALL 21/21 (emu), M-RULES 11/11, M-MIG --dry 10/0, M-NET 3/3, M-UI flag-off greens all certified. RESIDUE: flag-ON M-UI pass, W-* classifications, single-runId `cert`→CERTIFIED, **Codex end-gate** (hard), `TASK6_REPORT`, the BLOCKED prod-smoke STEP1, and the RED M-STATIC flag-table |
| 7 Final report | written (now stale on deploy state) |

### Live-behavioral phases (already affecting students)
- **P0** grade-disarm · **P1** the #11 list-end-freeze fix (unfroze the wall — AND spawned the live **#16** review-racing flaw + the 07-15→17 CS throttle waves) · **P2** read-surfaces (gradebook truth; C-33 indexes live).
- Live open consequences: **#16** (David: self-heal, no override); the **DSF `dayGuardRejected` recovery path firing on ~23 real 26SM students / 124 events per 14d** (`DailySessionFlow.jsx:1529`, tracked carry-forward — this is NOT the fixed #10 self-race; the server-side fix is dormant and **closes at the P4 flip**); the CS-2026-07-17 tickets (MCQ empty-submit, >100% scores, re-entry dead-end, pairing off-by-one) — designed as PR-1/2/3, **not yet written**.

---

## 2 · FREENAV — CLOSED as COEXISTENCE (David 2026-07-17)

**The fork** (`docs/design/FREE_NAVIGATION_MODEL.md`, Codex `SOUND-WITH-CAVEATS`, converged): (A) keep forced-progression + throttle and finish the P3–P10 cutover · (B) "lighter gate" (floor throttle so newWords never 0, Practice Mode v2, incremental day-simplify, free-nav as north-star) · (C) full free-navigation rebuild.

**CLOSED (David 2026-07-17): COEXISTENCE.** Forced progression is the DEFAULT; its policy is the David-locked **BINARY throttle** (0 new words in review mode, hold-csd, review-required-to-advance) — which **supersedes** the lighter-gate's "floor throttle" leg (a). Lighter-gate legs (b) Practice Mode v2 [David-locked 06-24] and (c) day-simplify are **absorbed**. **Free-navigation becomes a future per-class OPTION** (`navigationMode: forced|free`), NOT a replacement — built on the server-authoritative base (roadmap E4; memory `freenav-per-class-option`). The former "two contradictory throttle designs" are now two MODES — resolved. (Codex round-7 SOUND-WITH-CAVEATS holds; the caveats become E4's design spec.) ⇒ B1/B2 resolved; only the per-class free-nav MODE (E4) remains, post-cutover.

**Why this gates only the POLICY layer:** the server-authority infrastructure (P3–P5) is **direction-independent** — free-nav needs a server-owned frontier + a P5-shaped census too (Codex: server-owned frontier is free-nav's dominant prerequisite). So:
- **Direction-INDEPENDENT (safe to build/ship under A/B/C):** PR-1 entirely · PR-2 mostly (engagement stamps, I6 clamp, foundation mirrors) · the P3–P5 authority infra AS infra · P1/P2 (already live) · P8 CONT-A · security (SERVER_ATTEMPT_WRITE, teacherIds) · the invariant suite + M-STATIC refresh.
- **Direction-DEPENDENT (bets on the forced model — gate on FREENAV closure):** PR-3 policy (binary throttle/hold-csd) · P6 rules *content* · the day-completion/`isDayComplete` + session-state-machine unifications · P9/CYC.

**Resolved (David 2026-07-17):** forced mode requires PASSING the segment test (pass-to-advance); binary throttle supersedes floor; free-nav = a future per-class option, not a replacement — so **B1/B2 are closed**. **Still open (follow-up, NOT closure prerequisites):** **B4** — the P8 continuation/list-end product shape; and the detailed **E4** free-nav-MODE semantics (its scheduler, frontier authority, the pass-to-advance-the-frontier answer, and a rules clause), designed after the cutover.

---

## 3 · THE CONSOLIDATED FORWARD PATH (deepfix DEPLOY_ORDER spine + CS PRs + invariant suite)

### Track 0 — Hygiene & gates (no deploy; direction-INDEPENDENT; do first)
- **T0.1** Refresh the RED M-STATIC flag-table (`lsr_deepfix_static.mjs:143` asserts `GRADE_TOKEN_MINT=true`, actual false since 07-15; add the 9 missing flags → 17 server + 10 client). It blocks the next gated deploy's DG-1 check.
- **T0.2** Build the **invariant test suite** (the repo has ZERO tests; spec = the verified 12-invariant register; `p9_assert.mjs` extract-and-eval pattern). This is the genuinely-new contribution of this session's work and the safety net for every downstream flag flip.
- **T0.3** ✅ **FREENAV gate CLOSED** (David 2026-07-17, coexistence — §2); recorded in FREE_NAVIGATION_MODEL.md + memory. B1/B2 resolved; the per-class free-nav MODE = E4 (post-cutover).
- **T0.4** Re-rotate RESUME to reintegrate the deepfix state (done alongside this doc).

### Track 1 — CS fixes for the live 07-17 tickets (build now; mostly direction-independent)
- **PR-1** (`REVIEW_PAIRING_V2`+`REENTRY_GUARD`+`RECOVERY_GUARD`+F2) — **direction-INDEPENDENT**; drains the **14 truly-stuck** (census-locked 13/14 + 0 false-pairs) — David's SOLE remediation (WI-5 held). Ship dark → flip after re-running the census. Hosting (Netlify rebuild). **This is the highest-value user-facing work and is safe under every FREENAV outcome.**
- **PR-2-core** (engagement/`answeredCount` stamp + server I6 clamp + the mirrors: OC-2 V2 pairing, OC-3 engagement stamp, **OC-4 the ABSENT server lap-reset mirror**) — **direction-INDEPENDENT**; a **functions redeploy** folding these into the ALREADY-DEPLOYED P3 artifact (not a first deploy). Its 2 live flags (`REVIEW_ENGAGEMENT_STAMP_ENABLED`+`RECOVERY_SCORE_CLAMP_ENABLED`) flip in the D2 set. **OC-1 `review_recorded`/hold-shape + grandfather are PR-3-owned** (Codex PR-2 r14). Must precede the P4 flip.
- **PR-3** (`FORCED_PATHWAY`: binary throttle + hold-csd + engagement readers) — **direction-DEPENDENT** (FREENAV closed → forced mode confirmed, so it's GO). **Gate: PR-1 live+flipped first** (else re-mints I4). Ship dark → flip in a quiet window; ≥7-day soak; **must be soaked before P4**. Hosting.

### Track 2 — Deepfix server-authoritative activation (the DEPLOY_ORDER spine; infra direction-independent, deploy-gated)
Current = "between rows 2 and 3." Remaining, in order (one-way doors flagged):
1. **Close Task 6** (T0.1 first) — flag-ON M-UI pass, W-* classification, single-runId cert → CERTIFIED, **Codex end-gate** (hard — never self-approve), `TASK6_REPORT`; resolve the blocked prod-smoke STEP1 (David's permission call, or WSL runs it — WSL can hit prod URLs).
2. **P3 activation** — flip the **7** server flags incl. **`ANCHOR_VALIDATION_SHADOW=true`** + PR-2's **`REVIEW_ENGAGEMENT_STAMP_ENABLED`**+**`RECOVERY_SCORE_CLAMP_ENABLED`** (`--only functions`; folds in PR-2). **Starts the ≥14-day M4 shadow clock** that gates P6.
3. **P4** — flip the 4 client flags + Netlify rebuild + SOAK. **Closes the DSF `dayGuardRejected` carry-forward** (the 23-student recovery issue). **HARD GATE: PR-2 live AND PR-1 live AND PR-3 flipped + soaked** before this flip — never flip P4 under the old completion-throttle predicate (else re-mint I4).
4. **P5** — pre-work: fix migration `--catchup` MED-3/MED-4 + **retarget the CS toolchain** (`data-integrity-sweep.mjs`, `census-i4-pairing.mjs` — else they false-CLEAN off the dead collection); then the off-peak, David-authorized `class_progress→list_progress` migration + `LIST_PROGRESS_CANONICAL` cutover. **⚠ ONE-WAY DOOR** (clean restore only until the first post-flip completion; then reconcile-not-restore). The ~5 active demotees get a named per-student ledger + disposition BEFORE the run.
5. **R1 = P6** — **HARD GATE: P5 migration COMPLETE + accepted (26SM quarantine=0) AND ≥14d M4 shadow ≈0 AND P4 bundle-grep zero client attempt-create/delete AND rules-test matrix green.** `firestore.p6.rules` via `--only firestore:rules` (+ re-apply the F1 Signup train + `TEACHER_PROVISIONING_ENABLED=true`); **never include P10d; never bare-deploy.** Starts the P7 clocks.
6. **P8 CONT-A** — hosting-only, flippable any time after RO (David's discretion; needs the continuation product decision §2.3).
7. **P9 CYC** — after R1 accepted (or David's documented cohort-accelerated exception).
8. **P10a/b OVR** (server flags + `SERVER_OVERRIDE` client + soak) → **R2a** (4 teacherIds indexes) → **R2** (`firestore.p10c.rules`) → backfill `--dry`→`--commit` → flip `TEACHER_IDS_READ`+`TEACHER_IDS_WRITE_ENABLED` together → **P10d D1–D4** → **R3** (repo `firestore.rules`, the LAST rules deploy).
9. **P7** — ≥14d post-R1 + ≥7d zero `legacy_write_denied`: apply `phase7_retirement.patch`; **`class_progress` deletion is irreversible (backups first)**; closes F-9.

**Reconciliation with the prior roadmap's RC corrections (still valid):** OC-1 (hold-csd server shape — PR-3-owned, before P4), OC-2 (V2 pairing mirrored in PR-2-core, before P4), OC-3 (engagement stamp in PR-2-core; grandfather/completion reader in PR-3, before P4), OC-4 (the ABSENT server lap-reset mirror), OC-5 (re-entry csd source), OC-6 (PR-2 rides the functions artifact), OC-7 (CS-toolchain retarget at P5), the recent-window `8→12` at all 4 sites (`progressService.js:229/423/441/449`), and the retake-rewind 5th csd writer (`MCQTest.jsx:960`) — all fold into Track-1/Track-2 as above.

---

## 4 · What changed vs the prior consolidation roadmap (the drift correction)
- "Deploy staged deepfix P1 this week" → **already done 07-15** (client + functions both live/dormant).
- "P3 = the one functions deploy" → the functions are **already deployed**; P3 is now a **flag-flip + a PR-2 mirror redeploy**.
- "#10 self-race harming 23 students" → **overstated**; #10 is fixed/latent. The live signal is the **DSF `dayGuardRejected` recovery** (tracked carry-forward, closes at P4).
- "The big consolidation is a new program" → **it's the deepfix**, implementation-complete and mostly-deployed; this roadmap reconciles onto its DEPLOY_ORDER.
- Genuinely-NEW contributions to keep: the **invariant suite** (T0.2), the **CS PR-1/2/3** reader-side fixes, `census-i4-pairing.mjs` (14-stuck, locked predicate), and the empirical findings.

## 5 · Drift root-cause (so it doesn't recur)
Three compounding failures (RC-2, from the transcript): (1) RESUME never rotated past 07-13 16:09, archived as if current; (2) the 07-17 08:11 compaction erased the first-hand 07-15 deploy verification, letting a review agent's git-log misreading ("no `Deploying:` commit → undeployed") become a "verified baseline"; (3) David's "free-nav on hold" treated as terminal, dropping the answered Codex gate (`turnOwner=claude`). Mitigation: RESUME now carries the deploy sha + flag posture + the open gate; the invariant/flag-table gates make a wrong deploy premise fail loudly.
