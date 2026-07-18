# MASTER TASK LIST — VocaBoost server-authoritative cutover + CS remediation

> **This is the canonical, verified plan of record.** It was reconstructed 2026-07-18 after a crash, from
> primary evidence (git history + deploy artifacts + live read-only scans), and independently confirmed by a
> 5-way convergence (WSL-Claude + 3 Fable assessors + WinClaude + Codex). It SUPERSEDES `RESUME.md` and
> `docs/plans/SESSION_TODO_2026-07-17.md`, both of which are stale.
>
> **Companion:** every action taken against this plan is logged in **[MASTER_TASK_TRACKER.md](./MASTER_TASK_TRACKER.md)**,
> which references item IDs (A1, C1, D3, …) back here.
>
> **Legend:** ✅ done · 🔄 in progress · ⛔ not started / blocked · ⚠️ irreversible step · 🔵 needs David / WinClaude deploy

---

## 0. The goal (plain language)
VocaBoost is a vocabulary-learning app on a **live cohort (26SM, ~824 real students)**. Two intertwined efforts:
1. **"deepfix" server-authoritative cutover** — move the source of truth for student progress from the browser
   (client-authoritative) to the server (Cloud Functions), in gated, mostly-reversible stages, ending with a data
   migration and rules cutover.
2. **CS remediation (PR-1/2/3)** — fix a batch of stuck students and install a "forced-pathway" binary throttle
   (hold weak-review students instead of runaway-advancing them).

Both ship through a strict discipline: local build → 3-agent + Codex convergence → dev/sandbox proof → WinClaude
deploys (WSL has no push/firebase creds) → prod smoke → flip. **26SM is real: read-only diagnosis only; no 26SM
writes without explicit authorization. 25WT is the sandbox.**

---

## 1. Verified ground-truth anchors (2026-07-18, HIGH confidence)
- **HEAD = `6bffe1c`** (== local `origin/main`). D-track commit chain:
  `59df732`(PR-1) → `26cd8ee`(D2/P3) → `d2bb2bc`(PR-3 client) → `0ddbb34`(P4 functions) → `6bffe1c`(P4 client).
- **Client @ `6bffe1c`:** PR-1 + PR-3 + **P4 cutover LIVE** — `SERVER_PROGRESS_WRITE`/`_CHALLENGE_WRITE`/`_REVIEW_MARKER`/
  `_RESET_PROGRESS` = true, `FORCED_PATHWAY` = true. Netlify build `6bffe1c` `dirty:false`, app loads clean.
- **Server (functions @ `0ddbb34`):** D2/P3 surface (7 flags) + `FORCED_PATHWAY_ENABLED` = true, grandfather epoch
  `1784333239063`. Still **false**: `LIST_PROGRESS_CANONICAL` (P5), `ANCHOR_VALIDATION_ENFORCE` (P6), cycling/override/
  teacher-ids-write (P9/P10). `ANCHOR_VALIDATION_SHADOW` = true → the **14-day M4 shadow clock is running** (started at
  D2, ~2026-07-18 08:55 KST; ends ~2026-08-01).
- **Deploy order invariant held:** functions live + fail-closed gate PASS (08:37:06Z) **before** the client flip
  (08:45–08:46Z). Not a client-ahead-of-server condition.
- **Provenance caveat:** deployed functions bundle self-reports `dirty:true` (built from a tree with uncommitted
  non-functions files); sha/flag/epoch are live-proven, full-bundle cleanliness is not.
- **Cannot be verified from WSL** (git `schannel` broken; no firebase CLI): the *live-this-minute* remote/Netlify/
  functions state rests on WinClaude — who **r38 re-probed it 2026-07-18 09:56Z → `ALL_VERIFIED`** (remote `main`==`6bffe1c`,
  Netlify `6bffe1c dirty:false`, functions `0ddbb34`+`FORCED_PATHWAY_ENABLED=true`+epoch+CANONICAL/ENFORCE=false;
  `deepfix_converge_reverify_r38.json`). Admin-SDK read-only Firestore scans also work from WSL.

---

