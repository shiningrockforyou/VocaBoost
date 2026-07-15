# Codex end-review v3: initial staged release gate

Verdict for the initial staged release: **GO**

Scope reviewed: v3 F1 fix, rider manifest completeness for live shipping deltas, token flags, and scoped deploy constraints (`firestore:indexes` → `functions` → `hosting`, no rules, no flag flips for deferred tracks).

## Findings

### NIT — token manifest row names MINT, while the diff also disarms ENFORCED

- File/lines:
  - `audit/deepfix/task6/DEPLOY_RIDER_MANIFEST.md:42-43`
  - `functions/index.js:67`
  - `functions/index.js:80`
- Classification: documentation nit, not a release blocker.
- Scenario:
  - The manifest MED-2 row explicitly calls out `GRADE_TOKEN_MINT` being resolved to false.
  - The functions diff also has `GRADE_TOKEN_ENFORCED=false` at `functions/index.js:67`.
  - I am not blocking on this because the code comment says ENFORCED was disarmed to match live prod, and the gate question is live-release safety rather than git-baseline diff completeness. With `GRADE_TOKEN_ENFORCED=false` and `GRADE_TOKEN_MINT=false`, typed grading does not reintroduce token enforcement or minting.
  - If the manifest is intended to be a complete code-diff rider as well as a live-delta rider, add one phrase to MED-2: “both GRADE_TOKEN_ENFORCED and GRADE_TOKEN_MINT are false / match prod.”

## Confirmed checks

### F1 removed from the initial release

- File/lines:
  - `src/pages/Signup.jsx` has no working-tree diff.
  - Remaining `provisionTeacher` client references are only in `audit/deepfix/task3/Signup.p6.jsx:12-17` and the manifest deferral text.
  - `functions/index.js:1962` keeps `TEACHER_PROVISIONING_ENABLED=false`.
  - `functions/index.js:1985-1991` still fail-closes the callable while disabled.
  - `audit/deepfix/task6/DEPLOY_RIDER_MANIFEST.md:27-33` moves F1 out of accepted-live scope.
  - `audit/deepfix/task6/DEPLOY_RIDER_MANIFEST.md:64-67` defers F1 to P6.
  - `audit/deepfix/task6/DEPLOY_RIDER_MANIFEST.md:74` now explicitly keeps `TEACHER_PROVISIONING_ENABLED` off for this release.

The v2 blocker is resolved. The initial release no longer ships a Signup UI that calls the dormant `provisionTeacher` callable.

### Rules exclusion resolves the v1 blocker for this scoped release

- File/lines:
  - `audit/deepfix/task6/DEPLOY_RIDER_MANIFEST.md:12-13`
  - `audit/deepfix/task6/DEPLOY_RIDER_MANIFEST.md:72-74`

The manifest still forbids `firestore:rules` and bare deploys. Under the stated `--only firestore:indexes`, `--only functions`, `--only hosting` sequence, the P10d/P6 `firestore.rules` artifact is not shipped in this initial release.

### MINT risk resolved

- File/lines:
  - `functions/index.js:67`
  - `functions/index.js:80`
  - `functions/index.js:1044-1045`

`GRADE_TOKEN_ENFORCED=false` and `GRADE_TOKEN_MINT=false`. `mintTokens = GRADE_TOKEN_MINT || GRADE_TOKEN_ENFORCED`, so the scoped functions deploy does not add a live `GRADE_TOKEN_SECRET` dependency or return newly minted grade tokens.

### F2 deploy-order invariant remains sound

- File/lines:
  - `audit/deepfix/task6/DEPLOY_RIDER_MANIFEST.md:25`
  - `audit/deepfix/task6/DEPLOY_RIDER_MANIFEST.md:70`

The Name-filter `studentId` query is a live hosting delta, and the manifest correctly requires indexes before hosting.

### No other unwhitelisted live delta found in this pass

I checked the deployable surface against the manifest categories:

- Ungated client live deltas are covered by A: F2-F7, with F1 now deferred.
- Ungated server live deltas are covered by B: gradeTypedTest `attemptDocId`, token flag posture, and `markReviewComplete` upgraded writer while traffic-dormant.
- Build stamp and emulator wiring are covered by C.
- Deferred/dormant work is covered by D/E: client flags off, foundation flags off, `TEACHER_PROVISIONING_ENABLED=false`, no rules deploy.

## Final gate answer

**GO for the initial staged release**, provided the deploy is exactly the scoped sequence in the rider manifest:

1. `firebase deploy --only firestore:indexes`
2. `firebase deploy --only functions`
3. `firebase deploy --only hosting`

No `firestore:rules`, no bare deploy, and no flag flips for the deferred tracks.
