# Findings — B_LIST_PROGRESS_PHASE1 (DFX_winclaude-ui-r5)

**Run date:** 2026-07-14T15:28:32.713Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFX RA1 winclaude-ui-r5"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA1 winclaude-ui-r5 (pace=3 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT DFX RA1 winclaude-ui-r5 → 7Y8CGQ
  - STEP [RA1] join "25WT DFX RA1 winclaude-ui-r5" via 7Y8CGQ → member
- [2026-07-14T15:29:46.506Z] **flow-gap** — [RA1] single-list focus "LSR TOP Vocab (audit clone)" != "LSR Base Camp (audit clone)"
- [2026-07-14T15:30:23.650Z] **unexpected-dialog** — [student-RA1] UNEXPECTED native dialog (not armed): "" — auto-dismissed
  - STEP [teacher] create class "25WT DFX RA2 winclaude-ui-r5"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA2 winclaude-ui-r5 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T15:31:15.994Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-LxVnYi0xnJHNMOZfuWk-Hte4bUTTUm9t1JceVf2y8MEg4uTU00t7w&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA2 winclaude-ui-r5 → TYDUNZ
  - STEP [RA2] join "25WT DFX RA2 winclaude-ui-r5" via TYDUNZ → member
- [2026-07-14T15:31:34.268Z] **flow-gap** — [RA2] single-list focus "LSR TOP Vocab (audit clone)" != "LSR Base Camp (audit clone)"
- [2026-07-14T15:31:55.543Z] **flow-gap** — [RA2-d0] no Submit button
- [2026-07-14T15:32:14.389Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=kOb08ynpvWECsvqiOHIiVPnl_qxA3o7f77GVkSpuRkxqTWojpssUTw&VER=8&d — net::ERR_ABORTED
- [2026-07-14T15:32:14.420Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Sd7hlKT3LtThxWFv5M7CP0gVQIf0Wg8Ik7m8sW9nIOeOw7dp1VaJgg&VER=8& — net::ERR_ABORTED
- [2026-07-14T15:32:15.568Z] **flow-gap** — [RA2-d0] on test-results route but "Continue" never appeared (20s)
- [2026-07-14T15:32:21.024Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Sd7hlKT3LtThxWFv5M7CP0gVQIf0Wg8Ik7m8sW9nIOeOw7dp1VaJgg&VER=8& — net::ERR_ABORTED
- [2026-07-14T15:32:21.032Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=kOb08ynpvWECsvqiOHIiVPnl_qxA3o7f77GVkSpuRkxqTWojpssUTw&VER=8&d — net::ERR_ABORTED
