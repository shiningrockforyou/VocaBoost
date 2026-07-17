# M-CALL — deepfix flag-on emulator probe

- **runId:** `flagon_r27`
- **emulator:** project=`demo-vocaboost` firestore=`127.0.0.1:8080` auth=`127.0.0.1:9099` functions=`127.0.0.1:5001`
- **git:** `4b8452a` (HEAD `4b8452aa7581f2758ec53ee4f3a89f2693122094`) dirty=true (83 paths)
- **firestore.rules sha256:** `null`
- **run:** 2026-07-17T17:01:45.363Z

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

**FINAL: CLEAN** pass=21 fail=0 invalid=0 skip=2

| | ID | Scenario | Expected | Actual | Verdict |
|---|---|---|---|---|---|
| PASS | CS-1 | completeSession happy path → canonical csd+1/twi+=alloc/recentSessions | status=completed, csd=1, twi=20, recentSessions=1 | status=completed csd=1 twi=20 rs=1 | **PASS** |
| PASS | CS-1e | completeSession no_evidence block (F-4): no anchor, not review-only ⇒ refuse to advance | status=no_evidence, advanced=false, csd unchanged=0, log complete_session_no_evidence | status=no_evidence advanced=false csd=0 log=true | **PASS** |
| PASS | CS-2 | completeSession day-guard reject: stale day ⇒ no advance + day_guard_rejected_session_cleared(uid) | dayGuardRejected=true, csd stays 2, session cleared, log(uid) | rejected=true csd=2 log=true sessionCleared=true | **PASS** |
| PASS | CS-3 | completeSession idempotent retry: replay committed completion ⇒ already_completed, exactly one +1 | r1=completed, r2=already_completed, csd=1 (not 2), twi=20 (not 40) | r1=completed r2=already_completed csd=1 twi=20 | **PASS** |
| PASS | CS-4a | reviewOnlyDay reason1 allocationZero (S3 throttle) ⇒ twi flat, wordsIntroduced=0 | reviewOnlyDay=true allocationZero=true wordsIntroduced=0 twi=40(flat) | reviewOnly=true reasons={"allocationZero":true,"listComplete":false,"reviewStudyResume":false} wi=0 twi=40 | **PASS** |
| PASS | CS-4b | reviewOnlyDay reason2 listComplete (S4/S5 list-end) ⇒ twi flat, wordsIntroduced=0 | listComplete=true wordsIntroduced=0 twi=100(flat) | reasons={"allocationZero":false,"listComplete":true,"reviewStudyResume":false} wi=0 twi=100 | **PASS** |
| PASS | CS-4c | reviewOnlyDay reason3 reviewStudyResume (S8/#9 already-absorbed) ⇒ twi flat, wordsIntroduced=0 | reviewStudyResume=true wordsIntroduced=0 twi=40(flat) | reasons={"allocationZero":false,"listComplete":false,"reviewStudyResume":true} wi=0 twi=40 | **PASS** |
| PASS | CS-5 | markReviewComplete W2 upgraded: parseable testId + integer nwsi/nwei == day anchor (pairable) | testId parseable + nwsi/nwei==(20,39) + autoCompleted server marker | testId=vocaboost_test_25WTflagonr27cs5_lsrlistflagonr27cs5_review range=(20,39) writtenBy=cloud-function | **PASS** |
| PASS | CS-6f | M4 ENFORCE forged anchor (nwsi≠serverTwi) ⇒ failed-precondition reject + anchor_rejected{enforced}(uid) | HTTP 400 FAILED_PRECONDITION + anchor_rejected{enforced:true,uid} + attempt NOT written | status=400/FAILED_PRECONDITION log=true notWritten=true | **PASS** |
| PASS | CS-6v | M4 ENFORCE valid anchor (nwsi==serverTwi, in-allocation) ⇒ silent pass (write lands, no anchor_rejected) | HTTP 200 + attempt written + zero anchor_rejected (false-reject 0) | ok=true written=true anchor_rejected=0 | **PASS** |
| SKIP | CS-7 | nonce F2 gradeTypedTest attemptDocId in grade return + cached job | response.attemptDocId === bindCtx docId | skipped | **SKIP** |
| PASS | CS-8a | resolveListProgress canonical-first: existing canonical ⇒ mode=canonical, its csd/twi | mode=canonical, csd=4, twi=60 | mode=canonical csd=4 twi=60 | **PASS** |
| PASS | CS-8b | resolveListProgress straggler hydrate: legacy-only + valid anchor ⇒ create canonical (mode=canonical, hydrated) | mode=canonical hydrated=true; canonical created (twi=20) | mode=canonical hydrated=true canonBefore=false canonAfter=true twi=20 | **PASS** |
| PASS | CS-8c | resolveListProgress quarantine: anchorless forged-high-twi ⇒ mode=quarantined + list_progress_quarantined | mode=quarantined + list_progress_quarantined log + NO canonical created | mode=quarantined log=true canonAbsent=true | **PASS** |
| PASS | CS-9 | resetProgress: attempts wiped (all classes), session_states cleared, canonical zeroed + resetEpoch/resetAt | attempts=0(both classes), session_states cleared, canonical zeroed + epoch stamped | deleted={"attempts":2,"sessionStates":2,"studyStates":0,"classProgress":0} attemptsLeft=0 sessLeft=0 zeroed=true stamped=true | **PASS** |
| SKIP | CS-10 | grading-job recovery suite (dsg-edits/srv_validate/grading_job_tests.mjs) | 7-transition recovery suite green + typed smoke | skipped | **SKIP** |
| PASS | CS-11m | derivation-mismatch: client reviewOnlyDay disagrees with server ⇒ reviewonly_derivation_mismatch(uid) | completed + reviewonly_derivation_mismatch{client:true,server:false} | status=completed log=true | **PASS** |
| PASS | CS-11a | derivation-agree: client reviewOnlyDay matches server ⇒ NO reviewonly_derivation_mismatch | completed + zero mismatch events | status=completed mismatchLogs=0 | **PASS** |
| PASS | OV-1 | overrideAttempt writes a FULL VALID anchor (nwsi/nwei/wordsIntroduced/testId) + day advances | valid anchor written (manual-pass parity) + teacher_override audit log | anchorFields=(80,159) testId=vocaboost_test_25WTflagonr27ov1_lsrlistflagonr27ov1_new passed=true log=true | **PASS** |
| PASS | OV-2 | override authz union: stamp(A)=allow, enrollment(B)=allow, outsider(C)=permission-denied | A allow / B allow / C denied(403 PERMISSION_DENIED) | A=200 B=200 C=403/PERMISSION_DENIED | **PASS** |
| PASS | OV-3c | reviewChallenge new-phase accept near list-end (Day-1 completion): twi CLAMPED at listTotal (not unclamped) | twiIncrement clamped to 5 ⇒ twi=100 (list end), not 115 | twiIncrement=5 twi=100 | **PASS** |
| PASS | OV-3p | reviewChallenge review-phase accept: phase gate ⇒ twi UNCHANGED (nwei:null hazard closed) | review-phase twiIncrement=0 ⇒ twi=40 (unchanged) | advance={"advanced":true,"action":"day_completed","currentDay":2,"twiIncrement":0,"rawNewWordCount":20,"clampedTo":60,"phase":"review"} twi=40 | **PASS** |
| PASS | CY-3 | lap-aware M4: under cycling, a lap-2 anchor (twi>listTotal) is NOT rejected (anchor_rejected=0) | HTTP 200 + written + anchor_rejected=0 (lap-modular clamp) | ok=true written=true anchor_rejected=0 | **PASS** |

## Evidence
- **CS-1** (PASS): wordsIntroduced=20
- **CS-1e** (PASS): 
- **CS-2** (PASS): 
- **CS-3** (PASS): 
- **CS-4a** (PASS): 
- **CS-4b** (PASS): 
- **CS-4c** (PASS): 
- **CS-5** (PASS): 
- **CS-6f** (PASS): 
- **CS-6v** (PASS): 
- **CS-7** (SKIP): DEFERRED: gradeTypedTest is secret-backed (ANTHROPIC_API_KEY + GRADE_TOKEN_SECRET). Provide the emulator secrets/env to realize CS-7.
- **CS-8a** (PASS): 
- **CS-8b** (PASS): 
- **CS-8c** (PASS): 
- **CS-9** (PASS): 
- **CS-10** (SKIP): DEFERRED: grading_job_tests.mjs uses the WEB SDK (Codex: hangs in the Node emulator shell), targets the LIVE prod project, and needs GRADE_TOKEN_SECRET/ANTHROPIC_API_KEY. Run it against the deployed functions per the CS-10 note, not under the emulator.
- **CS-11m** (PASS): 
- **CS-11a** (PASS): 
- **OV-1** (PASS): 
- **OV-2** (PASS): 
- **OV-3c** (PASS): 
- **OV-3p** (PASS): 
- **CY-3** (PASS): 
