# deepfix M-UI (RO+RS) — cert-59df732-r34

**When:** 2026-07-17T20:32:14.127Z  
**BASE:** https://vocaboostone.netlify.app  
**Build:** local-dev  
**git:** 59df732657dfb742d4392a47ae5c1d988377387a (DIRTY)  
**List:** LSR Base Camp (audit clone) (base, 1200 words)  
**Result:** 2/4 PASS · 1 fatal anomalies · **NOT-CLEAN**

> INVALID = a precondition/seed could not be materialized (setup problem), NOT a pass. Only PASS certifies.

| Scenario | Verdict | studentUid | classId | Detail |
|---|---|---|---|---|
| RO-S1 | FAIL | 3MUIeEHhrb | bONIZ64sy2 | exception: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test/  |
| RO-S9 | PASS | LZ9NeANMfI | 3hBiKD5tMv | finished hero persistent, no misleading copy, re-entry recorded nothing (csd2/twi1200/rs0/se0) |
| RS-1 | PASS | 3MUIeEHhrb | PTII7xEpV4 | deep student surfaced via server Name filter: Showing=20 (target 3); nameCell rendered account displayName (0 token-cells) |
| RS-2 | FAIL | 3MUIeEHhrb | r3lJjbMm2r | RS-2: testId-less attempt row NOT visible in the gradebook (dropped for lacking testId) |

**Fatal anomalies:**
- exception: [RO-S1] TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test| answers)?$/i }).first()
