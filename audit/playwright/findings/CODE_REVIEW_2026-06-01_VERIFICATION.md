# Verification of CODE_REVIEW_2026-06-01.md (other Claude/Sonnet session)

**Verdict: MIXED + substantially unreliable.** Several findings are real (and overlap what this audit + Codex already found), but the specifics in many are FALSE in ways that show the review was written largely from assumptions/templates, not from reading the actually-deployed code. Treat it as leads to verify, not findings.

## Two hard contradictions that undermine its credibility
1. **C2 / C4 / H7 assume the grader is OpenAI.** It is NOT. `functions/index.js` uses the **Anthropic SDK** (`require("@anthropic-ai/sdk")`, `defineSecret("ANTHROPIC_API_KEY")`, model `claude-haiku-4-5-20251001`). So C4 ("reads process.env.OPENAI_API_KEY", "unhandled error exposing stack") is FALSE — it uses defineSecret and a try/catch returning a generic error.
2. **C1 quotes a rule that isn't in the file.** C1 claims `match /users/{userId}/{document=**} { allow read, write: if isAuthenticated() }`. The actual `firestore.rules` scopes WRITES to `request.auth.uid == userId`. So "a student can OVERWRITE classmates' scores" is FALSE.

## Per-finding verdict
| ID | Claim | Verdict |
|----|-------|---------|
| C1 | Cross-student data access | **MOSTLY FALSE (corrected after reading the real 192-line rules).** Cross-student WRITE by a STUDENT = FALSE (subcollection writes require isOwner). study_states/class_progress/attempts READ = properly scoped (isOwner||isTeacher; class_progress collection-group is teacher-only). The ONLY real bit: the `/users/{userId}` PROFILE doc is `allow read: if isAuthenticated()` → any authed user can read any profile (name/email/stats) — a minor privacy issue. A TEACHER can write any student's subcollections regardless of class (real, but **already has a TODO(security) in the rules** to move reviewChallenge to a Cloud Function). NOTE: no rules-file corruption — that was a retracted false alarm. |
| C2 | Grading: no auth, no rate limit | **HALF-REAL.** "No auth" = FALSE (`if (!request.auth) throw`, line 77). "No rate limiting" = TRUE. "No enrollment check" = TRUE. The cost-abuse concern is legitimate; the auth claim is wrong. |
| C3 | completeSession double-counts days | **MOSTLY FALSE.** `updateClassProgress` (progressService.js:332) has an `expectedDay` guard that returns unchanged if day != currentStudyDay+1; attempt docId is deterministic (dedup). Speedrunner test already showed 0 duplicate attempts under rapid double-submit. A targeted idempotency test is fair, but "no guard" is wrong. |
| C4 | OpenAI key handling unsafe | **FALSE** (wrong vendor; uses defineSecret + generic error catch). |
| H1 | Gradebook loads all attempts | **PARTIALLY PLAUSIBLE.** `queryTeacherAttempts` (db.js ~1728) has server-side filtering + pagination, so "no pagination" is likely FALSE — but Gradebook.jsx's actual usage needs a look. Real perf check, overstated claim. |
| H2 | No validation on word definitions | **PLAUSIBLE/minor** (teacher-side; likely true). |
| H3 | Retry logic loses writes | **SPECULATIVE/unverified** (vague; processTestResults uses writeBatch = atomic). |
| H4 | localStorage recovery no validation | **PARTIALLY FALSE** — `testRecovery.js` has `validateTestState`. Some validation exists; robustness worth checking. |
| H5 | Forge attempt doc / no replay protection | **REAL but SELF-ONLY (severity MEDIUM, corrected).** Attempt docs are top-level `/attempts/{id}`, `create if request.resource.data.studentId == request.auth.uid` — a student can forge their OWN attempt with any score, and write their OWN `users/{uid}/study_states` (isOwner). But ONLY their own data — they cannot affect classmates. So it's self-cheating (inflate own mastery/gradebook row), not a cross-user breach. Worth tightening (server-authoritative scoring like the AP side already does via `create: if false`), but not the HIGH "overwrite others" framing. |
| H6 | Teacher dashboard N+1 | **PLAUSIBLE** — needs TeacherDashboard.jsx confirmation (file existence not yet verified). |
| H7 | Prompt injection in grading | **TEST-WORTHY, unverified.** Student answers are interpolated; the grader uses a system-prompt + structured JSON which gives some resistance. Not tested for explicit "ignore instructions" injection. Worth an adversarial probe (extends GRADE2/REALGRADE). |

## Net
- **Genuinely actionable (mostly overlap prior findings):** C1-read (cross-student reads), C2 (rate-limit + enrollment on grading), H5 (client-side attempt forgery), H1/H6 (teacher perf), H2 (input validation), H7 (injection probe).
- **Wrong/overstated:** C3, C4, the write-access half of C1, the "no auth" half of C2.
- It adds little NEW beyond Codex + this audit except: explicit **rate-limiting/cost-abuse** on the grader, **prompt-injection** testing, and **teacher-page performance** — all worth folding into the campaign.
