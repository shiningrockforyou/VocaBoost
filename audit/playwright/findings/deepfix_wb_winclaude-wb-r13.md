# deepfix M-WB (white-box) — winclaude-wb-r13

**When:** 2026-07-14T21:42:08.926Z  
**BASE:** http://localhost:5173  
**Build:** local-dev  
**git:** a967f544e0f3d4bce72861ad82a34d8e2ec27206 (DIRTY)  
**List:** LSR Base Camp (audit clone) (base, 1200 words)  
**Result:** 0/6 PASS · 2 fatal anomalies · **NOT-CLEAN**

> White-box matrix — page.evaluate exception CONFINED to crafted preconditions; oracles observational.
> INVALID = a precondition/craft/env could not be materialized (setup, NOT a pass). Only PASS certifies.

| Scenario | Verdict | studentUid | classId | Detail |
|---|---|---|---|---|
| W-RA3g | FAIL | 3MUIeEHhrb | rc0h85vb6d | positive arm: csd 4->4 (want +1 — gate should have been skipped) |
| W-RA4 | FAIL | LZ9NeANMfI | Kva1GRCZZ9 | exception: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test/ answers)?$ |
| W-RA4b | FAIL | rB87oxUQt2 | lhVeyS6nrU | exception: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test/ answers)?$ |
| CS-11 | INVALID | 3MUIeEHhrb | 7ocFhBdsr0 | crafted mismatch produced NO reviewonly_derivation_mismatch (outA=results) — SERVER_PROGRESS_WRITE/completeSession tripwire not active in this env (or |
| CUT-5 | INVALID | LZ9NeANMfI | t7pw2tH50j | no NEW attempt doc created (outcome=results) — save leg not observed |
| CUT-6 | INVALID | rB87oxUQt2 | bvfBTsXoCV | injected direct-write handle failed (Vite /src/firebase.js import path calibration): Failed to resolve module specifier 'firebase/firestore' |

**Fatal anomalies:**
- exception: [W-RA4] TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test| answers)?$/i }).first()
- exception: [W-RA4b] TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test| answers)?$/i }).first(
