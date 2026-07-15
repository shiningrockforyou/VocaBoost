# M-CALL — deepfix flag-on emulator probe

- **runId:** `emu-r2`
- **emulator:** project=`demo-vocaboost` firestore=`127.0.0.1:8080` auth=`127.0.0.1:9099` functions=`127.0.0.1:5001`
- **git:** `a967f54` (HEAD `a967f544e0f3d4bce72861ad82a34d8e2ec27206`) dirty=true (328 paths)
- **firestore.rules sha256:** `null`
- **run:** 2026-07-14T12:07:12.161Z

**FLAG-SET (as the emulator loaded it):**
```json
{
  "SERVER_COMPLETE_SESSION_ENABLED": true,
  "SERVER_RESOLVE_LIST_PROGRESS_ENABLED": true,
  "SERVER_RESET_PROGRESS_ENABLED": true,
  "SERVER_ADVANCE_FOR_CHALLENGE_ENABLED": true,
  "LIST_PROGRESS_CANONICAL": true,
  "ANCHOR_VALIDATION_SHADOW": true,
  "ANCHOR_VALIDATION_ENFORCE": true,
  "CYCLING_ENABLED_SERVER": true,
  "SERVER_REVIEW_CHALLENGE_ENABLED": true,
  "SERVER_OVERRIDE_ENABLED": true,
  "TEACHER_IDS_WRITE_ENABLED": true,
  "SERVER_PROGRESS_WRITE": true,
  "SERVER_RESET_PROGRESS": true,
  "SERVER_CHALLENGE_WRITE": true,
  "SERVER_REVIEW_MARKER": true,
  "SERVER_OVERRIDE": true,
  "TEACHER_IDS_READ": true,
  "CYCLING_ENABLED_CLIENT": true,
  "CONTINUATION_LINKS": true,
  "GRADE_TOKEN_ENFORCED": false
}
```

**FINAL: NOT_CLEAN** pass=1 fail=20 invalid=0 skip=2

