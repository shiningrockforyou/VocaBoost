# Findings — B_LIST_PROGRESS_PHASE1 (RUNSL_P1_SLP1_a967f54_v3)

**Run date:** 2026-07-12T14:22:22.893Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNSL P1 SLP1_a967f54_v3"
- [2026-07-12T14:23:10.291Z] **selector-gap** — 25WT RUNSL P1 SLP1_a967f54_v3: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T14:23:31.730Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=G2D-5ttrHZOBrFvPmdoPNCmmvbLOQ_6Pq7XJVtIn-D1EZrqLNQhwng&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:23:31.763Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=G2D-5ttrHZOBrFvPmdoPNCmmvbLOQ_6Pq7XJVtIn-D1EZrqLNQhwng&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:23:35.894Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=fqPMn5Z6t1xzUn0ASbLFiSnmEkVuacU1zTWes1AqRwDj6cjV8T9jZA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNSL P1 SLP1_a967f54_v3 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNSL P1 SLP1_a967f54_v3 → 3C7XEC
  - STEP [p1] join "25WT RUNSL P1 SLP1_a967f54_v3" via 3C7XEC → member
- [2026-07-12T14:24:14.687Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=K7wBbG03xuBjd5NFqqBiVV3BslH__i3M-9eKwlI75RctZ0QhhX6sAw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:24:14.696Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=DwA3Sud6EJxI5yhQkb-PLwo5CZ8FrR3v5FqtFWX66ZSFcx0IWJ0XGQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:24:44.214Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=3Quw3wXZwVXUdsPujLXrUwA6_pPoJ5IpIvI0vMH8kFC6V5stNdtWZA&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:24:44.221Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=XPnoO-PObD04ftoR8QMfStFRLiSI3jCj34Xe0l1clToowW3JwWL7Jg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:24:49.344Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7uLgbLZt7zoHSoMpoe7IWiYDl1kKbMIDiAkCyMv-q_7PKCPB8L-jHQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:25:18.104Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=vOqrNqTnr4KAG6JhZ4czzufem4Q4lRJ38KtcQAKckTXC2O1o709ssA&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:25:18.114Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ltFe55OIVGb92Kd3oRSucJl5RLautHpw1FrryAWqtFXYCHqRylEqfw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:25:42.984Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=UB1__fBaf9R8mb8ynv3b3VluYvnJgRUEEn1-zEDOlse1gLv2qLGOMw&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:25:42.991Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=VMRoX1SjFt1S1ta8eR6l9FUVcsvXFzGeRgGWvfsk2pqqZ5UK9QntOg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:25:48.124Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Uhnol9o25eZWjg9zGyYhIaNatPBga_a8xY2f8821cikh9rLWshcgZA&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:25:48.128Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=WudetMzt9p0rh6PsMS9Ny_65bjClvposuleLCthTAsRQhNb2-8Uq-g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:26:17.348Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=j-m_WuORtsdmdkPK-4XCnrUpGfcXMJf4g3EpGFJYCefUgsKVIj7hWg&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:26:17.354Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=mf6A-p2nEtMLJCF2afDivBxHcllnFI66OO3zC7GafynWOL_fAyQIAg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:26:43.955Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=HRzfHVq3g_S19XjTalMi8bbhsbtAXvHS0kpyPjRtTzqjx_evIXVmIQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:26:43.962Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=i67YQVSvv0UgV9-DNs-vNSrH_ael5iSDW5l5kdn5AgC_TnD96gMcEQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:26:49.074Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=VEycypKcq7foC9nagDLg2w9mgi2gNY6qmAZO_poG5HqmVvh9RDid2g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:26:49.087Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=PDxlhqwVpqwjIx-NVFrZXscrXv29DJPEnScV7NGOnaM9x_-GpwTjdA&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:27:18.241Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=KGo_nB2nFjiii6zAnhe3DCqOQeIA-q5Bgnu0uxSZ4rep9XXDTbF80Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:27:18.247Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=obQ6QibSOHAQFC05KNR26zGWkcrXZczPgkBerTFCPy2uNES6aN3f5Q&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:27:45.871Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=FXz0g896De7LADi6TmqLSjym8vQ5MqEvNQTDXM10aavTM54VFKFs5g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:27:45.877Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=uY00auQvygCm1YeUdDnK5FvAyQjqPPY_NjS7n0CLalIZFbReJ0mmQA&VER=8& — net::ERR_ABORTED