## 2. The full staged plan (A → E)

### A. Local prep — no deploy, no approval
- **A1** ✅ Refresh the M-STATIC flag table (`lsr_deepfix_static.mjs`) — 17 server + 10 client flags. Gates D1/D2.
- **A2** ✅ Invariant test suite (`audit/deepfix/task3/invariant_assert.mjs`) — 12-invariant register + F-checks; pass=34/0.
- **A3/A5** ✅ FREENAV decision produced → David decided **COEXISTENCE**.
- **A4** ✅ Marked `throttle-relief-cohort.mjs` csd-down/un-throttle legs **DO-NOT-RUN** (iatrogenic).
- **A7** ✅ Comprehensive reinstatable 26SM backup (925,851 docs) at `scripts/cs/backups_full_26sm_20260717-165840/`
  + MANIFEST + restore script. **Re-run fresh right before D4/P5.**

### B. David's decisions — CLOSED
- **B1** ✅ FREENAV = **COEXISTENCE** — forced progression is the DEFAULT (binary throttle policy); free-nav = a future
  per-class OPTION (`navigationMode: forced|free`), not a replacement → item **E4**.
- **B2** ✅ Forced mode = YES, pass-to-advance.
- **B4** ✅ Continuation / list-end shape = auto-advance to next assigned list; re-select finished list → cycling (P9);
  fallback when no next list = completion state. (Ties D6/P8 ↔ D7/P9.)

### C. CS fixes for the live tickets
- **C1 / PR-1** ✅ **LIVE + PROVEN** (`59df732`). Review-pairing V2 + re-entry + recovery guards + F2 warn + 8→12
  recent-attempts window. Drained the 14 stuck students; proven on 2 independent accounts (csd 21→22, 17→18).
- **C2 / PR-2** ✅ **LIVE** — rode the D2 functions deploy (`26cd8ee`). Engagement/`answeredCount` stamp + server I6
  clamp + mirrors + M4 retake/V2 carve-out. Its 2 flags (`REVIEW_ENGAGEMENT_STAMP_ENABLED`,`RECOVERY_SCORE_CLAMP_ENABLED`)
  are in the D2 set.
- **C3 / PR-3** ✅ **LIVE (client)** (`d2bb2bc`). Forced-pathway binary throttle: `FORCED_PATHWAY=true`, grandfather epoch
  `1784333239063`, `recordReviewOutcome` hold-csd, F3 engagement readers, `reviewMode` snapshot. Server leg = D3/P4.

### D. Server-authoritative activation (per-step gates — *David/WinClaude run all deploys 🔵*)
- **D1** ✅ CLOSED — Task-6 end-gate. Strict single-runId cert is structurally a post-P7 artifact; closed via the
  Codex-validated, **David-accepted waiver** (`TASK6_ENDGATE_WAIVER_cert-59df732-r34.md`).
- **D2 / P3** ✅ **DEPLOYED** (`26cd8ee`). Activated the server surface — flipped exactly 7 foundation flags
  (`SERVER_COMPLETE_SESSION_ENABLED`, `SERVER_RESOLVE_LIST_PROGRESS_ENABLED`, `SERVER_RESET_PROGRESS_ENABLED`,
  `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED`, `ANCHOR_VALIDATION_SHADOW`, `REVIEW_ENGAGEMENT_STAMP_ENABLED`,
  `RECOVERY_SCORE_CLAMP_ENABLED`) + folded in PR-2. **Started the ≥14-day M4 shadow clock** (gates D5).
