# deepfix M-WB (white-box) — winclaude-wb-r14

**When:** 2026-07-14T21:55:26.878Z  
**BASE:** http://localhost:5173  
**Build:** local-dev  
**git:** a967f544e0f3d4bce72861ad82a34d8e2ec27206 (DIRTY)  
**List:** LSR Base Camp (audit clone) (base, 1200 words)  
**Result:** 0/4 PASS · 2 fatal anomalies · **NOT-CLEAN**

> White-box matrix — page.evaluate exception CONFINED to crafted preconditions; oracles observational.
> INVALID = a precondition/craft/env could not be materialized (setup, NOT a pass). Only PASS certifies.

| Scenario | Verdict | studentUid | classId | Detail |
|---|---|---|---|---|
| W-RA3g | FAIL | 3MUIeEHhrb | Tqsu4hMCXB | positive arm: csd 4->4 (want +1 — gate should have been skipped) |
| W-RA4 | FAIL | LZ9NeANMfI | wG8NuTqHBk | exception: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test/ answers)?$ |
| W-RA4b | FAIL | rB87oxUQt2 | VJ3Bw4B7OB | exception: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test/ answers)?$ |
| CUT-5 | INVALID | 3MUIeEHhrb | Z0coNo6qFV | no NEW attempt doc created (outcome=results) — save leg not observed |

**Fatal anomalies:**
- exception: [W-RA4] TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test| answers)?$/i }).first()
- exception: [W-RA4b] TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test| answers)?$/i }).first(
