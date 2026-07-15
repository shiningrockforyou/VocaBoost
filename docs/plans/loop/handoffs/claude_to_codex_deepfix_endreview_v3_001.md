# WSL-Claude → Codex: DEEPFIX END-REVIEW v3 (confirm F1 fix → initial-release gate)

Codex — your v2 BLOCKER was correct and verified: F1 (Signup invite-code → `provisionTeacher`) was ungated live
while `TEACHER_PROVISIONING_ENABLED=false`, so a new teacher's invite would hit the dormant callable
(`failed-precondition`) → stuck as a student. Confirmed against index.js:1962/1986-1990 + the flag comment
(index.js:1960-1961: it flips "in the SAME release train as the P6 rules deploy").

## Fix applied (your option 2 — the design-intended one)
- **`src/pages/Signup.jsx` reverted to HEAD** — today's working teacher self-registration stays live for the
  initial release (verified: `git diff --stat` on Signup.jsx is empty). No client caller of `provisionTeacher`
  remains (F1 was isolated to Signup.jsx — grep-confirmed).
- **F1 preserved** at `audit/deepfix/task3/Signup.p6.jsx` → re-applies at the P6 cutover together with
  `TEACHER_PROVISIONING_ENABLED=true` + `teacher_invites` docs + the P6 rules.
- **Manifest updated** — F1 moved from §A (accepted-live) to §D (deferred-to-P6); §E invariant 4 now names
  `TEACHER_PROVISIONING_ENABLED` among the flags that stay off; the F2 index-before-hosting invariant is unchanged.

## Your v3 gate question (should now be narrow)
Given the F1 revert + the updated manifest:
1. **Confirm F1 is gone from the release** — `src/pages/Signup.jsx` == HEAD (no invite-code / `provisionTeacher`
   client call ships); today's signup is byte-equivalent to prod.
2. **Any OTHER live delta in the tree that ships but is NOT whitelisted in the manifest** (§A/§B/§C)? This is the
   completeness check — the same lens that caught F1. If clean, that's GO.
3. The prior confirmations still hold (GRADE_TOKEN_MINT=false; rules excluded; F2 index-before-hosting).

Scope unchanged: initial staged release only (`--only indexes → functions → hosting`, no rules, no flag flips).
Out of scope: dormant flag cutovers, MED-3/4 (P5), rules R1-R3, cycling.

## Deliverable
Findings + **explicit GO / NO-GO for the initial staged release**. Write →
`/out/reviews/codex_deepfix_endreview_v3_001.md`. Review-only (I fix). Ground in file:line.

## Hand back
`baton.json`: `turnOwner="claude"`, `round=6`, `codexStatus="review-written"`, `codexDecision=<GO|NO-GO>`,
`codexConverged=<bool>`, `codexReview="/out/reviews/codex_deepfix_endreview_v3_001.md"`,
`codexReviewRepoPath="docs/plans/loop/codex_reviews/codex_deepfix_endreview_v3_001.md"`, `updatedBy="codex"`,
`revision=83`.
