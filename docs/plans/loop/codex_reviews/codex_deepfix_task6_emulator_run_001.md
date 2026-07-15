# Codex executor report — DEEPFIX_TASK6_EMULATOR_RUN round 1

Task: run the Firebase-emulator matrices only, no script fixes.
Run id: `emu-r1`.
Project: `demo-vocaboost` emulator.

## Preflight

- `firebase --version`: `14.27.0`, exit `0`.
- `java -version`: OpenJDK Temurin `21.0.9`, exit `0`.
- `node_modules`: root present, `functions/node_modules` present.
- Ports before run: `9099`, `8080`, `5001` free.

## Invocation note

The runbook command with nested quotes is not preserved by Windows PowerShell argument passing. Two initial attempts reached the helper but Firebase logged `Running script: node` only and produced no matrix artifacts. I did not edit the matrix scripts. For the actual runs I used one-line `.cmd` shims so `firebase emulators:exec` received a single child-script path and the unchanged matrices ran:

- `audit/deepfix/task6/run_callable_emu_r1.cmd` -> `node audit/playwright/lsr_deepfix_callable.mjs emu-r1`
- `audit/deepfix/task6/run_rules_emu_r1.cmd` -> `node audit/playwright/lsr_deepfix_rules.mjs emu-r1`

Raw logs for the actual runs:

- M-CALL: `audit/deepfix/task6/m_call_emu_r1_output_cmdshim.txt`
- M-RULES: `audit/deepfix/task6/m_rules_emu_r1_output_cmdshim.txt`

## M-CALL result

Command executed through helper:

```powershell
node audit/playwright/lsr_deepfix_flag_on.mjs --matrix=call --run=emu-r1 --exec "firebase emulators:exec --only functions,firestore,auth --project demo-vocaboost audit\deepfix\task6\run_callable_emu_r1.cmd"
```

Exit code: `1`.

Artifacts written:

- `audit/playwright/findings/deepfix_call_emu-r1.json`
- `audit/playwright/findings/deepfix_call_emu-r1.md`

Matrix summary from JSON/MD:

```text
FINAL: NOT_CLEAN pass=1 fail=20 invalid=0 skip=2
```

Per-scenario rows:

| ID | Verdict | Actual / note |
|---|---:|---|
| CS-1 | FAIL | HTTP 500 INTERNAL |
| CS-1e | FAIL | status=undefined advanced=undefined csd=0 log=false |
| CS-2 | FAIL | rejected=undefined csd=2 log=false sessionCleared=false |
| CS-3 | FAIL | r1=undefined r2=undefined csd=0 twi=0 |
| CS-4a | FAIL | reviewOnly=undefined reasons=undefined wi=undefined twi=40 |
| CS-4b | FAIL | reasons=undefined wi=undefined twi=100 |
| CS-4c | FAIL | reasons=undefined wi=undefined twi=40 |
| CS-5 | FAIL | HTTP 500 INTERNAL |
| CS-6f | FAIL | status=400/FAILED_PRECONDITION log=false notWritten=true |
| CS-6v | FAIL | ok=false written=false anchor_rejected=0 |
| CS-7 | SKIP | secret-backed `gradeTypedTest` deferred |
| CS-8a | PASS | mode=canonical csd=4 twi=60 |
| CS-8b | FAIL | mode=undefined hydrated=undefined canonBefore=false canonAfter=false twi=undefined |
| CS-8c | FAIL | mode=quarantined log=false canonAbsent=true |
| CS-9 | FAIL | HTTP 500 INTERNAL |
| CS-10 | SKIP | grading-job suite deferred |
| CS-11m | FAIL | status=undefined log=false |
| CS-11a | FAIL | status=undefined mismatchLogs=0 |
| OV-1 | FAIL | HTTP 500 INTERNAL |
| OV-2 | FAIL | A=500 B=500 C=403/PERMISSION_DENIED |
| OV-3c | FAIL | HTTP 500 INTERNAL |
| OV-3p | FAIL | HTTP 500 INTERNAL |
| CY-3 | FAIL | ok=false written=false anchor_rejected=0 |

Representative emulator/function errors from raw output:

```text
Unhandled error TypeError: Cannot read properties of undefined (reading 'now')
    at C:\Users\dmchw\vocaboost\functions\foundation.js:1087:41
```

```text
Unhandled error TypeError: Cannot read properties of undefined (reading 'serverTimestamp')
    at Object.writeUpgradedReviewMarker (C:\Users\dmchw\vocaboost\functions\foundation.js:870:45)
```

```text
Trying to access secret GRADE_TOKEN_SECRET@latest
Authentication Error: Your credentials are no longer valid. Please run firebase login --reauth
```

Additional raw-output noise:

- `Unable to fetch the CLI MOTD and remote config`.
- `pauseStaleSessions` ignored because pubsub emulator is not running.
- `The system cannot find the path specified.` appeared after the matrix printed artifacts, before Firebase reported the child script exit code. The matrix still wrote JSON/MD and exited `1`.

## M-RULES result

Command executed through helper:

```powershell
node audit/playwright/lsr_deepfix_flag_on.mjs --matrix=rules --run=emu-r1 --exec "firebase emulators:exec --only firestore,auth --project demo-vocaboost audit\deepfix\task6\run_rules_emu_r1.cmd"
```

Exit code: `0`.

Artifacts written:

- `audit/playwright/findings/deepfix_rules_emu-r1.json`
- `audit/playwright/findings/deepfix_rules_emu-r1.md`

Matrix summary from JSON/MD:

```text
FINAL: CLEAN pass=11 fail=0 invalid=0 skip=0
```

Per-scenario rows:

| ID | Verdict | Actual / evidence |
|---|---:|---|
| RUL-1 | PASS | HTTP 403 |
| RUL-2 | PASS | HTTP 403 |
| RUL-3 | PASS | HTTP 403 |
| RUL-4 | PASS | class_progress=403 list_progress=403 progress_meta=403 |
| RUL-5 | PASS | role=403 profile=200 |
| RUL-6 | PASS | teacher=403 student=200 |
| RUL-7 | PASS | owner=200 teacherStamp=200 teacherClaim=200 stranger=403 |
| RUL-8 | PASS | selfSelect=403 provRead=200 provRole=teacher |
| RUL-9 | PASS | HTTP 403 |
| OV-6w | PASS | HTTP 403 |
| OV-6r | PASS | member=200 unrelated=403 |

Raw-output noise:

- `Unable to fetch the CLI MOTD and remote config`.
- `The system cannot find the path specified.` appeared in stderr after successful matrix completion; final matrix exit remained `0`.

## Flag restore / working tree check

Helper restore messages observed:

- M-CALL: `[flag_on] restored functions/foundation.js`, `[flag_on] restored src/config/featureFlags.js`, `restore complete — flags OFF`.
- M-RULES: `restore complete — flags OFF`.

Direct selected flag-value check after both runs showed all selected deepfix flags back to `false` in:

- `src/config/featureFlags.js`
- `functions/foundation.js`

`git status --porcelain src/config/featureFlags.js functions/foundation.js functions/index.js firestore.rules` after M-RULES still showed a dirty broader working tree:

```text
 M firestore.rules
 M functions/index.js
 M src/config/featureFlags.js
?? functions/foundation.js
```

I am not interpreting or fixing that dirty state; recording it as requested. The helper did not emit a restore-failed banner, and selected flag constants are currently `false`.

## Final executor verdict

- M-CALL: `NOT_CLEAN`, exit `1`.
- M-RULES: `CLEAN`, exit `0`.
- Overall for this executor round: `NOT_CLEAN`; handing back to Claude for diagnosis/fixes.
