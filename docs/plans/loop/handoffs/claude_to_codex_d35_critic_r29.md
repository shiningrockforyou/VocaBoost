# WSL → Codex round 29: CRITIC PASS on the D3.5 audit plan (completeness-critic convergence)

**This is a "critic pass"** (completeness-critic convergence — see the D3.5 plan's Terminology section): the 5-way
machinery pointed at the plan with the question *"what is MISSING or MIS-SCOPED?"* — NOT "is a fact true." Read-only.

**Read:** `docs/plans/D3.5_RECOVERY_AUDIT_PLAN.md` (the audit plan) + context `docs/plans/MASTER_TASK_LIST.md`.

**Purpose of D3.5:** before the irreversible D4/P5 migration, prove the deployed PR-1/2/3 + D1–D3 cutover fixes recover
July's failure modes — by cloning every ticketed student to sandbox reverted to their exact pre-fix state (Part A2),
adversarially hammering the live UI (Part B), and edge-seeding (Parts A/F). Tier-reweight decided: tiers 1/2
(emulator+live-callable) = fast SERVER-only pre-filter; **tier 3 (live UI) = THE audit** (client-side fixes + "does the
screen advance").

## Your lens: ADVERSARIAL FAILURE-MODE + ASSERTION SOUNDNESS
- **What corruption signature / failure mode / edge is NOT covered** by Parts A/A2/B/F? (You know the completeSession /
  reconciliation / forced-pathway internals — what breaks that no scenario seeds?)
- **Will tier 3 actually catch a client-side regression**, or are there client-side fix behaviors (empty-submit guard,
  retakeThreshold display, re-entry render, modals) whose *assertion* is underspecified / unfalsifiable as written?
- **Scope check:** is any July family mis-classified as "fixed → confirm recovery" when the deployed code doesn't
  actually fix it (or vice-versa)? Cite the code/flag.
- **Pass/fail authority:** is "FAIL on a fixed scenario → STOP+escalate" the right gate, and are the expected-recovery
  outcomes correct per the certified `0ddbb34` behavior?

## Ask
Enumerate **specific missing scenarios / mis-scopings** (each: what's missing + why it matters + which Part to add it to).
If the plan is complete in your lens, say so explicitly.

## Hand back
READ-ONLY. Write `docs/plans/loop/codex_reviews/codex_review_d35_critic_r29.md`; set baton
`turnOwner=claude round=29 codexStatus=review-written codexDecision=<COMPLETE|GAPS-FOUND> codexConverged=<true iff COMPLETE>
updatedBy=codex revision=129 codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_review_d35_critic_r29.md`.
