# Cycling — Cohort-Validation Mini-Plan (accelerated, foundation-deferred)

**Status:** LOCAL-ONLY plan (2026-07-15). David runs the deploys. This is the FAST path to shipping list
cycling (P9) to the current small cohort **without** first landing the full server-authoritative foundation
(P3–P6) — a deliberate, owner-accepted trade for a small trusted userbase.

---

## 0 · The trade you're accepting (explicit)

Standard order gates cycling behind the whole foundation because removing the allocation cap re-opens
**progress-forgery** and removes a guardrail against the system's own bugs. At cohort scale:
- **Forgery risk → negligible.** Small, known, trusted students. Not a threat.
- **Safety-net risk → small + recoverable.** If a cycling bug corrupts a student's progress, there's no
  server-side validation to catch it — but the blast radius is a handful of students, reconcilable with the
  existing CS runbook (`scripts/cs/manual-pass.mjs` + the integrity sweep), exactly as you do today.

**Verified viable (not just asserted):** cycling runs **entirely client-side**. The client completion path
`completeSessionFromTest` (studyService.js:1663) increments `totalWordsIntroduced` by the cycling-aware
`wordsIntroduced` with **no re-cap to list length** → the counter climbs monotonically past `cycleLength`, the
lookup wraps (`resolveVirtualRange`, positions[i mod cycleLength]), and reconciliation (LIST_SCOPED_RECON,
already live) treats the monotonic index normally. **No server callable is on cycling's critical path** — with
`SERVER_PROGRESS_WRITE` off the client owns the write, and cycling's server mirror stays dark.

---

## 1 · The exact flags to flip

| # | Where | Change | Deploy |
|---|-------|--------|--------|
| 1 | `src/config/featureFlags.js` → `CYCLING_ENABLED` | `false` → `true` (client global gate) | rebuild → `--only hosting` |
| 2 | Teacher UI → **per-assignment** | Owner teacher ticks the **cyclingEnabled** checkbox that appears in the class Assignment Settings once flag #1 is live (ClassDetail.jsx:1366; writes via `updateAssignmentSettings`, db.js:974). **Do ONE pilot class first.** | data write (no deploy) |
| — | `functions/foundation.js` `FOUNDATION_FLAGS.CYCLING_ENABLED` | **NO CHANGE** — stays `false`. With `SERVER_PROGRESS_WRITE` off the server cycling legs are dark; the client owns it. | — |

