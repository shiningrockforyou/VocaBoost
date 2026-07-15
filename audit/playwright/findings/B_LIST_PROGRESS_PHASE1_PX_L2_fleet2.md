# Findings — B_LIST_PROGRESS_PHASE1 (PX_L2_fleet2)

**Run date:** 2026-07-12T20:52:19.496Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L2 S0 fleet2"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L2 S0 fleet2 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T20:53:17.964Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=LgXd3K_joaIkfBD0XoORMua_ks9uyfr6Z9uDZX55gBS5PFwGPQiD-g&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L2 S0 fleet2 → U597P4
- [2026-07-12T20:53:26.302Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=yfxHzBQbBbtqR_fUtK1RYfCzEtdF07pVe1AK5tODmW5dPR6pfqXM5Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:53:26.382Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=yfxHzBQbBbtqR_fUtK1RYfCzEtdF07pVe1AK5tODmW5dPR6pfqXM5Q&VER=8& — net::ERR_ABORTED
  - STEP [L2-s0] join "25WT PX L2 S0 fleet2" via U597P4 → member
- [2026-07-12T20:53:34.918Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=DFfRsQuybb7mxvqZFhes7AcJ3vFnzW9oO7c_XwH7URTougJv4Mmgrg&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:53:34.932Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=TQJ54GWUJQYXyyWgKLncqIbcr32W2yxJc2yjMLQ8nhYGwNLEnld9QQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:15.017Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7qs9AkaIJ6ayUWehs-taDLxT4-WJOiSKQVBRFEs4_BkIRGD5zjCz9Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:15.023Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=mQqeMWCZ7cURRmc6PulV6nInXKfoK5kJ5sxH-xApS1s9iIR633EWLA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:20.296Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=k3doShb5xc8R8xVse9-FGuknmzPLMp1ZFphhAkbgubyTBc0iktOdWw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:20.301Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=pbrfcoivwimB42LtHWOiirbDXdGwUiR9boAAB9krGirkYEAcf8Wm5A&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:56.605Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=kBF3ox4CBCtQM5bW_G2rBlozqQOnemyfGGbXa1xKvBbZo3D17kPD7A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:56.608Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=lIQqTjgL2Ut81Lk1TsZp2FAwuO1ZH3QqsV9HAUW7TiC4cjJxopSBbw&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:31.110Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=YJSi77-UgtE-SG5Lw3fVbF1YCCshMwnfn0Ngx1KP_UJAvsKnHbeyDw&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:31.114Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=zAkTpibzFOnH8zAiEqCkdQw1CNpYTlJPAPAxkMNjwEeuGrOLTkTIJA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:36.228Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=NAWKZIHgqdKtUrD_CENwuzsN_fHtadCysZ4FmiQqiOUv3oLbS9rruA&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:36.231Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=3P8T0ls6UiIq3pKKR5x5YOCTdz1vYk8KDPG47RIVDzM9khdPTr4gyg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:56:12.057Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=jpSnT5_RnqzWlBELjZJmCgR4JZjdZYvaM8TxwjnFpqalKJ2jELA65A&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:56:12.060Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=cPHifh-NZgwybis_pq31qdMKJwk02IW4ZlWNKoZjeswomdp94W8bgA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:56:32.274Z] **BUG** — [ascent-d3-review] no visible outcome within 120s (infinite loading?)
- [2026-07-12T20:56:32.279Z] **exception** — Error: page.waitForTimeout: Target page, context or browser has been closed
