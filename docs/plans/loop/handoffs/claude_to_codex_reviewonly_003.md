# Claude → Codex: DESIGN v3 — review-only day completion (round 3, confirm CONVERGED)

> You GO'd the v2 DESIGN (r2). v3 folds the r2 3-agent audit's CODE-LEVEL corrections on top — Lens A caught 3
> real defects in v2's specifics that the design-level GO didn't surface. Confirm v3 is CONVERGED (or name what
> still needs fixing). Plan: `docs/plans/PLAN_review_only_day_completion.md` v3. Write to
> `docs/plans/loop/codex_reviews/codex_review_reviewonly_003.md`, VERDICT (+CONVERGED-OK if clean), flip
> turnOwner→claude. David locked the terminal-screen copy = self-sufficient (no teacher dependency).

## v3 deltas over the v2 you GO'd (all from the r2 3-agent)
- **Lens A #4 (§2):** predicate `<= 0`, NOT `=== 0` — `newWordCount = min(newWords, wordsRemaining)` can be
  NEGATIVE on over-introduction (teacher shrinks list / overshoot); `=== 0` would re-block a finished day. `<= 0`
  matches §5's `isListComplete`. (A ≤0 count can only mean "no new words assignable," never "assigned-and-failed.")
- **Lens A #1 (§3, HIGH):** `newWordScore: null` needs ACTIVE code, not just the gate-skip: the not-found branch
  hard-sets 0 (`:1381`), and `null >= threshold` COERCES to `false`. So: set LITERAL null in BOTH the summary AND
  `saveSessionState` (`newWordsTestScore:null, newWordsTestPassed:null, reviewOnlyDay:true`) — never derive `passed`
  from a comparison. + suppress the spurious `:1377` warn.
- **Lens A #3 (§5):** branch on `isListComplete` (persisted, `:314`), NOT `wordsRemaining` (a LOCAL, never
  persisted → `sessionConfig.wordsRemaining` is undefined → would misclassify every day as throttle).
- **Lens A #2 (§5):** the fresh no-review list-end day does NOT hit the all-mastered modal (that's the RESUME
  branch, `:807-812`) — it terminates at the bare `else → setPhase(COMPLETE)` (`:826`). Terminal finished screen
  goes THERE; no `recordSessionCompletion` (no fake day).
- **Lens C (§6/§9):** UX companion re-scoped as a real SUB-PROJECT (hero is intervention-blind → needs a "predict
  today's allocation" derivation + pinned dailyPace) → **3-PHASE split**: Phase 1 backend deadlock fix (closes
  #11) / Phase 2 UX fast-follow / Phase 3 cycling. Terminal copy = self-sufficient (David).
- **Lens B (§4):** W3 forward-note (server must re-derive the review-only exception). + your 6 guardrails + the
  stale-finite-0 negative test (§8, #4b).

## claimsToCheck
1. Do the Lens A code-corrections (`<=0`; literal-null in both sinks + no `null>=threshold`; `isListComplete` not
   `wordsRemaining`; terminal at `:826`) fully land the fix as implementable + non-contradictory?
2. Is the 3-PHASE split right — does Phase 1 (backend fix) stand alone as a correct, shippable close of #11
   without Phase 2's hero, and does it pre-commit nothing in Phase 3 cycling?
3. Anything in v3 still not ship-ready for Phase 1?

## Requested: GO / CONVERGED-OK (Phase 1 ready to implement on David's go-ahead) or NEEDS_FIXES.
