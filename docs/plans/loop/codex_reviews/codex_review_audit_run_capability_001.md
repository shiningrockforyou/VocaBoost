# Codex capability check — REVIEWONLY_AUDIT_RUN round 1

## Verdict

CAN_RUN_FULL_CONDITIONALLY.

This Codex environment is better positioned than Claude's WSL/9p environment: it is running in the Windows repo with Windows `node_modules`, and the local toolchain pieces are present. It cannot run the review-only audit immediately because the local dev server is not currently serving and the review-only audit harness itself has not yet been built.

## Checked locally

### Repo / fixed working tree

Present.

The working tree contains the uncommitted Phase-1 code changes in:

- `src/services/studyService.js`
- `src/pages/DailySessionFlow.jsx`
- `src/pages/Dashboard.jsx`

There are many other existing dirty/untracked audit files. That is not a run blocker, but the audit manifest must bind a git dirty marker because this is not a clean committed state.

### Node / npm

Present.

- Node: `v24.11.1`
- npm: `11.6.2`
- `package.json` has `dev: vite`

### Native dependencies

Present for Windows.

- `node_modules/.bin/vite.cmd` exists
- `node_modules/.bin/playwright.cmd` exists
- `node_modules/@esbuild/win32-x64` exists
- `node_modules/@rollup/rollup-win32-x64-msvc` exists

So Claude's Linux-on-Windows-binaries problem should not apply here.

### Playwright

Present.

- Playwright version: `1.58.2`
- Browser cache exists under `%LOCALAPPDATA%\ms-playwright`
- Chromium, headless shell, Firefox, WebKit, ffmpeg are present

### Firebase/Admin prerequisites

Likely present.

- `scripts/serviceAccountKey.json` exists
- `audit/playwright/.lsr_secret.json` exists
- `audit/playwright/seeded_accounts.json` exists

I did not print secret contents.

### Local dev server

Not currently running.

`http://localhost:5173` timed out. This is the immediate blocker to running local Playwright. It is not evidence that the environment cannot serve; it only means `npm run dev` is not currently active.

### Firestore egress

Not verified in this check.

A real Firebase Admin read/write probe would require remote network access and should be treated as a deliberate preflight, not silently run during this capability query. Given the service account file exists, this is likely viable, but it remains unconfirmed until a sandbox identity preflight is run.

## Current blockers to running now

1. The review-only audit harness described in `PLAN_reviewonly_playwright_audit.md` is not built yet. Existing `lsr_persona.mjs` still has the older blocked-day oracle comments/logic.
2. The local Vite server is not running on `localhost:5173`.
3. Firestore egress / Admin SDK access has not been confirmed from this environment.

## What Codex can run once ready

After Claude builds the harness and the user authorizes starting the local server, Codex should be able to run the full local audit stack from this Windows environment:

1. Start or verify `npm run dev` serving `http://localhost:5173`.
2. Run the import-time base guard / identity guard preflight.
3. Run the review-only UI matrix against localhost.
4. Run the separate white-box matrix.
5. Run read-only post-verifiers / matrix binding checks.

## Required preflight before actual audit run

- Confirm `LSR_BASE_URL=http://localhost:5173`.
- Confirm `http://localhost:5173` returns the SPA shell.
- Confirm `scripts/serviceAccountKey.json` can perform a minimal sandbox-only Admin read.
- Confirm all planned seed writes are gated to `lsr_*@vocaboost.test` and `25WT`.
- Confirm the harness exits nonzero on base-guard, identity-guard, Firebase, or partial-matrix failure.

## Final

CAN_RUN_FULL_CONDITIONALLY.

Immediate run status: CANNOT_RUN_NOW because the local dev server is down and the review-only harness has not been implemented yet.
