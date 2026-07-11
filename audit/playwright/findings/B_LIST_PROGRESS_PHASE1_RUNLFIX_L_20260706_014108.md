# Findings — B_LIST_PROGRESS_PHASE1 (RUNLFIX_L_20260706_014108)

**Run date:** 2026-07-06T01:41:14.095Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNL L1-T L_20260706_014108"
- [2026-07-06T01:42:01.644Z] **selector-gap** — 25WT RUNL L1-T L_20260706_014108: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-06T01:42:23.175Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=DFZwYl95tpdCw7tSDizFUXvCCnD7OFV9o5snuFUVDfBaR1WSdYavqw&VER=8&d — net::ERR_ABORTED
- [2026-07-06T01:42:27.264Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=0MvlLI6dsKf4-mPlI1CP4a08sffOgsTuoA7TxzPXfted960f6dmocQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNL L1-T L_20260706_014108 (pace=80 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNL L1-T L_20260706_014108 → LTXM37
  - STEP [teacher] create class "25WT RUNL L1-M L_20260706_014108"
- [2026-07-06T01:43:20.181Z] **selector-gap** — 25WT RUNL L1-M L_20260706_014108: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-06T01:43:41.788Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=L7IknjCdFD-FMTmmEk9eXobFcq4BvttSAi-7b-McpMa4n9vNoBYY1Q&VER=8&d — net::ERR_ABORTED
- [2026-07-06T01:43:45.810Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=lSeRBIhk__jZpsTVKLbtsvamUQYVpMv_IPBhcMJnpq3ctMyvYIVGZw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNL L1-M L_20260706_014108 (pace=80 thr=92 mode=mcq) → ok
  - STEP [teacher] read join code for 25WT RUNL L1-M L_20260706_014108 → PBBBZM
  - STEP [teacher] create class "25WT RUNL L1-R L_20260706_014108"
- [2026-07-06T01:44:38.741Z] **selector-gap** — 25WT RUNL L1-R L_20260706_014108: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-06T01:45:00.310Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=huT45Do3Xk7dQQ-VHcHU3i7ORlqeErpWTQJkIMv775jf4CFa8owBtQ&VER=8&d — net::ERR_ABORTED
- [2026-07-06T01:45:04.359Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=NJ9cnluf0JWc86i_oBTULddPIJfJPDi9jzurUXnYsHScO-MZrsG5ow&VER=8& — net::ERR_ABORTED
- [2026-07-06T01:45:04.362Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=NJ9cnluf0JWc86i_oBTULddPIJfJPDi9jzurUXnYsHScO-MZrsG5ow&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNL L1-R L_20260706_014108 (pace=80 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNL L1-R L_20260706_014108 → T3QR5X
  - STEP [teacher] create class "25WT RUNL L2B L_20260706_014108"
- [2026-07-06T01:45:57.352Z] **selector-gap** — 25WT RUNL L2B L_20260706_014108: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-06T01:46:18.946Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Fl_Fxa0ctf-8pOLwDpm5baSmSe7gOEYfLfq8YEQb1__ldJNHwyH8lA&VER=8&d — net::ERR_ABORTED
- [2026-07-06T01:46:22.989Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=9C5MgojyPXTAX0JTRj4Q0W9-H1zBS_S0hrmyUWn0RgcT2yQpBfDwyA&VER=8& — net::ERR_ABORTED
- [2026-07-06T01:46:22.998Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=9C5MgojyPXTAX0JTRj4Q0W9-H1zBS_S0hrmyUWn0RgcT2yQpBfDwyA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNL L2B L_20260706_014108 (pace=80 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNL L2B L_20260706_014108 → YG2QA2
  - STEP [L1-T] join "25WT RUNL L1-T L_20260706_014108" via LTXM37 → member
  - STEP [L1-M] join "25WT RUNL L1-M L_20260706_014108" via PBBBZM → member
  - STEP [L1-R] join "25WT RUNL L1-R L_20260706_014108" via T3QR5X → member
  - STEP [L2] join "25WT RUNL L2B L_20260706_014108" via YG2QA2 → member
