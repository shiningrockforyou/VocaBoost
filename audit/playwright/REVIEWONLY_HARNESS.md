# Review-only Phase-1 acceptance harness — runbook

Certifies the review-only-day completion fix (`docs/plans/PLAN_review_only_day_completion.md`) end-to-end.
Design: `docs/plans/PLAN_reviewonly_playwright_audit.md` v2 (Codex GO). **LOCAL-ONLY — runs against
`npm run dev` on `localhost:5173`, NEVER the live site.**

## Files
| File | Role |
|---|---|
| `lsr_ui.mjs` (modified) | shared browser verbs + **import-time fail-closed BASE guard** (default `http://localhost:5173`, throws unless localhost http) |
| `lsr_reviewonly_fb.mjs` | Admin-SDK data layer: sandbox guard, read-only oracles, seeds, pre-verifier, reset, snapshots |
| `lsr_reviewonly.mjs` | E2E UI matrix (RA1–RA9) + fail-closed artifact-bound manifest |
| `lsr_reviewonly_whitebox.mjs` | SEPARATE white-box matrix (W-RA3-gate/W-RA4/W-RA4b) — `page.evaluate` exception for the un-drivable gate-negatives |

## Preflight (in order)
1. **Dev server:** `npm run dev` (Windows env with platform-matched node_modules), confirm
   `curl -sf http://localhost:5173/` returns the SPA shell. (Also proves the fixed code compiles under Vite.)
2. **Env:**
   ```
   export LSR_BASE_URL=http://localhost:5173          # REQUIRED — the base guard rejects anything non-localhost
   export LSR_AUDIT_PW=…                               # or audit/playwright/.lsr_secret.json {"password":…}
   export LSR_TEACHER=lsr_teacher_02@vocaboost.test    # sandbox teacher (has cloned lists in lsr_lists.json)
   export SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@vocaboost.test,…   # >=1 sandbox students (one per scenario ideal)
   export LSR_TIER=CORE                               # optional — which cloned tier list to use (default: first)
   export LSR_BUILD_ID=$(git rev-parse --short HEAD)
   export PLAYWRIGHT_BROWSERS_PATH=…                  # your Chromium cache
   ```
3. **Firestore egress preflight (read-only, sandbox-only):** the runner's first Admin read confirms egress; a
   `csd_anchor_invalid`/`csd_implausible`/`get()` failure surfaces as INVALID.

## Run
```
NODE_PATH=/app/node_modules node audit/playwright/lsr_reviewonly.mjs            # UI matrix (RA1–RA9)
NODE_PATH=/app/node_modules node audit/playwright/lsr_reviewonly_whitebox.mjs   # white-box matrix (W-RA*)
```
Subset: `RO_SCENARIOS="RA1 RA6 RA9"` / `ROWB_SCENARIOS="W-RA4b"`.

## What certifies
- Each runner exits **0 only if its matrix is ALL-CLEAN** (every scenario PASS, no fatal app-health signal),
  else exit 1. `INVALID` (precondition not built / server down / base-guard trip / sandbox-guard trip) is NOT a
  pass. Manifests: `findings/reviewonly_accept_manifest_<runId>.json` + `findings/reviewonly_whitebox_manifest_<runId>.json`,
  each bound to `runId` + `gitHead`/`gitDirty` + `base` + per-scenario `{studentUid,classId,listId}` + pre/post hashes.
- **Phase 1 is certified only when BOTH matrices are all-CLEAN.**

## Safety (enforced, not by convention)
- **BASE guard** (import-time, `lsr_ui.mjs`): only `http://localhost`/`127.0.0.1` — the live site can never be a target.
- **Identity guard** (runner start): `LSR_TEACHER`/`SL_STUDENTS` must match `/^lsr_.*@vocaboost\.test$/`.
- **Sandbox triple guard** (`assertSandboxTriple`, before EVERY seed/reset write): the class must be `25WT`-prefixed
  with the list assigned. NEVER `26SM` / real students. Oracle reads are strictly `.get()`.

## First-run calibration (verify — flagged assumptions)
- **A1** `getListWordIds` (RA6): confirm the words-collection path (`lists/{listId}/words` vs top-level `words`).
- **A2** `WORD_STATUS.MASTERED` string == `'MASTERED'` (studyTypes.js) for `seedAllMasteredTerminal`.
- **A3** `seedFix9Anchor` (RA9): confirm the seeded passed-`new` attempt yields `startPhase===REVIEW_STUDY` on re-entry.
- **White-box injection SITE** (W-RA4/W-RA4b): confirm the crafted `dailySessionState` survives from inject
  (on the `/typedtest|/mcqtest` route, after navigateToTest, before Submit) to `completeSessionFromTest`; the
  readback + post-submit re-read guard against an overwrite (→ INVALID, never a false PASS). `startPhase` string
  value for "new" (`new_words_study`) must match `SESSION_PHASE.NEW_WORDS_STUDY`.
- Locator/copy for the §5 terminal ("You finished the list!"/"List complete") and the retake-gate text may need
  the usual first-run tuning against the live DOM.
