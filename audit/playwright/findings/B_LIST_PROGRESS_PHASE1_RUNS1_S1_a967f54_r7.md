# Findings — B_LIST_PROGRESS_PHASE1 (RUNS1_S1_a967f54_r7)

**Run date:** 2026-07-12T14:02:08.103Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNS1 A S1_a967f54_r7"
- [2026-07-12T14:02:55.338Z] **selector-gap** — 25WT RUNS1 A S1_a967f54_r7: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T14:03:16.847Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=d_wagXH4CvJaZmnK-UNLUyUpAmPq-062mCY8BPc6vxZ9tnnFqJVJNQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:03:20.964Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=5hSUyMxPYAuWeTHwYF01sHnc5MECGGWpA80f_6gVSwEQQZG3TEHm_w&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 A S1_a967f54_r7 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 A S1_a967f54_r7 → TUGGBZ
  - STEP [teacher] create class "25WT RUNS1 B S1_a967f54_r7"
- [2026-07-12T14:04:14.044Z] **selector-gap** — 25WT RUNS1 B S1_a967f54_r7: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T14:04:35.567Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=zGVx0UJskQNOEGMnJc6zQMxmvUyc1dwyYSSSXrNkj1l2qkRHX75JLg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:04:39.672Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qXh79r6W3JKasLn9nHBoEllrslMUky_IWfMufN9ww9M0ulZohgqFcA&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:04:39.687Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qXh79r6W3JKasLn9nHBoEllrslMUky_IWfMufN9ww9M0ulZohgqFcA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 B S1_a967f54_r7 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 B S1_a967f54_r7 → BSVP3R
  - STEP [s1-A] join "25WT RUNS1 A S1_a967f54_r7" via TUGGBZ → member
  - STEP [s1-B] join "25WT RUNS1 B S1_a967f54_r7" via BSVP3R → member
- [2026-07-12T14:05:12.913Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=M6oU5ywkOo8kd8USxaI4sUoYlkVe6s3Yd7POtUGNETfmWWHhyDGgVQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:05:12.920Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=jWBM3ThE9nzdHOL9Y0YO6t2a1wFki7EkA9H6WNmy92sppnubGE5g5g&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:05:48.468Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=a1LszoUvANLytaeRSDu0GGU_X2MINvsFQkUYRLCEYPmt_hUEILnZ3w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:05:48.474Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=KoSXqnCOVbi-Lh1bdCsz8RP6qth_LTfRe6NOb46qTvEghnVNRPlNJw&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:06:17.206Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=i_oCQc5dJGEmYh15Gn_HL-jN7qjJrcoD2K7VkrsDSs2416OTHoXW2w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:06:17.210Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=F0RahCr6O7KhAQdtKeb34RfaefKNM5ch-VTDR-8Ii4zn1zcQ_mReYw&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:06:40.099Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qruzB3_3NV7Is0y_lMTAnCwKFuWPnb5RkBENxMJR8t1kSRzPn6J_QA&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:06:40.105Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=8hYBpfECo-hbdzdRHsPe8WcX1Ov8Rd1Y8clmNYAx4LPXK5pZrUGlNA&VER=8&d — net::ERR_ABORTED
