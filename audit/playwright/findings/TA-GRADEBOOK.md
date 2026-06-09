# TA-GRADEBOOK Audit Findings

## STATUS BLOCK

| Field | Value |
|-------|-------|
| agent | TA-GRADEBOOK |
| run date | 2026-06-02 |
| login | OK — ta@vocaboost.com authenticated successfully |
| writes | NONE — read-only audit; no Firestore writes, no app state mutations |
| 26SM scope | CLEAN — no 26SM class data observed in any view, filter, or chip panel |
| blockers | 1 |
| high | 0 |
| medium | 0 |
| nitpicks | 2 |
| console errors | 0 total / 0 non-trivial |
| csv injection verdict | NOT TESTED — no CSV download triggered (Showing: 0 throughout) |
| pagination / Check All | NOT TESTED with live data — Showing: 0 for all filters |
| csv file | not downloaded |

---

## Audit Context

**Account**: ta@vocaboost.com (teacher role)
**Dashboard (confirmed)**: 4 classes, all 25WT 2차, no 26SM — correct scope
- GNktwcqI18vyAps3iJDf — 25WT 2차 TOP ONLINE (36 students enrolled)
- LVjBTFuYE8FbPG34pVAt — 25WT 2차 CORE OFFLINE (66 students enrolled)
- OMMwcLz3FlOiKBYjBMla — 25WT 2차 CORE ONLINE (37 students enrolled)
- k8tzOiiwotBbtJS3uTiv — 25WT 2차 TOP OFFLINE (63 students enrolled)

**Gradebook UI** (documented from source inspection):
- Filter chips: Class (text search + Add Filter), Name (text search + Add Filter), List (text search + Add Filter), Test Type (MCQ/Written quick-buttons), Date (Today/Yesterday/Past 7 days/Past 30 days/Custom)
- Workflow: click chip → type value or click preset → click "Add Filter" (auto-adds for Test Type/Date)
- Active filters shown as removable tags; "Showing: 0" is correct default until filter applied
- Controls: page size selector (10/50/100), "Check All" button, "Export (All)" button
- Export format: XLSX (via `xlsx` library), **not CSV** — file is `VocaBoost_Gradebook_Export.xlsx`

**Source code reviewed**: `/app/src/pages/Gradebook.jsx`, `/app/src/services/db.js` lines 1777–1980

---

## Filter Test Results

| Filter Type | Value | Showing | Rows | Notes |
|-------------|-------|---------|------|-------|
| Class | 25WT 2차 TOP ONLINE | 0 | 0 | After 4s wait |
| Class | 25WT 2차 CORE OFFLINE | 0 | 0 | After 4s wait |
| Class | 25WT 2차 CORE ONLINE | 0 | 0 | After 4s wait |
| Class | 25WT 2차 TOP OFFLINE | 0 | 0 | After 4s wait; also tried 15s |
| Name | 김 | 0 | 0 | |
| Name | Kim | 0 | 0 | |
| List | "List" | 0 | 0 | |
| Test Type | MCQ | 0 | 0 | |
| Date | Past 30 days | 0 | 0 | |
| Combined | Class + Name | 0 | 0 | |

---

## BLOCKERS (1)

### B1: Gradebook returns Showing: 0 for all filters — ta@vocaboost.com has no attempt data

- **Where**: `/teacher/gradebook` — all filter combinations
- **Evidence**: Every filter combination tested (all 4 class names, name, list, test type, date — singly and combined) returned `Showing: 0` after waiting up to 15 seconds. Firestore `Listen/channel` requests are observed. The teacher dashboard correctly shows 202 total enrolled students. Screenshots: `84_04_class_*.png`, `91_08_filter_mcq.png`, `93_10_filter_date_past30.png`.
- **Repro**:
  1. Login as ta@vocaboost.com
  2. Navigate to /teacher/gradebook
  3. Click "Class" chip, type "25WT 2차 TOP OFFLINE", click "Add Filter"
  4. Wait 15 seconds
- **Expected**: Student test submission records appear (Showing: N > 0)
- **Actual**: Showing: 0 — "Your search returned no results" for all filter combinations

