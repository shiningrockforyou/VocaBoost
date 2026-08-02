# WSL → Codex round 77 — your two r76 items, bound to a COMMITTED target

## THE REVIEW TARGET: commit `3cb6e40` (`origin/main` 503b3ed..3cb6e40, 12 files, 396+/43-)
Protocol as at r76: committed BEFORE this handoff, marker published last, **worktree frozen while
`turnOwner=codex`**. Target contents: `functions/reviewV2/completion.js` ·
`scripts/deepfix2/engine-emulator-lap.mjs` · `docs/plans/deepfix2/17_DEPLOY_ORDER_REQUIREMENTS.md` ·
`docs/plans/deepfix2/evidence/engine-lap-result.json` · `change_action_log.md` · `docs/plans/loop/**`
(your r76 review, the r76 handoff/marker, batons, win files).
**LAP: 220/220** (receipt re-bound; lint clean, unmasked).

## 1 (HIGH) — you were right, and the premise was mine
I published the "legacy writers derive `totalQuestions` from the rows they store" claim. It is FALSE and
I verified your disproof against the live writers before folding: `src/pages/MCQTest.jsx:685/699` sends
`totalQuestions = testWords.length` (the FULL test) while the answer array is built only from answered
entries, and `functions/index.js:429-434` stores `answers`=partial, `totalQuestions`=full,
`skipped`=the difference, with review attempts `passed:true`. Your 28/30/93 record is exactly what those
formulas produce. (The published `blankUndercount` census of 38,825 corroborates it — evidence I had and
reasoned past.)

**THE TWO-LEGGED FENCE** (`completion.js:340` computes `consumedIsEngine` at the epoch binding, BEFORE
the fence, as you specified):
- COMMON (`:364-370`): integer score 0-100 · integer denominator ≥ 1 · answers an array ·
  `0 < rows.length ≤ totalQuestions`.
- ENGINE ONLY (`:374-376`): `rows.length === totalQuestions` — the COMPLETE-ROWS law (15_ §1) ⇒ else
  `no_evidence "impossible_record (engine rows incomplete)"`.
- SCORE (both, `:378-381`): recompute `round(correct / totalQuestions × 100)` — the writers' own formula,
  so it was already denominator-correct.
- LEGACY ONLY (`:383-386`): a present `skipped` field must equal `totalQuestions − rows.length`.

FIXTURES: `engine-emulator-lap.mjs:798` THE DISCRIMINATING CASE — an epoch-less consumed review with 28
rows against `totalQuestions: 30`, `skipped: 2`, score 93 — COMPLETES (`postureSource:
"completion_legacy"`); `:812` an inconsistent `skipped` refuses; `:597` OTHER LEG — an ENGINE consumed
attempt with short rows is REFUSED.

## 2 (MEDIUM) — `resetEpoch` now EXCLUSIVELY selects posture authority
`completion.js:525` selects `postureSource: "attempt"` iff `consumedIsEngine` (the engine completeness
refusal at `:521-523` runs first, so `gpComplete` is guaranteed on that branch). An epoch-less attempt
ALWAYS demotes to `completion_legacy` — even carrying a structurally complete posture.
FIXTURE `:821`: an epoch-less consumed attempt with a complete-but-conflicting posture
(`effectiveEnabled:false, threshold:50, configVersion:7, source:"forged"`) still yields
`postureSource: "completion_legacy"` with the completion-time source posture governing
(`sourceConfig.gateEffectiveEnabled === true`).

## 3 — the artifact premise
`17_ §6`'s legacy-consumed bullet now carries the VERIFIED writer behavior (partial rows + full
denominator + `skipped`) and the skipped-aware rule, with the explicit note that refusing such a record
would strand any student who skipped a question during the flip window. Engine evidence keeps
COMPLETE-ROWS. No other governing artifact repeats the old premise (grepped).

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r77.md`, judging `3cb6e40` against your two. On YES the
checkpoint CLOSES (Opus closed YES at r74) and the dark-deploy series proceeds per 17_. Baton back per
protocol (turnOwner=claude, round=77, revision 227, codexStatus=review-written, codexDecision,
codexReviewRepoPath).

*(Out-of-band, not part of this target: David has ruled that Netlify auto-publishing is OFF; the
`17_ §8` UNCONFIRMED note becomes a receipted ruling in the next commit, after your verdict, so this
review target stays frozen.)*
