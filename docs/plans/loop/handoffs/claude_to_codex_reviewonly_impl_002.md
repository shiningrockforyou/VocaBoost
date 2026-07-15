# Claude → Codex: CODE review — REVIEWONLY_IMPL round 2 (DELTA, response to r1 NEEDS_FIXES)

> **TASK = REVIEWONLY_IMPL r2.** Delta review of v2. Did it close ROI-1? Are the two new folded findings
> (Lens A #1 regression + the §5 list-end terminal now added) correct? Write
> `/out/reviews/codex_review_reviewonly_impl_002.md`
> (my-side `docs/plans/loop/codex_reviews/codex_review_reviewonly_impl_002.md`), ending with
> `VERDICT blockers=.. high=.. med=.. nits=..` and `GO` or `NEEDS_FIXES`.

## Scope changed since r1
Your r1 scope answer + Lens A#2/C#1/C#2 all said the plan (§9) scopes the **§5 list-end terminal into Phase 1**.
David confirmed: **implement full Phase 1 now.** So v2 also adds the DailySessionFlow terminal + Dashboard hero.
Files now touched: `src/services/studyService.js`, `src/pages/DailySessionFlow.jsx`, `src/pages/Dashboard.jsx`.

## What changed (v1 → v2)

### 1. ROI-1 CLOSED — stale finite-0 no longer false-opens the gate  `studyService.js` ~1319
`reviewOnlyDay` now requires a CONFIRMED reason, not `cfgNewWordCount <= 0` alone:
```js
const sessionCfg = sessionState?.sessionConfig || {};
const allocationNewWords = sessionCfg?.allocation?.newWords;
const reviewOnlyReasonConfirmed =
  (Number.isFinite(allocationNewWords) && allocationNewWords <= 0) ||   // intervention throttle
  sessionCfg.isListComplete === true ||                                 // list end / over-introduced
  sessionCfg.startPhase === SESSION_PHASE.REVIEW_STUDY;                 // Fix #9 review-resume
const reviewOnlyDay = LIST_SCOPED_RECON
  && Number.isFinite(cfgNewWordCount) && cfgNewWordCount <= 0
  && reviewOnlyReasonConfirmed;
```
**Verified myself (please confirm):** all three fields are returned by `initializeDailySession`
(`studyService.js:286 allocation`, `:314 isListComplete`, `:317 startPhase`) AND persisted verbatim — the
main persist site `DailySessionFlow.jsx:1161` stores the full `sessionConfig`, and the crash-recovery site
`:703` stores `recoveryConfig` (a freshly-recomputed full config). So a legit throttle/list-end/resume day
always satisfies exactly one disjunct; a stale finite `0` on an ordinary assigned-new day satisfies none →
gate applies. `SESSION_PHASE` already imported (`:47`); `startPhase` round-trips as a JSON string.

### 2. Lens A #1 regression CLOSED — #9 resume keeps its real score  `studyService.js` ~1440
The literal-null session-state write is now keyed on **attempt-absence**, not `reviewOnlyDay`:
```js
const newAttemptMissing = newWordScore === null;   // set only by the `else if (reviewOnlyDay)` no-attempt branch
newWordsTestScore: newWordScore,
newWordsTestPassed: newAttemptMissing ? null : (newWordScore >= threshold),
```
A Fix #9 REVIEW_STUDY resume is `reviewOnlyDay===true` but a genuine passing new-word attempt exists →
`newWordScore` is the real value → it now persists (session_state matches summary/recentSessions). Genuine
throttle/list-end no-attempt day → `newWordScore===null` → literal nulls preserved (G4 intact, no `null >=
threshold` coercion).

### 3. §5 list-end terminal (Phase 1 per §9)
- `DailySessionFlow.jsx` `CompletePhase`: on `sessionConfig.isListComplete`, renders a distinct
  "🎉 You finished the list!" terminal (self-sufficient copy, Lens C#6) instead of "Day N Complete / Great Job!".
- `DailySessionFlow.jsx:819`: empty-review guard added (mirrors the resume branch `:807`) so a fresh review-only
  day with an all-mastered/empty segment routes to the all-mastered modal, never an empty review test (Lens C#3).
  **No `recordSessionCompletion` added at `:826`** (guardrail 5) — it stays a terminal no-work state; the COMPLETE
  render shows the finished terminal.
- `Dashboard.jsx` hero: `listFinished = listTotal>0 && wordsLeft===0` (progress-only, no Phase-2 allocation
  prediction) → persistent finished copy + "Start review →" instead of "come back tomorrow" / "Learn N new words".

## Deliberately deferred (NOT in v2 — confirm you agree these are Phase 2 per §6)
- allocation-aware hero (predict today's allocation), teacher legibility (`CurrentSessionCell` null → "New: ✗ -"),
  oscillation copy, re-entry-modal phrasing, gradebook lone-review annotation.
- Lens A#4: day-guard on a reconciliation-advanced review-only day drops that day's review (pre-existing, not
  worsened; folded into §7 recon re-verification, not this diff).

## TWO OPEN QUESTIONS for you (Lens B, both non-blocking — rule them in or out of Phase 1)
1. **B1 (W3 sequencing):** the gate-skip trusts client `sessionConfig.newWordCount`. Lens B wants the plan's W3
   forward-note escalated to a HARD tracked dependency (a rules-only W3 that locks `class_progress` must not ship
   before `reviewOnlyDay` is server-derived). Agree it's a doc/tracking item (NEED_TO_FIX / plan §4), not a code
   change here?
2. **B2 (observability):** Lens B recommends emitting `logSystemEvent('review_only_completion', {userId, classId,
   listId, dayNumber}, 'info')` on the review-only path so CS can spot "CSD advancing while TWI flat." Worth adding
   in Phase 1, or defer to the observability/W3 work? (I left it OUT to avoid scope creep — your call.)

## Requested decision
`GO` (v2 faithfully closes ROI-1 + A#1 and the §5 terminal is correct → proceed to local Playwright acceptance
audits) or `NEEDS_FIXES` (file:line + concrete edit).
