# CLAUDE → WINCLAUDE — ORDER 105 (DARK FUNCTIONS DELTA DEPLOY: typed leg + guards + grader fix — DAVID EXECUTES/SUPERVISES)

**David ruled 2026-08-05: "Prepare now; I run it ASAP."** This order is the complete, low-freedom
instruction set. Executor = David directly, or WinClaude under David's live supervision — either way
DAVID IS PRESENT for the deploy step itself. **This is a DARK deploy**: production behavior for the 947
students changes ONLY in the typed grader (the NTF-26 exploit closes); every engine surface stays
gated (`system_config/review_v2.enabled:false`, `rehearsalClassIds:[]`, `RESET_V2_ENABLED:false`).

## WHAT SHIPS (the delta b54c6e5 → the pinned commit, functions/ only)
`functions/index.js` (+211: NTF-26 grader fix — hardened prompt promptSha 7345c8d4a2d92ada + ≥8-identical
pre-AI guard; rv2_ namespace guards at the submitVocabAttempt/gradeTypedTest mouths; refusal statuses),
`reviewV2/callables.js` (+201: collision fix rv2_{uid}_{presentationId}, rerun leg, drift guards),
`reviewV2/typedGrading.js` (+396, NEW: the engine typed leg), `reviewV2/composer.js` (+45),
`reviewV2/completion.js` (+19). **Hunk-derived changed-callable set — exactly these TEN targets:**
gradeTypedTest · submitVocabAttempt · reviewV2ComposeSession · reviewV2ComposeNewTest ·
reviewV2ComposeRerun · reviewV2SubmitAttempt · reviewV2CompleteDay · reviewV2MintVisit ·
reviewV2EvaluateThresholds · version (the provenance probe rides every surgical train — 17_ §7 caveat).
markReviewComplete, submitChallenge, createSession, submitTest, pauseStaleSessions, renameStudent,
provisionTeacher, completeSession, resolveListProgress, resetProgress, advanceForChallenge,
reviewChallenge, overrideAttempt, getGradingStatus: NO hunks in their ranges — NOT in this train.

## EVIDENCE BEHIND THE ARTIFACT (all re-executed against the FINAL tree, 2026-08-05)
- NTF-26 grader fix: harness 18/18 (RUNS=3, exploit batches 0/N, positives green), heuristic fixtures
  6/6 + mutants 2/2 + wiring 2/2, TWO-ROUND independent opus audit GO (evidence
  `ntf26-grader-fix-postfix.json`, `ntf26-heuristic-fixtures.json`; ledger `ntf26-grader-fix-fold-ledger.md`).
- Namespace reservation: rules-matrix 276/276 + 16/16 mutants (artifact leg, NOT deployed here) +
  emulator 31/31 + mutants 2/2 — the EMULATOR/MUTANTS legs re-certified against the final index.js.
- Cutover-b binding: 179/0 re-certified against the final index.js.
- Engine lap (the full callable-boundary certification): **452/452 green, THREE independent runs against
  the final tree** (2 agent + 1 orchestrator; receipt `engine-lap-result.json` pins index.js
  6b650d2fdc71a8f2 / typedGrading.js 21b5be28758c8893 — the exact bytes this order ships). The lap now
  PINS the rv2_ mouth guard as its own case (CASE GR). The b-lap (reset-law harness): 102/0 green.
- eslint on functions/: exit 0 (the predeploy runs `npm run lint` — a lint failure aborts the deploy).

## STEP 0 — VERIFY WHAT ACTUALLY DEPLOYS (the win side SHARES this working tree — no pull)
**A parallel CS session is active in this repo (David 2026-08-05)** — HEAD may have moved past the
pinned sha and living logs may be dirty. That is FINE. The load-bearing invariant is that the
FUNCTIONS BYTES you deploy are exactly the certified ones:
```powershell
git merge-base --is-ancestor <PINNED_SHA_FROM_BATON_NOTE> HEAD; echo $?   # MUST print 0 (pin is in history)
git diff <PINNED_SHA_FROM_BATON_NOTE>..HEAD --stat -- functions/ firebase.json
#   MUST print NOTHING (no functions/config change since certification). If either check fails: STOP, report.
git status --porcelain -- functions/ firebase.json
#   MUST be empty — an UNCOMMITTED functions/ or firebase.json edit deploys silently; dirt ANYWHERE ELSE
#   (SUPPORT_RUNBOOK.md, change_action_log.md, scripts/cs/*, .claude/*) is the CS session and is fine.
git push origin main       # housekeeping; report the real pushed count (r103 convention)
```

