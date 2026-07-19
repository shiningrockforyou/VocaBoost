# WSL → Codex round 39: VERIFY the CALENDAR-reset implementation (David decided)

Follows your r38 (`codex_tokenreset_r38.md`). **David decided the calendar-week model, not rolling:**
> "predictable Sunday midnight (so technically 00:00 Monday) refill, KST. reset token count for all students."

Your r38 recommended rolling + a targeted backfill; David chose calendar + full amnesty (both his call — your r38 said calendar
is right when the rule is explicitly "tokens refresh every Monday," which it is). r38 verified the *rolling* constant-swap;
this round verifies the *calendar* implementation, which is different.

## Proposed implementation (verify / poke holes)
**Approach 3 — KST math on the server WRITE, read path untouched:**
- `functions/index.js:695/719`: replace `REPLENISH_MS = 30d` + `replenishAt = now + REPLENISH_MS` with
  `replenishAt = mondayOfWeekTimestamp() + 7*DAY_MS` (= the NEXT Monday 00:00 KST after `now`), reusing the existing
  `mondayOfWeekTimestamp()` (foundation.js:432, fixed +540min KST offset → Monday 00:00 KST, deterministic under UTC runtime).
- Read path `getAvailableChallengeTokens` (client db.js:193 + server index.js:664) **UNCHANGED** (`replenishAt > now`) → parity
  preserved automatically; ALL students reset at the same Monday 00:00 KST boundary regardless of physical TZ.
- `src/services/db.js:2796` (dormant client fallback): mirror, but it uses the browser-local `getMondayOfWeek()` which is NOT
  KST-correct for non-KST students (e.g. 베트남-윤여진 / Vietnam UTC+7). Since it's dormant under SERVER_CHALLENGE_WRITE=true it
  can't run, but recommend how to keep it correct-or-safe for rollback (KST-fixed calc, or a guarded no-op).
- UI copy TestResults.jsx:214 / Gradebook.jsx:1519: "for 30 days" → "resets Monday / weekly".

**One-time amnesty ("reset token count for all students"):** run `scripts/cs/reset-challenge-tokens.mjs` (dry-run → --commit).
It expires active rejections → everyone to 5. Compatible (read = `replenishAt > now`). David-authorized.

## VERIFY (the questions that matter)
1. Is `mondayOfWeekTimestamp()` safe to reuse for tokens (gives Monday 00:00 KST, no `new Date()` resume hazards, no DST since
   KST is fixed +9)? Is `+ 7*DAY_MS` the correct "next boundary" for a rejection at `now` (incl. the Monday-00:00 edge)?
2. Approach 3 (server-write KST) vs Approach 1 (read-time "rejections since this Monday"): confirm Approach 3 is the
   parity-safe choice given the client read runs in the browser and the client Monday helper is TZ-local. Any case where
   Approach 3 misbehaves (clock skew, a rejection exactly at 00:00, a student who never gets a fresh rejection)?
3. Any OTHER consumer of `replenishAt` that assumes a ~30-day horizon (UI countdown, "replenishes on X" text, analytics)?
4. Amnesty: is `reset-challenge-tokens.mjs` still correct end-to-end under this change (it backdates `replenishAt`; read is
   unchanged)? Any interaction with the new write path?

## Hand back
Write `docs/plans/loop/codex_reviews/codex_tokencalendar_r39.md`. Set baton `turnOwner=claude round=39
taskId=TOKEN_RESET_CALENDAR codexStatus=review-written codexDecision=DONE updatedBy=codex revision=149
codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_tokencalendar_r39.md`.
