# Findings — B_LIST_PROGRESS_PHASE1 (RUNSL_P1_SLP1_1783825362789)

**Run date:** 2026-07-12T03:02:52.790Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNSL P1 SLP1_1783825362789"
- [2026-07-12T03:03:40.143Z] **selector-gap** — 25WT RUNSL P1 SLP1_1783825362789: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T03:04:01.638Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=caP_BrITZgIkJirK9uq4sRps6TEqtQDwSaswQocMXQE-MAftp_EWDw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T03:04:05.754Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=rLwv4mWT1Ma1yVbMRAQi6OK9zg0-XUuPOwMqr4oNKoWlV3y9IhlnDQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T03:04:05.781Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=rLwv4mWT1Ma1yVbMRAQi6OK9zg0-XUuPOwMqr4oNKoWlV3y9IhlnDQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNSL P1 SLP1_1783825362789 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNSL P1 SLP1_1783825362789 → AMUGB2
  - STEP [p1] join "25WT RUNSL P1 SLP1_1783825362789" via AMUGB2 → member
- [2026-07-12T03:04:41.596Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BTV1y_ox_Svvk9YQrRJuAvDRY3U3Yfx-XVZvbqE4FTqFYpsw9C0Www&VER=8& — net::ERR_ABORTED
- [2026-07-12T03:04:41.602Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=HbovZlqkrjY1daYHZl5oj9ndYRAQNjWAl7XIwFWK1obkW3C0rQ7rJA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T03:05:13.842Z] **day-guard-warn** — [p1-student] Duplicate day completion blocked: expected day 2, got day 1
- [2026-07-12T03:05:19.497Z] **native-dialog** — [p1-student] beforeunload:  — accept
- [2026-07-12T03:05:19.730Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zhivwooplaIr3JkkWoOVXSD0phPlobguF-QEN02lBprCGAnu2My4qw&VER=8& — net::ERR_ABORTED
- [2026-07-12T03:05:19.737Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=8joqPnXRvE_szS99zjqc8Wr0wVuPedWWXwPQqyZFEnepttCHWT1DdA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T03:05:24.823Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=WCTs8S1pzta6sg35sjKKPZ94Cl7OrUgbB7sDnTKYfe9yXBPpHdhxiQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T03:05:24.827Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Mx4ZIhmWB1_Xi-EC2OfLR3dVMqmNbdEvNkAZcYEx9BjaC7i1ApSbZg&VER=8& — net::ERR_ABORTED
- [2026-07-12T03:05:29.995Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=FKsDu_FknULcx1W08xTIflNXv4kv2xNz0nLonh0LLvm8kqX853A4Hg&VER=8& — net::ERR_ABORTED
- [2026-07-12T03:05:30.010Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=2gb3m74N71LHphmhvSYDn0btFxYNjCQuPVZGC7mfQoxJEkBlSMPoog&VER=8&d — net::ERR_ABORTED
- [2026-07-12T03:05:51.075Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=OAjMEYHW5bXfOJ-lT3hWEY2OpO0sV9e73oQTYU7AlR89xDs1sQ144w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T03:05:51.086Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=LFU9KK-i5QYWrcSjkTRBelIDsjtptNsy9mizUl_eZ9_nYNS6aeGV9w&VER=8& — net::ERR_ABORTED
- [2026-07-12T03:05:54.687Z] **flow-gap** — [d2-review] no Review/Continue button
- [2026-07-12T03:05:54.697Z] **flow-gap** — [d2] review not reached
- [2026-07-12T03:05:54.789Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=sQWK6JKPHMMyDSkxwSBalvWU5DfHnzaYK3TFC_hPMacqK8RoCWPQLg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T03:05:54.798Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_y1GetPYijEdDe9U7AqujtVDwZbFo6RQyzGkxGA0m8ZvmDwohYDBXw&VER=8& — net::ERR_ABORTED
- [2026-07-12T03:06:20.103Z] **ui-fb-mismatch** — day 2: UI words=20/exp40 day=2/exp3
