# Findings — B_LIST_PROGRESS_PHASE1 (RUNSL_P1_SLP1_1783823910942)

**Run date:** 2026-07-12T02:38:40.661Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNSL P1 SLP1_1783823910942"
- [2026-07-12T02:39:28.799Z] **selector-gap** — 25WT RUNSL P1 SLP1_1783823910942: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T02:39:50.271Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=mq8DiI3pWpbiumfzZsZDBcBEN8MQKJYev5WYGl3ESiguGqUjVXpQTg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T02:39:54.388Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=RW2XedFaESocuKpEkk3BVNgwPKfxqEsP5Cx1A9hY0tiMCv5xtR8B3g&VER=8& — net::ERR_ABORTED
- [2026-07-12T02:39:54.403Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=RW2XedFaESocuKpEkk3BVNgwPKfxqEsP5Cx1A9hY0tiMCv5xtR8B3g&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNSL P1 SLP1_1783823910942 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNSL P1 SLP1_1783823910942 → 9KPK56
  - STEP [p1] join "25WT RUNSL P1 SLP1_1783823910942" via 9KPK56 → member
- [2026-07-12T02:40:29.503Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=7m2xpFQMmY6jrkTF6xscEl40mF1OYxnjJg8BG4qXe_4VnJRQrPDWxA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T02:40:29.512Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=K0LdDwE_P8OF95Y8MVj5PJck47Tu1vlH-FQWK96hY2TifYDktrmLjA&VER=8& — net::ERR_ABORTED
- [2026-07-12T02:41:14.243Z] **native-dialog** — [p1-student] beforeunload:  — accept
- [2026-07-12T02:41:14.332Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=K9j47rvHdDLhEXGtex96VXkpOzNHY00mfkory2q13CVtjXFJH0XE6w&VER=8& — net::ERR_ABORTED
- [2026-07-12T02:41:14.340Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=88qJb_zrANvXH-SUcf5RoNxstR09tvomjDcvBb7pPdbu_cTrKScIqQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T02:41:54.030Z] **ui-fb-mismatch** — day 1: UI words=null != expected twi 20 (FB agrees; UI-teeth soft-fail)
- [2026-07-12T02:41:54.122Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=L9Ce45jKrAHqFsPT_ld3RaL7Q-f7PzrbcGGIeZGCn_DuYo2j7RLYig&VER=8&d — net::ERR_ABORTED
- [2026-07-12T02:41:54.130Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iw9NTDNPebt3w_UcUFD4HLy-x6gkw24j5oWYL5e_7jwxWGH_sXNw1Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T02:42:17.620Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:18.141Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:18.654Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:19.159Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:19.667Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:20.175Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:20.681Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:21.189Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:21.696Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:22.203Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:22.708Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:23.219Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:23.726Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:24.238Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:24.744Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:25.251Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:25.756Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:26.266Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:26.772Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:27.280Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:27.786Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:28.295Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:28.803Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:29.309Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:29.818Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:30.324Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:30.832Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:31.341Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:31.849Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:32.356Z] **selector-gap** — [d2-new] MCQ: no def-match choice for "" — clicking first choice
- [2026-07-12T02:42:32.865Z] **flow-gap** — [d2-new] MCQ Submit not visible (answered 30/30)
- [2026-07-12T02:42:32.869Z] **flow-gap** — [d2-review] no Review/Continue button
- [2026-07-12T02:42:32.875Z] **flow-gap** — [d2] review not reached
