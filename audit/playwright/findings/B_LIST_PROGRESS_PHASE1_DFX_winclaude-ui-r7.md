# Findings — B_LIST_PROGRESS_PHASE1 (DFX_winclaude-ui-r7)

**Run date:** 2026-07-14T15:52:19.516Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFX RA1 winclaude-ui-r7"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA1 winclaude-ui-r7 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T15:53:12.002Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ZFAQ4jOS2IFqrhyeS9mV-fqddIipADfUY0acyr4_Jt8oryu8GHhSHg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA1 winclaude-ui-r7 → 2289AR
  - STEP [RA1] join "25WT DFX RA1 winclaude-ui-r7" via 2289AR → member
- [2026-07-14T15:53:31.516Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ahKs7QRUyDCqCqrge2ZjI3dP2WLjR50Mqg5RpuD5hf5QzoOk4k1juw&VER=8&d — net::ERR_ABORTED
- [2026-07-14T15:53:31.524Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=xXxzqdy9rnYeFsxNxIXcb2ZhC13kt-S5N5n-pakn0BLl5ullFhNj1A&VER=8& — net::ERR_ABORTED
- [2026-07-14T15:54:12.601Z] **selector-gap** — [RA1] Session-menu button not visible after 30013ms
  - STEP [teacher] create class "25WT DFX RA2 winclaude-ui-r7"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA2 winclaude-ui-r7 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T15:55:03.986Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=3-mms6qxcEHx6oQngyR74TlkxM6OmeLIersnAlcBgeYQSGdi0PpI1g&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA2 winclaude-ui-r7 → TUZ496
  - STEP [RA2] join "25WT DFX RA2 winclaude-ui-r7" via TUZ496 → member
- [2026-07-14T15:55:23.503Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=_NjqcSPCidNDMx3onybPnfGHel-ojKkVq5wv2wdEdG6yPyLx4ZlG9A&VER=8&d — net::ERR_ABORTED
- [2026-07-14T15:55:23.511Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8TnMZS6DHxx7Qxw-VzEUIScvtDLCMjSkolTH-4NkNeqkoy2P8RVGzQ&VER=8& — net::ERR_ABORTED
- [2026-07-14T15:56:04.645Z] **selector-gap** — [RA2-d0] Session-menu button not visible after 30007ms
