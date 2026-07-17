# CS-2026-07-17 — Root-Cause Fix Effort (shared input)

Process: **Investigation Plan (3-agent converge)** → **Investigate (3-agent converge)** → **Implementation Plan
(3-agent converge)** → final plan + report. Fable agents, NO Codex. **Every agent finding verified by the orchestrator
against code/live data before it is trusted.**

## Today's CS tickets → the distinct issues behind them
(File:line anchors below are the orchestrator's *hypotheses* from prior investigation — to be RE-VERIFIED, not assumed.)

**I1 · Empty-submit regression (manual 0-answer reviews).** MCQ's "Submit Test (0/30 answered)" is always enabled
(`MCQTest.jsx:1453`); its only guard checks `testWords.length`, not answered count (`:497`, dead). The legacy client
writer *blocked* empty submits (`db.js:1246` `throw 'Cannot submit empty test'`) but the server callable it moved to
(`functions/index.js:495`) only validates `Array.isArray` — guard NOT replicated when `SERVER_ATTEMPT_WRITE` flipped
(~2026-06-22). Empty reviews record `score:0, passed:true` → drive throttle + runaway. Class-concentrated (Adv B1 26%
vs 0% in 10 classes → behavioral, not a code auto-submit). TypedTest is immune (`:1723` disables at 0 answered + confirm).

**I2 · #11 throttle runaway (csd races on review-only days).** A throttle review-only day completes and advances csd
unconditionally (`progressService.js:600` `currentStudyDay + 1`); review "always passes" (`MCQTest.jsx:537`). So a
throttled student blows through days (박주하 14→21). NEED_TO_FIX #16; `audit/deepfix/THROTTLE_REVIEWONLY_ADVANCE_FLAW.md`.

**I3 · Re-entry stale-session bug ("loading → Session Complete", no test).** `DailySessionFlow.jsx:779` shows the
completion screen + re-entry modal whenever `session_state.phase==='complete' && reviewTestScore!==null` — keying off
`session_state.phase`, which the code's OWN comment (`:816-827`) says is unreliable/poisoned and must NOT drive routing.
Fires on a fresh day. **Display-only** (verified: modal/Retry/Move-On/mid-test-refresh all write 0 attempts, csd
unchanged), but confusing + traps. **70 live 26SM students** carry the trigger (many un-throttled, high scores).
`handleReEntryRetake` (`:1620`) sets `REVIEW_STUDY` with an unpopulated queue → "No Test Content" / "All cards reviewed".

**I4 · Off-by-one completion loop ("Session Complete" forever, no quiz).** Reconciliation pairs the anchor-day review
by requiring the review's `newWordStartIndex/EndIndex` to EQUAL the anchor's (`db.js:3726`). A review records `null`
there (it introduces no new words), so `null≠480/539` → pairing fails → `csd = anchorDay−1` (`progressService.js:212`),
non-demoting (`:264`) → stuck. Then `determineStartingPhase(csd+1)` sees that day already complete (passed-new + review)
→ returns COMPLETE (`studyService.js:279`) → loading→complete loop, no quiz. (최희윤, csd 8 vs completed day 9.)

**I5 · Throttle is recompute-every-session + too blunt for genuine low-reviewers.** `interventionLevel` is recomputed
from `recentSessions` last-3 reviews EVERY session (`studyService.js:325`), ignoring the stored field — so it cannot be
durably cleared via data (whack-a-mole; 한예진/김재경 re-throttle). Genuine low-reviewers (13–30%) get held on
review-only, which reads as "skipped my new words / jumped a day." **David-locked target design:** BINARY throttle with
an ESCAPE — below a review-avg threshold → review mode (0 new words) that is escapable by good reviews; hysteresis
enter <0.30 / exit >0.50; **hold csd in review mode** (don't advance); skip records 0 with a **clear warning** (not
null); **review REQUIRED to advance** (engagement-gated, F9 = ≥~80% answered, any score advances); Practice-Mode v2
non-canonical. See `docs/plans/FORCED_PATHWAY_FIX_PLAN_2026-07-16.md`.

**I6 · >100% score overflow.** MCQ crash-recovery (`handleRecoveryResume`) restores stale localStorage answers with no
membership check; `validateTestState` (`testRecovery.js`) has ZERO call sites → rows > totalQuestions → server score
`correctCount/totalQuestions` unclamped (`functions/index.js:400`) → 107/130%. Rare (~6 all-time). Gradebook display only.

**I7 · Empty review slices + review-throughput ceiling.** `computeUnmasteredSegmentIds` (`studyAlgorithm.js`) can slice
past a small pool → empty review (`totalQuestions:0` → score 100/`reviewScore:null`, safe but degenerate). Separately,
mastery throughput is capped at ~60/day (`REVIEW_STUDY_CAP=60`; graduate `floor(60·score)`, return 21d) → for lists
> ~1260 words a permanent unmastered backlog + orphaned words (sim-verified).

**I8 · "Can't access at all" after refresh.** Client-side (verified: all affected students' exact state loads on prod
with 0 errors, refresh works). Not a data/app bug → cache/browser. (Included for completeness; no code fix on our side.)

## Verification discipline
The orchestrator RE-VERIFIES each agent claim: read the cited file:line, run a live read-only Firestore check where a
claim is data-dependent, and (where feasible) reproduce in Playwright against prod using sandbox dups. No finding is
"converged" until ≥2 agents agree AND the orchestrator independently confirms it.

---
# PHASE 1 OUTPUT — Converged Investigation Plan (3 Fable agents + orchestrator verification)

**Convergence: strong.** All 3 agents independently corrected the same hypotheses; orchestrator re-verified the
load-bearing claims against code/git (✓ = orchestrator-confirmed).

## Verified corrections to the Phase-0 hypotheses
- **I4 root cause is NOT "reviews record null" ✓.** Reviews carry numeric `newWordStartIndex/EndIndex` from
  `sessionConfig` (`DailySessionFlow.jsx:1256-1257`); only ~2.3% are null (automarker `DailySessionFlow.jsx:1067-1083`
  writes NO range; standalone/refresh reviews with lost `location.state`; legacy). **The real root cause is a
  PREDICATE ASYMMETRY:** `determineStartingPhase` matches the day's review by `studyDay` ONLY (`studyService.js:279`→
  COMPLETE) while reconciliation `getReviewForDay` requires EXACT index match (`db.js:3726`→fails→csd=anchorDay−1).
