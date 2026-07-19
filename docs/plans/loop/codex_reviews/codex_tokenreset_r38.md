# Codex review — Round 38 `TOKEN_RESET_WEEKLY`

## Verdict

`DONE`: the weekly token reset change is small in product code, but existing active 30-day rejections need an explicit data decision. Code-only will not unstick the currently tokenless cohort.

## A. Complete 30-day dependency set

I checked the repo for `replenishAt`, hard-coded 30-day arithmetic, challenge-token copy, and challenge-token availability logic, excluding `apBoost`.

Required product changes:

1. `functions/index.js:695`
   - Current authoritative write path: `const REPLENISH_MS = 30 * 24 * 60 * 60 * 1000;`
   - This is the live source of new token lockout windows because `src/config/featureFlags.js:23` has `SERVER_CHALLENGE_WRITE = true`.
   - Change this to 7 days, preferably with a clearer name/comment such as `CHALLENGE_TOKEN_REPLENISH_MS`.

2. `src/services/db.js:2796`
   - Dormant legacy client fallback: `Date.now() + 30 * 24 * 60 * 60 * 1000`.
   - It is currently unreachable while `SERVER_CHALLENGE_WRITE=true` because `submitChallenge()` returns through the callable path first.
   - Still change it for parity and future rollback safety.

3. `src/components/TestResults.jsx:214`
   - UI copy says: rejected challenge loses 1 token for 30 days.
   - Change to `7 days` or `1 week`.

4. `src/pages/Gradebook.jsx:1519`
   - Same UI copy; update with the same wording.

No product-code change needed:

- `getAvailableChallengeTokens()` in both server and client already computes availability from active rejected entries: `status === 'rejected' && replenishAt > now`. It automatically adapts once `replenishAt` is written with a 7-day horizon.
- Teacher challenge review code does not appear to compute a 30-day value; it flips challenge status and lets the existing `replenishAt` field control active-token loss.
- Gradebook `Past 30 days` filter/preset hits are unrelated analytics/date-filter UI, not challenge-token replenishment.
- `scripts/cs/deepfix-f6-tokens.mjs` and `scripts/cs/scan-preemptive-fixes.mjs` count active rejections using the same predicate and do not need arithmetic changes.

Operational/script note:

- `scripts/cs/reset-challenge-tokens.mjs` is relevant to the backfill decision. It currently performs a blanket reset-to-5 by backdating every active rejected entry. That is useful as an emergency amnesty script, but it is too broad for a faithful monthly-to-weekly migration unless David intentionally wants full amnesty.

## B. Rolling 7-day vs calendar-week reset

Recommendation: use rolling 7-day lockout.

Reasons:

- It is the minimal semantic change from the current model: rejected challenge → token unavailable for fixed duration after rejection.
- It requires only the write-time constant and copy changes above.
- It avoids timezone/classroom-calendar questions.
- It is fairer at boundaries: a Sunday rejection does not last only a few hours while a Monday rejection lasts a full week.

Calendar-week reset is a different product model. It requires defining the reset timezone, deciding whether all rejections expire at the same weekly boundary, and either computing that boundary at write time or changing availability semantics. I would only choose calendar-week if the desired classroom rule is explicitly “tokens refresh every Monday/weekly class boundary,” not “penalty lasts one week.”

## C. Existing active 30-day rejections / backfill

Recommendation: yes, run a targeted backfill if the goal includes unsticking the current affected cohort.

Code-only changes only affect newly-created `replenishAt` values. Existing rejected history entries keep their old 30-day future timestamps and will continue consuming tokens until those old timestamps expire.

Preferred migration:

- For each active rejected challenge entry, compute `weeklyReplenishAt = challengedAt + 7 days`.
- Set `replenishAt = min(existingReplenishAt, weeklyReplenishAt)`.
- If `weeklyReplenishAt <= now`, the token becomes available immediately by setting `replenishAt` to that past timestamp, or to `now - 1s` if the script needs a simple expired value.
- Preserve challenge history. Do not delete entries.
- Add audit metadata per changed entry, e.g. `tokenWindowMigratedAt`, `tokenWindowMigratedFrom`, `tokenWindowMigration: '30d-to-7d'`.

Do not use the existing `reset-challenge-tokens.mjs` as-is unless David wants blanket amnesty. That script backdates all active rejected entries and restores everyone to 5 tokens, including students whose rejection was less than 7 days ago.

Suggested precondition gate for any write script:

- Dry-run first; require `--commit` for writes.
- Scope to the intended cohort/class, e.g. 26SM, or an explicit email allowlist.
- Only touch `users/*/challenges.history[]` entries where `status === 'rejected'` and `replenishAt > now`.
- Require a valid `challengedAt`. If missing/unparseable, skip and report for manual review rather than guessing.
- Only shorten windows; never extend an existing `replenishAt`.
- Emit counts: users scanned, users touched, entries shortened, entries now expired/restored, entries skipped for missing/invalid `challengedAt`.
- Save a before/after dry-run artifact before any commit.

## D. Out-of-scope but worth flagging

The current model only makes rejected challenges consume tokens while active. Pending entries are not counted by `getAvailableChallengeTokens()`, although `submitChallenge()` returns `availableTokens(history) - 1` immediately after submission. I am treating that as out-of-scope because the handoff defines active rejection as the token-consuming state.

Also out of scope: the compounding effect where false grader rejections plus slow review turnaround can strand students. Weekly replenishment reduces the pain, but it does not solve the root policy/product issue. If that is still a concern, make it a separate work item rather than folding it into the monthly-to-weekly change.

## Final recommendation

Implement rolling 7-day replenishment in both server and legacy client fallback, update the two UI copy strings, and run a targeted 30d-to-7d backfill for the affected active rejected entries. Do not blanket-clear all active rejections unless David explicitly chooses amnesty.
