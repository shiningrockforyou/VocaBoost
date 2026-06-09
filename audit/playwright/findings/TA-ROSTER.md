# TA-ROSTER Audit Report

## STATUS BLOCK

| Field | Value |
|---|---|
| Agent | TA-ROSTER |
| Audit date | 2026-06-02 |
| Classes tested | GNktwcqI18vyAps3iJDf, LVjBTFuYE8FbPG34pVAt, OMMwcLz3FlOiKBYjBMla, k8tzOiiwotBbtJS3uTiv |
| Login OK | YES (ta@vocaboost.com / VocaTA2026!) |
| 26SM classes encountered | NONE (ta@ dashboard shows exactly 4 allowed classes) |
| Writes performed | NONE (read-only; name-edit opened then cancelled via Cancel button in all 4 classes) |
| Blockers | 1 finding (affects all 4 classes) |
| High | 0 |
| Medium | 2 findings |
| Nitpick | 1 finding |

---

## FINDINGS

### BLOCKER

#### F-01: `newWordsTestScore` stored as integer 0–100 but rendered as percent without dividing by 100, producing values like "9700%", "10000%"

- **Where:** All 4 classes / Students tab / "Current Session" column / "New: ✓ XXXX%" cell
- **Affected students (confirmed):**
  - **25WT 2차 TOP ONLINE** — Isabelle Yang: `Day 2 New: ✓ 9700%`
  - **25WT 2차 CORE OFFLINE** — ChiyoonSong: `Day 9 New: ✓ 9200%`
  - **25WT 2차 CORE ONLINE** — 이Lee李준혁Junhyeok峻赫: `Day 20 New: ✓ 9600%`; Siwoo Kim: `Day 10 New: ✓ 10000%`
  - **25WT 2차 TOP OFFLINE** — N/A (audit test student): `Day 3 New: ✓ 10000%`; N/A (audit test student Day 28): `New: ✓ 10000%`; jennifer jung: `Day 4 New: ✓ 9300%`
- **Total overflow instances across classes:** 7 (1 + 1 + 2 + 3)
- **Evidence:**
  - `/app/audit/playwright/findings/screenshots/TA-ROSTER/202_v3_overflow_GNktwcqI18vyAps3iJDf.png` (TOP ONLINE, 9700%)
  - `/app/audit/playwright/findings/screenshots/TA-ROSTER/206_v3_overflow_LVjBTFuYE8FbPG34pVAt.png` (CORE OFFLINE, 9200%)
  - `/app/audit/playwright/findings/screenshots/TA-ROSTER/210_v3_overflow_OMMwcLz3FlOiKBYjBMla.png` (CORE ONLINE, 9600% + 10000%)
  - `/app/audit/playwright/findings/screenshots/TA-ROSTER/303_deep_k8tzOiiwotBbtJS3uTiv.png` (TOP OFFLINE, 3 overflow values)
- **Repro steps:**
  1. Log in as ta@vocaboost.com
  2. Open any of the 4 class detail pages (e.g. `/classes/GNktwcqI18vyAps3iJDf`)
  3. Click the "Students" tab
  4. Find a student who completed a New-words test in their Current Session
  5. Read the "New:" value in the Current Session column
- **Expected:** All "New: ✓ XX%" values in Current Session column should be between 0% and 100% (e.g., "New: ✓ 97%")
- **Actual:** Many students show values between 9200% and 10000% (e.g., "New: ✓ 9700%", "New: ✓ 10000%"). The Previous Session column values (where present) appear correct (e.g., "New: 92%", "New: 97%", "New: 100%"). This confirms the bug is specific to the **Current Session** rendering path, not the Firestore-stored value — the score is likely stored as a float 0.0–1.0 or an integer 0–100, and the Current Session display path is multiplying by 100 a second time.
- **Clarification on Previous Session:** The "Previous Session" column data looks correct: scores like "90%", "97%", "100%" appear within valid range. The bug is isolated to Current Session.
- **Pattern note:** The rendering shows values like 9700 for a score that should be 97% — consistent with a score stored as `97` (integer) being multiplied by `100` before appending `%`, or a score stored as `0.97` being multiplied by `10000`.

---

### HIGH

No High severity findings.

---

### MEDIUM

