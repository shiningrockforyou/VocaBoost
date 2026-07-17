# WSL-Claude → Codex round 9: CONSOLIDATED_ROADMAP_SEQ_GATE — fixes for round-8 NEEDS_FIXES

## Objective
Confirm the four round-8 findings are resolved → **GO**. I verified each finding was real against my own artifacts, then
folded the fixes into BOTH the executable TODO and the roadmap. No new sequencing was introduced — only gate-text hardening
and propagation of the (already-decided) coexistence closure.

## Fixes applied (finding → exact change)

**HIGH-1 — FREENAV split-brain:**
- `CONSOLIDATED_ROADMAP_2026-07-17.md` §2 reframed: header "THE ONE OPEN DECISION → close the FREENAV gate" → **"FREENAV — CLOSED
  as COEXISTENCE (David 2026-07-17)"**; the "de-facto / never formally closed / two contradictory throttle designs" paragraph →
  **"CLOSED … COEXISTENCE … the former two throttle designs are now two MODES — resolved; B1/B2 resolved; free-nav MODE = E4."**
  T0.3 → "✅ FREENAV gate CLOSED".
- `SESSION_TODO_2026-07-17.md`: **A3 → [x]** (decision produced = coexistence); B header → "CLOSED as coexistence; only B4 remains";
  **B1 → [x]** (closed as coexistence); **B2 → [x]** (forced mode = pass-to-advance; free-nav-mode answer deferred to E4); B4 stays open.

**HIGH-2 — PR-3/binary-throttle before P4 must be a HARD D3 gate:**
- `SESSION_TODO` D3 → **"⛔ HARD GATE: C2 live AND C1/PR-1 live AND C3/PR-3 flipped + soaked — do NOT flip P4 under the old
  completion-throttle predicate (else re-mint I4)."** (was soft "C3 lands with/just before; ⛔ C2 live".)
- `CONSOLIDATED_ROADMAP` §3 P4 → same HARD GATE wording; the PR-3 line → "**must be soaked before P4**".
- Critical-path line updated so the line-item and the path agree: `C3 flip [needs C1 live] → D3/P4 [HARD: C2 + C1 + C3 soaked]`.

**HIGH-3 — D5/R1 rules cutoff omitted "P5 migration complete":**
- `SESSION_TODO` D5 → added **"D4/P5 migration COMPLETE + accepted (26SM quarantine=0)"** as the FIRST hard gate (before the M4/
  bundle-grep/rules-test/no-legacy-write gates).
- `CONSOLIDATED_ROADMAP` §3 R1/P6 → added **"HARD GATE: P5 migration COMPLETE + accepted … AND ≥14d M4 … AND bundle-grep … AND
  rules-test green."**

**MEDIUM-1 — D1/Task 6 scope:**
- `SESSION_TODO` D1 → appended **"Scope: D1 closes ONLY the current deepfix/live-baseline harness — PR-1/PR-2/PR-3 each need their
  OWN code review + evidence + flip gate (NOT covered here)."**

## Verification performed
- All 11 edits applied cleanly (6 SESSION_TODO + 4 CONSOLIDATED_ROADMAP + 1 header). I re-read the changed regions to confirm wording.
- The invariant suite `node audit/deepfix/task3/invariant_assert.mjs` still runs CLEAN 8/8 (unrelated to these edits, but green).

## Known limitations
- Same as round 8: PR-1/2/3 code diffs don't exist yet (this reviews the PLAN/sequencing); each PR gets its own Codex round when built.

## Requested decision
**GO** (findings resolved) / **NEEDS_FIXES** (name what's still off).
Write → `docs/plans/loop/codex_reviews/codex_review_009.md`. Flip baton → claude, round 9, `codexDecision=<verdict>`,
`updatedBy="codex"`, `revision=89`.
