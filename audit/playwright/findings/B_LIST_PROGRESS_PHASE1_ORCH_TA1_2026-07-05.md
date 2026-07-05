# Findings — B_LIST_PROGRESS_PHASE1 (ORCH_TA1_2026-07-05)

**Run date:** 2026-07-05T07:36:41.524Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [stu] join "25WT LSR-A TYPED" via 6HSWTU → visible
- [2026-07-05T07:37:36.364Z] **request-failed** — [TA1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=uQPNmD9iSrP23QbCV0cVzWZsveCAhZySe9POy7ORuaanKhQ5jXq5ow&VER=8&d — net::ERR_ABORTED
- [2026-07-05T07:37:36.370Z] **request-failed** — [TA1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=EOSSZFAQ8_N7-VftIMtlEdJsitTnwhAg5neNkUcC41gTNpJlK1m3iQ&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:37:38.566Z] **flow-gap** — [s17-d1-rev] no Review/Continue button
- [2026-07-05T07:37:51.250Z] **request-failed** — [TA1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=LD7s7elrHiVaENDoL_h20O9dxOer_Cr0ZraPK1A4lnNJpFlIkAkSfg&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:37:51.293Z] **request-failed** — [TA1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=LD7s7elrHiVaENDoL_h20O9dxOer_Cr0ZraPK1A4lnNJpFlIkAkSfg&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:38:04.561Z] **selector-gap** — [s17-d2] Session-menu button not visible
- [2026-07-05T07:38:19.566Z] **flow-gap** — [s17-d2] test page (typed or MCQ) not reached
- [2026-07-05T07:38:28.463Z] **native-dialog** — [TA1-T] confirm: Remove this list from the class? Student progress is saved. — accepted
- [2026-07-05T07:38:50.777Z] **request-failed** — [TA1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=q52WU_Fah_-jNGe4C4IQiz9S4l7o79nO-Druo35gaQdD_takJ02ECg&VER=8&d — net::ERR_ABORTED
- [2026-07-05T07:38:50.798Z] **request-failed** — [TA1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=6RZ_CRTiYprWcahVCNiIOLwj3DB2_sAcb_kPvvvIx5yzS5BG1JoZXw&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:38:59.676Z] **selector-gap** — 25WT LSR-A TYPED: assign list select "LSR CORE Vocab (audit clone)" failed
- [2026-07-05T07:39:20.871Z] **request-failed** — [TA1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=q52WU_Fah_-jNGe4C4IQiz9S4l7o79nO-Druo35gaQdD_takJ02ECg&VER=8&d — net::ERR_ABORTED
- [2026-07-05T07:39:20.877Z] **request-failed** — [TA1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=6RZ_CRTiYprWcahVCNiIOLwj3DB2_sAcb_kPvvvIx5yzS5BG1JoZXw&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:39:28.486Z] **request-failed** — [TA1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iU3HdyupdZ8t7hiT5a6H0X4y6IkHQAxgpUMRDLLJW448TcRknq7N7A&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:39:28.543Z] **request-failed** — [TA1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=cLd2qchMlUltoVIksT87kYuOB-uF-yWYYW3hUNDeKmzCzM57IHT_nw&VER=8&d — net::ERR_ABORTED
- [2026-07-05T07:39:28.689Z] **request-failed** — [TA1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iU3HdyupdZ8t7hiT5a6H0X4y6IkHQAxgpUMRDLLJW448TcRknq7N7A&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:40:29.757Z] **selector-gap** — 25WT LSR-A TYPED: assign Test Mode set failed
  - STEP [teacher] assign "LSR CORE Vocab (audit clone)" to 25WT LSR-A TYPED (pace=80 thr=92 mode=typed) → unverified
- [2026-07-05T07:42:05.275Z] **observation** — [TA1] default focus list before="List:" after teacher list-add="null" — unchanged (good)
  - STEP [stu] join "25WT LSR-TCH-A" via TCHAAA → visible
- [2026-07-05T07:47:14.300Z] **request-failed** — [TA1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=y7a13Ry0Mfl3JNdX1JkVKkqMZtd96C5N2Eujnpchq-kwOOWkBuG-mg&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:47:14.307Z] **request-failed** — [TA1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=xy8eItBVTB3PZ_90ULBbCAFNsF_GDRBSb5cQW38vFj_E4vw745bEHA&VER=8&d — net::ERR_ABORTED
- [2026-07-05T07:47:16.491Z] **flow-gap** — [s17-d1-rev] no Review/Continue button
- [2026-07-05T07:47:29.133Z] **request-failed** — [TA1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=D1gNtBabmTJs77pLt4PHgzmxZEdUt4R4NRTwpKtxyzMnrNnQV19w9Q&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:47:29.176Z] **request-failed** — [TA1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=D1gNtBabmTJs77pLt4PHgzmxZEdUt4R4NRTwpKtxyzMnrNnQV19w9Q&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:47:50.475Z] **selector-gap** — [s17-d2] Session-menu button not visible
- [2026-07-05T07:48:05.480Z] **flow-gap** — [s17-d2] test page (typed or MCQ) not reached
- [2026-07-05T07:48:06.677Z] **request-failed** — [TA1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=L0lh-wuaMugwt-EtCWICYT4q5yJc3ULN6-OiiR81E4tcG0RaIwm26g&VER=8&d — net::ERR_ABORTED
- [2026-07-05T07:48:06.705Z] **request-failed** — [TA1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=eXxWspTO9XFNDNVrFb3Ybv8GYZPS4zTaB1kOMJrWQtt0IBX3rAbvag&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:48:45.588Z] **selector-gap** — 25WT LSR-TCH-A: assign list select "LSR CORE Vocab (audit clone)" failed
- [2026-07-05T07:49:06.740Z] **request-failed** — [TA1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=L0lh-wuaMugwt-EtCWICYT4q5yJc3ULN6-OiiR81E4tcG0RaIwm26g&VER=8&d — net::ERR_ABORTED
- [2026-07-05T07:49:06.761Z] **request-failed** — [TA1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=eXxWspTO9XFNDNVrFb3Ybv8GYZPS4zTaB1kOMJrWQtt0IBX3rAbvag&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:49:06.805Z] **request-failed** — [TA1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=L0lh-wuaMugwt-EtCWICYT4q5yJc3ULN6-OiiR81E4tcG0RaIwm26g&VER=8&d — net::ERR_ABORTED
- [2026-07-05T07:49:06.813Z] **request-failed** — [TA1-S1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=eXxWspTO9XFNDNVrFb3Ybv8GYZPS4zTaB1kOMJrWQtt0IBX3rAbvag&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:49:11.190Z] **request-failed** — [TA1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tDz8pCN4MJ7XIWQCZC8m-ncfwSG7U0qBuwEMRlyH-bFzDGehtUlPWA&VER=8& — net::ERR_ABORTED
- [2026-07-05T07:49:11.370Z] **request-failed** — [TA1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tDz8pCN4MJ7XIWQCZC8m-ncfwSG7U0qBuwEMRlyH-bFzDGehtUlPWA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR CORE Vocab (audit clone)" to 25WT LSR-TCH-A (pace=80 thr=92 mode=typed) → ok
- [2026-07-05T07:49:21.312Z] **BUG** — [TA1] default focus list before="List: LSR TOP Vocab (audit clone)" after teacher list-add="List: LSR CORE Vocab (audit clone)" — FLIPPED (getPrimaryFocus §7-H3 / 박시은 repro)

---

### F02 — [CONFIRMED][known-bug §7-H3] Teacher adding a 2nd list silently flips a mid-progress student's default list
**Severity:** HIGH (product; recurring CS cause) · **Repro:** 박시은 CS-2026-06-24b / -06-28b, nice-to-haves #3b
**Scenario:** TA1 (teacher-concurrent, flag-off deploy). Student s17 has real progress on "LSR TOP Vocab" in
25WT LSR-TCH-A. **While the student is on the dashboard, the teacher assigns a SECOND list ("LSR CORE Vocab")
to the class.** On reload the student's default focus flips TOP → CORE (Day 1 of the new, unstudied list).
**Evidence (UI-observed):** focus control read "List: LSR TOP Vocab (audit clone)" → "List: LSR CORE Vocab
(audit clone)" after the teacher action. Underlying TOP progress persists (data intact) but is no longer the
default — the student lands on the new list mid-progress.
**Root cause:** `getPrimaryFocus` (Dashboard.jsx:1037) falls back to the most-recently-assigned list, ignoring
which list the student has progress on. De-scoped from Phase 1 (§7-H3) → tracked as nice-to-haves #3b; this is
UI-confirmed live evidence it still reproduces on any teacher list-add.
**Fix direction:** getPrimaryFocus fallback must prefer the list the student has active progress/session on.
