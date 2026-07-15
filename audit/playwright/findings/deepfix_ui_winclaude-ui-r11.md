# deepfix M-UI (RO+RS) — winclaude-ui-r11

**When:** 2026-07-14T21:11:24.577Z  
**BASE:** http://localhost:5173  
**Build:** local-dev  
**git:** a967f544e0f3d4bce72861ad82a34d8e2ec27206 (DIRTY)  
**List:** LSR Base Camp (audit clone) (base, 1200 words)  
**Result:** 2/7 PASS · 0 fatal anomalies · **NOT-CLEAN**

> INVALID = a precondition/seed could not be materialized (setup problem), NOT a pass. Only PASS certifies.

| Scenario | Verdict | studentUid | classId | Detail |
|---|---|---|---|---|
| RS-1 | FAIL | 3MUIeEHhrb | 0RtHprgRIW | RS-1: Showing=8 > target attempts 3 — filter not server-side (filler rows leaked) |
| RS-2 | PASS | rB87oxUQt2 | ovAqekNuBA | testId-less attempt renders with list title "LSR Base Camp (audit clone)" (1 row(s)) |
| RS-3 | FAIL | 3MUIeEHhrb | bTDEMySy3Y | RS-3: list NOT shown on the teacher Assigned-Lists surface |
| RS-4 | INVALID | LZ9NeANMfI | DPejdH3pxI | score 40% outside [90,95) — grader drift; re-calibrate the answer count (did not exercise the serverPassed-vs-0.95 gap) |
| RO-S1 | FAIL | rB87oxUQt2 | VBcgagcaNH | RO-S1: csd 0->0 (want 0->1); twi 0->0 (want +pace); no passed new attempt recorded |
| RO-S9 | PASS | 3MUIeEHhrb | i2IH96G65O | finished hero persistent, no misleading copy, re-entry recorded nothing (csd2/twi1200/rs0/se0) |
| RO-S10 | FAIL | LZ9NeANMfI | wL6TrVluY9 | RO-S10: submit produced a RESULTS screen — a FALSE SUCCESS on a day-guard collision (must rebuild); no day_guard_rejected log NOR day-guard  |
