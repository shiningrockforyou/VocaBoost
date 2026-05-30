# B23 — Challenge Token Economics

**Priority:** P1
**Estimated duration:** 60–90 minutes
**Depends on:** B00, B02/B03 (need attempts to challenge), B22 (need challenge-to-advance scenarios).
**Personas:** Anxious Student, Trolling Student, Korean Native Typist (whose answers might be unfairly rejected), Power Teacher.

## Why this exists

Chat-log pattern #4 — students hit token-exhaustion states multiple times during the program. The pattern was:

1. Student gets imperfect score (e.g. 17/25, threshold 23).
2. Student raises challenges to bring score up to 23+.
3. Teacher rejects some (legitimately wrong) challenges.
4. Student's token count depletes.
5. Now student is stuck — needs more challenges to pass, but no tokens left.
6. Workaround was always "retake the test" — but if the test grades the SAME answers the SAME way, they hit the same wall.

This batch verifies that tokens are tracked correctly, depletion is handled gracefully, and there's a sane recovery path.

## Token model assumptions

Per the persistence audit and code review:
- Each user gets a fixed budget (default 5 tokens, per `defaultChallenges` schema).
- Each rejected challenge consumes 1 token.
- Accepted challenges either don't cost a token OR refund. (Test which.)
- Tokens replenish on some condition (need to verify — may be daily refill, may be never).

## Scenarios

### S01 — Token starting balance

1. New student account. Log in.
2. Check token balance (from dashboard, settings, or directly via Firestore).
3. Expected: 5 tokens (or whatever the default is — record it).

### S02 — Token consumed on reject

1. Anxious Student, take a Day 1 test, get a few answers wrong.
2. Raise a challenge on one wrong answer.
3. As Power Teacher: reject the challenge.
4. Re-check student token balance.
5. Expected: 4 tokens (one consumed).

**Failure → HIGH** if balance doesn't decrement.

### S03 — Token preserved on accept

1. Same setup but teacher ACCEPTS the challenge.
2. Re-check token balance.
3. Expected: 5 tokens (or some refill policy — verify).

**Failure → MEDIUM** if accepted challenges still consume.

### S04 — Token depletion path

1. Anxious Student takes Day 1, gets 5+ answers wrong.
2. Raises 5 challenges in a row, all on bad-faith answers (clearly wrong).
3. Teacher rejects all 5.
4. Student tries to raise a 6th challenge.
5. Expected: clear "No tokens remaining" UI; raise button disabled OR shows error.

**Failure → MEDIUM** if 6th attempt silently fails or counter goes negative.

### S05 — The stuck state (chat-log pattern)

1. Student takes Day N test, scores 17/25, threshold 23.
2. Raises 5 legitimately wrong challenges, all rejected. Tokens = 0.
3. Student tries to raise a 6th challenge on an answer they BELIEVE is correct.
4. Cannot. Token exhausted.
5. Student takes retake. Same AI grader, similar answers. Same result.
6. Student is stuck.

**Expected resolution:** UI gives a clear path: "Out of tokens. Retake the test." OR "Contact teacher" with a teacher-side override.

