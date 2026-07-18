# M-RULES — deepfix flag-on emulator probe

- **runId:** `cert-59df732-r34`
- **emulator:** project=`demo-vocaboost` firestore=`127.0.0.1:8080` auth=`127.0.0.1:9099` functions=`127.0.0.1:5001`
- **git:** `59df732` (HEAD `59df732657dfb742d4392a47ae5c1d988377387a`) dirty=true (45 paths)
- **firestore.rules sha256:** `752981b78f532ebd737c521920a034038380c228aa6305844dc4f17fcde1aca9`
- **run:** 2026-07-17T20:19:17.981Z

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

**FINAL: CLEAN** pass=11 fail=0 invalid=0 skip=0

| | ID | Scenario | Expected | Actual | Verdict |
|---|---|---|---|---|---|
| PASS | RUL-1 | student direct attempt-create (forged passed:true,score:100) ⇒ PERMISSION_DENIED | HTTP 403 | HTTP 403 | **PASS** |
| PASS | RUL-2 | student answers-update on OWN attempt ⇒ PERMISSION_DENIED (update:false) | HTTP 403 | HTTP 403 | **PASS** |
| PASS | RUL-3 | owner attempt-delete ⇒ PERMISSION_DENIED (delete:false — C-31 anchor-erasure closed) | HTTP 403 | HTTP 403 | **PASS** |
| PASS | RUL-4 | client progress writes to class_progress + list_progress + progress_meta ⇒ all PERMISSION_DENIED | all three HTTP 403 | class_progress=403 list_progress=403 progress_meta=403 | **PASS** |
| PASS | RUL-5 | M8 role split: role-update ⇒ DENIED; displayName-update (no role key) ⇒ ALLOWED | role=403, profile=200 | role=403 profile=200 | **PASS** |
| PASS | RUL-6 | self-create role:teacher ⇒ DENIED; role:student ⇒ ALLOWED (fresh sandbox uids) | teacher-create=403, student-create=200 | teacher=403 student=200 | **PASS** |
| PASS | RUL-7 | happy reads: owner reads own attempt(200), teacher-of-record reads(200), teacher-claim reads list_progress(200) | owner=200, teacher-stamp=200, teacher-claim=200, stranger=403 | owner=200 teacherStamp=200 teacherClaim=200 stranger=403 | **PASS** |
| PASS | RUL-8 | signup: client self-select teacher ⇒ DENIED; provisioning (Admin) yields role:teacher (readable) | self-select=403; provisioned teacher role:teacher + readable(200) | selfSelect=403 provRead=200 provRole=teacher | **PASS** |
| PASS | RUL-9 | M4 composite (rules arm): forged-anchor client attempt-create ⇒ DENIED (callable-clamp arm = CS-6) | HTTP 403 (create denied) | HTTP 403 | **PASS** |
| PASS | OV-6w | P10d narrowing: outsider-teacher direct write to student study_states ⇒ DENIED (write narrowed isTeacher→isOwner) | HTTP 403 | HTTP 403 | **PASS** |
| PASS | OV-6r | P10c additive read: teacher listed in attempt.teacherIds ⇒ READ ALLOWED; unrelated teacher ⇒ DENIED | teacherIds-member read=200, unrelated teacher read=403 | member=200 unrelated=403 | **PASS** |

## Evidence
- **RUL-1** (PASS): attempts allow create: if false
- **RUL-2** (PASS): attempts allow update: if false
- **RUL-3** (PASS): attempts allow delete: if false
- **RUL-4** (PASS): users subcollection write excludes the 3 progress collections
- **RUL-5** (PASS): update: isOwner && !affectedKeys.hasAny([role,roleProvisioning])
- **RUL-6** (PASS): create: isOwner && (no role \|\| role==student)
- **RUL-7** (PASS): 
- **RUL-8** (PASS): 
- **RUL-9** (PASS): RUL-1 create:false starves the forged anchor; CS-6 M4-clamps the callable path — composite closes both.
- **OV-6w** (PASS): subcollection write: !(progress) && isOwner — teacher breadth dropped (P10d)
- **OV-6r** (PASS): attempts read: studentId== \|\| teacherId== \|\| (teacherIds in data && uid in teacherIds)
