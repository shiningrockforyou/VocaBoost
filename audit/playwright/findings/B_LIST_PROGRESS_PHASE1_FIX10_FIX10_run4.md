# Findings — B_LIST_PROGRESS_PHASE1 (FIX10_FIX10_run4)

**Run date:** 2026-07-12T10:33:34.561Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT FIX10 TYPED FIX10_run4"
- [2026-07-12T10:34:21.805Z] **selector-gap** — 25WT FIX10 TYPED FIX10_run4: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T10:34:43.322Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=BZltwO5J6hLXlrvcqYyzFtKarI5IbuEu4Fy2QNthFv1Go2QsbVoQ6Q&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:34:43.327Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=BZltwO5J6hLXlrvcqYyzFtKarI5IbuEu4Fy2QNthFv1Go2QsbVoQ6Q&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:34:47.414Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=cgUeUBjfd210fEfCWQ-l-oNplM-ebPKABAF1LKrietzU9krCaHFuAQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT FIX10 TYPED FIX10_run4 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT FIX10 TYPED FIX10_run4 → BDQCND
  - STEP [teacher] create class "25WT FIX10 MCQ FIX10_run4"
- [2026-07-12T10:35:40.475Z] **selector-gap** — 25WT FIX10 MCQ FIX10_run4: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T10:36:02.013Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=fCWsAMjhdvYXSdYuNCDLZb6a562Ivp5L4zqalx5KtZktEWlV5HTShA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:36:06.089Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zGgFAbSMYB7tkwOWmlWlMDPGQYGbGx-8NCQluW-rfoLIIU83bKjKtA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT FIX10 MCQ FIX10_run4 (pace=20 thr=92 mode=mcq) → ok
  - STEP [teacher] read join code for 25WT FIX10 MCQ FIX10_run4 → 3H6HBC
  - STEP [TD1] join "25WT FIX10 TYPED FIX10_run4" via BDQCND → member
- [2026-07-12T10:36:40.205Z] **request-failed** — [fix10-TD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=L0yYz7G50k-lBHWUMN7SN2E09LsoV_nyEuQI24Rdy0lC_8qsEORuhA&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:36:40.211Z] **request-failed** — [fix10-TD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=mxC9kYTi_z0Foe7urfaRrytYEwxJpdrT4bkysarDMPkvmwCvJRO2MQ&VER=8&d — net::ERR_ABORTED
  - STEP [TD2] join "25WT FIX10 TYPED FIX10_run4" via BDQCND → member
- [2026-07-12T10:37:31.091Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=2Ji2JToEVaXjnNRuxebMSVCTipBszeMd0d9IVVFjyK9O9KkzGa0XiQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:37:31.096Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=YI8B6a6TiotD38Xet91W3NUYJLNWuMn2gJHU1flhLVieTR1uMgC4fA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:37:55.376Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=bqiHsuIL-XwSBu0gtmE6_30kRm5V5LaNOFfZGpYjyAmLl5iR9ZFf7A&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:37:55.380Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0iSh8o23LUtaPkWskHVxl-b_aFTfPwgNtoTrLbpvXoyZc-Bz7KvmMA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:38:31.863Z] **selector-gap** — [TD2-setup-d2new] Session-menu button not visible
- [2026-07-12T10:38:46.925Z] **flow-gap** — [TD2-setup-d2new] test page (typed or MCQ) not reached
- [2026-07-12T10:38:47.892Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=xF6fiZgQK00X6M2r_1HX15g6nw-CcHSxb4seEGeSXwZelPiaFpgsRQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:38:47.897Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=TQ4h1ULk36r5EX0WpGSXFsAqU-UMZMWCdWfd-0iyaeWl1sZASnieyA&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:39:18.146Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=otPkzZhdH_QfxnBE9RzQm8kRp-XJlgiWqNi9s5xHJ2LSSQlw6WVB7g&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:39:18.152Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=YcyfOJgwCXoIXhYePbV2P5hcgujvWSILOyRGK-iT1m5GFviYtav4Gw&VER=8&d — net::ERR_ABORTED
  - STEP [MD1] join "25WT FIX10 MCQ FIX10_run4" via 3H6HBC → member
- [2026-07-12T10:39:42.036Z] **request-failed** — [fix10-MD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=44vAI7g3M5iCFbt5cTb0_f6Cdh7nJZ-OSB3E73U6N_ImrHRtkQMP7A&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:39:42.040Z] **request-failed** — [fix10-MD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=l52MgEwsez4mhWmIieqiXVBMjepXp2wAOgGbs4d_z4H6kP7dGMyKfA&VER=8&d — net::ERR_ABORTED
  - STEP [MD2] join "25WT FIX10 MCQ FIX10_run4" via 3H6HBC → member
- [2026-07-12T10:40:31.865Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=o2IWdStH4OZzPSQcEbYGJ9er-FIaMqWgoUANK1SL_L22Xq7eiQZBRQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:40:31.869Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=bAElUMNJjoJQWUKOQIgHrbPK7OnVqQoyB4YD7oDQgrAgRHklY8aOng&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:40:58.364Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=m80SfhS1uZILUZIu3IRLEhqfr-wEaat7fa4cHhJz-CDKnN_V_zNWNw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:40:58.369Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=sJ93CGjF1dpmM-jmuA7zxb0yzZ1KwsDpFfL_rBCbwbqs0YR2BZVDFw&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:41:34.862Z] **selector-gap** — [MD2-setup-d2new] Session-menu button not visible
- [2026-07-12T10:41:49.929Z] **flow-gap** — [MD2-setup-d2new] test page (typed or MCQ) not reached
- [2026-07-12T10:41:50.893Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Gu6KdVSMgI6ejIq1CpwxUmKQNoQEMAqrqyW3ezON5f1F_B_SEMN2oA&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:41:50.899Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=h12d5YIS4OCcBWGQSUHwNOMGC1SzEHeI4heME2QHt0Ti56e7REBWcw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:42:23.907Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=mNtJKeJ7Yj0W12zst0YZsIfCXCLYDXUV4hiQ_lZf_zA-0nAGg5yyxQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:42:23.913Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=IxgOoli80-UHvSMVQ7qiL_nASnEnSyMQSRgCEorRkkn6XiFGNXee2A&VER=8& — net::ERR_ABORTED
