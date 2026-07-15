# Findings — B_LIST_PROGRESS_PHASE1 (PX_L3_fleet2)

**Run date:** 2026-07-12T20:52:25.372Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L3 S0 fleet2"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L3 S0 fleet2 (pace=100 thr=92 mode=typed) → ok
- [2026-07-12T20:53:26.918Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=PdmJfeP4EuL3YAo880Fcb0DhSa95FmBBcofxeqIV6EGxhD87LfPeOg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L3 S0 fleet2 → RY4WUS
- [2026-07-12T20:53:35.927Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=1XsgXH3tki1uQ8CO5uMvgHS7o0Vg-Kxn3u3ox06ljMRpeT6JgU7z7w&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:53:36.057Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=1XsgXH3tki1uQ8CO5uMvgHS7o0Vg-Kxn3u3ox06ljMRpeT6JgU7z7w&VER=8& — net::ERR_ABORTED
  - STEP [L3-s0] join "25WT PX L3 S0 fleet2" via RY4WUS → member
- [2026-07-12T20:53:46.793Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=TYj6GsDHW4Guph8HFeq_PWuuxrgGom3OpKDtnUa9ijFpqcRVDZBy5w&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:53:46.802Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Z_wLQIjsFdD8gn3J0ZTDxsDODo94hjDKPErA7q2auIwOHEhTXyARPA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:22.573Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=WeKHaCB3usZDStwCFl5MWddsYuGFi85FlmQMzu744ZzLkbWH0gV6xA&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:22.576Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=4ntLIyjc6lod_EL0_CDKc28QAFuXlBDb3Iom917chKbBKtgNdfE2qQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:54:27.815Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Q0GGb310NtdsMOyyLMs3QYJG025xJoIhl05tskl4NI6UDCo1iW4G9g&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:54:27.820Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=7txbpJzPG0tbSRRA-4f2gSUpb7w3dVNDgqB-c-iGShgZHytMBS4Abw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:04.671Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KiT-GhvjHlhzsMxjBEiIyjl56PbHmj7U6qoqMSpjaXUPiAg9AQLtDQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:04.677Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=TFot4lar9vVgs-jdG_CcVm8wUtaq5vHLE3WfMHoO13oHHwi_S9hz3Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:39.120Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=U8W4mky86JKrTl4rrde0PTy1o5BogUunw19CAV7rTyPi6wdl1pKddg&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:55:39.127Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=kLp73nkcK-Boa5nM2wz8nllIN5JcpEGnyVbyIn0u4iVjhrB2SXhfIQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:44.425Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=6Y8Gj3YOUoPVfDncJyk6bbYFMI0AodNYc3ofZe3J91W2u23HW1NLgQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:55:44.434Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=hds4zwr9KpVK0OhIVVTmGAyqh3ieA56qSsmOHL-w3iiPM7x8fNdiPA&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:56:21.201Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=OJh5BKw62ofy8kNIRe_kW6XbuloNFW6MPzc9ZsLGJAkxOeNu5Ro6sw&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:56:21.208Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=fBkGSeV-PCp6fVPpkepTpxeplCZ58Kzp5WAd9r51sESF35xWXcmXmA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:56:30.935Z] **info** — [dbg ascent d3 review-not-reached] active Class="" List="" url=https://vocaboostone.netlify.app/typedtest/NW4kEETNcLGywf1Yc8fB/A6ZZqhd2BoetgDesJ8yp → FAIL_ascent_d3_review_not_reached_fleet2.png
- [2026-07-12T20:56:30.938Z] **exception** — Error: page.waitForTimeout: Target page, context or browser has been closed