**Failure → HIGH** if no resolution path exists in UI. (Workaround is teacher manually advancing, but that's not scalable.)

### S06 — Mass challenge submission

1. Student takes Day 1 test, gets 22 of 25 wrong on purpose.
2. Raises 22 challenges at once (per chat log: "22개를 챌린지를 걸어서 28점으로 만들고나서야").
3. Verify all 22 challenges saved.
4. Verify tokens consumed appropriately (or limited by token budget — if 5-token budget, only 5 challenges allowed).

**Pass criteria:** Either all 22 raised AND 22 tokens consumed (unbudgeted) OR clear cap at the token budget. Either is fine; what's bad is inconsistent (some saved, some lost).

### S07 — Challenge a correct answer (false dispute)

1. Student takes test, all answers correct.
2. Raises a challenge on one correct answer claiming AI was wrong.
3. Teacher rejects (since AI was right).
4. Token consumed.

This tests the legitimate "spurious challenge" path. **Pass criteria:** Reject consumes token.

### S08 — Challenge an already-correct answer (UI gating)

1. Student takes test, all answers correct.
2. UI: should the "raise challenge" option even be available for correct answers?
3. Expected: probably no — the dispute button only appears on wrong answers.
4. If it IS available: token consumed on submit; teacher must reject.

**Pass criteria:** Either gated (preferred) or consistent.

### S09 — Double-click on Raise Challenge

1. Student raises challenge; double-clicks Submit button.
2. Verify single challenge saved (not two), single token consumed.

### S10 — Concurrent challenges in two tabs

1. Tab A: raise challenge on Q1.
2. Tab B (same student, same attempt): raise challenge on Q2.
3. Both submit simultaneously.
4. Verify both saved (different questions, no conflict).
5. Token balance: 5 → 3 (two consumed).

### S11 — Two challenges on the SAME answer in two tabs

1. Tab A: raise challenge on Q1.
2. Tab B: also raise challenge on Q1.
3. Both submit.
4. Expected: second one rejected OR overwrites first (deterministic). Not a double-save.

**Failure → HIGH** if two pending challenges on the same answer (gradebook confused).

### S12 — Teacher accept-driven day advance

1. Student takes Day 3 test, scores 22/25 (just below 23 threshold).
2. Raises 1 challenge.
3. Teacher accepts.
4. Score becomes 23/25 → passes threshold.
5. Verify currentStudyDay advances from 2 to 3.
6. Verify session state transitions per day-advance rules.

**Failure → HIGH** per audit finding #16.

### S13 — Teacher accept after student already moved on

1. Student takes Day 3 test, scores 17/25. Raises 3 challenges (still below threshold even if all accepted).
2. Student gives up, goes home. Next day, retakes Day 3 and passes legitimately. Day advances.
3. Teacher reviews the pending challenges from yesterday. Accepts 2 of 3.
4. Verify: score updates on the original Day 3 attempt. But day is already at Day 4 — should NOT regress to Day 3 or advance to Day 5.

**Failure → HIGH** if day state corrupted.

### S14 — Challenge rejection flips an answer

1. Student takes test. AI marks Q5 as "incorrect."
2. Student raises challenge: claims correct.
3. Teacher reviews: agrees student was correct. Accepts.
4. Verify attempt doc's answers[Q5].isCorrect now true.
5. Score recomputed on the attempt doc.
6. study_states for the Q5 word: timesCorrectTotal incremented (if not already).

### S15 — Multi-challenge accept, score recomputation

1. Student scores 18/25. Raises 5 challenges.
2. Teacher accepts 3, rejects 2.
3. Final score: 21/25.
4. Verify the attempt doc's score updates to 21 (84%).
5. study_states for the 3 accepted-correct words: timesCorrectTotal +1 each (if not already at the cap).

### S16 — Token replenishment (if any)

1. Deplete all 5 tokens.
2. Wait 24h (simulated via Date.now shim).
3. Check token balance.
4. Expected: depends on design. Document the actual behavior.

If no replenishment, document as known limitation; LOW finding if students will face this in practice.

### S17 — Token reset by teacher

If teacher has an override to grant tokens, test it. If not, note that as a possible feature gap.

### S18 — Korean-typing student's high challenge frequency

1. Korean Native Typist takes Typed test, types Korean for every answer.
2. AI may reject many of these.
3. Student raises challenges on all rejected.
4. Teacher accepts most (because Korean was valid).
5. Verify token economy isn't punishing legitimate language barrier disputes.

**Pass criteria:** Korean-typing student can complete tests without burning all tokens. If tokens deplete unavoidably, MEDIUM finding for the team to consider language-aware token policies.

### S19 — Challenge data integrity (audit finding #10)

1. Set up a challenge submission.
2. Stall the network during submission of `submitChallenge`.
3. The function (per audit) writes to user.challenges.history first, then to attempts.answers[i].
4. If the second write fails: token consumed, but dispute not visible to teacher.

**Failure → HIGH per audit.** Verify whether this is still reproducible.

### S20 — Challenge UI state after teacher decision

1. Student raises challenge. Refresh dashboard / test results screen.
2. See "Pending" badge.
3. Teacher accepts.
4. Student refreshes. See "Accepted" badge with updated score.

**Pass criteria:** UI reflects the decision.

## Severity reminder

S05 / S12 / S13 / S15 / S19 = HIGH. S03 / S04 / S06 = MEDIUM. Others LOW unless they cascade.
