# Codex ↔ Claude long-turn review protocol

Purpose: run one extended Codex session where Claude prepares plan/review artifacts, Codex waits for them, verifies them, writes a response markdown, then waits for Claude again. This works as a bounded foreground wait loop, not as a background self-wake system.

## What Codex can do in this session

Codex can:

- wait in the current turn for a bounded time, e.g. 5–6 minutes;
- poll a baton file or done file while waiting;
- continue immediately in the same turn when the file changes;
- read Claude’s plan, evidence, diffs, logs, and verification results;
- independently inspect repository files;
- run safe local checks when appropriate;
- write a review markdown for Claude;
- update the baton to hand control back to Claude;
- repeat this cycle while the current Codex turn remains active.

Codex cannot:

- wake itself after the Codex turn has ended;
- receive a background notification from a detached watcher;
- run an indefinite watcher safely;
- automatically resume if Claude takes longer than the bounded wait;
- guarantee progress if the baton is malformed or Claude does not write the expected files.

The key operating rule:

```text
Codex must not send a final answer while the loop is active.
Codex waits in foreground for bounded intervals, then continues in the same turn.
```

## High-level workflow

1. Claude writes or updates a plan.
2. Claude runs its own verification.
3. Claude writes a handoff packet for Codex.
4. Claude updates the baton to `turnOwner: "codex"`.
5. Codex’s bounded watcher sees the baton change.
6. Codex reads the handoff packet.
7. Codex audits the plan/implementation/evidence.
8. Codex writes a review markdown.
9. Codex updates the baton to `turnOwner: "claude"`.
10. Codex waits again for Claude’s next handoff.
11. Repeat until Codex writes `codexDecision: "GO"` or a terminal blocker.

## Recommended directories

Use one shared loop directory:

```text
docs/plans/loop/
  baton.json
  handoffs/
    claude_to_codex_<round>.md
  codex_reviews/
    codex_review_<round>.md
  evidence/
    <logs, screenshots, command outputs, summaries>
```

Claude should write handoffs under:

```text
docs/plans/loop/handoffs/
```

Codex should write reviews under:

```text
docs/plans/loop/codex_reviews/
```

## Baton contract

Use `docs/plans/loop/baton.json`.

Minimum shape:

```json
{
  "turnOwner": "codex",
  "round": 1,
  "taskId": "PLAN_OR_FEATURE_NAME",
  "targetPlan": "docs/plans/PLAN_name.md",
  "handoff": "docs/plans/loop/handoffs/claude_to_codex_001.md",
  "changedFiles": [],
  "evidenceFiles": [],
  "claudeStatus": "ready-for-codex",
  "codexStatus": "waiting",
  "codexDecision": "pending"
}
```

Allowed `turnOwner` values:

- `claude`
- `codex`
- `done`

Recommended `codexDecision` values:

- `pending`
- `GO`
- `NO_GO`
- `NEEDS_FIXES`
- `TIMEOUT`
- `BLOCKED`

When Claude is ready for Codex:

```json
{
  "turnOwner": "codex",
  "claudeStatus": "ready-for-codex"
}
```

When Codex is done with a review round:

```json
{
  "turnOwner": "claude",
  "codexStatus": "review-written",
  "codexDecision": "NEEDS_FIXES"
}
```

When Codex believes the plan is implementation-ready:

```json
{
  "turnOwner": "done",
  "codexStatus": "approved",
  "codexDecision": "GO"
}
```

## What Claude must provide before handing off

Claude should not simply say “ready.” Claude should write a specific handoff markdown with enough detail for Codex to review without guessing.

Required handoff contents:

1. Objective
   - What plan or implementation is being reviewed.
   - What “ready” means for this round.

2. Files changed or relevant
   - Exact file paths.
   - Which files were edited.
   - Which files are evidence only.

3. Claims
   - Bullet list of what Claude believes is now true.
   - Example: “The plan now closes the stale-artifact false-green path.”

4. Verification performed
   - Commands run.
   - Outputs or links to output files.
   - Anything not run and why.

