# Codex review — RUNS_REVIEWB round 3

## Verdict

GO / CONVERGED-OK.

RB-2 is fixed. The S-1 harness now requires the actual UI paths it claims to test, not just the backend oracle.

## Verification

### Step 3 — B cross-class review is action-gated

The B step now requires:

- `enterSessionOnly(...)` succeeds;
- `skipToTest(...)` succeeds from inside the entered session;
- `driveTest(...)` returns `outcome === "results"`;
- the read-only oracle sees B `class_progress` at `csd=2/twi=40`;
- the B Day-2 review attempt exists with the expected range `20..39`.

This closes the original RB-1 issue. The harness no longer expects a dashboard `Review` CTA in a Phase-1 class-keyed display state.

### Step 4 — A re-entry is now fail-closed

The previous false-green path is closed:

- failed A entry emits a `fail` finding;
- `aReentryClean` requires `out.steps.reenterA.entered === true`;
- the final verdict requires `aReentryClean`.

So the audit can no longer pass from B's data alone while silently skipping the A re-entry UI path.

### Text locator demotion is correct

Demoting the brittle `reviewStudy` / `newWordsOnly` text check to diagnostic is the right call. The stronger gate is the data/action combination:

- B was entered;
- B review test was reached and completed;
- B review attempt exists for Day 2 at the correct anchor range.

That proves the cross-class review path better than a specific UI string.

## Remaining note

B result-page cleanup after the final review test is not required for this S-1 shape because the script does not continue to a later B day. If the scenario is extended, use `returnFromResultsAndClearCompletion` after B's final review result before continuing.

## VERDICT

GO / CONVERGED-OK.