| | ID | Scenario | Expected | Actual | Verdict |
|---|---|---|---|---|---|
| FAIL | CS-1 | completeSession happy path → canonical csd+1/twi+=alloc/recentSessions | HTTP 200 completed | HTTP 500 INTERNAL | **FAIL** |
| FAIL | CS-1e | completeSession no_evidence block (F-4): no anchor, not review-only ⇒ refuse to advance | status=no_evidence, advanced=false, csd unchanged=0, log complete_session_no_evidence | status=undefined advanced=undefined csd=0 log=false | **FAIL** |
| FAIL | CS-2 | completeSession day-guard reject: stale day ⇒ no advance + day_guard_rejected_session_cleared(uid) | dayGuardRejected=true, csd stays 2, session cleared, log(uid) | rejected=undefined csd=2 log=false sessionCleared=false | **FAIL** |
| FAIL | CS-3 | completeSession idempotent retry: replay committed completion ⇒ already_completed, exactly one +1 | r1=completed, r2=already_completed, csd=1 (not 2), twi=20 (not 40) | r1=undefined r2=undefined csd=0 twi=0 | **FAIL** |
| FAIL | CS-4a | reviewOnlyDay reason1 allocationZero (S3 throttle) ⇒ twi flat, wordsIntroduced=0 | reviewOnlyDay=true allocationZero=true wordsIntroduced=0 twi=40(flat) | reviewOnly=undefined reasons=undefined wi=undefined twi=40 | **FAIL** |
| FAIL | CS-4b | reviewOnlyDay reason2 listComplete (S4/S5 list-end) ⇒ twi flat, wordsIntroduced=0 | listComplete=true wordsIntroduced=0 twi=100(flat) | reasons=undefined wi=undefined twi=100 | **FAIL** |
| FAIL | CS-4c | reviewOnlyDay reason3 reviewStudyResume (S8/#9 already-absorbed) ⇒ twi flat, wordsIntroduced=0 | reviewStudyResume=true wordsIntroduced=0 twi=40(flat) | reasons=undefined wi=undefined twi=40 | **FAIL** |
| FAIL | CS-5 | markReviewComplete W2 upgraded: parseable testId + integer nwsi/nwei == day anchor (pairable) | HTTP 200 marker written | HTTP 500 INTERNAL | **FAIL** |
| FAIL | CS-6f | M4 ENFORCE forged anchor (nwsi≠serverTwi) ⇒ failed-precondition reject + anchor_rejected{enforced}(uid) | HTTP 400 FAILED_PRECONDITION + anchor_rejected{enforced:true,uid} + attempt NOT written | status=400/FAILED_PRECONDITION log=false notWritten=true | **FAIL** |
| FAIL | CS-6v | M4 ENFORCE valid anchor (nwsi==serverTwi, in-allocation) ⇒ silent pass (write lands, no anchor_rejected) | HTTP 200 + attempt written + zero anchor_rejected (false-reject 0) | ok=false written=false anchor_rejected=0 | **FAIL** |
| SKIP | CS-7 | nonce F2 gradeTypedTest attemptDocId in grade return + cached job | response.attemptDocId === bindCtx docId | skipped | **SKIP** |
| PASS | CS-8a | resolveListProgress canonical-first: existing canonical ⇒ mode=canonical, its csd/twi | mode=canonical, csd=4, twi=60 | mode=canonical csd=4 twi=60 | **PASS** |
| FAIL | CS-8b | resolveListProgress straggler hydrate: legacy-only + valid anchor ⇒ create canonical (mode=canonical, hydrated) | mode=canonical hydrated=true; canonical created (twi=20) | mode=undefined hydrated=undefined canonBefore=false canonAfter=false twi=undefined | **FAIL** |
| FAIL | CS-8c | resolveListProgress quarantine: anchorless forged-high-twi ⇒ mode=quarantined + list_progress_quarantined | mode=quarantined + list_progress_quarantined log + NO canonical created | mode=quarantined log=false canonAbsent=true | **FAIL** |
| FAIL | CS-9 | resetProgress: attempts wiped (all classes), session_states cleared, canonical zeroed + resetEpoch/resetAt | HTTP 200 reset | HTTP 500 INTERNAL | **FAIL** |
| SKIP | CS-10 | grading-job recovery suite (dsg-edits/srv_validate/grading_job_tests.mjs) | 7-transition recovery suite green + typed smoke | skipped | **SKIP** |
| FAIL | CS-11m | derivation-mismatch: client reviewOnlyDay disagrees with server ⇒ reviewonly_derivation_mismatch(uid) | completed + reviewonly_derivation_mismatch{client:true,server:false} | status=undefined log=false | **FAIL** |
| FAIL | CS-11a | derivation-agree: client reviewOnlyDay matches server ⇒ NO reviewonly_derivation_mismatch | completed + zero mismatch events | status=undefined mismatchLogs=0 | **FAIL** |
| FAIL | OV-1 | overrideAttempt writes a FULL VALID anchor (nwsi/nwei/wordsIntroduced/testId) + day advances | HTTP 200 override | HTTP 500 INTERNAL | **FAIL** |
| FAIL | OV-2 | override authz union: stamp(A)=allow, enrollment(B)=allow, outsider(C)=permission-denied | A allow / B allow / C denied(403 PERMISSION_DENIED) | A=500 B=500 C=403/PERMISSION_DENIED | **FAIL** |
| FAIL | OV-3c | reviewChallenge new-phase accept near list-end (Day-1 completion): twi CLAMPED at listTotal (not unclamped) | HTTP 200 reviewChallenge | HTTP 500 INTERNAL | **FAIL** |
| FAIL | OV-3p | reviewChallenge review-phase accept: phase gate ⇒ twi UNCHANGED (nwei:null hazard closed) | HTTP 200 reviewChallenge | HTTP 500 INTERNAL | **FAIL** |
| FAIL | CY-3 | lap-aware M4: under cycling, a lap-2 anchor (twi>listTotal) is NOT rejected (anchor_rejected=0) | HTTP 200 + written + anchor_rejected=0 (lap-modular clamp) | ok=false written=false anchor_rejected=0 | **FAIL** |

## Evidence
- **CS-1** (FAIL): {"error":{"message":"INTERNAL","status":"INTERNAL"}}
- **CS-1e** (FAIL): 
- **CS-2** (FAIL): 
- **CS-3** (FAIL): 
- **CS-4a** (FAIL): 
- **CS-4b** (FAIL): 
- **CS-4c** (FAIL): 
- **CS-5** (FAIL): {"error":{"message":"INTERNAL","status":"INTERNAL"}}
- **CS-6f** (FAIL): 
- **CS-6v** (FAIL): 
- **CS-7** (SKIP): DEFERRED: gradeTypedTest is secret-backed (ANTHROPIC_API_KEY + GRADE_TOKEN_SECRET). Provide the emulator secrets/env to realize CS-7.
- **CS-8a** (PASS): 
- **CS-8b** (FAIL): 
- **CS-8c** (FAIL): 
- **CS-9** (FAIL): {"error":{"message":"INTERNAL","status":"INTERNAL"}}
- **CS-10** (SKIP): DEFERRED: grading_job_tests.mjs uses the WEB SDK (Codex: hangs in the Node emulator shell), targets the LIVE prod project, and needs GRADE_TOKEN_SECRET/ANTHROPIC_API_KEY. Run it against the deployed functions per the CS-10 note, not under the emulator.
- **CS-11m** (FAIL): 
- **CS-11a** (FAIL): 
- **OV-1** (FAIL): {"error":{"message":"INTERNAL","status":"INTERNAL"}}
- **OV-2** (FAIL): 
- **OV-3c** (FAIL): {"error":{"message":"INTERNAL","status":"INTERNAL"}}
- **OV-3p** (FAIL): {"error":{"message":"INTERNAL","status":"INTERNAL"}}
- **CY-3** (FAIL): 
