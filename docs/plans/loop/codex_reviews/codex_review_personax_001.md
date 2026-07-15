# Codex review — PERSONAX_DESIGN round 1

## Verdict

NEEDS_FIXES.

The model is directionally sound: "level = list + pace" matches the app, same-list carry through `LIST_SCOPED_RECON` is the right mechanism, and a persona-capable runner is buildable from `lsr_runSL_phase1.mjs`. But v1 is not yet safe to implement because the coverage claim is too broad and some oracles are underspecified or wrong at list-end / intervention boundaries.

## Findings

### PX-1 — Coverage claim drops several existing Run S-Long behavioral events

Severity: blocker.

`persona_expansion.md` says the curated set must hold every behavioral event, and the handoff asks whether it covers the old catalog from `runslong/plan.md §3`. It does not.

The v1 set covers:

- retake
- threshold
- throttle
- dual/cross-class
- leave-mid

But the old catalog also includes at least:

- reload/quit-happy resume behavior;
- support-intervened / manual-pass survival;
- invalid-anchor survival;
- getPrimaryFocus second-list footgun;
- list-completer / phantom-day expected-red;
- same-list same-pace class reassignment / day-reset reproduction, isolated from a pace change.

Those are not equivalent to the new list-chain/difficulty personas. If the goal is "all relevant events", the matrix must either include them or explicitly mark them deferred/out-of-scope. Otherwise Phase D can produce a green result while silently dropping previously agreed CS-grounded coverage.

Required fix:

- Add explicit rows or a separate "deferred coverage" table for the missing old-catalog events.
- Do not let the ~12 curated set claim full coverage unless each old behavioral event maps to a persona.
- Add a required manifest check: catalog event → persona(s), with no unbound event.

### PX-2 — List-end semantics are not safe as written

Severity: high.

The plan says:

- run until `twi == listSize`;
- "once `twi == listSize`, new-word sessions stop (review-only continues)";
- optional review-only day after cap.

That overstates what the app safely supports. In `initializeDailySession`, `newWordCount = min(allocation.newWords, wordsRemaining)`, so at list end `newWordCount` becomes 0. But Day 2+ completion still calls `completeSessionFromTest`, which gates completion on finding a same-day passed new-word attempt. A pure review-only day without a same-day new pass is the known phantom/list-completion edge, not a clean continuation path.

Required fix:

- For L1/L2/L3/L4/L5/L12, define the normal PASS target as the day that reaches `twi == listSize`, then hand off immediately.
- Do not include "optional review-only day after" in the green path.
- If auditing post-cap review-only behavior, make it a pinned expected-red/persona-12-style case with a specific signature, not part of steady run-to-completion.

### PX-3 — Intervention/throttle completion cap is not "exact cap"

Severity: high.

The plan repeatedly uses exact caps derived from `listSize / pace` and says final days have "no partial". That is true only for clean steady personas with intervention level 0 and exact divisible list sizes.

For throttled personas, code uses:

- `calculateInterventionLevel(recentSessions)` from the last 3 non-null review scores;
- `calculateDailyAllocation(dailyPace, interventionLevel)`;
- `newWords = Math.round(dailyPace * (1 - interventionLevel))`;
- then `newWordCount = min(allocation.newWords, wordsRemaining)`.

So L10 cannot share the Base Camp 15-day cap if it actually throttles. It needs a dynamically computed checkpoint sequence and potentially much longer runtime. If intervention reaches 1.0, `newWords` becomes 0 and the flow may hit the list-end/phantom-day class of behavior even before list completion.

Required fix:

- Separate "steady cap" from "throttled cap".
- For L10, compute expected `dayNewCount` per session from the prior 3-review-score window and stop only when the dynamic sequence reaches listSize, or cap the persona to a fixed diagnostic window rather than claiming run-to-completion.
- Explicitly forbid `interventionLevel === 1.0` in the partial-throttle persona unless testing the full-freeze expected-red case.

### PX-4 — T2 switch oracle needs exact timing and formula

Severity: high.

The plan says same-list pace switch "from the switch day, twi advances by 100" and finishes in "17–19d depending on switch day". That is not precise enough for an implementation.

The correct oracle depends on when the switch happens:

- switch before starting a day in the new class: destination class reconciles existing Ascent `csd/twi`, then that day's `newWordCount` uses the new pace 100;
- switch after a new-word pass but before review: this becomes the #9 partial-day checkpoint path, and review must add zero TWI;
- switch after completing a day: next day uses pace 100.

Required fix:

- Pick one T2 timing for L6 and state it explicitly.
- Prefer switch between completed days for the pace-change persona, and keep partial-day cross-class review in L11.
- Formula for steady L6 should be:
  `daysBeforeSwitch + ceil((1600 - twiAtSwitch) / 100)`, with final-day delta capped by remaining words.

### PX-5 — T1 handoff should use a new class, not same-class reassignment, for the primary chain

Severity: medium.

The plan leaves T1 open. My recommendation: use a new class per next-list for the primary T1 chain.

Reason:

- It cleanly models manual promotion without entangling the F02 default-focus / second-list-in-same-class behavior.
- The new list has a distinct `{classId}_{listId}` progress doc and should start fresh because the list changes.
- Same-class add/reassign is a separate UI/focus behavior and should be covered by the getPrimaryFocus footgun persona, not mixed into the list-chain oracle.

If same-class reassignment is important, add it as a separate persona or subcase.

### PX-6 — Wordmap prerequisite is necessary but not sufficient

Severity: medium.

Building `wordmap.json` from each word doc's `definition` is plausible: the typed test displays `word.word`, and the submitted canonical answer path uses the word definition. But because the live grading path involves typed grading, do not assume mass correctness from the data copy alone.

Required fix:

- Before running the fleet, run a one-test smoke per cloned list using word-doc `definition` values.
- Gate Phase A on "typed answer from generated wordmap scores pass" for Base Camp, Ascent, and Summit.
- Keep the new `readTestRows` populated-word retry as a prerequisite.

### PX-7 — Existing harness is farther from persona-capable than the plan implies

Severity: medium.

`lsr_runSL_phase1.mjs` is still a single-teacher, single-student, single-class, single-list, hardcoded `LIST`, hardcoded `PACE`, fixed-day primitive. Extending it is feasible, but the plan should treat this as a new runner/foundation phase, not a light extension.

Required implementation constraints:

- All Firebase reads must be parameterized by active `{student, classId, listId}`; current helper state is built around one global `LIST`.
- Attempts must be checked per list and class where relevant; cross-class personas need list-scoped and class-scoped views.
- Each transition must emit a checkpoint manifest before/after session entry, not only end-state docs.

## Answers to open questions

1. T1 handoff: use a new class for the primary chain. Keep same-class new-list assignment as a separate focus/UX persona if needed.
2. T3 int→adv: model the early-switch/abandon path as the primary T3 because it proves different-list fresh start. Finishing Base Camp first is already covered by T1.
3. Wordmap: word-doc `definition` is the right source, but verify one typed pass per list before mass fleet.
4. L12 Summit cap: for clean steady final pace, yes: Ascent 1600/100 = 16 days, Summit 800/100 = 8 days, total 24 study days. Do not add a post-cap review-only green day.

## VERDICT

NEEDS_FIXES.

Do not implement Phase A from v1 as-is. Revise the persona matrix and oracle rules first, especially PX-1 through PX-4.
