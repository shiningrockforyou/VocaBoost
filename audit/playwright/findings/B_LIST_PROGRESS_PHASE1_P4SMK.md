# Findings — B_LIST_PROGRESS_PHASE1 (P4SMK)

**Run date:** 2026-07-18T08:52:50.176Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT P4SMK 1784364770623"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT P4SMK 1784364770623 (pace=20 thr=92 mode=typed) → ok
- [2026-07-18T08:53:43.707Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=JNHhKE_Ou1lAyOKTjeFA0O8ijuuB2-IKxRc9x40IOHqVyQyjS8Unqg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT P4SMK 1784364770623 → DHJUJ6
- [2026-07-18T08:54:03.194Z] **BUG** — [p4smk] joined "25WT P4SMK 1784364770623" via DHJUJ6 but the class is NOT present after join — candidate phantom membership (enrolledClasses set, class studentIds not; rules:57-60)
- [2026-07-18T08:54:03.284Z] **request-failed** — [p4smk] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Z26vPKpgCvwLOc30i7AUyFFz-wpeii_oL4j7vMHg32IP2mSqqqYI8A&VER=8& — net::ERR_ABORTED
- [2026-07-18T08:54:06.329Z] **recovery** — [p4smk] after "refresh" → still broken
- [2026-07-18T08:54:14.717Z] **recovery** — [p4smk] after "re-submit join" → still broken
- [2026-07-18T08:54:14.802Z] **request-failed** — [p4smk] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=m6I67t11fs-Sb8mJmRPRJ-oAZp-19RFuSgqKhGeAQM9XPuHm96ekJA&VER=8& — net::ERR_ABORTED
- [2026-07-18T08:54:17.842Z] **recovery** — [p4smk] after "refresh" → still broken
- [2026-07-18T08:54:17.844Z] **recovery** — [p4smk] NOT recovered by page-level [refresh, re-submit join, refresh] — orchestrator may relaunch; continuing scenario with degraded state
  - STEP [p4smk] join "25WT P4SMK 1784364770623" via DHJUJ6 → NOT a member after recovery — continuing
- [2026-07-18T08:54:29.867Z] **flow-gap** — [p4smk] single-list focus "" != "LSR Base Camp (audit clone)"
- [2026-07-18T08:54:52.446Z] **flow-gap** — [p4smk] no Start-New-Words/Continue button after 20008ms
  - STEP [teacher] create class "25WT P4SMK 1784364980541"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT P4SMK 1784364980541 (pace=20 thr=92 mode=typed) → ok
- [2026-07-18T08:57:13.244Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=EyOYGTTikL5JEhbABKlDztuq-gKOmPkHC8N7yE-tX69y8agqzCwpLQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT P4SMK 1784364980541 → A5STTW
- [2026-07-18T08:57:32.415Z] **BUG** — [p4smk] joined "25WT P4SMK 1784364980541" via A5STTW but the class is NOT present after join — candidate phantom membership (enrolledClasses set, class studentIds not; rules:57-60)
- [2026-07-18T08:57:32.511Z] **request-failed** — [p4smk] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zLBHtGcCxphB4lYfuqvk-7SDcrC1H1z2tnZB0xG-c81ZbasJJChlEg&VER=8& — net::ERR_ABORTED
- [2026-07-18T08:57:35.549Z] **recovery** — [p4smk] after "refresh" → still broken
- [2026-07-18T08:57:43.968Z] **recovery** — [p4smk] after "re-submit join" → still broken
- [2026-07-18T08:57:44.055Z] **request-failed** — [p4smk] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=pMaZgi1POnORWaoi8pc4mMLJRJaNsBMgehYrWuKe4wghjUeaOYR-mw&VER=8& — net::ERR_ABORTED
- [2026-07-18T08:57:47.104Z] **recovery** — [p4smk] after "refresh" → still broken
- [2026-07-18T08:57:47.105Z] **recovery** — [p4smk] NOT recovered by page-level [refresh, re-submit join, refresh] — orchestrator may relaunch; continuing scenario with degraded state
  - STEP [p4smk] join "25WT P4SMK 1784364980541" via A5STTW → NOT a member after recovery — continuing
- [2026-07-18T08:57:59.122Z] **flow-gap** — [p4smk] single-list focus "" != "LSR Base Camp (audit clone)"
- [2026-07-18T08:58:21.691Z] **flow-gap** — [p4smk] no Start-New-Words/Continue button after 20014ms