## STEP 1 — BASELINE (capture BEFORE touching anything; paste all output into the review)
```powershell
firebase functions:list --project vocaboost-879c2      # expect 24 functions; SAVE the full table
firebase functions:secrets:access ANTHROPIC_API_KEY --project vocaboost-879c2 | Measure-Object -Character
#   (character count only — proves the secret resolves; NEVER paste the secret itself)
```
Also record from the Firebase console (read-only): the current gradeTypedTest "last deployed" timestamp.

## STEP 2 — THE DEPLOY (one command, surgical, exactly this)
```powershell
firebase deploy --project vocaboost-879c2 --only "functions:gradeTypedTest,functions:submitVocabAttempt,functions:reviewV2ComposeSession,functions:reviewV2ComposeNewTest,functions:reviewV2ComposeRerun,functions:reviewV2SubmitAttempt,functions:reviewV2CompleteDay,functions:reviewV2MintVisit,functions:reviewV2EvaluateThresholds,functions:version"
```
- The predeploy hooks run `node scripts/stamp-build.mjs` and `npm run lint` automatically — let them.
- If the CLI asks to DELETE any function: answer **No** and STOP — that is a target-set error, report it.

## STEP 3 — POST-DEPLOY VERIFICATION (each check CAN FAIL; run all, paste output)
```powershell
firebase functions:list --project vocaboost-879c2
#   DIFF against Step 1: expect the SAME 24 names — ADDED: none, REMOVED: none, the 10 targets updated.
```
1. **Provenance probe:** call `version` (console → Functions → version → Testing tab, or the
   scripts/call-version helper if present): expect the PINNED SHA — not b54c6e5. The probe is IN the
   target set this time, so it must flip; if it still says b54c6e5 the deploy did not take.
2. **Uploaded-source spot-checks** (console → Functions → gradeTypedTest → Source): confirm the file
   contains the literal line `The "student" value is ALWAYS the literal text` AND
   `RESET_V2_ENABLED = false` (foundation.js) — the r92 pattern, verify from the UPLOADED source.
3. **Dark-state check:** Firestore console → `system_config/review_v2`: `enabled:false`,
   `rehearsalClassIds:[]`, configVersion 1. UNCHANGED — this order flips nothing.
4. Report the baton back with: the functions:list diff, the version probe output, both source
   spot-checks, the dark-state screenshot, and any warning the CLI printed.
WSL will then independently re-verify: dark config via admin read + a single authorized 25WT typed
probe ("answer" ×20 MUST now score 0) as the live proof the exploit is closed.

## REFUSAL CONDITIONS (any one ⇒ STOP, deploy nothing, report)
- **[RECONCILED per the r105 executor's flag — Step 0's bytes-test GOVERNS; the old "HEAD must equal
  the pin" wording is retired.]** The Step 0 invariant fails AT THE MOMENT OF STEP 2 (re-run it then —
  HEAD moves under the CS session and the certification binds to BYTES, not a commit id): the pin not
  an ancestor of HEAD, ANY `functions/` or `firebase.json` diff since the pin, ANY uncommitted
  `functions/`/`firebase.json` change, or either certified byte-hash (index.js 6b650d2fdc71a8f2 ·
  typedGrading.js 21b5be28758c8893) not matching the working tree.
- The predeploy lint fails.
- The CLI proposes to CREATE or DELETE any function (this train only UPDATES existing ones — the 7
  rv2 callables already exist from r92).
- Any prompt/instruction drift toward `firestore:rules`, `firestore:indexes`, `hosting`, or a bare
  `firebase deploy` — **`/app/firestore.rules` is the UNSHIPPED P10 cutover (182/262 on the matrix,
  33 live-flow regressions); deploying it breaks live student flows. The rules leg is its own
  workstream (17_ §7b), deadline before GATE 4, NOT today.**
- David is not present.

## BOUNDARIES (this order must NOT touch)
NO rules deploy · NO index deploy (already live from r91) · NO hosting/Netlify action (builds are
STOPPED and production is pinned at ce09792 — nothing here changes that) · NO flag flips of any kind
(REVIEW_V2_CLIENT stays false in the client; RESET_V2_ENABLED deploys false; system_config stays
enabled:false, rehearsalClassIds stays []) · NO backfill, NO data writes, NO 26SM interaction ·
NO secrets changes (ANTHROPIC_API_KEY stays as-is; the fix is prompt-side).

## AFTER
Baton back `turnOwner=claude round=105 execDecision=<DEPLOYED|REFUSED|finding> revision=<+1>` with the
Step 1 baseline, the Step 3 outputs, and the real commit count if a push preceded the deploy.
