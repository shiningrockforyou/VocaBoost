# Findings — B_LIST_PROGRESS_PHASE1 (DFX_winclaude-ui-r6)

**Run date:** 2026-07-14T15:41:26.075Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFX RA1 winclaude-ui-r6"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA1 winclaude-ui-r6 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T15:42:18.577Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=J7aUdLISQEgp7-eCiT7CXZ_vQH_ZW2cP1O23IpfvHA5V2r5oDf4tnw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA1 winclaude-ui-r6 → PNAA9C
  - STEP [RA1] join "25WT DFX RA1 winclaude-ui-r6" via PNAA9C → member
- [2026-07-14T15:43:15.627Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=HpWB3cdwwXFBqGTgE6st_TdCKulgfdmmNH0VNJgFo_pBj9wn7eJxPg&VER=8& — net::ERR_ABORTED
- [2026-07-14T15:43:18.899Z] **selector-gap** — [RA1] Session-menu button not visible after 30016ms
  - STEP [teacher] create class "25WT DFX RA2 winclaude-ui-r6"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA2 winclaude-ui-r6 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T15:44:11.798Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8YnuhkCTsjyOSvgOqsarAkbgU3U3bppcIgqyWhYDO6r5cQ8syJGTSg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA2 winclaude-ui-r6 → GF4MZL
  - STEP [RA2] join "25WT DFX RA2 winclaude-ui-r6" via GF4MZL → member
- [2026-07-14T15:44:32.838Z] **flow-gap** — [RA2] single-list focus "LSR TOP Vocab (audit clone)" != "LSR Base Camp (audit clone)"
- [2026-07-14T15:44:53.980Z] **flow-gap** — [RA2-d0] no Submit button
- [2026-07-14T15:45:12.841Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ddm5IGLWJycirymzgJF51cIvwVGjbkJhCqhL0wTV1w0sRlSxgns9og&VER=8&d — net::ERR_ABORTED
- [2026-07-14T15:45:12.868Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=dhusuZ-L87lEmf_IRo11xHSmyxLsj5DrQw4qlYVPHTcJzTtVgsitSA&VER=8& — net::ERR_ABORTED
- [2026-07-14T15:45:14.002Z] **flow-gap** — [RA2-d0] on test-results route but "Continue" never appeared (20s)
- [2026-07-14T15:45:19.464Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ddm5IGLWJycirymzgJF51cIvwVGjbkJhCqhL0wTV1w0sRlSxgns9og&VER=8&d — net::ERR_ABORTED
- [2026-07-14T15:45:19.472Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=dhusuZ-L87lEmf_IRo11xHSmyxLsj5DrQw4qlYVPHTcJzTtVgsitSA&VER=8& — net::ERR_ABORTED