5. Known limitations
   - Any uncertainty.
   - Any intentionally deferred scope.
   - Any fragile assumptions.

6. Specific questions for Codex
   - The exact areas Claude wants pressure-tested.
   - Example: “Is the counterfactual sufficient?” or “Can this still false-pass?”

7. Decision requested
   - `GO`, `NEEDS_FIXES`, or specific blocker review.

## What Codex will check

Codex will review at the level appropriate to the task:

- Does the plan match the original goal?
- Are all required cases covered?
- Are claims backed by code/evidence?
- Are there false-green paths?
- Are there fail-open paths?
- Are there stale artifact risks?
- Are the tests/audits actually exercising the behavior claimed?
- Are scoped non-goals honest?
- Are deployment/runbook steps coherent?
- Are verification commands meaningful?
- Are there hidden dependencies on old state, credentials, stale classes, or uncontrolled environment?

For implementation reviews, Codex may inspect:

- changed files;
- caller/callee paths;
- feature flags;
- test/audit harnesses;
- generated artifacts;
- logs/results;
- docs and plan acceptance criteria.

Codex should bias toward finding ways the plan could falsely pass.

## Codex review output

Codex writes one markdown review per round:

```text
docs/plans/loop/codex_reviews/codex_review_<round>.md
```

Suggested structure:

```markdown
# Codex review round <N>: <taskId>

## Verdict

GO / NEEDS_FIXES / NO_GO / BLOCKED / TIMEOUT

## Summary

Short direct summary.

## Findings

### C<N>-1 — <severity> — <title>

- Evidence:
- Why it matters:
- Required fix:

## Non-blocking notes

## What I verified

## Baton update
```

Severity levels:

- `blocker`
- `high`
- `medium`
- `low`
- `note`

## Codex go-ahead criteria

Codex can give the go-ahead only when:

- the plan satisfies the original objective;
- the handoff is specific enough to audit;
- no known blocker/high false-green path remains;
- required verification is either complete or honestly deferred with an acceptable reason;
- deployment or implementation sequencing is coherent;
- evidence supports the claims;
- remaining limitations are scoped and acceptable.

The go-ahead should be explicit:

```text
codexDecision: GO
```

Codex should not give `GO` just because the latest diff is smaller or because review fatigue is high.

## Bounded wait behavior

Codex can wait for Claude with a foreground polling command.

Default:

- poll every 5 seconds;
- wait up to 6 minutes;
- ready condition: `baton.json.turnOwner == "codex"`;
- timeout means Claude likely hung or failed to hand off.

PowerShell watcher shape:

```powershell
$baton="C:\Users\dmchw\vocaboost\docs\plans\loop\baton.json"; $deadline=(Get-Date).AddMinutes(6); while((Get-Date) -lt $deadline){ if(Test-Path $baton){ try{ $j=Get-Content -Raw $baton | ConvertFrom-Json; if($j.turnOwner -eq "codex"){ Write-Output "READY"; exit 0 } } catch{} }; Start-Sleep -Seconds 5 }; Write-Output "TIMEOUT"; exit 2
```

If timeout occurs, Codex should:

- read the baton if possible;
- write a timeout note if useful;
- stop the loop and report the timeout.

## Important operational rule

During this long-turn loop:

- Claude owns implementation or plan edits unless explicitly asked otherwise.
- Codex owns review markdown and baton updates.
- Codex should avoid broad source edits unless the user explicitly asks Codex to implement.
- Claude should not overwrite Codex review files.
- Both sides should preserve prior artifacts.

## Minimal Claude handoff template

```markdown
# Claude handoff round <N>: <taskId>

## Objective

## Changed/relevant files

## Claims

## Verification performed

## Evidence files

## Known limitations / deferred scope

## Questions for Codex

## Requested decision
```

## Minimal baton example for Claude to hand off

