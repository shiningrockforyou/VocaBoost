# Findings — B_LIST_PROGRESS_PHASE1 (PX_L4_fleet2)

**Run date:** 2026-07-12T20:52:19.482Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L4 S0 fleet2"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L4 S0 fleet2 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T20:53:17.266Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=6KF2rlpS99yHDi0-xxwJng7fE4tSfmm6b0hL-Osz3Gdbx15OgdhIBw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L4 S0 fleet2 → SYVNJD
- [2026-07-12T20:53:26.251Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=SX7HLPYdbx_f7MhhLEoYlHUHNvZjJjz2jtoht7vSpsdcAMY1m_OETg&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:53:26.382Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=SX7HLPYdbx_f7MhhLEoYlHUHNvZjJjz2jtoht7vSpsdcAMY1m_OETg&VER=8& — net::ERR_ABORTED
  - STEP [L4-s0] join "25WT PX L4 S0 fleet2" via SYVNJD → member
- [2026-07-12T20:53:34.923Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=aCL3yFs1o-2zMwLhIuIPKQqJdEKFGK3yfqqiuS1hBV4LGC56H8myKA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:53:34.930Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=EgdFmPKP0OBZfxVt7kXC6v_IMq93FIiyTybtrlVjWwdwovp9ynQ40w&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:14.829Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=zDgFRaAx2Ttb2eaUQCPU3HwwhJyIzYaX1E0YQ1_BrMnxqVu-6MAiYQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:14.834Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zCmVY1GiuxgjWep6AD2-EfSvdOuou4pdItgBpqw0odte7YDYVxpioQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:20.073Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=C1_bBs8twJ1AUH6fU-fcu6ig2_XLi-UlHjuSQ9znVFwn0I6Tz9osTQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:20.079Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=V8gaOhFwrnPRf74Z5XxSP9TKgqDf6lyYopdaFRyWYeNmizrpaei_qA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:56.651Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=aB14eeyvgufeLVRJdxUgt7molmvbdZ5_GISf359_LYVZQ9t-dKcrZw&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:56.655Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=oG5QNp9yuUxu8UIEAoawg8JEg9nGWdHPbHin2UYikfrykYbTYNqEUA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:33.893Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=TKwgiCYPBDWiU7aEIUkiPrWmlgAJwUwGWal8MGQ5K_DFucCB4Q-IKg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:33.899Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=WhUQkLyAjzDPi3T7la5sYB8MWfh7Fbh_wirC29o5wFYSgrOGE7ur9A&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:39.016Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=3EsGerz5fPml6Sdwf-F6A1Q83b1C1xfRpQasHu2JjW2Q1UfsBLOSSg&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:39.024Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Z5lYSeun9Fu-Ay5MGGnOZXJWdkeK3bb8ZM0CspO4nFPyLDR3BAQ9WQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:56:15.996Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=3Qz2CqXEMXDaIbIQzEF0yIby3IkxE4uvi6oLUU1FAde8gLPCRxVXdg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:56:16.001Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=jEPllERVIJF1oPxGmAEXOIkzvQDEdXp-ond5OcHheMjvvtyjDbWTew&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:56:32.152Z] **BUG** — [base-d3-review] no visible outcome within 120s (infinite loading?)
- [2026-07-12T20:56:32.155Z] **exception** — Error: page.waitForTimeout: Target page, context or browser has been closed
