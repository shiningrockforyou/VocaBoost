# Findings — B_LIST_PROGRESS_PHASE1 (DFX_winclaude-ui-r14)

**Run date:** 2026-07-14T21:55:28.645Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFX RO-S1 winclaude-ui-r14"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RO-S1 winclaude-ui-r14 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T21:56:19.801Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=uovYf5tlRB7bYZFoW7k6gFL7KF_4GhNhpsucbsqQ-dDafG_CFwSWXA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RO-S1 winclaude-ui-r14 → BD8M23
  - STEP [RO-S1] join "25WT DFX RO-S1 winclaude-ui-r14" via BD8M23 → member
- [2026-07-14T21:56:38.957Z] **request-failed** — [student-RO-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Hk3sQRufRrlHjxmI8-MtqelStxeSLzfipkVXo73c0caM_kM3nusnAw&VER=8&d — net::ERR_ABORTED
- [2026-07-14T21:56:38.960Z] **request-failed** — [student-RO-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=u3pz3mcsoy9v7Hai7G_NbFm3VLLsyFjGPTabh2MpazGhwRqVrdEWig&VER=8& — net::ERR_ABORTED