- **D3 / P4** ✅ **CERTIFIED** (`0ddbb34` functions + `6bffe1c` client) — **behavioral cert 10/10 PASS**
  (`deepfix_p4_behavioral_cert_0ddbb34.json`; Codex-GO'd instrument r28; pinned `0ddbb34`; WSL-verified posture ==
  `git show 0ddbb34` + `git diff 0ddbb34 HEAD -- functions/` empty). The forced-pathway hold-csd branch is proven; C4 closed.
  - ✅ functions redeploy: `FORCED_PATHWAY_ENABLED=true` + epoch + version epoch-provenance.
  - ✅ fail-closed server-state gate PASS (`deepfix_d3_server_gate_r37.json`).
  - ✅ client flip (4 route flags) + push + Netlify build `6bffe1c` `dirty:false` + app healthy (`deepfix_buildstamp_6bffe1c.json`, `deepfix_p4_diag_r37.json`).
  - ❌ **6-assertion behavioral smoke NEVER RAN** (`deepfix_p4_smoke_r37.json`: `SMOKE_PASS:false`, `reachedTest:false` —
    harness `joinClass` enrollment gap; 25WT sandbox; 0/6 assertions executed on the live routed path).
  - ❌ **M-CALL substitute has a verified coverage gap** — `deepfix_call_cert-59df732-r34.md` ran at baseline `59df732`
    (3 commits stale; 431+/22− functions diff), its matrix OMITS `FORCED_PATHWAY_ENABLED`, and used `CANONICAL/ENFORCE=true`
    (opposite of prod). ⇒ the now-live **forced-pathway hold-csd branch is UNTESTED at every layer**.
  - **Verdict (convergence r22→r23): `GO-HOLD`** — Codex revised `NEEDS-BEHAVIORAL-SMOKE`→**`GO-HOLD`** (`codexConverged=true`)
    once the clean sweeps met its de-risk condition; **WinClaude r38 VERIFIED the live state == claimed** (remote/Netlify/
    functions all match, `deepfix_converge_reverify_r38.json`). **GO-HOLD ≠ CERTIFIED:** the 6 assertions still gate D3
    closure; cert path = WinClaude **approach-1** (emulator re-cert at PROD flags `FORCED_PATHWAY_ENABLED=true` +
    CANONICAL/ENFORCE=false, extending the M-CALL harness). *(Now fully CONVERGED at round 5 — see §7.)*
  - **Prior Codex verdict (round 22): `NEEDS-BEHAVIORAL-SMOKE`** — deployed but not certified; no rollback (no regression
    signal); D4/P5 blocked. Requires: (a) read-only 26SM `system_logs` sweep since 08:46Z; (b) the 6 assertions pass on
    live `6bffe1c`. Read-only de-risk COMPLETE: (a) `data-integrity-sweep` CLEAN (`invalidAnchor:0`, all structural 0);
    (b) `system_logs` post-cutover sweep **NO-SPIKE** — 13 logs since 08:46Z: 9 `resolve_list_progress` + 2
    `csd_twi_reconciled` from 26SM (server path working + reconciling); 1 `impossible_phase_detected` at baseline rate
    (delta 0); ZERO `dayGuardRejected`/`csd_anchor_invalid`/`anchor_rejected`/`reviewonly_derivation_mismatch`. Caveat:
    low-N early-evening read; excludes GCP-Logging CF runtime errors (console/WinClaude check).
  - **The 6 required assertions:** ① normal `completeSession` advances CSD/TWI · ② held-review records `review_recorded`
    WITHOUT advancing CSD/TWI · ③ `reviewMode` written+read back · ④ `advanceForChallenge` does NOT advance a held day ·
    ⑤ DSF `dayGuardRejected` does not fire on the server path · ⑥ no `list_progress` canonical writes while `CANONICAL=false`.
- **D4 / P5** ⛔⚠️ **ONE-WAY data migration.** Pre-work: fix `--catchup` MED-3/4 · retarget CS toolchain
  (`census-i4-pairing.mjs`, `data-integrity-sweep.mjs`, `manual-pass.mjs`) · named per-student ledger + disposition for
  the ~5 active demotees · 25WT rehearsal · **fresh** 26SM census+backup before/after · carry `reviewMode` into
  canonicalDoc at hydration + apply the FIX-1 engagement gate to bestCsd. Then off-peak, David-authorized
  `class_progress → list_progress` + atomic `LIST_PROGRESS_CANONICAL` cutover. Clean restore only until the FIRST
  post-flip completion. **Gated: D3 soaked/certified, C1 live.** 🔵
