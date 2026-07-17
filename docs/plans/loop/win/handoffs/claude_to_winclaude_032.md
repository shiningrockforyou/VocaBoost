# WSL-Claude → WinClaude round 32: FLIP PR-1 LIVE (client flags → push → Netlify)

**All PR-1 gates passed** — thank you for r30/r31. This round **activates PR-1 in production** (the 14-stuck-
students fix). David has cleared you for `git push` to `main`. This is a **client hosting deploy** (reversible =
flip the flags back false + push).

## Evidence complete (for the record)
- Codex diff GO (round 12, `codex_review_pr1_002.md`).
- Ship-build census PASS (13/14 drain, `SfEVUpvi` skip→retake, 0 cross-class false-pairs) — real 26SM data.
- dev-E2E r30/r31 PASS: re-entry modal renders (no dead-end) + **flag-ON populates a 60-card playable review /
  flag-OFF empty** (the gating contrast). Deferred: the literal complete→csd-advance → I'll have you drive it in
  the **post-flip prod smoke** (round 33) on the live build.

## Task — flip + commit + push (EXCLUDE functions/)
1. In `src/config/featureFlags.js` set **permanently true**: `REVIEW_PAIRING_V2`, `REENTRY_GUARD`, `RECOVERY_GUARD`.
2. Stage everything EXCEPT the PR-2 functions work (which is still in its own Codex gate):
   ```
   git add -A
   git reset HEAD functions/
   ```
   (Confirm `git status` shows `functions/foundation.js` + `functions/index.js` as NOT staged / still modified —
   they must NOT be in this commit.)
3. Commit (NEVER branch — commit on `main`):
   ```
   git commit -m "CS PR-1: activate review-pairing V2 + re-entry + recovery guards (drains the 14 stuck students)

   Codex r12 GO; ship-build census 13/14 + 0 false-pairs; dev-E2E r31 PASS (re-entry render + 60-card playable review; flag-OFF empty).

   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
   ```
4. `git push origin main` → Netlify auto-builds.
5. After ~2–4 min, verify the deploy landed: navigate `https://vocaboostone.netlify.app`, console-eval
   `window.__VOCABOOST_BUILD__` → EXPECT `shortSha` == your new commit's short sha + `dirty:false`. If the stamp
   is still `4b8452a` after ~5 min, the build hasn't finished — report and I'll wait.

## Hand back
Report the **commit sha**, push result, Netlify build status, and the new prod build-stamp object. Write
`docs/plans/loop/win/reviews/winclaude_032.md`; set win baton `turnOwner=claude round=32 execStatus=run-written
execDecision=<DEPLOYED|FAILED|BLOCKED> updatedBy=winclaude revision=64`. Next (round 33) = the post-flip prod
smoke (complete→advance on a fresh `dup_repro`, single-pass study-loop drive, on the LIVE flipped build).
