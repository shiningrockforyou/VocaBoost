# deepfix M-UI (RO+RS) — winclaude-ui-r12

**When:** 2026-07-14T21:25:40.892Z  
**BASE:** http://localhost:5173  
**Build:** local-dev  
**git:** a967f544e0f3d4bce72861ad82a34d8e2ec27206 (DIRTY)  
**List:** LSR Base Camp (audit clone) (base, 1200 words)  
**Result:** 2/7 PASS · 0 fatal anomalies · **NOT-CLEAN**

> INVALID = a precondition/seed could not be materialized (setup problem), NOT a pass. Only PASS certifies.

| Scenario | Verdict | studentUid | classId | Detail |
|---|---|---|---|---|
| RS-1 | PASS | 3MUIeEHhrb | OWIFEKrvSO | deep student surfaced via server Name filter: Showing=11 (target 3); nameCell rendered account displayName (0 token-cells) |
| RS-3 | FAIL | rB87oxUQt2 | tUB379Mubh | RS-3: list NOT shown on the teacher Assigned-Lists surface |
| RS-2 | FAIL | LZ9NeANMfI | f2Y4B5XIkB | RS-2: testId-less attempt row NOT visible in the gradebook (dropped for lacking testId) |
| RS-4 | INVALID | GVApGcIRZu | 15vfpxWu14 | score 40% outside [90,95) — grader drift; re-calibrate the answer count (did not exercise the serverPassed-vs-0.95 gap) |
| RO-S1 | FAIL | cTcK2rmhGh | Q9jWboFhpM | RO-S1: csd 0->0 (want 0->1); twi 0->0 (want +pace); no passed new attempt recorded |
| RO-S9 | PASS | TzQcMyNVhC | fjSCFMZciT | finished hero persistent, no misleading copy, re-entry recorded nothing (csd2/twi1200/rs0/se1) |
| RO-S10 | FAIL | 77rcu2CGsJ | x24R0gJUGx | RO-S10: submit produced a RESULTS screen — a FALSE SUCCESS on a day-guard collision (must rebuild); no day_guard_rejected log NOR day-guard  |
