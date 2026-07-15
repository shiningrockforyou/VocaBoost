# PLAN — Review-only day completion (fix the intervention-recovery deadlock + list-end dead-end) — v3

**Slug:** review-only-completion · **Status:** DESIGN v3 — **Codex r2 GO (design converged)**; folds the r2
3-agent audit's code-level corrections (Lens A found 3 real defects in v2's specifics that the design-level GO
missed; Lens B safe + a W3 forward-note; Lens C = the UX companion is a real sub-project → SPLIT). · **Author:** Claude
**Fixes:** NEED_TO_FIX #11 (full-freeze PERMANENT stuck state, F4) at the CORE; also the un-stick half of the
list-end dead-end (F3). Foundation the per-student cycling capstone (`docs/plans/loop/x/plan.md`) builds on.

> No code until this converges (Codex + 3-agent) AND David gives go-ahead (standing rule).

## 1. Root cause (audit-CONFIRMED)
Intervention is a **recovery throttle** (`studyAlgorithm.js:66-112`): interv from the last 3 review scores;
`newWords = round(pace·(1−interv))`, `reviewCap = round(pace·(1+2·interv))`. At interv=1.0: **0 new / 3× review
— pure catch-up, BY DESIGN.** A recovery LOOP: struggle → throttle → intensive review → recover → resume.
The surrounding machinery already supports review-only days: **CSD is non-demoting** under LIST_SCOPED_RECON
(`progressService.js:233-234`, "day = session count"); TWI stays anchor-authoritative (flat on review-only);
`updateClassProgress` appends the completed session's reviewScore to `recentSessions` (`:455-475`); next day
re-runs `calculateInterventionLevel(recentSessions)`.

**The SOLE defect (Lens A confirmed):** `completeSessionFromTest` Day-2+ gate (`studyService.js:1384-1401`)
blocks completion unless a new-word test was passed. When `newWordCount==0` (throttle OR list-end) there IS no
new-word test → `newWordScore` defaults to 0 (`:1381`) → `0 < threshold` → the gate BLOCKS a legitimately
review-only day. The gate **conflates "FAILED the new-word test" (newWordCount>0 → block, correct) with "no
new-word test was ASSIGNED" (newWordCount==0 → should complete on the review).** (Lens A verified this is the
only blocker: test pages force the review test to pass — `MCQTest.jsx:529`/`TypedTest.jsx:817` — so
`completeSessionFromTest` is always invoked on the review submit, and routing sends a review-only day straight
to REVIEW_STUDY.)

**Why it's a PERMANENT deadlock:** the review score that would lower interv is only written to `recentSessions`
on COMPLETION; the gate blocks completion; so the review is never recorded → interv stays 1.0 → identical next
day. The recovery loop cannot exit the state it creates. (fleet3/L14: 4× 100% reviews on the stuck day, NONE
appended to `recentSessions`, csd frozen.)

## 2. The fix — gate on "were new words ASSIGNED," with an EXPLICIT, FLAG-GATED signal
```js
// Day-2+ branch, before the gate. cfgNewWordCount = sessionConfig.newWordCount (durable under LIST_SCOPED_RECON,
// :1310-1313). Use <= 0 (NOT === 0): newWordCount = min(allocation.newWords, wordsRemaining) can be NEGATIVE on
// over-introduction (teacher shrinks the list, or cross-pace overshoot) — a negative count still means "no new
// words assignable," never "assigned-and-failed," and it must match §5's isListComplete (wordsRemaining <= 0).
const reviewOnlyDay = LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount) && cfgNewWordCount <= 0;
// CLAMP the DURABLE words-introduced count to ≥0 (Codex ROD3-1, BLOCKER). newWordCount can be NEGATIVE on
// over-introduction, and it feeds updateClassProgress's `totalWordsIntroduced += wordsIntroduced` — an unclamped
// −N would DECREMENT TWI, violating the "TWI stays flat on a review-only/list-end day" invariant.
const wordsIntroduced = reviewOnlyDay ? 0
  : (LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount) ? cfgNewWordCount
     : (sessionState?.sessionConfig?.newWordCount || sessionState?.newWords?.length || 0));
if (!reviewOnlyDay && newWordAttemptPassed !== true && newWordScore < threshold) {
  return { requiresNewWordRetake: true };   // real failure with assigned new words → still blocks (correct)
}
// reviewOnlyDay → fall through to recordSessionCompletion with wordsIntroduced=0 → csd+1 (non-demoting), TWI
// FLAT, review → recentSessions.
```
Corrections folded from the r2 audit:
- **`<= 0`, not `=== 0` (Lens A #4, medium):** the boundary must match §5's `isListComplete` (`wordsRemaining <= 0`,
  `studyService.js:314`); `=== 0` would re-block an over-introduced list-end day while the UX shows "finished."
