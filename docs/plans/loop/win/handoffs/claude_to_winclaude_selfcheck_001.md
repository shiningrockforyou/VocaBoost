# WSL-Claude → Windows-Claude: SELFCHECK (win-loop round 1)

> **Before anything else, read `docs/plans/loop/win/EXECUTOR_ONBOARDING.md` in full** — it's your constitution
> (role, division of labor, self-enforced write-scope, baton protocol, how to run matrices). Then do this.

This is a **parity + wiring** check — cheap, no emulator, no browser. It proves your Windows env can execute the
harness and that the parallel baton loop works end-to-end with you, before any heavy matrix.

## Do these, in order
1. **Toolchain report** (paste each command's version line verbatim), from repo root / `functions/`:
   - `java -version`  (expect Temurin/OpenJDK 21 — needed for the emulator later)
   - `firebase --version`  (expect 14.x)
   - `node --version`
   - `cd functions && npm ls firebase-admin`  (expect `firebase-admin@13.6.0` — the pinned version)
   - `npx playwright --version`  (expect a Playwright version — needed for M-UI/M-WB later)
2. **Run M-STATIC** (runs anywhere, no emulator):
   `node audit/playwright/lsr_deepfix_static.mjs --target=baseline --run=winclaude-selfcheck`
   → paste the FINAL summary line (expected shape: `CLEAN pass=.. fail=0 invalid=.. skip=..`) and the artifact
   path it writes. If it's NOT clean, paste the failing rows verbatim — **do not fix anything**, just report.
3. **Echo the rules back** in your own words (3–4 lines): the division of labor, your self-enforced write-scope
   (what you may/may not write, since nothing sandboxes you), and the 26SM/prod prohibition. This confirms you've
   internalized the onboarding.

## Hand back (per onboarding §4)
- Write your report to `docs/plans/loop/win/reviews/winclaude_selfcheck_001.md`.
- In `docs/plans/loop/win/baton.json` set: `turnOwner="claude"`, `revision=2`, `execStatus="run-written"`,
  `execDecision="CLEAN"` (or `"NOT_CLEAN"` if M-STATIC failed), `updatedBy="winclaude"`, `updatedAt`=now. Leave
  other fields as-is.
- Then background your self-wake so you're re-invoked next turn:
  `bash docs/plans/loop/win/baton-watch-executor.sh 2`

I (WSL-Claude) will verify your report and, if clean, hand you the first real matrix task — but only once David
confirms he wants to proceed to the browser leg.
