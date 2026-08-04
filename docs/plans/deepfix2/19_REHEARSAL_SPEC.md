# DEEPFIX2 · 19_ — THE 25WT REHEARSAL SPEC (data + criteria half)

**Status:** authored 2026-08-04. Closes the DATA/CRITERIA half of panel finding **13_ O1-5 [HIGH]**,
which required this and was never written. The UI-matrix and Playwright-scope half waits for the client
cutover to exist — the charter itself calls the product rehearsal *"impossible pre-build"*.

**Why this half is written FIRST, before the UI it will judge.** Acceptance criteria authored after a
build get bent to fit what was built. This program has already produced two claims written to fit and
disproved by their own fixtures. A pass bar written after watching the thing pass is not a pass bar.

---

## 1. WHAT 25WT IS — the honest capability statement, first

**25WT is an audit sandbox owned by `ta@`, not a cohort.** The 26SM probe roster shows the 25WT DUP
classes holding **1-4 students each, 13 in total** (13_ O1-5 evidence). 26SM is **947 students**
(`b1-baseline-pointer-full.json`: `students: 947`, `cohortTotal: 947`).

**Therefore, stated before any criteria so it cannot be forgotten mid-run:**

> **25WT CANNOT REHEARSE A MASS-WALL EVENT.** It is ~1.4% of the cohort and its classes are single-digit.
> A simultaneous 947-student flip has a failure mode — many students walled at once, support saturated,
> the pattern only visible in aggregate — that **this rehearsal is structurally incapable of producing**.
> Anyone who reads a green rehearsal as "the flip is safe" has misread it.

**What carries that risk instead:** day-one monitoring with abort signals, and the kill switch.
**Panel finding 13_ O1-6 [HIGH] records that this monitoring has no numbers, no card and no abort rule.**
That finding is a SEPARATE launch blocker from this spec and is NOT closed by it. → queue `monitoring-abort-rule`.

## 2. WHAT THE REHEARSAL IS FOR

Not "does the flip work at scale" — it cannot answer that. It answers:

1. **Does a real student, in a real browser, complete a real day end to end on the engine?**
   Compose → study → test → submit → grade → complete → advance, with the flag ON via `rehearsalClassIds`.
2. **Do the engine's refusals render as reasons rather than dead ends?** Every status a student can
   actually reach must produce something a human can act on.
3. **Do the expected differences appear, and only those?** (§4)
4. **Does anything write that should not?** No 26SM document may be touched.

## 3. THE SEEDED POPULATION — reproduce 26SM's SHAPE, not its size

Derived from the B1 full baseline (`b1-baseline-pointer-full.json`, watermark `1785666357220`):
cohort **947 students**, **35,078 attempts seen / 34,867 eligible / 211 excluded**.

Seed 25WT accounts spanning these strata, because each exercises a different engine path:

| Stratum | Why it must be present |
|---|---|
| **Day-1 / empty universe** | `twi = 0` ⇒ NO review by construction. The engine's day-1 encoding (`anchorNwei = -1`) is a real branch. |
| **Mid-list, healthy** | The ordinary rotation: queue > testSize, cursor advances, no top-up. |
| **Underflow** (pool < queueSize) | Forces the R2-41(e) top-up path — resting words pulled back in. |
| **Recently-failed words present** | `needsPriority` prefix actually populated, so the priority-prefix-preserving shuffle is exercised rather than assumed. |
| **List-end** (`twi === |list|`) | The whole list is the universe; the list-end screen and no-new-words day-advance. |
| **Post-reset** (`resetEpoch > 0`) | Epoch binding on queue/attempt/job; the reset fence. |
| **A multi-student class (≥2)** | The ONLY way the `rv2_` id-collision class can appear. **The cutover-a fix removed the ACCIDENTAL collisions**, so this must now be provoked deliberately (NEED_TO_FIX 18). |

**The exclusion classes must also be represented**, because B1 shows they exist in the real cohort and
the engine must refuse them without stranding the student: `ungraded` (77 in 26SM), `badScore` (3),
`rowsGtTotal` (1), `scoreRowsDisagree` (1), `missingCoreField` (129).

## 4. EXPECTED DIFFERENCES — name them, or a real bug hides behind a false one

Every one of these WILL appear and **must not be reported as a regression.** Conversely, their ABSENCE
flag-off is a finding.

1. **Today's failed NEW words no longer enter today's REVIEW** (NEED_TO_FIX 24). The engine's review
   universe is positions `< twi`, and twi advances only at day completion. Today's failure becomes
   tomorrow's priority. **By design.**
2. **The review word-range label ("Words #a-b") disappears** flag-on — the segment it described does not
   exist under the rotation (cutover-a F2).
3. **The review set itself differs from legacy**, because the selection ALGORITHM is replaced —
   priority-bands-over-a-segment → cursor-chained rotation over the introduced range. There is no
   flag-on parity to expect and none should be looked for.
4. **The second student in a colliding pair is refused** until NEED_TO_FIX 18 lands (`presentation_invalid`,
   recoverable by recomposing). If that is still open at rehearsal time, it is EXPECTED.

## 5. PASS / FAIL — explicit, so the bar cannot move afterwards

**PASS requires ALL of:**
- **P1** Every seeded stratum in §3 completes a full day end to end, flag ON, in a real browser.
- **P2** Zero NEW console errors or warnings versus the flag-off baseline captured in the same run.
- **P3** Every refusal a student reaches renders a human-readable reason. **A blank screen or a raw
  error object is a FAIL**, even if the underlying refusal is correct.
- **P4** Zero writes to any 26SM document. Verified by a read-only sweep before and after, not asserted.
- **P5** Every difference observed is on the §4 list. **An unlisted difference is a FAIL** until it is
  explained and either added to §4 with justification or fixed.
- **P6** The engine's own evidence is green in the same window: engine lap, the cutover fixture suites,
  and the rules matrix against the DEPLOYED ruleset.

**FAIL — any one of:** a student stranded with no path forward · a score that disagrees with the rows it
was computed from · an attempt written under a document id the server did not derive · a graduation that
includes a word the server never presented · any 26SM write.

**NOT A FAIL, and must not be treated as one:** the §4 expected differences · a refusal that renders
correctly · a student needing to recompose once after `grade_unusable`.

## 6. WHAT THIS SPEC DOES NOT COVER

Stated plainly so its scope is never overread:
- **The mass-wall event** (§1). Carried by monitoring + kill switch; monitoring is unspecified → O1-6.
- **The Playwright suite's scope, owner and pass bar** — the other half of O1-5, blocked on the UI
  existing. → queue `playwright-suite`.
- **DF2-34's regression signal**, whose staged-rollout half was dissolved by R2-5/R2-24 with no
  replacement authored. O1-5 requires it re-derived; it is not derived here. → queue `df2-34-regression-signal`.
- **Load, latency and cost.** Typed tests call the live AI grader and bill real tokens; a looping suite
  would meter against production.
