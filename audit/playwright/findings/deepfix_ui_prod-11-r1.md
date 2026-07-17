# deepfix M-UI (RO) — prod-11-r1

**When:** 2026-07-15T23:15:34.187Z  
**BASE:** https://vocaboostone.netlify.app  
**Build:** local-dev  
**git:** 4b8452aa7581f2758ec53ee4f3a89f2693122094 (DIRTY)  
**List:** LSR Base Camp (audit clone) (base, 1200 words)  
**Result:** 0/2 PASS · 2 fatal anomalies · **NOT-CLEAN**

> INVALID = a precondition/seed could not be materialized (setup problem), NOT a pass. Only PASS certifies.

| Scenario | Verdict | studentUid | classId | Detail |
|---|---|---|---|---|
| RA1 | FAIL | NQFeZxbhx0 | HQg9wmSfti | review-only day did not complete: outcome=not-reached |
| RA2 | FAIL | 7YHUFIyn5j | s3Q5B4JNDl | day 0 did not complete: not-reached |

**Fatal anomalies:**
- BUG: [RA1] joined "25WT DFX RA1 prod-11-r1" via 6EWUSU but the class is NOT present after join — candidate phantom membership (enrolledClasses set, class studentIds 
- BUG: [RA2] joined "25WT DFX RA2 prod-11-r1" via 6NVPYJ but the class is NOT present after join — candidate phantom membership (enrolledClasses set, class studentIds 
