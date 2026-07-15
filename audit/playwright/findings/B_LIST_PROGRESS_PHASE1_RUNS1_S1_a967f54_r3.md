# Findings — B_LIST_PROGRESS_PHASE1 (RUNS1_S1_a967f54_r3)

**Run date:** 2026-07-12T11:47:46.968Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNS1 A S1_a967f54_r3"
- [2026-07-12T11:48:34.717Z] **selector-gap** — 25WT RUNS1 A S1_a967f54_r3: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T11:48:56.226Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Cs-RSrQ8JngEsAVdd6J3ZXvuqu7PDxTsUjN-hlthuyje8-gDnwsClQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:49:00.346Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=3MT-k06gPtJwZSxNUkFAdImYYdF-ouMHaTUnkfWZ28eDDD4CKtuNQA&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:49:00.356Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=3MT-k06gPtJwZSxNUkFAdImYYdF-ouMHaTUnkfWZ28eDDD4CKtuNQA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 A S1_a967f54_r3 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 A S1_a967f54_r3 → YYMERV
  - STEP [teacher] create class "25WT RUNS1 B S1_a967f54_r3"
- [2026-07-12T11:49:53.453Z] **selector-gap** — 25WT RUNS1 B S1_a967f54_r3: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T11:50:14.959Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Hc0_BPsKH93cpckYd5wl5YkM7hjHq3UGTFgROywkOTRW_lIB1nNCJg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:50:19.011Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=0Q69UNCnPKkKpbMKQ0hE6POZwzRLlgFGXhO4AIBhk50j-rBJVwU-AQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:50:19.129Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=0Q69UNCnPKkKpbMKQ0hE6POZwzRLlgFGXhO4AIBhk50j-rBJVwU-AQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 B S1_a967f54_r3 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 B S1_a967f54_r3 → TQVF7X
  - STEP [s1-A] join "25WT RUNS1 A S1_a967f54_r3" via YYMERV → member
  - STEP [s1-B] join "25WT RUNS1 B S1_a967f54_r3" via TQVF7X → member
- [2026-07-12T11:50:52.531Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7ahhKCP86npiBsPnSgItWnm321YqodSXuH7ILRVLEm_LOj128VvNag&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:50:52.539Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=cIMty9YQRWFb0F7C76fkqoBY0J_Mdb90yPGlIi9hPdliSO96ys2EgQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:51:27.507Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=DzglfUY4cOfdXhiEhaaUpxoS1ihT3oQeWH8g5G9qIiwgg1Gm1B2uBQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:51:27.514Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=0dQL0vBIcizIKN51gdommfpdu3ZNKq4HGL9_3FP1o8kjqYkAkl3-JA&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:52:26.790Z] **selector-gap** — [s1-A-d2-new] Session-menu button not visible after 29999ms
- [2026-07-12T11:52:34.656Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=MX8VlcQJu7Sm8k767eJKoJgdiUXYcSlHWRMyCimDOQl2PrJAuqinrg&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:52:34.719Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=QhV9rqOOjdFdjNDWKw4wKCkI8DUS2s8G_y34tO2fIIPYXX-2R1JHdw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:52:34.741Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=QhV9rqOOjdFdjNDWKw4wKCkI8DUS2s8G_y34tO2fIIPYXX-2R1JHdw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:52:56.856Z] **flow-gap** — [s1-A-d2-new] test page (typed or MCQ) not reached
- [2026-07-12T11:52:59.886Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nzCjXOUNRJtNV1faHotiDw4gOmuLYShwf2-XbiejnvLwzjeyugidyg&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:52:59.896Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=w97OaKs1FHjEnyUhSBCbLtI1Wxr1hH-tL1lsNwgb4H4C8PbMp8NI9A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:53:27.894Z] **flow-gap** — [s1-B-review] no Review/Continue button after 20001ms
- [2026-07-12T11:53:27.984Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=5IVEL-PHD2xdbD08RAQEQhBaIADCNjZDDIdDFHd2B2V_7iaXk0NjHw&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:53:27.994Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=phc-emvcCSvgiRVWRnp4Fp0f5vzFGk4TiGHuyUiUBNvtSo3-7MIauQ&VER=8&d — net::ERR_ABORTED
