# Findings — B_LIST_PROGRESS_PHASE1 (RUNS1_S1_1783819677352)

**Run date:** 2026-07-12T01:28:07.291Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNS1 A S1_1783819677352"
- [2026-07-12T01:28:54.522Z] **selector-gap** — 25WT RUNS1 A S1_1783819677352: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T01:29:16.000Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=NdVuIJ7BBX0vO0vm9Z_6oT4MdZcB0h03dVtfN53hstdtiajCVAR-hg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:29:16.047Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=NdVuIJ7BBX0vO0vm9Z_6oT4MdZcB0h03dVtfN53hstdtiajCVAR-hg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:29:20.138Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zmMkGrWKmJvKDZfRCijTrM2GatPDhP9n89nYmNWkPuwlprf73LVGgA&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:29:20.193Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zmMkGrWKmJvKDZfRCijTrM2GatPDhP9n89nYmNWkPuwlprf73LVGgA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 A S1_1783819677352 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 A S1_1783819677352 → 86MQB7
  - STEP [teacher] create class "25WT RUNS1 B S1_1783819677352"
- [2026-07-12T01:30:13.248Z] **selector-gap** — 25WT RUNS1 B S1_1783819677352: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T01:30:34.776Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=pZ2am8ECwKBN2x6slmMwqO7WL-vA-RjC07YBabdAmyV77U_9N5DnYg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:30:38.840Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=9RVwxolrzvgm5GUvP7Fd7B-EyEOgGkgOVcYwSgh1uOXXgXxMe0Zn-w&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 B S1_1783819677352 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 B S1_1783819677352 → G8FPUJ
  - STEP [s1-A] join "25WT RUNS1 A S1_1783819677352" via 86MQB7 → member
  - STEP [s1-B] join "25WT RUNS1 B S1_1783819677352" via G8FPUJ → member
- [2026-07-12T01:31:12.187Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=e8QV54Vz-3dxNXpTS4C3-fIVFAa0Nf6apD-XGJvhQGZKvnZ7z1RU6A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:31:12.196Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ohqWWU7cWoALLdinUqgmNjLp8beDoLKD3FFY1yyNU9R322wM456qew&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:31:47.116Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=SthMWCCDDW5O0144PwwtKji-usrQxWm8XLQolu5FMwrl-Rqp52O9JA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:31:47.122Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=YR1a4C6T2k2n6U9DwTqii9TTg9UcvIk7rrfAZSjmZBVLtnGBaG--Ag&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:32:15.815Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=J8wWvWPE-XnKF7kqRtiSDkZguFoU_mMfq6OhK_TFscPvwze79HXaWQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:32:15.824Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=QCAU8GTErQ-IVOh-7FUPoE36kbphSp_O0eLFZtIBEBQnh07VRV1c1w&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:32:23.939Z] **flow-gap** — [s1-B-review] no Review/Continue button
- [2026-07-12T01:32:24.028Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0cfhDEnJ6K4LX0D3uLtLXJ0L9PfrwqYNmen4qXvm4HkpI0UiC_S6_A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:32:24.042Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-YTT44WhICuCN3eGjmvD11-_9QUFE5S5mp0RELOZ4gG8GHJPcD-CSQ&VER=8& — net::ERR_ABORTED
