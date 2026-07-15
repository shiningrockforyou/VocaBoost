# deepfix M-UI (RO+RS) — winclaude-ui-r10

**When:** 2026-07-14T20:48:00.081Z  
**BASE:** http://localhost:5173  
**Build:** local-dev  
**git:** a967f544e0f3d4bce72861ad82a34d8e2ec27206 (DIRTY)  
**List:** LSR Base Camp (audit clone) (base, 1200 words)  
**Result:** 1/9 PASS · 5 fatal anomalies · **NOT-CLEAN**

> INVALID = a precondition/seed could not be materialized (setup problem), NOT a pass. Only PASS certifies.

| Scenario | Verdict | studentUid | classId | Detail |
|---|---|---|---|---|
| RS-1 | FAIL | 3MUIeEHhrb | I8FUKOh223 | RS-1: no gradebook row bearing the deep student's name "LSRDEEPDEZR" |
| RS-2 | FAIL | 3MUIeEHhrb | YVVFUfv4NB | RS-2: testId-less attempt row NOT visible in the gradebook (dropped for lacking testId) |
| RS-3 | FAIL | LZ9NeANMfI | U9RwgApzw3 | RS-3: list NOT shown on the teacher Assigned-Lists surface |
| RS-4 | INVALID | 3MUIeEHhrb | WuCd4Yu0pl | score 37% outside [90,95) — grader drift; re-calibrate the answer count (did not exercise the serverPassed-vs-0.95 gap) |
| RO-S1 | FAIL | LZ9NeANMfI | ljZZqy3Fd7 | RO-S1: csd 0->0 (want 0->1); twi 0->0 (want +pace); no passed new attempt recorded |
| RO-S9 | PASS | 3MUIeEHhrb | 9qErZsWA9G | finished hero persistent, no misleading copy, re-entry recorded nothing (csd2/twi1200/rs0/se0) |
| RO-S10 | FAIL | LZ9NeANMfI | HAcUwAqlfL | RO-S10: submit produced a RESULTS screen — a FALSE SUCCESS on a day-guard collision (must rebuild); no day_guard_rejected log NOR day-guard  |
| RA1 | FAIL | 3MUIeEHhrb | gCINfBpfgU | RA1 complete oracle: csd 4->4 (want +1); reviewAttempts not +1 |
| RA2 | FAIL | LZ9NeANMfI | 6oNZK7nIek | day 0 csd 4->4 (want +1) |

**Fatal anomalies:**
- request-failed: [student-RS-2] GET http://localhost:5173/src/index.css?t=1784061265539 — net::ERR_ABORTED
- request-failed: [student-RS-4] GET http://localhost:5173/src/index.css?t=1784061451106 — net::ERR_ABORTED
- request-failed: [student-RO-S1] GET http://localhost:5173/src/index.css?t=1784061565961 — net::ERR_ABORTED
- request-failed: [student-RO-S9] GET http://localhost:5173/src/index.css?t=1784061678430 — net::ERR_ABORTED
- request-failed: [student-RO-S10] GET http://localhost:5173/src/index.css?t=1784061791061 — net::ERR_ABORTED
