# Fix10 — Round 1 synthesis (Claude verification of all reviewers)

Collecting Codex + 3 fable agents (Lens A correctness / Lens B flag-off-regression / Lens C edge-cases) on
plan v1. Claude verifies EACH finding against real code (accept/reject w/ file:line), then folds survivors
into v2. **No src/ edits** until Codex signs off + David's go-ahead.

Status: Lens B ✅ · Lens A ✅ · Lens C ✅ · Codex ⏳ (baton out; watcher running)

---

## Lens B — flag-off regression & equivalence (fable) — TRIAGED

| # | Sev | Finding | Claude verdict | Evidence I verified |
|---|-----|---------|----------------|---------------------|
| B1 | **blocker** | Plan §3 claim "reconciling write only happens under the flag" is FALSE → unconditional swap breaks Run L flag-off equivalence; Fix A must be flag-gated | **ACCEPT** | `progressService.js:114-128` create-if-missing `setDoc` unconditional; `:236` `safeTWI` not flag-gated; `:248-271` `updateDoc` gated only by "values differ", no flag. My own §1/§3 wording is wrong — rewrite. |
| B2 | high | Flag-off legacy on this race = day-guard fires but returns WITHOUT `dayGuardRejected` (`:449-451`) → `studyService.js:624` abort needs flag+marker → flag-off silently swallows recentSessions/stats/streak but shows success = the PINNED Run L behavior; unconditional Fix A would newly APPLY those writes = divergence | **ACCEPT (pending :624 read)** | `progressService.js:442-452`; need to confirm `studyService.js:624` gate at synthesis |
| B3 | high | Fix B as specced returns bare success (no marker) → genuine same-day REPLAY flips blocked→silent-success with duplicate `sessions` record + re-graduation per replay; also erases `day_guard_rejected` signal. Guard's core (different-day still blocked, no double CSD) is SAFE. | **ACCEPT** — if B ships: explicit `alreadyComplete` sentinel + skip sessions-write + skip graduation + distinct log `day_guard_absorbed_same_day` | `progressService.js:465-486` (early return before updates ⇒ no double CSD); need `studyService.js:659-672` + `1446-1454` at synthesis |
| B4 | med | null-path: plan's `?? getOrCreateClassProgress` fallback RE-INTRODUCES the race; also if progress null w/o create, `progress.currentStudyDay` throws → catch `:1053` swallows → whole completion SKIPPED; and `updateDoc(...{progressSnapshot})` `:1005` fails on missing doc | **ACCEPT** — on null, create a BARE doc via direct `setDoc` (no reconcile), never getOrCreate | doc present in practice (`TypedTest.jsx:976` gate ⇒ session init ran ⇒ `studyService.js:158` created it); null path defensive but must not reconcile |
| B5 | med | No #9/Run S regression (Fix A doesn't touch getReviewForDay / Day-2+ gate / explicit-0 wordsIntroduced; cross-class carry is at session ENTRY) | **ACCEPT (no change)** — keep S-1/S-3 regression gate in §7 | consistent w/ my read of studyService #9 fix |
| B6 | med | `progressSnapshot` has ZERO readers in repo → §3 "more correct" + §7 recovery-validity are moot | **REJECT — factually wrong** | grep: READERS at `TypedTest.jsx:1142,1148,1153,1160-1167,1177` + `MCQTest.jsx:860-895` (crash-recovery restore path validates snapshotDayNumber, restores CSD/TWI, clears). Snapshot correctness is LOAD-BEARING; Fix A makes it MORE correct (captures pre-completion CSD = what recovery should restore to). Keep the argument. |
| B7 | nit | Second `getOrCreateClassProgress` sites `TypedTest.jsx:823` / `MCQTest.jsx:543` (pre-attempt studyDay derivation) must be DO-NOT-TOUCH; cosmetic line fixes (MCQ snapshot site is :718 not :717; write block :248-271; guard warn :444) | **ACCEPT** | grep confirms :823/:543 are separate calls; :718 confirmed |

**Net v2 edits from Lens B:** (1) rewrite §1/§3 flag-gating — Fix A is FLAG-GATED, and state clearly the reconcile-write is NOT flag-only; (2) §4 Fix B hardened with `alreadyComplete` sentinel + skip-writes + distinct log (reinforces "never ship B alone"); (3) §3 null-path = bare `setDoc`, drop the getOrCreate fallback; (4) §6 mark :823/:543 DO-NOT-TOUCH + fix cosmetic line numbers; (5) keep §3/§7 snapshot-correctness (reject B6); (6) keep S-1/S-3 gate.

---

## Lens A — correctness & data integrity (fable) — TRIAGED

