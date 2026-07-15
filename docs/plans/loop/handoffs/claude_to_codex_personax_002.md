# Claude → Codex: DESIGN review — persona expansion v2 (task PERSONAX_DESIGN, round 2, WARM)

> **Round 2.** Reviewed `docs/plans/loop/runslong/persona_expansion.md` v2. WARM — re-check the deltas below +
> the claimsToCheck; don't re-scan. Write to `docs/plans/loop/codex_reviews/codex_review_personax_002.md`, end
> with `VERDICT` (+ `CONVERGED-OK` if 0 blocker/high), flip `turnOwner → claude`. Full adjudication (your r1 +
> 3 fable lenses, each verified vs code): `docs/plans/loop/rounds/personax_r01_synthesis.md`.

## Your r1 (PX-1..7) + all 3 fable lenses folded
- **PX-1 (blocker) coverage:** added an **EVENT-COVERAGE LEDGER** (§3) — every old-catalog event bound to a
  persona OR explicit OUT-OF-SCOPE. Re-added #12 phantom (L13, pinned EXPECTED-BLOCKED), #8b full-freeze (L14),
  #7 reload/resume (folded into L1), #11 footgun (L11); #10b invalid-anchor + #10a survivor + pure-#6 move
  marked OUT-OF-SCOPE with reasons (flagged for David). ~14 personas now.
- **PX-2 list-end:** CORRECTED — hand off AT cap; post-cap review-only DEAD-ENDS (`requiresNewWordRetake`, csd
  frozen, orphan-flag) = the pinned phantom EXPECTED-BLOCKED (L13), unless the segment is empty. Killed
  "review-only continues" (§0/§2/§5).
- **PX-3 throttle:** dynamic per-day cap; interv=0 until 3 reviews; resets across a switch; L12 partial vs L14
  freeze (interv=1.0) separated. Universal oracle `Δtwi = min(paceEff, listSize−twi)`.
- **PX-4 T2:** pin switch N≤15, exact formula `N + ceil((1600−80N)/100)`, between completed days; partial-day
  cross-class review is L10 not L7.
- **PX-5 T1 = NEW class** (§2); footgun = L11.
- **PX-6/§9-Q3 wordmap:** per-list map, assert non-empty defs, Phase-A grader-verify gate.
- **PX-7 harness = SEGMENT runner** (§4): parameterized {student,classId,listId,pace}; per-segment attempt
  baselines; per-transition checkpoint manifest.
- **Lens A-F2 (new invariant):** pace round-trips ONLY via DailySessionFlow entry + studyDaysPerWeek default(5)
  — pinned as a harness invariant + bind-verify assert.
- **Lens C:** honest runtime (~5-6h parallel), per-persona SL_MAX_MS + arc checkpoint/resume, retake-loop
  driver, BLANK-based partialAnswers, selectList after class switch, Phase-A entry gates.

## claimsToCheck (warm)
1. Is the **universal oracle** `Δtwi = min(paceEff, listSize−twi)` correct for ALL cases (steady, throttle,
   partial-final, T2 post-switch)?
2. Is **L13 (phantom EXPECTED-BLOCKED)** the right way to pin the post-cap dead-end (vs the empty-segment
   completing exception), and is exempting its `orphaned_attempt_flagged` from the "no orphan" end-state sound?
3. **L4 full triple chain** (BaseCamp→Ascent→Summit, 45d, ~3h) — worth the cost, or truncate?
4. Any remaining event UNBOUND in the §3 ledger that should NOT be OUT-OF-SCOPE?

## For David (remaining open, §9): (a) re-pin #10b invalid-anchor or accept out-of-scope; (b) pure same-pace
#6 move in or out; (c) L4 45-day runtime OK or truncate Summit stint.

## Requested decision
`GO`/`CONVERGED-OK` (design sound + buildable → implement Phase A after David's go-ahead) or `NEEDS_FIXES`.
