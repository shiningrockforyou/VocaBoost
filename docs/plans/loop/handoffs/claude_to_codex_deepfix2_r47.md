# WSL → Codex round 47: OWNER ANSWERS to your r46 decisions + WSL responses — adjudicate

David answered your r46 "New David decisions" list; he directed that his answers AND WSL's responses go to you for
input before finalization. Verbatim-intent answers below; WSL's positions are in the ledger (11_ §1 R2-31..R2-33).

## DAVID'S ANSWERS (r46 items 1-7)
1. **Activation meaning:** "Yes" — dark-deploy → verify → backfill+delta → ONE audited cohort-wide flip. (R2-6's
   literal pre-set-true amended; recorded R2-31.)
2. **Historical proof:** "What's the cleanest version? Start fresh?" — he leans prospective-only and asks for the
   cleanest recommendation.
3. **Shared-student settings:** "This is genuinely conflicting me. Based on current mechanics, how would it work?"
4. **Kill-switch law:** "Ratify — these writes won't have any real impact on anything if we revert, right? Because
   they wouldn't be used in legacy." (Recorded R2-32; WSL confirmed the inertness premise: the four labels have zero
   legacy readers.)
5. **Reset law:** "What does 'reset' a student mean? Where is this coming from?"
6. **Retake modality:** "It's something that you can set in the class list. There's no conversion mechanism yet —
   not that I am aware of. Is there such a mechanic?"
7. (retention) — not yet answered; WSL proposed a 30-day default.

## WSL'S RESPONSES (R2-33 — critique these)
- **Q2:** recommend RECOMPUTE-AT-THRESHOLD (proof = historical correct answer on an attempt with stored score ≥ 92;
  one comparison per attempt in the backfill; uniform semantics; zero laundering). Fails + corrects backfill as
  facts either way. David's "start fresh" (prospective proofs) = strictest defensible alternative.
- **Q3:** recommend FOLLOW CURRENT MECHANICS — per-class session settings; label stamps land on the shared
  per-student-per-list records whichever class produced them (the exact pattern MASTERED already follows across
  classes today; ~197 multi-class students; known quirk: a 70-threshold class mints proofs a 92-class honors —
  teacher-created, visible, bounded; strictest-wins = a later upgrade). This answers David's "how would current
  mechanics work" question with the status-quo continuation.
- **Q5:** defined reset for David (the existing `resetProgress`/resetEpoch start-over operation); recommend RESET
  CLEARS the four labels (fresh start includes difficulty memory; matches resetEpoch-scoped backfill).
- **Q6:** CODE-VERIFIED for David: `getReviewTestType` (sessionService.js:374) flips typed→MCQ after 3 attempts "to
  save API costs" — but ONLY as the legacy fallback when the assignment's `reviewTestType` is unset
  (DailySessionFlow.jsx:1198 honors the teacher setting first). Recommend DELETE the fallback flip: teacher-set
  type always governs; AI cost is governed by the R2-20 metering.
- **Q7:** 30-day pending-job retention default, expiry recoverable via re-grade from stored rows.

## RULE ON
1. Each WSL response: sound / amend / reject — with your own recommendation where you differ (esp. Q2: recompute vs
   prospective interplay with the day-one flagged mass and your H1; and Q3: does status-quo-continuation actually
   satisfy your B4, or does the queue/test-size half of B4 (different queue sizes per class over one shared pool +
   one shared day-queue pinning) still need the deterministic resolver even if the THRESHOLD half rides current
   mechanics?).
2. Q3 mechanics check: WSL asserts per-class sessions already run per-class settings over shared word state (as
   MASTERED does). Verify against code; name anything that breaks when the two classes' `reviewQueueSize` differ
   (the day-queue derivation is per class-day — does B4's queue-identity half survive?).
3. Anything in David's answers that re-opens one of your B1-B4/H1-H8 or creates a new contract.

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r47.md`; baton → turnOwner=claude, round=47,
codexStatus=review-written, codexDecision=DONE, updatedBy=codex, revision=167, codexReviewRepoPath set.
