# CLAUDE → WINCLAUDE — ORDER 108 (THE REVERSIBLE TRAIN: publish the client · deploy rules · deploy the metering functions)

**DAVID AUTHORIZED UNSUPERVISED EXECUTION OF THE REVERSIBLE DEPLOYS (2026-08-07).** You do NOT need him
present for this order. The irreversible steps (the 26SM records recompute, the flip) are NOT in it and
still name him. **This order SUPERSEDES order 106** — its rules leg is reproduced here verbatim.

**⚠ READ FIRST — the ground has moved: NETLIFY AUTO-PUBLISH IS ON.** David turned builds AND publishing
back on. **Step 1's push therefore SHIPS THE FRONT-END TO 947 STUDENTS.** He has explicitly authorized
this, including the one known consequence (below). This is not a surprise to him; do not refuse on it.

## STEP 1 — PUSH (this is a production client release)
```powershell
git status --porcelain -- functions/ firebase.json firestore.rules   # MUST be empty; else STOP
git rev-list --count origin/main..HEAD                                # expect ~30; REPORT the real number
git push origin main
```
**What ships to students, in plain terms — David has accepted all of it:**
- **VISIBLE, intended:** the session sheet now shows each class's real passing score (e.g. "92% required
  to pass") instead of a hardcoded 95%; the Help modal line is genericised.
- **VISIBLE, an accepted gap:** the help pages no longer explain why new words pause when review scores
  are low. **That throttle is still LIVE until the flip**, so students briefly meet the mechanic with no
  explanation. David chose "publish now, accept the gap" with this named.
- **INVISIBLE:** everything else (the whole past-day/free-nav feature, the dashboard rework) is behind
  `REVIEW_V2_CLIENT=false` and renders nothing. Six independent audits verified flag-off parity.
- If the Netlify build FAILS, that is a REPORT, not something to fix by editing source.

## STEP 2 — RULES DEPLOY (from order 106, unchanged)
Live today: ruleset `384c9c7a-b9ec-4f17-95ab-b72fff9c5fd1`, 523 lines, sha16 `f40f91fce3693b82`.
Certified artifact: `/app/firestore.rules`, 579 lines, sha16 `4d8e511bf8a66176`. The delta is **6 hunks,
ZERO deletions** — one function plus three guard call-sites on the attempt write verbs; everything else
is comments. Orchestrator re-ran the matrix on these exact bytes: **276/276 green**.

**Verify the staging slot BEFORE deploying** (the deploy path is a slot, not a guarantee):
```powershell
certutil -hashfile firestore.rules SHA256          # first 16 hex MUST be 4d8e511bf8a66176
Get-Content firestore.rules | Measure-Object -Line # MUST be 579
Select-String -Path firestore.rules -Pattern "isReservedEngineDocId" | Measure-Object  # MUST be 4
```
Then:
```powershell
firebase deploy --project vocaboost-879c2 --only firestore:rules
```
**Verify after (each check can fail):**
```powershell
node scripts/deepfix2/fetch-live-rules.mjs   # NEW ruleset id; 579 lines; sha16 4d8e511bf8a66176
bash scripts/deepfix2/run-rules-matrix.sh    # MUST be 276/276 against the RE-FETCHED bytes
```
Then one 25WT student smoke: load the Dashboard and write one ordinary attempt — it must succeed (the
new guard denies only `rv2_`-prefixed ids; every legitimate client id is `{uid}_{testId}_{nonce}`).

## STEP 3 — METERING FUNCTIONS DEPLOY
Ships the AI spending cap (committed `d3dce7a`, two-round independent audit GO). Changed files:
`functions/aiMetering.js` (NEW), `functions/index.js`, `functions/reviewV2/typedGrading.js`,
`functions/reviewV2/callables.js`. **No new callable export was added**, so the target set is the SAME
TEN as order 105:
```powershell
firebase deploy --project vocaboost-879c2 --only "functions:gradeTypedTest,functions:submitVocabAttempt,functions:reviewV2ComposeSession,functions:reviewV2ComposeNewTest,functions:reviewV2ComposeRerun,functions:reviewV2SubmitAttempt,functions:reviewV2CompleteDay,functions:reviewV2MintVisit,functions:reviewV2EvaluateThresholds,functions:version"
```
- If the CLI proposes to CREATE or DELETE any function: answer **No** and STOP.
- **Verify after:** `firebase functions:list` — same 24 names, ADDED none, REMOVED none, the 10 updated;
  the `version` probe must report the new sha; and in the console check `gradeTypedTest`'s uploaded
  source contains the literal `ai_metering`.
- **Dark-state check, unchanged:** `system_config/review_v2` must still read `enabled:false`,
  `rehearsalClassIds:[]`. This order flips nothing.

## REFUSAL CONDITIONS (any one ⇒ STOP at that step, report; earlier completed steps stand)
- `functions/`, `firebase.json` or `firestore.rules` dirty in git before Step 1.
- The rules sha / line count / guard count does not match Step 2's expected values.
- The post-deploy rules matrix is anything below 276/276, or the re-fetched sha ≠ what you deployed.
- The functions CLI proposes a CREATE or DELETE.
- Any drift toward: `--only firestore` (that includes INDEXES), a bare `firebase deploy`, flipping
  `enabled:true`, adding a rehearsal class, touching 26SM, or the records recompute.
- **The client build fails or publishes something you did not expect** — report, do not repair.

## BOUNDARIES
NO flag flips (`REVIEW_V2_CLIENT` stays false in the repo; `system_config` stays dark) · NO index deploy
· NO backfill, NO 26SM interaction · NO secrets changes · the ONLY data write in this order is the
single 25WT smoke attempt in Step 2.

## AFTER
Baton back `turnOwner=claude round=108 execDecision=<DONE|PARTIAL|REFUSED> revision=<+1>` with: the real
pushed-commit count, the Netlify build/publish outcome, the old→new ruleset ids + the re-fetched sha +
the matrix score, the functions:list diff + version probe, and the dark-state confirmation. WSL then
independently re-verifies the rules (re-fetch + re-run the matrix on those bytes) and the metering
deploy (a live probe), exactly as it did for order 105.
