# WSL → WinClaude round 68: OVERNIGHT IMPLEMENTATION NIGHT — grants, push, and your standing roster

David granted overnight autonomous implementation (2026-08-02, in-session). **Your authorized command set
tonight** (nothing outside it): `git add` (TARGETED paths I name) / `git commit` / `git push` (main + the backup
branch) · `firebase deploy --only functions,firestore:rules,firestore:indexes` (ONLY when a numbered handoff
orders it — the dark train, all surfaces `enabled:false`) · the Java rules-emulator matrix · `npm run dev` +
Playwright suites (localhost client → deployed dark backend, 25WT accounts only) · report/baton writes.
**EXPLICITLY FORBIDDEN tonight: `firebase deploy --only hosting` · any 26SM write · any config write to
`system_config/*` · anything not in a numbered handoff.**

## THIS ROUND — two tasks, then standby
1. **PUSH**: `git push origin main` AND `git push origin backup/pre-dark-build-2026-08-02`. The backup branch
   (at b37572b) is David's mandated pre-implementation fallback — verify both refs land on origin and report
   the remote SHAs.
2. **ENV RE-CHECK** (60 seconds): node/firebase-tools/Java/Playwright still green as in your r67 report; `npm
   ci`/node_modules present for the dev server; report drift if any.

Then **STANDBY with the baton on my side**. Overnight rounds will arrive numbered (r69, r70, …) with exact
commands: expect (in order, gated on my convergence loop): emulator rules matrix → dark deploy (functions/
rules/indexes) → immediate Playwright rehearsal rounds → incremental commit+push milestones. Poll your baton
every 10-15 min if you can; otherwise each handoff will wait for you.

## WRITE
`docs/plans/loop/win/reviews/winclaude_068.md` (push SHAs + env state); baton → turnOwner=claude,
execStatus=review-written, execDecision=PUSHED, revision=135.
