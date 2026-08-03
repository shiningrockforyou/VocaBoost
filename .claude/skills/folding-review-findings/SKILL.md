---
name: folding-review-findings
description: Folds reviewer or audit findings into code safely — writes a plan ledger with a bypass set per guard, verifies each assumption in code before editing, fixtures every path, and re-derives every published number. Use when a review panel, code review, Codex round, audit, or security reviewer returns findings to act on; when applying a fix that will be described as "closed", "verified", "inert", or "safe"; or when writing a receipt or status claim about test results.
---

# Folding review findings

A fold is not "apply the suggested diff." It is: **plan → verify assumptions → edit → fixture the
bypasses → re-derive numbers → tick the plan → gate**. Skipping the plan or the tick is how a false
"closed" claim reaches production.

## Copy this checklist into your response and tick it as you go

```
Fold progress:
- [ ] 1. Read the FULL review file(s) — never a truncated notification
- [ ] 2. Write the ledger from scripts/deepfix2/FOLD_LEDGER_TEMPLATE.md (BEFORE editing)
- [ ] 3. Validate the plan:  node scripts/deepfix2/gate.mjs --plan
- [ ] 4. Verify every V-row in code (cite file:line) — a guard is "inert" only if no live writer exists
- [ ] 5. Edit — every edit asserts its anchor matched exactly once
- [ ] 6. Fixture EVERY bypass path + one mutant per new clause
- [ ] 7. Freeze the artifact, re-run evidence, re-stamp shas
- [ ] 8. Tick every ledger row with file:line + fixture ref
- [ ] 9. node scripts/deepfix2/gate.mjs  (must be clean)
- [ ] 10. Log the change, then commit
```

## The rule that keeps getting missed

**A closure claim needs the BYPASS SET, per guard, every time — not just for the guard a reviewer
named.** For each thing you are protecting, enumerate and fixture:

`create · update · delete · set-with-merge · set-without-merge · FieldValue.delete() ·
delete-then-recreate SEQUENCE · batch · transaction · the same data at a different path ·
as a third party · as a privileged role`

Real failures this prevents, all from one program:
- A guard was written for `update` only; deleting the document and recreating it restored the hole.
  Published as "closed" in three documents before two reviewers found it.
- The lesson was then applied **only to the guard the reviewer had named**; the next round found the
  identical hole in both other guards.
- A guard named five field keys that **no writer in the repo actually wrote**. Grep for a real writer
  before trusting a field name.

## Non-negotiables

1. **Verify before you edit.** Every "this is inert / nothing writes this / no path does that" must be
   a grep with a file:line, run *before* the edit that depends on it — not after.
2. **Assert every anchor.** An edit whose target text does not match must fail loudly. A silent
   no-match looks exactly like success.
3. **Never hand-type a number.** Test scores, counts and hashes come from the evidence file. Stale
   numbers have been published repeatedly, once inside the very paragraph claiming the previous stale
   number was fixed.
4. **Freeze while reviewed.** Do not edit an artifact while a panel is measuring it; the hash binding
   downstream gates rely on becomes false.
5. **Correct falsehoods at their source**, in every document that carries them — not just the newest.
6. **Card what you defer**, with its real constraint, so it is not silently dropped.

## When the work came from an agent, verify the DIFF, not the report

An agent's summary is a **claim**. `git diff` is a **fact**. Record the HEAD sha before launching, then:

```
node scripts/deepfix2/verify-agent-work.mjs <baseline-sha> [claimed.json]
```

It reports the real changed-file set, flags any protected path or feature-flag VALUE that moved, checks
the reflog for history rewriting, and — given the agent's report — names files **changed but not
declared** (scope creep nobody reviewed) and **declared but not changed** (the work did not happen).

A second independent record exists: each agent's `agent-*.jsonl` transcript logs every tool call it
made, and `journal.jsonl` holds its actual return value. Read those before believing a summary.

And re-run the tests yourself. A number in a report is a claim about a run you did not see.

## Reporting

State what the fold did AND what it did not close. If a claim had to be withdrawn, say so plainly —
the withdrawal is the most useful sentence in the report.

Rationale and the full loop: `docs/plans/deepfix2/EXECUTION_DISCIPLINE.md`.
