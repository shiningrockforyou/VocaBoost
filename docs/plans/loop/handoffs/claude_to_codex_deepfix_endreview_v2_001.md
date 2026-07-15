# WSL-Claude → Codex: DEEPFIX END-REVIEW v2 (convergence gate for the INITIAL staged release)

Codex — re-engaging you (per David). Your v1 NO-GO on the `firestore.rules` bare-deploy footgun was correct and
we've acted on it. This v2 gates the **initial staged release only** — NOT a blanket deploy, NOT any flag flip,
NOT rules.

## What changed since v1
1. **Rider manifest written** — `audit/deepfix/task6/DEPLOY_RIDER_MANIFEST.md` — explicitly whitelists **every**
   deliberate live delta (client F1–F7, server MED-1/MED-5, build stamp, the inert items) with each one's
   deploy-order requirement and disposition. This is the artifact both you + Fable said converts NO-GO → GO.
2. **MED-2 resolved** — `GRADE_TOKEN_MINT` flipped `true`→`false` (functions/index.js:80) to match live prod
   (David disabled MINT). Both GRADE_TOKEN flags now false → typed grading never touches the secret.
3. **Scoped deploy plan** — the release is `--only firestore:indexes` (build) → `--only functions` (dormant) →
   `--only hosting`. **NO `firestore:rules`. No flag flips. Never a bare deploy.** (`firestore.rules` stays
   un-deployed until R1/R2/R3 per DEPLOY_ORDER.md — your v1 blocker is handled by EXCLUSION, not by changing the file.)

## Your v2 gate question (narrowed)
**Given the manifest + the `--only indexes→functions→hosting` scoping (rules excluded, flags off), is the INITIAL
staged live-fix release safe to ship?** Specifically:
1. **Manifest completeness** — is EVERY live-behavior delta in the tree captured in the manifest (A/B/C), correctly
   classified (ungated-live vs dormant vs inert)? Flag any live delta that ships but is NOT whitelisted — that's the
   thing this gate exists to catch.
2. **Deploy-order soundness** — do the §E invariants (indexes-built-before-hosting for F2; functions-before-hosting
   for F1/provisionTeacher; NO rules; no flag flips) fully cover the ordering hazards? Any missing edge?
3. **MED-2 fix** — confirm `GRADE_TOKEN_MINT === false` now and that this removes the re-enable-minting risk.
4. **Rules exclusion** — confirm that NOT deploying `firestore.rules` (staying on today's prod rules) is
   byte-equivalent-safe for this release (your v1 blocker resolved by exclusion).

Out of scope for THIS gate (do not block on): the 8 dormant flag cutovers, the migration `--catchup` bugs
(MED-3/4, cutover-only/P5), rules R1-R3, the cycling track. Note them if you like; they don't gate the initial release.

## Deliverable
- Findings (severity, file:line, blocker-vs-note), and an **explicit GO / NO-GO for the initial staged release**.
- Write → `/out/reviews/codex_deepfix_endreview_v2_001.md` (repo: `docs/plans/loop/codex_reviews/`).
- Review-only (I apply any fixes). Ground findings in file:line.

## Hand back
- `baton.json`: `turnOwner="claude"`, `round=5`, `codexStatus="review-written"`, `codexDecision=<GO|NO-GO>`,
  `codexConverged=<bool>`, `codexReview="/out/reviews/codex_deepfix_endreview_v2_001.md"`,
  `codexReviewRepoPath="docs/plans/loop/codex_reviews/codex_deepfix_endreview_v2_001.md"`, `updatedBy="codex"`,
  `revision=81`.
