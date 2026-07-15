# Findings — B_LIST_PROGRESS_PHASE1 (FIX10_FIX10_1783849850944)

**Run date:** 2026-07-12T09:51:01.042Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT FIX10 TYPED FIX10_1783849850944"
- [2026-07-12T09:51:49.727Z] **selector-gap** — 25WT FIX10 TYPED FIX10_1783849850944: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T09:52:11.252Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=lCTtHo9vM8zxgde1shXfPjAICcatc-DY9kayb9yk8zFj0DOBcRKtsA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T09:52:15.298Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qBHJdB4k2acyxoruioSlkDRIhPm0yM_wgkpBGcLx1dgmy7VdJepBzg&VER=8& — net::ERR_ABORTED
- [2026-07-12T09:52:15.395Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qBHJdB4k2acyxoruioSlkDRIhPm0yM_wgkpBGcLx1dgmy7VdJepBzg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT FIX10 TYPED FIX10_1783849850944 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT FIX10 TYPED FIX10_1783849850944 → UBVBNH
  - STEP [teacher] create class "25WT FIX10 MCQ FIX10_1783849850944"
- [2026-07-12T09:53:08.545Z] **selector-gap** — 25WT FIX10 MCQ FIX10_1783849850944: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T09:53:30.058Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=VCJRu1p0R2Qdcmtd87fnauaHCVsixA9H9SEqwAFmrjK222KN3xyslw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T09:53:34.179Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=JOUeHoZegdEwtPuXvwfEbUAbk5S3Mkodlc-k87hn57bsTkp7Ae-a0Q&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT FIX10 MCQ FIX10_1783849850944 (pace=20 thr=92 mode=mcq) → ok
  - STEP [teacher] read join code for 25WT FIX10 MCQ FIX10_1783849850944 → NRUCBX
  - STEP [TD1] join "25WT FIX10 TYPED FIX10_1783849850944" via UBVBNH → member
- [2026-07-12T09:54:10.018Z] **request-failed** — [fix10-TD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=JYOzjv3Hsk362RCF2aKIFCRwrixH9tD5J1M1_aCCAnl4FgYDyD4Nfg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T09:54:10.023Z] **request-failed** — [fix10-TD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=yIAg78xnyNtR7ErAn-65u59LKWFNKN3L-TM33lWKrgJa4I2Z_Q092w&VER=8& — net::ERR_ABORTED
  - STEP [TD2] join "25WT FIX10 TYPED FIX10_1783849850944" via UBVBNH → member
- [2026-07-12T09:55:32.931Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=mDSuHTfxij_iRkrZcet_31in6ul0dHTGGpmwMCvKJr7o52_d23yYQQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T09:55:32.946Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=z0Lmqagt0TY3IoB7no1GLxGYRZ-xLS_TCp-Gc2I3yP-cEpFcegBYXQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T09:56:13.736Z] **selector-gap** — [TD2-setup-d1] "Skip to Test" not in menu (queue empty?)
- [2026-07-12T09:56:28.744Z] **flow-gap** — [TD2-setup-d1] test page (typed or MCQ) not reached
  - STEP [MD1] join "25WT FIX10 MCQ FIX10_1783849850944" via NRUCBX → member
- [2026-07-12T09:56:43.972Z] **request-failed** — [fix10-MD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Dw4EE_fcz1u56dT4huOOk8jEkmBqJWa5LIyJGOnjXNzbqyM3ZT8FqA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T09:56:43.979Z] **request-failed** — [fix10-MD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=QTLCfxrN4EV3hq2_CkRUKH83HPA5zKQ5MNYfiQvxLnkmV_ET0j3kvg&VER=8& — net::ERR_ABORTED
  - STEP [MD2] join "25WT FIX10 MCQ FIX10_1783849850944" via NRUCBX → member
- [2026-07-12T09:57:36.053Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=3ePwnp0VjCPI38kYZV-m-_ZR6Sve4Jvi4pWV4W5hHFiFY2gj2HVJ3w&VER=8& — net::ERR_ABORTED
- [2026-07-12T09:57:36.062Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=QuAlUWB8AxBvCrq4dV94lOqKeVJsWd0_3ZO4n5Bm3yR3-leslb1AWw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T09:58:02.560Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=RUih83t7r4GPf40vp77F-ioGp1CTtFHSTdqSPSorejLgzhiAOlJjBQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T09:58:02.565Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=139l2dQMSFdHcZEYH6y2ZDfJl8Ht4SEaxiQaV7qBgWLAXwHLa2ErAQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T09:58:39.053Z] **selector-gap** — [MD2-setup-d2new] Session-menu button not visible
- [2026-07-12T09:58:54.131Z] **flow-gap** — [MD2-setup-d2new] test page (typed or MCQ) not reached
