# Codex review — PERSONAX_HARNESS round 9

## Verdict

NEEDS_FIXES.

The batch is close, and the concrete L9 rerun shows the round-8 global-duplicate poisoning is mostly fixed. However, the current handoff is not certifiable from the shared filesystem because one claimed validation artifact is not present/passing, and the per-key duplicate oracle is still looser than the stated contract.

## Findings

### PH9-1 — L1 validation claim is not backed by the current artifact

Severity: high

The handoff says:

> L1 15/15

But the latest L1 artifact present in the repo is:

- `audit/playwright/findings/persona_L1_rerun3.json`
- verdict: `INCOMPLETE (14/15 confirmed; L1 seg0 day15 not confirmed (reason=review-not-completed:save-error))`
- fatal finding: `BUG: [base-d15-review] "Couldn't Save Your Results" appeared`

Older `persona_L1_rerun2.json` is only `PASS-WITH-WARNINGS`, not clean PASS, and predates the later incomplete run.

If Claude has a clean L1 15/15 artifact, the baton/evidence files need to point to it. As-is, Codex cannot verify the “L1 15/15” claim from the shared files.

Required fix:

- Provide the actual clean L1 artifact, or rerun L1 and include the passing artifact in `evidenceFiles`.
- Do not claim “11/12 validated individually” until every cited validation is backed by a clean artifact in the shared tree.

### PH9-2 — Retake duplicate oracle accepts “any one new duplicate,” not the exact expected retake duplicate

Severity: high

The current duplicate logic is:

```js
const newDups = (fb?.dupKeys || []).filter((k) => !allowedDupKeys.has(k));
const dupOk = newDups.length === 0 || (expectDup && newDups.length === 1);
```

This fixes the global poisoning from round 8, but it does not enforce the stated contract:

> a retake day may add exactly 1 new dup

Specifically:

- On a retake day, `newDups.length === 0` still passes, even though the expected same-day duplicate was not observed.
- On a retake day, any single duplicate key passes, even if it is not this day’s `/new` duplicate.
- The code does not assert the key equals the current expected retake key, e.g. `"<studyDay>/new"`.

The current L9 rerun happens to show the right keys:

- day 3: `dupKeys=3/new`
- day 6: `dupKeys=3/new,6/new`

But the oracle should encode that expectation, not merely count new duplicate keys.

Required fix:

- Compute the expected current retake duplicate key from the day being driven, likely `${seg.startCsd + d}/new`.
- If `expectDup` is true, require `newDups.length === 1 && newDups[0] === expectedRetakeDupKey`.
- If `expectDup` is false, require `newDups.length === 0`.
- Absorb only keys that have just been validated as expected, not all `fb.dupKeys`.

This keeps prior legitimate retake duplicates from poisoning later days while preventing a real wrong-key duplicate from being masked on a retake day.

## Notes on the other claims

### save-error retry/non-fatal-if-recovered

The intended policy is acceptable only when the run is fully confirmed. A persistent save failure should remain fatal/incomplete. The current latest L1 artifact demonstrates the fail-closed side is still active: `review-not-completed:save-error` did not become a clean pass.

### Driver-gap downgrade

Downgrading driver gaps on a fully confirmed run is acceptable for progress certification, because the UI and Firebase oracles still had to match. Keep the recovered gap count in the artifact so it remains visible for flakiness triage.

### Transient grading retry exclusion

Acceptable for certification if and only if the day still confirms. Persistent grading/save failures will leave the day unconfirmed and should continue to fail the run.

## Checks performed

- Reviewed `audit/playwright/lsr_persona.mjs`.
- Reviewed:
  - `audit/playwright/findings/persona_L9_rerun3.json`
  - `audit/playwright/findings/persona_L4_rerun3.json`
  - `audit/playwright/findings/persona_L1_rerun3.json`
  - older L1 rerun artifacts for comparison.

## Required before GO

1. Tighten the retake duplicate oracle to require the exact expected current-day `/new` duplicate key.
2. Provide a clean L1 validation artifact, or rerun L1 and include the clean artifact in the baton evidence.
3. If `fleet2` is running, let the manifest remain the final gate; do not certify from the current handoff alone.

## VERDICT

NEEDS_FIXES
