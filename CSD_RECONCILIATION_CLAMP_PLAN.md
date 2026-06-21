# CSD Forward-Corruption — Implementation Plan (v5, scoped to LOG-AND-MONITOR)

**Status:** Decisions LOCKED. Scope = observability only (no clamp, no display changes). Implementation-ready. Nothing implemented. Nothing committed.
**Author:** Claude (orchestrator) · **Date:** 2026-06-21
**History:** v1–v4 explored a calendar/TWI clamp + display read-reconciliation; the audit (3 agents + Codex ×3) showed the persisting clamp is unsafe except on a clean no-anchor case, and the display fix is high-surface/low-value for a self-healing issue. **Owner chose the minimal observability slice.** v5 supersedes all prior versions — implement from this doc ONLY.

---

## 1. Problem (verified, brief)
`currentStudyDay` (CSD) is forward-corruptible only by an **external bad write** (admin error / forged attempt) — normal advancement is strictly `+1` with a day-match guard (`updateClassProgress:331-334`). When it happens:
- The **session** path `getOrCreateClassProgress` (`progressService.js:91`) reconciles CSD against the anchor (most-recent *passed* new-word test) and **self-heals + persists** (`:217`) — *but only when a valid anchor exists*. Verified: `lazy` (stored 99, anchor day 23) → session Day 24.
- With **no valid anchor**, `safeCSD = Math.max(storedCSD, csd)` (`:184`) preserves the corrupt value (no upper bound).
- The **dashboard/teacher** views read stored CSD raw (`getClassProgress:381`), so a corrupt value shows until the next session reconciles.

**Severity is low / self-healing.** We are NOT auto-correcting (the audit showed any persisting clamp risks corrupting legitimate fast/high-intervention students on transient/legacy data). **We add observability only**, so we learn if this ever actually occurs in production and can intervene manually (the established admin-script pattern).

---

## 2. Scope — LOCKED
**IN:**
- Discriminated anchor classification: `found | none | invalid-anchor | query-error`.
- In `getOrCreateClassProgress`, **log only** (no behavior change to CSD/TWI):
  - `csd_implausible` — only when **all** of: status is a clean `none`, **and** stored CSD exceeds a conservative threshold, **and** settings were available to compute that threshold.
  - `csd_anchor_invalid` — status `invalid-anchor`.
  - `csd_anchor_query_error` — status `query-error`.

**OUT (explicitly):**
- ❌ No persistent clamp / no change to `safeCSD`/`safeTWI` (`:184-185` behavior unchanged).
- ❌ No Dashboard/ClassDetail read-reconciliation (the §7-vs-§11 contradiction Codex flagged is removed by dropping display work entirely).
- ❌ No `noAnchorStudyDayCeiling` as a *clamp*; a threshold function exists **only** to decide the `csd_implausible` log.

---

