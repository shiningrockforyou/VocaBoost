# WINCLAUDE round 45 — D3.5 CRITIC PASS R2 (confirm the fold, feasibility lens) — ✅ FEASIBLE

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`. Verify + report only.
- **taskId:** `WINCLAUDE_D35_CRITIC_R2` · **execDecision:** `FEASIBLE` (my round-1 items folded faithfully; no surviving gap; no NEW build blocker from my lens — the remaining tier-3 items are effort, now correctly scoped).

## My round-1 items — folded FAITHFULLY (confirmed against the plan text)
- **F-a** (MCQ-vs-Typed is the biggest tier-3 lift, not `joinClass`) ✓ · **F-b** (seed must render → `INVALID_PRECONDITION`) ✓ · **F-c** (AI-grader hard cost cap, prefer MCQ) ✓ · **F-d** (races B4/B6/B11/B12/B18/F13/F18 as concurrent-callable; B20 webview→E5) ✓ · **F-e** (callable 8–12, browsers ≤3–4 box-bound, App-Check not a blocker, tier-3 longer/flakier) ✓ · **F-f** (base at `scripts/cs/…`, `scripts/audit/` absent) ✓.
- **S3** (never write `lists/{realListId}`; listId↔guard tension resolved — guard fail-closes on WRITE targets, real listId read-only exempt or cloned) ✓ · **S5** (sandbox-uid segregation; sweeps exclude sandbox uids; emulator for the cohort) ✓.
- **S2 improved:** the teacherId-rewrite I confirmed is preserved, AND Fable-2's addition is correct — the base `...a` spread means **`testId` (encoding the real classId) is NOT rewritten**; extending the rewrite map to `testId` + session/study-state ids is the right fix. I concur; a genuine catch I missed.

## S1 (porous guard) — I VERIFIED it; it's a real safety BLOCKER (endorse the fix)
Read `lsr_deepfix_emu.mjs:69`: `assertSandboxTarget({classId, listId} = {})` checks **only** classId/listId, **each gated on `!= null` (absent ⇒ skipped)**, and **never checks uid** → `assertSandboxTarget({})` returns `true`. Confirmed: it fail-closes only on a PRESENT non-sandbox classId/listId; a write with a real uid + absent classId slips through. Safe on tiers 0/1 only because `detectEmulator` refuses prod — which does NOT backstop tiers 2/3. **The S1 fix (a prod-seeder guard: `uid ∈ this-run minted-sandbox allowlist` AND classId sandbox AND fail-closed on ABSENT fields, run per-doc on POST-rewrite values, incl. before list-wide `resetProgress`) is mandatory and must be built + unit-tested BEFORE any tier-2/3 prod write.** This supersedes my round-1 reliance on `assertSandboxTarget` as a rail.

## No SURVIVING gap; no NEW build blocker — but three concrete build items to keep visible (all already folded)
1. **Strict prod-seeder guard (S1 fix)** — the gating prerequisite; buildable (a stricter variant of the existing guard), must exist before prod writes.
2. **Client-state seeding layer (B23/B24)** — a NEW harness component (buildable via Playwright `addInitScript`/`page.evaluate` to inject `localStorage` recovery answers / `currentIndex` / `attemptDocId`+nonce / malformed payload before load). Feasibility caveat: it requires **reverse-engineering the client's localStorage schema** from `MCQTest.jsx`/`TypedTest.jsx` recovery logic — real effort + fragility, but doable.
3. **MCQ driver must handle the non-blocking confirm dialog (M5)** — the deployed empty-submit is a confirm-then-proceed-then-HOLD (not a blocking guard); my F-a MCQ driver MUST dismiss/accept that dialog or B3/B21/A2 hang. A concrete driver requirement, feasible.

## Cross-lens notes I endorse (not mine, but affect executability)
- **S4 (join containment):** builds directly on my r37 `joinClass` finding — after a UI join, assert the joined classId ∈ the run's created set + hard-stop on mismatch (a real class's `studentIds arrayUnion` is the hazard). Endorse.
- **M4 (F1/F2/F16 at CANONICAL=false):** the resolver is read-only/candidate-mode, so those assertions must check "candidate-logged + no canonical write + no crash," NOT "reconciled DOWN." My harness assertions must match the read-only behavior. Endorse.

## Verdict
From the executor "can this be built + run" lens: **FEASIBLE as folded** — my findings are captured, S1 is verified + correctly gated, and the remaining tier-3 build (strict guard + MCQ/typed drivers with dialog handling + seed-render verification + client-state seeding + multi-actor challenge) is substantial but buildable. **No surviving correction from my lens.** (Tier-3 wall-clock will still exceed the 1.5–2.5h estimate — plan for it.)

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_045.md`.
- `baton.json` → `turnOwner="claude" round=45 execStatus="run-written" execDecision="FEASIBLE" updatedBy="winclaude" revision=90`.
- Watcher re-armed at baseline 90.
