# Findings — B_LIST_PROGRESS_PHASE1 (RUNS1_S1_1783820763648)

**Run date:** 2026-07-12T01:46:12.871Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNS1 A S1_1783820763648"
- [2026-07-12T01:47:00.189Z] **selector-gap** — 25WT RUNS1 A S1_1783820763648: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T01:47:21.691Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=gR-C0RfxpTN41tHdiJm9XUtL9fLhvrk7gfvhx9U0Kpfb_Cj0SQpXEw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:47:21.731Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=gR-C0RfxpTN41tHdiJm9XUtL9fLhvrk7gfvhx9U0Kpfb_Cj0SQpXEw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:47:25.831Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=hqIHtsZJHzH5AWs_W-BT4AhaWI92J5CbKbHL3S_Gss3Y3NBwly2sxA&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:47:25.837Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=hqIHtsZJHzH5AWs_W-BT4AhaWI92J5CbKbHL3S_Gss3Y3NBwly2sxA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 A S1_1783820763648 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 A S1_1783820763648 → APHR4L
  - STEP [teacher] create class "25WT RUNS1 B S1_1783820763648"
- [2026-07-12T01:48:18.959Z] **selector-gap** — 25WT RUNS1 B S1_1783820763648: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T01:48:40.452Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=gKWJjzeLvXKMTH07DNnIr18BxU5LkJeZ9ERNLq6oHuQrsJb768wdJg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:48:44.583Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=LmEtsceOET-AXwpTAEu-NqyaHrAVMicALL2FiQQ_lzB6-xGrlv8DXg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 B S1_1783820763648 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 B S1_1783820763648 → E9KEQ6
  - STEP [s1-A] join "25WT RUNS1 A S1_1783820763648" via APHR4L → member
  - STEP [s1-B] join "25WT RUNS1 B S1_1783820763648" via E9KEQ6 → member
- [2026-07-12T01:49:17.385Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=qYm678c6s1e_epWGEtXFlTIYKgFnounLydkDhIYyvaUsWSbUTkiLLQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:49:17.393Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=N5tn6qdHe_sI1AJisRf90lterF6t6ZaZKrzthkw0c92ZALCLm_qdYQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:49:48.151Z] **native-dialog** — [s1-student] beforeunload:  — accept
- [2026-07-12T01:49:48.241Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-na_E3Hb21hm08Ws_6AJanJvKbeAHh6dYpuX8p5ia-MdKcPr_DIxng&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:49:48.249Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=xzHycavB9e219ywlGds_wXiQ6yDj4o9loQioHJDBY1yPSoMAgGCcBA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:50:09.346Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=N13tO4F_adg9ut8ZLLTMW-XRBvG4eKOC9ojSoVlNQ0SLyCKM103EwA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:50:09.352Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=pEamktYT1aWFmIdW-0-aVOhhly2PNKBk5dCgEDsimQfwQj2uZcHF6Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:50:17.421Z] **flow-gap** — [s1-B-review] no Review/Continue button
- [2026-07-12T01:50:17.505Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=i0zVHNVIQRRsUWT7CBOQbC_XkjeqvhITGpl6reZQd2VPPjiBr3Ob7w&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:50:17.511Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=m_qDzRcT8ZdkukJgCIn4c4GR3GBVUdbG1f_k-aZitTGhzbo9W7esQQ&VER=8&d — net::ERR_ABORTED
