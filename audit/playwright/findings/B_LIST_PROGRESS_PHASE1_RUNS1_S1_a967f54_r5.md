# Findings — B_LIST_PROGRESS_PHASE1 (RUNS1_S1_a967f54_r5)

**Run date:** 2026-07-12T13:47:31.605Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNS1 A S1_a967f54_r5"
- [2026-07-12T13:48:19.444Z] **selector-gap** — 25WT RUNS1 A S1_a967f54_r5: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T13:48:40.891Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=fwLQesSkGhLtlY6R8lLt3Bz1RShIX1ikVl44psqGfgTIxLzdNkfuag&VER=8&d — net::ERR_ABORTED
- [2026-07-12T13:48:45.003Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=mBHQziGq_WMU3DJfqBnVPyhzEAgjXRJ7eBdBWo0KX0D0kHrR3S2zlw&VER=8& — net::ERR_ABORTED
- [2026-07-12T13:48:45.068Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=mBHQziGq_WMU3DJfqBnVPyhzEAgjXRJ7eBdBWo0KX0D0kHrR3S2zlw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 A S1_a967f54_r5 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 A S1_a967f54_r5 → FMH83Q
  - STEP [teacher] create class "25WT RUNS1 B S1_a967f54_r5"
- [2026-07-12T13:49:38.236Z] **selector-gap** — 25WT RUNS1 B S1_a967f54_r5: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T13:49:59.710Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=vRtCQQa7Kg-0EncNlO_NFMBcYbddhsA9holdIPIdb2Y4fN4WPaIQGw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T13:50:03.865Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Q7p37-jLX1GUls_EdrHUZM1h5rkG5gIMVNOfEfg0AieKL2Su2RFUGw&VER=8& — net::ERR_ABORTED
- [2026-07-12T13:50:03.870Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Q7p37-jLX1GUls_EdrHUZM1h5rkG5gIMVNOfEfg0AieKL2Su2RFUGw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 B S1_a967f54_r5 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 B S1_a967f54_r5 → NTR4G6
  - STEP [s1-A] join "25WT RUNS1 A S1_a967f54_r5" via FMH83Q → member
  - STEP [s1-B] join "25WT RUNS1 B S1_a967f54_r5" via NTR4G6 → member
- [2026-07-12T13:50:36.741Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=lMMNiHqwdqHfjQaZoBRXe9uIcog_5RKDhb-atiJaAVvmPyBNdZLkGg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T13:50:36.748Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=KHzYfY2tl8S_Hq4RuHozpC0G8H2UqC8LFnmVYrn6EgKdjyoyEjOGLQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T13:51:12.326Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Zz9KmlEJ5hp9IHPEgbIjc2qrCQ98ghdjiOG3kq8Xfq7E45wDklG1DQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T13:51:12.331Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=cnIXnBb9_sFjQKBaJzgEr6G_zeyR01WmQBXhRe7S6pK2ks83NrxFeA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T13:51:41.803Z] **flow-gap** — [s1-A-d2-leave] "Quit session" control not visible
- [2026-07-12T13:51:41.911Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=t4Frh1oGfMBDNZ1nv5cDhBHVmhZm9ffpcg3SfRJwJFKnQ2hSmr00lw&VER=8& — net::ERR_ABORTED
- [2026-07-12T13:51:41.920Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=DirUgLlA4joagZ04ybD_jR7ngTxtMc0VEQUlTaDrMH9BCChXKj0A6w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T13:52:06.458Z] **BUG9-newnotreview** — B cross-class entry served NEW words, not the Day-2 review
- [2026-07-12T13:52:06.554Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=0Y-n-F01A6ZkeDNR7deEZi-YL86jhM9skUm1KUssezVh9JpLw8ErbA&VER=8& — net::ERR_ABORTED
- [2026-07-12T13:52:06.562Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Io5dDT7SyZLHZTLaJvgljDP0k15PVVoJ963pAMf2GgF8HlS0wlg0vQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T13:52:17.215Z] **BUG9-Areview** — A re-entry re-serves the Day-2 review already completed in B
