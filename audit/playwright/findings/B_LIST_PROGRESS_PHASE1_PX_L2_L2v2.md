# Findings — B_LIST_PROGRESS_PHASE1 (PX_L2_L2v2)

**Run date:** 2026-07-12T17:15:22.270Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L2 S0 L2v2"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L2 S0 L2v2 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T17:16:22.915Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=54MZw5AIfRh_5-BolKINAwbVSBO9xPvu-o_VdQai32cdXBx8jJy00w&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L2 S0 L2v2 → LFNKAD
- [2026-07-12T17:16:32.758Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=pgG7yNtX4kps1pnkheOl8df4vB5Ao3kHW9S4jxkPrvYPh1zTRrKpXA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:16:32.763Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=pgG7yNtX4kps1pnkheOl8df4vB5Ao3kHW9S4jxkPrvYPh1zTRrKpXA&VER=8& — net::ERR_ABORTED
  - STEP [L2-s0] join "25WT PX L2 S0 L2v2" via LFNKAD → member
- [2026-07-12T17:16:43.859Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8coeKrdLHH5oTqbuh8DvdEM6JPoREX4Z6N-2t_GRlgLPU_p258MSUw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:16:43.864Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=6gZ5eb2Sin3xBc11uXdXu61xVcwoX9DavQtYWN9nVTUvAykaZ3MjCg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:16:48.995Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=jgv-GAkwuOVz3V3SG3TU0SUvW4n3m6C69iU7zyeyOJgZ4lr7Lq6PFQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:16:54.038Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=J_EH9aCwGiCkMz9mptyHKd4ZJXS7Ls-2QLaWu4LImF1B-NGRQjGNPA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:16:59.075Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=79NYe6K945DuRbvJggFJ5nV3nqDbXBGABJnJwOqPETsxWQkW-MFUsg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:04.029Z] **flow-gap** — [dashReady] could not establish context after 4 tries: want Class~"25WT PX L2 S0 L2v2" List~"LSR Ascent (audit clone)", saw Class="Class:" List="List:"
- [2026-07-12T17:17:05.623Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=37Y9xvuBZARQeX4O70kA9EAUITeS7ge6OGQyQ_S0voEqjOgg_bAvLw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:10.658Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=mlF1RqZbUNztl-Rlm3BygwabcE_kxYX7S_pKSmWQ5vxHXCuysQNotw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:15.698Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ZWa6BkcJnjRyo6R0ZRk6ZkAFw_7wYeZcqyRTZOYcLNNgNU1o9doyVw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:20.733Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=S7Ox8CSt0myVvNcfn6759Fi-T247l49L6LHkDD7vXjy-q34Y9p3pbA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:25.698Z] **flow-gap** — [dashReady] could not establish context after 4 tries: want Class~"25WT PX L2 S0 L2v2" List~"LSR Ascent (audit clone)", saw Class="Class:" List="List:"
- [2026-07-12T17:17:27.289Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Ffp1aS5JfCDY3eM6yDZxHOuLe_TF71mgXhLIuS2EY8a2V57L140kWQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:32.328Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=I7OZ2dH4hIIA0_5NS3N4Im_dSSN7vJ-C4mu6azHdDPzXYk7e_jwElA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:37.371Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=eZ8ktg1a1ThYIUeE-E3ASwdaG5p-PfoarxOU-6-5Yc6rZqHc6YgWzA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:42.415Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=rWqYr0C-x3xNSpy1CTxlyYyqk_ZRJc1SJwohQdcNd1rnQFb6mNJHDw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:47.374Z] **flow-gap** — [dashReady] could not establish context after 4 tries: want Class~"25WT PX L2 S0 L2v2" List~"LSR Ascent (audit clone)", saw Class="Class:" List="List:"
- [2026-07-12T17:17:48.964Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=0RMmMy_vdNgk2vMhxyjWm2VOKGhVnlEOn5-zUP6zZCE-ev_3BccnRg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:53.996Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=9BLD2xnueJKdnfgTmtLjmADsM46u-v5_A_yTER0sZSutUM2vGqa7Vw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:17:59.025Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=CVBnS2fGxYsqrsK742tCo4twwqHmYZjkdlvfEKxu16B71qJFRGv4mA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:18:04.065Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=oOT-jDdNFCCf59joyZVzKfUazG96WE-0QD48R0tQMi6rwOgVNTMXxw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:18:09.015Z] **flow-gap** — [dashReady] could not establish context after 4 tries: want Class~"25WT PX L2 S0 L2v2" List~"LSR Ascent (audit clone)", saw Class="Class:" List="List:"
