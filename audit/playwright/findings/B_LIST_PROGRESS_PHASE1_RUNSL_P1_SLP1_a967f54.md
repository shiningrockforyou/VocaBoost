# Findings — B_LIST_PROGRESS_PHASE1 (RUNSL_P1_SLP1_a967f54)

**Run date:** 2026-07-12T11:23:09.225Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNSL P1 SLP1_a967f54"
- [2026-07-12T11:23:57.541Z] **selector-gap** — 25WT RUNSL P1 SLP1_a967f54: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T11:24:19.036Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=3xCIjWEDq6FgGZQKjlO-4H63fh47SG1IPbUNN0B06Xl9HuFEDKbokw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:24:23.148Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-LLe2_bNqzLuEpGxCG2KrXs4qBC2pOUO7PQOOZs3YXyBnjAVtrAgbw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNSL P1 SLP1_a967f54 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNSL P1 SLP1_a967f54 → WC85TC
  - STEP [p1] join "25WT RUNSL P1 SLP1_a967f54" via WC85TC → member
- [2026-07-12T11:24:58.799Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ajGdhoXfsBEwBHGxjWTPKTZaskq0kG4CEltztss7EgFfyKM9FYwUSQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:24:58.804Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=kNMPZEHDhTgfp0EAX1KwTlVp_l3UwXTxTBR5F5FV8OrXIu4UhKf4QA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:25:28.154Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=RQPOQDwLSvjvEJ3aPJx5_vNupqAT6w8eHws1_GPfLlLlkWAwrcZJpw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:25:28.161Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=JCIJkgB3TybkKga6utrKNM3bo-zqWCNE8WDw-iPYS816_wdt0HCwhw&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:25:33.274Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=sQnx4Ps4F1bDEF5Pa6OIwupa6v1JQjONCCZWciQSvsZft0xvt1r2ww&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:25:33.281Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=A7vOHdbezzDtB8t9ZLv6QjQHwus7AcxbH-TPG6CWPDdaLtnbO3qgjg&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:26:09.786Z] **selector-gap** — [d2-new] Session-menu button not visible
- [2026-07-12T11:26:24.857Z] **flow-gap** — [d2-new] test page (typed or MCQ) not reached
- [2026-07-12T11:26:25.786Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=9CBa6-DAD8uQZxnocUCvvSanNhzCZKM_BdWIlhzxdkF-lqnAGpIbPw&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:26:25.793Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=nnGTeYFgBpl2v-LuA6FOdisTmVdM4YgtAnrjsdzTAS_Bc-03uPH2_g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:26:51.148Z] **ui-fb-mismatch** — day 2: UI words=20/exp40 day=2/exp3
