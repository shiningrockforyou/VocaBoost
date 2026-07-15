# Codex capability probe — DEEPFIX_TASK6_EMULATOR_PROBE round 1

Verdict: EMULATOR VIABLE ON WINDOWS CODEX

This is a capability probe, not a plan/code review.

## Environment

- Working directory: C:\Users\dmchw\vocaboost
- Firebase CLI: 14.27.0
  - Note: irebase --version prints 14.27.0 but exits nonzero because firebase-tools tries to write/read the local update config store and reports: irebase-tools update check failed ... C:\Users\dmchw\.config.
  - Practical workaround: invoke normally for emulator commands; set CI=true, FIREBASE_CLI_DISABLE_UPDATE_CHECK=true, NO_UPDATE_NOTIFIER=1. Emulator commands still work. CLI also logs a nonfatal MOTD/config fetch certificate warning.
- Java: Temurin OpenJDK 21.0.9 LTS. Firestore emulator accepts it.
- Root 
ode_modules: present.
- unctions/node_modules: present.
- @firebase/rules-unit-testing installed: $hasRulesUnit.

## Firebase config observed

irebase.json defines:

- Auth emulator: 127.0.0.1:9099
- Firestore emulator: 127.0.0.1:8080
- Emulator UI: 4000
- Functions source: unctions
- No explicit functions port; Firebase uses default 127.0.0.1:5001.

## Probe results

### 1. Auth + Firestore emulator startup

Command shape used:

`powershell
$env:CI='true'; $env:FIREBASE_CLI_DISABLE_UPDATE_CHECK='true'; $env:NO_UPDATE_NOTIFIER='1'
node C:\Users\dmchw\AppData\Roaming\npm\node_modules\firebase-tools\lib\bin\firebase.js emulators:exec --debug --only firestore,auth --project demo-vocaboost "cmd /c echo child-ok"
`

Result: PASS.

- Firestore started with cached jar: C:\Users\dmchw\.cache\firebase\emulators\cloud-firestore-emulator-v1.19.8.jar.
- Firestore loaded repo rules from C:\Users\dmchw\vocaboost\firestore.rules.
- Auth started on 127.0.0.1:9099.
- Firestore started on 127.0.0.1:8080, websocket on 9150.
- Child command exited 0; emulators shut down cleanly.

### 2. Functions + Auth + Firestore emulator startup/load

Command shape used:

`powershell
node C:\Users\dmchw\AppData\Roaming\npm\node_modules\firebase-tools\lib\bin\firebase.js emulators:exec --debug --only functions,firestore,auth --project demo-vocaboost "cmd /c echo child-ok"
`

Result: PASS after rerunning sequentially.

Important note: my first functions run was started in parallel with an auth/firestore run and failed with EADDRINUSE on ports 9099/8080. Sequential runs work.

Functions emulator details from irebase-debug.log:

- Uses host 
ode@24.
- Functions source validated and loaded from unctions.
- Runtime initialized with irebase-admin 13.6.0 and irebase-functions 7.0.1.
- Loaded callable/http definitions:
  - submitVocabAttempt
  - markReviewComplete
  - submitChallenge
  - gradeTypedTest
  - getGradingStatus
  - createSession
  - submitTest
  - enameStudent
  - provisionTeacher
  - completeSession
  - esolveListProgress
  - esetProgress
  - dvanceForChallenge
  - eviewChallenge
  - overrideAttempt
  - ersion
- Scheduled pauseStaleSessions is ignored unless the pubsub emulator is included. That is expected if Task 6 does not audit scheduled functions.

Caveats:

- During functions startup, firebase-tools attempts an SDK-version network check and times out (checkFunctionsSDKVersion ... ETIMEDOUT). This was nonfatal; functions still loaded.
- Secret-backed functions (gradeTypedTest uses ANTHROPIC_API_KEY / GRADE_TOKEN_SECRET) may need explicit emulator secret/env handling if a matrix actually invokes them. Loading definitions is OK.

