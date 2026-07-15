# Findings — B_LIST_PROGRESS_PHASE1 (RUNS1_S1_a967f54_r4)

**Run date:** 2026-07-12T12:06:31.807Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNS1 A S1_a967f54_r4"
- [2026-07-12T12:07:20.268Z] **selector-gap** — 25WT RUNS1 A S1_a967f54_r4: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T12:07:41.706Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=9eBDsceDD8MwxyVwBGSdT_p5aQJB78iDTvYpXfsGJQTfClzSWPXZjw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:07:41.738Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=9eBDsceDD8MwxyVwBGSdT_p5aQJB78iDTvYpXfsGJQTfClzSWPXZjw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:07:45.819Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iqMFLc9ZSY4CwS2F7MMegTI5zOWLGZpUyqA0Z3KLZ6eX6JMQUc-xnQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:07:45.901Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iqMFLc9ZSY4CwS2F7MMegTI5zOWLGZpUyqA0Z3KLZ6eX6JMQUc-xnQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 A S1_a967f54_r4 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 A S1_a967f54_r4 → 8PCUGL
  - STEP [teacher] create class "25WT RUNS1 B S1_a967f54_r4"
- [2026-07-12T12:08:39.067Z] **selector-gap** — 25WT RUNS1 B S1_a967f54_r4: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T12:09:00.566Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=QadvjsRPwXBr9ZQVtHGqh-qiwMojw0P0yhdLSmLNllwMZ7lpLgyrBA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:09:04.706Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Qrkl-st9rB1vrqdnO0SizjSmPwoSH6a-ZJv_pNLHs3xkuowVxvstfw&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:09:04.711Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Qrkl-st9rB1vrqdnO0SizjSmPwoSH6a-ZJv_pNLHs3xkuowVxvstfw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 B S1_a967f54_r4 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 B S1_a967f54_r4 → 4A48J6
  - STEP [s1-A] join "25WT RUNS1 A S1_a967f54_r4" via 8PCUGL → member
  - STEP [s1-B] join "25WT RUNS1 B S1_a967f54_r4" via 4A48J6 → member
- [2026-07-12T12:09:38.116Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=pQu-wV0AAo2WUkJcqjxdAUb4pa7Y6CCQjoG_R2lnF3CsC0U4fjD9PA&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:09:38.124Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Rp16TFQLj63NClYuM9-05k0HvOwXaorc09Sr-CE2LhvBd9OpnDNc5g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:10:13.910Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=JNy1s7mjIF9r5QHZxRspF-mguxbNgF2UmXsvQPqMdmOHr1ydSN6kHg&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:10:13.917Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=B4h4qomUxdnFLPhAkVokGlBaVDipfmswKBqUA5VXhrzZbdHTR8mTlQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:10:43.249Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=UlEmv-Qv3H3DE05v3kf1knVhT9vr0OOL_hzXPmmXiRRi8-Cp5YH8oA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:10:43.259Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zT9c9BnDferr6hEKHAofKLXdivFwidWVrRtT6UxXer8CUNXv9UUSNQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:11:11.331Z] **flow-gap** — [s1-B-review] no Review/Continue button after 19998ms
- [2026-07-12T12:11:11.427Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=moVHZ4SAqxMtvNUEdxIVYWelFJcVsoUPRSlB0T4c0v5h-zN9fmHhCg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:11:11.437Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=sqwsJ8r6K39I2YdrosHoI04ZbwKW9t2TKdPylI9ndnAUyAOtWgOa4g&VER=8& — net::ERR_ABORTED
