# Findings — B_LIST_PROGRESS_PHASE1 (DFWB_winclaude-wb-r13)

**Run date:** 2026-07-14T21:31:34.167Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFWB W-RA3g winclaude-wb-r13"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFWB W-RA3g winclaude-wb-r13 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T21:32:26.910Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=sfH4gtDxe0AaxMvI-4gQRlq86KZDWEvasl33KFAfTgiSCSxK5bRx9Q&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFWB W-RA3g winclaude-wb-r13 → EXMZX3
  - STEP [W-RA3g] join "25WT DFWB W-RA3g winclaude-wb-r13" via EXMZX3 → member
- [2026-07-14T21:33:31.058Z] **flow-gap** — [W-RA3g-pos] on test-results route but "Continue" never appeared (20s)
  - STEP [teacher] create class "25WT DFWB W-RA4 winclaude-wb-r13"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFWB W-RA4 winclaude-wb-r13 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T21:34:22.000Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ovHRoinCiD87eI9X6R3-QDEIT9mlkrT8092vNfDf6MU7XX6S8ye4MA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFWB W-RA4 winclaude-wb-r13 → 6C3Y4V
  - STEP [W-RA4] join "25WT DFWB W-RA4 winclaude-wb-r13" via 6C3Y4V → member
- [2026-07-14T21:35:17.958Z] **request-failed** — [wb-W-RA4] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=NvHbsFJWS3ffHF6zWE3zisiOiABIR74xgk-yMgSpnM0T07BTSqosjQ&VER=8& — net::ERR_ABORTED
- [2026-07-14T21:35:19.537Z] **exception** — [W-RA4] TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test| answers)?$/i }).first()[22m
[2m    - locator resolved to <button disa
  - STEP [teacher] create class "25WT DFWB W-RA4b winclaude-wb-r13"
- [2026-07-14T21:35:43.095Z] **request-failed** — [wb-W-RA4] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=AJr9PG5VxmFTo3UIZvBFX93vEvwIRmxJRrTl5qkdibRY7gTCgN6MpQ&VER=8&d — net::ERR_ABORTED
- [2026-07-14T21:35:43.644Z] **request-failed** — [wb-W-RA4] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=AJr9PG5VxmFTo3UIZvBFX93vEvwIRmxJRrTl5qkdibRY7gTCgN6MpQ&VER=8&d — net::ERR_ABORTED
- [2026-07-14T21:35:47.963Z] **request-failed** — [wb-W-RA4] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=NvHbsFJWS3ffHF6zWE3zisiOiABIR74xgk-yMgSpnM0T07BTSqosjQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFWB W-RA4b winclaude-wb-r13 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T21:36:09.765Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=TXfX1plSOKMmsdAvhmpqXKeHO9SemG8m66VgqeSsSNNXy7j1IVrT3w&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFWB W-RA4b winclaude-wb-r13 → BXNGDR
  - STEP [W-RA4b] join "25WT DFWB W-RA4b winclaude-wb-r13" via BXNGDR → member
- [2026-07-14T21:37:05.266Z] **request-failed** — [wb-W-RA4b] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=HgaGwMkoud30i80KklJ2tDb7ArDaU6_cDJ3HXcSTxAEadd4FwqV5hw&VER=8& — net::ERR_ABORTED
- [2026-07-14T21:37:06.823Z] **exception** — [W-RA4b] TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test| answers)?$/i }).first()[22m
[2m    - locator resolved to <button disa
  - STEP [teacher] create class "25WT DFWB CS-11 winclaude-wb-r13"
- [2026-07-14T21:37:30.358Z] **request-failed** — [wb-W-RA4b] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=WgDVsO5i2C-pjEhqjCQLygW0m6vKROHGND-6Oc9RZI2Fu4Q_IIU3GA&VER=8&d — net::ERR_ABORTED
- [2026-07-14T21:37:30.977Z] **request-failed** — [wb-W-RA4b] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=WgDVsO5i2C-pjEhqjCQLygW0m6vKROHGND-6Oc9RZI2Fu4Q_IIU3GA&VER=8&d — net::ERR_ABORTED
- [2026-07-14T21:37:35.240Z] **request-failed** — [wb-W-RA4b] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=HgaGwMkoud30i80KklJ2tDb7ArDaU6_cDJ3HXcSTxAEadd4FwqV5hw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFWB CS-11 winclaude-wb-r13 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T21:37:57.513Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=e6nAWiOLRYnGFr2tU4UvCwGJOOaS8rOG9w6d5NO6qV4uiy-xHLpK1g&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFWB CS-11 winclaude-wb-r13 → 344PAE
  - STEP [CS-11] join "25WT DFWB CS-11 winclaude-wb-r13" via 344PAE → member
- [2026-07-14T21:39:01.658Z] **flow-gap** — [CS-11-mismatch] on test-results route but "Continue" never appeared (20s)
- [2026-07-14T21:39:02.463Z] **request-failed** — [wb-CS-11] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=PoGXJ5wdiziJitvP5Zbvf19hjCgTZPuQEO6Viw1Gfl_XjvYozeVAjw&VER=8& — net::ERR_ABORTED
- [2026-07-14T21:39:04.947Z] **request-failed** — [wb-CS-11] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=uYJbqqP6Jp3Vp0Xl1CMTmSZ7a91ZOTlT6e-yRwAHPEvOdD81JxJywg&VER=8&d — net::ERR_ABORTED
  - STEP [teacher] create class "25WT DFWB CUT-5 winclaude-wb-r13"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFWB CUT-5 winclaude-wb-r13 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T21:40:13.790Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ddTOnFsbAaWTqFK6xbxUL1m4CK8UtrWfplldda711SOAZCi69-C3zQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFWB CUT-5 winclaude-wb-r13 → PKNXEZ
  - STEP [CUT-5] join "25WT DFWB CUT-5 winclaude-wb-r13" via PKNXEZ → member
  - STEP [teacher] create class "25WT DFWB CUT-6 winclaude-wb-r13"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFWB CUT-6 winclaude-wb-r13 (pace=3 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT DFWB CUT-6 winclaude-wb-r13 → 8LK3L3
  - STEP [CUT-6] join "25WT DFWB CUT-6 winclaude-wb-r13" via 8LK3L3 → member
