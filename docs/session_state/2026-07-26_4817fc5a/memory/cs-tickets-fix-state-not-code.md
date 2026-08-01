---
name: cs-tickets-fix-state-not-code
description: "David 2026-07-27 — on CS tickets, fix the student's data only; never go fix app code"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8d7ec58f-bee9-4d4f-b514-9a1ac0605043
  modified: 2026-07-27T03:06:03.275Z
---

David: "just fix her state — don't fix the code." On a customer-support ticket the deliverable is the
student's data state, full stop. Do not edit app/server code, and do not turn the ticket into a code-fix
task.

**Why:** app-code changes belong to the active engineering stream (deepfix2), which has its own
convergence/deploy discipline and pin-move rules. A CS-driven code edit bypasses that and ships
unreviewed behavior to the live 26SM cohort.

**How to apply:** diagnose read-only → apply the minimal data fix (defined scripts in `scripts/cs/`) →
log it. If the ticket exposes a root-cause code defect, state it in **one line** in the report and in
`SUPPORT_RUNBOOK.md`/`NEED_TO_FIX.md` — do not propose a patch, plan a fix, or start one unless he asks.
Related: [[terse-answers-for-david]].
