# M-NET — degraded-network resilience matrix (design)

**Requested by David (2026-07-14):** run degraded-network scenarios, but SHORT — seed artificial Firebase data to
place a student right at a chokepoint, then degrade the network only for that one interaction. Each run ≈ 2-4 min.

## Approach
Seed-to-chokepoint (Admin SDK) → reach the interaction with the minimal browser steps (reuse the M-UI primitives,
which `skipToTest` past the study cards) → wrap ONLY the critical action in a degradation → assert with a
**white-box Admin-SDK post-check** (the strong oracle: the actual Firestore state must be correct + uncorrupted).

- **Degradations** (`lsr_deepfix_net_helpers.mjs`, built): `withOffline` (connection drop), `withSlow` (CDP
  bad-3G throttle), `withFailOnce` (transient failure → must retry), `withFailAll` (backend unreachable).
- **Oracle** = `lsr_reviewonly_fb` post-checks (`readAttempts`, `readProgress`, `readSessionState`, `snapshotState`)
  compared before/after — plus UX asserts (no false-success screen, no infinite spinner within a deadline,
  error/retry affordance where expected).

## Scenario matrix (v1)
| # | Chokepoint (seeded state) | Seed fn | Degradation | Pass oracle |
|---|---|---|---|---|
| NET-1 | Test **submit** | `seedFix9Anchor` (→ review-study, one test away) | `withOffline` around `fillSubmitAndObserve` | after reconnect: **exactly 1** attempt, no false "Day complete", progress unchanged-or-correct |
| NET-2 | Test **submit** | `seedFix9Anchor` | `withSlow` | loading state shown; eventual correct success; no false-fail |
| NET-3 | Test **submit** | `seedFix9Anchor` | `withFailOnce` (grade callable) | app retries → **exactly 1** attempt (idempotent), no duplicate |
| NET-4 | **Completion / day-advance** | `applyOverrideAnchor` / just-passed | `withOffline` on the completion write | progress advances **once** — not lost, not duplicated; csd/twi correct |
| NET-5 | **Dashboard reconciliation load** | `seedDriftedAssignment` / `seedImpossiblePhaseT` | `withSlow` + `withFailOnce` on reads | graceful — no wrong-state flash, no reconcile loop, correct final render |

## Flag modes (bonus value)
Run **flag-OFF** first: does *today's* client corrupt under a network drop at these chokepoints? (These scenarios
can EXPOSE the real-world #11 / reconciliation / false-success bugs.) Later **flag-ON** (server-authoritative +
idempotent writes) to demonstrate the deepfix *fixes* them. Server-dependent flag-on paths need the functions env
(emulator or deploy) — same caveat as M-UI; those self-INVALIDATE against the live backend rather than false-pass.

## Dependency (why the runner isn't wired yet)
M-NET's scenario bodies reuse the SAME setup + interaction primitives M-UI is currently calibrating (`login`,
`joinClass`, `selectList`, `driveNewWordsToTest`/`enterReviewSession`, `readTestRows`, `carefulAnswersFrom`,
`fillSubmitAndObserve`). Those haven't cleared even login on native Windows yet. Building the scenario bodies now
would be building on sand → rework. **Plan:** the degradation helpers + this design are done now (independent +
correct); the runner (`lsr_deepfix_netresilience.mjs`) gets wired + calibrated immediately after M-UI's shared setup
path goes green — at which point NET-1..5 are just "seed + reuse the now-working primitive + degrade + Admin-SDK
assert." Portable from the start (repo-relative; `NODE_OPTIONS=--use-system-ca` covers its Admin-SDK TLS like M-UI).

---

## RUN LOG — net-r20 … net-r24 (calibration → first green)

**net-r20/r21/r22 — all died at the uid precondition (masked bug, resolved).** Not "accounts missing":
M-NET called `admin.auth()` (uidByEmail, then createUser) BEFORE any `FB.db()`, so the FB helper's lazy
`admin.initializeApp()` never ran → `getUserByEmail` threw "default app does not exist" → `uidByEmail`'s silent
`catch` returned null → surfaced as "no uid" for every email. Fix (r23): call `FB.db()` at startup before the
scenario loop; un-mask `uidByEmail` (return null ONLY for `auth/user-not-found`, re-throw infra errors). The r21
"pool non-contiguous" theory was a false read from the silent catch — s136-138 existed all along (r23 branch A,
no `created fresh` line).

**net-r23 — M-NET runs end-to-end for the first time: 2/3.** NET-2 PASS (slow-3G → exactly 1, eventual success),
NET-3 PASS (one-shot write fail → retried to exactly 1, idempotent). **NET-1 FAIL "offline submit → 0 attempts
(lost write)" — adjudicated as a HARNESS-TIMING ARTIFACT, app is CORRECT.**

**NET-1 adjudication (vs `TypedTest.jsx` `gradeWithRetry`):** `MAX_RETRIES=3, RETRY_DELAY_MS=10000,
TIMEOUT_MS=90000`. Timeline: t≈0.4s attempt 1 fails offline → `setRetryAttempt(1)` (the "Retrying… Attempt 1/3"
modal in `net1_noattempt_net-r23.png`) → **waits 10s** → t≈10.4s attempt 2 fires (harness reconnected at t=2.5s,
so it's online) → succeeds → durable write ~t=11s. The oracle measured at ~2.5+networkidle+4 ≈ **6.5–8.5s — inside
the 10s retry gap** → false "0 attempts". The app *does* recover on the retry. NET-3 passed the same path only by a
race (its window lands ~t=10s). **The app has a robust 3×(10s-delay, 90s-timeout) grading retry; it is not losing
the write.**

**Fix (r24):** `awaitAttemptDelta()` — poll `readAttempts` in 2.5s steps up to 45s for delta≥1 (covers the full
3×10s schedule + grading latency), then a 6s stabilization re-read so a genuine late DUPLICATE still trips `>1`.
All three scenarios refactored off fixed settle+read onto the poll (also de-races NET-3). Expect net-r24 → **3/3
CLEAN**, certifying the submit-chokepoint resilience trio flag-OFF (today's client is resilient to offline blip,
slow link, and one-shot write failure at the grading submit).