```json
{
  "turnOwner": "codex",
  "round": 3,
  "taskId": "RUN_L_AUDIT_PLAN",
  "targetPlan": "docs/plans/PLAN_list_progress_persist.md",
  "handoff": "docs/plans/loop/handoffs/claude_to_codex_003.md",
  "changedFiles": [
    "audit/playwright/lsr_runL.mjs",
    "audit/playwright/lsr_runL_verify.mjs"
  ],
  "evidenceFiles": [
    "audit/playwright/RUNL_IMPL_REVIEW.md"
  ],
  "claudeStatus": "ready-for-codex",
  "codexStatus": "waiting",
  "codexDecision": "pending"
}
```


---

## Updated wait contract: 20-minute bounded wait with ready markers

Use a 20-minute bounded foreground wait for Claude handoffs.

Default:

- poll every 5 seconds;
- wait up to 20 minutes;
- ready condition requires both `baton.json.turnOwner == "codex"` and a matching ready marker file;
- timeout means Claude likely hung, failed verification, or failed to publish the handoff marker.

The ready marker prevents Codex from reading a handoff while Claude is still writing files. Claude must write all handoff/evidence files first, then write the marker last.

Recommended marker path:

```text
docs/plans/loop/ready/claude_ready_round_<round>.json
```

Marker contents:

```json
{
  "readyFor": "codex",
  "round": 3,
  "taskId": "RUN_L_AUDIT_PLAN",
  "handoff": "docs/plans/loop/handoffs/claude_to_codex_003.md",
  "writtenLast": true
}
```

Claude handoff order:

1. Write/update plan files.
2. Run verification.
3. Write evidence files.
4. Write `handoffs/claude_to_codex_<round>.md`.
5. Update `baton.json` with `turnOwner: "codex"` and `readyMarker`.
6. Write `ready/claude_ready_round_<round>.json` last.

Codex should only begin review when both are true:

1. `baton.json.turnOwner == "codex"`.
2. The `readyMarker` path from `baton.json` exists and its contents match the baton `round` and `taskId`.

Updated baton shape:

```json
{
  "turnOwner": "codex",
  "round": 3,
  "taskId": "RUN_L_AUDIT_PLAN",
  "targetPlan": "docs/plans/PLAN_list_progress_persist.md",
  "handoff": "docs/plans/loop/handoffs/claude_to_codex_003.md",
  "readyMarker": "docs/plans/loop/ready/claude_ready_round_003.json",
  "changedFiles": [],
  "evidenceFiles": [],
  "claudeStatus": "ready-for-codex",
  "codexStatus": "waiting",
  "codexDecision": "pending"
}
```

PowerShell watcher command:

```powershell
$root="C:\Users\dmchw\vocaboost"; $baton="$root\docs\plans\loop\baton.json"; $deadline=(Get-Date).AddMinutes(20); while((Get-Date) -lt $deadline){ if(Test-Path $baton){ try{ $j=Get-Content -Raw $baton | ConvertFrom-Json; if($j.turnOwner -eq "codex" -and $j.readyMarker){ $m=Join-Path $root $j.readyMarker; if(Test-Path $m){ $r=Get-Content -Raw $m | ConvertFrom-Json; if($r.readyFor -eq "codex" -and $r.round -eq $j.round -and $r.taskId -eq $j.taskId){ Write-Output "READY"; exit 0 } } } } catch{} }; Start-Sleep -Seconds 5 }; Write-Output "TIMEOUT"; exit 2
```

If timeout occurs, Codex should:

- read the baton if possible;
- write a timeout note if useful;
- stop the loop and report the timeout.

Codex review completion order should mirror Claude's handoff order:

1. Write `codex_reviews/codex_review_<round>.md`.
2. Update `baton.json` with `turnOwner: "claude"` or `turnOwner: "done"`.
3. Write `ready/codex_ready_round_<round>.json` last if Claude wants a symmetric marker.

Symmetric Codex marker:

```json
{
  "readyFor": "claude",
  "round": 3,
  "taskId": "RUN_L_AUDIT_PLAN",
  "review": "docs/plans/loop/codex_reviews/codex_review_003.md",
  "writtenLast": true
}
```
