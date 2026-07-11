# Findings — B_LIST_PROGRESS_PHASE1 (RUNLDRVSMOKE_mr8g2zjk)

**Run date:** 2026-07-05T23:51:15.824Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNLSMOKE mr8g2zjk"
- [2026-07-05T23:52:02.844Z] **selector-gap** — 25WT RUNLSMOKE mr8g2zjk: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-05T23:52:24.372Z] **request-failed** — [drvsmoke-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=uXjYYcP-xmPpszVPCgHyWpFERZ5VePZBfEDDa9s4I6rKJW3czjmrCA&VER=8&d — net::ERR_ABORTED
- [2026-07-05T23:52:24.399Z] **request-failed** — [drvsmoke-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=uXjYYcP-xmPpszVPCgHyWpFERZ5VePZBfEDDa9s4I6rKJW3czjmrCA&VER=8&d — net::ERR_ABORTED
- [2026-07-05T23:52:28.473Z] **request-failed** — [drvsmoke-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=I7iUdpnqqQNW_r9MfFtRIT5_szdv0ZAidFAZ105ejmdw9ic-Haljiw&VER=8& — net::ERR_ABORTED
- [2026-07-05T23:52:28.487Z] **request-failed** — [drvsmoke-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=I7iUdpnqqQNW_r9MfFtRIT5_szdv0ZAidFAZ105ejmdw9ic-Haljiw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNLSMOKE mr8g2zjk (pace=80 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNLSMOKE mr8g2zjk → UURVGJ
  - STEP [drvsmoke] join "25WT RUNLSMOKE mr8g2zjk" via UURVGJ → member
- [2026-07-05T23:53:24.936Z] **request-failed** — [drvsmoke-stu] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=kfCvN9XQ4PEYBPi709_KqFCj1ZqBySVF44yAxiD8JwlauAYjyJAMTg&VER=8& — net::ERR_ABORTED
- [2026-07-05T23:53:24.941Z] **request-failed** — [drvsmoke-stu] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=oEcVlM4yuSmnWsE-ehytncvekoyTW-BSI519-9zCkMF8Mf8BqwBhzg&VER=8&d — net::ERR_ABORTED
- [2026-07-05T23:53:42.148Z] **flow-gap** — [drvsmoke-enter] clicked Start but no session screen confirmed
