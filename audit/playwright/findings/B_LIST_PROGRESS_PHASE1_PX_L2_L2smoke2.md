# Findings — B_LIST_PROGRESS_PHASE1 (PX_L2_L2smoke2)

**Run date:** 2026-07-12T16:28:17.708Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L2 S0 L2smoke2"
- [2026-07-12T16:29:27.134Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Jgxch6djSNu9vLF6WQ36HJITApoKuLbzSHhxLaCvPnejXms5K3qagQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:29:27.195Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Jgxch6djSNu9vLF6WQ36HJITApoKuLbzSHhxLaCvPnejXms5K3qagQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:29:36.892Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=xh6fDCKRCkw5JBsjDXBHYuGs2sqStBCSlJOTg4vOcvbRPkKzvzoinw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:29:40.971Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=LMq1AWCN-5bl1tHtcFkC7GcOzsg7bJs-FBA0oB1Omkso9nHH35B-MQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:29:41.899Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=LMq1AWCN-5bl1tHtcFkC7GcOzsg7bJs-FBA0oB1Omkso9nHH35B-MQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:29:45.368Z] **selector-gap** — 25WT PX L2 S0 L2smoke2: assign list select "LSR Ascent (audit clone)" (id=ssjsJSyeUk6F9yRXBuwN) failed
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L2 S0 L2smoke2 (pace=80 thr=92 mode=typed) → unverified
  - STEP [teacher] read join code for 25WT PX L2 S0 L2smoke2 → R5UVHT
