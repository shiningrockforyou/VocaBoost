# Findings — B_LIST_PROGRESS_PHASE1 (DFN_net-r23)

**Run date:** 2026-07-15T11:29:23.319Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFN NET-1 net-r23"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFN NET-1 net-r23 (pace=40 thr=92 mode=typed) → ok
- [2026-07-15T11:30:15.797Z] **request-failed** — [teacher-NET-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BjgLIapC8psnN16mNLEWevLuCw0GN_3HJiHPBHX9CMzTlnCmkTsjeg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFN NET-1 net-r23 → Q5X9D7
  - STEP [NET-1] join "25WT DFN NET-1 net-r23" via Q5X9D7 → member
- [2026-07-15T11:30:35.187Z] **request-failed** — [student-NET-1] GET http://localhost:5173/src/index.css?t=1784115034519 — net::ERR_ABORTED
- [2026-07-15T11:30:35.189Z] **request-failed** — [student-NET-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=UzLqXxHgosIorMjRPxvFw6RJPeD8Jbc6A-7bkJgIH833Y6q-SyzuQw&VER=8&d — net::ERR_ABORTED
- [2026-07-15T11:30:35.190Z] **request-failed** — [student-NET-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=23Jpx_jpM29HgDemJfShYvScB2ZkC3XEZOjNPYYYMy3fY-E9v9gWAg&VER=8& — net::ERR_ABORTED
- [2026-07-15T11:30:48.284Z] **request-failed** — [student-NET-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=B3IIsjSsv8wl-iEl2cmENGmJX-olM3mBf7qADgeHM4Y0ywe1780nCw&VER=8& — net::ERR_ABORTED
- [2026-07-15T11:30:48.290Z] **request-failed** — [student-NET-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Sc29nEyCzgYLRZ2T4AqR_CbSiTz9h-MVu_BPyP9jC0UJq49s5uMRSw&VER=8&d — net::ERR_ABORTED
- [2026-07-15T11:30:48.292Z] **request-failed** — [student-NET-1] POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?VER=8&database=projects%2Fvocaboost-879c2%2Fdatabases%2F(default)&gsessi — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:48.293Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:48.294Z] **request-failed** — [student-NET-1] POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fvocaboost-879c2%2Fdatabases%2F(default)&gsessio — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:48.294Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:48.789Z] **request-failed** — [student-NET-1] POST https://us-central1-vocaboost-879c2.cloudfunctions.net/gradeTypedTest — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:48.792Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:48.794Z] **console-error** — [student-NET-1] Grading attempt 1/3 failed [functions/internal, 369ms]: FirebaseError: internal
- [2026-07-15T11:30:48.795Z] **request-failed** — [student-NET-1] POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fvocaboost-879c2%2Fdatabases%2F(default)&RID=632 — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:48.796Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:48.798Z] **request-failed** — [student-NET-1] GET https://www.google.com/images/cleardot.gif?zx=cpdawco9i2xn — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:48.799Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:48.800Z] **request-failed** — [student-NET-1] POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fvocaboost-879c2%2Fdatabases%2F(default)&RID=925 — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:48.801Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:48.801Z] **request-failed** — [student-NET-1] GET https://www.google.com/images/cleardot.gif?zx=z3z1c6jdanvx — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:48.802Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:50.273Z] **request-failed** — [student-NET-1] POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fvocaboost-879c2%2Fdatabases%2F(default)&RID=790 — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:50.276Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:50.279Z] **request-failed** — [student-NET-1] GET https://www.google.com/images/cleardot.gif?zx=wcvogay717va — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:50.279Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:50.465Z] **request-failed** — [student-NET-1] POST https://us-central1-vocaboost-879c2.cloudfunctions.net/getGradingStatus — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:30:50.467Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
  - STEP [teacher] create class "25WT DFN NET-2 net-r23"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFN NET-2 net-r23 (pace=40 thr=92 mode=typed) → ok
- [2026-07-15T11:31:55.427Z] **request-failed** — [teacher-NET-2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=pcRpsV8DGBU5POtDvbd-GsMXgSvSJ6KaUEpt5VtUcYFsB--QtqMQhg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFN NET-2 net-r23 → 2SVU8R
  - STEP [NET-2] join "25WT DFN NET-2 net-r23" via 2SVU8R → member
- [2026-07-15T11:32:14.263Z] **request-failed** — [student-NET-2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=bxgxz0D9yf_-1pHtu-PoH_skDb84I7c7yGX1klGBFhBcA6p5wx418g&VER=8&d — net::ERR_ABORTED
- [2026-07-15T11:32:14.267Z] **request-failed** — [student-NET-2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=scmEGsARnb2peraMF9wsQ9HLjMSKrXUzcy_yBJLclHzFduWqCuPBLQ&VER=8& — net::ERR_ABORTED
- [2026-07-15T11:32:14.269Z] **request-failed** — [student-NET-2] GET http://localhost:5173/src/index.css?t=1784115134213 — net::ERR_ABORTED
  - STEP [teacher] create class "25WT DFN NET-3 net-r23"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFN NET-3 net-r23 (pace=40 thr=92 mode=typed) → ok
- [2026-07-15T11:33:38.867Z] **request-failed** — [teacher-NET-3] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=jbNv52m34q0QyHXpKCF5y59R_7TjClTx4WqUMYbwoZJLqb0Ug6CHpA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFN NET-3 net-r23 → 6FLTMP
  - STEP [NET-3] join "25WT DFN NET-3 net-r23" via 6FLTMP → member
- [2026-07-15T11:33:57.682Z] **request-failed** — [student-NET-3] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=IbjX82NfZDKLHChgwBcxADNxYZvg9pDQ7gcPcn_uVQVt0P_pDTsmfQ&VER=8& — net::ERR_ABORTED
- [2026-07-15T11:33:57.685Z] **request-failed** — [student-NET-3] GET http://localhost:5173/src/index.css?t=1784115237681 — net::ERR_ABORTED
- [2026-07-15T11:33:57.688Z] **request-failed** — [student-NET-3] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=52avdGQurF5yQ-dBbDTQXfYGCRADxWK-SPik1BuZPgSTlHkh5GIdZw&VER=8&d — net::ERR_ABORTED
