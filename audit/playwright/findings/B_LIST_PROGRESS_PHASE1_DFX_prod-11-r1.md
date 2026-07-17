# Findings — B_LIST_PROGRESS_PHASE1 (DFX_prod-11-r1)

**Run date:** 2026-07-15T23:11:54.355Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFX RA1 prod-11-r1"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA1 prod-11-r1 (pace=3 thr=92 mode=typed) → ok
- [2026-07-15T23:12:55.714Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=uRZcpVZ87ozig6C5IsOkFCR9kXiaxaH3YAO4FmJ-YXbqlW2CNnHWHg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA1 prod-11-r1 → 6EWUSU
- [2026-07-15T23:13:14.015Z] **BUG** — [RA1] joined "25WT DFX RA1 prod-11-r1" via 6EWUSU but the class is NOT present after join — candidate phantom membership (enrolledClasses set, class studentIds not; rules:57-60)
- [2026-07-15T23:13:14.106Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=2uIoXY24OuLtWwCqUIq8Go7-cuGI_ZtmYfkB0YKLoJ8uj_5DJ6BboQ&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:13:17.133Z] **recovery** — [RA1] after "refresh" → still broken
- [2026-07-15T23:13:25.498Z] **recovery** — [RA1] after "re-submit join" → still broken
- [2026-07-15T23:13:25.594Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zpecZMCLHtPiXmJSaIdHJAXE3FMrW3R3EYVqO3zX3uCyge3sMaeVEg&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:13:28.622Z] **recovery** — [RA1] after "refresh" → still broken
- [2026-07-15T23:13:28.628Z] **recovery** — [RA1] NOT recovered by page-level [refresh, re-submit join, refresh] — orchestrator may relaunch; continuing scenario with degraded state
  - STEP [RA1] join "25WT DFX RA1 prod-11-r1" via 6EWUSU → NOT a member after recovery — continuing
- [2026-07-15T23:13:29.976Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=vKf941TPyOW2yWyg7_szsrCwGk129feJWGyF8DnGHaN6ENFQorPDpw&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:13:43.607Z] **flow-gap** — [RA1] single-list focus "" != "LSR Base Camp (audit clone)"
- [2026-07-15T23:13:48.606Z] **flow-gap** — [RA1] no Start Session/Continue to enter the session
  - STEP [teacher] create class "25WT DFX RA2 prod-11-r1"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA2 prod-11-r1 (pace=3 thr=92 mode=typed) → ok
- [2026-07-15T23:14:41.953Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_AQU41kRx8fEggDk-wM6ppGWd1v_w7tvpgE_-K9S32lNDGS_0ltysQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA2 prod-11-r1 → 6NVPYJ
- [2026-07-15T23:14:59.573Z] **BUG** — [RA2] joined "25WT DFX RA2 prod-11-r1" via 6NVPYJ but the class is NOT present after join — candidate phantom membership (enrolledClasses set, class studentIds not; rules:57-60)
- [2026-07-15T23:14:59.666Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=sQx93fV4NMtou7KTDl1-o6Na2dPO2Xdv2e9SHe6bmojaKxjdeiOSTg&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:15:02.687Z] **recovery** — [RA2] after "refresh" → still broken
- [2026-07-15T23:15:11.051Z] **recovery** — [RA2] after "re-submit join" → still broken
- [2026-07-15T23:15:11.140Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=DuLmMCvz1Y90CurceOh1K7XQzza77ty-N5LHTikF0TSw7dUHii8YjQ&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:15:14.168Z] **recovery** — [RA2] after "refresh" → still broken
- [2026-07-15T23:15:14.177Z] **recovery** — [RA2] NOT recovered by page-level [refresh, re-submit join, refresh] — orchestrator may relaunch; continuing scenario with degraded state
  - STEP [RA2] join "25WT DFX RA2 prod-11-r1" via 6NVPYJ → NOT a member after recovery — continuing
- [2026-07-15T23:15:15.509Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=J2eM4MI9bolKUkzV0dn0aPA3OwEEiMfNLuAM1XRCavrxJnI9yx4QcA&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:15:29.132Z] **flow-gap** — [RA2] single-list focus "" != "LSR Base Camp (audit clone)"
- [2026-07-15T23:15:34.105Z] **flow-gap** — [RA2-d0] no Start Session/Continue to enter the session
