# Codex review — Round 39 `TOKEN_RESET_CALENDAR`

## Verdict

Review complete. Calendar-week reset is a valid product choice, and Approach 3 — write a concrete KST reset boundary into `replenishAt`, keep all read paths as `replenishAt > now` — is the right architecture.

However, the proposed implementation is not safe to ship exactly as written. I found two required fixes:

1. `mondayOfWeekTimestamp()` is not exported from `functions/foundation.js`, so `functions/index.js` cannot reuse it through `foundation.mondayOfWeekTimestamp()` unless it is exported or moved/shared.
2. The one-time amnesty must account for existing `pending` challenge entries created under the old 30-day writer. If those pending entries are later rejected, the current review paths only flip `status`; they do not recompute `replenishAt`, so those entries can become active 30-day rejections after the calendar reset ships.

## 1. KST Monday helper / edge behavior

`functions/foundation.js:432-440` currently computes the Monday 00:00 boundary in fixed KST by applying `STREAK_TZ_OFFSET_MINUTES = 540`, using UTC date methods, then subtracting the offset before returning a Firestore `Timestamp`.

That math is suitable for the token reset boundary:

- KST has no DST, so the fixed +540 minute offset is stable.
- The helper returns the current week’s Monday 00:00 KST.
- Adding `7 * DAY_MS` gives the next Monday 00:00 KST.
- At exactly Monday 00:00 KST, `mondayOfWeekTimestamp() + 7d` means a newly rejected challenge loses a token until the next weekly refill. That matches “new penalty after the reset boundary lasts until next reset.”

Implementation caveat:

- `mondayOfWeekTimestamp()` is private to `foundation.js`. `module.exports` does not include it. Since `functions/index.js` imports `const foundation = require("./foundation")`, calling `foundation.mondayOfWeekTimestamp()` would be `undefined` unless you export it.

Recommended implementation shape:

- Either export a clearly named helper from `foundation.js`, e.g. `nextKstMondayTimestampFromMillis(nowMs)`, or define the helper locally in `index.js` with the same fixed-KST math.
- Prefer a pure helper taking `now.toMillis()` rather than calling `Date.now()` internally. That prevents tiny boundary inconsistencies between `Timestamp.now()` and `Date.now()` around exactly Monday 00:00 KST.

Example semantic target:

```js
const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 540 * 60 * 1000;
function startOfKstWeekMs(nowMs) {
  const d = new Date(nowMs + KST_OFFSET_MS);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - KST_OFFSET_MS;
}
function nextKstMondayTimestamp(nowTs) {
  return Timestamp.fromMillis(startOfKstWeekMs(nowTs.toMillis()) + DAY_MS * 7);
}
```

Then in `submitChallenge()`:

```js
const now = Timestamp.now();
const replenishAt = nextKstMondayTimestamp(now);
```

## 2. Approach 3 vs read-time calendar logic

I agree with Approach 3.

Keeping the read path unchanged is the safest parity-preserving design:

- Server read: `functions/index.js:661-666` counts active rejections by `replenishAt > Date.now()`.
- Client read: `src/services/db.js:193-198` does the same.
- Once the server writes a KST Monday boundary into `replenishAt`, all clients, regardless of browser timezone, evaluate the same absolute timestamp.

Approach 1 — calculating “rejections since this Monday” at read time — is higher risk because the current browser helper `src/types/studyTypes.js:142-150` uses local browser time (`getDay`, `setHours`). That would reset Vietnam/browser-local students on their local Monday boundary, not KST Monday 00:00. It would also require changing both server and client availability logic and keeping them timezone-identical.

Approach 3 does not misbehave for students who never get a fresh rejection; they simply have whatever old `replenishAt` values already exist. That is why the one-time data reset/migration matters.

## 3. Other `replenishAt` / 30-day consumers

I did not find another product consumer that assumes a 30-day challenge-token horizon.

Required copy/code sites remain:

- `functions/index.js:695/719`: authoritative write value.
- `src/services/db.js:2796`: dormant legacy fallback write value.
- `src/components/TestResults.jsx:214`: “lose 1 token for 30 days” copy.
- `src/pages/Gradebook.jsx:1519`: same copy.

Unrelated hits:

- Gradebook `Past 30 days` filters are analytics/date filters, not challenge-token replenishment.
- CS scripts `deepfix-f6-tokens.mjs` and `scan-preemptive-fixes.mjs` compute active rejections with `replenishAt > now`; they auto-adapt to the stored timestamp model.

Legacy fallback warning:

- Do not mirror the calendar reset in `src/services/db.js` using the existing browser-local `getMondayOfWeek()` helper. If the fallback is kept, use a fixed-KST helper there too, or make the fallback fail closed / unavailable once server challenge writing is mandatory. Browser-local weekly math is not acceptable for KST calendar reset semantics.

## 4. One-time amnesty / reset script

`reset-challenge-tokens.mjs` is end-to-end compatible with the unchanged read model for already-rejected active entries: it backdates `replenishAt`, and both server/client availability stop counting those entries.

But it is incomplete for “reset token count for all students” if there are existing pending challenge entries with old 30-day `replenishAt` values.

Why:

- `submitChallenge()` writes `replenishAt` at submission time, while status is `pending`.
- Active-token loss only begins once status becomes `rejected`.
- Both review paths only flip status:
  - server `functions/foundation.js:2635-2640`
  - legacy client `src/services/db.js:2939-2944`
- Neither path recomputes `replenishAt` on rejection.

Therefore, a pending challenge submitted before this change can still carry `replenishAt = old submit time + 30 days`. If a teacher rejects it after deploy/amnesty, it becomes a 30-day active rejection.

Required handling options:

1. Preferred: update the amnesty script to also rewrite pending entries whose `replenishAt` is in the future.
   - For full amnesty, backdate active `rejected` and existing `pending` entries.
   - This means if a pre-amnesty pending item is later rejected, it will not consume a token from the old 30-day window.
   - Add an audit note field such as `tokenResetAt` / `tokenResetNote` to both touched rejected and pending entries.

2. Alternative: update challenge review code so that when a pending entry is rejected, it normalizes `replenishAt` to the next KST Monday boundary if the existing value is later than that.
   - This is more invasive because it touches teacher review semantics.
   - It may still be a good defensive fix, but it is not necessary if the one-time script handles old pending entries and all new submissions write calendar boundaries.

If David’s intent is literally “everyone starts with 5 now,” then the existing reset script’s blanket-expire approach is acceptable, but expand its predicate beyond active rejected entries to include old pending entries as described above.

## Required fixes before implementation is considered clean

- Export/share the KST Monday helper or implement a local fixed-KST helper in `functions/index.js`; do not call a private `foundation.js` function.
- Base the token `replenishAt` calculation on the same `now` timestamp used for the challenge entry.
- Keep read paths unchanged.
- Do not use browser-local `getMondayOfWeek()` for the dormant client fallback.
- Update UI copy in both student/gradebook challenge surfaces.
- For the amnesty script, handle old pending challenge entries as well as active rejected entries, or explicitly document that pending old-30d challenges are excluded and can later reintroduce long lockouts.

## Final call

Architecture: GO.

Implementation as described: NEEDS FIXES for helper visibility and pending-entry amnesty coverage.
