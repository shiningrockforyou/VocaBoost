# Findings — B_LIST_PROGRESS_PHASE1 (PX_L2_L2ko2)

**Run date:** 2026-07-12T17:40:01.575Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L2 S0 L2ko2"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L2 S0 L2ko2 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T17:40:58.983Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=u7F5GSrA3P5_MErxHB0KqF1s1d7M1ZOQtVb2sqBm2xQqtVtuwQPVdg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L2 S0 L2ko2 → NXEQ5S
- [2026-07-12T17:41:07.568Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BWAzS_assyVRrO2Ouvs9IWDS1R8ohOlpEQG21kk4L0PD7nOxsjtkYw&VER=8& — net::ERR_ABORTED
  - STEP [L2-s0] join "25WT PX L2 S0 L2ko2" via NXEQ5S → member
- [2026-07-12T17:41:16.009Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=2oHCRTvP1Z-Gmp0HvFmGSRE-oCgIlGzn33sxWp6P3tSEIDVoNeGzNQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:41:16.014Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BWAzS_assyVRrO2Ouvs9IWDS1R8ohOlpEQG21kk4L0PD7nOxsjtkYw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:41:55.056Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ZMuMCv6xgEBy4vECnBs8IZhb5d9HbznaohNfW-rA6esgmOR6NJZZRw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:41:55.067Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=eK7C7gF8ohxYHAGRzw1WInqTxReNmeBhEJCXtq2SEj8v9FFXW1g9Sw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:42:00.242Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=HlG7imz38yzQ1GAoNSubZGUqtyShE5sc37wOdSiQBKO83OgFrrjTUQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:42:00.246Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Lju55Wptn1gNHVy0owj4sXs_0au5jFPdrq53LsKfwRRfi3jOvpT57A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:42:36.242Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=E6VdbRXwHGEVvR7giFD3oo-Uu5nQbkWR4tOlaM4J_xK0WV_OZsU4Xw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:42:36.248Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nMYUHvLFdUgI8raZ9vyarkJSALomo815uDuBKD1zr6YxXaA-d2vmwg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:43:09.669Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=EagmCEIhuFmRWBLxZ_F5jcrqj1_x71w78ScGthnF7CAOLkPLW7NnkQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:43:09.674Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=I6lUIvvH2Q9cz8dDXZ9SlCXy6cGw2gh26ok9MfHag6eRb6unGZfgfA&VER=8& — net::ERR_ABORTED