#### F-02: Pending-challenge badge/count absent from all class pages (Issue #12 — dead/broken)

- **Where:** All 4 classes / Class detail page (class header AND Students tab)
- **Evidence:** `/app/audit/playwright/findings/screenshots/TA-ROSTER/201_v3_class_GNktwcqI18vyAps3iJDf.png` (TOP ONLINE, representative); similar for all 4 classes
- **Repro steps:**
  1. Log in as ta@vocaboost.com
  2. Open any class detail page
  3. Check class header area and Students tab for a pending-challenge count, badge, or indicator
- **Expected:** A visible pending-challenge count or badge (e.g., "2 pending challenges") near the class header or in the Students roster, reflecting students whose challenge submissions are awaiting teacher review
- **Actual:** Zero challenge-related DOM elements found on any of the 4 class pages (Students tab or class header). There is no visible badge, count, label, or link related to "pending challenges" anywhere in the visible DOM. This is consistent with Issue #12 being a dead/unimplemented feature.

#### F-03: Horizontal overflow at mobile viewport (375px) — navigation bar does not wrap

- **Where:** 25WT 2차 TOP ONLINE (representative) / Students tab / viewport 375px wide
- **Evidence:** `/app/audit/playwright/findings/screenshots/TA-ROSTER/218_v3_resp_mobile_GNktwcqI18vyAps3iJDf.png`, `/app/audit/playwright/findings/screenshots/TA-ROSTER/305_mobile_overflow_detail.png`
- **Repro steps:**
  1. Open any class `/classes/<id>` on a 375px-wide mobile viewport
  2. Navigate to Students tab
  3. Observe horizontal scrollbar
- **Expected:** Page fits within 375px with no horizontal overflow; navigation items collapse into a hamburger menu or wrap
- **Actual:** `bodyScrollWidth = 746px` vs `clientWidth = 375px` — overflow of 371px. Root cause is the top navigation bar: a `div.flex.items-center.gap-3` containing four nav links (Dashboard, Classes, Gradebook, Lists) does not collapse at mobile widths. The "Gradebook" link extends to x=508 and "Lists" extends beyond x=625, both well past the 375px viewport edge. The Students roster table itself fits within the viewport; the overflow is entirely caused by the horizontal nav.
- **Note:** No overflow at 1440px (desktop) or 768px (tablet).

---

### NITPICK

#### N-01: Raw Tailwind shadow and rounded classes used instead of design tokens

- **Where:** 25WT 2차 TOP ONLINE / Students tab (representative; applies across all class pages)
- **Evidence:** `/app/audit/playwright/findings/screenshots/TA-ROSTER/216_v3_resp_desktop_GNktwcqI18vyAps3iJDf.png`
- **Repro steps:**
  1. Open `/classes/GNktwcqI18vyAps3iJDf`, Students tab
  2. Inspect element classes in DevTools
- **Expected:** All shadow and rounded utilities use project design tokens (`shadow-theme-sm`, `shadow-theme-md`, `shadow-theme-lg`, `rounded-[--radius-card]`, etc.) per CLAUDE.md
- **Actual:** 15 elements detected using raw Tailwind values: `shadow-md` (12 elements), `shadow-lg` (2 elements), `rounded-lg` (1 element). Per CLAUDE.md: "DO NOT use raw values like `rounded-lg`". These should be migrated to `shadow-theme-md`/`shadow-theme-lg`/`rounded-[--radius-card]`.

---

## OBSERVATIONS (No Finding)

### Name-edit UI — PASS
All 4 classes: the inline name editor works correctly. The edit button (`aria-label="Edit name"`) is present on every student row (opacity-0, revealed on hover). Force-clicking it opens the inline text input with a Cancel button. Clicking Cancel closes the editor cleanly with no state saved. No bugs observed.

