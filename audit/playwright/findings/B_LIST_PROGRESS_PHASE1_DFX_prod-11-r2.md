# Findings — B_LIST_PROGRESS_PHASE1 (DFX_prod-11-r2)

**Run date:** 2026-07-15T23:19:03.629Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFX RA1 prod-11-r2"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA1 prod-11-r2 (pace=3 thr=92 mode=typed) → ok
- [2026-07-15T23:20:05.458Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=sJwfH5V900Kr-P_0mFffHUIrWaqT1pZYzWIMtwPo87qV7JDhZb0vyQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA1 prod-11-r2 → KHTGCM
  - STEP [RA1] join "25WT DFX RA1 prod-11-r2" via KHTGCM → member
- [2026-07-15T23:20:24.379Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=w7krif0TH2UVk5bKK810dtBbHGuqydF_MXnBHcqDbsc0vFHZrrqDfw&VER=8&d — net::ERR_ABORTED
- [2026-07-15T23:20:24.389Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=xACSBwXFbp4EP4R1ht8G207m-fcNHLqh43GsFBb1_wRN2dzVNBqkRA&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:21:04.338Z] **selector-gap** — [RA1] Session-menu button not visible after 30000ms
- [2026-07-15T23:21:15.019Z] **request-failed** — [student-RA1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=t-4i7g_T9fkr4AfWIB5Ury5gU6nkDWtiV9H8iDd1vtoJmNHhbcf8AQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] create class "25WT DFX RA2 prod-11-r2"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFX RA2 prod-11-r2 (pace=3 thr=92 mode=typed) → ok
- [2026-07-15T23:22:10.481Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=9rhb0tppQpSnq4HI1TaXfmOk8-14oTO6--tmNAkoDK_oKK_uRxB8XQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX RA2 prod-11-r2 → 9N6ETR
  - STEP [RA2] join "25WT DFX RA2 prod-11-r2" via 9N6ETR → member
- [2026-07-15T23:22:29.416Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ZA-Ec8kq0465cnGnoPLhyGahOjVtfypMDyJwlb5B9b0-bcch03SPew&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:22:29.430Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=neUqb5o0dOGhr55ziszWeKW28QE32NtNYrfxkm3Rb9oQUvQ0hMOiRw&VER=8&d — net::ERR_ABORTED
- [2026-07-15T23:23:09.364Z] **selector-gap** — [RA2-d0] Session-menu button not visible after 29999ms
- [2026-07-15T23:23:20.056Z] **request-failed** — [student-RA2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=buNVJUdVE7Wt8lXbPwzVKqoGPPN5HgDIkkQK24SjWL2xBRmZcrlbwA&VER=8& — net::ERR_ABORTED
