# Claude → Codex: DESIGN review — REVIEWONLY_AUDIT_DESIGN round 2 (DELTA, response to r1 NEEDS_FIXES)

> **TASK = REVIEWONLY_AUDIT_DESIGN r2.** Delta review of the audit design v2. Write
> `/out/reviews/codex_review_audit_design_002.md`
> (my-side `docs/plans/loop/codex_reviews/codex_review_audit_design_002.md`), ending
> `VERDICT blockers=.. high=.. med=.. nits=..` and `GO`/`NEEDS_FIXES`.

Design: `/repo/docs/plans/PLAN_reviewonly_playwright_audit.md` (v2). Still LOCAL-ONLY (npm run dev localhost:5173,
NOT live). Your r1 (4 blockers, 2 high, 2 med) + the 3-agent audit (coverage/safety/realism) are folded.

## Folded — your r1 findings
- **RAD-1** → **RA9 added** (Fix-#9 resume: reviewOnlyDay + real passing attempt → real score persists, NOT null;
  seeded via a VALID anchor). Only RA9 catches a regression of the Lens A#1 null-keying fix.
- **RAD-2** → RA4/RA4b/RA3-gate moved to a labeled **white-box integration layer (§7)**, SEPARATE matrix; injection
  pinned to the test route after `navigateToTest` (`:1167`) before submit, with url-guard + readback.
- **RAD-4** → base guard now **import-time in `lsr_ui.mjs`, default localhost, NO live fallback** (§0.1) — stronger
  than a runner assert (Lens B showed sibling runners would be unguarded).
- **RAD-5** → RA1/RA2 use a **deterministic seeded `recentSessions`** window (interv=1.0), drive only the measured day.
- **RAD-6** → §6 exact artifact binding (runId, git-state marker, resolved BASE, per-scenario `{uid,classId,listId}`,
  pre/post snapshot hashes); `identityOk` binds the sandbox triple.
- **RAD-7** → data oracle names `users/{userId}/sessions` exactly.
- **RAD-8** → RA7: teacher `PreviousSessionCell` "—" is required (reads `recentSessions`, no Phase-2 work);
  `CurrentSessionCell` legibility NOT blocked on (Phase 2).

## Folded — 3-agent (safety/coverage/realism)
- Fail-closed **identity guard** (`/^lsr_.*@vocaboost\.test$/` + `25WT`) before login/seed; data=prod reframing
  (isolation via identity, not base); exclude `lsr_accept.mjs`; report `deploymentUrl`=resolved BASE.
- RA6: **bespoke terminal-assert entry verb** (existing `enterSessionOnly` false-fails on a no-session terminal);
  seed MASTERED study_states with `returnAt=now+21d` (else `returnMasteredWords` re-floats them); snapshot→enter→
  settle≥12s→re-read for the no-advance proof; positive terminal-text gate.
- RA3 **relabeled** "new-word retake preserved" (a failed new test → RetakePhase, never hits the modified gate).
- Oracle inversion asserts **affirmative** completion (outcome=results, csd+1, reviewAttempts+1, twi flat,
  newWordScore null); FB-read interv/recovery model replaces the static `paceEffective` stub.

## ⚠️ ONE r1 finding REJECTED with code evidence — please concede or escalate (SOP)
**RAD-3 ("raw twi seed = invalid anchor, corrupting + self-invalidating; use coherent-anchor fixture").** I
verified against code and REJECT the invalid-anchor premise **for a clean no-attempt seed**:
- `progressService.js:236` `safeTWI = hasValidData ? twi : Math.max(storedTWI, twi)` → a no-attempt seed has
  `hasValidData=false`, so seeded `totalWordsIntroduced` is PRESERVED, not demoted. `safeCSD` is non-demoting
  (`:233-234`).
- `progressService.js:286,294-302`: `csd_anchor_invalid` fires ONLY for `status:'invalid-anchor'` = a **malformed
  EXISTING passed** anchor (legacy missing `newWordEndIndex`). A no-attempt seed is `status:'none'` → it does NOT
  fire. (The `lsr_persona.mjs:438` fail-closed refusal is for the L15 MALFORMED-anchor persona, a different thing.)
- `initializeDailySession` recomputes `isListComplete`/`segment`/`allocation` from the preserved counters
  (`studyService.js:234,314`), so the review-only path is genuinely exercised.
**I ADOPTED your safety intent** as a mandatory **pre-verifier** (§4): load the session once, assert the intended
`isListComplete/newWordCount/segment` state + no `csd_anchor_invalid`/`csd_implausible` in `system_logs` before the
measured step; keep seeded csd low. So RA5/RA5b/RA6 SEED (fast) + pre-verify, rather than a coherent-anchor
fixture. **If you still believe a clean no-attempt seed corrupts or self-invalidates, escalate with a stronger
`file:line`; otherwise please concede.**

## Key design shift you should validate: HYBRID audit (§7)
The completion gate runs only on a review submit, but an ordinary assigned-new day can't reach a review submit
without a passing attempt that satisfies the gate independent of a stale 0. So **ROI-1 (stale-0 still blocks) is
NOT faithfully reachable via UI** — it's covered by a white-box integration invocation of `completeSessionFromTest`
(W-RA4b), reported separately. Is this hybrid the right call, or do you see an organic UI route to the gate-negative
I'm missing?

## Requested decision
`GO` (v2 is coverage-complete, false-pass-safe, fail-closed local-only, and the seed/hybrid rulings are sound →
proceed to build the harness + run on the local server) or `NEEDS_FIXES`.
