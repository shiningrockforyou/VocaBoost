# WSL-Claude → WinClaude round 35: D2 / P3 ACTIVATION (functions deploy — first server activation)

**Authorized:** D1 waiver ACCEPTED by David 2026-07-17 → the deepfix cutover is unblocked; David authorized full-send.
This activates the deepfix **P3 server surface** + folds the dormant PR-2-core + PR-3-server code + starts the M4
shadow clock. **Reversible** (flip the flags back + redeploy). It's a code+flag deploy — **NO data writes, NO 26SM
mutation.**

## Task — flip EXACTLY 7 foundation flags, deploy functions, verify
1. In `functions/foundation.js` flip these **7** from `false`→`true`:
   - `SERVER_COMPLETE_SESSION_ENABLED` (:44)
   - `SERVER_RESOLVE_LIST_PROGRESS_ENABLED` (:47)
   - `SERVER_RESET_PROGRESS_ENABLED` (:51)
   - `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED` (:54)
   - `ANCHOR_VALIDATION_SHADOW` (:70) ← starts the M4 shadow clock
   - `REVIEW_ENGAGEMENT_STAMP_ENABLED` (:116) ← PR-2 stamp live
   - `RECOVERY_SCORE_CLAMP_ENABLED` (:122) ← PR-2 >100% clamp live
2. **CONFIRM these stay `false`** (grep to verify — do NOT touch): `LIST_PROGRESS_CANONICAL`, `ANCHOR_VALIDATION_ENFORCE`,
   `CYCLING_ENABLED`, `FORCED_PATHWAY_ENABLED`, `SERVER_REVIEW_CHALLENGE_ENABLED`, `SERVER_OVERRIDE_ENABLED`,
   `TEACHER_IDS_WRITE_ENABLED` (foundation.js); `TEACHER_PROVISIONING_ENABLED`, `TEACHER_CLAIM_ENABLED` (index.js);
   `GRADE_TOKEN_ENFORCED`/`GRADE_TOKEN_MINT` stay false. **Do NOT flip any client flag** — this is functions-only.
3. Pre-deploy: `node --check functions/foundation.js && node --check functions/index.js`.
4. Commit on `main` (NEVER branch) — the functions code (PR-2-core + PR-3-server, both Codex-GO'd) + the 7 flags:
   `git add functions/ && git commit -m "D2/P3: activate deepfix server surface + PR-2 stamp/clamp + start M4 shadow (flip 7 foundation flags)"` + Co-Authored-By line. **Stage only `functions/`** (`git add functions/` — leave the
   client PR-3 diff + docs uncommitted for their own commits). Push `origin main`.
5. `firebase deploy --only functions` (the vocaboost project you're logged into).
6. **VERIFY the activation** (report VERBATIM):
   - **(a)** prod `completeSession` probe (unauth, non-mutating) → it must NO LONGER return
     `FAILED_PRECONDITION: SERVER_COMPLETE_SESSION_ENABLED=false` (the flag is now on; expect a DIFFERENT
     precondition/auth error, e.g. missing-args/unauthenticated — anything but that specific disarm string).
   - **(b)** DG-2 version probe (deployed `exports.version` / FOUNDATION_FLAGS) → confirm the **7 flags report `true`**
     and every must-stay-false flag reports `false`.

## Safety
SANDBOX identities only if any auth is needed; NEVER 26SM data writes (no data touched here). If (a) or (b) shows a
WRONG flag posture, immediately flip the 7 back + redeploy + report — do not leave a half-activated state.

## Hand back
Report the deploy result + the completeSession probe + the DG-2 flag posture (all 9+ flags). Write
`docs/plans/loop/win/reviews/winclaude_035.md`; set win baton `turnOwner=claude round=35 execStatus=run-written
execDecision=<DEPLOYED|FAILED|BLOCKED> updatedBy=winclaude revision=70`.
