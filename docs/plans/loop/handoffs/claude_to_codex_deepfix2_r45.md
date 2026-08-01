# WSL → Codex round 45: r44-amendment fold verification + the graduation-redesign addendum v2

Two things happened since your r44: (1) your 8 required amendments were folded into the plan of record; (2) David
directed a REVIEW GRADUATION REDESIGN (item-15 resolution candidate), authored as addendum v1, torn down by the
round-4 internal panel (1 Fable + 2 Opus: "not buildable as-is / NO-GO as scoped / not decision-ready" — 5 blockers),
and rebuilt as **v2**. This round is BOUNDED: verify the r44 fold + review the v2 addendum. No teardown of the wave
architecture is sought.

## READ
1. `docs/plans/deepfix2/02_TASK_LIST.md` — v4 as amended: your 8 items (DF2-10 B1/H2-reader-rule/H3-vocabulary/
   M7-stamp/kill-switch contract; DF2-07 no_score boundary; DF2-12 re-card; D-1 client inventory incl. the resolved
   snapshot-writer disposition) + §8 (r44 row, panel row) + §4 item 15 (candidate banner).
2. **`docs/plans/deepfix2/10_REVIEW_GRADUATION_REDESIGN.md` (v2)** — the design under review; v1 at `_archive/` for
   the diff; the panel's full findings are in the workflow record and summarized in §8's panel row.
3. Evidence: `scripts/cs/graduation-validity-probe.mjs` + `evidence/graduation-validity-26SM.json` (907 students;
   STRATIFIED: fill penalty +20.6pp for the <50% band, recovery 21.3% ≈ MCQ chance floor) ·
   `evidence/review-pool-trajectory.mjs` + `review-pool-trajectory-pf.mjs` (the committed policy sim).

## VERIFY (r44 fold)
Each of your 8 amendments, as worded on the cards — flag any that is present-but-not-executable.

## REVIEW (addendum v2) — priorities
1. **B1 coherence**: §2.1's pure day-offset queue — is it genuinely server-re-derivable for `deriveNoScoreEligibility`
   (same (day, pool-snapshot) inputs), and does the pinned-per-day queue close the three-page divergence risk?
2. **Posture scoping**: §2.6's single per-class enablement flag for ALL legs — does it restore D-2 coherence and
   OFF byte-identity? Anything still posture-independent?
3. **Unbundling**: §5's DF2-14 split (DF2-10 ships minimal-D-2 only) — deploy/cert boundaries sound? The S-11 skew
   note (old-bundle any-score graduation during DF2-10's window) — acceptable as carded, or does it need more?
4. **The weak stratum**: escape valve (`review_retake_exhausted`, N=3 default) + lastFailedAt-ASC slots + circuit
   breaker — does this credibly prevent the P-1 deadlock and S-6 divergence, or is more needed before David decides?
5. **Label integrity chain**: §4's preconditions (server-write-only rules clause, mutation bound to attempt-doc
   creation, composition trust, adjudication hook, backfill write-plan + day-1-shock options) — complete? build
   order coherent with W3/D-3/DF2-44?
6. **Evidence honesty**: §1's stratified framing + caveats — faithful to the probe's limits?
7. Rule on the §8 decision list: is it the COMPLETE set David must answer to close item 15, and are the
   recommendations sound?

## RULE
(a) r44 fold: faithful? (b) Is addendum v2 fit to put before David for the item-15 pick (with §8), and what — if
anything — still blocks the eventual DF2-14 carding after his answers? Task-scoped, as always.

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r45.md`; baton → turnOwner=claude, round=45, codexStatus=review-written,
codexDecision=DONE, updatedBy=codex, revision=163, codexReviewRepoPath set.
