---
name: verifying-agent-work
description: Verifies another agent's finished work against the git diff, its tool-call transcript, and independent re-execution instead of trusting its summary — catches files changed but not declared, work claimed but never done, protected paths touched, and silent feature-flag flips. Use when a subagent, workflow, background task, or teammate reports work is finished or hands back a summary; when asked to check, spot-check, or double-check what an agent did or actually changed; and before committing, merging, or relaying changes someone else made.
---

# Verifying agent work

An agent's summary is a **claim**. Most delegated-work failures are not lies — they are omissions: a
collateral edit nobody mentioned, or a step the agent believed it completed.

## Copy this checklist into your response and tick it as you go

```
Verification:
- [ ] 1. Baseline sha (captured at launch; if missing, see Recovering a baseline)
- [ ] 2. Write the agent's claim to claimed.json
- [ ] 3. node scripts/deepfix2/verify-agent-work.mjs <baseline> claimed.json [--repo <path>]
- [ ] 4. git -C <repo> diff <baseline>..HEAD -- <each unexpected file>
- [ ] 5. Re-execute the proof yourself — the agent's own command, run by you
         (this repo has no `npm test`; run the harness the work names, e.g.
         `bash scripts/deepfix2/run-rules-matrix.sh`, `node scripts/deepfix2/rules-mutants.mjs`,
         `node scripts/deepfix2/gate.mjs`)
- [ ] 6. Read the tool-call transcript if anything is surprising or suspiciously tidy
```

**Exit codes: 0 clean · 1 findings · 2 THE CHECK DID NOT RUN** (missing or unresolvable baseline).
**A 2 is not a pass.** On exit 1, do not commit or relay "clean" until every line is explained in
writing. On a protected-path hit, stop and hand back.

**`--repo` matters.** The script defaults to `/app`. If the agent ran under `isolation: "worktree"`, it
worked in a different tree — without `--repo <that path>` you get `0 files … VERIFY CLEAN` while the
real changes sit elsewhere. That is the worst failure mode here, because it looks like success.

**`claimed.json`** is just `{"filesChanged": ["/abs/path", ...]}` — copy it from the agent's structured
result. Without it, the two headline signals (changed-but-not-declared, declared-but-not-changed) do
not run at all.

## Brief agents so verification is cheap

Verification is far easier when the agent's output is designed to be checked. Put this in every brief:

- **Declare a file manifest.** Require a structured result with `filesChanged: [...]`, absolute paths.
  Then `claimed.json` is a copy of the agent's own result, not something you reconstruct.
- **Name the untouchable paths explicitly** — in-flight review artifacts, coordination files, deploy
  config, credentials, and any flag *value*. An agent that was told will usually comply; the check is
  for when it doesn't.
- **Demand asserted edit anchors** — every edit must fail loudly if its target text did not match
  exactly once. A silent no-match looks identical to success in a summary.
- **Require the real number, and permit failure.** "Report the actual test count; a truthful PARTIAL is
  worth more than a green claim I cannot reproduce." Agents optimise for the report they were asked for.
- **Ask for what it did NOT do** — skipped steps, unverified assumptions. Naming that as a wanted
  deliverable is what makes omissions surface.

## The trust ladder — independent of what the agent says

Nothing on a shared filesystem is literally incorruptible: an agent with shell access can rewrite files,
and in principle history. So rank evidence by how independent it is, and **climb only as far as the
stakes require**:

| Level | Evidence | Independent of the agent? |
|---|---|---|
| 1 | its summary | no — it is the claim |
| 2 | the **diff**, and its `agent-*.jsonl` tool-call transcript | mostly — two records it did not write to be read |
| 3 | **the file contents you read yourself** — does the guard actually exist in the text? | yes, for state |
| 4 | **re-executing the proof yourself** — run the tests, the matrix, the mutants | yes, for behaviour |

**Level 4 is the only one that survives an agent that is confidently wrong**, because a failing test
cannot pass in *your* run. Two independent records agreeing (diff + transcript) is strong; a re-run is
conclusive.

**Scale it, or it becomes ceremony:** routine or reversible work stops at level 2. Anything touching
production, security, or data over real users goes to level 4 — and there, re-derive the numbers rather
than quoting the agent's.

## Reading the transcript

```bash
# newest first — the time filter is unreliable across shells, so sort instead
ls -t $(find ~/.claude/projects/-app -name 'agent-*.jsonl') 2>/dev/null | head -5
```
Two layouts exist: workflow agents write to `subagents/workflows/<run>/`, directly-launched subagents to
`subagents/` with no run segment — the `find` covers both. Each has an `agent-*.meta.json` beside it
identifying which run it belongs to, and `journal.jsonl` (workflows only) holds actual return values.

## Recovering a baseline you forgot to capture

`git log --oneline -20` and take the last commit *you* made. Approximate is fine — a too-early baseline
over-reports (you review extra files), a too-late one under-reports (you miss changes). Prefer too early.

## What these checks do not cover

The protected-path list and the flag-value check are **hardcoded patterns**, so `✓ none touched` means
"none of those", not "nothing sensitive". And omission-detection says nothing about whether the code is
*correct* — that still needs review of the diff itself.
