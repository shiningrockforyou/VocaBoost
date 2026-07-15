# Findings — B_LIST_PROGRESS_PHASE1 (PX_L1_fleet)

**Run date:** 2026-07-12T18:28:45.137Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L1 S0 fleet"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L1 S0 fleet (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T18:29:46.796Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iClLNR4CfwIl9lSv6M-65yUysVmIvCMoo5qPXO7VR-Bp85ijVjNQNw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L1 S0 fleet → EU6522
- [2026-07-12T18:29:55.268Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Oqi8XR4S_RMHYHLaXctag4K8Evfmt1bA71oo7MmjuBBHx_ETs1yHog&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:29:55.436Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Oqi8XR4S_RMHYHLaXctag4K8Evfmt1bA71oo7MmjuBBHx_ETs1yHog&VER=8& — net::ERR_ABORTED
  - STEP [L1-s0] join "25WT PX L1 S0 fleet" via EU6522 → member
- [2026-07-12T18:30:05.796Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=2dZZxLNJ6H2qCiR3nausgLi3lSIt8S3ACZsxNoQgF6OpA-nqTeghBg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:30:05.807Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=IhZiedsuJu8LTgaN6UabOpPBK1SGH23zjc_GxGBy8J6ZuhWhv9kyWQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:30:42.180Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=e1pccc0rvBft8dR9eNBSbklS6O3sgB8m3SxbP0RhWg__R4FK090LkQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:30:42.187Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=fiIWc6bfPsP1cSK30p5S_8RDalQSkguj3bJPTz698DNgQBCDY5QUHQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:30:47.507Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=DYhj-O4nyOkLEEiYOeZ6zlxaS3jWLpXNpHqUqYcoTD7MwyzrGLUpZw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:30:47.509Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=G0LMYdgD3LH1JEAaQI-oj7GFEuKScD006vNEIYXLtomFb-uQXJjrQw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:31:24.829Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=9c_mSLw0WXc3cDL_TgcAKAtrpd_2g5Xege8MenU56JpQRBARWpcK0w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:31:24.834Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=6xSuPL433AHEt4X4FruQ9qvFiJJDOWi601xNaDE97v8htE6CFImeOQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:31:59.987Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=SP52SWRUyrS4mnptXbfbzqG4_zdFwH_wiPK7H6NMp5MNHAbNNo0WZw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:31:59.990Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=_qtM4ySvIgmPqfPKTTFBdJ8jp1NTphjiUZbjE8DpuvEWYyOM_u3hJQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:32:05.137Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nTUl14rj0EuF1TEBOPRNqD5rGwuLXm9GptWSXsfB010iCZdC-jSXQg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:32:05.143Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=C5wODtj52G-7seLvcEWYg_3rXUxLIWnLUnm9SKqbIA3JAY3HnmSxtQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:32:42.169Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=V0xRzQBsndY6e6ZzmMUgGrm_oamMXVgRKwZSMYJAI1OHiveM37xXqw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:32:42.175Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=nBkEbvubBPscroYzrNbm8d2hIUieSyMnXytCYpV77swSHuU_v0giag&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:33:17.070Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=5jrUCwLhUURzQNtfwXCCd6AKCkdFT9cgM4-7VyNHoUvLK58qWHb6Dw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:33:17.080Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=GE_rtUBSFsr2NQd_5trUQuEMyWmH-BxHxKU-ahb3rWyrbu_CcN2b8g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:33:22.230Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=lwznEbpSak4YUbJQMoSLp-C_0FBna0x81SdfkXQ6U---M5tLwQ11nw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:33:22.239Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ApTqbhxzaPEPAcSOdnLl4PXghZmxkS8M0ftCCg4J-OSjgEh3w-hHKg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:33:58.874Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=VOg4FFCjeYf0eXmuB8ZWXXb6ckXSEaL4MtBtSjY3Ljdo7nJiQvj7HQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:33:58.881Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=shqHEAt0yXH4KDQZqVGNbkodZ6abn_zug1ZOvzBJf_v1p26tTFMJdA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:34:34.582Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=QsSC3z7Ybs1Mht-iD23SGMKwAL1lYHHLMPoxhszOIZv7g499bnGgeA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:34:34.627Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=v12wsSw1EJANGP99bejupTQrSGs-oTMMsFdgoJsV6BUnwyz7Phxy8w&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:34:39.739Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-Wei4fMu7LQ3lfvB9nvhLjC85lEjIB57aBoT6PRfJwfdopHEngUpqQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:34:39.742Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=2Y-ifFdkA6XyKF68nOdUYpbukiF47oxYQzwlpjpKjnjxZSvIKjKdvw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:35:02.665Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T18:35:02.758Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=e6YOIsFgwZx6HWq-09fRGSyKuoojAF6ysVi433DqXbkeVr2QHwFeHg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:35:02.775Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zZI-w6EakHf7E0n3xYjPwhJgsZKsZhn4idDI-a1EXXML8KiDfwM87w&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:35:02.782Z] **request-failed** — [student] POST https://us-central1-vocaboost-879c2.cloudfunctions.net/gradeTypedTest — net::ERR_ABORTED
- [2026-07-12T18:35:02.789Z] **console-error** — [student] Grading attempt 1/3 failed [functions/internal, 8393ms]: FirebaseError: internal
- [2026-07-12T18:35:47.717Z] **info** — [dbg base d5 finalization-miss(csd=4/exp5 cont=true)] active Class="" List="" url=https://vocaboostone.netlify.app/session/T5xI5hgixAry5HpDZGCu/0HrPB6ejvDxQ16arUh7C → FAIL_base_d5_finalization_miss_csd_4_exp5_cont_true__fleet.png
- [2026-07-12T18:35:49.264Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T18:35:49.526Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=KfInyNs0cZXk5f_fojXmJ6Ret0OXjShGiA5rwSmjlvhMaz89C56c8w&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:35:49.533Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=dtXJczlFnsMzFnT-u7djDxwRsMC1VqYDBGhEwmcHsnWWCaq4Ud14sQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:36:14.580Z] **flow-gap** — [base-d5-new] no Start-New-Words/Continue button after 20001ms
- [2026-07-12T18:36:14.875Z] **info** — [dbg base d5 new-not-reached] active Class="25WT PX L1 S0 fleet" List="LSR Base Camp (audit clone)" url=https://vocaboostone.netlify.app/ → FAIL_base_d5_new_not_reached_fleet.png
- [2026-07-12T18:36:16.544Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tAW86BALhOxvyQyTC03kAps3SLoCDtfFOjnLQntaNAw8UpNBLAwr-A&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:36:16.580Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=7IBRmYqBH9nyo4KOndDDVWRYjX5I-m323TaGyOQYgk_GtVayo6_Mmg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:36:41.679Z] **flow-gap** — [base-d5-new] no Start-New-Words/Continue button after 20000ms
- [2026-07-12T18:36:42.014Z] **info** — [dbg base d5 new-not-reached] active Class="25WT PX L1 S0 fleet" List="LSR Base Camp (audit clone)" url=https://vocaboostone.netlify.app/ → FAIL_base_d5_new_not_reached_fleet.png
- [2026-07-12T18:36:43.662Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zFiMAmuDXsFTztisAhkKf7fbwmrCc_35DGZoyHk1P7dRln-05vM4JQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:36:43.681Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=gzRdpyVV8eClDuqi4GKvNCHIUX7tJ4-CaL5KzOQbhVScy4tVNvlhig&VER=8&d — net::ERR_ABORTED
