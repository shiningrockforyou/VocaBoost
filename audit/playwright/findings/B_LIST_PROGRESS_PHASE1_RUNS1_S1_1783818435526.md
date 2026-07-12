# Findings — B_LIST_PROGRESS_PHASE1 (RUNS1_S1_1783818435526)

**Run date:** 2026-07-12T01:07:24.249Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNS1 A S1_1783818435526"
- [2026-07-12T01:08:13.181Z] **selector-gap** — 25WT RUNS1 A S1_1783818435526: assign list select "LSR CORE Vocab (audit clone)" failed
- [2026-07-12T01:08:34.702Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=gze1C15i0washucaP9fY3HZbV-F0E59__tmCNW_0K71nN5QgqtFDxQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:08:38.791Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=97SK66_IPThSh0qKA3yfpVOVFWyKgwnX1gncLmjvEqFdkmf2umasog&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:08:38.826Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=97SK66_IPThSh0qKA3yfpVOVFWyKgwnX1gncLmjvEqFdkmf2umasog&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR CORE Vocab (audit clone)" to 25WT RUNS1 A S1_1783818435526 (pace=20 thr=92 mode=typed) → unverified
  - STEP [teacher] read join code for 25WT RUNS1 A S1_1783818435526 → GFJ6P3
  - STEP [teacher] create class "25WT RUNS1 B S1_1783818435526"
- [2026-07-12T01:09:31.999Z] **selector-gap** — 25WT RUNS1 B S1_1783818435526: assign list select "LSR CORE Vocab (audit clone)" failed
- [2026-07-12T01:09:53.524Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=USrmRfWr074U_PyRK0Wr7ATxxdhwM6Z0mTEoeQheGwqfNAdHRxZdhQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:09:57.555Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=aKHiP4R01YSMD5ZEIcQ_-MJdOUrYsxphDdaQJrkQWC8ChQ-gmV9jBA&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:09:57.607Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=aKHiP4R01YSMD5ZEIcQ_-MJdOUrYsxphDdaQJrkQWC8ChQ-gmV9jBA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR CORE Vocab (audit clone)" to 25WT RUNS1 B S1_1783818435526 (pace=20 thr=92 mode=typed) → unverified
  - STEP [teacher] read join code for 25WT RUNS1 B S1_1783818435526 → JT9VRG
  - STEP [s1-A] join "25WT RUNS1 A S1_1783818435526" via GFJ6P3 → member
  - STEP [s1-B] join "25WT RUNS1 B S1_1783818435526" via JT9VRG → member
- [2026-07-12T01:10:35.641Z] **flow-gap** — [s1-A] single-list focus "LSR TOP Vocab (audit clone)" != "LSR CORE Vocab (audit clone)"
- [2026-07-12T01:10:40.731Z] **flow-gap** — [s1-A-d1-new] no Start-New-Words/Continue button
- [2026-07-12T01:10:46.145Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:10:48.568Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 A S1_1783818435526"
- [2026-07-12T01:11:00.579Z] **flow-gap** — [s1-A] single-list focus "" != "LSR CORE Vocab (audit clone)"
- [2026-07-12T01:11:00.591Z] **flow-gap** — [s1-A-d2] no Start Session/Continue to enter the session
- [2026-07-12T01:11:00.604Z] **flow-gap** — [s1-A-d2-new] no Start-New-Words/Continue button
- [2026-07-12T01:11:01.343Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=fEveWAB1WWIs9X8HAe7YeZwL2sfRELrB584OuKfoSzEjMV1HvCwFCA&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:11:06.402Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=WE4DvKDGuTpGMh3qD6qQUEKdnQ1matdKyevqUrS-6bgxR6ocmDknSQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:11:07.895Z] **flow-gap** — [s1-B] single-list focus "LSR TOP Vocab (audit clone)" != "LSR CORE Vocab (audit clone)"
- [2026-07-12T01:11:10.455Z] **flow-gap** — [s1-B-review] no Review/Continue button
- [2026-07-12T01:11:15.872Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:11:18.290Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 A S1_1783818435526"
- [2026-07-12T01:11:30.298Z] **flow-gap** — [s1-A] single-list focus "" != "LSR CORE Vocab (audit clone)"
- [2026-07-12T01:11:30.306Z] **flow-gap** — [s1-A-reenter] no Start Session/Continue to enter the session