Two-key gate: a cycling path runs only when **both** the global flag (#1) **and** the per-assignment field (#2)
are true. So flipping #1 alone is inert until a teacher opts a class in — a safe, reversible staging.

**Rollback:** flip `CYCLING_ENABLED` back to `false` → rebuild → `--only hosting`. Byte-equivalent-dormant again;
the per-assignment field goes inert (never read). Any corrupted progress → CS reconcile (small N).

---

## 2 · U5 — DECIDED: RESET at lap boundary ✅ (wired 2026-07-15)

**David's decision: RESET.** Implemented client-side (cycling-gated, byte-equivalent when off):
`updateClassProgress` (progressService.js) detects the lap-boundary crossing
(`floor(twiBefore/cycleLen) < floor(twiAfter/cycleLen)` when `cycling.active`) → drops lap N-1's
`recentSessions` (the intervention driver) + zeroes stored `interventionLevel`; `cyclingActive`/`cycleLength`
threaded from both completion paths. **Follow-ups:** (a) mirror the reset in the SERVER `completeSession`
(foundation.js) BEFORE `SERVER_PROGRESS_WRITE` flips; (b) the U3 check (§3) must exercise a lap-boundary
crossing to confirm the reset fires; (c) include in the Codex v2 review.

<details><summary>Original decision framing (kept for the record)</summary>

### The question (was)

**When a student rolls into lap 2 (twi crosses k·cycleLength), does their intervention/throttle level RESET or
CARRY?**

- **CARRY (what the code does today):** `interventionLevel = calculateInterventionLevel(recentSessions)`
  (studyService.js:325) flows through unchanged at the boundary. A student who was throttled near list-end
  (high intervention, few new words/day) enters lap 2 **still throttled** → they cycle slowly or barely at all.
- **RESET:** lap 2 starts at full pace; the student re-introduces words at full speed. Needs a **small code
  change** (detect twi crossing k·cycleLength in the completion path → reset the intervention inputs).

**My read:** cycling is meant to *re-expose* a student to a finished list — and the students you'd point it at
are exactly the throttled/near-mastery ones. CARRY largely defeats that (they stay throttled into lap 2). So I'd
lean **RESET at the lap boundary** — but it's a genuine product call, and RESET has its own nuance (a student
who was struggling may just re-throttle a few days into lap 2). **Your decision.** (If RESET, it's ~a dozen
lines; I'll wire it as part of this plan.)

</details>

---

## 3 · U3 — the ONE correctness check that must pass first (cycling × review-only / #11)

**Why:** the two features you want — #11 (review-only-day completion) and cycling — intersect, and the
implementer explicitly flagged the intersection **unverified** (P9_impl_notes U3: "believe it composes, but
needs the review-only personas re-run WITH cycling on"). The composition **is in the code**
(`completeSessionFromTest` reviewOnlyDay branch + the lap-bounded review pool in `initializeDailySession`), but
the two have never run together.

**The check (emulator flag-on, `CYCLING_ENABLED=true`):** seed a student at a **lap boundary**
(twi = k·cycleLength) on a cycling-enabled assignment, with intervention throttled so `allocation.newWords <= 0`
(a review-only day). Then complete the day and assert:
- **csd advances by 1** (day counted),
- **twi stays flat** (review-only day introduces 0 — no phantom lap progress),
- **the review segment is drawn from the current lap** `[0, twi mod cycleLength)` (lap-bounded pool),
- **no false "Day Complete" freeze** and no reconciliation error / progress corruption.

Run it across the existing review-only personas (the RA/RO-S scenarios) with cycling on. This reuses the
flag-on emulator rig (the "shared setup"): client build with `CYCLING_ENABLED` + `LIST_SCOPED_RECON` on, pointed
at the Firestore/Functions emulator. **Green here = the #11 × cycling composition is proven before any cohort
student touches it.**

---

## 4 · Minor adjudications (accept-as-is unless you object)

- **U2 (M4 semantics):** "no per-lap cap under cycling" — already implemented; accept.
- **U4 (lap ack):** inline **"Lap N" badge** (already implemented) vs a one-time "Starting Lap N" interstitial.
  Cosmetic. Default: keep the inline badge.

---

## 5 · Sequenced rollout

1. **Decide U5** (reset vs carry) → if reset, I wire the ~dozen-line change.
2. **Verify U3** on the emulator (flag-on) → must be green.
3. Ship `CYCLING_ENABLED=true` → rebuild → `--only hosting` (can ride the same initial release as #11, or a
   follow-on hosting deploy — your call).
4. **Enable ONE pilot class** (teacher ticks cyclingEnabled) → watch those students directly as they approach +
   cross the first boundary.
5. Widen to more classes once the pilot looks clean. Rollback is one flag flip away.

**Timeline: days of focused validation, not weeks** — the big-scale soak is swapped for close-watch cohort
testing, which at your size is the better tool.

---

## 6 · What this plan deliberately does NOT do
- Does **not** land P4–P6 (server write cutover, migration, rules lockdown). Cycling's writes stay
  client-authoritative → the accepted forgery + reduced-safety-net trade (§0).
- Does **not** deploy any rules change (the `firestore.rules` end-state stays un-deployed — Codex's blocker).
- The full server-authoritative foundation remains the correct end-state for scale; this is the cohort-stage
  accelerant, not a replacement.
