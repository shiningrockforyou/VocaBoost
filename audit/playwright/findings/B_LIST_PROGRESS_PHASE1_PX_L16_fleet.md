# Findings — B_LIST_PROGRESS_PHASE1 (PX_L16_fleet)

**Run date:** 2026-07-12T18:46:21.218Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L16 S0 fleet"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L16 S0 fleet (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T18:47:27.813Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ZvbwDPU_jAzywR_YWL_LTVDB7GXPz7hmERuSWt_lGoTGmXIYZlSQng&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L16 S0 fleet → SJ5NFU
- [2026-07-12T18:47:40.944Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iRSD6lfNUMO6OTdSswmITX01j-ijZTh9MPo7iXnra_vHvA2I62UCfA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:47:40.947Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iRSD6lfNUMO6OTdSswmITX01j-ijZTh9MPo7iXnra_vHvA2I62UCfA&VER=8& — net::ERR_ABORTED
  - STEP [L16-s0] join "25WT PX L16 S0 fleet" via SJ5NFU → member
- [2026-07-12T18:47:52.079Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=FAEwP8Qd3d4x6jdeTBRw-JMME3sHBRQZ7aoOwjSUvUgzSrrUWxSjlw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:47:52.093Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=phU_GXEIhS2ZzAYpfcj2KH2EssM-VvXjVJBR_WKYju_W0_m2glD1Rg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:48:28.846Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=SySnX-KLqC4tsF9ncQ1Zn4sbds2aht7Txw0czguNKppIyal6isD42Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:48:28.853Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=iWXP2LxgqW47OEd8C_tv5SSKpfya61hYpYB9G5FVlZkJ_rDZRIwIdw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:48:34.297Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=tKqv8-1V05w_zjkg5dYK_tKQAOINIk9nEM_gBf2KB8PETNYJrb4xbA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:48:34.303Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=FQ-s8iMRfHoKExtyPBRn2zi5DpGOdlZ_0C3D3lGt-Lm4Wj4TE0g7lQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:49:12.847Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qKQcDLRNtQrIHLO9M6_wiTv4F5bArB41OIvZNFYN4-m_yHTOySg24A&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:49:12.861Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=56IFB2dJ36dgYeVIJge2k5nC2Z0sEE1tuzpAxH0kOVIQbR9956ON5g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:49:52.729Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=cYYFFYuYrXIYGZd3SrgL-flc1jw-KL2bu5yvwS_UbZkItz-Umph4RQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:49:52.741Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ZcUwS4K6nE1XX0Dd7vXJqsvGmKBhtbSjI7Mg4ZCWR7qGJUawOGzXqg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:49:58.095Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=5cRT4-J2Xn5mJa1u8u0NzFGqVezrF0azIexpok8xlurw9PBbBt_-1w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:49:58.107Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Wm8UyfephtgODJolfA0JTv06ty2SWPPh1TMgOY70o1nhtJkKy5Xn_A&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:50:35.397Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=sOc-r3zqHAVo8LaqXDWazQy_llfLsEGTOipAV1rVSaHzv5xXshYbZA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:50:35.414Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=GHOpPkrBQQAx9ut3ormvEvdoeLZ_veI9oXjptd4EthVVnz_4wsMBaA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:51:10.769Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=N1SjX_xTp-u8clFjqE2snoLk4gnPltVWh5FqR1H4cv6oDkUPl1--8A&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:51:10.773Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=4lnimxV1m56u-abxdFQvmvne7c_QeRriIkWJAx4ZZdP7SWMULF4IVw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:51:15.928Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=gLmYC5iro8Lu3zD_0tVw0NILa140D01q5hrSv7cfw62QbowQs1lgNA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:51:15.933Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=gPMCWDKQS2qZCirTbvHhcIXdLlkjA-4a4sB6DEgUFhL-R8WHUUGfYw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:51:52.863Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=GIX4O_-sr6OYgi-phJDJI1Z0gpgjujw7AgDGw9D5nxgL__OYX0qkeg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:51:52.870Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=aIfixqJ2_pMu8XfG2KoRaR-nRmQHDDPW88XH7TnvFjYvzD0Yor780w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:52:28.074Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KMz5KipGs5WBca6f8Bglfc5BMrmu_Wwukao3ySgRKmuEurzrG-FTlQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:52:28.079Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=lvlwa0JJ6uTfezy-0Rx8mSEoxFC0YlQClCVy-7Ng99Fasa5uc7DInQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] create class "25WT PX L16 S1 fleet"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L16 S1 fleet (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T18:53:22.838Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=f9vkFWHpnjrBjg9EBEMEBV0w5mT3enKyOmETcaEJ2RfeH5xU5Yieiw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L16 S1 fleet → UC3B9J
- [2026-07-12T18:53:28.596Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nua1vcgUvlaCFBN-jPVaxNyOcUVtz_h6m9DjiZYcH7xYHk727AYF_Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:53:28.699Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nua1vcgUvlaCFBN-jPVaxNyOcUVtz_h6m9DjiZYcH7xYHk727AYF_Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:53:28.735Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=7oxJgBuRE6YQN_6WH67aWIhYLsWaNbkXo_8Q38TFXimUst2J8FUIoQ&VER=8&d — net::ERR_ABORTED
  - STEP [L16-s1] join "25WT PX L16 S1 fleet" via UC3B9J → member
- [2026-07-12T18:53:38.013Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=xMir8aSdMTdfQ3DxMwWRgid3yNl2r0SogPiEhCtkE9eg1mFBzBJzDw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:53:38.016Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=YRUqcHWRXlPYaQXaGYRvOPXB7GEyyargdkz_9UK9DYUEcyie9laaSQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:53:52.541Z] **info** — [L16 #6 baseline] same-pace move: before csd=4/twi=320 → after-reconcile csd=4/twi=320 (carried=true)
- [2026-07-12T18:53:52.630Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=PBud4Mp0Eca8s4Si8XbjOtPb0mc-h-Q2L-dyIU9OIr_ARLHbxHylNQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:53:52.636Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=rXfoHW91EirrUimZ5rbDss8VkLbTFKdpuhiN1KZA0GWtZByQotwIrA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:54:29.109Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=lKDiEQUDQ0MbKr_4Yd8kLZVQb1092zLo_AZowvECFaRlltdByRdPeA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:54:29.111Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ppTzSqGBjeMHK9r4I9aJTy9VaPcqjcnpEbMCkvJv55COF7gVX1TfWw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:55:03.545Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=rc_8m5Tr4sCtb4gEuAqCCxfhTYPurzOzkFtcZsLPDAtS0i8RVNXDXw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:55:03.557Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=D9Eh_8lKDvh79IiYxJcAvdJrLwdRtHmdFjs6a4nVzglQGYAtRe99sQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:55:08.941Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Grf9OkCj7od5ED5b1WPk6ToKb1sXxKFoQEi5EPc9oIwQS1oJ2cqC_Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:55:45.714Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=N_0VLk3qRErCeCEoY-qjlr7Ggc9rMfkLqmzpzgT75yOBuwHTgVO4sQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:55:45.726Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=AUEZfh76M3w7ogPl0m3QzNBs0y0xSPuynxsvKxo6FeGa0tLpyoClvQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:56:21.546Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Co9djnqFgOhplN4eyiC5zJmfNdpKfEjsdmPyorYjyqYCfegkkF1VNQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:56:21.558Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=j4VX7DxzI86qOx5BPORm_I53C6t28LsApd7jMUlucev7qyeTgLLWlw&VER=8& — net::ERR_ABORTED
