# Codex prep check — REVIEWONLY_AUDIT_PREP round 1

## Verdict

NOT_READY.

The local Windows app/browser stack is mostly ready, but the required Firebase Admin read-only preflight did not succeed. Do not run the review-only audit until Firestore egress/auth is confirmed.

## Results

### Node/npm/dependencies

READY.

- Node: `v24.11.1`
- npm: `11.6.2`
- `node_modules` exists
- Windows-native Vite/Playwright binaries exist:
  - `node_modules/.bin/vite.cmd`
  - `node_modules/.bin/playwright.cmd`
  - `node_modules/@esbuild/win32-x64`
  - `node_modules/@rollup/rollup-win32-x64-msvc`

### App compile

READY.

`npm run build` succeeded. The changed app files compile.

Only standard Vite warnings appeared:

- large chunk warning
- dynamic/static import chunking warning for `src/services/db.js`

No compile errors in `studyService.js`, `DailySessionFlow.jsx`, or `Dashboard.jsx`.

### Local dev server

READY, with process-control caveat.

Sandboxed start attempts failed/hung, but the escalated start did bring up `http://localhost:5173`; the SPA shell returned HTTP 200. I then identified and stopped the listener:

- listener PID: `66680`
- process: `node`
- stopped successfully

So Vite can serve the fixed working tree locally, but actual audit execution will need controlled unsandboxed process launch/cleanup.

### Playwright Chromium

READY if unsandboxed.

Sandboxed Chromium launch failed with `spawn EPERM`. Retrying with escalation succeeded:

```json
{"ok":true,"browser":"chromium"}
```

So Playwright is installed and browser binaries are present, but actual browser-driving commands will need unsandboxed execution in this interface.

### Firebase/Admin SDK prerequisites

FILES PRESENT.

- `scripts/serviceAccountKey.json` exists
- `audit/playwright/.lsr_secret.json` exists
- `audit/playwright/seeded_accounts.json` exists

Secret contents were not printed.

### Firebase/Admin read-only egress

BLOCKED / NOT VERIFIED.

A read-only Admin SDK preflight was attempted with escalation and no writes:

- first attempt timed out at the tool level
- second attempt used an application-level 12s timeout and returned:

```json
{"ok":false,"message":"app-timeout-12000ms","code":null}
```

This means this Codex environment has not proven it can reach Firestore. Because the review-only audit depends on sandbox fixture reads/writes and data oracles, this is a run blocker.

## Current blockers

1. Firebase Admin / Firestore egress has not been confirmed.
2. Playwright and Vite process launch require unsandboxed execution from this interface.
3. The review-only harness still needs to be built before an actual audit run.

## What is ready

- Windows Node/npm dependency shape
- production build compile
- local Vite serving capability
- Playwright browser installation
- service-account/secret files present

## Recommendation

Do not run the audit yet.

Next required step is a successful sandbox-only Firestore Admin preflight, for example a bounded read of a known `25WT`/`lsr_*` sandbox document. If that continues to time out from Codex, Claude or the user should run the Firebase preflight in the environment that will execute the harness, and Codex can still review the resulting artifacts.

## Final

NOT_READY.