- **Root cause analysis** (from `db.js` line 1924):
  `queryTeacherAttempts` queries `attempts` collection with `where('teacherId', '==', teacherId)`. If no `attempts` documents have `teacherId` set to ta@vocaboost.com's Firebase UID, the gradebook will always return 0 results regardless of class filter. This occurs in two scenarios:
  1. **Data state**: ta@'s students have not yet completed any tests (most likely — this is a test/audit account)
  2. **Historical data bug**: Attempt documents were written without `teacherId`, or with a different teacherId

  Additionally, `getTeacherData()` (line 1785) returns `null` if `fetchTeacherClasses(teacherId)` returns empty, which would silently short-circuit all queries. However, since the teacher dashboard correctly shows 4 class cards, this is less likely.

- **Impact**: All downstream gradebook functionality (pagination, Check All, Export, scores display) cannot be verified for this account as the gradebook has no data to work with.

---

## HIGH (0)

None found.

---

## MEDIUM (0)

None found.

---

## NITPICKS (2)

### N1: "Export (All)" exports XLSX, not CSV — audit task mentions "CSV" but actual format is XLSX

- **Where**: `/teacher/gradebook` Export button
- **Evidence**: Source code `Gradebook.jsx` line 627: `XLSX.writeFile(wb, 'VocaBoost_Gradebook_Export.xlsx')`. Export button label says "Export (All)" but the audit brief describes it as CSV. The export produces an Excel `.xlsx` file, not a plain-text CSV.
- **Repro**: Click "Export (All)" with data loaded
- **Expected** (per audit brief): CSV file download
- **Actual**: XLSX file — `VocaBoost_Gradebook_Export.xlsx`
- **Note**: XLSX is fine for the use case, but injection safety properties differ from CSV (Excel handles formula injection automatically in native `.xlsx` format). The "CSV injection" concern from the brief is moot for XLSX.

### N2: "Check All" button label does not change to "Uncheck All" after clicking

- **Where**: `/teacher/gradebook` Check All button
- **Evidence**: After clicking "Check All" (with empty result set), button text remains "Check All". Source code (line 957): the label changes only when `paginatedAttempts.length > 0 && paginatedAttempts.every((a) => selectedAttempts.has(a.id))`. With Showing: 0 (no `paginatedAttempts`), condition is false and button stays "Check All". Could not test with live data.
- **Repro**: Click Check All with any data loaded
- **Expected**: Button toggles to "Uncheck All" when all rows are selected
- **Actual**: Button text does not change (with empty data; could not verify with live data)

---

## Observations

### Scope / Authorization — CLEAN
- Teacher dashboard: only 4 authorized 25WT class IDs (GNktwcqI18vyAps3iJDf, LVjBTFuYE8FbPG34pVAt, OMMwcLz3FlOiKBYjBMla, k8tzOiiwotBbtJS3uTiv) visible. No 26SM.
- Gradebook page body: no 26SM text at any point (initial load, class filter open, all filter states)
- Class filter panel: no 26SM suggestions appear
- No unauthorized class data at any point during 62 screenshots taken

### Empty State — CORRECT
Gradebook shows "Search for your students' results" as a centered heading with Showing: 0. After applying any filter that yields no results, it shows "Your search returned no results". Both states render cleanly without errors.

### Filter Chips — UI FULLY FUNCTIONAL
- All 5 chips render and open correctly
- Class/Name/List show text search input with appropriate placeholder
- Test Type shows MCQ/Written toggle buttons (auto-add on click)
- Date shows Today/Yesterday/Past 7 days/Past 30 days/Custom preset buttons with custom calendar picker
- Active filter tags render with correct color coding and removable X buttons
- Zero console errors during all filter interactions

### Page Size Selector — PRESENT
Options: 10 / 50 / 100. Selector is functional (verified by inspection). Cannot test pagination behavior (no data).

