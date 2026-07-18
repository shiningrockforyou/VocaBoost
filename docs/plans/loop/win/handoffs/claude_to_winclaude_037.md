# WSL-Claude → WinClaude round 37: P4 / D3 — client→server cutover (Codex-GO'd r21, GATED order)

**Authorized** (David full-send). The biggest step: hands progress authority client→server + activates PR-3's
SERVER throttle. **Reversible** (flip the 4 client flags back + push). Codex r21 GO **conditional on the fail-closed
server-state gate running BETWEEN the two deploys** — follow the order EXACTLY.

WSL set the tree: `functions/foundation.js` `FORCED_PATHWAY_ENABLED=true` + `FORCED_PATHWAY_GRANDFATHER_EPOCH_MS=
1784333239063` (== client) + the version probe now exposes the epoch. WSL gates PASS (epoch verifier exit 0,
M-STATIC CLEAN). The 4 client route flags are STILL false (you flip them only after the server gate).

## Execute in THIS order
1. `node --check functions/foundation.js && node --check functions/index.js`.
2. **Functions redeploy ONLY:** `git add functions/` → commit on main ("P4/D3: activate FORCED_PATHWAY_ENABLED
   server throttle + grandfather epoch 1784333239063 + version epoch-provenance") + Co-Authored-By → push →
   `firebase deploy --only functions`. **Do NOT touch client yet.**
3. **FAIL-CLOSED SERVER-STATE GATE — before ANY client push:**
   - (a) `node audit/deepfix/task6/verify_forced_pathway_epoch.mjs` → MUST exit 0.
   - (b) **DEPLOYED provenance:** probe the live `version` callable → it MUST report `FORCED_PATHWAY_ENABLED=true`
     AND `FORCED_PATHWAY_GRANDFATHER_EPOCH_MS=1784333239063` AND the NEW functions deploy sha.
   - **If ANY of (a)/(b) is wrong / null / mismatched → STOP. Do NOT push the client. Report.** (No harm: the
     client is still pre-P4.)
4. **Only after (a)+(b) pass — client push:** in `src/config/featureFlags.js` flip these 4 to `true`:
   `SERVER_PROGRESS_WRITE`, `SERVER_CHALLENGE_WRITE`, `SERVER_REVIEW_MARKER`, `SERVER_RESET_PROGRESS`. `git add -A`
   → commit on main ("P4/D3: client cutover — route progress/challenge/review-marker/reset to server") → push →
   Netlify. Verify prod `__VOCABOOST_BUILD__` shortSha = new commit, `dirty:false`.
5. **Strengthened post-client smoke** (SANDBOX student, live build) — assert ALL (Codex r20):
   - normal completion via the server path advances `currentStudyDay` + `totalWordsIntroduced` correctly;
   - a throttle/held-review path records `review_recorded` WITHOUT advancing csd/twi;
   - `reviewMode` is written + read back correctly;
   - `advanceForChallenge` does NOT advance a throttle-held day;
   - DSF `dayGuardRejected` recovery does NOT fire on the server path;
   - NO `list_progress` canonical writes occur (LIST_PROGRESS_CANONICAL is still false).

## Reversible
If the smoke shows a real regression, flip the 4 client flags false + push (rollback to pre-P4) + report. SANDBOX
identities only; NEVER 26SM data writes.

## Hand back
Report each deploy sha + the server-state gate results (local + deployed provenance) + the 6 smoke assertions.
Write `docs/plans/loop/win/reviews/winclaude_037.md`; set win baton `turnOwner=claude round=37 execStatus=run-written
execDecision=<DEPLOYED|GATE-BLOCKED|FAILED> updatedBy=winclaude revision=74`.
