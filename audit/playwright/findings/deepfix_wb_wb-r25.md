# deepfix M-WB (white-box) — wb-r25

**When:** 2026-07-15T12:11:25.650Z  
**BASE:** http://localhost:5173  
**Build:** local-dev  
**git:** a967f544e0f3d4bce72861ad82a34d8e2ec27206 (DIRTY)  
**List:** LSR Base Camp (audit clone) (base, 1200 words)  
**Result:** 0/6 PASS · 18 fatal anomalies · **NOT-CLEAN**

> White-box matrix — page.evaluate exception CONFINED to crafted preconditions; oracles observational.
> INVALID = a precondition/craft/env could not be materialized (setup, NOT a pass). Only PASS certifies.

| Scenario | Verdict | studentUid | classId | Detail |
|---|---|---|---|---|
| W-RA3g | INVALID | 6HvPE1Xw0G | RhvIl4k8hU | positive arm: could not reach the review test on a throttle day |
| W-RA4 | INVALID | UKUPShCfBf | AWRIcw93eF | no test route to clear config on |
| W-RA4b | INVALID | nr4U6nDvOU | xq65oTeoFK | could not reach a test route to inject on |
| CS-11 | INVALID | DfqtrxGwUt | G9CByU58Xo | mismatch arm: no new-word test route |
| CUT-5 | INVALID | xS8zB84Of8 | UoqmS5mt38 | could not reach a new-word test route to grade→save on |
| CUT-6 | INVALID | bQVcaMvdbG | lxwHLj8xpZ | could not reach a new-word test route to complete on |

**Fatal anomalies:**
- BUG: [W-RA3g] joined "25WT DFWB W-RA3g wb-r25" via F3WGKN but the class is NOT present after join — candidate phantom membership (enrolledClasses set, class studentI
- BUG: [W-RA4] joined "25WT DFWB W-RA4 wb-r25" via Y545BE but the class is NOT present after join — candidate phantom membership (enrolledClasses set, class studentIds
- BUG: [W-RA4b] joined "25WT DFWB W-RA4b wb-r25" via VJF6A7 but the class is NOT present after join — candidate phantom membership (enrolledClasses set, class studentI
- BUG: [CS-11] joined "25WT DFWB CS-11 wb-r25" via L28NVQ but the class is NOT present after join — candidate phantom membership (enrolledClasses set, class studentIds
- BUG: [CUT-5] joined "25WT DFWB CUT-5 wb-r25" via ZZJZBY but the class is NOT present after join — candidate phantom membership (enrolledClasses set, class studentIds
- BUG: [CUT-6] joined "25WT DFWB CUT-6 wb-r25" via R9KDVU but the class is NOT present after join — candidate phantom membership (enrolledClasses set, class studentIds
- request-failed: [wb-W-RA3g] GET http://localhost:5173/src/index.css?t=1784116837714 — net::ERR_ABORTED
- request-failed: [wb-W-RA3g] GET http://localhost:5173/src/index.css?t=1784116850813 — net::ERR_ABORTED
- request-failed: [wb-W-RA4] GET http://localhost:5173/src/index.css?t=1784116942901 — net::ERR_ABORTED
- request-failed: [wb-W-RA4] GET http://localhost:5173/src/index.css?t=1784116955924 — net::ERR_ABORTED
- request-failed: [wb-W-RA4b] GET http://localhost:5173/src/index.css?t=1784117064791 — net::ERR_ABORTED
- request-failed: [wb-W-RA4b] GET http://localhost:5173/src/index.css?t=1784117077770 — net::ERR_ABORTED
- request-failed: [wb-CS-11] GET http://localhost:5173/src/index.css?t=1784117187653 — net::ERR_ABORTED
- request-failed: [wb-CS-11] GET http://localhost:5173/src/index.css?t=1784117200844 — net::ERR_ABORTED
- request-failed: [wb-CUT-5] GET http://localhost:5173/src/index.css?t=1784117309948 — net::ERR_ABORTED
- request-failed: [wb-CUT-5] GET http://localhost:5173/src/index.css?t=1784117322989 — net::ERR_ABORTED
- request-failed: [wb-CUT-6] GET http://localhost:5173/src/index.css?t=1784117433603 — net::ERR_ABORTED
- request-failed: [wb-CUT-6] GET http://localhost:5173/src/index.css?t=1784117446583 — net::ERR_ABORTED