- **Explicit finite, never ABSENT (Lens A #1, high):** raw `wordsIntroduced === 0` fails OPEN — missing/unreadable
  `sessionStorage` coalesces to 0 (`:1311-1313`), which today fails SAFE (gate blocks) but the naive fix would let
  an assigned-and-FAILED day complete. Require `Number.isFinite(cfgNewWordCount)`. (Verified: no path yields a
  finite ≤0 while new words were assigned-and-failed — init only yields ≤0 at throttle/list-end/passed-resume.)
- **Flag-gated (Lens A #3, medium):** the review-only csd+1 survives only via non-demoting CSD, which holds ONLY
  under LIST_SCOPED_RECON (`:233-235`). Gate the short-circuit on the flag (+ Run-L byte-equivalence discipline).

## 3. Review-only SESSION-STATE + ANALYTICS semantics (Codex ROD-2 + Lens A #2/#5 + Lens C)
A review-only completion must NOT persist contradictory/polluting state. **CRITICAL (Lens A #1, HIGH) — this
requires ACTIVE code, not just the §2 gate-skip, and must NOT be derived by comparison:** the not-found branch
hard-sets `newWordScore = 0` (`:1381`), and `null >= threshold` COERCES to `false` (not null), so a naive impl
still ships the pollution + contradiction. On the `reviewOnlyDay` branch, set LITERAL nulls in BOTH sinks:
- **Session summary:** `newWordScore: null` (NOT 0) → excluded from `avgNewWordScore` (`progressService.js:347-359`
  filters null; consumers already null-guard: `ClassDetail.jsx:42`, `SessionSummaryCard.jsx:41`). Fixes teacher
  "New: 0%" pollution + net-new stat drag.
- **`saveSessionState` (`:1405-1410`):** pass LITERAL `newWordsTestScore: null`, `newWordsTestPassed: null` (do
  NOT compute `newWordScore >= threshold`, which yields `false`), + a `reviewOnlyDay: true` marker → no
  "passed:false + phase:COMPLETE" contradiction (Codex ROD-2; the code warns about exactly this at `:1388-1390`).
- **Suppress the spurious warning** (Lens A #6): `getNewWordAttemptForDay` legitimately finds nothing on a
  review-only day; downgrade the `:1377` "Could not find new word attempt" warn when `reviewOnlyDay`.

## 4. Security framing (Lens B — CORRECTED; do NOT gate this fix on a server check)
Lens B's core finding: **the gate was NEVER a security boundary.** `completeSessionFromTest` /
`recordSessionCompletion` / `updateClassProgress` are CLIENT code operating on data the student can already
write directly — `firestore.rules:45-48,106-107` let the owner write `class_progress`/`study_states` and create
`attempts` with `passed:true`; the codebase documents it (`functions/index.js:273-284`: client-writable
evidence "is forgeable"). Forging `newWordCount:0` grants **no new capability** (a student could `setDoc` an
inflated `class_progress` directly).
- **DROP** the v1 "re-derive interv/allocation SERVER-side at completion" ask (Lens B #2): there is NO server in
  this path; re-deriving in `studyService.js` reads the same client-writable `recentSessions`/`wordsRemaining` →
  false integrity for zero threat-model change. The `Number.isFinite && <=0` check (§2) is for **correctness**
  (stale/absent config, Lens A #1) — NOT a security control.
- **Real forgery-hardening** = the separately-planned W3 attempts-lockdown + `class_progress` rules tightening +
  server-authoritative-twi foundation. **This fix is explicitly NOT security-complete on its own, and doesn't
  need to be** (it opens no new boundary). State that limitation; do not block on a check that can't exist here.
- **W3 HARD DEPENDENCY (Lens B #1 → impl r1/r2, escalated; Codex GO'd):** the gate-skip trusts client
  `sessionConfig.newWordCount`/`allocation`/`isListComplete`/`startPhase`. Safe today (the gate was never a
  boundary; a forged review-only day advances only CSD, never TWI — `wordsIntroduced:0`), BUT once W3 locks down
  `class_progress`/`study_states`/`attempts`, forging a review-only day becomes the SOLE remaining way to advance
  CSD without passing the new-word test. **Sequencing rule:** W3's `class_progress` lockdown MUST NOT ship before
  `completeSessionFromTest` re-derives `reviewOnlyDay` from SERVER-side allocation (or stops trusting the client
  fields). Not a code change for this client-side Phase 1 — a tracked cross-work blocker on the W3 program.
- Correct the v1 twi-forgery reasoning (Lens B #3): a forged `newWordCount:0` can't inflate TWI simply because
  `wordsIntroduced:0` doesn't advance TWI (`progressService.js:467`) — NOT because "anchor-authoritative" (the
  anchor derives from forgeable attempts; it's drift-correction, not a forgery defense).
- CSD is **non-demoting**, not "cosmetic" (Lens A #6, Lens B): it drives the visible day number, segment
  slicing (`studyService.js:201-205`), `getNewWordAttemptForDay(dayNumber)`, and the day-guard — a too-high csd
  is harmless next-session, but say "non-demoting," not "cosmetic."

## 5. List-end handling (David: congratulate → cycling)
`newWordCount<=0` has TWO causes; both COMPLETE (un-stuck) but get DISTINCT UX. **Branch on `isListComplete`,
NOT `wordsRemaining` (Lens A #3, medium):** `wordsRemaining` is a LOCAL in `initializeDailySession` (`:234`),
never persisted — `sessionConfig.wordsRemaining` is `undefined` at completion, so `undefined <= 0 === false`
would misclassify EVERY day as throttle. The persisted derivative is `isListComplete = wordsRemaining <= 0`
(`:314`); use it (or recompute `totalListWords - totalWordsIntroduced`).
- **Intervention throttle** (`!isListComplete`, interv drove newWords to 0) → **recovery** state (§6).
- **List-end** (`isListComplete`, review backlog exists) → a distinct **TERMINAL "🎉 You finished the list!"
  screen** (David's "different wording"). Copy must be self-sufficient, NOT teacher-dependent (Lens C #6):
  "You've introduced all N words — keep these sharp with review; new challenges may unlock later." (NOT "your
  teacher sets up what's next" — cycling is automatic, so that promise would contradict the mechanism.)
- **List-end, NO review work** (all MASTERED, empty segment): **CORRECTION (Lens A #2, medium)** — a *fresh*
  no-review list-end day does NOT route to the all-mastered modal (that modal is only in the
  `attemptsSayReviewPending` RESUME branch, `DailySessionFlow.jsx:807-812`). It currently terminates at the bare
  `else → setPhase(COMPLETE)` (`:826`) — nothing recorded, no modal, no csd advance. The terminal finished screen
  must be added to THAT branch (`:826`). Do NOT wire a `recordSessionCompletion` there just to advance a day
  (Codex guardrail) — it stays a terminal no-work state.
- **Persistent terminal (Lens C #5):** after the finished-list day completes, `phase==='complete'` renders the
  generic "come back tomorrow" hero (`Dashboard.jsx:1657`), OVERWRITING the finished message + re-promising work.
  Make `phase==='complete'` on an `isListComplete` day render the persistent finished/terminal message instead.
- **Cycling (`x/plan.md`) LATER** replaces the terminal screen's "new challenges may unlock later" with **Lap 2
  re-introduction**. This fix is the review-only-completion FOUNDATION cycling builds on; ships independently.

## 6. Companion UX (Lens C — IN-SCOPE companions, not follow-ups)
**SCOPE FINDING (Lens C #1, high): the UX companion is a real SUB-PROJECT, not copy tweaks — see §9 split.**
The Dashboard hero's phase comes from `determineStartingPhase` (`studyService.js:137`), which is
**intervention-BLIND** (attempt-based only) and can't tell a review-only day from a new-word day. To render the
right hero BEFORE the student starts, the Dashboard must independently **predict today's allocation** —
`calculateInterventionLevel(recentSessions) → calculateDailyAllocation(pace, interv) → min(newWords,
wordsRemaining)` (mirroring `initializeDailySession:167-235`) — a NEW derivation, plus a single **pinned
`dailyPace`** source (Lens C #2: the hero uses `assignment.pace`; the session uses `ceil(weeklyPace/dpw)` —
divergence lands the wrong hero at the rounding boundary).

Companion surfaces (each ships with the UX sub-project, not the bare gate fix):
- **Review-only / recovery / finished hero:** replace the misleading "DAY N · Learn 20 new words · Start new
  words →" with the correct state + "Start review →" (`Dashboard.jsx:1649-1681`).
- **Recovery messaging — gate on `newWordCount<=0`, NOT `interv>0` (Lens C #3):** words are only *paused* at
  newWordCount<=0; at partial interv they're *reduced*, so "paused" copy would be wrong. Use "new words paused
  to lock in review" only when 0; "fewer new words today" for partial.
- **Oscillation (Lens C #4):** a bad review re-raises interv → hero flip-flops paused↔new-words; frame day-to-day
  variation as intended ("your load adjusts to your review scores") so the second "paused" doesn't read as a bug.
- **Teacher legibility:** `CurrentSessionCell` renders `newWordsTestScore:null` as a red "New: ✗ -" (Lens C #7 —
  a false "behind" signal for a legit recovery/finished student); `StudentProgressCell` shows climbing-day /
  frozen-% with no "why" (tag high-intervention). (`ClassDetail.jsx:56-102`.)
- **Re-entry modal (Lens C #8, bumped from nit):** "Moving to the next day will start fresh **with new words**"
  (`Dashboard.jsx:2174`) is the exact misleading-promise this fix targets — make it phase-aware.
- **Unify the two list-end terminal surfaces (Lens C #9):** the finished screen (backlog case) and the existing
  "all mastered" modal (`DailySessionFlow.jsx:1611`) must share congratulatory/bridge copy.
- Nit: gradebook lone-review-row annotation (`Gradebook.jsx:608-610`) — ship, don't defer.

## 7. Reconciliation re-verification — review-only × recovery × cycling (NEW; David's concern)
The cycling plan's "zero recon change" was verified BEFORE this fix existed. Review-only days advance csd with
NO new-word anchor, leaning harder on: (a) **non-demoting CSD** (`Math.max(storedCSD, csd)`, holds under the
flag), and (b) **`cleanupOrphanedReviews`** (`studyDay > anchorDay`) getting noisier as csd runs ahead of the
last new-word day (log-only under the flag → non-corrupting, but a strain signal). **REQUIRED:** explicitly
re-verify reconciliation under (1) review-only recovery days and (2) review-only × cycling laps — do NOT
inherit the pre-existing "zero recon change" claim for a combination it never saw. (Note for cycling: `twi`/`csd`
stay MONOTONIC — recon reads counters + attempt nwei, never `study_state`; the reset is per-word mastery only,
which recon ignores. Recon-safety rests on COMPLETE virtualization of every `twi`/`newWordEndIndex` producer.)

## 8. Acceptance tests (Codex ROD-5; cadence corrected per Lens A #4)
Cadence note (Lens A #4): the deadlock breaks after the FIRST review-only completion; one high review typically
drops interv below 1.0, so new words return day 2 and the gate correctly re-applies — the "pure review-only"
stretch is ~1 day, not 3.
1. **Full-freeze recovery:** enter interv=1.0 → review-only day completes (high review) → csd+1, TWI flat,
   `recentSessions` includes the review → a later session assigns `newWordCount>0`.
2. **Persistent-low:** interv stays 1.0 but the day KEEPS completing (csd advances) — no freeze.
3. **Negative gate:** ordinary day with assigned new words, no passed new attempt → still `requiresNewWordRetake`.
4. **Stale/absent config:** `sessionStorage` missing / `newWordCount` undefined → gate NOT skipped (Lens A #1).
4b. **Stale FINITE-zero (Codex highest-value edge):** an ordinary assigned-new day whose `sessionConfig.newWordCount`
   is a stale `0` must still hit the gate (this is a client durability signal, not a security boundary) — prove
   a stale 0 can't silently skip. Plus Lens A #5: a review-only day with LOST sessionStorage transiently re-blocks
   with the nonsensical "pass the new-word test first" prompt (self-heals next init) — verify it's transient only.
5. **List-end + review backlog:** completes; TWI at listSize; terminal finished screen; no retake gate.
5b. **Over-introduced list-end (Codex ROD3-1):** `cfgNewWordCount < 0` → completion ALLOWED, csd advances,
   `wordsIntroduced` persists as 0, and TWI does NOT decrease (stays exactly flat).
6. **List-end, no review work:** all-mastered terminal state; NO fake empty-day completion.
7. **Analytics:** review-only day → `newWordScore: null`, absent from `avgNewWordScore`; no "New: 0%" row.
8. **Recon re-verify:** csd advances across review-only days without demotion; no corrupting orphan-review action.

## 9. Scope — a THREE-way split (revised after Lens C: the UX companion is a real sub-project)
- **Phase 1 — BACKEND deadlock fix (ship first):** the §2 gate-skip + §3 null/marker session-state semantics +
  the §5 terminal-completion branch (`:826`) + §5 persistent-complete-hero. This alone **closes NEED_TO_FIX #11**
  (the confirmed permanent stuck-state) and un-dead-ends list completion. Small, converged, correct (Lens A).
- **Phase 2 — UX companion (fast-follow SUB-PROJECT):** the allocation-aware Dashboard hero + recovery/finished/
  oscillation state model + teacher legibility (§6). This is NOT copy tweaks — it needs a new "predict today's
  allocation" derivation + a pinned `dailyPace` (Lens C #1/#2). RECOMMEND splitting from Phase 1 so the confirmed
  deadlock fix isn't gated on the larger UX build. (Until Phase 2, a Phase-1 recovering/finished student
  completes correctly but the hero copy is still imperfect — strictly better than the permanent freeze today.)
- **Phase 3 — cycling capstone (`x/plan.md`):** Lap-2 re-introduction, gated on the server-authoritative-twi
  foundation, building ON Phase 1's review-only-completion + terminal screen. Its "zero recon change" must be
  re-verified against Phase 1 (§7).

## Implementation guardrails (Codex r2 — hold during coding)
1. Compute `reviewOnlyDay` ONLY from the explicit finite session-config value + the flag — no falsy fallback.
2. Keep the ordinary assigned-new retake gate intact (negative-gate test #3).
3. Persist LITERAL null new-word fields + the `reviewOnlyDay` marker on BOTH `session_states` AND the session
   summary — never derive `passed` from `null >= threshold` (Lens A #1).
4. NEVER call `recordSessionCompletion` for an empty/no-review terminal state (no fake day advance).
4b. **Review-only/list-end completions persist `wordsIntroduced: 0`, NEVER a negative value** (Codex ROD3-1) —
   clamp `Math.max(0, cfgNewWordCount)` (or `reviewOnlyDay ? 0 : …`) so an over-introduced day can't decrement TWI.
5. Keep W3/server-auth hardening separate — do NOT represent this fix as forgery protection.
6. Run the §7 reconciliation re-verification before claiming cycling compatibility.

## 10. Resolved / open
RESOLVED (David): list-end → congratulate-then-cycle; cycling uses per-word study_state RESET (monotonic twi NOT
reset → recon preserved); review-only completion applies to both throttle + list-end (distinguished by
`isListComplete` for UX). DESIGN CONVERGED: Codex r2 GO; r2 3-agent folded (Lens A code-corrections, Lens B
safe, Lens C → UX is a sub-project).
OPEN for David: (1) confirm the 3-PHASE split (backend fix now / UX sub-project fast-follow / cycling capstone) —
esp. that Phase 1 ships without the full Phase-2 hero. (2) terminal-screen copy direction (self-sufficient, not
teacher-dependent — Lens C #6). (3) go-ahead to implement Phase 1 (backend fix is converged + correct).

## 11. Implementation status & tracked follow-ups (Phase 1 code loop, LOCAL-ONLY)
IMPLEMENTED (main, uncommitted): §2 confirmed-reason `reviewOnlyDay` predicate + `wordsIntroduced` clamp + gate
skip + attempt-absence null semantics (`studyService.js`); §5 list-end terminal screen + empty-review terminal
(no-record) + persistent finished-hero (`DailySessionFlow.jsx`, `Dashboard.jsx`). Impl loop: 3-agent audit +
Codex r1 (NEEDS_FIXES: ROI-1 stale-finite-0 false-open) → r2 (NEEDS_FIXES: ROI2-1 empty-terminal fake-completion
via the recording modal) → r3 pending.
TRACKED, NOT in Phase 1 (Codex impl-r2, non-blocking):
- **B2 observability:** emit `logSystemEvent('review_only_completion', {userId,classId,listId,dayNumber}, 'info')`
  so CS can spot "CSD advancing while TWI flat." Deferred to the observability/W3 work; keep off the completion
  critical path if added. (Codex neutral: add-in-P1 OR defer.)
- **`newWordsTestPassed` derivation (pre-existing):** `completeSessionFromTest` derives the persisted
  `newWordsTestPassed` from `newWordScore >= threshold`, not the authoritative `newWordAttemptPassed` flag → a
  manual/lower-threshold pass can persist `COMPLETE + passed:false`. Pre-existing, not review-only-specific;
  track for a separate pass (do NOT bundle into this fix — Codex impl-r2).
