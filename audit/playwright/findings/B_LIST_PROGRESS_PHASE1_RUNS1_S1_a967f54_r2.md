# Findings — B_LIST_PROGRESS_PHASE1 (RUNS1_S1_a967f54_r2)

**Run date:** 2026-07-12T11:25:57.168Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNS1 A S1_a967f54_r2"
- [2026-07-12T11:26:44.449Z] **selector-gap** — 25WT RUNS1 A S1_a967f54_r2: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T11:27:05.867Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=p3BKDUdvPof_7K2_2Z3GGldaQkWbfSG6t2Nsyfm5QGIHC4a9PLC8Bg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:27:05.897Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=p3BKDUdvPof_7K2_2Z3GGldaQkWbfSG6t2Nsyfm5QGIHC4a9PLC8Bg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:27:10.052Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qwR8MhcyFIIy_mTGg5K-oRmIIszRTkOiDLWTWfBkhzmMI7G5hp88vA&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:27:10.074Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qwR8MhcyFIIy_mTGg5K-oRmIIszRTkOiDLWTWfBkhzmMI7G5hp88vA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 A S1_a967f54_r2 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 A S1_a967f54_r2 → JP9PA8
  - STEP [teacher] create class "25WT RUNS1 B S1_a967f54_r2"
- [2026-07-12T11:28:03.159Z] **selector-gap** — 25WT RUNS1 B S1_a967f54_r2: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T11:28:24.691Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=4yMF5nXkyXweE2bxW_04lfP-EOGeeSUMMeNGQty1KX-VmW5WSdF1Tw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:28:28.789Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-B82CJ8YCHJtyJcXiSDq9hjD9kHkCg1Y4o_LEACjw00c6ew6Noq9Tw&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:28:28.796Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-B82CJ8YCHJtyJcXiSDq9hjD9kHkCg1Y4o_LEACjw00c6ew6Noq9Tw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 B S1_a967f54_r2 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 B S1_a967f54_r2 → QMVKYZ
  - STEP [s1-A] join "25WT RUNS1 A S1_a967f54_r2" via JP9PA8 → member
  - STEP [s1-B] join "25WT RUNS1 B S1_a967f54_r2" via QMVKYZ → member
- [2026-07-12T11:29:01.999Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_LHMXDAKnICyIeUAMC4kkUuC8pr1Jurh_nqRlj2tWNHL4k9ZZtH-9Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:29:02.003Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=vje929_B7AIV2QTlVprjBOAauDQxdG0Ijzls82045ybEv-skzrM4NA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:29:31.385Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=HoKmyQFbeUhL8uKrkoV84JQ22MRYI34a6S6aa1OGJVH2sUPI6SBQ-g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:29:31.390Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tEz6vEFWD-gC_t5bS1HZe3eomppGdhYuhNDMg75OdcQw3RkLeN6XpA&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:30:30.736Z] **selector-gap** — [s1-A-d2-new] Session-menu button not visible after 30000ms
- [2026-07-12T11:30:38.539Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=NF-MN2EnowhCB5a3KQxKOrAOpAD_7KR7nuq6oBbC4xbyXEEPFOj2cg&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:30:38.615Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=nviSlJxwAee_VtNKYpVffPECPUaiVXyq5ME-vfvsMCQFwznuB8t2hg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:31:00.809Z] **flow-gap** — [s1-A-d2-new] test page (typed or MCQ) not reached
- [2026-07-12T11:31:03.858Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=wWr0h9QilKWwpUA4r94jVuEilA5yO24PQekHT0dZbWELLS4nGjX7jw&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:31:03.862Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=VzVhUUIWTKRyNE4he8nhlduvaZIOFIRq2o5WVIg-ZzzFxOwVW7mFVQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:31:31.939Z] **flow-gap** — [s1-B-review] no Review/Continue button after 20000ms
- [2026-07-12T11:31:32.023Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=1MCl2D09czGVmJGBMNuS3105pE1JF5d72WZkrA6AHGWQj1tcsvVixg&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:31:32.029Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=vaJm--0M2WFvC3nc6FzMpvrAkEISrVkl9RSNQJQgeVMX3O1nKKmmVw&VER=8&d — net::ERR_ABORTED
