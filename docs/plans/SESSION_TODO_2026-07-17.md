# SESSION TO-DO — VocaBoost consolidated roadmap (2026-07-17)

Primary to-do, grounded in the LIVE deploy. Source: `CONSOLIDATED_ROADMAP_2026-07-17.md` + deepfix `task3/DEPLOY_ORDER.md`
+ `CS_2026-07-17_ROOT_CAUSE_EFFORT.md`. **3-agent converged (TL-A faithfulness · TL-B sequencing · TL-C adversarial) + orchestrator-verified.**

**Legend:** `[x]` done · `[ ]` to do · 🔵 needs David (decision or a deploy — *David runs all deploys*) · ⛔ gated · ⚠️ irreversible
**STANDING RULE:** never a bare `firebase deploy` — always `--only`-scoped. The repo `firestore.rules` IS the P10d FINAL artifact and must NOT ship before D8g/R3 (early = every un-claimed teacher locked out). Restore the P10d draft from a backup copy, never `git checkout`.

## ✅ Already shipped (starting point)
- [x] Deepfix P0–P10 **+P7** built, signed off, Codex-converged
- [x] Client `4b8452a` live — P0 (grade-disarm), P1 (#11 fix; note: P1 spawned the live **#16** racing flaw, fixed only by ⛔-gated C3), P2 (read-surfaces)
- [x] Deepfix functions deployed — dormant (all 11 FOUNDATION_FLAGS false; ANCHOR_VALIDATION_SHADOW=false ⇒ M4 clock unstarted)
- [x] Task-6: the 6 matrices ran green historically — **M-STATIC now RED/stale (→A1); single-runId cert + Codex end-gate OPEN (→D1). Task 6 NOT closed.**
- [x] CS: 14 truly-stuck diagnosed; pairing predicate census-locked (13/14 organic + 1 by-design retake, 0 false-pairs)
- [x] RESUME re-rotated to the true deploy state; CONSOLIDATED_ROADMAP written

## 🟢 A. Do now — local, no deploy, no approval
- [x] **A1.** ✅ (M-STATIC baseline CLEAN 36/0/0) Refresh the RED M-STATIC flag-table (`lsr_deepfix_static.mjs`): fix `GRADE_TOKEN_MINT baseline:true`→false; add the 9 missing flags → 17 server + 10 client. *Gates D1 & D2's DG-1 check.*
- [ ] **A2.** Build the invariant test suite (repo has ZERO tests; spec = the 12-invariant register; `p9_assert.mjs` extract-and-eval pattern). *Gates P3+ (D2 onward).*
- [x] **A3.** ✅ FREENAV decision produced → David decided **COEXISTENCE** (recorded in FREE_NAVIGATION_MODEL.md + memory).
- [x] **A4.** ✅ (banner + runtime guard) Mark `throttle-relief-cohort.mjs` csd-down + un-throttle legs **DO-NOT-RUN** (iatrogenic — minted ~9 of the 14 stuck; WI-5 HOLD suspended the 26SM writes, not this local marking).

## B. David's decisions — FREENAV **CLOSED as coexistence** (2026-07-17); only B4 remains open
- [x] **B1.** ✅ FREENAV **CLOSED as COEXISTENCE** (David 2026-07-17): forced progression is the DEFAULT (binary throttle = its policy); free-nav = a future per-class OPTION, not a replacement. Recorded in FREE_NAVIGATION_MODEL.md + memory [[freenav-per-class-option]]. Remaining free-nav work = **E4** (post-cutover). The "two throttle designs" are now two modes — resolved.
- [x] **B2.** ✅ Forced mode = **YES**, pass-to-advance (per David's binary-throttle lock). Free-nav-mode's answer is deferred to **E4** (per-mode question).
- [x] **B4.** ✅ Continuation / list-end shape (David 2026-07-17): **auto-advance to the next assigned list** (CONT-A/P8); if the student **re-selects the just-finished list → cycling** (P9/CYC); fallback when no next list = completion state. Ties P8↔P9. See [[continuation-list-end-shape]].

## C. CS fixes for the live 07-17 tickets (build authorized now; *David runs the flips/deploys 🔵*)
- [~] **C1.** *(IN PROGRESS — built ✓, Codex-GO r12 ✓, ship-build census PASS ✓ [13/14+0FP], dev-E2E WinClaude r30 in flight → then flip)* PR-1 — pairing predicate (all readers) + re-entry attempts-conjunct + recovery-intersect + I6 + F2 warn + **8→12 window at all 5 sites** (`db.js:3366`, `progressService.js:229/423/441/449`) + `impossible_phase` userId payload. Direction-INDEPENDENT; drains 13/14. **Ship DARK → sandbox E2E → re-run census (13/14 + 0 false-pairs) → flip 🔵.** → Netlify. *David's SOLE remediation for the 14 stuck (WI-5 held).*
- [~] **C2.** *(IN PROGRESS — PR-2-core built + orchestrator-verified ✓, Workflow adversarial-verify Opus/max in flight → then Codex diff gate; stamp+clamp flip at D2; hold-csd/grandfather split to PR-3)* PR-2 — engagement/`answeredCount` stamp + server I6 clamp + the 4 foundation mirrors (OC-1 `review_recorded`/hold-shape, OC-2 V2 pairing, OC-3 engagement+grandfather into `:615/:638`, OC-4 the ABSENT server lap-reset) + **M4 retake/V2 carve-out**. Direction-INDEPENDENT. **Rides the SAME `--only functions` redeploy whose flags D2 flips** (one deploy). Must be live before D3/P4. 🔵
- [ ] **C3.** PR-3 — binary throttle + hold-csd (`recordReviewOutcome`) + **engagement readers (F3)** + add `reviewMode` to the retake-rewind snapshot set. Direction-DEPENDENT ⛔ **B1 AND C1 live+flipped** (else re-mints I4). Ship dark → quiet-window flip 🔵 → Netlify, soak ≥7d.

## D. Deepfix server-authoritative activation (per-step gates; NOT a simple chain — *David runs all deploys 🔵*)
- [ ] **D1.** Close Task 6 — ⛔ A1 done. Flag-ON M-UI pass, W-* classify, single-runId cert → CERTIFIED, **Codex end-gate (HARD — never self-approve; wait if silent)**, `TASK6_REPORT`; resolve the blocked prod-smoke STEP1 (David's permission call, or WSL runs it). 🔵 **Scope: D1 closes ONLY the current deepfix/live-baseline harness — PR-1/PR-2/PR-3 each need their OWN code review + evidence + flip gate (NOT covered here).**
- [ ] **D2.** Activate P3 — `--only functions` redeploy folding in C2, then flip EXACTLY: `SERVER_COMPLETE_SESSION_ENABLED`, `SERVER_RESOLVE_LIST_PROGRESS_ENABLED`, `SERVER_RESET_PROGRESS_ENABLED`, `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED`, `ANCHOR_VALIDATION_SHADOW` — **NOT** `LIST_PROGRESS_CANONICAL` (P5-only) / `ANCHOR_VALIDATION_ENFORCE` (P6-only) / cycling / P10 flags. **Starts the ≥14-day M4 shadow clock** (gates D5). ⛔ D1, C2, A2. 🔵
- [ ] **D3.** P4 — flip 4 client flags (`SERVER_PROGRESS_WRITE`/`_CHALLENGE_WRITE`/`_REVIEW_MARKER`/`_RESET_PROGRESS`) + Netlify rebuild + SOAK. Closes the `dayGuardRejected` carry-forward (~23 students). ⛔ **HARD GATE: C2 live AND C1/PR-1 live AND C3/PR-3 flipped + soaked** — do NOT flip P4 under the old completion-throttle predicate (else re-mint I4). 🔵
- [ ] **D4.** P5 migration ⚠️ **ONE-WAY** — pre-work: fix `--catchup` MED-3/4 · retarget CS toolchain (`census-i4-pairing.mjs`, `data-integrity-sweep.mjs`, `manual-pass.mjs`) · **named per-student ledger + disposition for the ~5 active demotees** (non-demoting ratchet stays) · 25WT rehearsal · census before/after. Then off-peak, David-authorized `class_progress→list_progress` + atomic `LIST_PROGRESS_CANONICAL` cutover. **Clean restore only until the FIRST post-flip completion (minutes), then reconcile-not-restore.** ⛔ D3 soaked, C1 live. 🔵
- [ ] **D5.** R1/P6 rules cutoff — ⛔ hard gates (B1 closed✓): **D4/P5 migration COMPLETE + accepted (26SM quarantine=0)** · ≥14d M4 shadow ≈0 false-rejects · P4 bundle-grep proves zero live client attempt-create/delete · rules-test matrix green · 14d no-legacy-write. Functions redeploy first (`TEACHER_PROVISIONING_ENABLED=true` + F1 Signup train); then `cp firestore.p6.rules firestore.rules` → `--only firestore:rules` (never bare, never w/ P10d); flip `ANCHOR_VALIDATION_ENFORCE` as a separate `--only functions` step. Starts the P7 clocks. 🔵
- [ ] **D6.** P8 CONT-A — hosting-only; **B4 CLOSED✓** (auto-advance to next assigned list; re-select finished list → P9 cycling; fallback = completion state). NOT gated on D1–D5; shippable early. 🔵
- [ ] **D7.** P9 CYC — ⛔ **B1** + D5 live+accepted (or David's documented cohort-accelerated exception). 🔵
- [ ] **D8.** P10 chain (split): **D8a** P10a/b OVR + `SERVER_OVERRIDE` flip + SOAK (hard R3 precond) → **D8b** R2a teacherIds indexes → **D8c** R2 (`firestore.p10c.rules`) → **D8d** teacherIds backfill dry→commit → **D8e** flip `TEACHER_IDS_READ`+`TEACHER_IDS_WRITE_ENABLED` together (R2 live FIRST) + soak → **D8f** P10d D1–D4 (claim-mint → backfill 0-mismatch → token-refresh window → rules-tests re-green) → **D8g** R3 (repo `firestore.rules`, LAST rules deploy) ⚠️ before D8f complete = every teacher locked out; rollback-coupled to `SERVER_OVERRIDE`. 🔵
- [ ] **D9.** P7 retire — ⛔ ≥14d after D5 **AND ≥7 consecutive days zero `legacy_write_denied`**. Apply `phase7_retirement.patch` + follow-on functions-guard cleanup; **delete `class_progress`** ⚠️ **irreversible (backups first)**. 🔵

## ⛔ E. Direction-dependent unifications backlog (gated on B1; build on the server-authoritative base, post-cutover)
- [ ] **E1.** `isDayComplete(day) → {complete, advances}` day-type-dispatched (unifies C2 day-completion). ⛔ B1, after D3.
- [ ] **E2.** Session-lifecycle state machine (one phase vocab; delete the dead 7-export API). ⛔ B1, after D3.
- [ ] **E3.** Defaults/anchors via `resolveAssignmentPolicy` (pace 80/20/undefined, threshold 95/92/0.95). ⛔ B1, after D5.
- [ ] **E4.** 🌟 **Free-navigation as a per-class option** (David north-star, 2026-07-17) — a `navigationMode: forced|free` class setting; free-nav mode = roam frontier `[0,twi)`, no throttle/day-gate. Build ON the server-authoritative cutover base (needs the server-owned frontier). Design spec = the FREE_NAVIGATION_MODEL rigor-review hazards + a new review scheduler + a new rules clause. ⛔ after the cutover (D3–D5). Coexists with forced; not a replacement.

**Critical path:** `A1✓ + A2` → **B1✓ (FREENAV closed as coexistence)**; **C1 is independent** (build now; flip after census re-run). Cutover chain: `C2 → D1 → D2` (M4 clock starts) → `C3 flip [needs C1 live]` → **`D3/P4 [HARD: C2 + C1 + C3 soaked]`** → `D4/P5` → **`D5/P6 [HARD: P5 complete + 14d M4-clean]`** → `D6 (B4) ‖ D7 ‖ D8 ‖ D9 (D5 + 14d + 7d-clean)`. `E1–E4` after the cutover.
