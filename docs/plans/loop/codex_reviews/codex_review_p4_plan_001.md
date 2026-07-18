# Codex review — P4/D3 plan

Verdict: NEEDS_FIXES.

The plan is directionally correct, but the deploy gate is in the wrong place / not strong enough for this cutover. Fix that before execution.

## What is correct

### 1. Sequencing: functions first, client second

Correct.

Because the current client already has `FORCED_PATHWAY=true` and client epoch `1784333239063`, the server must be redeployed with:

- `FORCED_PATHWAY_ENABLED=true`
- `FORCED_PATHWAY_GRANDFATHER_EPOCH_MS=1784333239063`

before the client starts routing progress/challenge/review-marker/reset work to server callables. Otherwise `SERVER_PROGRESS_WRITE=true` could route completions into a server path using the old graduated throttle / no hold-csd behavior.

### 2. Epoch: server epoch must match the client epoch

Correct.

Use the same value: `1784333239063`.

That preserves a single grandfather boundary across client and server completion readers. A later server epoch would over-grandfather reviews created after the client PR-3 flip; a null or mismatched epoch would make client/server completion semantics diverge.

### 3. P4 flag set

The listed P4 client flags are the right set:

- `SERVER_PROGRESS_WRITE`
- `SERVER_CHALLENGE_WRITE`
- `SERVER_REVIEW_MARKER`
- `SERVER_RESET_PROGRESS`

`SERVER_ADVANCE_FOR_CHALLENGE_ENABLED` is already part of the D2/P3 server state, so it does not need a new P4 client flag. Keep `LIST_PROGRESS_CANONICAL`, `ANCHOR_VALIDATION_ENFORCE`, `CYCLING_ENABLED`, and P10 flags false.

## Required fix before GO

### Blocker — move the epoch/server-state gate between deploy 1 and deploy 2

The current plan order is:

1. functions redeploy
2. client push
3. run `verify_forced_pathway_epoch.mjs`
4. post-flip smoke

That is too late. If the functions deploy has the wrong epoch, a null epoch, or did not actually deploy the intended server bundle, the client route would already be live before the verifier catches it.

Required order:

1. Build / inspect the functions artifact that will be deployed.
2. Redeploy functions only.
3. Immediately run a fail-closed server-state gate before any client push:
   - local/static verifier: `node audit/deepfix/task6/verify_forced_pathway_epoch.mjs`
   - deployed provenance/version check proving the live function bundle has:
     - `FORCED_PATHWAY_ENABLED=true`
     - `FORCED_PATHWAY_GRANDFATHER_EPOCH_MS=1784333239063`
     - the expected deploy/build sha or equivalent provenance
4. Only then push the client with the four P4 route flags.
5. Then run the post-client UI smoke.

If the deployed provenance surface does not currently expose the server grandfather epoch, add either:

- epoch exposure to the version/provenance output, or
- a separate fail-closed deploy verifier that reads the deployed source/artifact state.

The local verifier alone is not enough as a deployment gate. It proves the working tree is coherent; it does not prove the live functions bundle serving students is coherent.

## PR-3 soak compression

Acceptable only with the strengthened gate above.

I accept the rationale that David's "audits replace soaks + full-send" allows compressing the pre-P4 PR-3 soak, because:

- PR-3 client is already live with `FORCED_PATHWAY=true`
- PR-3 diff was Codex-GO'd in round 18
- closure verification/census preservation exist
- P4's post-cutover full UI audits become the real soak

But the server half of PR-3 is not actually exercised until P4. That is why the server-state gate must be before the client route flip, and the post-client smoke must include a held-review / reviewMode assertion, not only a normal advancing completion.

## Minimum post-client smoke requirements

The P4 smoke should explicitly assert:

- normal completion through `completeSession` advances `currentStudyDay` and `totalWordsIntroduced` correctly
- throttle/held-review path records `review_recorded` without advancing CSD/TWI
- `reviewMode` is written and read back correctly
- `advanceForChallenge` does not advance a throttle-held day
- DSF `dayGuardRejected` recovery does not fire on the server path
- no `list_progress` canonical writes occur while `LIST_PROGRESS_CANONICAL=false`

## Final verdict

NEEDS_FIXES.

The deploy direction and flag set are right, but revise the plan so the fail-closed epoch/provenance gate runs after the functions redeploy and before the client cutover. Once that is in the plan, I expect this to become GO.
