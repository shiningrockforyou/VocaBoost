# Findings — B_LIST_PROGRESS_PHASE1 (FIX10_FIX10_run5)

**Run date:** 2026-07-12T10:46:41.036Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT FIX10 TYPED FIX10_run5"
- [2026-07-12T10:47:28.235Z] **selector-gap** — 25WT FIX10 TYPED FIX10_run5: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T10:47:49.759Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=a3eAm90CMo0VVrisSqpDmATdPmL7EdEDjuEOcw7CkTGL-oIFhtb7sg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:47:53.810Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_ZrndWlf3lfuNDeOW37dTNpRvSYtcu9Ist8WHaSt36Id9VLziF0UvQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:47:53.893Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_ZrndWlf3lfuNDeOW37dTNpRvSYtcu9Ist8WHaSt36Id9VLziF0UvQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT FIX10 TYPED FIX10_run5 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT FIX10 TYPED FIX10_run5 → KGG9CG
  - STEP [teacher] create class "25WT FIX10 MCQ FIX10_run5"
- [2026-07-12T10:48:46.941Z] **selector-gap** — 25WT FIX10 MCQ FIX10_run5: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T10:49:08.445Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=_VMesYzp3tkJI8s7l5JCqPvsCTBoygj4DebJ79HP5O0Hmy0DcAi2og&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:49:12.575Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=4_Shv6noybKmeDq9sylcBq7Abm9uY_aFn48Uwpv9A8VKuW6S3KCNZw&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:49:12.584Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=4_Shv6noybKmeDq9sylcBq7Abm9uY_aFn48Uwpv9A8VKuW6S3KCNZw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT FIX10 MCQ FIX10_run5 (pace=20 thr=92 mode=mcq) → ok
  - STEP [teacher] read join code for 25WT FIX10 MCQ FIX10_run5 → NYYXCT
  - STEP [TD1] join "25WT FIX10 TYPED FIX10_run5" via KGG9CG → member
- [2026-07-12T10:49:46.530Z] **request-failed** — [fix10-TD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=GZh3xwAzP6JJSg7mCzq1EIwFWV6DUR0av1RlDO_pDhJgvqHOf74SLw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:49:46.535Z] **request-failed** — [fix10-TD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Ia5NRvtJ--s5Iub87iigqeu6l1VQjs-Y_oy2xLCms7wvEirlKfWWWg&VER=8& — net::ERR_ABORTED
  - STEP [TD2] join "25WT FIX10 TYPED FIX10_run5" via KGG9CG → member
- [2026-07-12T10:50:37.344Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=XcIuKbKM9PN4dr95YwHnaLuDAsV4hH15yB3O86bFFJcmfoQBDpJahA&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:50:37.352Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=pV4Yczr7IwwONm-oCkfeS7bzQ2wxQIVoJJL79VoC3me6Gmd3cRtYVQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:51:01.077Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=mz03wUrRD1P2FV3wX0xf8_74w01Ck4W81lgry5mxNPA3vkNMkWwp4w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:51:01.082Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ZWr07VfzdZi3x_C61ZHoVeDgcw1eDZL0_Oz0SOOTbSix4Jal_dQC9g&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:51:37.576Z] **selector-gap** — [TD2-setup-d2new] Session-menu button not visible
- [2026-07-12T10:51:52.646Z] **flow-gap** — [TD2-setup-d2new] test page (typed or MCQ) not reached
- [2026-07-12T10:51:53.621Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KTr_b628Yk5MRu7zjqd-hJSaIsRve-mT68ZSbv7R4_qaFkKY1lA7DQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:51:53.628Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_Rv2TYFWepimhVFGn2HAWd9xj3r5eigFhLwlmaIgkVq6zRaLhRLPaw&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:52:28.406Z] **flow-gap** — [TD2-d2-review] no Review/Continue button
- [2026-07-12T10:52:28.488Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=7xCuEGfz6qOTt-3uUyUOP4y9QOPmGWWx6RPjxEsFiQbPMWfhRfjwcA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:52:28.495Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=RtP5G0EQ0SGEJsVOlJ8ESs0PFdQsvzRqIDICTZcaZJbY00SXwI1Shg&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:52:34.620Z] **flow-gap** — [TD2-d2-review] no Review/Continue button
  - STEP [MD1] join "25WT FIX10 MCQ FIX10_run5" via NYYXCT → member
- [2026-07-12T10:52:48.872Z] **request-failed** — [fix10-MD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=txHhz5b5iOVwrfpfM7st6gC9TYoafZyzDsRD0z6kbfOKgbq_9erVJw&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:52:48.879Z] **request-failed** — [fix10-MD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=dFT5RQ3pVHgTaNIiAJFPSjBIrqgTcczZUFRxLWh_XQdvkNlWOsxe5w&VER=8&d — net::ERR_ABORTED
  - STEP [MD2] join "25WT FIX10 MCQ FIX10_run5" via NYYXCT → member
- [2026-07-12T10:53:38.857Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Mg_-a1uwzeArjZSOG_iBicZ4dJeQkZ-IHgEJib2SYdKGnzf8DoJbLA&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:53:38.866Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=hY8Kk4XFxO581QNKKtP4Nntr7xvOdNVlDXUZaY-uUng_VxxMZxLlgg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:54:05.338Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=gkPcJS8txBNMOFWesAutv22wvIWpkFgfe3v4WKiYXgFHsjN0bLX25w&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:54:05.342Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=lRuufZoj4VYdkMuBQemGR_QA_1JmqznoM3ck-nx6WAkzdATb37cgcg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:54:41.824Z] **selector-gap** — [MD2-setup-d2new] Session-menu button not visible
- [2026-07-12T10:54:56.887Z] **flow-gap** — [MD2-setup-d2new] test page (typed or MCQ) not reached
- [2026-07-12T10:54:57.866Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=c4SWODliRaF5XZ7qCkuayyGdJGKco9ZFA3_O6GsGMsF5cfjyalgevg&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:54:57.872Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=aFeeQnQ88WonLQkBk29ZobJqDKKSWL4Im35kpsc9iewLpnPjFoal0g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:55:30.353Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=y-vnI_J3Q74POfHUg6vM0uUN5pRCF6lNeXlEV19I0ZUyzxTTptF-jA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:55:30.359Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=wG_xo7f1KSNwqqYNJCZhTvnZAF77iD7LQ1iLQXVQisabshXzBqO_qQ&VER=8& — net::ERR_ABORTED
