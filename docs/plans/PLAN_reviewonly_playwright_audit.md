# PLAN — Playwright acceptance audit: review-only-day completion (Phase 1) — v2

**What it certifies:** the converged Phase-1 fix (`PLAN_review_only_day_completion.md`, code loop CONVERGED at
Codex REVIEWONLY_IMPL r3 GO) behaves correctly END-TO-END against **the local dev server running the fixed code**
— NOT live. v2 folds the design-review round (3-agent A/B/C + Codex REVIEWONLY_AUDIT_DESIGN r1). **This is a
HYBRID audit:** most behaviors are driven E2E in a real browser; two gate-negatives (ROI-1 stale-0, absent
config) are NOT faithfully reachable through UI routing (see §7) and are certified by a clearly-labeled white-box
integration layer instead. A UI-only certification would silently skip the most dangerous regression.

## 0. Environment — LOCAL ONLY (safety-critical; David 2026-07-12)
- **Target = `http://localhost:5173`** (Vite `npm run dev` serving THIS working tree's fixed code). The live site
  `https://vocaboostone.netlify.app` has ACTIVE STUDENTS (26SM) — NEVER the target, NEVER deployed to this cycle.
- **"local-only isolates the CODE, not the DATA" (Lens B).** The dev server + the admin SDK both hit the SAME
  prod Firebase project (`lsr_persona.mjs:66` = prod `serviceAccountKey.json`). The base guard only stops driving
  the live UI; **real-data containment rests on SANDBOX-IDENTITY discipline, which must be fail-closed** (§0.2).
- **0.1 — Base guard (import-time, default-local, no live fallback):** change `lsr_ui.mjs:14` to
  `export const BASE = process.env.LSR_BASE_URL || 'http://localhost:5173'` and add an **import-time** assertion
  in `lsr_ui.mjs` module top-level (runs for EVERY importer — `lsr_persona`, `lsr_runSL_phase1`, teacher setup —
  before any `launch()`/`page.goto`): throw unless `new URL(BASE).hostname ∈ {localhost,127.0.0.1}` AND
  `protocol === 'http:'`. Guard failure = INVALID / exit 1. (Codex RAD-4 + Lens B BLK1: a runner-level assert
  would leave sibling runners unguarded; the live default is a fail-OPEN misuse surface.)
- **0.2 — Identity guard (fail-closed, before any login/seed):** assert `STUDENT`/`TEACHER` match
  `/^lsr_.*@vocaboost\.test$/` AND the resolved `className` carries the `25WT` sandbox prefix; abort (INVALID)
  otherwise. Sandbox isolation must be an enforced check, not a comment (Lens B HIGH1). Every seed WRITE is gated
  on a verified sandbox `{uid, 25WT classId, cloned listId}` triple (Lens B HIGH2). NEVER touch `26SM`.
- **0.3 — Scope:** ONLY `lsr_persona.mjs` (+`lsr_ui.mjs`) + a new white-box module (§7) are in scope.
  `lsr_accept.mjs` (hardcodes the live URL in its report label, `:348`) MUST NOT run this cycle (Lens B MED1).
  Every manifest/report `deploymentUrl` = the RESOLVED `BASE` (`lsr_ui.mjs:54`), never a hardcoded string.
- **0.4 — Pre-flight (task #14):** `curl -sf http://localhost:5173` returns the SPA shell BEFORE Playwright. Cold
  server = INVALID, not fail. Confirm `LIST_SCOPED_RECON===true` in the dev build (`featureFlags.js:41` — it is).

## 1. Behaviors under test (what the fix changed)
1. Review-only day (newWordCount≤0 with a CONFIRMED reason: throttle `allocation.newWords≤0`, list-end
   `isListComplete`, or Fix-#9 `startPhase===REVIEW_STUDY`) COMPLETES on review → csd+1, review in `recentSessions`,
   intervention recovers. 2. TWI never moves (clamp 0), even for negative counts. 3. Nulls are LITERAL only when
   NO new-word attempt existed (a #9 resume keeps its REAL score). 4. §5 list-end terminal + persistent
   finished-hero; the no-work all-mastered terminal completes WITHOUT recording. 5. A stale/forged finite
   `newWordCount:0` on an ORDINARY assigned-new day still hits the gate (ROI-1).

## 2. E2E scenarios (real browser; each has a UI oracle AND a Firestore data oracle)
> The freeze/phantom personas in `lsr_persona.mjs` encode **EXPECTED-BLOCKED** (pre-fix). The oracle inversion:
> those review-only days now **EXPECTED-COMPLETE**. The inverted oracle must assert AFFIRMATIVE completion signals,
> not just "not blocked," or it false-greens a silent no-op (Lens A HIGH, Lens B MED3).

| # | Scenario (§8) | Setup (deterministic) | Drive | UI oracle | Firestore data oracle |
|---|---|---|---|---|---|
| **RA1** | Full-freeze RECOVERY (§8.1) | **SEED `recentSessions` = three `{reviewScore:0.25, newWordScore:null}`** → `calculateInterventionLevel`==1.0 exactly (`studyAlgorithm.js:66-91`); pace **≥3**; small clone list | drive the review-only day's review test to a HIGH pass (existing `enterReviewSession`→`driveTierTest`→`pollAdvanced`) | review completes → **results** screen (NOT retake-gate) | day outcome `results`; `csd`+1; `twi` FLAT; `recentSessions[last]`: reviewScore set, `newWordScore===null`; **new-attempt Δ0**; then a subsequent driven high-review day yields `newWordCount>0` (recovery CLOSES — assert on a well-defined day, pace≥3 pushes interv→0 unambiguously) |
| **RA2** | Persistent-low (§8.2) | seed interv=1.0 as RA1; **drive LOW reviews (avg ≤0.30) each day** to keep interv pinned | complete each review-only day | each completes; no permanent block | `csd` advances EACH day; `twi` flat; `reviewAttempts`+1/day; no `requiresNewWordRetake` |
| **RA5** | List-end + backlog (§8.5) | **SEED `class_progress.totalWordsIntroduced = listSize`, empty `attempts`, low `csd`** on a small clone list w/ an unmastered backlog; **PRE-VERIFY** (§4) | drive the review | **"🎉 You finished the list!" terminal** (CompletePhase); Dashboard hero persistent finished state | `twi == listSize` (flat); `csd`+1; no retake gate |
| **RA5b** | Over-introduced (§8.5b) | **SEED `twi > listSize`** (over-introduction is SEED-ONLY — undrivable), empty attempts; pre-verify | drive the review | terminal finished screen | `wordsIntroduced` persists 0; `twi` does NOT DECREASE (exactly flat) |
| **RA6** | List-end NO review work (§8.6/ROI2-1) | **SEED `twi=listSize` + ALL `study_states` MASTERED with `returnAt = now+21d`** (else `returnMasteredWords` flips them back, `studyService.js:164,1134` — Lens C MED5); FRESH day (no passing new attempt today, so routing hits `:839` not the recording `:810` — Lens A HIGH); pre-verify empty segment | **bespoke verb**: navigate `/session/{c}/{l}`, assert terminal, do NOT use `enterSessionOnly` (it waits for in-session UI that never renders — Lens C BLK3) | **"You finished the list!"/"List complete" VISIBLE** (positive proof, hard gate) AND **no review test** (`Card N of M` absent, definition-input count 0) | **snapshot before → enter → settle ≥12s → re-read**: `currentStudyDay`, `recentSessions.length`, `users/{uid}/sessions` count all **UNCHANGED** (Codex ROI2-1; bounded settle window — Lens C MED4) |
| **RA9** | Fix-#9 resume real-score (§3, Lens A#1) | **SEED a same-list PASSED `new` attempt** (valid anchor: `newWordEndIndex/StartIndex/wordsIntroduced/testId` — like `manual-pass.mjs`) so `startPhase===REVIEW_STUDY` w/ a genuine passing attempt | drive the review | session completes normally | `recentSessions[last].newWordScore === the REAL score (NOT null)`; `session_state.newWordsTestScore` == real; `newWordsTestPassed === true`; `twi` flat. **A regression keying the null-write back on `reviewOnlyDay` is caught ONLY here** (Codex RAD-1, Lens A BLK1). |
| **RA7** | Analytics null (§8.7) | after RA1 | — | teacher `PreviousSessionCell` renders "—" for null newWordScore (already reads `recentSessions`, NO Phase-2 work — `ClassDetail.jsx:42`); `SessionSummaryCard` hides the New-Word row | `recentSessions[last].newWordScore===null`; `avgNewWordScore` excludes it (no NaN). **Teacher UI assert = REQUIRED for PreviousSessionCell only; the CurrentSessionCell "New: ✗ -" legibility is Phase-2 — do NOT block on it** (Codex RAD-8) |
| **RA8** | Recon re-verify (§8.8) | multiple review-only days (RA2) | drive several | csd climbs monotonically | `csd` NON-DEMOTING across review-only days; no `csd_anchor_invalid`/corrupting orphan write in `system_logs` (log-only OK) |

**RA3 (§8.3, negative gate) RELABELED — "new-word RETAKE preserved":** a failed new-word test lands on
`RetakePhase` (`DailySessionFlow.jsx:2141`) and NEVER submits a review, so it does not touch the modified gate line
`!reviewOnlyDay && …` (`studyService.js:1430`). RA3 therefore proves only that the pre-existing new-word retake
still blocks — a real but DIFFERENT assertion. Drive it via the existing retake/blocked-day path with an
affirmative block signature; drop the "requiresNewWordRetake path" claim (Lens A MED). The modified gate line is
covered by the white-box layer (§7).

## 3. Oracles — both layers required
- UI layer visible + screenshotted; data layer = read-only admin `.get()` on `class_progress`
  (`csd`/`twi`/`recentSessions`), `users/{userId}/sessions` (exact path — Codex RAD-7), `session_states`,
  `system_logs`. App-health PH-6 fatal set (console-error / page-error / dialog / auth) ⇒ NOT-CLEAN.
- **Affirmative-completion requirement:** every EXPECTED-COMPLETE oracle asserts `{outcome:results, csd+1,
  reviewAttempts+1, twi flat, newWordScore null}` — never merely "not blocked" (Lens B MED3).

## 4. List-end SEEDING is SAFE + faithful (Q1 RESOLVED — seed, don't drive) — with a PRE-VERIFIER
Adjudicated against code: a CLEAN no-attempt seed of `class_progress.totalWordsIntroduced` is PRESERVED, not
demoted (`safeTWI = Math.max(storedTWI, twi)` no-anchor path, `progressService.js:236`; `safeCSD` non-demoting
`:233-234`) and does NOT trip `csd_anchor_invalid` (that fires ONLY for a malformed EXISTING passed anchor,
`status:'invalid-anchor'` at `:294-302`; a no-attempt seed is `status:'none'`). Codex RAD-3 / Lens B BLK2's
"invalid anchor" premise is REJECTED for a no-attempt seed (it applies to the L15 malformed-anchor persona,
`lsr_persona.mjs:438`, which we do NOT use). `initializeDailySession` recomputes `isListComplete`/`segment`/
`allocation` from the preserved counters (`studyService.js:234,314`), so the review-only path is genuinely hit.
- **Mandatory PRE-VERIFIER (folds Codex RAD-3's safety intent):** before the measured step, load the session
  once and assert `initializeDailySession` yielded the intended `{isListComplete, newWordCount≤0, segment}` state,
  and that NO `csd_anchor_invalid`/`csd_implausible` appeared in `system_logs`. A seed that didn't reproduce the
  state = INVALID, not PASS.
- Keep seeded `csd` LOW (small clone list → list-end by day 2–3) to avoid the `csd_implausible` threshold
  (`progressService.js:303-323`). Seed `class_progress` only; leave `attempts` empty (except RA9's valid anchor).

## 5. White-box layer wording — NOT full-UI; injection timing pinned
- RA4/RA4b/RA3-gate use crafted state; they are labeled **white-box integration**, reported in a SEPARATE matrix
  from the UI-acceptance matrix (Codex RAD-2). `page.evaluate`/sessionStorage access is FORBIDDEN in `lsr_ui.mjs`
  (`:4-7`) — the white-box code lives in a NEW module (§7) with an explicit documented exception (Lens A MED).

## 6. Certification (fail-closed, exact artifact binding)
- Manifest binds: `runId`, local **git-state marker** (`git rev-parse HEAD` + dirty flag — the fix is
  uncommitted), resolved `BASE`, the EXACT scenario set, per-scenario `{studentUid, classId, listId}`, and
  pre/post state-snapshot hashes (Codex RAD-6). A partial/stale matrix must NOT certify.
- `identityOk` extended to assert the driven `{uid,classId,listId}` == the expected sandbox triple, not just tag
  match (Lens B MED4). Only an all-N/N CLEAN PASS certifies (exit 1 on any fail/INVALID/fatal/base-guard-trip).
- **Transient calibration (Lens C MED8):** every new oracle sets `confirmed=true` on its intended outcome so the
  `isRecoveredTransient` exemption (recovered ~1.4% grading/save transient) works for review-only days; a recovered
  save-error on a confirmed review-only day must be exempt independent of whole-run `allConfirmed`.

## 7. Un-drivable gate cases → white-box integration (why UI-only is insufficient)
The completion gate (`studyService.js:1430`) runs ONLY on a review submit, but an ordinary assigned-new day routes
to NEW_WORDS (`DailySessionFlow.jsx:817`); reaching a review submit requires a PASSED new attempt, which makes
`newWordAttemptPassed===true` → the gate passes regardless of a stale `newWordCount:0`. So ROI-1's "stale-0 still
blocks" is NOT reachable through organic UI routing (Lens A BLK2, Lens C BLK1 — the passing attempt dominates AND
the persisted `startPhase` is REVIEW_STUDY, making `reviewOnlyReasonConfirmed` true — the opposite of the needed
precondition). Faithful coverage requires:
- **W-RA4b (ROI-1):** invoke `completeSessionFromTest` with a crafted `dailySessionState` (`startPhase:NEW`,
  `newWordCount:0`, `allocation.newWords>0`, `isListComplete:false`) and NO passed attempt in Firestore → assert
  `requiresNewWordRetake` (gate NOT opened by the stale 0). If done in-browser, inject on the `/typedtest|/mcqtest`
  route AFTER `navigateToTest` (`:1167`) and BEFORE submit, with a url-guard + readback (earlier injection is
  overwritten — Lens C HIGH2). Prefer a headless integration invocation for determinism.
- **W-RA4 (absent config):** cleared `dailySessionState` → `reviewOnlyDay=false` (`Number.isFinite(undefined)`
  false) → gate applies iff no passed attempt; deterministic assertion, drop the "or self-heal" ambiguity (Lens C MED7).
- **W-RA3-gate:** the modified line `!reviewOnlyDay && newWordAttemptPassed!==true && …` — assert a review-only day
  with `reviewOnlyDay:true` skips the gate, and a non-review-only unpassed day still returns `requiresNewWordRetake`.

## 8. Harness changes (ALL harness-only; NEVER app source)
1. `lsr_ui.mjs`: import-time local base guard + local default (§0.1).
2. `lsr_persona.mjs`: identity guard (§0.2); `oracleForDay` review-only inversion (EXPECTED-COMPLETE + affirmative
   signals) + FB-read interv/recovery model replacing the static `paceEffective` stub (`:147`); update stale
   L14/blocked-branch comments (Lens A NIT); new seed helpers (recentSessions, list-end, MASTERED+returnAt, RA9
   valid anchor) gated on the sandbox triple; pre-verifier; extend `identityOk`; transient recalibration.
3. New white-box module for §7 (crafted-state gate tests), documented `page.evaluate` exception.
4. Read-only oracle helpers for `recentSessions`/`sessions`/`session_states`/`system_logs`.

## 9. Certification set: RA1, RA2, RA3(retake), RA5, RA5b, RA6, RA7, RA8, RA9 (UI matrix) + W-RA3-gate, W-RA4,
W-RA4b (white-box matrix). Both matrices must be all-CLEAN to certify Phase 1.
