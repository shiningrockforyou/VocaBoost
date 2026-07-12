# Findings — B_LIST_PROGRESS_PHASE1 (RUNS1_S1_1783820225547)

**Run date:** 2026-07-12T01:37:14.856Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNS1 A S1_1783820225547"
- [2026-07-12T01:38:02.270Z] **selector-gap** — 25WT RUNS1 A S1_1783820225547: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T01:38:23.622Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=EhIhDpw3hhhfr0cpM_bQpCRxKW881TldGvIfaQLYh5oBdM7AoALngA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:38:23.683Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=EhIhDpw3hhhfr0cpM_bQpCRxKW881TldGvIfaQLYh5oBdM7AoALngA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:38:27.872Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tsODZLD2SFA7TKX6_yE7riY7o91H0xJ5CGR7eDdW8uY_ZklaWN_IcA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 A S1_1783820225547 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 A S1_1783820225547 → M9NKXD
  - STEP [teacher] create class "25WT RUNS1 B S1_1783820225547"
- [2026-07-12T01:39:21.016Z] **selector-gap** — 25WT RUNS1 B S1_1783820225547: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T01:39:42.509Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=HOj18MOgXNIGL7gxjPKtlQT9Pwh69OsVL3XUaWKD1Ym6JP6qI5T7_w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:39:46.650Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_w27-exI0pzbd28vXgQJG_K-49y-g1dTX581rXpfidDm5gKcFIDwDA&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:39:46.656Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_w27-exI0pzbd28vXgQJG_K-49y-g1dTX581rXpfidDm5gKcFIDwDA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 B S1_1783820225547 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 B S1_1783820225547 → HYTYDT
  - STEP [s1-A] join "25WT RUNS1 A S1_1783820225547" via M9NKXD → member
  - STEP [s1-B] join "25WT RUNS1 B S1_1783820225547" via HYTYDT → member
- [2026-07-12T01:40:19.931Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=1nDX-9IZ_tQIiU2aFlAmOmfMi5QB0dk2JCnWcLb3p4fFU4OzS6InrQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:40:19.937Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=nNLMPoRXyRq0o3PNCdFtSt8GonBjaZU0ArvnL5qYXHi-iTvUKitbEg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:40:50.938Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:41:06.262Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 A S1_1783820225547"
- [2026-07-12T01:41:08.069Z] **flow-gap** — [25WT RUNS1 A S1_1783820225547] switch attempt 1: not landed on target class
- [2026-07-12T01:41:08.075Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:41:18.352Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=cHw2vyQqaMN-gXdETPNkFT9kcviGje8jI8ASpipvPX8JR20YdsXXlA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:41:18.359Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=54DvvD1aaGZ7ahU63zywxuB-hHi39xr015tzwCyoX3U4ZSYHA2s19Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:41:23.405Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 A S1_1783820225547"
- [2026-07-12T01:41:25.212Z] **flow-gap** — [25WT RUNS1 A S1_1783820225547] switch attempt 2: not landed on target class
- [2026-07-12T01:41:25.219Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:41:40.544Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 A S1_1783820225547"
- [2026-07-12T01:41:42.352Z] **flow-gap** — [25WT RUNS1 A S1_1783820225547] switch attempt 3: not landed on target class
- [2026-07-12T01:41:42.356Z] **fail** — [25WT RUNS1 A S1_1783820225547] could NOT land on target class after 3 attempts
- [2026-07-12T01:41:48.480Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=54DvvD1aaGZ7ahU63zywxuB-hHi39xr015tzwCyoX3U4ZSYHA2s19Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:41:48.528Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=cHw2vyQqaMN-gXdETPNkFT9kcviGje8jI8ASpipvPX8JR20YdsXXlA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:42:02.363Z] **flow-gap** — [25WT RUNS1 A S1_1783820225547] no study affordance after settle
- [2026-07-12T01:42:02.870Z] **flow-gap** — [s1-A-d2-new] no Start-New-Words/Continue button
- [2026-07-12T01:42:02.886Z] **flow-gap** — [s1-A-d2-leave] "Quit session" control not visible
- [2026-07-12T01:42:02.895Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:42:18.218Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 B S1_1783820225547"
- [2026-07-12T01:42:20.025Z] **flow-gap** — [25WT RUNS1 B S1_1783820225547] switch attempt 1: not landed on target class
- [2026-07-12T01:42:20.031Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:42:35.359Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 B S1_1783820225547"
- [2026-07-12T01:42:37.164Z] **flow-gap** — [25WT RUNS1 B S1_1783820225547] switch attempt 2: not landed on target class
- [2026-07-12T01:42:37.171Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:42:52.499Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 B S1_1783820225547"
- [2026-07-12T01:42:54.306Z] **flow-gap** — [25WT RUNS1 B S1_1783820225547] switch attempt 3: not landed on target class
- [2026-07-12T01:42:54.313Z] **fail** — [25WT RUNS1 B S1_1783820225547] could NOT land on target class after 3 attempts
- [2026-07-12T01:43:14.317Z] **flow-gap** — [25WT RUNS1 B S1_1783820225547] no study affordance after settle
- [2026-07-12T01:43:14.826Z] **flow-gap** — [s1-B-review] no Review/Continue button
- [2026-07-12T01:43:14.834Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:43:30.164Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 A S1_1783820225547"
- [2026-07-12T01:43:31.971Z] **flow-gap** — [25WT RUNS1 A S1_1783820225547] switch attempt 1: not landed on target class
- [2026-07-12T01:43:31.978Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:43:47.299Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 A S1_1783820225547"
- [2026-07-12T01:43:49.106Z] **flow-gap** — [25WT RUNS1 A S1_1783820225547] switch attempt 2: not landed on target class
- [2026-07-12T01:43:49.113Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:44:04.439Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 A S1_1783820225547"
- [2026-07-12T01:44:06.245Z] **flow-gap** — [25WT RUNS1 A S1_1783820225547] switch attempt 3: not landed on target class
- [2026-07-12T01:44:06.248Z] **fail** — [25WT RUNS1 A S1_1783820225547] could NOT land on target class after 3 attempts
- [2026-07-12T01:44:26.253Z] **flow-gap** — [25WT RUNS1 A S1_1783820225547] no study affordance after settle
