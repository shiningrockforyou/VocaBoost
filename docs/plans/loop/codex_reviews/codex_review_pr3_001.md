# Codex review — PR3 forced-pathway diff

Verdict: GO, with flip-checklist caveats.

Scope reviewed:

- `src/utils/forcedPathway.js`
- `src/services/studyService.js`
- `src/services/progressService.js`
- `src/services/db.js`
- `functions/foundation.js`
- `functions/index.js`
- `src/pages/MCQTest.jsx`
- `src/pages/TypedTest.jsx`
- `src/config/featureFlags.js`

## Decision

I do not see a code blocker in the PR3 diff. The implementation is dormant today (`FORCED_PATHWAY=false`, `FORCED_PATHWAY_ENABLED=false`) and the new behavioral paths are gated. The flag-on design is coherent: binary throttle derives from `reviewMode`, held review completions append review outcome without advancing `currentStudyDay`/`totalWordsIntroduced`, and the completion readers reject non-engaged post-epoch reviews symmetrically on client and server.

This is safe to proceed toward flip only if the documented flip checklist is treated as mandatory, especially the grandfather epoch.

## Load-bearing checks

### F1 — reader engagement symmetry

Status: sound.

Client-side `getReviewForDay` and `determineStartingPhase` now both require the same positional pairing plus `isCompletionEngaged(...)` when `FORCED_PATHWAY` is on. The server mirror in `foundation.js:getReviewForDayServer` applies the same additional engagement gate under `FORCED_PATHWAY_ENABLED`.

I specifically checked the candidate-loop behavior. Rejected non-engaged candidates do not prematurely return `none`; the loop continues scanning for a later valid engaged review. With the flag off, the pairing condition remains the existing `reviewPairsWithAnchor` result.

### F2 — hold guard and challenge advance

Status: sound.

The hold-csd path records review outcome without writing `currentStudyDay` or `totalWordsIntroduced`. The challenge advance guard keys off `progress.reviewMode === true`, which is the persisted owner bit for throttle state. That is the right guard for the specific runaway class: a fail-then-pass challenge must not advance a day that the throttle path intentionally held.

Both client and server challenge paths also recompute/persist `reviewMode` when they do advance under the flag, avoiding a stale review-mode bit after an accepted challenge.

### F3 — idempotency

Status: sound.

`recordReviewOutcome` scans recent sessions for the stable `reviewAttemptId`. The test pages pass a stable fallback attempt doc id when the direct write result lacks an id, so the idempotency key should not be absent on normal PR3 review-completion paths.

### Flag-off byte equivalence

Status: sound from code inspection plus build check.

The substantive behavior changes are gated by `FORCED_PATHWAY`/`FORCED_PATHWAY_ENABLED`. The imports themselves do not introduce side effects. With both flags false, the new `reviewMode` fields, held-review branch, binary intervention level, engagement rejection, and challenge hold-guard are dormant.

`npm run build` succeeds. `npm run lint` is not a useful clean signal in this workspace because it reports broad pre-existing noise, but it parsed the changed JSX/service files; I did not see a PR3 parse failure. `node --check` is valid for the `.js` files, but Node rejects `.jsx` by extension, so JSX syntax validation should rely on the Vite build/lint parser rather than `node --check`.

## Caveats / required flip checklist

### High — grandfather epoch must be set in both client and server in the flip commit

`FORCED_PATHWAY_GRANDFATHER_EPOCH_MS` is currently `null` in both:

- `src/utils/forcedPathway.js`
- `functions/foundation.js`

That is correct while dormant, but it is load-bearing at flip. A flag-on build with a null epoch treats all attempts as post-epoch for the engagement reader and can strand legitimate pre-existing completions.

Required flip check:

- client `FORCED_PATHWAY === true`
- server `FORCED_PATHWAY_ENABLED === true`
- client grandfather epoch is a non-null deploy timestamp
- server grandfather epoch is the same non-null deploy timestamp
- the static/deploy verifier should fail closed if either epoch is null or mismatched

I would prefer exposing the server epoch in the same version/introspection surface as `FOUNDATION_FLAGS`; currently `FOUNDATION_FLAGS` includes `FORCED_PATHWAY_ENABLED` but not the epoch. If there is already a separate static assertion that reads `functions/foundation.js`, that is acceptable.

### Medium — server `review_recorded` response has no progress payload

The server hold path returns `status: "review_recorded"` and review metadata, while `recordSessionCompletionViaServer` maps `progress: data.progress || null`. That appears intentional and the current clients do not require an advanced progress object for the held-review result. Still, the behavioral audit should assert the UI does not present an advanced day/words state from stale local progress after a server-side hold.

### Low — `getDayReviewForEngagement` uses the newest day review, not an explicit attempt id

The server completion path infers engagement from the newest review attempt for the day/list/class. In normal sequencing this is the attempt just submitted. In unusual concurrency or retry ordering, a different same-day review could influence hold/advance. This is not a flip blocker because the audit target is normal UI sequencing and held-review behavior is fail-safe relative to over-advancement, but it is worth keeping in the PR3 behavioral matrix if concurrent review retries are in scope later.

## Residuals accepted as non-blocking

- P5 canonical hydration still needs to carry `reviewMode` and apply the engagement gate to `bestCsd`.
- The grandfather epoch remains intentionally unset until the flip commit.

## Final verdict

GO for PR3 as a dormant diff and GO to proceed toward flip with the documented checklist. Do not flip without a machine-checked non-null matching grandfather epoch on client and server.
