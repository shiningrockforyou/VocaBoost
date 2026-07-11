# Findings — B_LIST_PROGRESS_PHASE1 (RUNLDRVSMOKE_mr8fz35h)

**Run date:** 2026-07-05T23:48:13.877Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNLSMOKE mr8fz35h"
- [2026-07-05T23:49:01.427Z] **selector-gap** — 25WT RUNLSMOKE mr8fz35h: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-05T23:49:22.996Z] **request-failed** — [drvsmoke-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=kZyiuAL3vagYE7KcbQ4Cbfi8P_JD5XyUH3AmeUZDpud1Yd-9xNYvjQ&VER=8&d — net::ERR_ABORTED
- [2026-07-05T23:49:27.058Z] **request-failed** — [drvsmoke-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=5xhbUTYtgHuxXp-D94fngXaF1K1WQV0UzdBREW1rDj5TXdetmvX6wA&VER=8& — net::ERR_ABORTED
- [2026-07-05T23:49:27.096Z] **request-failed** — [drvsmoke-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=5xhbUTYtgHuxXp-D94fngXaF1K1WQV0UzdBREW1rDj5TXdetmvX6wA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNLSMOKE mr8fz35h (pace=80 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNLSMOKE mr8fz35h → 5ZV9NR
  - STEP [drvsmoke] join "25WT RUNLSMOKE mr8fz35h" via 5ZV9NR → member
- [2026-07-05T23:50:10.663Z] **BUG** — [drvsmoke] no visible outcome within 120s (infinite loading?)
- [2026-07-05T23:50:13.474Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNLSMOKE mr8fz35h"
- [2026-07-05T23:50:13.476Z] **flow-gap** — [drvsmoke] single-list focus "" != "LSR TOP Vocab (audit clone)"
- [2026-07-05T23:50:13.480Z] **flow-gap** — [drvsmoke-enter] no Start Session/Continue to enter the session
- [2026-07-05T23:50:13.483Z] **flow-gap** — [drvsmoke] "Quit session" control not visible
