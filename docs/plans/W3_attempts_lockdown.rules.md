# W3 — `attempts` rules lockdown (STAGED — apply LAST)

This is the final deploy step of `PLAN_attempt_write_lockdown.md`. It is **intentionally NOT in the live
`firestore.rules`** so that file stays safe to deploy at any time (Codex deploy-risk fix). Apply this block
ONLY after every preceding step is done and validated.

## Preconditions (ALL must hold before applying)
1. Functions deployed: `submitChallenge`, `markReviewComplete`, `submitVocabAttempt`, `gradeTypedTest`.
2. Client flags ON + rebuilt + shipped: `SERVER_CHALLENGE_WRITE = true`, `SERVER_REVIEW_MARKER = true`
   (and `SERVER_ATTEMPT_WRITE` already true).
3. Validated in the 25WT sandbox: challenge submit (callable path), Day-2+ empty-review completion
   (`markReviewComplete`), typed + MCQ submit, progress reset (delete). `data-integrity-sweep` clean.

If any precondition is unmet, deploying this denies the client's fallback writes (challenge submit +
empty-review marker) → broken student flows. (`GRADE_TOKEN_MINT` / `GRADE_TOKEN_ENFORCED` are independent
and can be flipped after this.)

## How to apply
Replace the `match /attempts/{attemptId} { … }` block in `firestore.rules` with the block below, then
`firebase deploy --only firestore:rules`.

```
    // ATTEMPTS — attempt write lockdown (PLAN_attempt_write_lockdown.md W3).
    match /attempts/{attemptId} {
      allow read: if isAuthenticated() && (
        resource.data.studentId == request.auth.uid ||
        resource.data.teacherId == request.auth.uid
      );
      // Server-only create. The Admin-SDK callables bypass rules; this closes the direct
      // forged-create vector (a student could previously create {passed:true} directly).
      allow create: if false;

      // Student `answers`-update branch REMOVED: submitChallenge is now a Cloud Function (W1),
      // so the student no longer writes attempts.answers — closes the answers[].isCorrect forgery
      // (#1c). Teacher-of-record update stays (reviewChallenge is still client-side; the teacher
      // branch + the broad users/{uid}/{subcollection} write are tightened later by the override plan).
      allow update: if isAuthenticated()
        && resource.data.teacherId == request.auth.uid && isTeacher();

      // Students may still delete their own attempts (progress reset) — unchanged.
      allow delete: if isAuthenticated()
        && resource.data.studentId == request.auth.uid;
    }
```

## Rollback
Restore the prior `attempts` block (the version currently in `firestore.rules`) and redeploy rules —
the client fallback paths work again immediately.
