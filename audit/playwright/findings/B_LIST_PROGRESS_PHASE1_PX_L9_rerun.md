# Findings — B_LIST_PROGRESS_PHASE1 (PX_L9_rerun)

**Run date:** 2026-07-12T19:19:33.516Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L9 S0 rerun"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L9 S0 rerun (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T19:20:31.313Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7B8-gSNH3ZqEjhYQPHV5SoIZk3ij0Sbb3xjlLCkOO9C8ZeSHHTbpSQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L9 S0 rerun → PD2QCJ
- [2026-07-12T19:20:39.830Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_1Az0ZX2tr91v4xWpb6yMfCxRAEijx0yE3moGBFZ5VlEt_dfijNXOA&VER=8& — net::ERR_ABORTED
  - STEP [L9-s0] join "25WT PX L9 S0 rerun" via PD2QCJ → member
- [2026-07-12T19:20:48.225Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_1Az0ZX2tr91v4xWpb6yMfCxRAEijx0yE3moGBFZ5VlEt_dfijNXOA&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:20:48.235Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=7EXiDAC8sLNQTdDm7KU0yMY1z8Zi9XmJrx-pUrI0xGndLOyibUgFZg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T19:21:27.896Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=FEFPCXQY1YQR7ssrQJzylVhrqd_Tj2YQFZDlRNGOfFvQIggj_dLW9Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:21:27.901Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ky34b54jrN2_uESMAEjxsLuYHeDwk6VlkhfAjMGsouIa1k8Euh4WRA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T19:21:33.126Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Ez-Y_1PRCQOeIxWqtyI0DGY93XpUljxi0MkDbglSIR09TP0PMrYrBA&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:21:33.132Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=qE2ikfUKLApHFuCB68lGKbFhHshY-u5ae4IU6C8K5Xc73CvprEcmqQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T19:22:09.649Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=2o9-3E6ldh3YX8MBcGGxg14diN5H1oEZ93HCxh5Dc3NHNDKxzfGCbA&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:22:09.656Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=RuJn7nSfDpKLk88UGz0QQK9C2Fjn99aSbHWAhAv-4LFufbcBNltpaw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T19:22:44.917Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=XbKIb3PEmu9VJ7YRAFSQlCSQKC9syzr-oDMlRWUlMCNNGSvUgv9W3A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T19:22:44.928Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=A9GmoZp5aD4tjvTwY27dJk6BRKEzNtrPlsrRSSjhZI8ZUzVJqkGeOQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:22:50.015Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=c18td_4_HBVwkEYnn_nxuykzpDgey6Ij-hlid2gSqWnShTp6yslxDA&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:22:50.019Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KG0iEPZs-MQCCrXI4_BK-EiwX4p3d6AocvrszdhwY1SmhaABsaoKww&VER=8&d — net::ERR_ABORTED
- [2026-07-12T19:23:09.609Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=vxOoU8slygqnUQWjGHVs6u02gn9yvlLcM8J4a-GVSVFEgA_ElSJGPA&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:23:09.616Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=X-g4znwsNnnvbC1cHifnJB5oGMtLJxULQQZCuRnzHUDAEEm6gWGvog&VER=8&d — net::ERR_ABORTED
