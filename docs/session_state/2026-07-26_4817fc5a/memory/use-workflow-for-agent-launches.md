---
name: use-workflow-for-agent-launches
description: "David directive 2026-07-26 — orchestrate multi-agent work via the Workflow tool, not individual Agent launches"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 87eba36e-8e66-4638-bae9-6cd6f923fff6
  modified: 2026-07-25T18:32:36.123Z
---

From 2026-07-26, when launching subagents (convergence panels, verification passes, parallel audits), use the
**Workflow tool** instead of individual Agent-tool launches.

**Why:** David asked mid-session on 2026-07-26 ("from now on, use workflow instead of individual agent launches") —
this is a standing opt-in to Workflow orchestration; no per-use permission ask needed.

**How to apply:** panels/verifiers become one Workflow script (parallel()/pipeline() of agent() calls, schema-typed
returns where useful) rather than N separate Agent calls. Keep panel sizes per the convergence roster in
[[opus-viable-as-fable-critic-replacement]] (default Opus critics). Single one-off agents with no orchestration need
can still be a lone agent() inside a trivial workflow or an Agent call if genuinely singular — but default to Workflow.
