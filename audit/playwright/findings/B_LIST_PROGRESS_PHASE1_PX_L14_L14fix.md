# Findings — B_LIST_PROGRESS_PHASE1 (PX_L14_L14fix)

**Run date:** 2026-07-12T18:14:44.010Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L14 S0 L14fix"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L14 S0 L14fix (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T18:15:44.272Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Hmy1WJQF254iEKj3AXbZJX1GXp4r1f0VUPtdX5I6M66sN5FiTP9KzA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L14 S0 L14fix → 3VASF2
- [2026-07-12T18:15:53.891Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zClrdC3oM1km66Rqlwj1G-k6o5SlADxlIbLZ_yxfQHePX_zWfJSbfg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:15:53.897Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zClrdC3oM1km66Rqlwj1G-k6o5SlADxlIbLZ_yxfQHePX_zWfJSbfg&VER=8& — net::ERR_ABORTED
  - STEP [L14-s0] join "25WT PX L14 S0 L14fix" via 3VASF2 → member
- [2026-07-12T18:16:04.951Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=lePUcGfHJpKq3vLQ3wLhta4tG0cOShkhyUCSAhzG2TJD6gQu5irjMQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:16:04.956Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=hQJce55FfPmIvvpQnT1gC0yPBEQMUNFxxgONxZJoMZh9HKnYviu9dA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:16:45.349Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=QnnGCpe-GVWeF33Mu5UjZT96s33jDwZthSwUfOUBrpABOxQGVKvIzA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:16:45.356Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=lj-7r8lOYbfdEta3dooMrdgut_GPsGVyZQhfRr0X4Ko0hP9svqZYkg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:16:50.524Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Yj8HxCBtimQ-0d5Mr2DV-V27TD_a9leoJmWgvYkhLZImTuXmP1UyPg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:16:50.529Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ioICij5S4nLKtVkdvMNBc0XpDOLHn9Dc6DxUtmjJkSRup4rkS8Bp5A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:17:28.173Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=SIgoxDLE6w36HPTEoK6aiaEa_D7JSXQgE-yLTIVL7BkCFRGni-ft3w&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:17:28.180Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=mwgs08AYo39_tF0QIrG1eIxEdjIHsXHpQHyq6IPRzzz9Ldmskn3lZQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:17:53.086Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=y0RZkizmXPG8anw2eS5crJkGG9qSbgppFzm8nuEoRxrOUTJKHLJ3Qg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:17:53.091Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=DUHWK4PIjMHBorvHNP8IvQ9IqGVQivuUjsrBDE-nV23Z-gI_e95RCA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:17:58.284Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=aAxI8VvnUjjl9kY6O8zVxuI6If0SmfN9WqPw4Hdrdnx-cIifYeLylw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:17:58.289Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=6no0Q7YQ-3_2xguuhcv4ea_0AfSXMmTkRTyfDpDY5a0C-K943dnJkw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:18:34.889Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=QN5y2dFa_YBP8dh_irgGFwYAt1L5AJTrGDs45jMDSI2o23m0kDVkkg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:18:34.895Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=qj9GSUJqFgXt15joibdUDnxmchb3wm9vTUYb29Fde726ahqrpPf50Q&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:18:59.645Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=HrjQ2yo26WsWUpkvvjC3kl17qSo9Vm_mhlbGRM4I7VO58HJlsBpMcQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:18:59.650Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=VVBMl8v5KUxN33o1s81fPjhVt-qO6ss61Vny7qPPRDe7kvqIdtbqZg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:19:04.790Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=VuxYxdZOEBpsSTqf7DYohk9azW-4kQ6fmpuQ-N8v9ToN6S9PqG1xrg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:19:04.795Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=U6X65LpwqpLpelZNcG6A9tlZXYMnury8ey_BkfWdn2Bj_kQNk0FBjw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:19:41.830Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=jwn3XyT9UrNoaWu9DaZpD5qWGeUbjJ4VpmOxyh5kM7tny0058UW7Jw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:19:41.835Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=KnVTyFddwsotZNQ3-tfCVkiFWVB0iAUYkAmVHA-R7FUyTyIi2zFqsQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:20:07.131Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=JwCB2gEFNIHcguVc8sBvImzkuLo0b3VB02RHnQ-dw_uZHckPbuAsHw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:20:07.136Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=N9rs0fLBJOfPXYwyzKKlqqmzUaQLW8sjIkqozRZOBfAfvCOC6LhO2Q&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:20:12.239Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=44eZzxOzvFWM2PO_EfrX-nWpSTLWUlVfTQPchvv1zHwutWpwrXxvUg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:20:12.244Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=mGWrDrl8U4Iwx6ZW_S69MnG3gIE93uNWYlAnnw7Z3C4k62fAZzlb-g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:20:47.381Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T18:20:47.468Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=4nzrFC6j-bQO1tx6rfdDJA8OCodzmogJF4h5CQyt2iW7e4arV2N21g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:20:47.476Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=UNzjIFqjNLCt_LWivWGEKA-2s0xtXd59lB0oPbilyJzYg-evrfQNPQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:20:52.660Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=noI9zRRZQnbnZyjSvbm-WnXmjmjny61oq3HuDFwk0vyk5tQIxOIx7g&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:20:52.665Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=BeFFdBuJkJg75oF5ZZoJl_Uie3t-0RHH6ERXe2YadIT0wX7plgbl6A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:21:20.783Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T18:21:20.866Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=bIwLka-aEY56C8u8Nj8r4hZ7RAEBp42EPiePNgogTz5Gvlw5EVhSng&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:21:20.874Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0DUWydBR82q0LSZCE9IBJy3OFXyyFeEsAX6GyvRIM_DbUcGBSZiCYg&VER=8&d — net::ERR_ABORTED
