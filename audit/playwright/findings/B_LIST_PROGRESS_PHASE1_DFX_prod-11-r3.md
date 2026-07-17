# Findings — B_LIST_PROGRESS_PHASE1 (DFX_prod-11-r3)

**Run date:** 2026-07-15T23:26:54.436Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFX RA1 prod-11-r3"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA1 prod-11-r3 (pace=3 thr=92 mode=typed) → ok
- [2026-07-15T23:27:55.362Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=eIig9ST99Cho83BTjpj7LydMoKRDSHpYKOS9a5m-FXip11iZqy84aw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA1 prod-11-r3 → Q76DMQ
  - STEP [RA1] join "25WT DFX RA1 prod-11-r3" via Q76DMQ → member
- [2026-07-15T23:28:14.332Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ItO_oGEXoTNtMszf3I5o_KNwifOnkSSLNMnaCGSZtnpU2CdINHOOVw&VER=8&d — net::ERR_ABORTED
- [2026-07-15T23:28:14.346Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=l9G0IbA-_UOyQ2cfRf_zVNpcx4ddrkzof2yZKoWxd2ZPdG-yT_LIog&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:28:54.577Z] **selector-gap** — [RA1] Session-menu button not visible after 29999ms
- [2026-07-15T23:29:05.267Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nX3wKIxCoXOY7ifh4T5jp2zr4NvehOOcmHFIF9FGRstnMcXVRh9mhQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] create class "25WT DFX RA2 prod-11-r3"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA2 prod-11-r3 (pace=3 thr=92 mode=typed) → ok
- [2026-07-15T23:30:00.717Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nKq6B4_JGQ4bNT8gHRF2MfTSS030AZ1mYBf0rsMf-qyi7POG6Cd9iw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA2 prod-11-r3 → C7VTMC
  - STEP [RA2] join "25WT DFX RA2 prod-11-r3" via C7VTMC → member
- [2026-07-15T23:30:19.752Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=4E0l_CgGyqHaSTPBY54IowFgukRiyks-xC7JZpgiv4zcppXtB4EqNg&VER=8&d — net::ERR_ABORTED
- [2026-07-15T23:30:19.762Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=vVCuMLz851v_fIpl9pGKEo4dfp-qfSATtjcIhvexA84MSiO6X4JuPQ&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:31:00.099Z] **selector-gap** — [RA2-d0] Session-menu button not visible after 30000ms
- [2026-07-15T23:31:10.814Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=4jBBgC1M3ky2zUNOVkM1hNezgxj8u6qBPjM29Tw2ixN3a9_ndQxw5Q&VER=8& — net::ERR_ABORTED
