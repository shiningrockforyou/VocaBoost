# Codex review — PERSONAX_HARNESS round 6

## Verdict

NEEDS_FIXES before launching the fleet.

The harness fixes and smoke evidence are good. I do not see a behavioral blocker in the persona runner itself. The blocker is the fleet launcher: it is not yet fail-closed enough for a 12-persona certification run.

## What is accepted

### B cut

Accepted.

The requested A/B condition was met:

- `persona_L8_L8Boff1.json`: `PASS (6/6 days confirmed across 2 segments)`, warnings 0.
- `persona_L8_L8Boff2.json`: `PASS (6/6 days confirmed across 2 segments)`, warnings 0.

So cutting list-enforcement from `dashReady` is now supported by evidence, not just inference.

### L14 day-6 classification

Accepted.

The modal diagnosis supersedes the product-stuck-state hypothesis for this observed failure. `dismissResumeModal` is now present, and `persona_L14_L14fix.json` shows:

```text
PASS (6/6 days confirmed across 1 segments)
```

with no fatal findings and no driver warnings.

This means L14’s second consecutive blocked day is now harness-handled. Do not record the prior day-6 timeout as confirmed product stuck-state.

### Kept A/C/D

Accepted.

- A remains load-bearing for blocked-day submit.
- C remains useful fail-closed finalization verification.
- D remains useful thin insurance against under-populated typed rows.

Syntax checks passed:

```text
node --check audit/playwright/lsr_persona.mjs
node --check audit/playwright/lsr_ui.mjs
```

## Blocker — fleet launcher is not fail-closed / artifact-safe

Severity: blocker for fleet launch.

`audit/playwright/lsr_fleet.sh` is close, but it currently risks producing ambiguous or stale certification artifacts.

### Problem 1 — stale `persona_<L>_fleet.json` can survive a failed rerun

Every persona uses the same runId:

```bash
node audit/playwright/lsr_persona.mjs "fleet"
```

So outputs are stable paths like:

```text
audit/playwright/findings/persona_L1_fleet.json
```

But the script does not delete old `persona_${p}_fleet.json`, checkpoint, or log files before starting each persona. If a persona crashes before writing a new JSON, a stale prior PASS can remain on disk and be mistaken for the current run.

Required fix:

- Before each persona launch, remove that persona’s stale fleet artifacts:
  - `findings/persona_${p}_fleet.json`
  - `findings/persona_${p}_fleet.checkpoint.json`
  - `findings/fleet_${p}.log`
- Or use a unique fleet run id and a manifest binding all produced artifacts to that id.

### Problem 2 — child failure can be masked by the trailing `echo`

Inside the `xargs` child:

```bash
node audit/playwright/lsr_persona.mjs "fleet" > ... 2>&1
echo "done: $p (...)"
```

Without preserving and exiting with the node status, the shell can return success because the final command is `echo`, even if the persona failed.

Required fix:

```bash
node ... > "$log" 2>&1
rc=$?
echo "done: $p rc=$rc ..."
exit $rc
```

Then the parent script should exit nonzero if any child fails.

### Problem 3 — no final manifest / exact case-set assertion

For a certification fleet, the launcher should emit a small manifest or summary that records:

- fleet run id / build id,
- exact expected personas: `L1-L9,L13,L14,L16`,
- each persona’s JSON path,
- each persona’s exit code,
- each persona’s verdict,
- final `PASS` only if all 12 are clean `PASS`.

This does not need to be elaborate, but it must prevent "11 ran + 1 stale PASS" or "PASS-WITH-WARNINGS counted as PASS".

## Required before GO

Patch `lsr_fleet.sh` so it:

1. clears or uniquely namespaces per-persona fleet artifacts,
2. preserves each `node` exit code,
3. exits nonzero if any persona exits nonzero,
4. writes a final summary/manifest and requires exactly the 12 intended personas,
5. treats only clean `PASS (` as certifying; `PASS-WITH-WARNINGS`, `INCOMPLETE`, `FAIL`, `SKIPPED`, missing JSON, or stale JSON must fail the fleet.

## VERDICT

NEEDS_FIXES.

The runner is ready; the fleet launcher needs fail-closed artifact/exit handling before launch.
