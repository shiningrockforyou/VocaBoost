# Findings — B_LIST_PROGRESS_PHASE1 (DFX_winclaude-ui-r16)

**Run date:** 2026-07-15T10:35:04.109Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFX RS-1 winclaude-ui-r16"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RS-1 winclaude-ui-r16 (pace=3 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT DFX RS-1 winclaude-ui-r16 → QL3HRL
  - STEP [RS-1] join "25WT DFX RS-1 winclaude-ui-r16" via QL3HRL → member
- [2026-07-15T10:36:18.702Z] **request-failed** — [student-RS-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=l_di4SYQd_FDydhCPzCFESPftRZIJ_SYtgJOIEVxVg4ugC_eNP9FNQ&VER=8&d — net::ERR_ABORTED
- [2026-07-15T10:36:18.706Z] **request-failed** — [student-RS-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=LUvuSWtjUNyjORyX4G2D_H6OIpSJYTcgNa8PsLZnW-dC0AAZhCfHzg&VER=8& — net::ERR_ABORTED
- [2026-07-15T10:36:30.185Z] **request-failed** — [teacher-RS-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=FS1FnoGvRudm_TaerfsOL9Td6YEHtdemgdiE4j6bz0rd76cjNYkqug&VER=8& — net::ERR_ABORTED
  - STEP [teacher] create class "25WT DFX RO-S1 winclaude-ui-r16"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RO-S1 winclaude-ui-r16 (pace=3 thr=92 mode=typed) → ok
- [2026-07-15T10:37:29.378Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=z6VUXVHjFoCNCF6MQaXXZ6J1jvPR_XlGnzViwM9v0YsopWguDW0a9A&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RO-S1 winclaude-ui-r16 → Q4BHWP
  - STEP [RO-S1] join "25WT DFX RO-S1 winclaude-ui-r16" via Q4BHWP → member
- [2026-07-15T10:37:49.023Z] **request-failed** — [student-RO-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=iIQeXUSKar5fK6JfDof_R-Y61wUN6MmPBLkSqsdcIzwCcxFnP9A9OA&VER=8&d — net::ERR_ABORTED
- [2026-07-15T10:37:49.028Z] **request-failed** — [student-RO-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7XObX3wi4ymgrOTiDM6c1TOVj_zhYoadtxb49olsKyI_6sxAJMmVCQ&VER=8& — net::ERR_ABORTED
