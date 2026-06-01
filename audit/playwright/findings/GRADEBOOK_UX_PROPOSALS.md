# Gradebook UX/UX Improvement Proposals (2026-06-01)

Grounded in the ACTUAL Gradebook.jsx (1547 lines). What exists today, then concrete additions ranked by convenience-per-effort.

## What the gradebook already has (so we don't re-propose it)
- Columns: Class, List, Date, Name, Score, Type, Session, Day, View — all sortable (click header).
- Tag-based filters: Class, Name, Date (Today/Yesterday/Past 7/30/Custom calendar), Test Type. Locked-class via URL.
- Select-all + per-row checkboxes; Excel (.xlsx) export of selected.
- "View Details" drawer: per-question student answer vs correct answer + AI reasoning; challenge review (Accept/Reject) with token display.
- Pagination (Load more / prev), "Showing N results", empty state, loading.

## TIER 1 — High convenience, low effort (recommend first)
1. **At-a-glance status pills on each row.** Today a teacher must open the drawer to know if an attempt has a pending challenge, passed/failed, or is a retake. Add small colored pills in the row: `Pending Challenge` (already a flag in data — surface it as a row badge, not just in drawer), `Pass/Fail` vs threshold, `Retake`. (Note: the "Pending Challenge" badge in list view is currently broken — list query returns answers:[] — so this also fixes review-#12. Two-for-one.)
2. **Challenge inbox / "Needs Review" quick filter.** TAs' #1 job is responding to challenges. Add a one-click filter (or a count badge in the header: "3 challenges pending") that shows only attempts with pending challenges, newest first. Right now they must scan/filter manually. Highest TA-convenience win.
3. **Class/list summary header.** Above the table, show quick stats for the current filter: # students, average score, % passed, # pending challenges. Teachers currently compute this mentally. Cheap (aggregate the loaded rows).
4. **Persist filters in the URL / localStorage.** Filters reset on navigation. Encoding active tags in the query string (the code already reads `classId`/`studentName` from URL — extend it) lets teachers bookmark "Class X, last 7 days" and share links.
5. **Sticky table header + sticky filter bar** on scroll, so column headers/sort stay visible in long lists. Pure CSS.

## TIER 2 — Strong value, moderate effort
6. **Per-student progress view (not just per-attempt).** Today the gradebook is a flat attempt log. Add a "by student" toggle that rolls up each student's current study day, % mastered, last-active date, pass-rate, and pending challenges — the thing TAs check most ("how is this student doing?"). Drill into their attempts from there.
7. **Inline challenge actions from the row.** Let a teacher Accept/Reject a pending challenge directly from a row's expanded preview without opening the full drawer — fewer clicks across many challenges. Pairs with #2.
8. **Bulk challenge handling.** When several challenges are the same word/same mistake, allow select-multiple → Accept/Reject together. (Careful: each changes a score — confirm dialog.)
9. **Score distribution / quick chart.** A small histogram or pass/fail donut for the current filter so a teacher sees class performance instantly. analytics-lite.
10. **CSV/Excel export of the FULL filtered set, not just selected**, with a "export all results" button (current export is selection-based; for a whole class that's tedious). Also fix CSV formula-injection (review #19) while touching export.

## TIER 3 — Nice to have
11. **"Last viewed / unreviewed" indicator** so a TA returning to the gradebook knows which attempts are new since last visit.
12. **Keyboard navigation** in the details drawer (←/→ to move between questions, A/R to accept/reject a challenge) for fast challenge triage.
13. **Search-as-you-type student filter** (current Name filter is tag-based add; a live search box is faster for big rosters).
14. **Mobile gradebook layout** — the table is desktop-oriented; a card/stacked view for teachers checking on a phone. (Ties to the mobile issues found in Day-1.)
15. **Color-code score cells** (green/amber/red vs threshold) for instant scanning.

## Cross-cutting fixes to bundle with any gradebook work (already-verified bugs)
- **Pagination count correctness (#13/#27):** filters applied post-`limit()`, so "Showing N" and hasMore are wrong under active filters. Fix when touching the table.
- **Pending-challenge badge dead (#12):** list query strips `answers` → badge never shows. Fix enables Tier-1 #1/#2.
- **Prev-page resets to page 1 (#39):** make Back go back one page.
- **CSV injection (#19):** escape `=/+/-/@`-leading fields on export.

## Suggested sequence
TA-impact order: **#2 challenge inbox + #1 status pills + #12 badge fix** (one coherent "challenge triage" improvement) → **#6 per-student view** → **#3 summary header** → **#4 filter persistence** → the rest. These map directly to the three things TAs do most (check progress, respond to challenges, help students).
