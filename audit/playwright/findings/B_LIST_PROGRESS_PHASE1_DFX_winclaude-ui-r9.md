# Findings — B_LIST_PROGRESS_PHASE1 (DFX_winclaude-ui-r9)

**Run date:** 2026-07-14T16:16:16.547Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFX RA1 winclaude-ui-r9"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA1 winclaude-ui-r9 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T16:17:09.149Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=IJDTka6reb7LpdNxziy0OfcUPq4TR2TMCMx5GXkyyIh8PwjRI6BL9w&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA1 winclaude-ui-r9 → 7VJ4D2
  - STEP [RA1] join "25WT DFX RA1 winclaude-ui-r9" via 7VJ4D2 → member
- [2026-07-14T16:17:28.668Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=A2dpTQkyyAd1l4-d2E2ec4Bzi0lW_6lfSnEEemXxGkiz9DZnPkgIJA&VER=8& — net::ERR_ABORTED
- [2026-07-14T16:17:28.676Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Rtz9OmStduCKLW0Ky3V11kpN4Jxa9YCmI0K2ySPeRyJOrByjuFYP7A&VER=8&d — net::ERR_ABORTED
- [2026-07-14T16:18:09.700Z] **selector-gap** — [RA1] Session-menu button not visible after 30004ms
- [2026-07-14T16:18:20.386Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=q-QFiEghjThnvfUJWiGDtJ4-3jIAeJoodm-xkrSjDaLxjQ0wtIXStA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] create class "25WT DFX RA2 winclaude-ui-r9"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA2 winclaude-ui-r9 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T16:19:14.710Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=t6n6pheifLqG5qK5d2kBA_PktlrsfbYrpdk7Rpyacx_UVHN9hoFINA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA2 winclaude-ui-r9 → G9UGNE
  - STEP [RA2] join "25WT DFX RA2 winclaude-ui-r9" via G9UGNE → member
- [2026-07-14T16:19:34.194Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=M5ibYK28rtkV8xH5uqe1V6UC_sZdONrGGAYmtG-81jkHkn--w4ETOQ&VER=8& — net::ERR_ABORTED
- [2026-07-14T16:19:34.201Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=qUbZnmN8YLgDfkefmjPrfQrH8WUuLe-jbIKtY2crkdoMb2RZDDvEDA&VER=8&d — net::ERR_ABORTED
- [2026-07-14T16:20:15.162Z] **selector-gap** — [RA2-d0] Session-menu button not visible after 30014ms
- [2026-07-14T16:20:25.848Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7pXEco3e8knQw7PSpwLdzgomXptBElraq2Rfb-T2DSWkb_EJYmSEdw&VER=8& — net::ERR_ABORTED
