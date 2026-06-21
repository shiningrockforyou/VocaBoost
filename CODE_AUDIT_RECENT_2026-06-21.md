# Recent Code Audits - 2026-06-21

Scope: read-only review notes for the recent CSD v5 observability change and recent Dashboard implementation. No source files were modified as part of these audits.

## 1. CSD v5 Observability Code Review

### Summary

No blocking issues found in the three reviewed code files.

The v5 change appears to preserve reconciliation behavior while adding observability:

- `src/services/db.js:3150-3199` changes `getMostRecentPassedNewTest` to return a discriminated result:
  - `{ status: 'found', attempt }`
  - `{ status: 'none' }`
  - `{ status: 'query-error', error }`
- `src/services/progressService.js:131-134` converts that result back to the previous local `anchorTest` semantics: found attempt or `null`.
- `src/services/progressService.js:192-193` leaves the `safeCSD` / `safeTWI` reconciliation guard in the same behavioral shape:
  - valid anchor: trust calculated values
  - missing/invalid/query-failed anchor: preserve max of stored/calculated values
- `src/services/progressService.js:233-289` adds logging-only observability, wrapped in `try/catch`, after reconciliation decisions.
- `src/types/studyTypes.js:215-232` adds `implausibleStudyDayThreshold`, used only as a logging threshold.

### Findings

No Critical / High / Medium findings.

### Low / Watch

#### Logging path adds awaited network work to progress load

- **Where:** `src/services/progressService.js:244-285`
- **Scenario:** If a user has an anomalous progress record, `getOrCreateClassProgress` now awaits `logSystemEvent` calls during progress loading.
- **Why it matters:** `logSystemEvent` catches its own failures at `src/services/db.js:88-100`, so this should not break the app. Still, it can add latency on anomalous records.
- **Fix shape:** Acceptable for v5 observability. If this path ever becomes noisy, make these logs fire-and-forget or batch them behind a non-blocking telemetry queue.

### Verified

- The discriminated return is contained to one visible caller:
  - Export: `src/services/db.js:3150`
  - Import/caller: `src/services/progressService.js:20`, `src/services/progressService.js:131`
- Query failure is not treated as proof of no progress:
  - `src/services/db.js:3187-3197` returns `status: 'query-error'`
  - `src/services/progressService.js:134` maps non-found results to `anchorTest = null`
  - `src/services/progressService.js:192-193` uses `Math.max` protection when anchor data is not valid
- Error payload is Firestore-safe:
  - `src/services/db.js:3190-3196` stores `message`, `code`, and a sliced string `stack`, not a raw `Error`
- Clean no-anchor implausible logging is gated:
  - `src/services/progressService.js:258-285` only evaluates the threshold when `anchorStatus === 'none'` and `storedCSD > CSD_IMPLAUSIBLE_MIN`

### Could Not Verify

- I did not run the full app build/lint as part of this save step.

## 2. Dashboard Code Review

### High

#### Primary focus preference ignores the saved class id

- **Where:** `src/pages/Dashboard.jsx:907-925`, `src/pages/Dashboard.jsx:1340-1344`, `src/pages/Dashboard.jsx:1426`
- **What:** The selection flow stores both `primaryFocusListId` and `primaryFocusClassId`, but `getPrimaryFocus` resolves the saved preference using only `primaryFocusListId`. The dropdown selected state also compares only `list.id`.
- **Failure scenario:** A student belongs to two classes that assign the same vocabulary list. Selecting Class B / List X can resolve to Class A / List X, show the wrong class/progress, and route to the wrong session URL.
- **Why it matters:** This can corrupt the user experience in the exact multi-class/list-reuse case where state needs to be most deterministic.
- **Fix shape:** Resolve saved focus by both `primaryFocusClassId` and `primaryFocusListId`. Use list-only matching only as a legacy fallback when the saved class id is missing or invalid. Update dropdown highlighting to compare both `classId` and `id`.

#### Attempt class attribution can be overwritten with the wrong class

