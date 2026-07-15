# Findings — B_LIST_PROGRESS_PHASE1 (PX_L8_fleet2)

**Run date:** 2026-07-12T20:52:20.022Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L8 S0 fleet2"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L8 S0 fleet2 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T20:53:17.679Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=0DSfpyeJuIv7TUiu1Fl1RdEUTZ3eakTToUTj0UTrZGgOtoFsktADAw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L8 S0 fleet2 → 6LD4FN
- [2026-07-12T20:53:26.448Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_6CrQ9JpFm7JDQlxtnXMSaeDw-1okcExRVK-INHPxy3o_U9WpMMctA&VER=8& — net::ERR_ABORTED
  - STEP [L8-s0] join "25WT PX L8 S0 fleet2" via 6LD4FN → member
- [2026-07-12T20:53:34.907Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_6CrQ9JpFm7JDQlxtnXMSaeDw-1okcExRVK-INHPxy3o_U9WpMMctA&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:53:34.913Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=UTpIcbqxV6UK1ETx8ppthIgy0QxE5su5mvhykXAJKfhSlIdldqKXeA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:15.067Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=lp1oZb_lidbQUJu0uQrmZExmvUR4aZNnj_L4HejB_WMYII8V4zyCWQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:15.076Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=h0Rz7AhJjIqPH2DnnxDPpWQxuBY_d_9xnq4oofrBxTS8nVWHmOiWbQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:20.369Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=36Qnmukq9QReitBCvYPnqYHqnVAYuQbh0WQsaAvNaR4n5UOrDr608w&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:20.383Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=3JaLSZVUQeio8Hjl_qn6oYSsOXLtVEd2yYF4c1LnRS_ZRvivpRY4hg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:57.345Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=87nA8-IV_KQZiEIeHTJN2ZgUwcz5wbW1VvXM462hFbLf49SOYi74Jg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:57.351Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=4V8w7Ctp2khKZrLOdRC9DgG5L-xAH_ypVo5cIa3cVA1-c0yuw4PbPw&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:33.315Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=kx9zj7SuKCMGWRbqLOBHCtsT0v0XmF884AcohPh0mr03bW8zAMy9cg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:33.320Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=OkwOgjvDcSTyeRiRRQiwcaXSMvy69DgsBLD05m-ic_-XWVRjVa18tA&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:38.439Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=riJ9t8MFLCbBw-EDr5JrmyRUFnXCQjyv8S_F4DydthJH58D1keXmVw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:38.443Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8GSUQOtFzMu7vOim04L8JqYmlaJ99qrgwQcb9kg4s5xdD5zBDlrrHw&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:56:16.200Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=JOsmNy39JH_WOpdsTdsxzMub57_4Wp1O5MgOs9Ow2-HUQx4OCJqZqw&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:56:16.207Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=z75YARrmmzTwRwJfsD7kMXK7D2rq-N9hGpMFJruNsyolPDgxDMrgWA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:56:32.176Z] **BUG** — [base-d3-review] no visible outcome within 120s (infinite loading?)
- [2026-07-12T20:56:32.183Z] **exception** — Error: page.waitForTimeout: Target page, context or browser has been closed
