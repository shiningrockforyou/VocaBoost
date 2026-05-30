# B19 — Teacher Challenge Review

**Priority:** P2
**Estimated duration:** 30–45 minutes
**Depends on:** B11 (pending challenges to review).
**Personas:** Power Teacher, Anxious Teacher.

## Goal

Teacher reviews student disputes on AI-graded answers. Accept/reject decisions write through correctly. Audit-known issue: review-driven currentStudyDay advancement is non-transactional.

## Scenarios

### S01 — List pending challenges

1. Teacher navigates to challenges/disputes section.
2. All B11 pending disputes shown.

### S02 — Accept a challenge

1. Click a pending dispute. Modal/page shows: student answer, AI grade, AI rationale, student message.
2. Click Accept.
3. Verify writes:
   - `attempts.answers[i].challengeStatus = 'accepted'`
   - `attempts.score` recalculated (audit-known: read-modify-write)
   - `users/<student>.challenges.history[i].status = 'accepted'`
   - If accepted answer makes total cross retakeThreshold, `class_progress.currentStudyDay` may advance.

### S03 — Reject a challenge

1. Same flow, but click Reject.
2. Verify only `challengeStatus = 'rejected'` and `users/<student>.challenges.history[i].status = 'rejected'`.
3. No score change.

### S04 — Add comment

1. Add a comment when accepting/rejecting.
2. Verify comment saved and shown to student.

### S05 — Cancel review mid-decision

1. Open dispute. Make no decision; click Cancel.
2. Verify no writes.

### S06 — Double-click Accept/Reject

(Audit-flagged) Verify single decision recorded.

### S07 — Two teachers reviewing same dispute

(Audit-flagged) Verify second attempt either errors or is idempotent.

### S08 — Reviewed dispute disappears from pending list

After accept/reject, the dispute should not appear in "pending" again.

### S09 — Review writes under network failure

1. Stall the review-write endpoint.
2. Click Accept. Error appears.
3. Click again. Idempotency: second click doesn't apply twice.

### S10 — Challenge from a student who left the class

1. Setup: student raised dispute, then was removed from class.
2. Verify teacher can still review their pending dispute.

## Severity reminder

S02 = HIGH (audit-flagged cascade writes). S06 / S07 / S09 = HIGH. Others MEDIUM.
