# WSL → WinClaude round 64: RUN the 윤여진 grader replay (diagnostic — no commit/deploy)

David: "have Windows Claude run the test, making sure the input is exactly how the app would send it." I checked the
code + reconstructed the exact inputs. Your job = run it and paste the numbers.

## Context (why this test)
윤여진 (uid `31WgOWbh…`) was one of the "정답과 똑같이 써도 오답" students. Their real failures are NOT the Korean
false-negative we fixed in r63 — they typed the **correct English definition** (often the verbatim answer key) and the
grader rejected it as "you've restated the English definition, translate to Korean." **37 of 55 wrong answers** are this
pattern. David decided: a correct English definition MUST be graded CORRECT.

## Fidelity (already verified against functions/index.js)
- The server is answer-key-authoritative (`index.js:761-792`): it resolves `english=word.definition` +
  `korean=word.definitions.ko` from `lists/{listId}/words/{wordId}`. I reconstructed 윤여진's 25 unique rejected words
  with those **canonical** defs (read-only) → `scripts/fixtures/yyj_grader_input.json` (all 25 have real Korean defs).
- The replayer `scripts/grader-replay-yyj.mjs` builds `wordsJson` in the identical shape, one batched call, identical
  userMessage template, `model=claude-haiku-4-5-20251001 temp=0.1 max_tokens=4096`, and EXTRACTS the live system prompt
  from `functions/index.js` (so it tests exactly the deployed `0992f5f`).

## Run it
```
ANTHROPIC_API_KEY="$(firebase functions:secrets:access ANTHROPIC_API_KEY)" node scripts/grader-replay-yyj.mjs
```
(RUNS=3 default; bump RUNS=5 if you want.) **Paste the FULL output.**

Expected: the correct-English-definition rows are STILL rejected (`REJECTED(bug)`) on `0992f5f` — confirming the r63
Korean fix didn't touch this pattern — while the 3 controls stay wrong (grader still discriminates). If instead they
come back OK-correct, that's a real (surprising) finding — report it.

## Do NOT
- No commit, no deploy, no Firestore writes. This is a **read-only model replay**.
- (Files `scripts/grader-replay-yyj.mjs` + `scripts/fixtures/yyj_grader_input.json` are in the working tree, uncommitted.
  If they're somehow not present on your side, say so and I'll commit+push.)

## Hand back
Write `docs/plans/loop/win/reviews/winclaude_064.md` with the full replay output + the bug-count line
(`correct-defs rejected: N/25`). Set baton `turnOwner=claude round=64 taskId=GRADER_REPLAY_YYJ
execStatus=review-written execDecision=<BUG_CONFIRMED|NO_BUG|ERROR> updatedBy=winclaude revision=128`.
