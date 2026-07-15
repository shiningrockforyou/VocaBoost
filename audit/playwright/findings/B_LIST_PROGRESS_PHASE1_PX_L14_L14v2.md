# Findings — B_LIST_PROGRESS_PHASE1 (PX_L14_L14v2)

**Run date:** 2026-07-12T17:15:27.024Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L14 S0 L14v2"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L14 S0 L14v2 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T17:16:28.319Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=e7nMgSS5su7FB_-drcUO_NtyGC0IPECHS5gkyZck4TbnhkQIp522kA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L14 S0 L14v2 → SHPVKW
- [2026-07-12T17:16:38.459Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=odGVFx8daTnO9n5oDyfCBHQOokx9kQ8V7Gc5c_-wlnaPRHQVLtqHow&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:16:38.463Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=odGVFx8daTnO9n5oDyfCBHQOokx9kQ8V7Gc5c_-wlnaPRHQVLtqHow&VER=8& — net::ERR_ABORTED
  - STEP [L14-s0] join "25WT PX L14 S0 L14v2" via SHPVKW → member
- [2026-07-12T17:16:49.548Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=OZokK31mxh17raowc3pP_XSHttzpJUe5aZBuYXUVgdA4QoixLF54Zg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:16:49.560Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=fZ7v1AzIQQS-EKf3oy7jeX8hxOJJk6UfkVS-loTmtyTteq3nyDuMUQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:16:54.688Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-TEQKjjJFg3SwyZNt8YnsqzswwZMInqYg1BVAySw8YbIS0Ri0cMpNQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:16:59.724Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8pDT9oActPa6rKxJQPobkUCEirl31nWL_4WzTTfRZF2-8B6bGE1aUw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:04.759Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=gZNcrEfQHyMCOhTvPb5a2XnCYSUB9FIy6pk2b7YMFMqz-s30B4CqmA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:09.710Z] **flow-gap** — [dashReady] could not establish context after 4 tries: want Class~"25WT PX L14 S0 L14v2" List~"LSR Base Camp (audit clone)", saw Class="Class:" List="List:"
- [2026-07-12T17:17:11.301Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ZaqA1tPPsVPD37B0IiOUs-uIisN4fgIXKRNsQDtw_RKtmdoCqFBKXg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:16.345Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=m8K-brd4v0u0ztevzzWoCOO9FALqANQA4Zr_oNsSWiax6lXKyHzUKg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:21.378Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8h8e_9XCTBJVpIZc8MOfrPAiyAitsTMsaqMyT4-SfcwzQQsuR2wiyA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:27.483Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=gqj1Cgu_4A-n60fhNROBeluTuBP8NyrKVzV_UwWt1eGi10VDKlbzZA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:32.436Z] **flow-gap** — [dashReady] could not establish context after 4 tries: want Class~"25WT PX L14 S0 L14v2" List~"LSR Base Camp (audit clone)", saw Class="Class:" List="List:"
- [2026-07-12T17:17:34.027Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tv93sGjFeGH9knLmdCXhustjrNMvudLL9xDEuEPs3dS_V-i8mNTh9A&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:39.067Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=P56vdeG0SEkgdYv_bZsiK-NwdXTgqENtd2qAzHTXgS0P-6LV-P3adA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:44.104Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=aEy2BaUXwKI8J0N6QAHZOcWJZDMjtcrayb10S2d_F2j8Hx7JcxDCfg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:49.137Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=as6P_5q_kJRRrBl38jaWt6V3S_GSjWGeLv2KjvVv2uMvyluzOFLwrA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:54.090Z] **flow-gap** — [dashReady] could not establish context after 4 tries: want Class~"25WT PX L14 S0 L14v2" List~"LSR Base Camp (audit clone)", saw Class="Class:" List="List:"
- [2026-07-12T17:17:55.679Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=GR-9F6C5p_RUUyx_3GQShEOjqKasvfOXbGVCxLvnnlyZiaGBw6Z0qw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:18:00.714Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=mK1oUZ6yiSiPQYnKQA-MzqUDEvCNvybzcfvldcFL5h4qhYDQzlXAkg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:18:05.748Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-mQA_IVTSYwTjYUfycB76q1hwU8jMi1SSc1h0uNOgN-yWJIfLbui-g&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:18:10.801Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=PckuhGR8wJ-94gzlYv9r_0c-cNYeACifTrhhB6LR2V5057yaBt0djA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:18:15.761Z] **flow-gap** — [dashReady] could not establish context after 4 tries: want Class~"25WT PX L14 S0 L14v2" List~"LSR Base Camp (audit clone)", saw Class="Class:" List="List:"
