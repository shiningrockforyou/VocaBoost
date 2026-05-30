# B09 — Browser Navigation Traps

**Priority:** P0
**Estimated duration:** 45–60 minutes
**Depends on:** B00, B02 (or B03).
**Personas:** Distracted Student, Recovering Student.

## Goal

Browser-level navigation is the most underestimated source of student data loss. Back button mid-test, refresh-then-back-then-forward, "Are you sure you want to leave?" dialogs, tab reopen after close — each of these has a specific failure mode that audit-finding #7 (markIntentionalExit) already half-broke.

## Scenarios

### S01 — Browser refresh: with recovery window open

Already covered in B06 S01 — link, don't duplicate.

### S02 — Browser back during test → click "Don't leave"

1. Begin MCQ. Answer 5 questions.
2. Click browser Back.
3. If beforeunload dialog → click Cancel (stay).
4. Continue answering.
5. Submit. Verify single attempt doc.

### S03 — Browser back during test → "Leave," come back via forward

1. Begin MCQ. Answer 5 questions.
2. Browser Back → "Leave."
3. Browser Forward.
4. Expected: recovery prompt with 5 answers.
5. Resume; submit; verify state.

**Audit suspect:** markIntentionalExit may have been set; Forward navigates back to the test page; wasIntentionalExit returns true; clearTestState wipes recovery. **If reproducible, BLOCKER finding linked to audit #7.**

### S04 — Browser back, navigate to a different page, back to test

1. Begin MCQ. Answer 10 questions.
2. Browser Back. "Leave." Land on dashboard.
3. Navigate to a different list. Then navigate back to the original test via clicking the list card.
4. Expected: depends on whether testRecovery's testId includes the list, but typically the recovery should still apply for the same testId.

### S05 — Browser back DURING a Typed test grading

1. Begin Typed test, type answers, click Submit.
2. While grading is in progress, click browser Back.
3. Expected: confirm dialog ("Leave?"); click Leave.
4. Verify: no zombie grading completes in the background. No attempt doc created.
5. Navigate back to test; recovery prompt with typed answers.

### S06 — beforeunload during submit (in-flight)

1. Begin MCQ. Answer. Click Submit (let it start).
2. Before submit completes, refresh.
3. Expected: confirm dialog appears.
4. Click Leave.
5. After reload: did the submit complete? Was an attempt created? Verify with Firestore snapshot.

### S07 — Tab close mid-typed test (no submit attempted)

1. Begin typed test. Type 10 answers.
2. Close tab via X (or Cmd+W). Confirm leave.
3. Reopen tab, log in same student. Navigate to test.
4. Expected: recovery prompt with 10 typed answers.

### S08 — Tab close mid-submit

1. Begin MCQ. Answer. Submit.
2. Close tab before results screen appears.
3. Reopen. Navigate.
4. Check Firestore: attempt may or may not have completed (depends on timing). If it did, results show. If not, recovery prompt.
5. Expected: no half-state where local recovery is gone but no attempt exists.

### S09 — History.pushState mid-test

1. Begin test.
2. Open devtools, run `history.pushState({}, '', '/dashboard')` to fake a navigation.
3. Without a real page change, the React Router may rerender. Verify no answer loss.

### S10 — Open test in new window via Cmd+click

1. From dashboard, Cmd+click "Start Today's Session."
2. Original tab: still on dashboard.
3. New window: test loads. Begin answering.
4. Submit. Verify single attempt.

### S11 — Two windows of the same test

1. Cmd+click "Start" twice to open two windows of the same session.
2. Window A: answer 3.
3. Window B: answer 5 (different answers).
4. Window A: submit.
5. Window B: submit.
6. Expected: A's submit wins (or B's wins, but only one), no duplicate attempt docs.

**Suspect:** the nonce in localStorage is shared between tabs of the same domain. So both submit with same docId → setDoc overwrites → second submit overwrites first with B's answers. Document this outcome clearly.

### S12 — Open dev URL directly (deep-link)

1. Copy a test URL (`/mcq/<classId>/<listId>?type=new`) from window A.
2. Paste in a fresh tab as anonymous (logged out).
3. Expected: redirect to login.
4. Log in; expected: navigate to the URL OR redirect to dashboard with a hint.

### S13 — Logged-out URL access to deep test link

1. Without logging in, visit `/dashboard`.
2. Expected: redirect to /login.
3. Visit `/mcq/.../.../...`.
4. Same: redirect to /login.

### S14 — Session expires mid-test (auth token)

1. Begin test as student.
2. In devtools, clear Firebase auth: `await firebase.auth().signOut()`.
3. Continue answering.
4. Submit.
5. Expected: clear auth-error UI; recovery preserved; user prompted to log back in.

**Failure → HIGH** if the submit silently fails or the user is confused.

### S15 — Browser autofill mid-test

If the Typed inputs have any autofill behaviour (unlikely but possible if input type allows), exercise it.

### S16 — Print page mid-test

1. Begin test. Trigger Cmd+P.
2. Verify print dialog opens; cancel.
3. Test resumes. No state corruption.

### S17 — Open a link from within test (e.g. accidentally clicking the logo)

1. Begin test. Click the VocaBoost logo (which typically goes to dashboard).
2. If beforeunload guards exist, confirm leaves student on test.
3. If not, document the silent navigation as MEDIUM.

## Severity reminder

S03 / S05 / S07 = HIGH (audit-known). S14 = HIGH. Others MEDIUM/LOW. Crashes = BLOCKER.