| # | Sev | Finding | Claude verdict |
|---|-----|---------|----------------|
| A1 | high | Same as B1: "flag-off non-advancing read path" is FALSE; flag-off ALSO races but MASKED → silently loses recentSessions/stats/streak on every session-final completion (anchor w/ valid nwei). Flag-gate Fix A; state flag-off retains silent loss as deliberate Run-L tradeoff | **ACCEPT** — corroborates B1; also log flag-off silent-loss as an out-of-scope OBSERVATION (candidate backlog item, not #10) |
| A2 | high | Snapshot's real consumer is the **review-retake rewind** (not crash-recovery). Fix A STRENGTHENS it (today flag-ON snapshot stores post-reconcile values → retake fails to rewind; Fix A stores pre-completion values → correct). BUT exposes residual: after retake restore demotes CSD N→N-1, any reconciling mount (initializeDailySession) re-advances N→N via non-demoting Math.max → retake completion guard-rejects. Fix A removes snapshot-read trigger only. | **ACCEPT** — reframe snapshot purpose; residual is the real §9-Q2 case for Fix B (stronger than "2nd device"). NOTE: Lens C shows this retake branch is currently **UI-unreachable** (dormant) → residual is latent, supports A-only-now |
| A3 | med | Fix B "return current" drops session data; on `day===CSD` still apply non-CSD updates, skip only CSD/TWI increment | **ACCEPT** — merges w/ B3/C2 |
| A4 | med | null-path: getOrCreate fallback re-introduces race; null progress→`.currentStudyDay` throws→catch:1053 skips completion; `updateDoc({progressSnapshot})`:1004 throws on missing doc | **ACCEPT** — on null, skip snapshot entirely + proceed (updateClassProgress self-creates) — merges w/ B4/C1 |
| A5 | nit | **`SERVER_ATTEMPT_WRITE=true` (featureFlags.js:10) → live write path is `submitVocabAttempt` callable (TypedTest.jsx:906-916); :919 is the flag-OFF branch.** §8 overlay exercises the callable. + cosmetic: write :270 (block :248-273), log :253 | **ACCEPT** — matters for overlay attempt path; verify :10 at v2 |
| A6 | nit-confirm | Fix A SOUND: getClassProgress purity confirmed; completion never consumes snapshot; Day-1 + Day-2+ traces both eliminate race; retry idempotent; Q3 (823/543 are pre-attempt fallbacks) | **ACCEPT** — independent corroboration of my own trace |
| A7 | nit | Raw read → sparse legacy doc missing stats/streakDays → undefined in snapshot → updateDoc rejects undefined (no ignoreUndefinedProperties) → throws → completion skipped. Same risk today; add `?? null` guards on the 7 fields since block is edited | **ACCEPT** — cheap defensive hardening |

## Lens C — edge cases, UX, test design (fable) — TRIAGED

| # | Sev | Finding | Claude verdict |
|---|-----|---------|----------------|
| C1 | high | null-path (triple-converged w/ A4/B4): snippet fallback re-ships race; "skip snapshot" trap = `updateDoc({progressSnapshot})`:1004 throws on missing doc→swallowed:1053→completion SKIPPED. Fix: on null skip BOTH snapshot read AND updateDoc, go straight to completeSessionFromTest | **ACCEPT** — canonical null-path resolution |
| C2 | high | Fix A closes #10-as-filed (same-call-stack, deterministic). Residual = 2nd tab/device reconciling in 1-3s window. **Fix B as specced UNSAFE**: can't distinguish reconcile-won-race (benign) from true duplicate → true dup gets 2nd sessions doc + 2nd graduation; benign gets day w/o recentSessions. Ship A alone; B = separate follow-up, redesign via `current.recentSessions` disambiguation + sentinel + skip dup writes | **ACCEPT** — decisive: SCOPE TO FIX A NOW, Fix B → designed follow-up |
| C3 | high | **Overlay "CSD+1/TWI+pace" is NON-discriminating — buggy build ALSO ends CSD+1/TWI+pace** (reconciliation writes same finals; only recentSessions/stats/streak/sessions-doc missing). Real discriminators: recentSessions +1 entry day===N; exactly 1 new sessions doc; session_states=COMPLETE; 0 day_guard_rejected; **0 csd_twi_reconciled in completion window UNCONDITIONALLY** (survives Fix B) | **ACCEPT** — verified: progressService.js:264-271 writes CSD/TWI to same finals; my §8 was naive. Rewrite overlay asserts |
| C4 | med-high | Overlay MATRIX needed: {Day-1 new-final, Day-2+ review-final} × {Typed, MCQ}. Different reconcile branches (anchor vs getReviewForDay); fix in 2 files. Day-2+ review = everyday steady-state (more important) | **ACCEPT** — 4-cell matrix |
| C5 | med | Snapshot = review-retake restore, currently **UI-UNREACHABLE** (canRetake only for new tests; review card = Continue only). Fix A improves it. §7 "crash-recovery valid snapshot" untestable → reword "review-retake restore (dormant) restores pre-completion values", assert at UNIT level (snapshot shape + snapshotDayNumber) | **ACCEPT** — converges A2 + my B6-reject; retake residual is DORMANT (supports A-only-now) |
| C6 | med | EXPECTED-RED must pin the bug SIGNATURE (rebuild text AND day_guard_rejected log AND preceding csd_twi_reconciled for this user/list), flag-ON, N≥2 consecutive | **ACCEPT** |
| C7 | med | No negative-control: "different-day stale STILL blocked" (§7) asserted but never driven. Add stale-completion overlay asserting guard fires + **recoverable** rebuild (sessionCleared:true) | **ACCEPT** — prefer UI stale-tab replay; sandbox seed only w/ owner OK (read-only-Firebase rule) |
| C8 | nit | Keep settle-before-navigate for the RIGHT reason: guards a DIFFERENT live hazard (nav/unmount between attempt-write & updateClassProgress → day "completes" via silent reconciliation, no recentSessions/sessions). Survives Fix A. Rewrite §8 rationale | **ACCEPT** — corrects my "becomes unnecessary" claim |
| C9 | nit | MCQ parity CONFIRMED identical (one fix pattern). (a) TypedTest block is inside re-invocable `doWriteAndFinalize` closure ("Retry Save" re-runs) → swap lands INSIDE closure. (b) 823/543 fallbacks safe to leave reconciling | **ACCEPT** — fold into §3/§9 |

---

## ★ CONVERGED DECISIONS (all 3 lenses; pending Codex concurrence) → v2 shape
1. **Fix A is the fix. Flag-GATE it** (`LIST_SCOPED_RECON ? getClassProgress(...) : getOrCreateClassProgress(...)`). Rewrite §1/§3 — the reconcile-WRITE is NOT flag-only; the false "non-advancing read path" claim is deleted.
2. **null-path:** on `getClassProgress()===null`, skip BOTH the snapshot read AND the snapshot `updateDoc`, proceed straight to `completeSessionFromTest` (updateClassProgress self-creates via setDoc). NEVER fall back to getOrCreateClassProgress. Delete the `??` snippet.
3. **SCOPE = Fix A only, both files, inside `doWriteAndFinalize` closure (Typed) + MCQ:718.** Mark `TypedTest.jsx:823` / `MCQTest.jsx:543` DO-NOT-TOUCH. Add `?? null` guards on the 7 snapshot fields.
4. **Fix B → DEFERRED to a separately-designed follow-up** (not needed for #10-as-filed; residual is dormant/rare; as-specced it's UNSAFE). If ever built: disambiguate via `recentSessions` (day===N present? → alreadyComplete sentinel, skip sessions-write+graduation; absent? → apply non-CSD updates, skip CSD increment) + distinct log. ← **KEY DECISION for David/Codex.**
5. **Snapshot reframed** = review-retake rewind (dormant, UI-unreachable), not crash-recovery. Fix A makes it MORE correct. Reject B6.
6. **Overlay redesign (the real teeth):** DISCRIMINATING asserts (recentSessions+1 day===N; 1 new sessions doc; session_states COMPLETE; 0 day_guard_rejected; **0 csd_twi_reconciled in window, unconditional**), 4-cell matrix {Day1-new, Day2+-review}×{Typed,MCQ}, signature-pinned EXPECTED-RED (flag-ON, N≥2), + stale-completion negative control (recoverable rebuild).
7. **Keep settle-before-navigate** (guards nav-interrupt completion-chain hazard; survives Fix A) — rewrite the rationale so it's not deleted as obsolete.
8. **Out-of-scope observations to log (not #10):** flag-off silent loss of session-summary on session-final completions (A1); nav-interrupt silent-reconcile completion (C8) — backlog candidates.

## Codex — external review (R1) — TRIAGED · verdict NEEDS_FIXES
Concordant with all 3 fable lenses. Confirmed C1/C2/C3 + open-Q3 (retake-recovery consumer → corroborates my B6 REJECT).
| # | Sev | Finding | Claude verdict |
|---|-----|---------|----------------|
| F10-1 | blocker | create-if-missing fallback re-introduces race | **ACCEPT** — removed fallback. Went BEYOND Codex's `?? createClassProgress`: also skip snapshot-persist on null (Codex's shape leaves `updateDoc({progressSnapshot})` throwing on missing doc). |
| F10-2 | high | flag-gate the swap (agrees R1) | **ACCEPT** — §3 flag-gated shape |
| F10-3 | med | Fix B not in first impl; Fix A only | **ACCEPT** — §4 deferred |

## → v2 WRITTEN + handed back for round 2 (WARM DELTA)
v2 folds ALL 4 reviewers. Handoff `handoffs/claude_to_codex_fix10_002.md`; 3 claimsToCheck (null-path skip safety; flag-off `?? null` granularity; overlay `csd_twi_reconciled` discriminator). Baton → codex round 2.

## ✅ ROUND 2 — Codex GO / CONVERGED-OK → DESIGN CONVERGED
`codex_review_fix10_002.md`: all 3 R1 fixes confirmed resolved; 3 claimsToCheck answered — (1) null-skip SAFE; (2) read-source gating SUFFICIENT (`?? null` needn't be gated); (3) reconciliation-discriminator VALID with a **tight-window boundary** (exclude dashboard reloads / session-entry probes; race-detector not sole oracle). Folded the boundary into §8 → **v3**. Baton CLOSED (`state=converged`, `turnOwner=done`). `CONVERGED.md` written. **GATE: awaiting David's explicit implementation go-ahead before any src/ change.**
