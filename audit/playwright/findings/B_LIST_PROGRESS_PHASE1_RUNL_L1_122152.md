# Findings — B_LIST_PROGRESS_PHASE1 (RUNL_L1_122152)

**Run date:** 2026-07-05T12:22:20.098Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

- [2026-07-05T12:23:00.014Z] **selector-gap** — [runL-lsr_s13] Session-menu button not visible
- [2026-07-05T12:23:15.151Z] **flow-gap** — [runL-lsr_s13] test page (typed or MCQ) not reached
- [2026-07-05T12:23:15.899Z] **request-failed** — [runL-lsr_s13] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KlmvC1SI8s55VSBensYdTNoNn7GRIL2Q4_jvz7ihBHIkHEZTLoWPuA&VER=8&d — net::ERR_ABORTED
- [2026-07-05T12:23:15.919Z] **request-failed** — [runL-lsr_s13] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=alyYoP1uvZu_T-8TdUj4UsmGUMUpR3gBiDWfYyWGkULV7yRDOg1law&VER=8& — net::ERR_ABORTED
- [2026-07-05T12:23:18.501Z] **CASE-FAIL** — [runL-lsr_s13] loggedIn=true studied=false day 3→3
- [2026-07-05T12:24:04.160Z] **request-failed** — [runL-lsr_s10] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=bdsvnfABdqVBeTTkVf6a-PyPDX8YPipaZSh6rnYNoTkrV6x4HotfWg&VER=8& — net::ERR_ABORTED
- [2026-07-05T12:24:04.164Z] **request-failed** — [runL-lsr_s10] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=MJeMopb1IrFcIgQLQSaBvNYruel56ym43KSJ6laaosUWWdouS_AQpQ&VER=8&d — net::ERR_ABORTED
- [2026-07-05T12:24:06.347Z] **flow-gap** — [runL-lsr_s10-rev] no Review/Continue button
- [2026-07-05T12:24:11.412Z] **CASE-PASS** — [runL-lsr_s10] loggedIn=true studied=true day 1→2
- [2026-07-05T12:24:51.017Z] **request-failed** — [runL-lsr_s03] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=_EmPduvLzW588qMLo9xF6TL5GSgu4uJWNiVq0bk4SO-ywUU8lAkQ_g&VER=8&d — net::ERR_ABORTED
- [2026-07-05T12:24:51.019Z] **request-failed** — [runL-lsr_s03] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=5dHguh9MwvQjWpSoDHL3Ofj3v4tYtjNEP-qY1N1rfwexSV_qN1zrAw&VER=8& — net::ERR_ABORTED
- [2026-07-05T12:24:53.216Z] **flow-gap** — [runL-lsr_s03-rev] no Review/Continue button
- [2026-07-05T12:24:58.269Z] **CASE-PASS** — [runL-lsr_s03] loggedIn=true studied=true day 1→2
- [2026-07-05T12:25:05.796Z] **flow-gap** — [runL-lsr_s01] no Start-New-Words/Continue button
- [2026-07-05T12:25:08.340Z] **CASE-FAIL** — [runL-lsr_s01] loggedIn=true studied=false day null→null
