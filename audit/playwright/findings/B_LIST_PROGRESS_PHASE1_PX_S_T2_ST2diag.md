# Findings — B_LIST_PROGRESS_PHASE1 (PX_S_T2_ST2diag)

**Run date:** 2026-07-12T16:52:40.354Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX S_T2 S0 ST2diag"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX S_T2 S0 ST2diag (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T16:53:41.335Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=PEpu8ZDsjZzNcmLh-w7-daVVh569CTr7TgK71tf7N2UuJYnkkIIg2w&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX S_T2 S0 ST2diag → DCCTH3
- [2026-07-12T16:53:50.431Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zefziA5OU78v9Ie6sztbo6fFDzuQzWqmY__JqDy0SWL-a2tD_8UjJg&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:53:50.435Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zefziA5OU78v9Ie6sztbo6fFDzuQzWqmY__JqDy0SWL-a2tD_8UjJg&VER=8& — net::ERR_ABORTED
  - STEP [S_T2-s0] join "25WT PX S_T2 S0 ST2diag" via DCCTH3 → member
- [2026-07-12T16:54:01.468Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=M7gdGX5MiEE4tn-NiyQAA3bW4DURDgwJaKucZNstIapM0TUfqkGx9g&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:54:01.474Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=PMSjVnJTmULvMNXx2KIEdqmsvVfuv5VGWl4pFXVu8T9KeJg6-kcU5w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:54:40.268Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=aAwRXGR1amgbfZF_0NCkxefugr8rmjJjfXpxzSKGC-jv6CFgW5IzbQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:54:40.273Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=MDqY5A2Ns0GrHw4MYgR_EELoGcilFLDQnNOecdYp6zWYsLV-QtFUtw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:54:45.456Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Cx1gLQCf7m5lg5aGlfK7x5og1jy4qVQBZrFjY2duF8Px_K0X720GpQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:54:45.462Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=RSxVa70coD7hNI14uW8GGohs-0N5hZ8RsyV_X4EwUe1hg9Kkk_wSgA&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:55:23.001Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=9SrH72BhfdjeJp0O4XU22d-ht50qWqPHhqWwqKoEFa-PEH9ru7i_Ig&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:55:23.007Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7OeZ0FSd-y8kr_TjBxdft1ZEYpoOBdmhJtpBEW9lv-rWKYiP99GQ7A&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:55:56.925Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=-7sF74lAjl_XL08ImURgGu_mZkfhAWL_TkLJWf590ericiRaMsW2Ag&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:55:56.947Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7TmXgicZLn3LYudLjKL15vCCsHRxr0hFn3hljgUfif8g0GK4NaGEcg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] create class "25WT PX S_T2 S1 ST2diag"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX S_T2 S1 ST2diag (pace=100 thr=92 mode=typed) → ok
- [2026-07-12T16:56:51.618Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=2OI6NgdPo8hGfbq9OXqjULmwTs0yUOg93WHpMFSbwjrZZnpwbgXjKA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX S_T2 S1 ST2diag → X2MFC9
- [2026-07-12T16:56:57.486Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=KOzHvC174xryMq0rMfuyEFgn7cJH1k2RpWsXse4dso9cry7_wq3kbQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:56:57.630Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=TJ0BsNXEDKBWyHlxCfzIF2C3oVYxSb509KR3c8ju24aDX04msaPZKQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:56:57.639Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=KOzHvC174xryMq0rMfuyEFgn7cJH1k2RpWsXse4dso9cry7_wq3kbQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:56:57.687Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=TJ0BsNXEDKBWyHlxCfzIF2C3oVYxSb509KR3c8ju24aDX04msaPZKQ&VER=8&d — net::ERR_ABORTED
  - STEP [S_T2-s1] join "25WT PX S_T2 S1 ST2diag" via X2MFC9 → member
- [2026-07-12T16:57:06.631Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=a-ENE_1helxZEVG4VV9eerEANDhu2BtSOCrVl1oZqbvLVe3YRqOCFg&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:57:06.636Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=alRMaKcWsQ46iz_If1OVS9-i0fRGFlxK8T4O_hJUyuZ03FTmd_yThw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:57:21.017Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=NEfdc-_qHlPXnJVMtxcKmP-r_DEtAHN-baq36P7A1ml7kOPUMeIW2w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:57:21.022Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=QOtvurRfslfKyHCmAwf3MTzUYh1KUITP8iFzsv22Rg0A-gO0lQovGg&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:57:57.479Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=fvMxwLjZDQPb2hmK7iSu4kOwSd4y1EvwbjmhCf6bNmVmPB5wZRlLOA&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:57:57.484Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=LpjlGljjM7LvnWQBoZvaYY9Dngz80OXbwY4lb4RS8q402gYD816DVg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:58:30.834Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=t-THOiyP_cYKb0RtWFGSDK_rJjwwKgT_qXWeQYg2egGpfjwlT5rZkA&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:58:30.841Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=dSXPDNa-vlFkoH3vC24Wp7imZXci7Avel9Yvg86eeAk4pvxGXouf1w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:58:35.962Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=GeTvAmetkvpWN6qdB9STGu_jalu_3q4vQZY7hT6XHWwys88AjZ1YmA&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:59:11.387Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Rjhze7bN1T8lXF_tUkbn3eFzPNLI51PYbQCPykr2k3_Zw8T05JT9fQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:59:11.395Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=WtuKZ1vDHQ7IhGeYmTeYlo7twQHncj2a33XsH9XHzQTalRBqkFdDIg&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:59:44.747Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8wWGZLHA4aQ2rDIry93yCscnoMrs148WP_0dONiApxnBkkdwZNtX4w&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:59:44.755Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Zlb5S0mHaDVe_LmYXvvji01gXLxrsmpH5EmhK4AzWKFO6h_FltXIYA&VER=8&d — net::ERR_ABORTED
