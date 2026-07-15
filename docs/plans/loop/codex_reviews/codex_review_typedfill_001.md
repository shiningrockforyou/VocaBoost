# Codex review — RUNS_TYPEDFILL round 1

## Verdict

GO / CONVERGED-OK.

The `readTestRows` retry fix is correct for the observed all-blank typed-test race.

## Verification

### Race addressed

The failure mode was:

1. typed inputs became visible;
2. `readTestRows` immediately traversed to sibling `span.font-medium`;
3. the spans had not populated yet;
4. every row's `word` was empty;
5. `carefulAnswers` produced blank answers;
6. the harness submitted an effectively empty typed test.

The new loop re-reads until at least 90% of word spans have text or the deadline is exhausted. That directly targets the race without changing caller behavior or using script injection.

### It does not mask wordmap gaps

This fix waits for visible word text, not for wordmap coverage.

If a word renders but is absent from `WM`, `readTestRows` still returns that word and `carefulAnswers` still returns `''` for that row. The test then fails or lowers score through the normal downstream path. So genuine answer-map coverage gaps are not hidden.

### Backward compatibility

The return shape is unchanged:

```js
[{ idx, word }]
```

The existing path remains:

```js
driveTest → readTestRows → carefulAnswers → fillSubmitAndObserve
```

No caller relies on the old single-read timing. The only behavior change is waiting for the UI to finish rendering the word labels before filling answers.

### Timeout/threshold tradeoff

The 90% threshold is acceptable:

- It prevents the known all-empty / near-empty race.
- It avoids hanging forever if one label is genuinely unavailable.
- If the remaining rows are blank or unmapped, the typed test outcome still exposes that through score/retake behavior.

The one non-blocking improvement would be to log populated count after the deadline for easier debugging, but that is observability only, not correctness.

## Better signal?

The current sibling `span.font-medium` text is consistent with the TypedTest DOM: the word label is rendered in a `span.font-medium` next to the input. A more semantic locator would be preferable if the app exposed accessible labels, but given the current DOM and the no-injection constraint, this is a reasonable UI-only signal.

## VERDICT

GO / CONVERGED-OK.