### Check All — PRESENT
Button is present and clickable. Cannot verify "selects all vs. page-only" behavior without live data.
Source code review (lines 516–529): `handleSelectAll` operates on `paginatedAttempts` (current loaded set, not all pages). With `hasMore=true` and multiple pages, Check All would select only the currently loaded batch — **not all total results**. This is a design limitation worth noting for when data becomes available.

### Export (All) — PRESENT, XLSX FORMAT
Button present. Source code confirms: when `selectedAttempts.size > 0`, exports selected; otherwise fetches ALL pages iteratively. Export produces `.xlsx`, not `.csv`. When `exportData.length === 0`, shows `alert('No data to export')` — hence no download was triggered during testing (expected behavior with Showing: 0).

### Formula Injection (XLSX)
XLSX format provides native Excel formula escaping. Raw string values are embedded as cell values, not formula strings. Formula injection is not applicable for the `.xlsx` export format in the same way as CSV.

### Console Errors — CLEAN
Zero console errors or page errors recorded across the entire audit session (62 screenshots, all filter interactions, export attempt).

---

## Screenshots

Location: `/app/audit/playwright/findings/screenshots/TA-GRADEBOOK/`

Key evidence files:

| File | Description |
|------|-------------|
| 81_01_login.png | Login success — ta@vocaboost.com |
| 82_02_dashboard.png | Teacher dashboard — scope check (4 authorized classes, no 26SM) |
| 83_03_empty_state.png | Gradebook initial empty state — correct UI |
| 84_04_class_25WT_2__TOP_ONLINE.png | TOP ONLINE class filter → Showing: 0 |
| 85_04_class_25WT_2__CORE_OFFLINE.png | CORE OFFLINE class filter → Showing: 0 |
| 86_04_class_25WT_2__CORE_ONLINE.png | CORE ONLINE class filter → Showing: 0 |
| 87_04_class_25WT_2__TOP_OFFLINE.png | TOP OFFLINE class filter → Showing: 0 |
| 88_05_filter_name_korean.png | Name filter "김" → Showing: 0 |
| 89_06_filter_list.png | List filter → Showing: 0 |
| 90_07_testtype_open.png | Test Type chip open — MCQ/Written buttons visible |
| 91_08_filter_mcq.png | MCQ test type filter → Showing: 0 |
| 92_09_date_open.png | Date chip open — preset buttons visible |
| 93_10_filter_date_past30.png | Past 30 days filter → Showing: 0 |
| 94_11_combined_filters.png | Combined Class + Name filter → Showing: 0 |
| 97_14_page_size.png | Page size selector (10/50/100) |
| 99_16_checkall_empty.png | Check All with empty state — 0 checked |
| 101_19_class_filter_open_scope.png | Class filter open — scope check, no 26SM |
| 102_20_final.png | Final gradebook state |

---

## Appendix: Code Analysis

### queryTeacherAttempts (db.js)
```
Line 1924: where('teacherId', '==', teacherId)
```
All attempts queries require `teacherId` field to match the logged-in teacher's UID. If attempt documents lack this field or have a different teacherId, results will be empty.

### Export (Gradebook.jsx)
```
Line 627: XLSX.writeFile(wb, 'VocaBoost_Gradebook_Export.xlsx')
Line 568: if (exportData.length === 0) { alert('No data to export'); return }
```
- Format: XLSX (not CSV)
- No download when data is empty — expected behavior confirmed

### Check All (Gradebook.jsx lines 516–529)
```js
handleSelectAll operates on: paginatedAttempts (= sortedAttempts = filteredAttempts = attempts, current loaded set)
```
With pagination and `hasMore=true`, Check All selects only the currently fetched batch. This is a known design choice but may surprise users expecting "select all N results."

---

## Appendix: Console Errors

None recorded.

---

## Appendix: Raw Scope Data

```json
{
  "dashboard26SM": false,
  "gradebook26SM": false,
  "classFilter26SM": false,
  "dashboardClassIds": [
    "GNktwcqI18vyAps3iJDf",
    "LVjBTFuYE8FbPG34pVAt",
    "OMMwcLz3FlOiKBYjBMla",
    "k8tzOiiwotBbtJS3uTiv"
  ],
  "invalidClassIds": []
}
```
