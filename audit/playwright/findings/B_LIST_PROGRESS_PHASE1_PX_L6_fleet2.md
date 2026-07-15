# Findings — B_LIST_PROGRESS_PHASE1 (PX_L6_fleet2)

**Run date:** 2026-07-12T20:52:20.023Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L6 S0 fleet2"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L6 S0 fleet2 (pace=100 thr=92 mode=typed) → ok
- [2026-07-12T20:53:21.878Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=NtRdyDPRp7a3SRg-mZPPCEKtzGaJLffsD8RWsHOLUr2z6mOPByguMw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L6 S0 fleet2 → CTYW4K
- [2026-07-12T20:53:31.343Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Dlg0YRvZ5FiR8xD2IUdvBGjh9CijL8CGnsuL2HQDUyCFXb9Adl9STg&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:53:31.345Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Dlg0YRvZ5FiR8xD2IUdvBGjh9CijL8CGnsuL2HQDUyCFXb9Adl9STg&VER=8& — net::ERR_ABORTED
  - STEP [L6-s0] join "25WT PX L6 S0 fleet2" via CTYW4K → member
- [2026-07-12T20:53:42.383Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=H755J-S4mXcexC5LUh7pbv9IWwTiat9FuhFyyJxke0Zq3eh7KxhDwA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:53:42.389Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7ht0riAat8FgtMsMvWQZN1YMtUMI2jCxm97JZjSiRgKvOrCr8p_w6Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:18.192Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=vQZYymFlpaaBSc2LhyjYMLYM_W16sClh8mmWzoruwj7B6u8TJ2lxfA&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:18.195Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KzMwu0YjYFXVE1xqBCe1rXqO0aH2GcN4PBRWI-qaiwmjdI3xAFp_Ag&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:23.443Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=FrcSwN2bpcPoBRSBYbnLhvzgpIelxKM18CnXon5uou1AjWyf4ixlMg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:23.447Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=yR1T0y1P7BzJAbsCrFah8z9TqPfjinfmHBBGBcPLwIHiTD1yFzescw&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:00.025Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=vRwwlvaXYG9ptF5lem_Y6jFUJehU6yBgSaeSKefG0mS4AuvYICQltw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:00.034Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=fjUrbeWcbuxSgsMVTSQCkMryhpq83XgCzxOk_hS1_yLxgv76Qx05-A&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:35.053Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=mSUO0K39JcvYFjceSF4S2VjwM_n2BZtRWBDPDp8OKAuVKkOoOmL2Jw&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:35.057Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=tYrxngs68fRgeVJDj0p6q4MlUSpaa4JQre55vo32OQbo1a88Enhuqw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:40.304Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=WUJd_t9nNAEPpc4nNtDhvqmAaBwpxM33u6rPW-wMe2t6AuJDFXBSGw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:40.317Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=WBySaXS5XbMB7874W_vnup7BCFt84NioW5yzZTbiUz9MDE8RcuQ4GA&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:56:16.996Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=uoagKVcJYV4FkGOL8jlzx3nfC0PnCypo6n-nMAW7pDXzF8GfhyIyVA&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:56:17.003Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=wGFq_nhwamSuoUosevooE5CiiN-7pqrVgsDO62R7KgKfLfPRaCPK1Q&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:56:32.160Z] **BUG** — [ascent-d3-review] no visible outcome within 120s (infinite loading?)
- [2026-07-12T20:56:32.164Z] **exception** — Error: page.waitForTimeout: Target page, context or browser has been closed
