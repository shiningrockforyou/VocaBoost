# Run L — DESIGN SPEC v2 (for Codex review before implementation)

**v1 → v2:** v1's discriminators tested the wrong layer; v2 (Codex round 2) fixes four blockers — L1 review is
impossible on Day 1, D1 needs the exact reconciliation trigger, D2/D3 aren't valid Run-L gates. **Clean core:
L1-T, L1-M, L2/D1 + L1-R** (retake legacy-integrity). Review the design; no reimplementation until blessed.

## 1. What Phase 1 `LIST_SCOPED_RECON` gates (corrected)
The flag **changes evidence selection and the resulting class_progress / system_log writes; it creates no
`list_progress` storage** (that's a later phase). It is NOT "read-only." Gated behavior:
- **Anchor / evidence is list-scoped** — `getMostRecentPassedNewTest` (`db.js:3250`), `getRecentAttemptsForClassList`
  (`db.js:3121`): flag-ON selects evidence across **any class** for the list; flag-OFF is class-scoped.
- **CSD non-demoting** `Math.max(stored, anchor)` (`progressService:228`) under flag.
- **Review pairing** `getReviewForDay` (`db.js:3398`); **cross-class same-day gate** at Day-2+ review completion
  (`studyService:1311`); **orphan cleanup** log-only under flag (`:200`); **day-guard** (`studyService:587`).

## 2. Clean Run-L core (the only cases that certify)
**[Codex correction] Two roles — do NOT claim all cases discriminate the flag:**
- **L1-T / L1-M / L1-R are regression SMOKES** — they prove the flag-OFF result is the correct LEGACY result;
  flag-ON would produce the *same* result for these single-class cases, so they are not discriminators.
- **L2 is the SOLE negative-control DISCRIMINATOR** — the only case where flag-ON would differ detectably.
Run L asserts the flag-OFF side; Run S (flag-on build) asserts the other side. Run L alone ⇏ "the fix works,"
only "the dormant code changed nothing while off."

**"Fresh" (L1-T/M/R) means, verified in the bound `--pre`, ZERO of ALL of:** `class_progress`, `session_states`,
`attempts`, AND list-specific `study_states` for {persona, L}. (CSD=0 alone is insufficient — old mastery /
study_states can change word allocation, so TWI wouldn't be a clean Day-1 delta.)

### L1-T — exact typed Day-1 completion
Fresh Day-1 persona (fresh per the definition above), **exact** class C + list L (typed mode). Sequence: Start new words → study →
new-word **test only** (NO review — Day 1 has none) → PASS. Assert:
- visible **Day increments 1→2** (badge; = csd 0→1) and visible **Words Introduced** rises to the allocated count;
- the **exact** `class_progress/{C}_{L}` doc: `currentStudyDay` +1, and `totalWordsIntroduced` increased by the
  **actual allocated range** `nwei − nwsi + 1` from the attempt (NOT blindly +pace — may be capped at list end);
- exactly **one new `new`-type attempt** for {C,L}, `passed=true`, complete anchor (`nwsi`,`nwei`,`testId`,
  `wordsIntroduced` all present/valid), `submittedAt` within [driver.start, driver.end].

### L1-M — exact MCQ Day-1 completion
Identical to L1-T with an MCQ-mode class+list. (Typed AND MCQ both required.)

### L1-R — retake path legacy-integrity (fail → retry → pass), typed  [added per CS-behavior review]
Fresh Day-1 persona (fresh per the definition above), exact class C + list L (typed). Sequence:
1. Start new words → new-word test, deliberately **FAIL once** (submit genuinely-wrong/blank answers).
2. **[Codex] Intermediate assertion BEFORE retry** — the final CSD/TWI cannot prove the failed attempt never
   *temporarily* advanced progress (a transient bump the pass would then mask). So between fail and retry assert:
   the **retake-required** state appears; a normal success verdict is **absent**; the Dashboard still shows
   **Day 1 / ZERO Words Introduced**; **capture a screenshot**. Only then resume.
3. Retake → **PASS**.
Assert the exact LEGACY result:
- visible Day 1→2 (csd 0→1); Words Introduced = the allocated count of the **PASSED** attempt;
- exact `class_progress/{C}_{L}`: `currentStudyDay` +1; `totalWordsIntroduced` += `nwei − nwsi + 1` of the PASSED attempt;
- the bound post-snapshot for {C,L} contains **EXACTLY ONE failed and EXACTLY ONE passed** `new`-type attempt
  (not merely "≥1 failed"); the failed attempt did NOT drive CSD/TWI and is NOT the anchor; the pass has a complete anchor.
- **Scope honestly:** on a SINGLE class this is a **legacy-INTEGRITY** check — class-scoped and list-scoped
  evidence coincide, so it is NOT a flag discriminator. It proves the dormant Phase-1 anchor-selection did not
  disturb the common real-world retake path. The flag-relevant CROSS-CLASS version is **Run S overlay #2**.

### L2 / D1 — cross-class anchor NON-promotion (session-entry negative control, NO study)
**Fixture (built + VERIFIED forward-only BEFORE `--pre`, not during the measured run). [Codex — must prove the
flag-ON COUNTERFACTUAL, else L2 passes trivially when flag-ON would also leave B unchanged]:** the `--pre`
verifier must establish ALL of:
- **A holds a valid WINNING anchor** — a passed `new` attempt with a complete, position-bearing anchor
  (`nwei`/`nwsi`/`testId`/`wordsIntroduced` valid), at day ≥ 2 (not merely "A shows a high day");
- **A and B assign the SAME list L**;
- **B has NO progress and NO attempts for L** (fresh);
- **the computed list-scoped result ≠ B-local zero** — i.e., A's anchor position is > 0, so under flag-ON B
  WOULD promote. If A lacks a usable anchor, the counterfactual is void and L2 is INVALID (not a pass).
**Measured run:** select **exact class B + list L**; **visibly assert B is the selected class/list** → click
**Start/Continue → reach the session screen** (fires `getOrCreateClassProgress` for B) → **leave WITHOUT
submitting** → return/reload Dashboard → **re-assert the saved focus is still B** BEFORE reading its values.
Then assert:
- visible **Day** and **Words Introduced** are **B-local** (Day 1 / 0 words) — NOT promoted from A;
- the **exact** A `class_progress` doc unchanged; B's doc, if now created, is **B-local** (csd 0);
- **ZERO new attempts** for the persona (view-only); A's and B's attempt counts unchanged.
Flag-ON would promote B to A's list-scoped anchor (proven possible by the counterfactual) — the detectable difference.

**Dropped from the gate (Codex):** D2 (list-scoped gate fires only at Day-2+ review completion; no proven pure-UI
path without B's own attempt) and D3 (orphan-delete is destructive + conflicts with the no-review-deletion
acceptance condition; orphan persona reserved for Run S). D3 kept ONLY as a separate documented **legacy canary**,
never part of Run-L certification.

## 3. Binding + integrity
- **Per-case activity binding:** L1-T / L1-M / L1-R **require** their new-word attempt(s) (exact class+list, in
  window); **L2 requires exactly ZERO new attempts**. A generic "any new attempt" is wrong.
- **Exact case set required:** `{L1-T, L1-M, L1-R, L2}` all present, each with a real fixture — a missing case
  ⇒ FAIL, never silent skip.
- **[Codex] Precise anchor validity:** a valid anchor requires `wordsIntroduced` to be a **positive integer**
  EQUAL to `nwei − nwsi + 1`; and the post `totalWordsIntroduced` **delta must equal that same value**. (Not
  just "fields present".)
- **Tri-artifact binding:** each persona → its class(es) → list → expected transition, bound across
  `pre`/`activity`/`post` by runId; FAIL on persona/class/list set mismatch, missing roster uid (no silent omit),
  out-of-order timestamps.
- **`--pre` clears stale `activity` + `verdict`** for the runId (not just overwrites `pre`).
- **Per-document** CSD/TWI (never max-across-docs, which hides a single-doc regression).
- **Scoped log deltas:** system_log deltas filtered to the run's **exact users** (and class/list where present)
  so unrelated cohort activity can't fail the run. Flag-ON-only types = `orphaned_attempt_flagged`,
  `day_guard_rejected_session_cleared`, `day_guard_session_clear_FAILED` (drop `csd_anchor_*` — not flag-ON-only).
- **Contamination check (not a discriminator, still asserted):** ZERO `list_progress` docs for the personas.

## 4. Anomalies, evidence, build identity
- **Bound anomaly artifact:** machine-readable `runL_anomalies_<runId>.json`; the `--post` verdict FAILS on any
  non-allowlisted page error / console error / request failure / unexpected dialog / permission or missing-index
  error / rebuild ("session refreshed") state. `allDriven` alone must not gate.
- **Screenshots + visible-action step log** per case (policy-required): before/after per L1 case; B-entry and
  post-reload for L2.
- **Build identity:** record the owner-supplied deployed client build id/commit **consistently across all three
  artifacts (`pre`/`activity`/`post`)** and FAIL if they disagree — while stating explicitly that this is an
  **attestation**, not runtime proof of which bundle is live (invariant testing proves expected legacy behavior,
  not deployment identity).

## 5. Status
DESIGN COMPLETE. Codex round-4 pre-committed to bless FOR IMPLEMENTATION conditional on the L1-R intermediate
assertion + exactly-one-failed/one-passed count — both now folded in. Supersedes v1 and the prior
`lsr_runL*.mjs`. Ready to implement (implementation will get its own review pass before any run).
