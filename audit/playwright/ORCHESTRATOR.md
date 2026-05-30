# ORCHESTRATOR Playbook

You are the orchestrator session for the vocaBoost audit. Sub-agents are running batches and writing per-batch findings + per-agent activity logs. Your job is to aggregate their output into the three team-facing deliverables.

This file is the counterpart to `START_HERE.md`. That file tells sub-agents what to do; this one tells the orchestrator what to do when sub-agents finish.

---

## When to run the aggregation pass

The orchestrator runs aggregation when ONE of these is true:

1. **All running agents have written `state: "finished"` or `state: "stopped"` to their `agent_logs/<label>.status.json`.**
2. **A BLOCKER stop condition fired** for any agent (look for `event: "stop_condition_hit"` in any `.jsonl`). In this case, write a partial SUMMARY and stop.
3. **The human explicitly asks to aggregate** (most common — they say "aggregate the audit now").

Don't run aggregation while agents are still in `state: "running"` unless the human asks for an interim report.

---

## Pre-flight check

```bash
# 1. List agent statuses
ls /app/audit/playwright/findings/agent_logs/*.status.json 2>/dev/null
for f in /app/audit/playwright/findings/agent_logs/*.status.json; do
  echo "=== $(basename "$f") ==="
  cat "$f"
done

# 2. List finished findings files
ls /app/audit/playwright/findings/findings_B*.md 2>/dev/null

# 3. Count evidence files
find /app/audit/playwright/findings/evidence/ -type f 2>/dev/null | wc -l

# 4. Tail each agent's recent activity
for f in /app/audit/playwright/findings/agent_logs/*.jsonl; do
  echo "=== $(basename "$f") (last 5) ==="
  tail -5 "$f"
done
```

If any agent is still `state: "running"`, stop and notify the human. Don't aggregate mid-run unless explicitly asked.

---

## The aggregation pass

### Step 1 — Reconstruct the unified timeline

Concatenate every `agent_logs/*.jsonl`. Sort by `ts` field. This gives you a single chronological event log across all agents.

```bash
cat /app/audit/playwright/findings/agent_logs/*.jsonl \
  | jq -s 'sort_by(.ts)' \
  > /tmp/audit_timeline.json
```

If `jq` isn't available, use Node:
```bash
node -e "
  const fs = require('fs')
  const dir = '/app/audit/playwright/findings/agent_logs/'
  const events = fs.readdirSync(dir)
    .filter(f => f.endsWith('.jsonl'))
    .flatMap(f => fs.readFileSync(dir + f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse))
    .sort((a, b) => a.ts.localeCompare(b.ts))
  fs.writeFileSync('/tmp/audit_timeline.json', JSON.stringify(events, null, 2))
  console.log('Events:', events.length)
"
```

### Step 2 — Compute the trial / pass-fail matrix

From the timeline, count:

- Trials completed = number of `event: "scenario"` records.
- Pass / fail / blocked / partial counts per batch.
- Per-persona stats (look up persona from `seeded_accounts.json` via the `findingId` references in findings markdowns).
- Wall-clock duration per batch = last `batch_end.ts` − first `batch_start.ts` for that batch.
- Per-agent contribution.

### Step 3 — Read every `findings_B{XX}.md`

For each file, extract:

- The executive summary paragraph.
- The scenario-coverage table.
- Each F-block (severity, persona, scenario references, repro, observed, expected, evidence paths).
- The "top 3 fixes" recommendation list at the bottom.

The findings markdowns are the source of truth for severity ratings. The JSONL gives counts; the markdown gives qualitative detail.

### Step 4 — Cross-batch synthesis

Look for patterns that span multiple batches:

- Same persona failing across N batches → that persona's behavior triggers a class of bug.
- Same severity-HIGH finding mentioned in multiple findings_B*.md → likely a shared root cause.
- Day-progression batches (B22) consistently failing on a specific day boundary → algorithmic issue.
- AI grading batches (B26) consistently failing on Korean → grader regression.

These patterns go into RECOMMENDATIONS.md.

### Step 5 — Write the three deliverable files

#### `findings/SUMMARY.md`

```markdown
# vocaBoost Playwright Audit — SUMMARY

**Run window:** YYYY-MM-DD HH:MM → HH:MM (KST)
**Total wall-clock:** X.X hours
**Agents involved:** A, B, C (or solo)
**Status:** Completed full / Completed partial / Halted by BLOCKER

## Headline numbers

- Trials completed: **NNN / 410**
- Batches completed: **NN / 27**
- Findings: **NN total** — BLOCKER: X, HIGH: Y, MEDIUM: Z, LOW: W
- BLOCKER stop conditions: hit? (which batch / scenario)

## Per-batch breakdown

| Batch | Pass | Fail | Blocked | Partial | Findings | Severity max |
| --- | --- | --- | --- | --- | --- | --- |
| B00 | 6 | 0 | 0 | 0 | 0 | — |
| B02 | 10 | 2 | 0 | 0 | 2 | HIGH |
| ...  | | | | | | |

## Top 10 most-severe findings

(Rank order. For each: Batch / Scenario / Severity / Persona / Repro one-liner)

## Rollout-gate checklist

- [ ] B02/B03 — recent persistence fixes hold under load?  ← cite findings
- [ ] B22 — day progression clean across 14-day walks for all personas?  ← cite findings
- [ ] B26 — AI grader's Korean acceptance rate ≥ X%?  ← cite findings table
- [ ] No BLOCKER findings open.

If all four boxes can be checked, this audit clears the next student cohort.

## What wasn't tested

- Skipped batches (with reason).
- Personas blocked from testing (e.g. classswitcher requires teacher action).
- External dependencies that were unavailable (AI grader timeout, etc.).

## Aggregator notes

(Anything the orchestrator noticed reading across batches that didn't fit elsewhere.)
```

