# CLAUDE → WINCLAUDE — ORDER 106 (RULES DEPLOY: the rv2_ namespace reservation — DAVID EXECUTES/SUPERVISES)

**David ruled 2026-08-05: "Prepare it now, run it soon."** Required before GATE 4 (the 26SM backfill)
per `17_ §7b` — between the backfill and this deploy, real backfilled labels would exist with the
field-immunity clauses undeployed and therefore client-forgeable. **DAVID IS PRESENT for Step 2.**

## WHAT SHIPS — and it is PURELY ADDITIVE (verified, not asserted)
Live production ruleset today: **`384c9c7a-b9ec-4f17-95ab-b72fff9c5fd1`, 523 lines, sha16
`f40f91fce3693b82`** (deployed 2026-08-03, order 97) — I re-fetched it read-only at order-writing time.
The certified artifact: **`/app/firestore.rules`, 579 lines, sha16 `4d8e511bf8a66176`**.
`scripts/deepfix2/diff-rules-vs-live.sh` (normalized — the live base is CRLF, the artifact LF, so a
naive diff shows a false 100% rewrite): **6 hunks, ZERO deletions.** The entire functional delta is:
```
+ function isReservedEngineDocId(attemptId) { return attemptId.matches('rv2_.*'); }
+   && !isReservedEngineDocId(attemptId)     × 3  (attempts create · update · delete)
```
plus comments (incl. the NTF-20 provenance-scan citation repair). **No existing allow is removed,
narrowed, or reordered.** It closes NTF 19+22: a classmate can currently create/squat
`attempts/rv2_{victim}_{presentationId}` and convert the engine's fail-closed provenance checks into a
PERMANENT denial of that student's test.

## EVIDENCE (re-executed by the orchestrator against these exact bytes, 2026-08-05)
- **Rules matrix: 276/276 green** (`run-rules-matrix.sh`, `rules sha256 4d8e511bf8a66176`) — my own run.
- Rules mutants 16/16 killed + emulator 31/31 + mutants 2/2 (namespace-reservation fold, re-stamped
  today against the current tree).
- The engine side of this pair is ALREADY LIVE (order 105, deployed + probe-verified this morning).

## STEP 0 — VERIFY THE STAGING SLOT (the deploy path is a SLOT, not a guarantee)
```powershell
git rev-parse HEAD ; git status --porcelain -- firestore.rules firebase.json
#   firestore.rules / firebase.json MUST be clean. Dirt elsewhere (CS session logs) is FINE.
certutil -hashfile firestore.rules SHA256      # first 16 hex chars MUST be 4d8e511bf8a66176
Get-Content firestore.rules | Measure-Object -Line    # MUST be 579
Select-String -Path firestore.rules -Pattern "isReservedEngineDocId" | Measure-Object
#   MUST be 4 (1 definition + 3 call sites). If ANY of these differ: STOP, report.
```
**Historical note, resolved — do not act on the stale warning:** `17_ §7b` says the deploy path holds
the UNSHIPPED P10 cutover. That WAS true on 2026-08-03; it is NOT true now — the P10 draft was moved to
`audit/deepfix/task3/firestore.p10d.rules` and the certified artifact was staged into the slot. The sha
check above is what proves it at YOUR moment, which is why it is Step 0 rather than a footnote.

## STEP 1 — BASELINE (capture BEFORE; paste into the review)
```powershell
firebase firestore:rules:releases:list --project vocaboost-879c2   # or the console Rules tab
#   RECORD: the current ruleset id (expect 384c9c7a-b9ec-4f17-95ab-b72fff9c5fd1) + its timestamp.
```
The pre-deploy live copy is already preserved in-repo at `audit/deepfix/task3/live_baseline/` (fetched
read-only today) — that is the rollback source if one is ever needed.

## STEP 2 — THE DEPLOY (one command, surgical, exactly this)
```powershell
firebase deploy --project vocaboost-879c2 --only firestore:rules
```
**NEVER a bare `firebase deploy`** — that would also push indexes, functions and hosting, none of which
is reviewed in this order.

## STEP 3 — POST-DEPLOY VERIFICATION (each check CAN fail; run all, paste output)
1. **Re-fetch the live ruleset and prove identity, not vibes:**
   ```powershell
   node scripts/deepfix2/fetch-live-rules.mjs
   ```
   Expect a NEW ruleset id ≠ `384c9c7a…`, **579 lines, sha16 `4d8e511bf8a66176`** — byte-identical to
   what you deployed.
2. **ADDITIVE PROOF — the check that would fail if the wrong file shipped:** re-run the matrix against
   the RE-FETCHED bytes, not against the repo file:
   ```powershell
   bash scripts/deepfix2/run-rules-matrix.sh
   ```
   Expect **276/276 green**. (Order 97 used exactly this pattern; the P10 trap scores 182/262 with 33
   live-flow regressions, so a wrong-file deploy cannot pass this.)
3. **Live-flow smoke, 25WT ONLY:** as a 25WT student, load the Dashboard and start a session far enough
   to write one ordinary attempt — it must succeed (the new guard denies only `rv2_`-prefixed ids; every
   legitimate client id is `{uid}_{testId}_{nonce}`). **Never 26SM.**
4. Report the baton with: the Step 0 hashes, the old/new ruleset ids, the re-fetched sha + line count,
   the matrix score, and the smoke result.

## REFUSAL CONDITIONS (any one ⇒ STOP, deploy nothing, report)
- `firestore.rules` sha16 ≠ `4d8e511bf8a66176`, line count ≠ 579, or the `isReservedEngineDocId` count ≠ 4.
- `firestore.rules` or `firebase.json` is dirty in `git status`.
- The normalized diff shows ANY deletion (this change is additive; a deletion means the wrong base).
- Any drift toward a bare `firebase deploy`, `--only functions`, `--only hosting`, or `--only firestore`
  (that last one includes INDEXES — this order is `firestore:rules` and nothing else).
- The post-deploy matrix is anything below 276/276, or the re-fetched sha ≠ what you deployed.
- David is not present.

## BOUNDARIES (this order must NOT touch)
NO functions deploy (order 105 already shipped that; the metering build is committed-not-deployed and
rides a LATER order) · NO index deploy · NO hosting/Netlify action (builds are STOPPED, production
pinned at `ce09792`) · NO flag flips (`REVIEW_V2_CLIENT` false; `system_config/review_v2` stays
`enabled:false`, `rehearsalClassIds:[]`) · NO backfill, NO 26SM interaction, NO data writes beyond the
single 25WT smoke attempt · NO secrets changes.

## AFTER
Baton back `turnOwner=claude round=106 execDecision=<DEPLOYED|REFUSED|finding> revision=<+1>`.
WSL then independently re-verifies: re-fetch the live ruleset and re-run the matrix against those bytes
(the order-97 pattern — I do not accept the executor's score, I reproduce it).
