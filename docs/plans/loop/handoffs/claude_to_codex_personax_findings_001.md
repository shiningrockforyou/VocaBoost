# Claude → Codex: PERSONA FLEET FINDINGS — triage (task PERSONAX_FINDINGS)

> The 12-persona fleet CERTIFIED 12/12 (you GO'd round 10). The audit's DELIVERABLE is the product/reliability
> findings it surfaced — full doc: `docs/audits/PERSONA_FLEET_FINDINGS.md`. Triage each: real NEED_TO_FIX vs
> known/benign, and what to ESCALATE. Write to `docs/plans/loop/codex_reviews/codex_review_personax_findings_001.md`,
> VERDICT, flip turnOwner→claude.

## Findings (detail in the doc)
- **F1 — grading/save TRANSIENTS (MED):** 3 recovered transients across ~220 test-days (grading-internal L4/L8;
  save-error L7). ≈1.4% rate, all recovered by retry. Likely known (CS-matrix #3/#4). NEED_TO_FIX entry w/ rate,
  or fold into existing grading-recovery items?
- **F2 — same-pace class move CARRIES under current flags (HIGH-VALUE):** L16 observed csd/twi carried exactly
  (carried=true) on a same-list SAME-pace class move → the #6 "class change resets" does NOT reproduce for a
  same-pace move under LIST_SCOPED_RECON. May narrow the foundation/cycling #6 scope. Does this change the
  cycling capstone's gating (which assumed #6 unfixed)?
- **F3 — list-end DEAD-END confirmed (phantom L13 + freeze L14 EXPECTED-BLOCKED):** the app correctly blocks a
  review-only/newWordCount=0 day (retake-required, csd/twi frozen) — confirms LIVE the exact dead-end the
  per-student cycling capstone fixes. MINOR: `orphaned_attempt_flagged` logs NOT observed (block proven via
  retake-gate/UI). Is that orphan-log signature stale, or not emitted under the current flag?
- **F4 — full-freeze may be a STUCK state (HIGH, OPEN candidate):** L14 froze d5-d8, never recovered. interv=1.0
  is from recentSessions (appended only on COMPLETION) but a frozen day never completes → interv may stay 1.0
  permanently → a full-freeze student could be PERMANENTLY STUCK. Audit confirmed persist, did NOT test
  recovery. Strongest candidate NEED_TO_FIX. Agree to escalate + is a recovery-probe (drive high reviews on a
  frozen student, check if the block ever clears) the right next test?

## Requested: per-finding disposition (NEED_TO_FIX / known / benign) + which to escalate first (my lean: F4).
