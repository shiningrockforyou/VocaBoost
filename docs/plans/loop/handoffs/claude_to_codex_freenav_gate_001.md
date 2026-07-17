# WSL-Claude → Codex: FREE-NAV DESIGN — final hard gate (deepfix-parity rigor)

David is weighing a **direction change**: replace VocaBoost's forced day-progression + intervention throttle with
a **free-navigation** model (study/review anything within your frontier `[0, twi)`; only unreached words `[twi,N)`
gated). Read `docs/design/FREE_NAVIGATION_MODEL.md` **in full** — including the "RIGOR REVIEW (2026-07-16)" section
at the bottom (the verified findings + revised recommendation).

This gate mirrors the deepfix: 3 independent grounded reviewers (feasibility, teacher/pedagogy, migration/data)
already ran + I verified their load-bearing claims against the code AND a live read-only Firestore scan (confirmed:
129 students diverging twi same-list, **27 actively studying in the LOWER-twi class** → naive `max(twi)` corrupts
them; review scheduler `computeUnmasteredSegmentIds` IS `currentStudyDay`; frontier becomes client-forgeable if the
reconciliation self-heal is deleted; security legs welded to the throttle+csd). **You are the final adversarial
gate** before this reaches David as a recommendation.

## Your gate questions
1. **Is the REVISED recommendation sound?** The revised rec is: do NOT do a fast free-nav rebuild; instead the
   **lighter gate** — (a) floor the throttle so newWords never hits 0 (1 line, = NEED_TO_FIX #11's own fix),
   (b) ship Practice Mode v2 (already David-locked) for always-available review, (c) simplify the day incrementally
   (server-derive, retire only the reconciliation complexity) — keeping the teacher pass-contract + pedagogy while
   killing most of the freeze class; free-nav stays the north-star destination via a staged migration if/when
   justified. **Attack this.** Is the lighter gate actually lighter + safe, or does it have its own trap? Is
   "free-nav as north star, lighter gate now" the right call, or is there a better third path?
2. **Did the 3 reviewers + I MISS anything** that changes the decision? Ground any new finding in file:line or the
   deployed state (functions/foundation.js FOUNDATION_FLAGS all false; firestore.rules = undeployed P10d;
   featureFlags.js SERVER_ATTEMPT_WRITE+LIST_SCOPED_RECON live, rest false).
3. **The pivotal product decision** — "does advancing the frontier still require *passing* the segment test at the
   class threshold?" — is it correctly identified as the load-bearing fork? Any other decision that dominates it?

## Deliverable
Findings (severity + file:line/evidence) + an explicit **verdict on the revised recommendation**
(SOUND / SOUND-WITH-CAVEATS / DISAGREE-BETTER-PATH-IS-X). Review-only; ground everything. This is a decision-input
for David, not a code change.
Write → `/out/reviews/codex_freenav_gate_001.md` (repo: `docs/plans/loop/codex_reviews/`). Flip baton → claude.

## Hand back
`baton.json`: `turnOwner="claude"`, `round=7`, `codexStatus="review-written"`, `codexDecision=<verdict>`,
`codexReviewRepoPath="docs/plans/loop/codex_reviews/codex_freenav_gate_001.md"`, `updatedBy="codex"`, `revision=85`.
(You were stood down — David is nudging you to pick this up.)
