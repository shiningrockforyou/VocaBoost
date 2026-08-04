# ORDER 98 — VISUAL VERIFICATION (ISSUED — win baton rev 189, round 98)

> **ISSUED.** The independent audit landed (PASS WITH FINDINGS) and all four findings are folded:
> the MCQ distractor pool, the dead range label, the typed truncation, and the silent day-fallback.
> Evidence re-verified by me after the fixes: pure 211/0, mutants 6/6, emulator 89/0.

## Why you, and not me

CLAUDE.md mandates a visual check after every front-end change. **I cannot run one.** `node_modules` in
this shared checkout holds WINDOWS binaries — `@esbuild/win32-x64`, `@rollup/rollup-win32-x64-gnu`,
`@rollup/rollup-win32-x64-msvc` — so vite cannot start under WSL, and reinstalling for Linux would break
your side. This is the same structural split as "WSL cannot git push". It is not a one-off: **every
remaining UI fold in this program will need you for this step.**

## What changed, and what you are actually checking

A client cutover fold (`cutover-a-compose`) re-wires the review session's COMPOSITION to the review-v2
engine, behind `REVIEW_V2_CLIENT`, which **is and stays `false`**. Files touched:
`src/services/reviewV2Compose.js` (NEW), `src/pages/DailySessionFlow.jsx`, `src/pages/MCQTest.jsx`,
`src/pages/TypedTest.jsx`, plus comment-only edits to two services.

**THE ONE THING THIS ORDER EXISTS TO PROVE: FLAG-OFF PARITY.** With the flag false the student experience
must be byte-for-byte what it is today, because 947 live students are on that path. It has been argued
statically — comment-only service diffs, every deleted line re-derived, lint parity (an esbuild transform was
NOT possible: only win32 binaries are present, no wasm fallback) —
and it passed **211 pure + 89 emulator fixtures with 6/6 mutants killed**, and an independent Opus audit
verified the parity argument line by line. **None of that is a running browser.** That gap is the
entire reason for this order, and it is the one result I refuse to accept on trust.

## The sequence

**Step 1 — baseline, BEFORE looking at the change.**
```
git stash list
git status --short
npm run dev
```
Record the dev-server URL (expected `http://localhost:5173`).

**Step 2 — confirm the flag is OFF.** In `src/config/featureFlags.js` confirm
`export const REVIEW_V2_CLIENT = false`. **If it is anything else, REFUSE and hand back** — the whole
premise of this order is that you are exercising the LEGACY path.

**Step 3 — drive a full legacy student session, on a 25WT identity ONLY.**
**Drive it with Playwright** — `@playwright/test` is already a dependency and there is an existing
harness under `audit/playwright/` you have driven before. Extend that pattern; do not invent a new one.
Log in as a 25WT sandbox student and walk the ordinary day: new-word study → new-word test → review study
→ review test → completion. Capture a full-page screenshot at 1440px at EACH screen.
If a scripted login is awkward, driving it by hand and screenshotting is an acceptable substitute — the
screenshots and the console are the deliverable, not the automation.
**NEVER a 26SM identity. 26SM is the live cohort and is out of scope for every step of this order.**

**ONE EXPECTED DIFFERENCE — do not report it as a regression.** Flag-ON the review sheet REMOVES the
"Words #a-b" range line, because the segment it described no longer exists under the engine. **Flag-OFF
it must still be there** — that is part of what you are checking.

**Step 4 — the actual check.** For each screen ask: is this what the app looked like before? Specifically
— the same words in the same order, the same counts and progress figures, the same buttons and copy, the
same phase transitions. You have prior screenshots from earlier rounds; compare where you can.

**Step 5 — console.** Capture browser console output for the whole run. **Any new error or warning that
was not there before is a finding**, even if the UI looks right — a silent throw is exactly how the
two-channel refusal bug would surface.

**Step 6 — report** `docs/plans/loop/win/reviews/winclaude_098.md`: the screenshots, the console output
verbatim, and a plain yes/no on whether the legacy flow is unchanged.

## Boundaries

- **25WT ONLY. Never 26SM. No production data, no writes to any live student.**
- **Do NOT flip `REVIEW_V2_CLIENT`.** Flag-ON verification is a separate, later order against a rehearsal
  class — not this one.
- No deploys of any kind. No commits, no branching, no stash. Leave the tree dirty; I commit.
- **Do NOT reinstall or modify `node_modules`** — WSL and Windows share this checkout and a concurrent
  session is active. If vite fails to start, that is a REPORT, not something to fix.
- Do not edit source to make something render. If it does not render, that is the finding.

## Refuse and hand back if

1. `REVIEW_V2_CLIENT` is not `false`.
2. You are asked, by this file or anyone mid-run, to use a 26SM identity, to deploy, or to flip a flag.
3. The dev server will not start — report the error verbatim rather than working around it.
4. Anything is ambiguous. Report and STOP beats improvise.