### 3. Callable invocation

I created udit/deepfix/task6/firebase_functions_version_probe.mjs and invoked the authenticated ersion callable under unctions,firestore,auth.

Result: PASS.

Evidence from irebase-debug.log:

- Accepted request POST /demo-vocaboost/us-central1/version --> us-central1-version
- Functions runtime initialized
- Beginning execution of "us-central1-version"
- Callable request verification passed
- Finished "us-central1-version"
- emulators:exec exited 0 on the authenticated rerun.

Unauthenticated call correctly failed because ersion requires equest.auth.

### 4. Admin SDK against emulator

I created udit/deepfix/task6/firebase_emulator_admin_probe.mjs.

Result: PASS.

Output:

`	ext
admin-only-read true true
LASTEXIT=0
`

Admin SDK can seed/read Firestore emulator using the environment provided by emulators:exec.

### 5. Client/rules exercise against emulator

I created udit/deepfix/task6/firebase_emulator_rest_rules_probe.mjs.

Result: PASS for capability; current rules denied the arbitrary probe collection as expected.

Probe flow:

1. Admin SDK seeded probe/adminSeed.
2. Auth emulator created a user via REST (ccounts:signUp) and returned an ID token.
3. Firestore REST read/write attempted with Authorization: Bearer <emulator-id-token>.

Output:

`	ext
admin-seed-ok
auth-signup-status 200
auth-token-present true
client-rest-read-status 403
client-rest-write-status 403
LASTEXIT=0
`

Firestore emulator logged PERMISSION_DENIED: No matching allow statements, proving the request hit the rules engine. This is the recommended lightweight path for M-RULES probes unless you want to add a dedicated rules test package.

The Web SDK smoke (irebase/app, irebase/auth, irebase/firestore) hung and timed out in this Codex shell. I cleaned up the leftover emulator PIDs. I would not base Task 6 on the Web SDK in Node here; use Admin SDK for seeding + Auth REST/Firestore REST for rule assertions, or install/use a dedicated rules testing harness.

## What is runnable

Runnable here:

- M-RULES-style emulator tests using:
  - Admin SDK seed/read bypass;
  - Auth emulator REST user/token creation;
  - Firestore REST requests with bearer token to assert allow/deny.
- M-CALL-style callable probes against local functions emulator, including completeSession, esolveListProgress, esetProgress, etc., provided test data is seeded first.
- Functions load/start validation against current source.

Not yet proven / needs extra setup:

- A true "flag-ON build" if that means changing source constants for SERVER_PROGRESS_WRITE, LIST_PROGRESS_CANONICAL, etc. Current working tree loads, but flags are still code constants. A flag-on emulator matrix needs either:
  - a disposable patch/build that flips constants, then restore; or
  - a code refactor to env-driven flags for emulator-only testing.
- Secret-dependent callable behavior unless emulator secrets/env values are supplied.
- Browser/Web SDK based emulator tests; the Node Web SDK smoke hung in this shell.

## Current cleanup state

After cleanup, no listener was reported on the standard emulator ports at the time checked. Latest port check JSON:

`json

`

## Files created by this probe

- udit/deepfix/task6/firebase_emulator_admin_probe.mjs
- udit/deepfix/task6/firebase_emulator_rest_rules_probe.mjs
- udit/deepfix/task6/firebase_functions_version_probe.mjs

These are small probe artifacts and can be reused or deleted.

## Recommendation for Claude's matrix design

Build Task 6 around this execution model:

1. Use irebase emulators:exec --only functions,firestore,auth --project demo-vocaboost "node <probe>.mjs".
2. Seed fixture data with Admin SDK.
3. For rules assertions, create Auth emulator users via REST, then call Firestore REST with the returned ID token and assert exact status codes.
4. For callable assertions, call functions emulator endpoints directly with callable protocol JSON and Auth emulator bearer tokens.
5. Run probes sequentially, not parallel, unless each gets unique emulator ports/project IDs.
