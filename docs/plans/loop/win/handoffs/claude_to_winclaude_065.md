# WSL → WinClaude round 65: DEPLOY the weekly challenge-token reset (David-directed, before-noon)

David: "just deploy before it hits noon. check status after midnight." This is the challenge-token MONTHLY→WEEKLY reset
(Codex-verified r38/r39, Approach 1 read-time). WSL built + unit-tested it; you deploy.

## What changed (5 files, on disk, uncommitted)
- `functions/index.js` — `availableChallengeTokens` now counts `status==='rejected' && challengedAt >= startOfKstWeekMs(now)`
  (was `replenishAt > now`). New byte-identical KST helper `startOfKstWeekMs` (fixed +540min, boundary = **Monday 04:00 KST**,
  `WEEKLY_RESET_HOUR_KST=4`). Tokens refill to 5 at Monday 04:00 KST for ALL students; no amnesty/data-write. (We're deploying
  just after the 00:00 mark, so with the 04:00 boundary the first reset fires at 04:00 KST today — students hold current counts
  until then. Verification is AFTER 04:00 KST, not midnight.)
- `src/services/db.js` — client twin `getAvailableChallengeTokens` + identical `startOfKstWeekMs`.
- `src/components/TestResults.jsx` + `src/pages/Gradebook.jsx` — copy "for 30 days" → "until the weekly reset (Mon)".
- `scripts/challenge-token-kst-test.mjs` — 15 KST-boundary unit tests (deterministic; the deploy gate).

## STEP 1 — gate: run the unit test (must be ALL PASS)
```
node scripts/challenge-token-kst-test.mjs
```
If not "ALL PASS: 15 passed, 0 failed" → STOP, report. Else continue.

## STEP 2 — focused commit (renorm hazard: git add ONLY these, NOT -A)
```
git add functions/index.js src/services/db.js src/components/TestResults.jsx src/pages/Gradebook.jsx scripts/challenge-token-kst-test.mjs change_action_log.md
git diff --cached --stat        # MUST be exactly those 6 files; abort if anything else
git commit -m "feat(tokens): weekly challenge-token reset (Mon 04:00 KST) via read-time week window"
git push origin main
```
Never stage secrets.

## STEP 3 — DEPLOY functions (SURGICAL — submitChallenge only)
```
firebase deploy --only functions:submitChallenge
```
🚫 NOT a blanket `firebase deploy --only functions` — leave completeSession/resolveListProgress (@0ddbb34) and
gradeTypedTest (@0992f5f) untouched. `availableChallengeTokens` is only used by submitChallenge (verified).

## STEP 4 — DEPLOY client (for the reader + copy; keeps client token DISPLAY consistent with the server)
```
npm run build        # use the project's real build script; STOP if the build errors — do not deploy a broken bundle
firebase deploy --only hosting
```
Note: client `6bffe1c` == HEAD client except these token edits (WSL verified empty src/ diff pre-edit), so this ships
ONLY the token change. Do STEP 3 + 4 close together to minimize any client-vs-server token-count mismatch window.

## STEP 5 — verify + hand back
- Record the new deployed commit SHA + confirm both deploys succeeded.
- Write `docs/plans/loop/win/reviews/winclaude_065.md`: test output, commit SHA, both deploy results, any anomaly.
- Set baton `turnOwner=claude round=65 taskId=TOKEN_WEEKLY_DEPLOY execStatus=review-written
  execDecision=<DEPLOYED|BLOCKED|ERROR> updatedBy=winclaude revision=130`.

No 26SM data writes anywhere in this (the reset is pure code — that's the whole design).
