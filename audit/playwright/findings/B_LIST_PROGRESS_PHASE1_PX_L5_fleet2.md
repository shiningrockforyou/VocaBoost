# Findings — B_LIST_PROGRESS_PHASE1 (PX_L5_fleet2)

**Run date:** 2026-07-12T20:52:19.807Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L5 S0 fleet2"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L5 S0 fleet2 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T20:53:17.962Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8vAjm0K7hoYVNbGBPc1zt9ZKlU7uMo9KcmDL3PHhemgkNawvYkY6mw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L5 S0 fleet2 → PDA59D
- [2026-07-12T20:53:26.562Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7lZsPtokTn6lYMhQ7BxG4XYxzcNNxr7W_42TVQV04uBNujDoGV-nPg&VER=8& — net::ERR_ABORTED
  - STEP [L5-s0] join "25WT PX L5 S0 fleet2" via PDA59D → member
- [2026-07-12T20:53:34.974Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=AO9y0VAKIvXPf74E0BlZ_-ODObtaMkmj6_Dkuw3_Wpo0X7yY1MH5jA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:53:34.982Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7lZsPtokTn6lYMhQ7BxG4XYxzcNNxr7W_42TVQV04uBNujDoGV-nPg&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:14.706Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7NIhRrtpJXGJPfoasOKoB9Vy50ihFx8ki-phXkkMsqjw18AGtWrlhg&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:14.710Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=iJURG2aqEBT7KsMAH8Gn7Xk_V-vMowCaadkmFeIhsVoyFsSg8gN2GA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:19.953Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=d2WoOY-6knSUd27JTWd0IPh1fwXZzbwDPWewfrym-ubvyw5t17ZExA&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:19.959Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ZbkgIzKHPvs8EPAVGe18OWeIuEkIEn36XBNF-MKbzhxm8IA4uCDGwA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:56.978Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=9MQFx2TO_IN47OEU0TybvTE6YlTCDlsm6gjPqkdO9jXkOmp539Wd1Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:56.982Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=co5EDuM3XOHEPmwXkY4E4iXOX8XmriV9mFJGBK0tKOcXGvuoZ4OmQw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:31.953Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=C_LJIzQkn829MP3r1MrGC-lSZfd1xO9B4fuWpd6pOM1PICPuGEC9sQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:31.958Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=CI-liAcjqDdO1kr-xX93Mr1Lf4bjJpsm4EYsse0uGOytKInptbaoRw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:37.062Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=AmAPObkpnuanVoLFvmd8K7yKEtprT0gyc9zA_SGI9txgPF26vuPQGQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:37.067Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=2Dviwrtd39zO5XQDuh3iNwcxBVunmlZTY85FpQ3PUerhKfACjzAuHQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:56:13.501Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=BC5CtxbxsmEJRxIqMhYFPFQsHbPblxiOSbbrG4zgr0BFD_8Y2M7log&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:56:13.508Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=vhtRJi4s83HtNeWWEBECvANdzELG3v9WQRFojcMhZopWbysxqF4XbA&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:56:32.163Z] **BUG** — [ascent-d3-review] no visible outcome within 120s (infinite loading?)
- [2026-07-12T20:56:32.167Z] **exception** — Error: page.waitForTimeout: Target page, context or browser has been closed