- **D5 / P6** ⛔ Rules cutoff (R1). Gates: D4 complete+accepted (26SM quarantine=0) · ≥14d M4 shadow ≈0 false-rejects ·
  P4 bundle-grep proves zero live client attempt-create/delete · rules-test matrix green. Functions redeploy
  (`TEACHER_PROVISIONING_ENABLED`) first; then `cp firestore.p6.rules firestore.rules` → `--only firestore:rules`
  (NEVER bare, never with the P10d draft); then flip `ANCHOR_VALIDATION_ENFORCE`. Starts P7 clocks. 🔵
- **D6 / P8** ⛔ Continuation (CONT-A) — hosting-only; B4 closed; **not gated on D1–D5, shippable early.** 🔵
- **D7 / P9** ⛔ Cycling (CYC) — gated B1 + D5 live+accepted. 🔵
- **D8** ⛔ P10 chain (teacher permissions/claims): D8a OVR+`SERVER_OVERRIDE` → D8b R2a indexes → D8c R2 →
  D8d teacherIds backfill → D8e flip `TEACHER_IDS_READ`+`_WRITE` → D8f P10d claim-mint/backfill → **D8g R3 (repo
  `firestore.rules`, LAST rules deploy)** ⚠️ early = every teacher locked out. 🔵
- **D9 / P7** ⛔⚠️ Retire — ≥14d after D5 AND ≥7 consecutive days zero `legacy_write_denied`; apply
  `phase7_retirement.patch`; **delete `class_progress`** (irreversible; backups first). 🔵

### E. Direction-dependent backlog (post-cutover, gated on B1)
- **E1** ⛔ `isDayComplete(day) → {complete, advances}` day-type-dispatched. (after D3)
- **E2** ⛔ Session-lifecycle state machine; delete the dead 7-export API. (after D3)
- **E3** ⛔ Defaults/anchors via `resolveAssignmentPolicy`. (after D5)
- **E4** ⛔ 🌟 **Free-navigation as a per-class option** (`navigationMode: forced|free`) — David north-star. (after D3–D5)

---

## 3. Current frontier
**D3/P4 is now CERTIFIED (2026-07-18).** The client→server cutover is LIVE + behaviorally certified (10/10). Everything
through D3 (A, B, C, D1, D2, D3) is done. **Next frontier = D4/P5** — the one-way `class_progress → list_progress`
migration — now UNBLOCKED but gated on its own pre-work (fresh backup + 25WT rehearsal + a fresh Codex-GO'd,
David-authorized plan). Nothing past D3 has started.

## 4. Immediate next actions (verify-forward — Codex-mandated, all agents concur; no rollback absent a signal)
1. ✅ **Read-only de-risk COMPLETE** — 3 clean live scans (Firestore `data-integrity`, `system_logs` NO-SPIKE,
   canonical/write-path) + **WinClaude r39 GCP Cloud Logging: ZERO CF-runtime errors post-cutover, live invocation
   confirmed** (`completeSession`/`resolveListProgress` invoked error-free). GO-HOLD supported.
