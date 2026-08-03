---
name: ordering-deploys
description: Writes and executes production deploy orders safely — reads every file the order names, states exact commands with no room for interpretation, captures a before/after baseline, and carries the executor's refusal conditions. Use when preparing or issuing a deploy, a Firebase functions/rules/indexes push, a migration, a config or feature-flag flip, or any instruction handed to another agent that will change production.
---

# Ordering deploys

This is a **narrow bridge with cliffs on both sides**: there is one safe sequence, so the order must be
low-freedom — exact commands, no flags left to judgment, and an explicit refusal clause. A deploy order
written from assumption once nearly shipped an unshipped lockdown to a live cohort; only the executor's
refusal stopped it.

## Copy this checklist into your response

```
Deploy order:
- [ ] 1. READ every file the order names, in full — including the artifact it references
- [ ] 2. Confirm the file at the deploy path IS the artifact intended to ship
- [ ] 3. Baseline captured first (list the live state before touching it)
- [ ] 4. Exact commands, surgical scope (--only <specific targets>, never a bare deploy)
- [ ] 5. Post-deploy verification that would FAIL if the wrong thing shipped
- [ ] 6. Refusal conditions stated verbatim
- [ ] 7. Boundaries restated: what this order must NOT touch
```

## Rules

1. **Read every named file before ordering.** Not the filename, the contents. A repo file may be an
   unshipped end-state that self-declares undeployable; a "rules fragment" may be commentary that must
   be authored, not concatenated.
2. **The deploy path is a staging slot.** Confirm what actually sits there right now. Do not assume the
   configured path holds the artifact you reviewed.
3. **Surgical scope always.** Name explicit targets. A bare deploy sweeps in everything else in the
   config file, including things nobody reviewed.
4. **Baseline before, diff after.** The post-deploy check must be capable of failing — "list before,
   list after, assert REMOVED: none" beats "it printed success."
5. **Additive proof for anything cumulative** (indexes, rules, permissions): show that nothing present
   before is absent after.
6. **State the refusal conditions** in the order itself, and honor them when you are the executor.
   An executor that refuses a bad order is the control that works.
7. **Never fix a deploy hazard by restructuring the repo** without checking what reads those paths.
   Moving a file and repointing config once broke five harnesses and would have silently reverted an
   entire workstream while printing success.
8. **Verify identity, not vibes**: after a surgical deploy, provenance probes not included in the
   target set still report the *previous* build — do not read them as confirmation.

## Boundaries that are never the agent's to cross

Global on/off switches, cohort backfills over real user data, and anything the owner has reserved stay
with the owner. State them in every order so the executor can refuse if an instruction drifts.

Rationale: `docs/plans/deepfix2/EXECUTION_DISCIPLINE.md` · deploy-specific cards:
`docs/plans/deepfix2/17_DEPLOY_ORDER_REQUIREMENTS.md`.
