# Run S — DESIGN SPEC (STUB, design-only) — flag-ON behavioral suite

**Status:** DESIGN STUB. Nothing implemented. **Gated on the owner deploying a `LIST_SCOPED_RECON=true` build +
the 7 composite indexes ENABLED.** Where Run L proves *"the dormant code changed nothing while OFF,"* Run S
proves *"the NEW list-scoped behavior is correct and survives realistic CS messiness."*

## Governing principles
1. **One behavior per persona.** Combining blank-retakes + switching + reloads + stale tabs in one case makes a
   red un-triageable. Each overlay = one isolated behavior on its own persona/fixture.
2. **Exact oracle per overlay — write it BEFORE implementing.** Run L's oracle is "identical to legacy, exact
   CSD/TWI." Run S's oracle is the **new intended transition**, derived from the plan's student-owned rules
   (`PLAN_list_progress_persist.md`). Negative properties ("no duplication", "never the anchor") are necessary
   but NOT sufficient — a subtly-wrong impl can satisfy them. Each overlay needs the exact expected
   per-document CSD/TWI + phase, like L1. **This spec is not implementation-ready until each overlay's oracle
   is filled in.**
3. **Data-layer binding** (same rigor as the F02/F03 acceptance harness): read-only pre/post bound by runId;
   assert the exact class/list/attempt transitions, not just UI text. "failed→passed" counts ONLY if the bound
   post-snapshot contains BOTH attempts in the expected class/list AND only the passed attempt influenced
   CSD/TWI.

## Overlays (CS-derived; oracle = TODO where marked)
### S-1 — Partial-day switch  **[FLAGSHIP — the reason the flag exists]**
Pass new words in class A → **leave before review** → switch to class B (same list) → resume. This is the direct
fix for the class-change **day-reset** cluster (이주헌 / 박주하 / 손진욱).
- **Oracle (TODO, exact):** B resumes the CORRECT remaining phase (review pending, not a fresh Day-1); words are
  NOT re-introduced (no duplicate `new` attempt); the list position is consistent across A and B; exact
  per-doc CSD/TWI. This is the gating S case — highest-precision oracle required.

### S-2 — Failed-then-passed, cross-class
Fail in A → retry & pass in A → then enter via B. Only the **passed, position-consistent** attempt may drive
reconciliation (the flag-relevant version of Run L's L1-R).
- **Oracle (TODO):** reconciliation across A+B selects the passed attempt as the anchor; the failed attempt is
  present but inert; B reflects the correct list position.

### S-3 — Accidental blank/low retake
Submit a genuine blank/low attempt before a later pass. The failed attempt must **never** become the anchor or
block the valid pass (박시준).
- **Oracle (TODO):** anchor = the pass; CSD/TWI from the pass; the blank attempt inert.

### S-4 — Rapid A↔B switching (view-only)  **[oracle CORRECTED]**
Repeatedly enter/leave both classes on the same list WITHOUT completing work.
- **Oracle (CORRECTED — do NOT assert "no advance"):** viewing must **not mutate/increment** progress or create
  attempts. BUT under flag-ON, entering B **legitimately DISPLAYS the reconciled list-wide position** (may be
  higher than B's old class-scoped value) — that IS the intended fix (no class-change reset), NOT a bug. So
  assert: no new attempts, no CSD demotion, no data mutation from mere viewing; AND the displayed position is
  the consistent reconciled list position. (The naive "position must not advance from viewing" would fail the
  fix for working.)

### S-5 — Reload boundaries
Reload during study / before new-word submission / after new-word pass before review / on results-rebuild
screen — each must resume the correct **class, list, position, phase**.
- **Boundary note:** reloads that stress **grading idempotency** (the 06-22 / 06-28 grading FAILURES) belong to
  the **separate grading-concurrency audit**, not Run S. Run S owns reloads that test class/list/phase RESUME;
  don't double-own the same incidents.
- **Oracle (TODO):** exact resumed phase + no duplicate attempt + no CSD/TWI corruption per boundary.

### S-6 — Saved-focus variation  **[protects F02 × reconciliation]**
Two dual-class personas: one with NO saved `primaryFocusListId`, one with an explicit saved focus. Protects the
interaction between the F02 default-list fix and reconciliation.
- **Oracle (TODO):** the F02 saved-preference / progress-preference resolution and the list-scoped reconciliation
  agree — no case where the shown list and the reconciled position disagree.

## Deferred (noted so it doesn't fall through the cracks)
- **Reset / epoch behavior** (progress-reset-then-restudy on a shared list; dual-class/reset tickets). Owned by
  **grading concurrency Phase 2** (`resetProgress`), so likely OUT of Phase-1 Run S scope — deferred, not dropped.

## Keep OUTSIDE Run L/S (separate audits — unrelated to the flag or not honestly UI-inducible)
grade-token/nonce mismatch; Retry-Save network failure; frozen in-app-webview modal; teacher grade
override / challenge reversal. (Grading rework / teacher-override suite / platform.)

## CS behavior → coverage (reference)
Partial-day leave→resume: S-1/S-5 · fail-retry-pass: L1-R + S-2 · blank retake: S-3 · class-switch same list:
S-1 · two classes/devices same day: S-1/S-4 · stale session: S-5 + session audit · reload/resume: S-5 + grading
audit · teacher add/remove list: F02/F03 suite (done) · failed-before-pass history: S-2/S-3 · threshold-edge
93/92: L/S overlay, root fix (F01 `newWordRetakeThreshold`) separate · manual/teacher-override pass: teacher-
override suite · malformed/manual anchor: Run S natural persona only.

## Next
Fill each overlay's exact oracle from the plan's intended semantics → Codex design review → implement (bound,
anomaly-failing, screenshotted) only after the owner ships a flag-ON build. Run L is the prerequisite gate.