### Roster data sanity — PASS (except F-01)
- **Day labels:** Present and sequential (Day 1–28 range observed). No anomalous Day values.
- **"Not Started" state:** Working correctly — students who have not begun a session show "Not Started" in the Current Session cell.
- **"No History" state:** Working correctly — students with no prior completed session show "No History" in the Previous Session cell.
- **Review scores:** Where present, review scores in both columns show values in 0–100% range (e.g., "Review: 97%", "Review: 95%"). The overflow bug is isolated to the Current Session "New:" score only.
- **Progress bar:** No explicit `<progress>` elements or `role="progressbar"` found; progress appears as text (320/3381). No progress bar CSS overflow issues.
- **Scope check — 26SM classes:** Dashboard showed exactly 4 class links (the 4 allowed 25WT 2차 classes). No 26SM classes were visible to ta@.
- **Console errors:** No significant JavaScript errors captured on any class page (only expected network pre-flight noise).

### Responsive at 768px (tablet) — PASS
No horizontal overflow. Layout intact.

### Responsive at 1440px (desktop) — PASS
No horizontal overflow. Layout intact.

---

## Screenshots Index

| # | File | Description |
|---|---|---|
| 200 | `200_v3_dashboard.png` | Teacher dashboard — 4 class cards visible, no 26SM |
| 201 | `201_v3_class_GNktwcqI18vyAps3iJDf.png` | TOP ONLINE Students tab overview |
| 202 | `202_v3_overflow_GNktwcqI18vyAps3iJDf.png` | TOP ONLINE — 9700% score visible |
| 203 | `203_v3_name_edit_OPEN_GNktwcqI18vyAps3iJDf.png` | TOP ONLINE — name edit input open |
| 204 | `204_v3_name_edit_CLOSED_GNktwcqI18vyAps3iJDf.png` | TOP ONLINE — name edit cancelled |
| 205 | `205_v3_class_LVjBTFuYE8FbPG34pVAt.png` | CORE OFFLINE Students tab overview |
| 206 | `206_v3_overflow_LVjBTFuYE8FbPG34pVAt.png` | CORE OFFLINE — 9200% score visible |
| 207 | `207_v3_name_edit_OPEN_LVjBTFuYE8FbPG34pVAt.png` | CORE OFFLINE — name edit open |
| 208 | `208_v3_name_edit_CLOSED_LVjBTFuYE8FbPG34pVAt.png` | CORE OFFLINE — name edit cancelled |
| 209 | `209_v3_class_OMMwcLz3FlOiKBYjBMla.png` | CORE ONLINE Students tab overview |
| 210 | `210_v3_overflow_OMMwcLz3FlOiKBYjBMla.png` | CORE ONLINE — 9600% + 10000% visible |
| 211 | `211_v3_name_edit_OPEN_OMMwcLz3FlOiKBYjBMla.png` | CORE ONLINE — name edit open |
| 212 | `212_v3_name_edit_CLOSED_OMMwcLz3FlOiKBYjBMla.png` | CORE ONLINE — name edit cancelled |
| 213 | `213_v3_class_k8tzOiiwotBbtJS3uTiv.png` | TOP OFFLINE Students tab overview |
| 214 | `214_v3_name_edit_OPEN_k8tzOiiwotBbtJS3uTiv.png` | TOP OFFLINE — name edit open |
| 215 | `215_v3_name_edit_CLOSED_k8tzOiiwotBbtJS3uTiv.png` | TOP OFFLINE — name edit cancelled |
| 216 | `216_v3_resp_desktop_GNktwcqI18vyAps3iJDf.png` | Responsive desktop 1440px — no overflow |
| 217 | `217_v3_resp_tablet_GNktwcqI18vyAps3iJDf.png` | Responsive tablet 768px — no overflow |
| 218 | `218_v3_resp_mobile_GNktwcqI18vyAps3iJDf.png` | Responsive mobile 375px — nav overflow |
| 300 | `300_deep_GNktwcqI18vyAps3iJDf.png` | TOP ONLINE deep scan |
| 301 | `301_deep_LVjBTFuYE8FbPG34pVAt.png` | CORE OFFLINE deep scan |
| 302 | `302_deep_OMMwcLz3FlOiKBYjBMla.png` | CORE ONLINE deep scan |
| 303 | `303_deep_k8tzOiiwotBbtJS3uTiv.png` | TOP OFFLINE deep scan — 3 overflow scores |
| 304 | `304_deep_TOP_OFFLINE_wait.png` | TOP OFFLINE recheck (extra wait) |
| 305 | `305_mobile_overflow_detail.png` | Mobile overflow — nav bar extends to 746px |
