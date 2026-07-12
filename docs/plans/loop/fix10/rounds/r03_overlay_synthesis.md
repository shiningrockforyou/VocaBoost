# Fix10 — Overlay-harness audit synthesis (3-agent fable + Codex)

Harness: `audit/playwright/lsr_fix10_overlay.mjs`. Spec: `plan.md` §8. Claude verifies EACH finding against
real code (accept/reject w/ file:line), folds survivors, hands back to Codex. **Hold edits until all in.**

Status: ALL IN — Lens A ✅ · Lens B ✅ · Lens C ✅ · Codex ✅ (NEEDS_FIXES). **v2 WRITTEN — adjudication below.**

## ★ ADJUDICATION & APPLIED (overlay v2) — all verified against real code before applying
Lens A confirmed the decisive property independently: **false-GREEN is structurally impossible** (guard-reject
path can't satisfy d2/d3). Every finding was legitimate (harness was fresh) — no outright rejections; a few
applied partially (noted). Code facts verified: `attempt_day_fallback` (TypedTest.jsx:836/MCQTest.jsx:555),
`day_guard_session_clear_FAILED` (studyService.js:638), study_states `listId` field, `__consoleLog`/`__dialog`.

| Cluster | Findings | v2 action | Status |
|---------|----------|-----------|--------|
| Poll-until-stable reads | A1, F10O-2, B5, B10, my-catch | `stableRead()` generic; `before` DRAINS async recon log then snapshots; `after` polls until recentSessions/sessions/phase/logs stable; settle-nonadvance+clean → NOT-MEASURED | ✅ APPLIED |
| RED honesty | F10O-1, A2, B6 | `driveNewPass` RESUMES on rebuild (broken build persists via reconcile) → Day-2 review reachable both builds | ✅ APPLIED |
| RED fatal gate | F10O-3, B1 | fatal gate BEFORE both branches | ✅ APPLIED |
| RED consecutive-runs | C2, B2, A5 | single run = REPRO-CANDIDATE; CONFIRMED needs prior matching run same BUILD_ID (RED_STATE file) | ✅ APPLIED |
| Page identity | C1 | `observedMode()` typed-XOR-mcq must match cell.mode → INVALID | ✅ APPLIED |
| Verify final PASS | C3, B4 | `finalFailVisible()`; non-pass → final-not-passed NOT-MEASURED (not fix-FAIL) | ✅ APPLIED |
| Harness-race confounder | B3 | `precededByAccept` recorded per cell; RED sig excluded if reload-preceded (`redConfounded`); rebuild packet (dayGuardWarn+lastDialog+shot) | ✅ APPLIED |
| study_states freshness | F10O-4, B7 | baseline requires studyStatesForList(LIST.id)===0; invalid flag CONSUMED → INVALID verdict | ✅ APPLIED |
| Fallback disambiguation | A3 | in-window `attempt_day_fallback` exonerates a d6 miss (`fallbackInWindow`) | ✅ APPLIED |
| clear-FAILED variant | A4 | redSignature accepts rebuild-clear-failed + guardFailed delta | ✅ APPLIED |
| recon-precedes-guard ordering | C7 | `logCountTs` returns latestMs; `reconPrecedesGuard` in redSignature | ✅ APPLIED |
| Verdict hygiene | B8, B9, C4 | unified exit codes; fatals surfaced before INCOMPLETE; negControl set UNCONDITIONALLY | ✅ APPLIED |
| settle comment / dead code | C9, C10 | settle carries §8 nav-interrupt rationale; dead code removed; NO-REPRO hint reworded | ✅ APPLIED |
| Runbook | C8 | header documents all env knobs + flag-ON red precondition + wordmap dependency | ✅ APPLIED |
| Snapshot 7th discriminator | C5 | `d7_snapshot` DIAGNOSTIC (post-fix csd===N-1), NOT gating (avoid over-coupling) | ◑ PARTIAL (diagnostic) |
| Negative control impl | C4, F10O (§8) | surfaced unconditionally + TODO; the actual two-context stale replay NOT implemented (needs owner sign-off for a FB seed) | ◑ DEFERRED (surfaced) |
| Shared `'results'` matcher tighten | A1(a) | NOT changed (shared lsr_ui.mjs → affects Phase-1); neutralized LOCALLY via poll-until-stable+settle+PASS-verify; documented in header | ◑ DEFERRED (neutralized) |
| logCount unbounded scan | A6 | not addressed (availability nit; fail-closed on error) | ○ NOTED |

**v2:** 523 lines, node --check clean. → handed to Codex round 2 (warm) + noted deferred items for its call.

## ✅ ROUND 2 — Codex GO / CONVERGED-OK → OVERLAY HARNESS CONVERGED
`codex_review_fix10overlay_002.md`: all 4 r1 findings resolved; all 3 claimsToCheck accepted; all 3 DEFERRED
items ratified (defer negControl, defer shared matcher, KEEP d7 diagnostic). 3 non-blocking notes → folded as
v2 polish (Codex's own suggestions, no design change): (1) comment/code match on redCells (setup rebuild =
diagnosis only, not counted); (2) guardFailed+fallback added to the after-read stable key; (3) red_state now
keyed by buildId+harnessRev+cellSet so a stale candidate can't confirm across harness edits. node --check
clean (531 lines). Baton CLOSED (state=converged). **Harness READY** — green after David deploys the fix
(proves it); red against a pre-fix flag-ON build (2 consecutive runs = REPRO-CONFIRMED).

---

## Lens C — coverage & completeness — RECEIVED (10 findings), Claude triage PENDING full-set
Verified foundations (agent's own checks, to re-confirm): mode→page mapping real (testMode exact-verified +
TypedTest.jsx:971-974 isSessionFinalTest); 4 cells = {new-final,review-final}×{typed,mcq}; window opens after
reach (Codex R2 boundary ok); d4 casing 'complete' ok; d1-d6 map 1:1 to §8; false-GREEN protected by
lastDay===N / days.includes(N) pins.

| # | Sev | Finding (short) | Prelim lean (VERIFY before applying) |
|---|-----|-----------------|--------------------------------------|
| C1 | high | **Rendered page identity never asserted** — driveNewWordsToTest/driveTest accept typed OR mcq; if app mis-renders typed for an mcq class, MD1/MD2 drive TypedTest, all green, prints PASS 4/4 while MCQTest never exercised. `path` is static metadata. | **LIKELY ACCEPT** — assert typed-input XOR mcq-arrow matches cell.mode after reach; INVALID on mismatch |
| C2 | high | **RED "N≥2 consecutive runs" rewritten to "≥2 cells/run"** — no cross-run state; §8 means run-stability | **LIKELY ACCEPT (downgrade verdict)** — emit REPRO-RUN-1 "needs 2nd consecutive run" OR persist BUILD_ID-keyed counter + document 2-run runbook |
| C3 | high | **driveNewPass accepts outcome==='results' as pass — a FAILED test also shows results** (studyOneDay has the fail-verdict check /retake required|불합격|not complete/, overlay omitted). Day-2 setup can silently replay day-1 → cell FAIL misattributed to fix | **LIKELY ACCEPT** — add fail-verdict check + FB corroboration between setup & measure (csd===dayNum-1); mark INVALID(setup) not fix-FAIL |
| C4 | med | Negative control silently null in default run — set out.negControl unconditionally {status:'skipped(not-implemented)'} + PASS caveat; reword fatal-on-complete as TODO | LIKELY ACCEPT |
| C5 | med | Retake-rewind snapshot assert (§7/§5) implemented nowhere — overlay could read progressSnapshot in `after` (post-fix currentStudyDay===N-1, broken===N) as a 7th discriminator/diagnostic | **CONSIDER** — cheap extra teeth; verify snapshot semantics vs fix (snapshot stores pre-completion = N-1) |
| C6 | med | Wordmap-coverage dependency unsurfaced + inconsistent: MCQ gap→selector-gap (FATAL) flips green→FAIL on one benign gap; typed gap→silent empty answer, ≥3 gaps fail threshold. wordmap 3380 vs 3381 words | **VERIFY** — is selector-gap really fatal here? document dependency; maybe downgrade per-word gap to non-fatal for this overlay + preflight coverage |
| C7 | med | RED signature checks recon>before (any in-window) not ordering ("immediately-preceding" per §8); logCount discards timestamps | LIKELY ACCEPT (red-mode only) — return latest ts per type, assert recon.ts<=guard.ts |
| C8 | med | Runbook gaps: FIX10_S_* / MAX_MS / SETTLE_MS knobs + flag-ON red precondition undocumented | ACCEPT (doc) |
| C9 | nit | settle comment gives only window rationale; §8 ordered the nav-interrupt rationale so future cleanup won't delete it | ACCEPT (comment) |
| C10 | nit | Dead code: precededByAccept set-never-read, driveNewPass dayNum unused, redundant `redCells>=2 && ===CELLS.length`, NO-REPRO hint cites §8 for "timing" but §2 says deterministic | ACCEPT (cleanup + reword hint) |

**My own pre-identified fold (independent of agents):** `settle` waits only for csd; the `sessions` doc is a
SEPARATE batch committed AFTER updateClassProgress (studyService.js:660-672) → a single post-settle `after`
read can catch csd advanced but sessions/session_states not yet landed → false-RED d3/d4 on a correct build.
FIX: make `after` poll-until-stable (like Phase-1 fbConfirm), not read-once. (Lens A/B chartered to confirm.)

## Lens A — oracle soundness — RELAUNCHED (prior run died on session limit) — PENDING
## Lens B — fail-closed robustness — RECEIVED. **GREEN path = genuinely fail-closed (NO false-green path found).** RED path + flake-misattribution are the gaps.
Independently VERIFIED fail-closed (strong corroboration, keep in mind): null log reads can't false-green
(reconOk/guardOk require both endpoints non-null); PASS gating solid (out.invalid + measured<CELLS block PASS,
green needs 0 fatals + 4/4); field-name integrity (both logs emit top-level userId/classId/listId; COMPLETE==='complete';
recentSessions appends at end); cross-cell (all reads (uid,classId,LIST.id)-scoped); dup (single driveTest, exact +1 fails on app dup).
| # | Sev | Finding | Prelim lean |
|---|-----|---------|-------------|
| B1 | high | RED skips fatal gate → false-REPRO exit 0 | **ACCEPT** (== F10O-3) — RED-INVALID on fatals before REPRO-* |
| B2 | high | "N≥2" = cells-in-one-run, not consecutive runs (§8) — single-run systemic artifact imprints all 4 cells | **ACCEPT** (== C2) — REPRO-CANDIDATE single run; REPRO-CONFIRMED only after 2nd matching run same BUILD_ID |
| B3 | high | **precededByAccept is DEAD CODE** — the beforeunload-accept reload is the prime rebuild confounder (Phase-1 records it in diagnoseRebuild); overlay computes but never records/consults it → harness-race red counts toward the #10 signature; green FAIL misattributed | **ACCEPT — strong** — record precededByAccept per cell; RED signature cell with precededByAccept===true must NOT count; port a minimal diagnoseRebuild packet (dayGuardWarn + lastDialog) for every non-clean cell |
| B4 | med | Final-test PASS never verified — a FAILED final (score<THR from wordmap gaps) also shows `%`/'results' → d1 true but session not completed → settle times out → d2-d4 false → FAIL blamed on FIX | **ACCEPT** (== C3/C6) — after 'results' assert pass-visible/fail-text-absent; on fail return ok:false reason:'final-not-passed' → NOT-MEASURED (INCOMPLETE), not fix-FAIL |
| B5 | med | settle timeout recorded but never consulted → discriminators judged on unsettled snapshot → FAIL attributed to fix (fail-closed re green, but flake→fix-indictment) | **ACCEPT** — if !settled.advanced && outcome==='results' → ok:false reason:'unsettled' → INCOMPLETE |
| B6 | med | RED Day-2 setup no rebuild-resume → reliably-broken build = INCOMPLETE forever (broken build DOES persist via reconcile → Phase-1 state-aware resume would recover) | **ACCEPT** (== F10O-1) — driveNewPass on rebuild re-check FB (csd advanced? → setup-complete, it's unmeasured) |
| B7 | med | non-pristine → INCOMPLETE not INVALID; `invalid:true` flag never consumed; assert near-tautological for a fresh class (only guards uid-resolution, since all reads class-scoped) | **ACCEPT** — consume invalid flag → INVALID verdict; F10O-4 study_states check gives the assert real teeth |
| B8 | nit | INVALID exit-code inconsistency (pre-flight exits 2, final INVALID exits 1) | ACCEPT — unify |
| B9 | nit | INCOMPLETE precedence hides a fatal BUG from the verdict string (JSON keeps it, exit 1 anyway) | ACCEPT — surface fatals in verdict even when INCOMPLETE |
| B10 | nit | no grace re-read for log-write latency on d5/d6 after-counts (redundant w/ d1/d2 catching a harmful recon, but) | ACCEPT — folds into the poll-until-stable after-read |

## Codex — external harness review — RECEIVED, verdict NEEDS_FIXES. Confirms green oracle shape correct.
| # | Sev | Finding | Prelim lean (VERIFY before applying) |
|---|-----|---------|--------------------------------------|
| F10O-1 | **blocker** | **RED-mode Day-2 cells structurally unreachable on the BROKEN build** — driveNewPass(day1) rejects `unexpected-rebuild`, but on the broken build Day-1 final completion IS a #10 trigger → setup fails before measuring Day-2 review → red can't produce the claimed 4-cell confirmation. The "fixed=green/broken=red both Day-1 & Day-2+" claim is false for red. | **ACCEPT** — rescope RED to the cells it can actually reproduce (Day-1 new-final × {typed,mcq}); Day-2 red needs owner-approved seed OR is explicitly out of red scope. Fix the contract/docs. (Overlaps C2 = the N≥2 wording.) |
| F10O-2 | high | **d6 false-RED: session-entry `csd_twi_reconciled` log is async+unawaited** (progressService.js:253 logSystemEvent NOT awaited; db.js:90-97 addDoc+serverTimestamp) → a legit entry-recon log can land AFTER `before` is captured → after.recon=before.recon+1 on a FIXED build → false-red. | **ACCEPT** — before opening the window, DRAIN/stabilize: poll logCount until stable across ≥2 polls, THEN set `before`. (Cousin of my own sessions-doc catch → both need poll-until-stable.) |
| F10O-3 | high | **Fatal findings don't fail RED-mode** — the fatal gate is only in the green branch; red can exit 0 REPRO-CONFIRMED with unexpected-dialog/page-error/selector-gap/modal-dead present. | **ACCEPT** — apply fatal gate BEFORE both branches (or red→INVALID on fatals). |
| F10O-4 | med | **Pristine baseline misses list-scoped `study_states`** — csd/twi/attempts are class-scoped; a reused account can carry old list/word `study_states` for LIST.id while showing zero class progress → false-red/incomplete. | **ACCEPT** — add read-only baseline check: no `study_states` for LIST.id (or proven-clean accounts). |

Codex nuance (confirmed, keep): `saveSessionState(phase:COMPLETE)` (studyService.js:1345/1405) stamps COMPLETE
BEFORE recordSessionCompletion, so the broken path can briefly stamp COMPLETE before the day-guard clears
session_states — the after-SETTLE `phase==='complete'` check is still useful because the reject path CLEARS
it. → d4 stays valid but must be read AFTER settle (already is); confirm the clear actually removes the doc
(phase read returns null) vs leaves a stale COMPLETE — VERIFY in adjudication.

## ★ CROSS-REVIEWER CONVERGENCE (so far: Lens C + Codex + my own catch)
- **Poll-until-stable reads** (my sessions-doc catch + Codex F10O-2 recon-log): the single-read `after` and the
  `before` recon count are BOTH stale-read hazards → both need stabilization. This is the #1 structural fix.
- **RED-mode is over-claimed**: C2 (N≥2 consecutive-runs vs cells) + F10O-1 (Day-2 unreachable on broken) →
  RED needs honest rescoping to Day-1 × {typed,mcq}, single-run = REPRO-RUN-1.
- **Fail-closed holes**: F10O-3 (fatal gate not in red) + C1 (page-identity unasserted) + C3 (driveNewPass
  accepts failed test) + F10O-4 (study_states freshness) → several ways to false-green/misattribute.
- Awaiting Lens A (oracle/settle) + Lens B (fail-closed) to complete the picture before the single-pass apply.