- **Second regression date ✓: LIST_SCOPED_RECON flipped 2026-07-12** (commit `8b0813d`). I4 likely ONSET post-07-12
  (the flip made the exact-range pairing live, breaking older review writers' contracts). Test onset after 07-12, not 06-22.
- **A DORMANT FIX for I4 already exists ✓: `writeUpgradedReviewMarker`** (`foundation.js:793`, called `index.js:615`),
  stamps server-derived anchor ranges on markers — behind `SERVER_REVIEW_MARKER=false`.
- **I7 empty-slice mechanism REFUTED ✓.** `computeUnmasteredSegmentIds` returns `null` not `[]` (`studyAlgorithm.js:214`).
  The `totalQuestions:0` docs are the designed automarker. Only the ~1260-word throughput CEILING survives; plus a THIRD
  case to check: null-segment throttle day → `setPhase(COMPLETE)` with NO write ("frozen day", `scan-reviewonly-frozen.mjs`).
- **I2 is a symptom of I5's design** (recompute + unconditional csd+1). Fixing I5 (hold csd) dissolves I2 — but must
  preserve list-end advance or NEED_TO_FIX #11 regresses.
- **I3's "70 carriers" is steady-state, not corruption.** session_state cleared only on explicit buttons; the auto-save
  re-stamps TODAY's day on the modal → a day-guard fix must handle re-stamped docs. The real metric = who HITS the modal.

## Multi-writer / dormant-mirror surface (any fix must cover all or the P4 cutover reintroduces the bug)
- **Throttle math in 5 places:** `studyAlgorithm.js:66/106` (LIVE), `foundation.js:307/912/1115` (dormant), `db.js:3033`
  (LIVE, stored-field variant), `foundation.js:1859` (dormant, stored-field), constants `foundation.js:135`.
- **csd advance: 3 LIVE writers** — `progressService.js:600` (completion), `db.js:2998-3045` (challenge-accept, reads
  STORED interv — doc missed this), reconciliation `progressService.js:263`; + dormant mirrors `foundation.js:1178/1859`.
- **Pairing readers: `db.js:3726` (LIVE) + `foundation.js:568` (dormant mirror).** Range writers incl. the null-writers.

## Three DESIGN CONFLICTS to resolve before any code (David-locked I5 vs I2/I3/I4)
1. **Hold-csd vs the write model:** the ONLY appender of `recentSessions` is the completion write that also does csd+1
   (`progressService.js:589-609`), and the day-guard rejects repeat same-day completions (`:564-573`). Hold-csd requires
   DECOUPLING "record review outcome" from "advance day" — a new write shape, mirrored in dormant `completeSession`.
2. **F3 (skip doesn't complete) vs completeness predicates everywhere:** a skipped review still EXISTS as an attempt;
   `determineStartingPhase`, `getReviewForDay`, `dayReviewExists`, and the I3 gate all treat existence as "done". If F3
   refuses completion but readers see the day complete → the I4 loop. The engagement predicate (F9 ≥~80% answered) must
   be computed SERVER-SIDE from the stored attempt and applied UNIFORMLY to all completeness readers, carve-out for `tq:0`.
3. **Binary throttle vs stored-field readers + M4 shadow:** `db.js:3033`/`foundation.js:1859` allocate from STORED interv;
   the M4 shadow (`foundation.js:912`) recomputes linear. Binary must move to ONE function; resolve the stored-vs-recomputed
   split-brain; hysteresis needs one state owner.

## Consolidation
- **I1 + I2 + I5 = one incident (the runaway)** → ship as the FORCED_PATHWAY F1/F2/F3 package; none subsumes the others.
- **I3 and I4 = distinct defects, identical symptom** (":779 session_state gate" vs ":599 attempts-COMPLETE gate") →
  per-student triage classifier required.
- **I6, I7, I8 independent.** I7 decoupled from Phase 1 (CS-16c proved reviewScore:0 are real skips, not empty tests).

## Phase-2 investigation targets (what to actually execute + confirm with live data)
1. **Cohort classifier** — one read-only pass over 26SM (`class_progress`+`session_states`+`attempts`+`system_logs`)
   bucketing each affected student into I1-throttle / I2-runaway / I3-stale-display / I4-stuck-pairing. Validates the decomposition.
2. **I1 confounds** — finish the empty-attempt census to 07-17 EXCLUDING sandbox; reconcile the class-concentration
   (orchestrator's 26%-vs-0% vs agent-B's 10+-classes); attribute empty-with-nonzero-score + any pre-06-22 empties by `writtenBy`.
3. **I4 failure-mode** — dump 최희윤's day-9 review doc + anchor, run the pairing predicate offline; classify (marker/null/mismatch/temporal); cohort count of storedCSD==anchorDay−1 with a failing-pair review.
4. **I3 hit-count** — census stale (`currentStudyDay < csd+1`) vs re-stamped (`== csd+1`) trigger carriers.
5. **I6** — inspect the 4 `score>100` docs (stale-merge vs duplicate-wordId).
6. **I7** — `totalQuestions:0` writer census; null-segment frozen-day victims; re-run the ceiling sim + live pool sizes.
7. **I8** — `curl -sI` prod `index.html` Cache-Control; cross-ref I8 tickets against the I3 trigger census.
8. **Design-conflict data** — simulate binary+hysteresis against the 144 relief-cohort's real `recentSessions`; measure escape half-life + answer-rate distribution for F9.

---
# PHASE 2 OUTPUT — Converged Investigation (3 Fable agents D/E/F + orchestrator verification)

**Convergence: E and F align closely; D used a stricter early cut. Orchestrator re-verified the keystones
(최희윤 doc ✓, pairing rate ✓, Eb9u0aU0 iatrogenic ✓).**

## Cohort classifier (converged, priority I4>I2>I1>I3), reconciled across the 07-17 relief effect
- **I4-stuck-pairing: ~24–25 students** (D 12 / E 25 / F 24 → converge ~24). ~22 mid-list (live loop now), ~16 with
  degenerate `[twi,twi-1]` ranges (relief-minted), ~8 null-range, incl. 최희윤's family. **STUCK TODAY.**
- **I2-runaway: ~84 historically, ~1–6 now.** The 07-17 relief reconciled the csd inflation; the CODE bug remains.
- **I1-throttle: ~17 throttled now, 660 empty submits / ~132–208 empty-submitters historically.** Re-throttle wave coming
  (relief cohort's windows rebuild in ~3 reviews).
- **I3-carrier: ~70** (66 stale + 4 re-stamped). Display-only CONFIRMED (modal handlers write nothing).
- **healthy: ~530–690** (incl. 264 benign `csd==anchorDay−1, no review yet` — normal mid-day, NOT I4).

## The keystone verified discoveries
- **최희윤 (verified):** day-9 review is a **typed, null-range** (`nwsi/nwei=null`), score-3 REAL test (not automarker)
  done 22h after the day-9 new-word test. Predicate: studyDay✓ temporal✓ **exact-index✗ (null≠480)** → csd=anchorDay−1=8.
- **The pairing predicate is broken for ~34.5% of ALL reviews** (F cohort census 3,465/10,035; orchestrator spot-check
  42.8% pairable in the worst classes). Dominant cause: a review completed in a LATER session than its new-word test
  carries the NEXT allocation range (`anchor.nwei+1`), the inverted `[twi,twi-1]` on throttle days, or null when state is
  lost. Only SAME-session reviews pair. Non-demoting `Math.max(storedCSD,csd)` is the only thing hiding ~3,400 latents.
- **⚠ IATROGENIC (verified): my 07-17 relief MINTED new I4 victims.** Reconciling csd down + un-throttling after
  review-only days (whose reviews carry `[twi,twi-1]`) leaves them at anchorDay−1 once a new-word anchor lands, with
  `session_state=new-words-study` (no modal self-heal). `Eb9u0aU0` confirmed stuck; ~16 of the 24 are this family; ~9
  anchors are from TODAY. **CS remediation needed before/independent of the code fix.**
- **The dormant `writeUpgradedReviewMarker` fixes 0/26 live I4 cases** (they're not automarkers) — hygiene only.
- **I4 fix quantification (F, over 26 stuck):** reader-only studyDay-parity → 26/26 (but risks cross-pace false-complete,
  3/130 observed); reader relax-range+temporal → 10/26; writer-only → 0/26 now but stops ~10/day null-range mints;
  writer+backfill → ~10/26. **Only a reader-side pairing-consistency fix drains all 26 organically; both reader+writer
  needed for durability; backfill of ~3,400 legacy optional.**

## I5 binary-throttle simulation (E, 146 relief docs, real recentSessions + 1,791 reviews)
- Binary+hysteresis (enter<0.30/exit>0.50) **immediately frees ~64%** of the relief cohort (58/146 were throttled only
  by the linear avg<0.75 rule). 36% (53) enter review mode.
- **Escape half-life: median ~8 reviews** (F9-gated ~7); but **the 0.50 exit bar is hard** for this cohort (49.7% of
  fully-engaged reviews score <30%, only 44% >50%) — genuine low-reviewers will dwell. History is endogenous → pessimistic bound.
- **F9 answer-rate is bimodal**: 70.7% of reviews ≥80% answered, 19% 0-answered → the ≥80% gate cuts cleanly.
- Throttle windows: 24 empty-driven, 49 genuine-low, 73 mixed → the throttle mostly catches real low performance.

## Confirmed design conflicts + multi-writer (for Phase 3)
- **Conflict #1 (hold-csd) CONFIRMED:** `updateClassProgress` (progressService.js:589-609) is the SOLE recentSessions
  appender + does csd+1 in the same write; day-guard (:564-573) admits only `day==csd+1`. Hold-csd needs a NEW write
  shape decoupling "record review" from "advance day", mirrored in dormant `foundation.js completeSession`.
- **Conflict #3 (binary vs stored readers) CONFIRMED:** live stored-field reader `db.js:3033` (challenge-accept advance,
  live since SERVER_CHALLENGE_WRITE=false — a 3rd live csd writer, 42 day-1 crossings could fire it); dormant `foundation.js:1859`;
  M4 shadow `foundation.js:912`. Hysteresis is path-dependent → needs a persisted mode bit with ONE owner.
- **I8 corrected: prod is NETLIFY** (index.html `cache-control: must-revalidate` + ETag) → NOT server-config-fixable; client-side.
- **I7:** 55 tq:0 automarker docs (not empty-slice); frozen-day 0 live victims (theoretical); ceiling CONFIRMED (1600-word
  lists carry 1,260–1,380 permanent unmastered backlog).
- **I6:** exactly 4 score>100 docs, stale-merge (0 dup wordIds, 18–24h gaps); `validateTestState` 0 call sites; server divide unclamped.

---
# PHASE 3 OUTPUT — Converged Implementation Plan + Report (3 Fable agents A/B/C + orchestrator verification)

**Convergence: A (synthesis) / B (reversibility-sequenced) / C (adversarial) agree on all root causes, the 3 conflict
resolutions, and CS-first sequencing. Divergences resolved by the orchestrator (I3 mechanism; I4 predicate shape).**

## Orchestrator verification stamp — every load-bearing site independently re-read (never trust agents)
- I3 two trigger sites: `sessionService.js:340-347` (`shouldShowReEntryModal`, no day-guard) + `Dashboard.jsx:812`; inline `DailySessionFlow.jsx:779-793`. File doctrine `:816-828` already declares ATTEMPTS the sole routing authority. ✓
- I4 asymmetry: `determineStartingPhase` completes on a bare `sessionType==='review'` find (`studyService.js:240`→COMPLETE `:279`) vs `getReviewForDay` temporal (`db.js:3713`) + exact-range (`:3726-3727`). ✓
- Iatrogenic leg: `throttle-relief-cohort.mjs:56` pulls `csd→anchorDay` when ahead → `Eb9u0aU0` (csd16/anchor17) signature. ✓
- 3rd LIVE csd writer: challenge-accept `db.js:3030-3045` reads STORED interv `:3033`, advances `:3040-3045` (live, SERVER_CHALLENGE_WRITE=false). ✓
- Conflict #1: sole `recentSessions` appender `progressService.js:589-590` welded to csd+1 `:600`; day-guard `:564-573`; cycling reset `:585,602`. ✓
- Whack-a-mole: `studyService.js:325` recomputes every init, ignores stored field. ✓
- I6: `functions/index.js:401` unclamped divide, `:403` review always passes. ✓

## The 3 design conflicts — RESOLVED (identical resolution across A/B/C)
1. **Hold-csd vs the welded appender** → NEW `recordReviewOutcome(...)` in `progressService.js`: appends the review summary +
   stats + streak + mode-bit, but NEVER writes `currentStudyDay`/`totalWordsIntroduced`. Day-guard preserved; idempotency via
   a `reviewAttemptId` on the summary. Mirrored in dormant `foundation.js completeSession` (new `status:'review_recorded'`).
2. **Engagement-refuses-completion vs "existence == done" readers** → ONE `isEngagedReview(attempt)` predicate (≥80% answered,
   carve-out `totalQuestions===0`/`autoCompleted`), computed from the STORED attempt's `answers[]`/`totalQuestions`, applied
   UNIFORMLY to determineStartingPhase, getReviewForDay, dayReviewExists, countPostAnchorReviewDays — and to the completion
   writer — in the SAME release, and ONLY after WI-2 pairing is live (else F3 mints fresh I4 loops).
3. **Binary vs stored-field readers + M4 shadow** → ONE `deriveThrottleMode(recentSessions, priorMode)` (binary, hysteresis
   enter<0.30/exit>0.50); persisted `class_progress.reviewMode` bit with ONE owner (the completion writers); `interventionLevel`
   KEPT as a derived {0,1} field so every stored-field reader (`db.js:3033`, `foundation.js:1859`) stays coherent unchanged.

## Work items (converged; every client change flag-gated, flag-off = byte-equivalent per Run-L)

### WI-5 · CS remediation (DATA, today, before any code) — new script `scripts/cs/unstick-i4-victims.mjs`
Select 26SM where `storedCSD === anchorDay−1` AND anchor day has a real same-class engaged review (the WI-2 predicate, run
offline). Write ONLY `currentStudyDay := anchorDay` (non-demoting, +1) + clear `session_states/{cls}_{list}`. **Never touch
`recentSessions`/`interventionLevel`/`twi`** (those legs are what minted victims). ~24 expected incl. ~16 relief-minted
`[twi,twi−1]` + ~8 null-range + 최희윤; `Eb9u0aU0` must appear. Exclude ~264 benign `csd==anchorDay−1, no review yet`. Sweep
before/after; backups; `CS-2026-07-17` runbook entry. **Retire `throttle-relief-cohort.mjs`'s csd-down + un-throttle legs
(mark DO-NOT-RUN).** Stable under both current and fixed predicate.

### WI-1 · Runaway package (I1+I2+I5), flag `FORCED_PATHWAY` — the 80/20
- **F1 binary throttle:** `deriveThrottleMode` + `reviewMode` bit + derived `interventionLevel∈{0,1}`. Live recompute
  `studyService.js:325` reads the stored bit under flag (kills whack-a-mole; CS can durably clear by setting `reviewMode:false`).
  Hold-guard the 3rd live writer `db.js:3030` + dormant `foundation.js:1859`. Mirror all 5 throttle sites + M4 shadow `:912`
  (else soak logs false `introduced_over_allocation`) + cycling lap-reset must clear the bit `progressService.js:602`.
- **F1 hold-csd:** `recordReviewOutcome` (conflict #1). Route in `completeSessionFromTest` on the reason split (`:1713-1721`):
  skip (any day) → record 0, phase REVIEW_STUDY, NO advance (kills I2); engaged throttle-review-only → record + graduation +
  phase COMPLETE, NO advance (David-locked hold); engaged normal/list-end/#9-resume → advance as today (NEED_TO_FIX #11 preserved).
- **F2 skip warning (I1):** ConfirmModal on under-answered/empty review submit (David copy: "recorded as 0%, won't complete
  your day, low averages switch you to review-only"). NOT a server reject (skips are real signal, CS-16c). TypedTest already 0-disabled.
- **F3 engagement gate (I5/I2 kill-shot):** `isEngagedReview` into all completeness readers + the writer (conflict #2). Server
  stamps `answeredCount`/`engagedReview` additively (`functions/index.js` attemptData); `passed` semantics unchanged (all legacy
  reviews are `passed:true`, so readers use the predicate for old+new docs alike).

### WI-2 · I4 pairing predicate, flag `REVIEW_PAIRING_V2`
- **Reader-side (the drain):** ONE `reviewPairsWithAnchor(review, anchor)` = temporal (`submittedAt>=anchor`) + engaged +
  (exact-range OR same-`classId`). Replaces exact-`if` at `db.js:3726-3727`; mirrored at `foundation.js:567-573`; and
  `determineStartingPhase` (`studyService.js:240/279`) adopts the SAME predicate → the two readers finally AGREE. Effect: stuck
  student's day resolves REVIEW_STUDY (not COMPLETE) → retake → Fix-A stamps anchor range → pairs → csd advances. Drains all ~24
  organically + the ~3,400 latents on read. Raise the recent-attempts window 8→12 (`db.js:3366`) so multi-review days keep the new-pass.
  **Cross-pace safety:** a different-CLASS same-studyDay review fails BOTH legs (range differs AND class differs) — F's 3/130
  false-completes stay blocked. **OPEN (decided by census, not guessed):** whether the simple same-class leg (A) drains the
  ~16 pre-anchor relief stubs whose reviews are temporally BEFORE the anchor (excluded by the `:3713` filter), or whether C's
  explicit `[anchor.nwsi, anchor.nwsi−1]` pre-anchor tier (dropping temporal for that leg only) is needed. **Gate before flip:
  offline census must hit ≥24/26 drained AND 0/3 known false-pairs.** WI-5 covers everyone today regardless.
- **Writer-side (durability, ~10/day mints):** stamp the day's new-pass range onto standalone/refresh reviews (`MCQTest.jsx:663`,
  the studyDay-fallback already fetches it `:565`); return `null` range (not `[twi,twi−1]`) on pure review-only days
  (`studyService.js:461-475`). **No backfill of the 3,400 legacy — reader makes them pairable in place.**

### WI-3 · I3 re-entry, flag `REENTRY_GUARD` — RESOLVED to attempts-authority (not A's calendar heuristic)
The `:779` inline gate + `shouldShowReEntryModal` (`sessionService.js:343`, used by `Dashboard.jsx:812`) are the one spot still
routing on `session_state.phase`, violating the file's own `:816-828` doctrine. **Fix: fire the modal only when session_state's
completed day matches the last genuinely-completed day** — add conjunct `existingState.currentStudyDay === (csd)` i.e.
`=== config.dayNumber − 1` to BOTH sites (pass csd/startPhase into `shouldShowReEntryModal`). Stale carriers (`< csd`) and
re-stamped carriers (`=== csd+1`) both fail it → fall through to the attempts-authority path (`:816-828`), no modal, self-heals.
Rejected A's `sameCalendarDay` leg — fragile under WI-1 hold-csd (a held review-mode day legitimately keeps the same day for many
calendar days). Also **fix `handleReEntryRetake` (`:1620-1623`)**: populate the queue via `buildReviewStudySet` (currently empty →
"No Test Content") and stamp the retake to the COMPLETED day's anchor range so it can't pre-satisfy the next day under WI-2.

### WI-4 · I6 overflow, flag `RECOVERY_GUARD` (client) + unconditional server clamp
Client: `handleRecoveryResume` (`MCQTest.jsx:399`, `TypedTest.jsx:533`) INTERSECT saved answers with current `testWords` ids
(NOT `validateTestState` all-or-nothing reject — that would kill legit recoveries since word samples regenerate). Server
(`functions/index.js:398-402`, unflagged — a clamp only removes an impossible output): dedupe rows by wordId +
`correctCount = Math.min(correctCount, totalQuestions)` + `score = Math.min(100, …)`. 4 historical >100 docs: cosmetic, leave/note.

## Sequenced rollout (converged: CS today; pairing BEFORE the big package)
| Step | What | Flag | Target | Why here |
|---|---|---|---|---|
| 0 (today) | WI-5 unstick script (dry→commit) | — data | admin from /app | ~24 stuck NOW, code-independent |
| 1 | PR-1: WI-2 pairing + WI-3 re-entry + WI-4 client + F2 warning | REVIEW_PAIRING_V2, REENTRY_GUARD, RECOVERY_GUARD | Netlify (dark→flip after sandbox E2E) | reversible; pairing must be live before WI-1 frees the cohort into new-word days |
| 2 | PR-2: functions — engagement/answeredCount stamp, I6 clamp, all foundation dormant mirrors | server flags stay false | firebase deploy --only functions | additive+clamp; live before FORCED_PATHWAY soak |
| 3 | PR-3: WI-1 (binary throttle + hold-csd + engagement readers + F2 escalation) | FORCED_PATHWAY | Netlify (dark→flip quiet window) | the 80/20; composes with WI-2 already live |
| 4 | Post-soak ≥7d: pairing-rate census, throttle monitors, P4-cutover parity re-diff | — | — | verify before any server flag flips |
Rollback per step = flip flag false + rebuild / redeploy prior functions. No data migration in WI-1–4. NEVER bare-deploy the staged P10d firestore.rules.

## Issue → Fix report (the deliverable)
| # | Ticket(s) it caused | Root cause (verified) | Fix | Ship |
|---|---|---|---|---|
| I1 | 0-response auto/skip submits, throttle inflow | MCQ submit enabled at 0 answered; dead guard `MCQTest.jsx:497`; server permissive | F2 confirm modal (warn, don't block); F3 makes skips not advance | PR-1 warn / PR-3 teeth |
| I2 | 이아연 "Day8→9→10→12" runaway | skipped review-only day advances csd (`progressService.js:600` welded to append) | F3 review-required + hold-csd `recordReviewOutcome` | PR-3 |
| I3 | 최희윤/한예진/조준형 "리뷰만 뜨고 새로고침 후 안 들어가짐" | stale `session_state.phase===COMPLETE` modal gate, 2 sites, no day-guard | attempts-authority conjunct + populate retake queue | PR-1 |
| I4 | 김재경 "day5인데 day6", stuck loading→complete loop, ~24 stuck | predicate asymmetry: day-only COMPLETE vs exact-range pairing; 34.5% reviews unpairable | `reviewPairsWithAnchor` (reader) + range stamping (writer); WI-5 unsticks today | WI-5 + PR-1 |
| I5 | throttle whack-a-mole, "removed throttle but it's back" | `interventionLevel` recomputed every init (`studyService.js:325`), stored field ignored; linear <0.75 | binary `deriveThrottleMode` + persisted `reviewMode` bit, one owner | PR-3 |
| I6 | >100% gradebook scores (4 docs) | recovery restores stale answers unfiltered; server divide unclamped | client intersect + server dedupe/clamp | PR-1 + PR-2 |
| I7 | pace ceiling / permanent backlog (product) | 1600-word lists carry 1,260–1,380 unmastered; tq:0 automarkers by design | OUT OF SCOPE — product decision (throughput ceiling) | deferred |
| I8 | "보카부스트 아예 안 들어가짐" (subset) | prod is NETLIFY, index.html must-revalidate+ETag → client cache/browser | NOT server-config-fixable; client-side hardening only | deferred |

## Open decisions for David (genuine product/authorization calls, not engineering unknowns)
1. **Un-stick the ~24 now?** WI-5 is ready (dry-run→commit, backups). ~16 were minted by my 07-17 relief; stuck TODAY, no self-heal.
2. **Skip-stub credit:** for relief-minted victims whose anchor-day "review" is a 0-answer skip — credit the day anyway
   (recommended: the semantics in force when it was done said reviews always pass) or leave for a real retake?
3. **Engagement backfill policy:** when F3 readers go live, ~10,035 historical `passed:true` skip-reviews un-pair → old skipped
   days may be re-offered (csd protected by non-demoting max). Re-offer (pedagogically good) or grandfather pre-deploy docs (no disruption)?

## David's decisions (LOCKED 2026-07-17)
1. **WI-5 unstick → HOLD, fix in code first.** No 26SM data writes today; the ~24 drain organically via PR-1's pairing fix.
   ⇒ PR-1 is now the SOLE remediation path → must prove drain (census gate) before building; TAs hand-make tests in the interim.
2. **Skip-only anchor days → route to a real retake** (not auto-credit). Consistent with F3: skip → REVIEW_STUDY, no completion.
3. **Engagement backfill → grandfather pre-deploy docs.** `isEngagedReview()` returns true for reviews with `submittedAt <`
   the F3 deploy timestamp (new constant); only post-deploy skips are gated. Zero disruption to existing students.

## Census result (read-only, `scripts/cs/census-i4-pairing.mjs`, EXECUTED 2026-07-17) — predicate LOCKED
Faithful mirror of `getMostRecentPassedNewTest` (`db.js:3507`) + `getReviewForDay` (`db.js:3705`). Over 26SM (359 started):
- **14 truly-stuck I4 victims** (strict signature: `storedCSD===anchorDay−1` + real anchor-day review + current predicate
  fails) — NOT the ~24 agents estimated (agents over-counted; matches Agent D's stricter 12). ~9 are relief-minted
  `[twi,twi−1]` stubs; `Eb9u0aU0` confirmed present. 91 benign `csd==anchorDay−1, no-review` correctly excluded.
- **Drain by predicate:** Agent A's simple same-class leg = **3/14** (temporal filter excludes the 9 PRE-anchor `[twi,twi−1]`
  stubs). Agent C's tiered + exact-range temporal-drop refinement = **13/14, 0 cross-class false-pairs.** The 1 residual
  (SfEVUpvi) is a **skip-only** anchor day → correctly routes to a retake (David decision #2, by design).
- **⇒ LOCKED reader predicate `reviewPairsWithAnchor(review, anchor)`** (require studyDay match; `isEngagedReview` = ≥80%
  answered w/ tq:0 carve-out):
  1. exact-range AND (temporal `submittedAt>=anchor` OR same-class) → pair. *(exact range = definitive positional proof;
     same-class covers a retake-refreshed anchor where the review is temporally pre-anchor.)*
  2. else require same-class AND engaged: temporal(post-anchor) → pair *(next-allocation range drift)*.
  3. else same-class AND engaged AND pre-anchor: `[anchor.nwsi, anchor.nwsi−1]` inverted stub OR null-range → pair.
  A **skip** (non-engaged) never pairs on the relaxed legs → routes to a real retake (decision #2). Cross-CLASS reviews fail
  every leg (range differs AND class differs) → NEED_TO_FIX #9 cross-pace protection preserved; census confirms 0 false-pairs.
- **Ship gate re-baselined:** the agents' "≥24/26" was off the over-estimate; real gate = **13/14 organic drain + 1 by-design
  retake + 0 false-pairs = PASS.** Mirror this predicate in `db.js:3726`, `foundation.js:568`, and `determineStartingPhase`
  (`studyService.js:240`) — all three readers adopt it so they finally agree.
