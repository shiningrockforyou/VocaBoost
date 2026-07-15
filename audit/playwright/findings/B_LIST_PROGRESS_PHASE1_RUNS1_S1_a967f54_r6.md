# Findings — B_LIST_PROGRESS_PHASE1 (RUNS1_S1_a967f54_r6)

**Run date:** 2026-07-12T13:54:37.367Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNS1 A S1_a967f54_r6"
- [2026-07-12T13:55:24.795Z] **selector-gap** — 25WT RUNS1 A S1_a967f54_r6: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T13:55:46.201Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=No208GCvyezID82mdxYKqrdGvaR9X1beNR_d81HNy8mdpySVykMz2w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T13:55:46.234Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=No208GCvyezID82mdxYKqrdGvaR9X1beNR_d81HNy8mdpySVykMz2w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T13:55:50.366Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=hr48Fdpk6uKaElp1ZnGRTh6IA64ovVoXB2t3cyeFLDtCeelMQjZIgQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T13:55:50.426Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=hr48Fdpk6uKaElp1ZnGRTh6IA64ovVoXB2t3cyeFLDtCeelMQjZIgQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 A S1_a967f54_r6 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 A S1_a967f54_r6 → AAYTFB
  - STEP [teacher] create class "25WT RUNS1 B S1_a967f54_r6"
- [2026-07-12T13:56:43.571Z] **selector-gap** — 25WT RUNS1 B S1_a967f54_r6: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T13:57:05.079Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=hr_FWz-Q1qu3Wi0Ppr7ZzgGtt1BjhAGry0yEsInb8x6vX31n5P2Y7g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T13:57:09.182Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=HjF8Dot07jDblsmvdFr7TPOUUBaIMUlT4VKAb2tFY9XAHx7bW6I4Fg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 B S1_a967f54_r6 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 B S1_a967f54_r6 → 7VBM5X
  - STEP [s1-A] join "25WT RUNS1 A S1_a967f54_r6" via AAYTFB → member
  - STEP [s1-B] join "25WT RUNS1 B S1_a967f54_r6" via 7VBM5X → member
- [2026-07-12T13:57:42.251Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Ej6g-3a7A3HtqL4YNh0oMAMbbBsqjBZhTHwz3EuXxOiLyhJ6jGroOQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T13:57:42.261Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=utPr4-cpMKOvwlub47vdE_S4Pp_BLYdH_CmikXG4Tc87i7VkVHMhXw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T13:58:14.908Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=LXYHhcvRn7NugKIrHpuqe4BANCvtDFHVe6sq2Zpwdf1IOEW4MCmJ9A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T13:58:14.913Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=lvl0Qv1z2DKJz0RHtaNXUvvKEOwmdIAKMwqURDn_fZQ8vnHNUu0Atw&VER=8& — net::ERR_ABORTED
- [2026-07-12T13:58:43.629Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=BbC32EM1xqxNKXh-7cHvKyXuqWJfAt_U3k394ZhkOseehhmN8-yiaA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T13:58:43.634Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=GmZ4JeYLPxhKPgnrGbibRgn2AypZ9gAJJIybXN0pRyP-8W19DLbRKA&VER=8& — net::ERR_ABORTED
- [2026-07-12T13:59:06.479Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=DgWad-NYEmoaNmnVeaqnEDe8-ACoy-XO9xl4LK9miDtD4AHO8HpcyQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T13:59:06.487Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=OqqaXLdfqeoSZcwooWy7vjLFx-Uh-6csbQ0jhYgQD4GzJ_FOevySOw&VER=8& — net::ERR_ABORTED
