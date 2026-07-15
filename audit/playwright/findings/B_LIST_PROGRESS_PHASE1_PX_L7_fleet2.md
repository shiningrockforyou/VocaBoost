# Findings — B_LIST_PROGRESS_PHASE1 (PX_L7_fleet2)

**Run date:** 2026-07-12T20:52:27.454Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L7 S0 fleet2"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L7 S0 fleet2 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T20:53:29.173Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nWXpNumdMw_dOWhJab0rG2_TP6J0j_fYNyV93OkY-6crrz8-jZwfbQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L7 S0 fleet2 → 93WK3B
- [2026-07-12T20:53:38.478Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=J6Z23W6yewdqO5ZDDzF-KvUao8CnaxWEu7GG2Av-cPvzPABNjvy7Qw&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:53:38.480Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=J6Z23W6yewdqO5ZDDzF-KvUao8CnaxWEu7GG2Av-cPvzPABNjvy7Qw&VER=8& — net::ERR_ABORTED
  - STEP [L7-s0] join "25WT PX L7 S0 fleet2" via 93WK3B → member
- [2026-07-12T20:53:49.596Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=hiYCUmPfL28NVkwx1DwXQtIthpESw6tyTYi_HfLtCk1sTnBHBF2ToA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:53:49.599Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ti8IEdmUcugAO91AQWjRTeZTe3wnGbQrCVTfVO55ua4LzhHKIeEXjQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:25.134Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=aBYhSADeRy460gsEm2BUeuUzQXNxvvgr6S_YU2-WCiZjwuQm5cng_g&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:25.137Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=PDIWDo15S9QY0pIge3frJpOfbct1aywEgHf391jAGOSLZ-s8Umq8VQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:30.372Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=1qEC_HisDThBjLrR60Tyai9f1Uoon2HGuhX2Htqhup8deZwgyOYVNg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:30.378Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=dF1uKAPAm99PYnYeVwdau4P4ZtN5JlWcie_VKAY8UGf6wA-5d1gajw&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:06.925Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=8ffh74rup5MKrXttCpTU1_iG53QBONBlHQnpJRvFnWi7LGZrUy-1eg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:06.934Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=hBaTUyKxKNkNu9CCMoq2RcXXe3fSMBL0ffzAm2hCa745LeAl-5Qj9w&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:41.186Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=XPwDi-NHPIOWNrG3K59Uf6-Nd0cFFYJE2oUb0YtMCob4yADRijeRcQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:41.191Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=wwqA0nTCLTY2yz0laP0ct0gssaOSwR0DBPcwQVTsPXWqRNZSs4njkA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:46.480Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=00RC51NBeWh2jYXHKvIiCMolFgV9-ZbzLI3wryoTvDwgC_FE9evs8g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:46.489Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=002oYrzc0a4IvZC7p5G8Gb5N5KnKPj5otKxeP9VpLkN0K-s4CezBNg&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:56:22.842Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=LrIer_ZMKD0rt-Q7Iw7PTmJ9dAuElLeg1lzfPbmYp5UjL6JAbZOdqA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:56:22.850Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BMiGl849tRthN-XZs-8AFQTipQLZS2yUR5owPM5h59Z-WlgMeq3GCw&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:56:30.234Z] **selector-gap** — [ascent-d3-review] "Skip to Test" not in menu (queue empty?)
- [2026-07-12T20:56:30.252Z] **info** — [dbg ascent d3 review-not-reached] active Class="" List="" url=https://vocaboostone.netlify.app/session/NrkVPWVY6YMYeBsxWZHa/UGcKjowXSY7NvUuLuEU7 → FAIL_ascent_d3_review_not_reached_fleet2.png
- [2026-07-12T20:56:30.271Z] **exception** — Error: page.waitForTimeout: Target page, context or browser has been closed
