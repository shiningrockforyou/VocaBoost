# Findings — B_LIST_PROGRESS_PHASE1 (RUNLFIX_L_20260705_235509)

**Run date:** 2026-07-05T23:55:25.828Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNL L1-T L_20260705_235509"
- [2026-07-05T23:56:13.393Z] **selector-gap** — 25WT RUNL L1-T L_20260705_235509: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-05T23:56:34.883Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=iPr3b80Iy6JHVlmVrFLJ6VGqQFM-S51HpVJTO5Fh4m22nzywlqBR5A&VER=8&d — net::ERR_ABORTED
- [2026-07-05T23:56:34.906Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=iPr3b80Iy6JHVlmVrFLJ6VGqQFM-S51HpVJTO5Fh4m22nzywlqBR5A&VER=8&d — net::ERR_ABORTED
- [2026-07-05T23:56:39.013Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=aUTHqQWUAYT0fCaU0ShykN4DcdAEKAlNMMOOAu91MnB_XFepy9MmqA&VER=8& — net::ERR_ABORTED
- [2026-07-05T23:56:39.058Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=aUTHqQWUAYT0fCaU0ShykN4DcdAEKAlNMMOOAu91MnB_XFepy9MmqA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNL L1-T L_20260705_235509 (pace=80 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNL L1-T L_20260705_235509 → CEKAU9
  - STEP [teacher] create class "25WT RUNL L1-M L_20260705_235509"
- [2026-07-05T23:57:09.428Z] **selector-gap** — 25WT RUNL L1-M L_20260705_235509: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-05T23:57:09.439Z] **selector-gap** — 25WT RUNL L1-M L_20260705_235509: assign Test Mode set failed
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNL L1-M L_20260705_235509 (pace=80 thr=92 mode=mcq) → unverified
- [2026-07-05T23:57:13.856Z] **selector-gap** — teacher: open class "25WT RUNL L1-M L_20260705_235509" failed
  - STEP [teacher] create class "25WT RUNL L1-T L_20260705_235509"
- [2026-07-05T23:58:18.090Z] **selector-gap** — 25WT RUNL L1-T L_20260705_235509: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-05T23:58:39.544Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=6mzpLm9UyyMt_M5dpKgZf79bHx7_qHQUOybm6sagsgiNvFdiKs_-Ow&VER=8&d — net::ERR_ABORTED
- [2026-07-05T23:58:39.567Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=6mzpLm9UyyMt_M5dpKgZf79bHx7_qHQUOybm6sagsgiNvFdiKs_-Ow&VER=8&d — net::ERR_ABORTED
- [2026-07-05T23:58:43.694Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nU4y9-kr1MgOrrUudp8s-LAylmpU2Fpfwo4YV9texRFDNQFbEJwlNg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNL L1-T L_20260705_235509 (pace=80 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNL L1-T L_20260705_235509 → CEKAU9
  - STEP [teacher] create class "25WT RUNL L1-M L_20260705_235509"
- [2026-07-05T23:59:36.656Z] **selector-gap** — 25WT RUNL L1-M L_20260705_235509: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-05T23:59:58.238Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=45gjtLTek79BVTyQA2AMZT1-t2RrBsU2lOW_wX4MIi6TiDzR2zCtZA&VER=8&d — net::ERR_ABORTED
- [2026-07-06T00:00:02.268Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=jyUgWmof9noXP5MoiBWwo93kR5Vaq7RWCHrle59ufRaWtTpidUFWMw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNL L1-M L_20260705_235509 (pace=80 thr=92 mode=mcq) → ok
  - STEP [teacher] read join code for 25WT RUNL L1-M L_20260705_235509 → ERY2DL
  - STEP [teacher] create class "25WT RUNL L1-R L_20260705_235509"
- [2026-07-06T00:00:55.195Z] **selector-gap** — 25WT RUNL L1-R L_20260705_235509: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-06T00:01:16.780Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=xzGoIPB0Ysohp6FfzPvJnw7PnEsCxFnzRD1xm2_H4gTYRV1FxyO4LQ&VER=8&d — net::ERR_ABORTED
- [2026-07-06T00:01:20.805Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-wkNrRn5oAFuFpdbDmMPprtDHWiNHQHhDW6CKRttvQtrGxjMg4wyJQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNL L1-R L_20260705_235509 (pace=80 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNL L1-R L_20260705_235509 → DCUKJ3
  - STEP [teacher] create class "25WT RUNL L2B L_20260705_235509"
- [2026-07-06T00:02:13.754Z] **selector-gap** — 25WT RUNL L2B L_20260705_235509: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-06T00:02:35.331Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Z6cVe6pMc8VYVuQZoJT6ShhNYKqEmDh9lBHQVewifvfS4-mBeeOEaw&VER=8&d — net::ERR_ABORTED
- [2026-07-06T00:02:39.382Z] **request-failed** — [fix-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=cpwO6RAXMEWYhOsUJ2uFwcKp062c8D0evfO3hJAQyqqp3GA9WUdYpQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNL L2B L_20260705_235509 (pace=80 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNL L2B L_20260705_235509 → X2Q5BX
  - STEP [L1-T] join "25WT RUNL L1-T L_20260705_235509" via CEKAU9 → member
  - STEP [L1-M] join "25WT RUNL L1-M L_20260705_235509" via ERY2DL → member
  - STEP [L1-R] join "25WT RUNL L1-R L_20260705_235509" via DCUKJ3 → member
  - STEP [L2] join "25WT RUNL L2B L_20260705_235509" via X2Q5BX → member
