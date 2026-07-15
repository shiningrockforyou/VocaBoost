# Codex executor report — DEEPFIX_TASK6_EMULATOR_RUN round 2

Task: diagnose `firebase-admin` env, optionally run `npm ci`, then rerun M-CALL only. No matrix/code edits.
Run id: `emu-r2`.

## Step 1 — functions firebase-admin diagnosis

Working directory: `functions/`.

Command:

```powershell
npm ls firebase-admin
```

Output:

```text
functions@ C:\Users\dmchw\vocaboost\functions
+-- firebase-admin@13.6.0
+-- firebase-functions-test@3.4.1
| `-- firebase-admin@13.6.0 deduped
`-- firebase-functions@7.0.1
  `-- firebase-admin@13.6.0 deduped

npm_ls_exit=0
```

Command:

```powershell
node -e "const a=require('firebase-admin');console.log('FieldValue',typeof a.firestore.FieldValue,'Timestamp',typeof a.firestore.Timestamp)"
```

Output:

```text
FieldValue function Timestamp function
probe_exit=0
```

Decision per handoff: I did **not** run `npm ci`, because version is `13.6.0` and the probe prints `function function`.

## Step 3 — M-CALL rerun

I reused the round-1 `.cmd` shim approach to avoid Windows nested-quote loss. Shim:

- `audit/deepfix/task6/run_callable_emu_r2.cmd`
- contents: `node audit/playwright/lsr_deepfix_callable.mjs emu-r2`

Command executed through helper:

```powershell
node audit/playwright/lsr_deepfix_flag_on.mjs --matrix=call --run=emu-r2 --exec "firebase emulators:exec --only functions,firestore,auth --project demo-vocaboost audit\deepfix\task6\run_callable_emu_r2.cmd"
```

Raw full stdout+stderr captured at:

- `audit/deepfix/task6/m_call_emu_r2_output_cmdshim.txt`

Exit captured at:

- `audit/deepfix/task6/m_call_emu_r2_exit_cmdshim.txt`

Exit code: `1`.

Artifacts written:

- `audit/playwright/findings/deepfix_call_emu-r2.json`
- `audit/playwright/findings/deepfix_call_emu-r2.md`

## M-CALL emu-r2 summary

```text
FINAL: NOT_CLEAN pass=1 fail=20 invalid=0 skip=2
```

Per-scenario rows from JSON/MD:

| ID | Verdict | Actual / evidence |
|---|---:|---|
| CS-1 | FAIL | HTTP 500 INTERNAL; `{"error":{"message":"INTERNAL","status":"INTERNAL"}}` |
| CS-1e | FAIL | status=undefined advanced=undefined csd=0 log=false |
| CS-2 | FAIL | rejected=undefined csd=2 log=false sessionCleared=false |
| CS-3 | FAIL | r1=undefined r2=undefined csd=0 twi=0 |
| CS-4a | FAIL | reviewOnly=undefined reasons=undefined wi=undefined twi=40 |
| CS-4b | FAIL | reasons=undefined wi=undefined twi=100 |
| CS-4c | FAIL | reasons=undefined wi=undefined twi=40 |
| CS-5 | FAIL | HTTP 500 INTERNAL; `{"error":{"message":"INTERNAL","status":"INTERNAL"}}` |
| CS-6f | FAIL | status=400/FAILED_PRECONDITION log=false notWritten=true |
| CS-6v | FAIL | ok=false written=false anchor_rejected=0 |
| CS-7 | SKIP | secret-backed gradeTypedTest deferred |
| CS-8a | PASS | mode=canonical csd=4 twi=60 |
| CS-8b | FAIL | mode=undefined hydrated=undefined canonBefore=false canonAfter=false twi=undefined |
| CS-8c | FAIL | mode=quarantined log=false canonAbsent=true |
| CS-9 | FAIL | HTTP 500 INTERNAL; `{"error":{"message":"INTERNAL","status":"INTERNAL"}}` |
| CS-10 | SKIP | grading-job suite deferred |
| CS-11m | FAIL | status=undefined log=false |
| CS-11a | FAIL | status=undefined mismatchLogs=0 |
| OV-1 | FAIL | HTTP 500 INTERNAL; `{"error":{"message":"INTERNAL","status":"INTERNAL"}}` |
| OV-2 | FAIL | A=500 B=500 C=403/PERMISSION_DENIED |
| OV-3c | FAIL | HTTP 500 INTERNAL; `{"error":{"message":"INTERNAL","status":"INTERNAL"}}` |
| OV-3p | FAIL | HTTP 500 INTERNAL; `{"error":{"message":"INTERNAL","status":"INTERNAL"}}` |
| CY-3 | FAIL | ok=false written=false anchor_rejected=0 |

Representative runtime errors still present in full raw log:

```text
Unhandled error TypeError: Cannot read properties of undefined (reading 'now')
    at C:\Users\dmchw\vocaboost\functions\foundation.js:1087:41
```

```text
Unhandled error TypeError: Cannot read properties of undefined (reading 'serverTimestamp')
    at Object.writeUpgradedReviewMarker (C:\Users\dmchw\vocaboost\functions\foundation.js:870:45)
```

```text
Unhandled error TypeError: Cannot read properties of undefined (reading 'serverTimestamp')
    at C:\Users\dmchw\vocaboost\functions\index.js:474:47
```

Secret/noise lines still present:

```text
Trying to access secret GRADE_TOKEN_SECRET@latest
Authentication Error: Your credentials are no longer valid. Please run firebase login --reauth
```

```text
The system cannot find the path specified.
```

The matrix still emitted artifacts and Firebase reported the shim child exited with code `1`.

## Flag restore check

Helper restore messages observed:

```text
[flag_on] restored functions/foundation.js
[flag_on] restored src/config/featureFlags.js
[flag_on] restore complete — flags OFF, working tree reverted to pre-apply state.
```

Selected flag constants after run are `false` in both files:

- `src/config/featureFlags.js`: `SERVER_CHALLENGE_WRITE`, `SERVER_REVIEW_MARKER`, `CONTINUATION_LINKS`, `SERVER_PROGRESS_WRITE`, `CYCLING_ENABLED`, `SERVER_RESET_PROGRESS`, `SERVER_OVERRIDE`, `TEACHER_IDS_READ` all `false`.
- `functions/foundation.js`: `SERVER_COMPLETE_SESSION_ENABLED`, `SERVER_RESOLVE_LIST_PROGRESS_ENABLED`, `SERVER_RESET_PROGRESS_ENABLED`, `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED`, `LIST_PROGRESS_CANONICAL`, `ANCHOR_VALIDATION_SHADOW`, `ANCHOR_VALIDATION_ENFORCE`, `CYCLING_ENABLED`, `SERVER_REVIEW_CHALLENGE_ENABLED`, `SERVER_OVERRIDE_ENABLED`, `TEACHER_IDS_WRITE_ENABLED` all `false`.

`git status --porcelain src/config/featureFlags.js functions/foundation.js functions/index.js firestore.rules` after run:

```text
 M firestore.rules
 M functions/index.js
 M src/config/featureFlags.js
?? functions/foundation.js
```

No helper restore-failed banner was emitted. I am recording the dirty status exactly, not interpreting/fixing it.

## Final executor verdict

- `npm ci`: not run, because pre-diagnosis showed pinned `firebase-admin@13.6.0` and `FieldValue function Timestamp function`.
- M-CALL emu-r2: `NOT_CLEAN`, exit `1`.
- M-RULES was not rerun per handoff; prior emu-r1 result remains CLEAN.
- Overall round-2 executor result: `NOT_CLEAN`; handing back to Claude.