- **Where:** `src/services/db.js:2446-2457`, `src/services/db.js:2474-2479`, `src/services/db.js:2491-2498`, `src/pages/Dashboard.jsx:1270-1273`
- **What:** `fetchUserAttempts` derives `classId` by scanning enrolled classes for the first class containing the parsed `listId`, then spreads `attemptData` and overwrites `classId` with that derived value.
- **Failure scenario:** If the same list is reused in multiple classes, attempts from Class B may be returned as Class A. Dashboard then filters attempts by `classId` and `listId`, which can cause the hero to show the wrong new/review/complete state.
- **Why it matters:** This is a progress/session-state correctness issue and can make students see or enter the wrong workflow.
- **Fix shape:** Preserve `attemptData.classId` when present. Derive class id only as a legacy fallback. Also consider parsing class id from the newer `vocaboost_test_{classId}_{listId}_{testType}` format instead of discarding it.

### Medium

#### "Test today" calculation is not scoped to the selected class/list

- **Where:** `src/pages/Dashboard.jsx:1255-1264`, `src/pages/Dashboard.jsx:1270-1273`
- **What:** `testCompletedToday` is calculated from all `userAttempts`, while the authoritative phase later filters to `listAttempts`.
- **Failure scenario:** Completing any test in any class/list can mark the selected primary focus as completed if `dailyStatus` / `testCompletedToday` is surfaced or reused.
- **Why it matters:** The current hero appears to rely on the filtered `phase`, but the unscoped daily status is a latent correctness trap.
- **Fix shape:** Calculate `listAttempts` before daily status and pass `listAttempts` to `hasTestToday`, or remove the unused daily status fields if they are no longer part of the UI contract.

#### Dashboard update bypasses theme tokens in several visible areas

- **Where:** `src/pages/Dashboard.jsx:1308-1310`, `src/pages/Dashboard.jsx:1328-1347`, `src/pages/Dashboard.jsx:1370-1429`
- **What:** The Dashboard uses raw Tailwind colors and raw hex values such as `bg-white`, `border-gray-200`, `text-gray-500`, `bg-blue-50`, `to-blue-700`, `text-blue-200`, and `bg-[#A9C0FF] text-[#0B2570]`.
- **Failure scenario:** Dark mode or theme changes produce inconsistent contrast and unpolished color attribution because Dashboard bypasses semantic tokens.
- **Why it matters:** This directly conflicts with the planned systematic theme/dark-mode cleanup.
- **Fix shape:** Replace raw color utilities with semantic tokens from `src/index.css`. If the hero needs an inverse or branded treatment, define explicit semantic hero/inverse tokens rather than one-off raw colors.

### Low

#### Fallback comment says first list, but null assignment dates can select the last list

- **Where:** `src/pages/Dashboard.jsx:930-962`
- **What:** The fallback loop updates `primaryList` whenever `!latestAssignedAt` is true. If all lists have null `assignedAt`, `latestAssignedAt` remains null and the loop keeps replacing `primaryList`.
- **Failure scenario:** Auto-selected focus can drift to the last iterated list rather than the first available list described by the comment.
- **Fix shape:** Only set the first null-date fallback once, or run a separate first-list fallback after the dated search fails.

### Non-Finding

#### Hero CTA navigation does not appear to bypass session re-entry protection

- **Where:** `src/pages/Dashboard.jsx:1426`, `src/pages/DailySessionFlow.jsx:748-763`
- **Reasoning:** The hero navigates directly to `/session/:classId/:listId`, while other paths may call a dashboard handler first. This initially looked suspicious, but `DailySessionFlow` itself checks existing session state and shows the re-entry modal when appropriate.

### Could Not Verify

- `src/pages/Dashboard.jsx` had no current working-tree diff when checked, so this review is against the current implementation rather than a patch diff.
- I did not run full build/lint for this saved report.
- `node --check src/pages/Dashboard.jsx` is not applicable in this environment because Node does not directly parse `.jsx` files without the project toolchain.
