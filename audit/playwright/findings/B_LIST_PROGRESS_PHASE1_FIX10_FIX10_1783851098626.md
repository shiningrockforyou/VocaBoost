# Findings — B_LIST_PROGRESS_PHASE1 (FIX10_FIX10_1783851098626)

**Run date:** 2026-07-12T10:11:49.654Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT FIX10 TYPED FIX10_1783851098626"
- [2026-07-12T10:12:37.369Z] **selector-gap** — 25WT FIX10 TYPED FIX10_1783851098626: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T10:12:58.868Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Ud_qAwe_b9UK7vFL1gp7l_yJ7h8Y7o9JtG5uknjjMcxTSXxWM_Phdw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:12:58.908Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Ud_qAwe_b9UK7vFL1gp7l_yJ7h8Y7o9JtG5uknjjMcxTSXxWM_Phdw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:13:03.001Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iFGP5kyGHzaGLXUMjiGmPVyLExKr3C-X6uyjDv1dzSDBqPjCMBwLBA&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:13:03.016Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iFGP5kyGHzaGLXUMjiGmPVyLExKr3C-X6uyjDv1dzSDBqPjCMBwLBA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT FIX10 TYPED FIX10_1783851098626 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT FIX10 TYPED FIX10_1783851098626 → HQTJX7
  - STEP [teacher] create class "25WT FIX10 MCQ FIX10_1783851098626"
- [2026-07-12T10:13:56.145Z] **selector-gap** — 25WT FIX10 MCQ FIX10_1783851098626: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T10:14:17.644Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=QW1UBkeAUizP5zJhBEsJhiVU7QgvNc0OndwuM7m6PhHHwOi5K-YC_w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:14:21.763Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=amfzsDFnkG7uKwS5_v4KCb1_utNxV-vrvsc60HvBvPaAtT2cl5B1Dw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT FIX10 MCQ FIX10_1783851098626 (pace=20 thr=92 mode=mcq) → ok
  - STEP [teacher] read join code for 25WT FIX10 MCQ FIX10_1783851098626 → AX3HQR
  - STEP [TD1] join "25WT FIX10 TYPED FIX10_1783851098626" via HQTJX7 → member
  - STEP [TD2] join "25WT FIX10 TYPED FIX10_1783851098626" via HQTJX7 → member
  - STEP [MD1] join "25WT FIX10 MCQ FIX10_1783851098626" via AX3HQR → member
  - STEP [MD2] join "25WT FIX10 MCQ FIX10_1783851098626" via AX3HQR → member