#### `findings/RECOMMENDATIONS.md`

```markdown
# vocaBoost Audit — Recommendations

Top 5 fixes ordered by go/no-go impact for the next student cohort.

## R1 — <one-line title>
**Severity:** BLOCKER / HIGH
**Source findings:** B02 F01, B22 F03 (same root cause; see SUMMARY § cross-batch synthesis)
**Why this is #1:** <one paragraph on why it gates rollout>
**Suggested fix shape:** <one sentence; do not write code>
**Test that would verify the fix:** <one sentence on the regression test>

## R2 — ...
## R3 — ...
## R4 — ...
## R5 — ...

## Out of scope for this PR

(Findings the audit caught that should be tracked but aren't in the top 5.)
```

#### `findings/EVIDENCE_INDEX.md`

```markdown
# Evidence Index

Generated by orchestrator after aggregation. Flat list of every captured artefact, grouped by batch.

## B00 — Setup & Seed
- `evidence/B00/B00_S01_landing.png` — landing page on first load
- `evidence/B00/B00_S02_login_careful.png` — careful student post-login dashboard
- ...

## B02 — MCQ Submission Critical
- `evidence/B02/B02_S01_pre_submit.png`
- `evidence/B02/B02_S01_post_submit.png`
- `evidence/B02/B02_S01_firestore_attempts.json`
- `evidence/B02/B02_S02_recovery_prompt.png`
- ...

(One section per batch. Walk `evidence/` programmatically.)
```

To generate the evidence index:

```bash
node -e "
  const fs = require('fs')
  const path = require('path')
  const root = '/app/audit/playwright/findings/evidence'
  const out = ['# Evidence Index\n']
  for (const batch of fs.readdirSync(root).sort()) {
    out.push(\`\\n## \${batch}\\n\`)
    const dir = path.join(root, batch)
    for (const file of fs.readdirSync(dir).sort()) {
      out.push(\`- \\\`evidence/\${batch}/\${file}\\\`\`)
    }
  }
  fs.writeFileSync('/app/audit/playwright/findings/EVIDENCE_INDEX.md', out.join('\\n'))
"
```

### Step 6 — Update `audit_state.json` ONCE with the aggregated state

```js
audit_state.audit_metadata = {
  lastBatch: <last batch in timeline>,
  batchesCompleted: [<all completed batches>],
  totalTrialsCompleted: NNN,
  totalFindings: NN,
  bySeverity: { BLOCKER: X, HIGH: Y, MEDIUM: Z, LOW: W, NITPICK: V },
  audit_runs: [
    ...existing,
    {
      startedAt: <first batch_start.ts>,
      endedAt: <last batch_end.ts>,
      durationHours: X.X,
      agents: ["A","B","C"],
      trials: NNN,
      findings: NN,
      summaryPath: "findings/SUMMARY.md"
    }
  ]
}
```

Write atomically (read → mutate → write). This is the only place the orchestrator touches `audit_state.json`.

### Step 7 — Notify the human

Once the three deliverables exist:

```
Aggregation complete.
- Trials: NNN/410
- Batches: NN/27 completed
- Findings: NN (BLOCKER X, HIGH Y, MEDIUM Z, LOW W, NITPICK V)
- Top recommendation: <R1 title from RECOMMENDATIONS.md>

Read /app/audit/playwright/findings/SUMMARY.md for the headline numbers.
Read /app/audit/playwright/findings/RECOMMENDATIONS.md for the fix order.

Next steps:
1. Review SUMMARY + RECOMMENDATIONS with the team.
2. If no BLOCKERs and rollout-gate checklist is green → safe to start next cohort.
3. Run `node scripts/cleanup-audit-students.js --apply` to remove the 50 test accounts when done.
```

---

## Edge cases

### Two agents wrote to the same `findings_B{XX}.md`

Shouldn't happen if batch claims didn't overlap. If it did:
- Compare the two via the `agent_logs/*.jsonl` timestamps.
- Keep the more complete one (more scenario rows, more findings).
- Note in SUMMARY's "Aggregator notes" section.

### An agent never wrote `agent_end` event

The agent crashed or was force-stopped. Treat as `state: "errored"`. Count whatever trials they did log. Note in SUMMARY.

### Findings markdown is malformed (missing severity, no scenario refs)

Don't drop it. Cite it in SUMMARY's "Aggregator notes" with the parse issue. Default severity = MEDIUM if missing. Default persona = "unknown" if missing.

### Some agent's batch claim wasn't completed

The agent's `.status.json.batchesCompleted` doesn't cover everything in `.batchesClaimed`. Note the gap in SUMMARY § "What wasn't tested." If important batches were skipped, spawn another agent to cover them.

### Massive evidence dir (thousands of files)

Don't try to render every screenshot inline. EVIDENCE_INDEX.md is just paths. The screenshots themselves are referenced from findings_B*.md when needed.

---

## Anti-patterns to avoid

- ❌ Writing the three deliverables before all agents are `finished` / `stopped` / `errored` (unless human asks for interim).
- ❌ Editing `findings_B*.md` files — those are the agents' work product; don't rewrite them.
- ❌ Deleting evidence files. Even noisy ones might be referenced by findings.
- ❌ Running `cleanup-audit-students.js` from the orchestrator. That's a human decision after the audit.
- ❌ Inferring severities you weren't told. If the agent wrote MEDIUM, don't promote it to HIGH just because it looks bad. The agent saw the repro; trust their rating.
