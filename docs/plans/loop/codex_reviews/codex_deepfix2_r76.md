# Codex review — Deepfix2 round 76

**Verdict: NO.** Review target `503b3ed` is stable and the engine-posture and stale-takeover changes are real. The checkpoint still cannot close because the published legacy-consumed rule rests on a false claim about both live attempt writers: they retain the full test denominator while storing only answered rows. A legitimate passing legacy review with skips is therefore rejected by the new completion fence. The same `resetEpoch` discriminator also still does not exclusively select posture authority for a mixed epoch-less record.

## 1. HIGH — valid legacy consumed reviews with skips are falsely rejected

`docs/plans/deepfix2/17_DEPLOY_ORDER_REQUIREMENTS.md:59-63` now says legacy consumed row/score arithmetic is safe because `submitTestAttempt` persists `totalQuestions` from the rows it stores, so `rows.length === totalQuestions` holds. The handoff repeats that claim. The code says the opposite.

The active path is `SERVER_ATTEMPT_WRITE = true` (`src/config/featureFlags.js:10`). `MCQTest.jsx:569-578` builds `answerArray` only from answered entries, while `:699` sends the full `testWords.length` as `totalQuestions`. `functions/index.js:429-434,480-491` computes score over the full denominator, stores the partial `attemptAnswers` array, stores the full `totalQuestions`, records the difference as `skipped`, and makes review attempts `passed:true`.

The fallback writer behaves the same way: `src/services/db.js:1265-1268,1287-1288,1306-1319` stores `answeredWords`, the caller-supplied full `totalQuestions`, and their difference as `skipped`. It does not derive total questions from stored row count.

Concrete valid record from those exact formulas:

```text
review answers: 28 correct rows
totalQuestions: 30
score: round(28 / 30 * 100) = 93
passed: true
resetEpoch/gatePosture/presentation: absent (legacy)
```

That review clears a 92 threshold, but `functions/reviewV2/completion.js:348-359` rejects it before legacy posture handling because `rowsArr.length !== tq`. My direct formula probe reproduced `{answeredRows:28,totalQuestions:30,score:93,passed:true,currentFenceRejects:true}`. The Round-76 legacy fixture stays green because its consumed review has all 30 rows; only the **new-test** half is deliberately partial.

Use skipped-aware arithmetic for epoch-less consumed evidence. Compute `consumedIsEngine` before the row fence. Common checks can still require integer score 0-100, positive integer denominator, an array, and recomputation against `totalQuestions`. Engine evidence should require `rows.length === totalQuestions`; legacy consumed evidence should allow `0 < rows.length <= totalQuestions` and recompute `correct / totalQuestions` (optionally validate a present `skipped` field). Add the discriminating 28/30, score-93, epoch-less consumed-review completion fixture.

## 2. MEDIUM — a complete posture on an epoch-less attempt still overrides the one discriminator

The new engine fail-closed check is correct: `completion.js:522-523` refuses an epoch-carrying consumed attempt whose posture is incomplete. But posture selection immediately afterward is still `if (gpComplete)` (`:525`), not `if (consumedIsEngine)`.

Consequently, an epoch-less consumed attempt carrying a complete posture uses `postureSource: "attempt"` and that record's gate/threshold/config, rather than the completion-time posture. This contradicts the newly published exact rule at `17_:53-63`, which says `resetEpoch` presence is the one discriminator and an epoch-less consumed attempt demotes to `completion_legacy`.

No current legitimate writer appears to create this mixed shape, so this is lower severity than the live skipped-row failure. It remains a fail-open authority mismatch in the exact branch this round claims to close. After the engine completeness refusal, select attempt posture only when `consumedIsEngine`; epoch-less evidence must always follow the published legacy posture rule (or explicitly refuse the mixed shape). Add an epoch-less countercase carrying a conflicting but structurally complete posture and assert the chosen published behavior.

## Verified closures

- Engine consumed evidence now refuses missing posture, `configVersion:0`, and missing source; its fixtures mutate the actually claimed `attE1`, so they reach the intended fence.
- The stale-takeover test now plants two dirty epoch-old artifacts, asserts higher re-fencing, cleanup counts and direct nonexistence, owner clear, then service. It would fail if takeover merely cleared the lock.
- The governing document now distinguishes engine, legacy-consumed, and legacy-new halves; its legacy-consumed writer premise is the remaining defect above.
- The review target is a committed and pushed SHA (`origin/main` resolves to `503b3ed`). Handoff, marker, baton, Win-baton, and Win-review hashes stayed unchanged during my review; no post-marker moving-target recurrence was observed.
- The lap receipt reports 217/217 and all 16 source SHA-256 prefixes match. The six added checks match the three consumed-posture negatives plus three takeover-cleanup assertions.
- Changed JavaScript passes `node --check`; `functions` lint passes unmasked; importing `reviewV2/callables.js` succeeds; JSON parses; and `git diff --check 503b3ed^ 503b3ed` passes.
- I did not rerun the emulator lap because this workspace lacks the `/app` environment, and I did not revive Docker.

## Narrow round-77 acceptance list

Keep the reset, engine-posture, evidence binding, and protocol closures closed. The remaining round is entirely inside Round 76's exact evidence-rule item:

1. make legacy-consumed row arithmetic accept real skipped-row storage while retaining strict complete rows for engine evidence;
2. make `resetEpoch` presence exclusively select consumed posture authority; and
3. add a passing partial legacy-review fixture plus a mixed epoch-less-posture discriminator fixture, then correct the writer rationale in `17_`.

**Codex decision: NO. PRESENTABLE: NO.**
