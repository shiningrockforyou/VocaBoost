---
name: reread-batons-before-declaring-agent-stalled
description: Always re-read the baton file before telling David an external agent is non-responsive
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4817fc5a-d68b-443f-96c2-c94ed4b10bf5
  modified: 2026-07-18T21:19:32.551Z
---

**Before declaring WinClaude/Codex non-responsive, ALWAYS re-read the live baton file — a timed-out watch loop is NOT proof an agent stalled.** (David flagged this 2026-07-18 with "Are you checking batons?" after I declared WinClaude stalled on a stale rev-99 snapshot; the baton had already flipped to rev-100 `DROVE` PASS.)

**Why:** batons update asynchronously on the shared FS. My polling watch clamps to a fixed window and reports "TIMEOUT" with whatever it last saw — that snapshot goes stale the instant the loop exits. Acting on it (escalating to David that an agent is dead) is premature and wastes David's attention, the exact opposite of keeping agents in the loop.

**How to apply:** when a watch times out, do a FRESH read of `docs/plans/loop/win/baton.json` + `docs/plans/loop/baton.json` (turnOwner/round/revision/execDecision) AND check for a new review/evidence file, RIGHT BEFORE composing any "agent is silent" message. Only escalate if the fresh read still shows the pre-dispatch revision + no new artifacts. Keeping Codex + WinClaude in every round and surfacing genuine silence to David is still binding [[opus-viable-as-fable-critic-replacement]] — this just says verify the silence is real first.
