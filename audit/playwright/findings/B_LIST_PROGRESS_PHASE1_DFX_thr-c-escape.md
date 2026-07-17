# Findings — B_LIST_PROGRESS_PHASE1 (DFX_thr-c-escape)

**Run date:** 2026-07-16T00:28:06.279Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFX THR-C thr-c-escape"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT DFX THR-C thr-c-escape (pace=3 thr=92 mode=typed) → ok
- [2026-07-16T00:29:06.346Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=gwVFoRqLqFwaEAjGQJOjkcw08RC7Sbdfglh8Jag1nY3vdv45xaXkJQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX THR-C thr-c-escape → 5M8598
  - STEP [THR-C] join "25WT DFX THR-C thr-c-escape" via 5M8598 → member
- [2026-07-16T00:29:25.240Z] **request-failed** — [student-THR-C] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=_XJ0qdQ0uJFiE9tviGKczym6zua5nQ24Bu_-95beDjn9Fqi_WpBYFw&VER=8&d — net::ERR_ABORTED
- [2026-07-16T00:29:25.251Z] **request-failed** — [student-THR-C] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_-oA3AqXSoI0KaDqsJoCOa9JQzpcMH-x7pIheN3DSKk-StRXprIFZA&VER=8& — net::ERR_ABORTED
