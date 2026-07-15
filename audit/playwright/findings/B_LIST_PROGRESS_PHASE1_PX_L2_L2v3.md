# Findings — B_LIST_PROGRESS_PHASE1 (PX_L2_L2v3)

**Run date:** 2026-07-12T17:20:20.582Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L2 S0 L2v3"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L2 S0 L2v3 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T17:21:21.257Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=SvBpuChZoDu7ohX7VF9Sn976FqjzZlfRH9Fh_7u8n7sQxw04GmozLw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L2 S0 L2v3 → M49RBD
- [2026-07-12T17:21:30.982Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=68NoI_UTQnX2LwXHFESGVbyOr05xr23UC6FOGtQDwCXOrGvXXziedA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:21:30.987Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=68NoI_UTQnX2LwXHFESGVbyOr05xr23UC6FOGtQDwCXOrGvXXziedA&VER=8& — net::ERR_ABORTED
  - STEP [L2-s0] join "25WT PX L2 S0 L2v3" via M49RBD → member
- [2026-07-12T17:21:42.002Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=K8EVXG_KGAuWAeNGbgspoPdgntpUCapKLVlCk9gN3UqXdOgMqpSBXA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:21:42.010Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=W5haTKjRtVjmwovUfyL4LYNlTVQQHJQEH_Q5bEQFHGgApZNFIN8RXA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:22:45.319Z] **flow-gap** — [ascent-d1-exit] on test-results route but "Continue" never appeared (20s)
- [2026-07-12T17:22:53.130Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=8XF8eHG2pJw44nWANOrAHaJaNKF6DF8CBhEVE_vBzNO_aEHyvkQkqg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:22:53.202Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ZRq2za2u_tW1bzYaOKhwCiFXWWC3BMNDHJr6jYIx0UoxIXp6yL8nGQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:23:06.640Z] **info** — [dbg ascent d1 finalization-miss(csd=0/exp1 cont=false)] active Class="" List="" url=https://vocaboostone.netlify.app/typedtest/WmawA3Cn7qTfvgXtqx6w/ssjsJSyeUk6F9yRXBuwN → FAIL_ascent_d1_finalization_miss_csd_0_exp1_cont_false__L2v3.png
- [2026-07-12T17:23:08.459Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=8XF8eHG2pJw44nWANOrAHaJaNKF6DF8CBhEVE_vBzNO_aEHyvkQkqg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:23:08.468Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ZRq2za2u_tW1bzYaOKhwCiFXWWC3BMNDHJr6jYIx0UoxIXp6yL8nGQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:23:44.012Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Ng_LgRwbNyTLcEPwCTBTwiBjGSPUNjwIfg6TwN4L2vpih8bDC0Z8Hg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:23:44.020Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=_0asac9h15nwK3COoMmBug_7zhM5tDsGKpA7pBzHbPv5ljYRDt15mA&VER=8&d — net::ERR_ABORTED
