# Findings — B_LIST_PROGRESS_PHASE1 (DFX_winclaude-ui-r8)

**Run date:** 2026-07-14T16:03:12.867Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFX RA1 winclaude-ui-r8"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA1 winclaude-ui-r8 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T16:04:05.366Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qoOsLPQrfpGHrbH9Cw1LEyfjnxja_kD5TF8NaN28bab3N_5tow32KQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA1 winclaude-ui-r8 → 9N5Z67
  - STEP [RA1] join "25WT DFX RA1 winclaude-ui-r8" via 9N5Z67 → member
- [2026-07-14T16:04:24.907Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=aeDNZi7NgDXaJZMbCAet_ohmKcySbLmwsGWi18BXmax6_mliyE67rQ&VER=8&d — net::ERR_ABORTED
- [2026-07-14T16:04:24.915Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=24hcq-458FbR94-CY9tMdPUCONN3LQ7QBDwX6As1urQjJz_7zOx8kA&VER=8& — net::ERR_ABORTED
- [2026-07-14T16:05:05.919Z] **selector-gap** — [RA1] Session-menu button not visible after 30009ms
  - STEP [teacher] create class "25WT DFX RA2 winclaude-ui-r8"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA2 winclaude-ui-r8 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T16:06:00.442Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=TaDo23tr6Ywl70L5fQbtdacLko_zg7nOvXhHQ6WAgizgr3PaIJ_3Wg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA2 winclaude-ui-r8 → 2LUA4C
  - STEP [RA2] join "25WT DFX RA2 winclaude-ui-r8" via 2LUA4C → member
- [2026-07-14T16:06:19.899Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=3cTtvL6pOSxAep4yIqTSdtjEqFlLtBElnkTVPT7xqXhZ45MWL7cYlw&VER=8& — net::ERR_ABORTED
- [2026-07-14T16:06:19.906Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=YAfIb4pzJq2HdxiaLfb-HqbYfyF2djUaVjeDw_WGfNpuCO5pbqgJ8Q&VER=8&d — net::ERR_ABORTED
- [2026-07-14T16:07:00.907Z] **selector-gap** — [RA2-d0] Session-menu button not visible after 30007ms
