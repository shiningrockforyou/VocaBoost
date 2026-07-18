# WSL-Claude → WinClaude round 36: FLIP PR-3 LIVE (forced-pathway binary throttle — client)

**Authorized** (David: PR-3 flip autonomous, part of the full-send cutover). PR-3 is Codex-GO'd (r18) + closure-verified.
This flips the **client** binary throttle live. The PR-3 SERVER code is already deployed-dormant (D2, `26cd8ee`);
`FORCED_PATHWAY_ENABLED` (server) stays FALSE until P4. **Reversible** (flip `FORCED_PATHWAY`=false + push).

WSL already set the tree: `FORCED_PATHWAY=true` (featureFlags.js) + grandfather epoch `1784333239063`
(forcedPathway.js). All gates PASS on WSL (epoch verifier exit 0, M-STATIC CLEAN, census SHIP-GATE PASS = PR-1
drain preserved).

## Task
1. **MANDATORY pre-commit gate (Codex r18):** `node audit/deepfix/task6/verify_forced_pathway_epoch.mjs` — it MUST
   exit 0 (`EPOCH GATE: PASS`). If it FAILS, STOP + report — do NOT commit a null/mismatched-epoch flip.
2. Confirm `functions/` has NO uncommitted changes (`git status functions/` clean — already deployed at D2).
3. `git add -A` (stages the client PR-3 source + `FORCED_PATHWAY=true` + epoch + audit/docs; functions/ already
   committed). Commit on `main` (NEVER branch):
   `git commit -m "CS PR-3: activate forced-pathway binary throttle (client) — FORCED_PATHWAY=true + grandfather epoch 1784333239063"` + Co-Authored-By line. Push `origin main` → Netlify.
4. After ~2–4 min verify: prod `window.__VOCABOOST_BUILD__` shortSha == the new commit + `dirty:false`.
5. **Post-flip throttle smoke (best-effort, SANDBOX only):** on the LIVE build, exercise the binary throttle on a
   sandbox student in review-mode — EXPECT **0 new words in review mode** (binary throttle) + a completed review
   **holds the day** (csd not advanced) + good reviews escape the throttle. If you can readily seed/find a
   throttled sandbox student, capture it; if seeding the throttle state is impractical in a single pass, confirm
   the deploy is live + the app loads clean, and note that full throttle-behavior validation is covered by the
   planned post-cutover full-UI prod audits. Do NOT block the flip on the smoke — it's already Codex-GO'd +
   closure-verified; the smoke is confirmatory.

## Reversible
If the post-flip smoke shows the throttle misbehaving on real UI, flip `FORCED_PATHWAY`=false + push (rollback) +
report. SANDBOX identities only; NEVER 26SM writes.

## Hand back
Report the commit sha + push + build-stamp + the smoke result. Write `docs/plans/loop/win/reviews/winclaude_036.md`;
set win baton `turnOwner=claude round=36 execStatus=run-written execDecision=<DEPLOYED|FAILED|BLOCKED>
updatedBy=winclaude revision=72`.
