# WSL → WinClaude round 63: VERIFY → COMMIT → PUSH → DEPLOY the grader fix (David-directed)

David: "have windows claude commit and push. and have it deploy the function." This is the grader false-negative fix
(Work Item B). You have the deploy env + the Firebase secret, so you run the gate AND ship it.

## What changed (already on disk, NOT committed)
- `functions/index.js` — grader prompt hardened (Rule 1 scoped ENGLISH-ONLY; explicit "a Korean translation IS the
  meaning"; +3 positive examples 자전적인/무관심한/불협화믐). Diff is grader-prompt-only.
- `scripts/grader-regression.mjs` (NEW) — regression harness; extracts the LIVE prompt from `functions/index.js` and
  runs a 9-case fixture against real Haiku.

## STEP 1 — run the fixture FIRST (the gate; do NOT skip)
```
ANTHROPIC_API_KEY="$(firebase functions:secrets:access ANTHROPIC_API_KEY)" node scripts/grader-regression.mjs
```
(Windows shell: set the env var however your shell does it; RUNS=5 for extra confidence is fine.)
**Paste the FULL output into your review.** Decision gate on the last line:
- `RESULT: FAIL` (any false-reject/accept) → **STOP. Do NOT commit or deploy.** Report the flagged rows. Done.
- `RESULT: PASS` (zero false-reject/accept) → proceed to STEP 2.

## STEP 2 — focused commit (only if fixture PASSED)
⚠️ **Renorm hazard:** repo has `.gitattributes = * text=auto`. Do **NOT** `git add -A` / `git add .` (would restage
line-ending renorm across ~29 files). Stage ONLY these, then verify the staged set before committing:
```
git add functions/index.js scripts/grader-regression.mjs change_action_log.md
git diff --cached --stat        # MUST show ONLY those 3 files — abort if anything else appears
git commit -m "fix(grading): scope Rule 1 to English, accept Korean translations; add regression harness"
```
Never stage `.env`, `serviceAccountKey.json`, or any secret.

## STEP 3 — push
```
git push origin main
```

## STEP 4 — DEPLOY (surgical — grader ONLY)
```
firebase deploy --only functions:gradeTypedTest
```
🚫 **Do NOT run a blanket `firebase deploy --only functions`.** `completeSession` / `resolveListProgress` are the
server-authoritative cutover functions PINNED live at `0ddbb34` (GO-HOLD). A full functions deploy would re-stamp them
from the current tree and disturb the pinned state. Deploy the grader function and nothing else.

## STEP 5 — verify + hand back
- Confirm the deploy succeeded and record the new deployed commit SHA + the function's updated timestamp.
- Optional: re-run STEP 1 once more post-deploy as a live smoke (still hits the same model+prompt).
- Write `docs/plans/loop/win/reviews/winclaude_063.md` with: the FULL fixture output (both runs if you did two), the
  commit SHA, the deploy result, and any anomaly. Set baton `turnOwner=claude round=63 taskId=GRADER_DEPLOY
  execStatus=review-written execDecision=<DEPLOYED|BLOCKED_FIXTURE_FAIL|ERROR> updatedBy=winclaude revision=126`.

Sandbox discipline unchanged: this touches ONLY the grader function + a git commit — no 26SM data writes.