2. ✅ **D3/P4 CERTIFIED** — approach-1 emulator cert (Codex-GO'd instrument r28) ran by WinClaude r42, pinned `0ddbb34`,
   **10/10 PASS** (`deepfix_p4_behavioral_cert_0ddbb34.json`), WSL-verified. Forced-pathway hold-csd branch proven; C4 closed.
3. ⛔ **Housekeeping** (non-verdict-affecting; after convergence): (a) rotate stale `RESUME.md` → point at this file;
   (b) `git add --renormalize .` commit of the uncommitted evidence pile (NOT `git add -A`; `.gitattributes = * text=auto`
   renorm hazard); (c) `SUPPORT_RUNBOOK` CS-2026-07-18 entry for the read-only 26SM scans; (d) cite sources for the
   B2/B4 closures + PR-1's 2-account efficacy anecdote.
4. ⛔ Then D4/P5 pre-work (behind fresh backup + 25WT rehearsal + a fresh Codex-GO'd, David-authorized plan).

## 5. Standing constraints (binding)
- **Never a 26SM write without explicit authorization** (25WT = sandbox). Diagnose READ-ONLY; write only a
  derived/verified value; a passed `new` attempt is the CSD/TWI anchor (`twi = newWordEndIndex + 1`).
- **Deploys route through WinClaude** (git push + `firebase deploy`); WSL has no push/firebase creds. Commit on `main`,
  **never branch**. A `git checkout` of `firestore.rules` yields the P10d draft — never bare-deploy it.
- **`git add -A` is hazardous** (`.gitattributes = * text=auto` → repo-wide CRLF renorm storm). Use targeted adds or
  `git add --renormalize .`.
- **One-way doors (D4/P5, D5/P6, D9/P7):** 25WT rehearsal + census before/after + fresh reinstatable backups first.
- Logging: code → `change_action_log.md`; CS/data → `SUPPORT_RUNBOOK.md`; task actions → `MASTER_TASK_TRACKER.md`.

## 6. Known risks / open questions
- **R-1** Forced-pathway hold-csd branch behaviorally untested on live 26SM (the D3 gap). Blast radius bounded by the
  grandfather epoch (post-epoch skip/fail only) + reversibility; corruption sweep clean so far.
- **R-2** Deployed functions `dirty:true` provenance (resolve at next functions deploy from a clean tree).
- **R-3** `RESUME.md` + `SESSION_TODO` stale (superseded by this file).
- **R-4** ~1,200 lines of uncommitted evidence/coordination on disk (remote has only the flag commits).
- **R-5** ✅ RESOLVED — external agents (WinClaude + Codex) were available and completed the full 5-round convergence
  (WinClaude r38–r41 live-probed prod + ran GCP Logging; Codex r22–r26 gated). A mid-loop session-limit outage paused
  the two Fable agents; both resumed from transcript and finished.

## 7. Convergence status — ✅ CONVERGED (2026-07-18, 5 rounds; canonical report `docs/plans/loop/CONVERGENCE_REPORT_v4.md`)
**5-way convergence ACHIEVED** — round 5 (final sign-off) = all five "no surviving corrections":
**WSL + Fable-1 (git) + Fable-2 (deploy/safety) + Fable-3 (baton) + WinClaude + Codex (`codexConverged=true`)**.
**Verdict (unanimous, stable since round 2): `GO-HOLD`** — hold `6bffe1c`/`0ddbb34` live (reversible, **no rollback**
signal); the **6-assertion behavioral smoke remains the certification bar** (approach-1 emulator re-cert pinned to tree
`0ddbb34`, pending Codex sign-off); **D4/P5 blocked**. Rounds 3–5 corrected only evidence-prose accuracy (all folded +
re-verified): WinClaude's "M-CALL covers it" refuted (baseline drift / flag mismatch); WSL's day-guard over-correction
(real emitters `day_guard_rejected_session_cleared`/`_FAILED` exist); the `attempt_day_fallback` provenance (live
emitters at MCQTest.jsx:612/TypedTest.jsx:872); the GCP "26SM vs authenticated-invocation" hedge. De-risk evidence:
`data-integrity` CLEAN · `system_logs` NO-SPIKE · canonical EMPTY · **GCP Logging zero CF-runtime errors** with confirmed
live invocation. The `0ddbb34` deploy is pinned by 3 independent sources (git/mtimes, Firestore probes, GCP audit log).

## Evidence index
- Commits: `59df732`, `26cd8ee`, `d2bb2bc`, `0ddbb34`, `6bffe1c`.
- Evidence: `audit/playwright/findings/deepfix_d3_server_gate_r37.json`, `…/deepfix_buildstamp_6bffe1c.json`,
  `…/deepfix_p4_smoke_r37.json`, `…/deepfix_p4_diag_r37.json`, `…/deepfix_call_cert-59df732-r34.md`,
  `…/deepfix_syslog_sweep_postcutover.json` (this run).
- Reviews: `docs/plans/loop/win/reviews/winclaude_037.md`, `docs/plans/loop/codex_reviews/codex_review_p4_cutover_verify_001.md`.
