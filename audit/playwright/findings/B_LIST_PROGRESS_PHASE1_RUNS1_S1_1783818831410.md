# Findings — B_LIST_PROGRESS_PHASE1 (RUNS1_S1_1783818831410)

**Run date:** 2026-07-12T01:14:01.365Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNS1 A S1_1783818831410"
- [2026-07-12T01:14:48.572Z] **selector-gap** — 25WT RUNS1 A S1_1783818831410: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T01:15:10.103Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=qXu77QOuPFZkysgXsaj-Ijicb_yaD9_Dr3h-HdIfp_QUpIepyfsTMg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:15:14.182Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=rPQKCKcsK6dGgUjb5eRwxrPwTvrbI4ZZp8u1dnkj4SOfAY486340LQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 A S1_1783818831410 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 A S1_1783818831410 → L6GEAE
  - STEP [teacher] create class "25WT RUNS1 B S1_1783818831410"
- [2026-07-12T01:16:07.341Z] **selector-gap** — 25WT RUNS1 B S1_1783818831410: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T01:16:28.835Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=OH9Ae0SBZDwsMTn2-AtWPkNypBGSNtv0dBT1fHZ7iGEGfNg9n8r_QQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:16:32.963Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Pw-VUZ6FXXLOwjHx-1-mP7zKascDFwmzL-PVwKD-R1KIbBiEl3Qb_g&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 B S1_1783818831410 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 B S1_1783818831410 → 9896DB
  - STEP [s1-A] join "25WT RUNS1 A S1_1783818831410" via L6GEAE → member
  - STEP [s1-B] join "25WT RUNS1 B S1_1783818831410" via 9896DB → member
- [2026-07-12T01:17:16.398Z] **flow-gap** — [s1-A-d1-new] no Start-New-Words/Continue button
- [2026-07-12T01:17:21.811Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:17:24.233Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 A S1_1783818831410"
- [2026-07-12T01:17:36.239Z] **flow-gap** — [s1-A] single-list focus "" != "LSR TOP Vocab (audit clone)"
- [2026-07-12T01:17:36.245Z] **flow-gap** — [s1-A-d2] no Start Session/Continue to enter the session
- [2026-07-12T01:17:36.254Z] **flow-gap** — [s1-A-d2-new] no Start-New-Words/Continue button
- [2026-07-12T01:17:36.963Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=9XNW4azN3ouE_JqcDS5FfrlGvA_n9e_dd2Lv0YLqjTukmgBohSXxWQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:17:41.990Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=aKHUWYpfTCy0rVylZmUDelW8yrGqEQBrmgQPcZ_ZMVC7t0unsKwEBw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:17:45.991Z] **flow-gap** — [s1-B-review] no Review/Continue button
- [2026-07-12T01:17:51.403Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:17:53.821Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 A S1_1783818831410"
- [2026-07-12T01:18:05.828Z] **flow-gap** — [s1-A] single-list focus "" != "LSR TOP Vocab (audit clone)"
- [2026-07-12T01:18:05.835Z] **flow-gap** — [s1-A-reenter] no Start Session/Continue to enter the session
