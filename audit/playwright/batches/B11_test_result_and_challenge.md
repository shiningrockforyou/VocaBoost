# B11 — Test Result & Challenge Dispute

**Priority:** P1
**Estimated duration:** 45–60 minutes
**Depends on:** B00, B02 or B03 (need a submitted attempt to display/dispute).
**Personas:** Anxious Student (heavy challenger), Careful Student.

## Goal

Results screens render correctly. Challenge submission writes through. Audit-known issues:
- `submitChallenge` has no retry, no transaction (#10).
- Tokens consumed even if dispute write fails.

## Scenarios

### S01 — Results screen displays correctly after Typed test

1. (From B03) Complete a typed test as `anxiousStudent`.
2. Results screen shows: per-question correctness, AI rationale, student response, expected answer.
3. Verify the score percentage matches the attempt doc.

### S02 — Results screen displays correctly after MCQ test

1. Complete MCQ as `carefulStudent`.
2. Results screen lists each question + correct/incorrect + correct answer + student response.

### S03 — Raise a challenge on a graded answer

1. From a Typed test result screen, click "Dispute" or "Challenge" on a question the AI marked wrong.
2. Fill in the dispute message.
3. Submit.
4. Verify: `challengeStatus = 'pending'` on the attempt's answer array.
5. Verify: `users/<student>.challenges.history` gained one entry.
6. Token count decremented from 5 to 4 (or whatever default).

### S04 — Challenge submit fails transiently

1. Set up challenge dispute UI as in S03.
2. Route: submitChallenge endpoint 500s on first call.
3. Click Submit.
4. Expected: clear error UI; click Retry; succeeds.

**Audit-known failure:** no retry exists. So expected outcome is HIGH finding: "Token consumed AND dispute not recorded on transient failure."

### S05 — Challenge tokens exhausted

1. Use up all 5 tokens (5 disputes).
2. Try a 6th. Expected: clear error "No tokens remaining" (or whatever).

### S06 — Challenge an already-disputed answer

1. Submit dispute on Q1 (S03).
2. Try to submit a second dispute on Q1.
3. Expected: validation prevents (or button is disabled).

### S07 — View a challenged answer post-submission

1. After S03 succeeds, navigate away and back to the results screen.
2. The disputed answer shows a "Pending review" badge.

### S08 — Teacher reviews and accepts the challenge (cross-batch, depends on B19)

After B19 accepts the challenge:
1. Student opens results screen.
2. The disputed answer shows "Accepted" status.
3. The test score may be recalculated (audit finding #16 — read-modify-write on attempt doc).

### S09 — Challenge with very long message

1. Dispute message: 1000 characters.
2. Submit.
3. Verify saved completely; teacher can see it.

### S10 — Challenge with special chars in message

1. Dispute message includes emoji, Korean, em-dash.
2. Verify round-trip.

### S11 — Challenge UI under rapid double-click

1. Submit dispute via double-click. Verify single dispute saved.

## Severity reminder

S04 = HIGH (audit). S03 / S08 = HIGH. S05 / S06 = MEDIUM. Others LOW.
