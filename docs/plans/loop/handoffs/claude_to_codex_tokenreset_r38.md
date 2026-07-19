# WSL → Codex round 38: VERIFY the challenge-token MONTHLY→WEEKLY change (David-directed)

David: "I want token resets to happen every week instead of every month — what changes would that require? Check with codex."

## What I found (verify completeness + correctness)
Challenge-token model: **5 tokens max**; `getAvailableChallengeTokens = max(0, 5 - activeRejections)` where an active
rejection = `status==='rejected' && replenishAt > now`. Computed identically client (`db.js:193`) + server
(`index.js:664`, "byte-parity" per its comment). A rejection removes 1 token until its `replenishAt` passes, then it's
auto-restored.

The 30-day window is set at write time in:
- **AUTHORITATIVE:** `functions/index.js:695` — `const REPLENISH_MS = 30 * 24 * 60 * 60 * 1000;` (used by the
  `submitChallenge` callable, the live path since `SERVER_CHALLENGE_WRITE = true`).
- **Legacy client fallback:** `src/services/db.js:2796` — `Timestamp.fromDate(new Date(Date.now() + 30*24*60*60*1000))`
  (dormant while `SERVER_CHALLENGE_WRITE=true`, but should stay in parity).
- **UI copy:** `TestResults.jsx:214` + `Gradebook.jsx:1519` — "you lose 1 token for 30 days".
- The availability calc just compares `replenishAt > now`, so it **auto-adapts** — no change.

**VERIFY:** is that the COMPLETE set of 30-day dependencies? Grep for any other place that assumes the replenish
window (a cron/cleanup, analytics, a test, teacher-facing copy, a "resets monthly" string anywhere). Confirm the client
`db.js:2796` path is truly unreachable under the current flags. Confirm nothing else reads `challengedAt`/`replenishAt`
arithmetically.

## Two decisions — your recommendation
1. **Rolling-7d vs calendar-week reset.** Minimal = rolling (`replenishAt = challengedAt + 7d`): each penalty lasts a
   week instead of a month, same mechanism. "Resets every week" could instead mean a **calendar reset** (all tokens back
   every Monday) — a different model (more code, changes the mental model). Which matches intent, and which is cleaner?
   My lean: rolling-7d (one-constant change, lowest risk) unless David wants a predictable weekly refill.
2. **Backfill existing active rejections?** Changing `REPLENISH_MS` only affects NEW rejections — students currently
   under a 30-day penalty keep it (their `replenishAt` is already written +30d) until it expires. The TA triage (N2)
   says students are stuck tokenless NOW. So: do we also run a one-time **migration** of active rejections
   (`replenishAt → challengedAt + 7d`, or clear expired-by-new-rule ones) to unstick them immediately? This is a 26SM
   real-data fix (needs David's authorization + a CS script). Recommend approach (recompute vs clear) + the precondition
   gate.

(Related, OUT of scope unless David asks: a **rejected** challenge also consumes a token — triage N2's compounding
factor. Flag it; don't fold it in.)

## Hand back
Write `docs/plans/loop/codex_reviews/codex_tokenreset_r38.md` with: (a) the verified complete change-set (any site I
missed), (b) your rec on rolling-vs-calendar, (c) your rec on backfill (y/n + how). Set baton `turnOwner=claude round=38
taskId=TOKEN_RESET_WEEKLY codexStatus=review-written codexDecision=DONE updatedBy=codex revision=147
codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_tokenreset_r38.md`.
