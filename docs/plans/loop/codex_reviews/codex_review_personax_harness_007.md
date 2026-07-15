# Codex review — PERSONAX_HARNESS round 7

## Verdict

NEEDS_FIXES, small manifest-binding patch before the fleet gate certifies.

The launcher now addresses the main round-6 issues:

- stale expected artifacts are cleared before launch,
- per-persona exit codes are preserved,
- missing JSON and nonzero exits fail the manifest,
- only clean `PASS (` counts,
- `PASS-WITH-WARNINGS`, `INCOMPLETE`, `FAIL`, `SKIPPED`, and missing artifacts fail.

That is the right structure. The remaining gap is artifact identity binding inside `lsr_fleet_manifest.mjs`.

## Blocker — manifest does not verify each JSON belongs to this fleet/build/persona

Severity: blocker for certification, small patch.

`lsr_persona.mjs` writes these fields into every persona JSON:

```js
{ runId, buildId: BUILD_ID, persona: PERSONA_ID, ... }
```

But `lsr_fleet_manifest.mjs` currently parses the JSON and only reads:

```js
verdict
confirmedDays
totalDays
```

It does not assert:

- `d.runId === FLEET_RUNID`
- `d.buildId === FLEET_BUILD`
- `d.persona === expected persona id`

The launcher clears stale expected paths, so this is not a likely practical failure in the normal path. But the whole point of the manifest gate is to make a certification artifact self-binding. Without these checks, a copied/misnamed JSON with a clean `PASS (` and exit code `0` could be counted for the wrong persona/build/run.

Required patch:

In `lsr_fleet_manifest.mjs`, after parsing each JSON:

```js
const runOk = d.runId === RUNID;
const buildOk = d.buildId === BUILD;
const personaOk = d.persona === p;
const identityOk = runOk && buildOk && personaOk;
const cleanPass = jsonOk && identityOk && /^PASS \(/.test(verdict) && exitCode === 0;
```

Include the identity booleans in each manifest row so failures are diagnosable.

## Notes

- Continuing to run the manifest after `xargs` returns nonzero is acceptable because the manifest reads every `.rc` and JSON and exits nonzero if anything is missing/non-clean.
- The stable `RUNID=fleet` is acceptable if stale artifacts are cleared up front and the manifest identity checks above are added.
- I could not execute `bash -n` in this Windows-hosted tool context because Bash access was denied, but the script is straightforward. Claude’s reported `bash -n` result can stand.

## VERDICT

NEEDS_FIXES.

Patch the manifest identity checks, then this is GO for the 12-persona fleet gate.
