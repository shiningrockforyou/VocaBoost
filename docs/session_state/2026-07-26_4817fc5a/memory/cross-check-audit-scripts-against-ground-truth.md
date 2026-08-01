---
name: cross-check-audit-scripts-against-ground-truth
description: verdict/audit scripts can silently over- or under-report — spot-check their output against a direct ground-truth probe before reporting or acting
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4817fc5a-d68b-443f-96c2-c94ed4b10bf5
  modified: 2026-07-19T04:24:00.943Z
---

Your own audit/verdict scripts can produce FALSE CONFIDENCE — do not report or act on a script's summarized verdict without a direct ground-truth spot-check.

**Why:** In the D3.5 recovery audit, `assert-recovery.mjs` reported 4 extra PASS on STALE prior-round `system_logs` (its `sinceMs` default was 0 → counted everything as "fresh proof"), and separately a composite Firestore query (`userId`+`timestamp`) hit an undeployed index whose FAILED_PRECONDITION was swallowed to `[]`, nulling ALL proof under `--since`. Both were caught only by querying Firestore directly (query by `userId`, filter timestamp in JS) and comparing. Reporting the script's raw output would have told David 4 recoveries succeeded that were never driven that round.

**How to apply:** When a script emits a verdict/count that you're about to report or act on, independently verify the decisive fields against source-of-truth (a direct DB read, the raw logs, the actual file) — especially time-windowing, "proof exists" booleans, and any query wrapped in `.catch(()=>[])`. Treat a swallowed-error empty result as "unknown," not "absent." This is [[reread-batons-before-declaring-agent-stalled]] applied to tooling: a clean-looking summary is not ground truth. David's standing rule this session was "never trust blindly — verify every claim"; that includes claims made by your own code.
