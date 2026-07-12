# Findings — B_LIST_PROGRESS_PHASE1 (RUNS1_S1_1783819271943)

**Run date:** 2026-07-12T01:21:22.513Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNS1 A S1_1783819271943"
- [2026-07-12T01:22:09.755Z] **selector-gap** — 25WT RUNS1 A S1_1783819271943: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T01:22:31.260Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=4P_2u22LZQwB__8FSOfo4KKOon4ZS4hFDITn7-aKH0QIwLnw-h8SXA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:22:35.365Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=gJiVklOwUFotlT03G_fQ3EvjUeELoTHMLqgxZQIFsiEvQezdoZOq3w&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:22:35.373Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=gJiVklOwUFotlT03G_fQ3EvjUeELoTHMLqgxZQIFsiEvQezdoZOq3w&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 A S1_1783819271943 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 A S1_1783819271943 → 9XL3FH
  - STEP [teacher] create class "25WT RUNS1 B S1_1783819271943"
- [2026-07-12T01:23:28.506Z] **selector-gap** — 25WT RUNS1 B S1_1783819271943: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T01:23:50.009Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=tYBn3xeaEYpoGOvnJv4m1EYcjm-HPCnM4ZYWfdc4iJe0SrpCXtlbQQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:23:54.079Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=4QgKWfVRrEtYx6iC0Z-h3dwGJCFuS8xtP28SOtXbl6_Ps0NRlhfExw&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:23:54.164Z] **request-failed** — [s1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=4QgKWfVRrEtYx6iC0Z-h3dwGJCFuS8xtP28SOtXbl6_Ps0NRlhfExw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNS1 B S1_1783819271943 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNS1 B S1_1783819271943 → 2G7XHT
  - STEP [s1-A] join "25WT RUNS1 A S1_1783819271943" via 9XL3FH → member
  - STEP [s1-B] join "25WT RUNS1 B S1_1783819271943" via 2G7XHT → member
- [2026-07-12T01:24:56.964Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ejgRNfps3nBVf5TVSdeJLEeBhilUZrw3qHhQ-fxXHeSHscXpDD1pGA&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:25:02.221Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KRz6PcIIVsI_xBJYyCS4W6ZT3tLkN0b7ye-yp_L72n3XzXC1OWEtOQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:25:10.247Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:25:14.182Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 A S1_1783819271943"
- [2026-07-12T01:25:35.688Z] **flow-gap** — [25WT RUNS1 A S1_1783819271943] no study affordance after settle
- [2026-07-12T01:25:36.196Z] **flow-gap** — [s1-A-d2-new] no Start-New-Words/Continue button
- [2026-07-12T01:25:36.215Z] **flow-gap** — [s1-A-d2-leave] "Quit session" control not visible
- [2026-07-12T01:25:41.630Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:25:45.552Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 B S1_1783819271943"
- [2026-07-12T01:26:02.278Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KRz6PcIIVsI_xBJYyCS4W6ZT3tLkN0b7ye-yp_L72n3XzXC1OWEtOQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:26:02.285Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ejgRNfps3nBVf5TVSdeJLEeBhilUZrw3qHhQ-fxXHeSHscXpDD1pGA&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:26:02.439Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ejgRNfps3nBVf5TVSdeJLEeBhilUZrw3qHhQ-fxXHeSHscXpDD1pGA&VER=8& — net::ERR_ABORTED
- [2026-07-12T01:26:02.483Z] **request-failed** — [s1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KRz6PcIIVsI_xBJYyCS4W6ZT3tLkN0b7ye-yp_L72n3XzXC1OWEtOQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T01:26:07.060Z] **flow-gap** — [25WT RUNS1 B S1_1783819271943] no study affordance after settle
- [2026-07-12T01:26:07.571Z] **flow-gap** — [s1-B-review] no Review/Continue button
- [2026-07-12T01:26:12.993Z] **unexpected-dialog** — [s1-student] UNEXPECTED native dialog (not armed): "" — auto-dismissed
- [2026-07-12T01:26:16.918Z] **selector-gap** — class switch: no Class control and not already on "25WT RUNS1 A S1_1783819271943"
- [2026-07-12T01:26:38.426Z] **flow-gap** — [25WT RUNS1 A S1_1783819271943] no study affordance after settle
