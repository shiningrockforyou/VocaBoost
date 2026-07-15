# Findings — B_LIST_PROGRESS_PHASE1 (PX_L1_fleet2)

**Run date:** 2026-07-12T20:52:20.022Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L1 S0 fleet2"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L1 S0 fleet2 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T20:53:18.163Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=TkclN9MicEEGq-e4ovbQncfa_OhsuHQYhdYt-oT6pY_TBEKZco6L3g&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L1 S0 fleet2 → HZ8Q58
- [2026-07-12T20:53:27.010Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=A2rAz8FBTrCFC9vrYjDorD7vg-V8VZSAIAC4F8-vsAWdnAjwsIZ2Ig&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:53:27.012Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=A2rAz8FBTrCFC9vrYjDorD7vg-V8VZSAIAC4F8-vsAWdnAjwsIZ2Ig&VER=8& — net::ERR_ABORTED
  - STEP [L1-s0] join "25WT PX L1 S0 fleet2" via HZ8Q58 → member
- [2026-07-12T20:53:38.053Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=TdCnE8w5O0FKOsp3lGSXi1Hp-siGTOC9qIWmTQc2iIzfQTa_lFlkMg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:53:38.060Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=b1vwvFSRX1XkGXFhVKCiT38q4nJxKSc-3cFmgTShOsZg0A7cODtp1g&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:15.350Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BdFP5-Eoj9mjTl4VbQSSHDG9o7XDUdR1DJe_3YpipZvtyYnthsBB3Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:15.358Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=dvrOrsxQa4syyzk3o-Qwg_DzO0KBxzEALO2Zmi98Ji_mRO7oMTsWKg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:20.930Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=NwFk7WKeaf-5Ny9agwfKZl5P7WcqyuUbiwyWHT6bpjppWtXVSqQm8A&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:20.940Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=EBbX5dgJaWCNfD6o9yzKBhS94vpVxhoRVgu9ff7LTr6zzXdAYqbwSw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:57.982Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=jYdiKECoNM7WJR1bBUWtRL73cAKP9Db5mn6l3i4Ri0XjhVNfj2zwTg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:57.986Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=cp_0ZTWy1n8W2vEdNgKojOXCNY0E-iKUbgyqGkof69Fke1IsEJMZMQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:32.898Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Eu3740NiF__wYM9ctvdGhJRlTaUT0t3OxobBMv7Wpbqi_XKnjup_cQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:32.901Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_pFmY3gLXyx7NSignrDn4NCz2-ARB0q4vPRESXvoQzzzmkdszm06_A&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:38.013Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=1FXDTsPJud28m26Ri8wNu3Gh0Xl4QMMs6zQGDa5cfmQx1YG_xYVnvw&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:38.015Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=C-UIikNqASl5Ls8ht5JrSJSRRS450rdWiX8tB_bOL5LvcG2GKWU6EQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:56:14.957Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=IWLVyONi_rUK7xOY6-3JFS2kVU8pLysOY3lcpAW49lIwQm416-qZEA&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:56:14.962Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0DGkJ9Y0WEPm59cpcCa5elpxstT-vlWpjELPDV_R7WzfJTjyyMpfoQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:56:32.161Z] **BUG** — [base-d3-review] no visible outcome within 120s (infinite loading?)
- [2026-07-12T20:56:32.167Z] **exception** — Error: page.waitForTimeout: Target page, context or browser has been closed
