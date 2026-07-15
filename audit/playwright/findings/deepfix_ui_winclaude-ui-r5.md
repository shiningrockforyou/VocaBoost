# deepfix M-UI (RO) — winclaude-ui-r5

**When:** 2026-07-14T15:32:24.296Z  
**BASE:** http://localhost:5173  
**Build:** local-dev  
**git:** a967f544e0f3d4bce72861ad82a34d8e2ec27206 (DIRTY)  
**List:** LSR Base Camp (audit clone) (base, 1200 words)  
**Result:** 0/2 PASS · 1 fatal anomalies · **NOT-CLEAN**

> INVALID = a precondition/seed could not be materialized (setup problem), NOT a pass. Only PASS certifies.

| Scenario | Verdict | studentUid | classId | Detail |
|---|---|---|---|---|
| RA1 | FAIL | 3MUIeEHhrb | fLYKxVrETb | RA1 complete oracle: csd 4->4 (want +1); reviewAttempts not +1 |
| RA2 | FAIL | LZ9NeANMfI | dOUctcUAW6 | day 0 did not complete: no-submit |

**Fatal anomalies:**
- unexpected-dialog: [student-RA1] UNEXPECTED native dialog (not armed): "" — auto-dismissed
