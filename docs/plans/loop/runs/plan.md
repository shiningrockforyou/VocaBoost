# PLAN — Run S: flag-ON behavioral validation suite (implementation-ready) — v5 (loop draft)

**Slug:** runs · **Status:** DRAFT for the Claude⇄Codex review loop · **Author:** Claude
**Supersedes** the design stub `audit/playwright/RUNS_DESIGN_SPEC.md` AND the stale `lsr_runS.mjs` (§8).
**Prerequisite MET:** owner shipped `LIST_SCOPED_RECON=true` (2026-07-11); all 17 attempts indexes live+READY.
**v2 folds round-1 review (Codex r-runs-001 + 3-agent audit).** The unanimous blocker: v1's Day-1 flagship
oracle was wrong (Day 1 has no review phase; `csd=1` hardcoded). v2 pivots to Day≥2 and — the deeper fix —
adds the coverage v1 lacked (competing-anchor selection, Day≥2 CSD branch) so the suite can actually FAIL a
broken reconciliation.

## 0. What Run S proves (vs Run L)
Run L proved *"the dormant code changed nothing while OFF."* Run S proves *"the NEW list-scoped behavior is
correct and survives realistic CS messiness."* **Each overlay must be able to go RED against a subtly-broken
flag-ON build** — negative properties (tautologies) don't count (§3 flags each).

## 1. Flag-ON semantics the oracles derive from (PLAN_list_progress_persist.md §5.1) — CORRECTED
- **Anchor** = passed-`new` attempts (student+list scoped, classId DROPPED) ordered `newWordEndIndex DESC,
  submittedAt DESC` (doc-ID final tie-break). Legacy attempts missing `newWordEndIndex` → position query empty
  → fall back to `studyDay`-ordered + log `csd_anchor_invalid` (`db.js:3250-3323`, `progressService.js:289-297`).
- **twi** = `anchor.newWordEndIndex + 1` (`progressService.js:150`); `safeTWI = hasValidData ? twi :
  Math.max(storedTWI, twi)`.
- **CSD [CORRECTED — the v1 root error]:**
  - **`anchorDay === 1` → `csd = 1` UNCONDITIONALLY** (no review lookup; Day 1 has no review phase).
    (`progressService.js:155-158`.)
  - **`anchorDay ≥ 2` → `csd = reviewForAnchorDay ? anchorDay : anchorDay − 1`** (`:159-178`).
  - `safeCSD = LIST_SCOPED_RECON ? (reviewLookupFailed ? storedCSD : Math.max(storedCSD, csd)) : …`
    (`:228-231`) — **non-demoting**; a query-error leaves stored CSD untouched.
- **Session-day mapping:** `initializeDailySession` sets `currentStudyDay = storedCSD + 1` (`studyService.js:185`),
  then `determineStartingPhase(attempts, currentStudyDay)`: `REVIEW_STUDY` only when `dayNumber > 1 &&
  newTest.passed && !reviewTest` (`:94-102`); `dayNumber===1 && newTest.passed` → `COMPLETE` +
  `impossible_phase_detected` log (`:105-119`); else `NEW_WORDS_STUDY` (`:133-137`).
- **Review pairing** = anchor's own classId + `review.submittedAt >= anchor.submittedAt`; discriminated
  `found|none|query-error` (`db.js:3410-3414`, `progressService.js:163-176`).
- **Completion-gate** (`getNewWordAttemptForDay`, `studyService.js:1318` — **Day-2+ branch only**) accepts a
  same-day passed `new` attempt list-wide only if `newWordStartIndex == expectedBase && passed` (`db.js:3055-3072`).
- **Orphan cleanup** = LOG-ONLY.

