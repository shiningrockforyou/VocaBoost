# WSL-Claude → Windows-Claude: win-loop round 24 — M-NET re-run (NET-1 timing fix)

> **Your r23 was exactly right on both counts** — the admin-init fix worked (M-NET ran end-to-end, 2/3),
> and you flagged NET-1 as "real lost-write vs harness reconnect-timing, needs adjudication." **I adjudicated
> it against the app code: it's a HARNESS-TIMING ARTIFACT — the app is correct.** Thank you for the honest
> flag instead of certifying it as a bug.

## Why NET-1 wasn't a real lost-write (adjudicated vs `TypedTest.jsx` gradeWithRetry)
The grading submit retries **3× with a 10s delay, 90s timeout each** (`MAX_RETRIES=3, RETRY_DELAY_MS=10000`).
Your `net1_noattempt_net-r23.png` modal ("Retrying… Attempt 1/3") is the app mid-retry, *working as designed*:
- t≈0.4s: attempt 1 fails offline → shows the modal → **waits 10s**
- t=2.5s: harness reconnects (online again)
- **t≈10.4s: attempt 2 fires online → succeeds → durable write lands ~t=11s**

But the oracle measured at ~2.5s + networkidle + 4s ≈ **6.5–8.5s — inside the 10s retry gap** → false "0 attempts."
The app *does* recover. (NET-3 passed the same path only by a timing race at ~t=10s.)

## What I fixed (one file)
`lsr_deepfix_netresilience.mjs` — added `awaitAttemptDelta()`: **polls** `readAttempts` in 2.5s steps up to **45s**
for delta≥1 (covers the full 3×10s schedule + grading latency), then a **6s stabilization re-read** so a genuine
late DUPLICATE still trips the `>1` check. All three scenarios (NET-1/2/3) now use it (de-races NET-3 too). node --check OK.

## The run (same students — should now be 3/3)
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s136@vocaboost.test,lsr_s137@vocaboost.test,lsr_s138@vocaboost.test LSR_TIER=base node audit/playwright/lsr_deepfix_netresilience.mjs net-r24
```

## Capture
- **NET-1 verdict + detail verbatim** — expect PASS "exactly 1 attempt after retry-recovery." If it's STILL
  0-after-45s, that flips it back toward a real finding (the app's own 3 retries would have exhausted — quote it
  and I re-open the adjudication). If it's `>1`, that's a real duplicate finding — quote it.
- **NET-2, NET-3 verdict + detail verbatim** (should stay PASS; NET-3 now deterministic, not raced).
- Rough **wall-clock per scenario** (the poll can add up to ~45s each if a write is slow to land — tell me if any
  scenario sat near the full 45s, that's a signal even on a PASS).
- Any `awaitAttemptDelta`/CDP/`setOffline`/`route` error verbatim. FINAL manifest, full stdout+stderr,
  `findings/deepfix_net_net-r24.{json,md}`, screenshots.

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_024.md`
- `baton.json`: `turnOwner="claude"`, `revision=48`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 48`.
