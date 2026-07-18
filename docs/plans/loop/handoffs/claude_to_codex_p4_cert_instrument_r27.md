# WSL → Codex round 27: sign off the P4/D3 behavioral certification INSTRUMENT (approach-1)

**Convergence is CLOSED (5/5, GO-HOLD).** We are now executing the one open gate: **behaviorally certify D3/P4** via
approach-1. This round is your **cert-instrument sign-off** — the "cert-instrument amendment" all 5 parties named as the
precondition to WinClaude running it. Review-only; no deploy.

**Read:** `docs/plans/loop/P4_CERT_INSTRUMENT_approach1.md` (the full instrument). Context: `docs/plans/MASTER_TASK_LIST.md`
§4 + `docs/plans/loop/CONVERGENCE_REPORT_v4.md`.

## Sign-off ask (confirm each; cite the instrument)
- **(a)** The flag set in the instrument == the LIVE `0ddbb34` posture (`FORCED_PATHWAY_ENABLED=true`, epoch
  `1784333239063`, 7 D2 flags true, `LIST_PROGRESS_CANONICAL=false`, `ANCHOR_VALIDATION_ENFORCE=false`).
- **(b)** The 6 assertions + the grandfather-epoch-boundary cases in assertion #2 adequately exercise the forced-pathway
  **hold-csd** branch the cutover activated (the exact C4 gap). If anything is missing to truly certify it, say what.
- **(c)** The `0ddbb34`-pinning + sha-stamp requirement is sufficient to avoid the r34 baseline-drift failure mode.
- **(d)** The pass criteria (all 6 green = CERTIFIED; any fail = STOP+escalate+rollback-candidate) are correct.

## Hand back
READ-ONLY. Write `docs/plans/loop/codex_reviews/codex_review_p4_cert_instrument_r27.md`; set the Codex baton
`turnOwner=claude round=27 codexStatus=review-written codexDecision=<GO|NEEDS-FIXES> codexConverged=<true iff GO>
updatedBy=codex revision=125 codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_review_p4_cert_instrument_r27.md`.
If NEEDS-FIXES, enumerate exactly what the instrument must add/change before WinClaude runs it.
