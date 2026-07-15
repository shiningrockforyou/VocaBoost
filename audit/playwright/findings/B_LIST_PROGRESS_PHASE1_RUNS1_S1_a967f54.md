# Findings — B_LIST_PROGRESS_PHASE1 (RUNS1_S1_a967f54)

**Run date:** 2026-07-12T11:13:06.484Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNS1 A S1_a967f54"
- [2026-07-12T11:13:53.772Z] **selector-gap** — 25WT RUNS1 A S1_a967f54: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T11:14:15.275Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Ab8Zko6_BoxHga1NMo34MRSHXPcp5TFaxsMS-DllbCzroedNRw8mNQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:14:19.324Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=XuqIXLfUyUWnJEcY0waPMdDtlht5tYHye1MAEVFleqVE9n_Pwg3G-g&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:14:19.389Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=XuqIXLfUyUWnJEcY0waPMdDtlht5tYHye1MAEVFleqVE9n_Pwg3G-g&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 A S1_a967f54 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 A S1_a967f54 → SUV4PP
  - STEP [teacher] create class "25WT RUNS1 B S1_a967f54"
- [2026-07-12T11:15:12.476Z] **selector-gap** — 25WT RUNS1 B S1_a967f54: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T11:15:33.990Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=eTRvXR2FMXWjtExWiUZTnNwKIXvdvL9PS4fwequcdIFOK9Rp5aatbg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:15:38.086Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=MSh85H2_wvWMGs_gLNmmNtt-ZbEp19By_Ak9e7qr4yKMEwNEBTj6CQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 B S1_a967f54 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 B S1_a967f54 → 48XJ3B
  - STEP [s1-A] join "25WT RUNS1 A S1_a967f54" via SUV4PP → member
  - STEP [s1-B] join "25WT RUNS1 B S1_a967f54" via 48XJ3B → member
- [2026-07-12T11:16:10.853Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nzvOnIHa66AATK6GLAwLSes5dNexf6DPj3apo6rxkHZS6N9iSa50JQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:16:10.862Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=sPPtx019Zg3QL50PYIkP0vpFLVRCrGIhBUfFlEL_yXRu_VMCvsLAFw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:16:44.308Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=D10yydx0_CPLWSCmnFQZXfr1dYZ2wU7zQuLyfoEtV-ZjrEZhvdxKLA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:16:44.313Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=fQms5ZrunRfqzfVJb-3y_WjOo4v_GQd7vtJJ8gSS1aLMg5TeqZMjBQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:17:21.686Z] **selector-gap** — [s1-A-d2-new] Session-menu button not visible
- [2026-07-12T11:17:36.755Z] **flow-gap** — [s1-A-d2-new] test page (typed or MCQ) not reached
- [2026-07-12T11:17:38.166Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Bs55dlxEdlfaa-m3LCsbxeZ33fpfLzUNreb-KUP4nOk1LDR_iPw1qQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:17:38.259Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=416QCIHAIJgoaESC5dwDbcYQYe0kZaUoupxwZP6ue1l01jfg6kcfkw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:17:39.738Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Bs55dlxEdlfaa-m3LCsbxeZ33fpfLzUNreb-KUP4nOk1LDR_iPw1qQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T11:17:39.747Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=416QCIHAIJgoaESC5dwDbcYQYe0kZaUoupxwZP6ue1l01jfg6kcfkw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:17:47.807Z] **flow-gap** — [s1-B-review] no Review/Continue button
- [2026-07-12T11:17:47.891Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=VXSZ_OD4_3Y0ucmlLugM3ryZUFj1FHpKU0zysTQbTDeD129ygRSlVg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T11:17:47.901Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tjE7NZgKW44hepQ0BQHheSLof92BtQFr2WSoamUQug5O0RUp5l93vw&VER=8& — net::ERR_ABORTED
