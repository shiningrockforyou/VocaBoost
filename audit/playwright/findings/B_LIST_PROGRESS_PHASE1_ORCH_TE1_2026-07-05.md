# Findings — B_LIST_PROGRESS_PHASE1 (ORCH_TE1_2026-07-05)

**Run date:** 2026-07-05T07:54:38.166Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [stu] join "25WT LSR-TCH-A" via TCHAAA → visible
- [2026-07-05T07:55:31.607Z] **selector-gap** — [s22-d1] Session-menu button not visible
- [2026-07-05T07:55:46.670Z] **flow-gap** — [s22-d1] test page (typed or MCQ) not reached
- [2026-07-05T07:55:47.785Z] **selector-gap** — class switch: no Class control and not already on "25WT LSR-TCH-A"
- [2026-07-05T07:55:47.791Z] **flow-gap** — [openStudy] no Start-New-Words/Continue button
- [2026-07-05T07:55:47.958Z] **request-failed** — [TE1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qMZU73dJsiuaMlB0u_3-S9GTHkz2ONQWAQ5m-xFBFfOiA307C68gFw&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:55:47.980Z] **request-failed** — [TE1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qMZU73dJsiuaMlB0u_3-S9GTHkz2ONQWAQ5m-xFBFfOiA307C68gFw&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:55:53.550Z] **native-dialog** — [TE1-T] confirm: Are you sure you want to remove this student from the class? — accepted
- [2026-07-05T07:55:53.682Z] **request-failed** — [TE1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=TijLBeGAr8bO_sTVsgjFLkue7UYVVrHcqzjTb2a582aHuoNg8CWA7A&VER=8&d — net::ERR_ABORTED
  - STEP [teacher] remove "LSR Student 22" from 25WT LSR-TCH-A
- [2026-07-05T07:55:56.110Z] **request-failed** — [TE1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nqAm7J-JgXjQLWi0BcOwGMElTIJZlNzmnIXa8oKvXbtYwqs1lRHsXA&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:55:56.119Z] **request-failed** — [TE1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=fJ6fG8uuplAA1gb3dWDVnZJe9hp1x_Eysu_MFO6HCB2iIF3D4mQXLw&VER=8&d — net::ERR_ABORTED
- [2026-07-05T07:55:59.299Z] **observation** — [TE1] student removed mid-session; still sees the list=false; verify progress NOT destroyed (removeStudentFromClass deletes no progress) post-snapshot
