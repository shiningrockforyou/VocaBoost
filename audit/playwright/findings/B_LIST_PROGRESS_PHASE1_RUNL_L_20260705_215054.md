# Findings — B_LIST_PROGRESS_PHASE1 (RUNL_L_20260705_215054)

**Run date:** 2026-07-05T21:52:41.565Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [L1-T] logged in as lsr_s28@vocaboost.test; dashboard
  - STEP [L1-T] Day-1 typed completion
- [2026-07-05T21:52:50.037Z] **flow-gap** — [L1-T] no Start-New-Words/Continue button
  - STEP [L1-T] day null→undefined words 0→undefined passedHeading=undefined
  - STEP [L1-M] logged in as lsr_s29@vocaboost.test; dashboard
  - STEP [L1-M] Day-1 mcq completion
- [2026-07-05T21:53:32.653Z] **request-failed** — [L1-M] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=sfLHwkq11J510siHBijo1x7II4AXjqiqnAU3-X2EWvo4XW_fdbsgjw&VER=8& — net::ERR_ABORTED
- [2026-07-05T21:53:32.662Z] **request-failed** — [L1-M] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=O3Wk7-ZEE827dhNrL4hc4eUb5Za8GdnUNKmVMQj2lYaUE68Q5apmHA&VER=8&d — net::ERR_ABORTED
  - STEP [L1-M] day 1→2 words 0→80 passedHeading=true
  - STEP [L1-R] logged in as lsr_s30@vocaboost.test; dashboard
- [2026-07-05T21:53:42.973Z] **flow-gap** — [L1-R-fail] no Start-New-Words/Continue button
  - STEP [L2] logged in as lsr_s04@vocaboost.test; dashboard
  - STEP [L2] selected Class:25WT LSR-B TYPED List:LSR TOP Vocab (audit clone) (B=true L=true)
- [2026-07-05T21:53:59.325Z] **unexpected-dialog** — [L2] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-05T21:54:01.332Z] **unexpected-dialog** — [L2] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-05T21:54:31.328Z] **scenario-error** — [L2] TimeoutError: page.reload: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for navigation until "domcontentloaded"[22m

