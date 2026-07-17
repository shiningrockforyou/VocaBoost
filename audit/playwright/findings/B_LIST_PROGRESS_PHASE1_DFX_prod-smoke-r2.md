# Findings — B_LIST_PROGRESS_PHASE1 (DFX_prod-smoke-r2)

**Run date:** 2026-07-17T16:55:27.751Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFX RO-S1 prod-smoke-r2"
  - STEP [teacher] create class "25WT DFX RO-S9 prod-smoke-r2"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RO-S1 prod-smoke-r2 (pace=3 thr=92 mode=typed) → ok
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RO-S9 prod-smoke-r2 (pace=3 thr=92 mode=typed) → ok
- [2026-07-17T16:56:28.808Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=gSQWNOzRPNoXIvTZ50hi2vwdbDFzlGwv0n7dcDCt9v2D6w2ZsYOMyA&VER=8& — net::ERR_ABORTED
- [2026-07-17T16:56:29.187Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ZODFNHc00dkZ_Vi_aMO8hUshPYYH15ZRO_pS9HbJnDQmJFuhR9JG1A&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RO-S1 prod-smoke-r2 → BYMRW5
  - STEP [teacher] read join code for 25WT DFX RO-S9 prod-smoke-r2 → 8UFYWA
  - STEP [RO-S1] join "25WT DFX RO-S1 prod-smoke-r2" via BYMRW5 → member
  - STEP [RO-S9] join "25WT DFX RO-S9 prod-smoke-r2" via 8UFYWA → member
- [2026-07-17T16:56:47.817Z] **request-failed** — [student-RO-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=3K7G8NoCR3H_Et00m7BtU3e_ATHmRiqsfOGoGjzBwHqFpYSmK5w62A&VER=8&d — net::ERR_ABORTED
- [2026-07-17T16:56:47.826Z] **request-failed** — [student-RO-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=FKFuI7PIpw91YyO85cJBVP8K0XpDoB4QET9LxVza-0GM-npHghBa2A&VER=8& — net::ERR_ABORTED
- [2026-07-17T16:56:48.244Z] **request-failed** — [student-RO-S9] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=SY9ZhnJb5fY5S-m-gQDGDP26q2lEhqxR1C4OxL1Nisna7wUzMBOx1Q&VER=8& — net::ERR_ABORTED
- [2026-07-17T16:56:48.257Z] **request-failed** — [student-RO-S9] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=2Dq-_UJrmNjl7XjNmRjm1xO82FReNAvFzOMjUYQDQXOV4t5SgkEK3g&VER=8&d — net::ERR_ABORTED
- [2026-07-17T16:56:54.861Z] **request-failed** — [student-RO-S9] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=USVUlR2uYrh0hmQqoZTBhyEOCG89FlfuVyuKo8zAWMdA85nNEz66dA&VER=8& — net::ERR_ABORTED
- [2026-07-17T16:57:01.008Z] **request-failed** — [student-RO-S9] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=9Zumyhxo9S1POv4BHCYPz01IhCgM9nh-QhI9DHXBFlsjR-uz2Ss0MA&VER=8& — net::ERR_ABORTED
- [2026-07-17T16:57:07.561Z] **request-failed** — [student-RO-S9] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=wSPbctP9sNItDi2F3XJAQB_CV8wI0umn6T1dqabv9_5MEU0STUudwA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] create class "25WT DFX RS-2 prod-smoke-r2"
  - STEP [teacher] create class "25WT DFX RS-1 prod-smoke-r2"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RS-2 prod-smoke-r2 (pace=3 thr=92 mode=typed) → ok
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RS-1 prod-smoke-r2 (pace=3 thr=92 mode=typed) → ok
- [2026-07-17T16:58:13.943Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Obkz_Ech7EyAKe7m_Vuh25NpuERO-XhMm5GxtXqQxxyyoK8jcGwh5g&VER=8& — net::ERR_ABORTED
- [2026-07-17T16:58:14.011Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=LTnm0Cq-gazW7EsmSD0YzUDb3v_uDPiFXBbjZ43axZ6lR2j5LtjE5w&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RS-2 prod-smoke-r2 → PYE4SD
  - STEP [teacher] read join code for 25WT DFX RS-1 prod-smoke-r2 → ALW3CQ
  - STEP [RS-2] join "25WT DFX RS-2 prod-smoke-r2" via PYE4SD → member
  - STEP [RS-1] join "25WT DFX RS-1 prod-smoke-r2" via ALW3CQ → member
- [2026-07-17T16:58:32.843Z] **request-failed** — [student-RS-2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7KzKIz4QKj63Q06UaCqzHeo-KwY_2jpL9yUPKWrgCSSY70jaJNQxVA&VER=8& — net::ERR_ABORTED
- [2026-07-17T16:58:32.855Z] **request-failed** — [student-RS-2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=bfzT5gbz_tGMliDtSOwWPGzE_5bfxuqesYvhxRUF_tketfqacBycMA&VER=8&d — net::ERR_ABORTED
- [2026-07-17T16:58:32.976Z] **request-failed** — [student-RS-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=XhAuq6ytW4j9890VWyQOlBG600tkALL_7UhNd7IbcXfiaQTcff9wiQ&VER=8&d — net::ERR_ABORTED
- [2026-07-17T16:58:32.995Z] **request-failed** — [student-RS-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=byFFCwz-_B0q4dg4rFRPTVguMIwEkwrpQFl5be7LsRoynWSS6IFLaw&VER=8& — net::ERR_ABORTED
- [2026-07-17T16:58:42.450Z] **request-failed** — [teacher-RS-2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=NUQqdbWsiCL-VbK-kPdwaI_sxYHqOX4e0bb-8Da50sotuVBA8VQs-g&VER=8& — net::ERR_ABORTED
- [2026-07-17T16:58:42.957Z] **request-failed** — [teacher-RS-1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tjygzwPABbcHsHqiv6eBfNgZHPb2GlDdN0MAOTPfrAA_SHGZQ1WHGg&VER=8& — net::ERR_ABORTED
