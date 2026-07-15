# Findings — B_LIST_PROGRESS_PHASE1 (PX_L8_L8diag)

**Run date:** 2026-07-12T17:02:51.552Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L8 S0 L8diag"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L8 S0 L8diag (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T17:03:51.984Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=hC-uTBe2Uh0q7fxSipIOCEbCOr4soSghJ_3z8fZmbZxWvXWDHF5VVQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L8 S0 L8diag → SU6K46
- [2026-07-12T17:04:01.087Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=vC6p7N1zbXdXY4eFvcUuZVuoYaq3W2VsXFxFFVYH8KAWU6kbWqjhiQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:04:01.093Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=vC6p7N1zbXdXY4eFvcUuZVuoYaq3W2VsXFxFFVYH8KAWU6kbWqjhiQ&VER=8& — net::ERR_ABORTED
  - STEP [L8-s0] join "25WT PX L8 S0 L8diag" via SU6K46 → member
- [2026-07-12T17:04:12.113Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=TrdSuGbz8Brse4CKCNlIo1KM44GvgAg_247g88ihl4rM7ARgWelK4Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:04:12.121Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=M6chaba28FTH5j_JbEuAo0_cYntWmLUX8kJapILEibzw3ne1GpAodQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:04:49.353Z] **flow-gap** — [base-d1-exit] on test-results route but no "Continue" button
- [2026-07-12T17:04:49.594Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Ylo-LPtuxd88Pez8CB7a6Tw4F1IH2XQxA1xEuDS_0ojAPOibidWVdQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:04:49.603Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=gyInvmzg2fCR10wrQ14zhnOqMpAYUDS-xZAEJARX4c7f65V7KagMHw&VER=8&d — net::ERR_ABORTED
