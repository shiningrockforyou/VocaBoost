# Findings — B_LIST_PROGRESS_PHASE1 (DFN_net-r24)

**Run date:** 2026-07-15T11:45:18.665Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFN NET-1 net-r24"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFN NET-1 net-r24 (pace=40 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT DFN NET-1 net-r24 → H76ZDQ
  - STEP [NET-1] join "25WT DFN NET-1 net-r24" via H76ZDQ → member
- [2026-07-15T11:46:30.527Z] **request-failed** — [student-NET-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tyvCyJGnrJJ3MKUuMkXGK23_8V8kRAMUGDYyZxidXTHYMwvLReW8WQ&VER=8& — net::ERR_ABORTED
- [2026-07-15T11:46:30.533Z] **request-failed** — [student-NET-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=iWTpEFpme22ZsIMsgVf6NNE3CGeCx387KXowCe7oChMpCb2rnKtKzg&VER=8&d — net::ERR_ABORTED
- [2026-07-15T11:46:30.536Z] **request-failed** — [student-NET-1] GET http://localhost:5173/src/index.css?t=1784115989830 — net::ERR_ABORTED
- [2026-07-15T11:46:42.988Z] **request-failed** — [student-NET-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=YAjPFJmNvl53rReoAkJ7qJ5H_PAkBHpnQtumhe79fLnn7CeWyx-qnQ&VER=8& — net::ERR_ABORTED
- [2026-07-15T11:46:42.993Z] **request-failed** — [student-NET-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Nr1iltXmXbu_ZGuZvhCb-Rhq4qzX1D68a-GxV_Q6bYby99QifeXzmQ&VER=8&d — net::ERR_ABORTED
- [2026-07-15T11:46:42.995Z] **request-failed** — [student-NET-1] POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?VER=8&database=projects%2Fvocaboost-879c2%2Fdatabases%2F(default)&gsessi — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:42.996Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:42.997Z] **request-failed** — [student-NET-1] POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fvocaboost-879c2%2Fdatabases%2F(default)&gsessio — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:42.997Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:43.479Z] **request-failed** — [student-NET-1] POST https://us-central1-vocaboost-879c2.cloudfunctions.net/gradeTypedTest — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:43.482Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:43.485Z] **console-error** — [student-NET-1] Grading attempt 1/3 failed [functions/internal, 345ms]: FirebaseError: internal
- [2026-07-15T11:46:43.487Z] **request-failed** — [student-NET-1] POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fvocaboost-879c2%2Fdatabases%2F(default)&RID=944 — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:43.487Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:43.489Z] **request-failed** — [student-NET-1] GET https://www.google.com/images/cleardot.gif?zx=k5qsq2y3awcd — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:43.490Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:43.491Z] **request-failed** — [student-NET-1] POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fvocaboost-879c2%2Fdatabases%2F(default)&RID=623 — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:43.491Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:43.492Z] **request-failed** — [student-NET-1] GET https://www.google.com/images/cleardot.gif?zx=c2kly81e7hwu — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:43.492Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:44.833Z] **request-failed** — [student-NET-1] POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fvocaboost-879c2%2Fdatabases%2F(default)&RID=199 — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:44.837Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:44.840Z] **request-failed** — [student-NET-1] GET https://www.google.com/images/cleardot.gif?zx=wa1fm1qcollm — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:44.841Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:45.233Z] **request-failed** — [student-NET-1] POST https://us-central1-vocaboost-879c2.cloudfunctions.net/getGradingStatus — net::ERR_INTERNET_DISCONNECTED
- [2026-07-15T11:46:45.239Z] **console-error** — [student-NET-1] Failed to load resource: net::ERR_INTERNET_DISCONNECTED
  - STEP [teacher] create class "25WT DFN NET-2 net-r24"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFN NET-2 net-r24 (pace=40 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT DFN NET-2 net-r24 → VXU7X6
  - STEP [NET-2] join "25WT DFN NET-2 net-r24" via VXU7X6 → member
- [2026-07-15T11:48:23.802Z] **request-failed** — [student-NET-2] GET http://localhost:5173/src/index.css?t=1784116103756 — net::ERR_ABORTED
- [2026-07-15T11:48:23.806Z] **request-failed** — [student-NET-2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=5S8xzpabuCmBcnSNccnRVxyILIk29lnEBSMVOs-K_Wn8XlK725CUBw&VER=8&d — net::ERR_ABORTED
- [2026-07-15T11:48:23.808Z] **request-failed** — [student-NET-2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=DgfpzgkYjJ1QRQVMaj0PamaYLXPDrpFmYdObUFcWMoomalCoTfcWnA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] create class "25WT DFN NET-3 net-r24"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFN NET-3 net-r24 (pace=40 thr=92 mode=typed) → ok
- [2026-07-15T11:49:51.416Z] **request-failed** — [teacher-NET-3] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Q8Npj1rYgYd_dOwHvD09rLSyzGD2XLMEGMiWPMkl_RQBeXwzpWiOpg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFN NET-3 net-r24 → SZ2UGB
  - STEP [NET-3] join "25WT DFN NET-3 net-r24" via SZ2UGB → member
- [2026-07-15T11:50:10.274Z] **request-failed** — [student-NET-3] GET http://localhost:5173/src/index.css?t=1784116209587 — net::ERR_ABORTED
- [2026-07-15T11:50:10.280Z] **request-failed** — [student-NET-3] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=hIbrarClCN0ddIcafDoCWM3JJDFiURc2lMRoAxgKRvGnEmrjfJty2A&VER=8&d — net::ERR_ABORTED
- [2026-07-15T11:50:10.283Z] **request-failed** — [student-NET-3] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=GjXhd9RcPrngUBqGr1DKxOw5-jNpjLosxHP8vUCRM1bAhJjdNARSkQ&VER=8& — net::ERR_ABORTED
