# Findings — B_LIST_PROGRESS_PHASE1 (RUNL_L_20260705_235509)

**Run date:** 2026-07-06T00:05:28.288Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [L1-T] logged in as lsr_s31@vocaboost.test; dashboard
  - STEP [L1-T] Day-1 typed completion
- [2026-07-06T00:06:07.874Z] **request-failed** — [L1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=918VwLqjAIzx3D0r4LuYCgM1FsBwNpKkF9PuPkNWOj66GXRg-cKV6g&VER=8&d — net::ERR_ABORTED
- [2026-07-06T00:06:07.878Z] **request-failed** — [L1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7_Nas_MxmGwelmzlP79vxvV_ZpPL1S3d_YcFQfRj7UCr4URzp-usfQ&VER=8& — net::ERR_ABORTED
  - STEP [L1-T] day 1→2 words 0→80 passedHeading=true
  - STEP [L1-M] logged in as lsr_s32@vocaboost.test; dashboard
  - STEP [L1-M] Day-1 mcq completion
- [2026-07-06T00:06:49.973Z] **request-failed** — [L1-M] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=VhfQKdSymvpFmMRLCbmZ4pc4qZX1Kz12NxutrvLd6yGj1x8YBquc3g&VER=8&d — net::ERR_ABORTED
- [2026-07-06T00:06:49.977Z] **request-failed** — [L1-M] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iYzxfFsHIU6YUgEEZD0n91uquboo1QobEd7tGOU2-RAaUZJSnjNAvQ&VER=8& — net::ERR_ABORTED
  - STEP [L1-M] day 1→2 words 0→80 passedHeading=true
  - STEP [L1-R] logged in as lsr_s33@vocaboost.test; dashboard
  - STEP [L1-R] failed once (outcome=results); mid-state day=1 words=0
- [2026-07-06T00:07:52.651Z] **request-failed** — [L1-R] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Q6AsWQPnYxNawvIp-EdX2LBOZIkmLZO4ZOEs1ADXkhsXoRLaGnXsuw&VER=8& — net::ERR_ABORTED
- [2026-07-06T00:07:54.193Z] **request-failed** — [L1-R] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0lLtIAIsEdTpd0-JqMNeyzmfWVGD6mLFZ3MgYlZQoyEBDz7Pq3nuyA&VER=8&d — net::ERR_ABORTED
- [2026-07-06T00:08:02.284Z] **request-failed** — [L1-R] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Q6AsWQPnYxNawvIp-EdX2LBOZIkmLZO4ZOEs1ADXkhsXoRLaGnXsuw&VER=8& — net::ERR_ABORTED
- [2026-07-06T00:08:02.286Z] **request-failed** — [L1-R] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0lLtIAIsEdTpd0-JqMNeyzmfWVGD6mLFZ3MgYlZQoyEBDz7Pq3nuyA&VER=8&d — net::ERR_ABORTED
  - STEP [L1-R] retook → pass (outcome=results); day=2 words=80
  - STEP [L2] logged in as lsr_s04@vocaboost.test; dashboard
  - STEP [L2] selected Class:25WT RUNL L2B L_20260705_235509 List:LSR TOP Vocab (audit clone) (B=true L=true)
- [2026-07-06T00:08:52.241Z] **flow-gap** — [L2] "Leave Study Session?" modal did not appear
- [2026-07-06T00:08:52.246Z] **unexpected-dialog** — [L2] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-06T00:09:14.329Z] **request-failed** — [L2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=P4VaXOoowN2cDql3yCqJqmArmD-4Cru0VSL_VccI0Y11POJL0W-neg&VER=8& — net::ERR_ABORTED
- [2026-07-06T00:09:14.395Z] **request-failed** — [L2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=kFxf-wmdvdvmSMngeQh7YP2ll2a4zvHP_9HgvOgMufrRlsrLmLbS4g&VER=8&d — net::ERR_ABORTED
- [2026-07-06T00:09:14.438Z] **request-failed** — [L2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=kFxf-wmdvdvmSMngeQh7YP2ll2a4zvHP_9HgvOgMufrRlsrLmLbS4g&VER=8&d — net::ERR_ABORTED
- [2026-07-06T00:09:22.242Z] **scenario-error** — [L2] TimeoutError: page.reload: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for navigation until "domcontentloaded"[22m