## 3. The discriminated anchor result (core change)
Today `getMostRecentPassedNewTest` (`db.js:3145`) returns `null` for three different conditions — `snapshot.empty` (`:3168`), the `catch` path (`:3182`), and (via the caller's later check) a found-but-malformed anchor. v5 separates them.

**3a. `db.js` — `getMostRecentPassedNewTest` returns a discriminated result:**
```
{ status: 'found', attempt }   // snapshot non-empty
{ status: 'none' }             // query OK, snapshot empty
{ status: 'query-error', error }  // catch path
```
(It does NOT judge `newWordEndIndex` validity — that's the caller's domain.)

**3b. `progressService.js` — `getOrCreateClassProgress` derives the final 4-way status:**
```
result = getMostRecentPassedNewTest(...)
status =
  result.status === 'query-error'                         -> 'query-error'
  result.status === 'none'                                -> 'none'
  result.status === 'found' && validAnchor(result.attempt)-> 'found'
  result.status === 'found' && !validAnchor               -> 'invalid-anchor'
```
where `validAnchor` = `Number.isInteger(studyDay) && studyDay>0 && Number.isInteger(newWordEndIndex) && newWordEndIndex>=0` (the existing `:171-173` `hasValidData` predicate).

**CSD/TWI reconciliation is UNCHANGED:** `found` → bidirectional `csd`; everything else → `Math.max(storedCSD, csd)` exactly as today (`:184-185`). We only *observe*.

---

## 4. Logging rules (in `getOrCreateClassProgress`, after status is known)
| status | Log | Gated by |
|---|---|---|
| `found` | none | — |
| `none` | `csd_implausible` | `storedCSD > threshold` AND threshold computable (see §5). Cheap pre-filter: only evaluate when `storedCSD > IMPLAUSIBLE_MIN` (e.g. 3) so the common case does zero extra work. |
| `invalid-anchor` | `csd_anchor_invalid` | always (payload: `storedCSD`, `anchorStudyDay`, `reason`) |
| `query-error` | `csd_anchor_query_error` | always (payload: `storedCSD`, `error`) |

All via the existing `logSystemEvent` (`db.js`), payload `{ userId, classId, listId, storedCSD, storedTWI, status, ... }`. **No writes to `class_progress` beyond the existing reconciliation.**

---

## 5. Conservative threshold (logging-only)
For a clean `none`, a legitimate student has CSD ≈ 0 (no passed test ⇒ no completed day). The threshold only needs to avoid noisy alerts.
```
// studyTypes.js (leaf, beside calculateExpectedStudyDay)
implausibleStudyDayThreshold({ programStartDate, studyDaysPerWeek, totalWordsIntroduced, dailyPace, slack = 7 }) -> number | null
  calendarCeil = programStartDate ? calculateExpectedStudyDay(programStartDate, studyDaysPerWeek) : null
  twiCeil      = (dailyPace > 0)  ? Math.ceil(totalWordsIntroduced / dailyPace) : null
  if (calendarCeil == null && twiCeil == null) return null   // not computable -> caller skips csd_implausible
  return Math.max(calendarCeil ?? 0, twiCeil ?? 0) + slack    // looser-of-either + slack
```
- `dailyPace = assignment.pace` (already DAILY — `db.js:2780`; `DailySessionFlow.jsx:555` multiplies by dpw for *weekly*, so do NOT pass weeklyPace).
- Returns `null` when not computable → **caller skips `csd_implausible`** (do not guess). This is the settings-fetch-failure rule.

**Settings source (minimal overhead):** only in the suspicious path (`status==='none' && storedCSD > IMPLAUSIBLE_MIN`) fetch `class.assignments[listId]` for `studyDaysPerWeek`/`dailyPace`; `programStartDate` is already on the progress doc. If the fetch fails or settings are invalid → `threshold = null` → skip `csd_implausible` (optionally a lighter `csd_implausible_no_threshold` log). The common path (found, or none with low CSD) does NO extra fetch.

---

## 6. Blast radius (final, small)
| Site | Change |
|---|---|
| `db.js:3145` `getMostRecentPassedNewTest` | return discriminated `{status, attempt?}` instead of `attempt\|null` |
| `progressService.js:118-228` `getOrCreateClassProgress` | map discriminated result → 4-way status; add gated `logSystemEvent` calls; **no CSD/TWI behavior change**; suspicious-path settings fetch for threshold |
| `studyTypes.js` | add `implausibleStudyDayThreshold` (logging-only) |
| **Everything else** | **unchanged** — no Dashboard, no ClassDetail, no clamp, no display reconciliation |

**Caller check:** `getMostRecentPassedNewTest` has one caller (`getOrCreateClassProgress:126`). Changing its return shape requires updating only that site. (Grep-confirm before editing.)

---

## 7. Edge cases
- `none` + legit early student (CSD 0/1) → below `IMPLAUSIBLE_MIN` → no log, no fetch.
- `none` + no `programStartDate` + no usable pace → threshold `null` → skip `csd_implausible` (don't guess).
- `invalid-anchor` (legacy attempt missing `newWordEndIndex`) → logged, NOT treated as corruption (student has progressed).
- `query-error` (transient/index) → logged, stored value preserved (current behavior).
- `found` fast/high-intervention students → no log, behavior unchanged.

---

## 8. Validation (sandbox `ta@`/25WT, snapshot+restore)
1. esbuild-validate `db.js`, `progressService.js`, `studyTypes.js`.
2. **`none` + corrupt CSD** (delete passed-new attempts, set CSD=99) → open session → `csd_implausible` logged; **CSD reconciliation unchanged** (still `Math.max`, value not auto-corrected).
3. **`found` + corrupt CSD** (`lazy`-style) → reconciles to anchor day as today; **no** `csd_implausible`.
4. **`found` legit fast student** → no log, untouched.
5. **`invalid-anchor`** (remove `newWordEndIndex` from the anchor) → `csd_anchor_invalid` logged; reconciliation unchanged.
6. **`query-error`** (hard to force live; unit-reason it / confirm the catch path emits `csd_anchor_query_error`).
7. **No `programStartDate` + no pace** → no `csd_implausible` (threshold null).
8. Confirm zero behavior change to CSD/TWI/displays for all cases. Snapshot + restore personas.

## 9. Out of scope / noted
- Auto-correction of CSD (any persisting clamp) — deliberately excluded (audit: unsafe except clean `none`, low value).
- Dashboard/ClassDetail display reconciliation — excluded.
- `ClassDetail.jsx:55` reads `session_states.currentStudyDay`, not `class_progress` — unrelated.
- `returnMasteredWords` already inside `initializeDailySession:163` (prior engine change); `DailySessionFlow:548` redundant — unrelated cleanup.
- `db.js:2785` (challenge-accept) — 4th bounded `+1` CSD writer — unrelated.
- TWI `Math.max` (`:185`) unbounded too — same observability could extend later; not now.

---

## Appendix — verified references
`progressService.js`: `:91` getOrCreate · `:126` getMostRecentPassedNewTest call (only caller) · `:130-148` anchor→csd · `:171-173` validAnchor predicate · `:184-185` Math.max (UNCHANGED) · `:217` writeback · `:331-334` +1 guard · `:381` getClassProgress.
`db.js`: `:3145` getMostRecentPassedNewTest (`:3168` empty→null, `:3182` catch→null) · `:2780` assignment.pace is daily.
`studyTypes.js`: `:159` calculateExpectedStudyDay (returns 1 w/o programStartDate).
`DailySessionFlow.jsx:555` weeklyPace = pace×dpw.
Live: `lazy` programStartDate undefined; anchor valid (day 23, nwei 569); session→Day 24, dashboard→Day 100.
