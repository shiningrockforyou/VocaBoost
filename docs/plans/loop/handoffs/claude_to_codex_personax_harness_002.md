# Claude → Codex: HARNESS CODE round 2 — persona runner fixes (task PERSONAX_HARNESS)

> Folded all 6 r1 findings into `audit/playwright/lsr_persona.mjs`. Verify the fixes hold. Write to
> `docs/plans/loop/codex_reviews/codex_review_personax_harness_002.md`, end with VERDICT (+CONVERGED-OK if
> clean), flip turnOwner→claude.

## Folds
- **PH-1 (blocker) — affirmative block signature.** BLOCKED days (L13/L14): advanceOneDay now DRIVES the review
  submit and returns ok ONLY if `outcome==='retake-gate'` OR a visible retake-required message. Confirm block
  requires `frozen && (retake-gate || uiBlock || orphanDelta>0)`; frozen-alone emits `verify-fail`.
  `blocked-review-not-reached` is now a retryable FAIL (was a false ok:true).
- **PH-2 (blocker) — reconciliation-on-entry.** T2/same-pace now enter a session (enterSessionOnly) + leave
  (leaveSessionViaQuit) to force getOrCreateClassProgress BEFORE `fbState` reads the baseline.
- **PH-3 — fail-closed baseline contracts.** T2: require exact carried csd(=startCsd)/twi(=prevSeg.lastTwi)/0/0
  → INVALID else. fresh/T1/T3: require 0/0/0/0 → INVALID else. **L16 (same-pace-move): RECORDS observed
  carry-or-reset, does NOT assert — REASONED DIVERGENCE:** L16 is the #6 PRE-FIX baseline; its purpose is to
  OBSERVE whether the CURRENT deployed flags (LIST_SCOPED_RECON may already carry same-list moves) carry or
  reset. Asserting exact carry would pre-judge the very thing it audits. Flagging for your view — accept, or do
  you want a two-mode assert (carry-if-recon-live else record)?
- **PH-4 — progress-preservation** now asserts csd AND twi, with classId/listId in the finding.
- **PH-5 — retake** blank attempt must hit `retake-gate` (a `results` outcome now fails the setup).
- **PH-6 — fatal set widened** to console-error/page-error/unexpected-dialog (+ existing). flow-gap/selector-gap
  → surfaced as `PASS-WITH-WARNINGS` (exit 2), not silently dropped. Justification: they already gate per-day
  confirmation (a real one fails the day); making them hard-fatal would fail runs that recovered on retry.

## claimsToCheck
1. Is the PH-1 affirmative-signature set correct + complete (retake-gate / uiBlock / orphan delta)? Any blocked
   path that legitimately shows NONE of these (e.g. empty-review-segment exception) mishandled?
2. PH-2: is enterSessionOnly+leaveSessionViaQuit sufficient to force getOrCreateClassProgress WITHOUT advancing
   csd/twi or writing an attempt (a quit-before-test writes no attempt)? Any risk the forced entry itself
   mutates progress?
3. PH-3 L16 divergence: accept record-not-assert, or require the two-mode assert?
4. PH-6: is PASS-WITH-WARNINGS (exit 2) the right disposition, or should flow-gap be hard-fatal?

## Requested decision: GO / CONVERGED-OK (→ smoke) or NEEDS_FIXES.
