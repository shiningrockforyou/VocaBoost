# Codex review — P4/D3 plan, round 21

Verdict: GO.

The round-20 blocker is fixed.

## Checked changes

The telemetry diff is additive and syntax-clean:

- `functions/foundation.js` now exports `FORCED_PATHWAY_GRANDFATHER_EPOCH_MS`.
- `functions/index.js` `version` callable now includes `FORCED_PATHWAY_GRANDFATHER_EPOCH_MS` alongside `FOUNDATION_FLAGS`.
- `node --check functions/foundation.js` passes.
- `node --check functions/index.js` passes.

This gives the deploy gate a live-bundle signal, not just a local working-tree signal.

## Revised order

The revised order is correct:

1. Set server `FORCED_PATHWAY_ENABLED=true` and server epoch `1784333239063`.
2. Redeploy functions only.
3. Before any client push, run both:
   - local `verify_forced_pathway_epoch.mjs`
   - live `version` provenance probe requiring:
     - `FORCED_PATHWAY_ENABLED=true`
     - `FORCED_PATHWAY_GRANDFATHER_EPOCH_MS=1784333239063`
     - expected deploy sha
4. Only after that, push the four P4 client route flags:
   - `SERVER_PROGRESS_WRITE`
   - `SERVER_CHALLENGE_WRITE`
   - `SERVER_REVIEW_MARKER`
   - `SERVER_RESET_PROGRESS`
5. Run the strengthened post-client smoke.

This removes the unsafe window from the prior plan: a bad/mismatched server epoch is now caught while the client is still pre-P4.

## Flag and epoch decisions

Confirmed:

- Server epoch should match the already-live client epoch: `1784333239063`.
- `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED` is already part of the D2/P3 server posture and does not need a P4 client flag.
- Keep `LIST_PROGRESS_CANONICAL`, `ANCHOR_VALIDATION_ENFORCE`, `CYCLING_ENABLED`, and P10 flags false.

## Smoke expectations

The strengthened smoke is sufficient for this cutover plan. It covers the server authority path plus PR-3 server activation:

- normal server completion advances CSD/TWI correctly
- held-review path returns/records `review_recorded` without advancing CSD/TWI
- `reviewMode` persists and is read back
- challenge acceptance does not advance a throttle-held day
- DSF `dayGuardRejected` does not fire on the server path
- no `list_progress` canonical writes while `LIST_PROGRESS_CANONICAL=false`

## Final verdict

GO.

Proceed with the revised two-deploy P4 plan, with the fail-closed live server-state gate between functions redeploy and client cutover.
