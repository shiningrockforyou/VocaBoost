# Findings — B_LIST_PROGRESS_PHASE1 (PX_S_T2_ST2smoke)

**Run date:** 2026-07-12T16:40:10.762Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX S_T2 S0 ST2smoke"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX S_T2 S0 ST2smoke (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T16:41:11.972Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=vov23v3_Kf_rbn2QaM2Xoh5NTlkz4y7XtnxNlpTkDL0XQmEJJM5I0g&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX S_T2 S0 ST2smoke → S5CYJV
- [2026-07-12T16:41:21.899Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=h2RiYoeXwSXcXHztTCd7ovK-Cs2UrN-hElcTaW6sEdV-QsDM8B_aqQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:41:21.903Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=h2RiYoeXwSXcXHztTCd7ovK-Cs2UrN-hElcTaW6sEdV-QsDM8B_aqQ&VER=8& — net::ERR_ABORTED
  - STEP [S_T2-s0] join "25WT PX S_T2 S0 ST2smoke" via S5CYJV → member
- [2026-07-12T16:41:32.981Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=eOFbyP-mLrAF8oVdku82-F7kUoTKwAGai6I9kG1nGgmeFXZH3Niw4Q&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:41:32.992Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ngp4AyssPXLwxxxGrrDF4MxyjX6KXzgjo-XnD6DbI0uhvpNC0NWFYQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:42:07.870Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=GNX6uLalIn7jwSGuaSOxs0fC43UMfh9LEiIMg5EvBzi3Qjzye8zWhw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:42:07.876Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BS1x3IMpZK0M2mPjYAsZN6aZwbHhmZvf3d2wjrQkVsmbFDfOcQoEHA&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:42:13.087Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-9bnEas2B_Izqy_X0Sobb91T8m4C6DlNz7lwGHzUHCtV_ALQwr7Pvg&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:42:13.093Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=GxUjs7AlSByoDF7YzXVEfJnwW7jThOuokvFACOb5LpIcN5TcHHHD3A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:42:49.097Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tLHStlvE5rLVp8n5Y1i7JXwAAPoR5eh4JMSMuJtZn1taTa1neQg4bQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:42:49.109Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=IwdS5Sm6pWvt38605k4nIbr2gk33XpnyGLhSMDLI0vSFVwcmrLDkmQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:43:22.552Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KF72zpBEWKEho2XRGZBM2_Gkf91KQCMOg4kKL8G-4cnNUl0jFfVvDg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:43:22.558Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=fDRP7fKHFszurv-JC0oVhue4bIuLxJtEaKGRRgxe_hnNzvXh27iuNA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] create class "25WT PX S_T2 S1 ST2smoke"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX S_T2 S1 ST2smoke (pace=100 thr=92 mode=typed) → ok
- [2026-07-12T16:44:17.163Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ypHT-XmzS7pg_RZmmpFd16OJ8KuRfe9b7fgA_jLdleKhfm4cP-VQxg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX S_T2 S1 ST2smoke → LKNYJH
- [2026-07-12T16:44:23.075Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_xqC9xVTf9vSzFNwBm8TyAbBnof6NXj3CFB6H6A4pAf4Oo5RMVImtw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:44:23.191Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_xqC9xVTf9vSzFNwBm8TyAbBnof6NXj3CFB6H6A4pAf4Oo5RMVImtw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:44:23.246Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=S8Xnikf9aXLYyxBi3CKw2rnzeBXZm8AOHoNKO6I4qICqSGHREXxpcA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:44:23.255Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=S8Xnikf9aXLYyxBi3CKw2rnzeBXZm8AOHoNKO6I4qICqSGHREXxpcA&VER=8&d — net::ERR_ABORTED
  - STEP [S_T2-s1] join "25WT PX S_T2 S1 ST2smoke" via LKNYJH → member
- [2026-07-12T16:44:32.193Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=6ZGEIaozrmjxeO9xsLPaEcEHaKO2kJ01kvsIA0d32Bop44AAW3SwSQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:44:32.198Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=UPaeN_6-Pa1La-W7WbwGOKgZVkHJqeRlQCckPEkllnKwo7v5JZypRA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:44:46.563Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=B47JytJybQxFGBai_x-Oti1M2il4QBrUgaDr2uZbiKe3SSMsnTA-dQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:44:46.568Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tDFcubE3ABfoolFDOOliCq7I1uQWQ3chiL1p6GO6xLy-LF_Btmg5WQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:45:22.686Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tkRzckwmFOGgMldtvRt3u1HKQgjyN6X5xsN3buHtLPDLZ32EDxxq0w&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:45:22.691Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KHiCBl4XEaC9ris33Fbsm3D6_67ZrIYUmTNLUGiUR1D05FHUeOKeAQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:45:56.586Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=WaTAy_fRkabWbKJoPnzOMHJ7KTvVI0cfYSiqPTp8wShLTV48TDbVQw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:45:56.593Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=kOl6ZfvnKRxrWr7gnkyoLngX88r7fBcQzS9gvbZ8mYimADtXzV6h9A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:46:01.702Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=TEsWagK-iGpaaTRpj5EV_E9CDabb33j1greBNzDcV4oI8nQgqFjKRA&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:47:01.149Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=6gsGoBQkXUzGPLm97KInz4GC8xXHx42VYlGdgk5TrVvPqTQd55rOtg&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:47:02.658Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=IV6BOQSn2MA8nODcJNpDLCVd7MvDUlFuw3h6ffOZ50BnFmeTo2yicA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:47:07.895Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T16:47:08.138Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=IV6BOQSn2MA8nODcJNpDLCVd7MvDUlFuw3h6ffOZ50BnFmeTo2yicA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:47:08.153Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=6gsGoBQkXUzGPLm97KInz4GC8xXHx42VYlGdgk5TrVvPqTQd55rOtg&VER=8& — net::ERR_ABORTED
