# Findings — B_LIST_PROGRESS_PHASE1 (DFX_cert-59df732-r34)

**Run date:** 2026-07-17T20:25:43.558Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFX RO-S1 cert-59df732-r34"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RO-S1 cert-59df732-r34 (pace=3 thr=92 mode=typed) → ok
- [2026-07-17T20:26:34.770Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8SeFiwojdEL5JRAAmTHnCGFnKldzTjGiUYTgOzbYgjPZ0ko4KiXxNw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RO-S1 cert-59df732-r34 → 4XD5ES
  - STEP [RO-S1] join "25WT DFX RO-S1 cert-59df732-r34" via 4XD5ES → member
- [2026-07-17T20:26:53.973Z] **request-failed** — [student-RO-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=W8J1-yq-HEaISMrkpo9gN2vMnypkSQqxuHpCcRJDFML72muFbHLMwg&VER=8& — net::ERR_ABORTED
- [2026-07-17T20:26:53.973Z] **request-failed** — [student-RO-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=GFWuY-GjlmUtqjiJ2h_lwtyWdxzUVrEaXs5MGOjoXSwfSMCCcY37ug&VER=8&d — net::ERR_ABORTED
- [2026-07-17T20:27:34.780Z] **exception** — [RO-S1] TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test| answers)?$/i }).first()[22m
[2m    - locator resolved to <button disa
  - STEP [teacher] create class "25WT DFX RO-S9 cert-59df732-r34"
- [2026-07-17T20:27:58.432Z] **request-failed** — [student-RO-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=StIB2HmD3FwAEVd82Y00X_iEZHDrJX8pSGsITEceCPq9d_EfATRQ5Q&VER=8&d — net::ERR_ABORTED
- [2026-07-17T20:27:59.059Z] **request-failed** — [student-RO-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=StIB2HmD3FwAEVd82Y00X_iEZHDrJX8pSGsITEceCPq9d_EfATRQ5Q&VER=8&d — net::ERR_ABORTED
- [2026-07-17T20:28:03.262Z] **request-failed** — [student-RO-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_vvlUfOqxtQI8JjlrAnf4gn8tNrFo4gDlpX5ZGgHpM7VtD3PXsrYhQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RO-S9 cert-59df732-r34 (pace=3 thr=92 mode=typed) → ok
- [2026-07-17T20:28:25.034Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=3i8Oa0Sb-lzeIoAHYpSOgPA1E10zCUWZHiZAOz3JkQ0OfzSXLY_lqg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RO-S9 cert-59df732-r34 → PDXED8
  - STEP [RO-S9] join "25WT DFX RO-S9 cert-59df732-r34" via PDXED8 → member
- [2026-07-17T20:28:44.248Z] **request-failed** — [student-RO-S9] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=orz7ElrOVWVRUFd0ODQ6EZJ16LGevjFT-Jic8DUr-V3ZMHqg6VKjiQ&VER=8& — net::ERR_ABORTED
- [2026-07-17T20:28:44.249Z] **request-failed** — [student-RO-S9] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=es_DGIoIfHdaPfpaCNyfdG0J3SVEcKPnKV_DKZUWI4DExYPKHWMBdQ&VER=8&d — net::ERR_ABORTED
- [2026-07-17T20:28:51.045Z] **request-failed** — [student-RO-S9] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=95vAXn3fJoP1e4W4nHuh2lAU4916RRrrrzsyCi5hmC-EKtdrYJyiEA&VER=8& — net::ERR_ABORTED
- [2026-07-17T20:28:57.258Z] **request-failed** — [student-RO-S9] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Xq9_-6RIz_ZmXI8yBKMHj4Y4VVM8VgJcEYFBdlnboiKmQ_ZE9PXoNg&VER=8& — net::ERR_ABORTED
- [2026-07-17T20:29:03.739Z] **request-failed** — [student-RO-S9] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Psr0OcXm0k3iJXEp9YL9ItJqbhgFHdkdrKdqlyHeTIS8dvn_4MIkjw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] create class "25WT DFX RS-1 cert-59df732-r34"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RS-1 cert-59df732-r34 (pace=3 thr=92 mode=typed) → ok
- [2026-07-17T20:30:10.132Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=a8fh3Cum13QpW8Mp00TbVOBnMokgSltTDv-99P9Ek1_xhqfjdR0hlQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RS-1 cert-59df732-r34 → GRFVGV
  - STEP [RS-1] join "25WT DFX RS-1 cert-59df732-r34" via GRFVGV → member
- [2026-07-17T20:30:29.224Z] **request-failed** — [student-RS-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=xGmyAGPJUegIg_PPvbUwByQ3q0vmd3yiNMQ86aHIa0GqZe4AIAgmuQ&VER=8&d — net::ERR_ABORTED
- [2026-07-17T20:30:29.225Z] **request-failed** — [student-RS-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=cc_1TZgTbdpNJXqAIuCMS9V1TbGGnOlHzsdwI4tuE7c1wmcGJuPuDw&VER=8& — net::ERR_ABORTED
- [2026-07-17T20:30:39.734Z] **request-failed** — [teacher-RS-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=UXQBn3BUIv8i2adT4hxtD37NgrayvfLC4CdEBF1qqmsd_dkoBxCmxQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] create class "25WT DFX RS-2 cert-59df732-r34"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RS-2 cert-59df732-r34 (pace=3 thr=92 mode=typed) → ok
- [2026-07-17T20:31:37.803Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=0oHoossJzrf8Fc6ANP7QA5hr-16gLoYWgX8JyMsEh8CidJxeaR0ZqA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RS-2 cert-59df732-r34 → WYXVVN
  - STEP [RS-2] join "25WT DFX RS-2 cert-59df732-r34" via WYXVVN → member
- [2026-07-17T20:31:56.862Z] **request-failed** — [student-RS-2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=eDt3JxBxWaQ35qWQMwDGVOjzb1gWicLQ_vIwMLyr5qh1Ge1HKe6_AA&VER=8&d — net::ERR_ABORTED
- [2026-07-17T20:31:56.862Z] **request-failed** — [student-RS-2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=sVpB195SJZK1uPcISRUhuD7-8QprQ340vGTlEGyYrNAP0cWf5OER5Q&VER=8& — net::ERR_ABORTED
- [2026-07-17T20:32:06.308Z] **request-failed** — [teacher-RS-2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=3-NsmFEmFRy1D5iWxv8oG8dKtpXS6C5CZQ9YayzkyF2t5zgAAjF9mw&VER=8& — net::ERR_ABORTED