## 2. Harness (mirror the certified Run L 4-phase bound pipeline)
`lsr_runS_fixture.mjs` → `lsr_runS_verify.mjs --pre` → `lsr_runS.mjs` (Admin-free UI driver) →
`lsr_runS_verify.mjs --post`, bound by `runId` + fixtureDigest, anomaly-failing, INVALID-not-PASS on any
precondition miss. Same rigor as `lsr_runL*.mjs` + the F02/F03 acceptance harness. **`--pre` MUST include a
winning-anchor counterfactual** (like `lsr_runL_verify.mjs:103-124` L2: compute `winner =
anchors.sort(nwei desc)[0]`, require studyDay≥2) so a wrong-anchor impl is catchable. All UI steps obey the
strict no-injection policy (`PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md §1`). **Pace differentiation:
class A pace `pA`, class B pace `pB` (pA≠pB) so "carry position, apply the launching class's policy" is
provable; ≥1 overlay drives MCQ (`lsr_ui.mjs:522 driveMcq`), the rest typed.**

## 3. Overlays — each with its EXACT oracle + explicit FAIL-teeth
Persona: dual-enrolled classes **A**/**B** on the same list **L** (size ≥ several·pace). `p` = the relevant
class's pace. Day-`D` new words occupy virtual positions `(D−1)p .. Dp−1` (`newWordEndIndex = Dp−1`).

### S-1 — Partial-day switch, **Day ≥ 2** **[FLAGSHIP]** (이주헌 / 박주하 / 손진욱)
- **Setup:** persona completes a clean **Day 1** on L in A **through the normal Day-1 new-word completion path
  ONLY** (Day 1 has NO review phase — `DailySessionFlow.jsx:10`; passing the Day-1 new test completes the day).
  Do NOT script a Day-1 "review pass" (impossible). [RS2-1]
- **Steps (UI, visible controls only):** in A, study **Day 2**: pass the Day-2 new-word test (`nwsi = pA`,
  `nwei = 2·pA − 1`) → land on the **Review-Study** screen → **leave via the visible Quit control**
  (`lsr_ui.mjs:202 leaveSessionViaQuit` → "Quit session" `DailySessionFlow.jsx:1633`; assert Review-Study
  present AND completion card absent BEFORE quitting) → `switchClass` to B (same L) → enter session →
  **COMPLETE the Day-2 review in B and submit** [RS2-3 — the bug fires at review COMPLETION, not at the screen].
  Screenshots: pre-quit (review-study), dashboard, post-switch, re-enter, post-review-submit.
- **Exact oracle (flag-ON, CORRECT behavior):** anchor = A Day-2 passed-new (`nwei = 2·pA−1`); **`twi = 2·pA`**;
  anchorDay 2, review for day 2 in A = none → **`anchorDerivedCSD = 1`**, `safeCSD = max(storedCSD_B, 1)`; on
  entering B, `currentStudyDay = csd+1 = 2` → **phase `REVIEW_STUDY` for Day 2**.
  - **BEFORE B review completion:** `B_L` reconciled to **`csd=1, twi=2·pA`**.
  - **AFTER B review completion:** **`csd=2` AND `twi` STAYS `2·pA`** (NOT `3·pA`) — no new-word retake AND no
    TWI double-advance [Codex RS3-1]. B produced **0 `new` attempts and exactly 1 `review` completion**;
    zero-new-attempts is necessary but **NOT sufficient** — the TWI-invariance check is the real teeth.
  - **THEN re-enter class A (visible UI) and assert CONVERGENCE [Codex RS4-1]:** `A_L` and `B_L` **both**
    resolve to **`csd=2, twi=2·pA`**; A does NOT show Day-2 review pending / force a re-review or retake; no
    additional `new` attempts, no duplicate `review`. (Tests the "one live student/list position across
    simultaneous classes" goal — the review is paired to the anchor's class A (`db.js:3407-3416`) while phase
    detection is list-scoped (`db.js:3119-3128`), so A-after-B is a distinct state a B-only oracle misses.)
- **⚠ EXPECTED-RED against current code [NEED_TO_FIX #9 — THREE coupled bugs]:** (1) the gate uses
  `expectedBase = post-pass TWI (2·pA)` ≠ A's attempt base (`pA`) → spurious retake; (2) even if (1) is fixed,
  `recordSessionCompletion` re-adds B's `sessionConfig.newWordCount` (`progressService.js:462`) → `twi 2·pA →
  3·pA` (day skip); (3) the review is paired to the anchor's class A, so B's review isn't seen by A → the
  classes diverge (A stays review-pending). So **S-1 FAILS until ALL THREE are fixed — Run S is the regression
  test.** Assert the CORRECT behavior, not the current bug.
- **Doc-layer oracle [⊳verify-vs-code]:** the executable post-verifier binds the exact **`class_progress/{A}_{L}`
  AND `class_progress/{B}_{L}`** docs (csd, twi) + attempt counts + the completion-gate outcome (found A's pass?
  forced retake?) — NOT just `B_L` [Codex GO-note 1]. The **A-after-B re-entry convergence is a GATING
  assertion**, bound at the doc layer, not supporting evidence — a screenshot alone is insufficient [GO-note 2].
  If `session_states.phase` is render-computed not persisted, use class_progress + gate outcome as the oracle;
  screenshots are supporting UI evidence only.
- **Gate:** S-1 is the gating case — a green Run S requires S-1 green (which requires the #9 fix). If Run S runs
  before #9 ships, the overall output is `EXPECTED-RED (known defect #9)`, NOT FINAL PASS [GO-note 3].

### S-2 — Failed-then-passed, cross-class, **Day ≥ 2**
- **Steps:** in A on Day D≥2, new **fail** → retry **pass** (`nwei = Dp_A−1`) → enter via B.
- **Exact oracle:** anchor = the **passed** attempt (failed present but **inert via the anchor query's
  `passed==true` filter `db.js:3272`** — NOT the completion-gate, which is Day-2+ review-branch only);
  `twi = D·pA`; single exact **`csd = D−1`** if review pending (pin the sub-case in the fixture — one value,
  fail-closed). B reflects the reconciled position.

### S-3 — Blank/low retake, **cross-class** (exercises the cross-class completion-gate)
- **Steps:** in A on Day D≥2, submit blank/low → valid **pass** in A (same day, `nwsi = expectedBase`) →
  **enter B** and complete the day's review there.
- **Exact oracle (CORRECT behavior):** B's Day-D completion **accepts A's position-consistent pass via the
  list-scoped completion-gate** (`getNewWordAttemptForDay` listScope, `db.js:3055-3072`); `twi` from the pass;
  blank inert; **no forced new-word retake**. (Cross-class is what gives this teeth beyond L1-R.)
- **⚠ Shares the NEED_TO_FIX #9 dependency** (both coupled bugs: gate `expectedBase` mismatch + TWI
  double-advance) → **expected-RED until BOTH fix.** After B review completion assert **`twi` stays the anchor
  TWI (no `+pace` double-advance)** as well as no-retake. S-3 co-owns cross-class review completion; **gating**
  alongside S-1 [RS2-3 / RS3-1].

### S-4 — Rapid A↔B view-only switching **[oracle re-toothed]**
- **Baseline:** run AFTER S-1 so `B_L` is already reconciled (the FIRST entry legitimately WRITES the
  reconciled csd/twi via `progressService.js:243-266` — snapshot AFTER that).
- **Exact oracle:** **(positive, exact)** entering B DISPLAYS the reconciled position `== anchor.nwei+1`
  (the fix — do NOT assert "no advance"); **(negative)** across N post-baseline view cycles: **0 new
  attempts**, and the **specific fields** `currentStudyDay` + `totalWordsIntroduced` (+ attempt counts + phase
  evidence) are unchanged [RS2-4 — compare THESE fields, not whole-doc; `updatedAt`/logs are benign side
  effects and must be excluded from the equality, since a no-op entry writes no `updatedAt` but the comparator
  must not false-RED if it does]. **DROP "no CSD demotion"** — structural (`Math.max` can't demote) = zero
  teeth. Split S-4a (initial entry reconciles the cache) / S-4b (repeat viewing idempotent) if cleaner.

### S-5 — Reload boundaries (class/list/phase RESUME) — **boundaries 1–3 only**
- **Boundaries (Day≥2):** reload (1) during study, (2) on the test page before submit, (3) on the Day-2
  Review-Study screen after the new pass. Each resumes the correct class/list/position/phase via the app's own
  storage restore (`DailySessionFlow.jsx:640-716,788-826`) — the audit never touches storage.
- **DROPPED: boundary 4 "results-rebuild"** — that screen is a day-guard/stale-session concurrency artifact
  (`TypedTest.jsx:1041-1047`), not UI-inducible solo, and S-5 explicitly scopes concurrency OUT → belongs to
  the grading-concurrency audit.
- **Oracle:** per boundary, resumed (class,list,twi,phase) == pre-reload; no duplicate attempt; no CSD/TWI corruption.

### S-6 — Saved-focus variation **[protects F02 × reconciliation]**
- **no-pref arm:** use a **single-class** progression on L (switching classes persists a focus,
  `Dashboard.jsx:1191-1200/384`, so "cross-class progress + empty primaryFocusListId" is NOT UI-buildable).
  Assert F02 falls back to recency-ranked and the shown list's position == reconciled twi.
- **saved-focus arm:** build the persona on a class with **≥2 distinct lists** (dropdown mode → selection
  persists `primaryFocusListId`; a single-list class is label-mode and never persists — Run L disclosure,
  `RUNL_RESULTS.md:38-40`). Assert the persisted `primaryFocusListId` in `--pre` before trusting agreement.
- **Oracle:** F02 resolution and the list-scoped reconciled position AGREE (shown-list position == reconciled twi).

### S-7 — **Competing-anchor SELECTION** [NEW — gives the core §5.1 logic teeth]
- **Setup:** two VALID passed-new anchors on L at **different positions across A and B** (higher position in
  the NON-launching class — e.g. A at Day-2 `nwei=2pA−1`, B at Day-3 `nwei=3pB−1`, with `3pB−1 > 2pA−1`).
- **Exact oracle:** reconciliation (from EITHER class) binds to the **max-`newWordEndIndex` anchor** — its
  class, its position: `twi = max_nwei + 1`, CSD derived from that anchor's day. `--pre` computes the winner
  counterfactually (mirror L2). A wrong-anchor impl (studyDay-ordered, or first-found) goes RED here — v1 had
  NO overlay that could catch this.

### S-8 — **Day≥2 CSD branch + non-demotion** [NEW — exercises the risky new code]
- **8a review-DONE:** anchorDay D with a paired Day-D review pass in the anchor's class → **`csd = D`**.
- **8b review-PENDING:** anchorDay D, no Day-D review → **`csd = D−1`** (= S-1's mechanism, asserted standalone).
- **8c non-demotion:** storedCSD (say D+2 from a slower-pace class's session count) **higher** than
  anchor-derived → **`safeCSD = max(storedCSD, csd) = storedCSD`** (proves the `Math.max` preserves, not demotes).
- These are the `progressService.js:159-178,228-231` paths v1 never reached (all-Day-1 fixtures).

### S-9 — **Reset-resurrection (certify current flag-ON behavior)** [NEW — known consequence, not a bug]
- **Context:** `resetStudentProgress` (student self-serve, `Settings.jsx:90`, students-only) deletes only
  class-scoped attempts (`db.js:2886` `where('classId','==',classId)`). Under flag-ON's list-wide anchor, a
  student's attempts in the OTHER class survive → next entry resurrects CSD/TWI. This is coherent under
  student-owned progress (not corruption); certify it so it's not a silent surprise.
- **Steps:** persona progressed on L in A and B → reset in B via Settings → re-enter B.
- **Exact oracle:** post-reset B re-reconciles to the surviving A anchor (`twi = A_anchor.nwei+1`, csd per
  rule); assert the resurrection is the ACTUAL behavior. (Documented known consequence; full-list reset is the
  epoch work — grading-concurrency Phase 2.)

## 4. Deferred / out of scope
- **Epoch/full-list reset** → grading-concurrency Phase 2 (`resetProgress`). S-9 certifies the *current*
  interim behavior only.
- **OUTSIDE Run L/S** (separate audits): grade-token/nonce; Retry-Save network failure; frozen webview modal;
  teacher grade-override/challenge reversal; grading-idempotency reloads (the S-5 boundary-4 family).

## 5. Sparse/legacy fallback (V7) — READ-ONLY Admin assertion, NEVER UI-driven
The fallback fires only for a passed anchor MISSING `newWordEndIndex`; the current UI always writes it
(`db.js:1230,1394`), so it is **not sandbox-buildable via UI**. Cover it as a **read-only Admin assertion on a
KNOWN sandbox uid only** (never 26SM; a flag-ON *UI* view would WRITE-back and mutate real data). Exact oracle:
post CSD/TWI **== stored** (`Math.max(stored,0)=stored`) AND a **uid-scoped `csd_anchor_invalid` log delta**
(mirror Run L's by-ID `FLAG_ON_LOGS` diff, `lsr_runL_verify.mjs:252-254`). If no sandbox legacy attempt exists,
mark the fallback **UNEXERCISED (code-review-only)** — do NOT imply coverage.

## 6. Acceptance / anti-false-green
- Each overlay PASSES only if the bound post-snapshot shows the expected attempts in the expected class/list
  AND only the intended attempt influenced the exact per-doc CSD/TWI. **Every oracle must have a way to go RED
  against a broken build** — §3 marks the ex-tautologies (S-4 no-demotion dropped, S-3 made cross-class).
- Precondition miss → INVALID (never PASS). Anomaly → nonzero exit. Screenshots per overlay. S-1 gates.

### 6.1 Result contract — expected-RED ≠ certification [Codex RS3-2]
S-1/S-3 encode intended POST-fix behavior, so they FAIL against the current build while `NEED_TO_FIX #9` is
open. The reporting contract must be unambiguous:
- **While #9 is open:** an S-1/S-3 red is an **EXPECTED PRODUCT RED** (verdict `EXPECTED-RED (blocked on #9)`),
  NOT an audit pass. A run containing expected-red cases is **NOT** "deploy-certified / FINAL PASS for flag-ON."
- **After #9 ships:** a green Run S requires the FULL S-1/S-3 oracle — including the **no-TWI-double-advance**
  assertion (`twi` stays the anchor TWI after B review completion) — before flag-ON behavior is certified.
- The verdict emitter distinguishes three states per gating case: `PASS` / `EXPECTED-RED (known defect #N)` /
  `UNEXPECTED-RED (regression)`. Only all-`PASS` on the gating set = FINAL PASS.

## 7. Open questions (for the loop)
1. **S-1 phase persistence [⊳verify]:** is `session_states/B_L.phase='review-study'` persisted on entry, or
   render-computed? Decides whether the flagship's phase oracle is doc-layer or UI-supporting-only.
2. **S-8 fixture depth:** driving a genuine Day≥2 + Day≥3 progression through the UI is multi-session — confirm
   the fixture can reach it in reasonable wall-clock (Run L only went Day 1–2).
3. **Live-cohort isolation:** all overlays drive FRESH per-run sandbox classes (lsr_* personas / 25WT-style),
   NEVER 26SM; the sparse-legacy Admin assertion is read-only + uid-scoped.

## 8. Supersede the stale harness (MUST)
Explicitly retire `audit/playwright/lsr_runS.mjs` (old S1–S10, `>=` day-text tautology oracles, prints
"✅ RUN S UI-PASS" with no bound `--pre/--post`) and its `lsr_personas.json` S1–S10 case IDs, so only the new
bound `lsr_runS*.mjs` can run. A leftover runnable false-green harness is itself a finding (Codex/agent B).
