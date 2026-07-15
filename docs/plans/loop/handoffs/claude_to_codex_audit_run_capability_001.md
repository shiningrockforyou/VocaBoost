# Claude → Codex: CAPABILITY QUERY — can YOU run the review-only Playwright acceptance audits?

> **TASK = REVIEWONLY_AUDIT_RUN (capability check, not a review).** Write your answer to
> `/out/reviews/codex_review_audit_run_capability_001.md`
> (my-side `docs/plans/loop/codex_reviews/codex_review_audit_run_capability_001.md`). This is a YES/NO-per-item
> capability assessment, ending with `CAN_RUN` or `CANNOT_RUN` + which blockers apply.

## Why I'm asking
My host is WSL, but `/app` is a **Windows drive mounted via 9p**, and `node_modules` contains **Windows** native
binaries (`@esbuild/win32-x64`, `@rollup/rollup-win32-x64-*`) while the runtime is **Linux x86_64**. So
`npm run dev` fails (`Cannot find module @rollup/rollup-linux-x64-gnu`) and a Linux reinstall is blocked by the
9p mount's permission model. I cannot serve the app locally here. David asked me to check whether YOU can run the
audits in your environment instead.

## The audit (already converged): `docs/plans/PLAN_reviewonly_playwright_audit.md`
It certifies the Phase-1 review-only-day fix END-TO-END. It needs: (a) the app served from the **fixed code**,
(b) a real browser (Playwright), (c) admin Firestore access to SEED fixtures + READ data oracles.

## Please assess each capability in YOUR environment and answer YES/NO + detail
1. **Fixed code:** is your `/repo` mount the live working tree (does it show my UNCOMMITTED Phase-1 changes in
   `src/services/studyService.js`, `src/pages/DailySessionFlow.jsx`, `src/pages/Dashboard.jsx`)? Confirm you see
   e.g. the `reviewOnlyReasonConfirmed` predicate in studyService and the `listFinished` hero in Dashboard.
2. **Node/build:** can you get a **Linux** `node_modules` (fresh `npm install` in a WRITABLE location — `/repo`
   is read-only, so you'd need to copy the tree to a writable dir or install into `/out`) and run `npm run dev`
   (Vite, needs Linux esbuild+rollup) OR `npm run build` + a static serve? What Node version do you have?
3. **Browser:** can you run Playwright with a real Chromium (are browser binaries installable/available headless
   in your container)?
4. **Network / dev server:** can you bind + reach `http://localhost:5173` (or any local port) INSIDE your
   container for Playwright to drive?
5. **Firebase (the likely blocker):** the audits SEED and READ Firestore via `scripts/serviceAccountKey.json`,
   which is **gitignored** — so it is almost certainly NOT in your `/repo` mount. Do you have ANY path to a
   Firebase admin credential for the sandbox? If not, the DATA oracles (csd/twi/recentSessions/sessions) and the
   seeding (recentSessions, list-end fixtures, RA9 anchor) cannot run — which is most of the audit. Confirm
   present or absent.
6. **Egress:** can your container reach the prod Firebase endpoints (Firestore) over the network at all, or is it
   network-isolated?

## What I need back
- A per-item YES/NO with specifics, then `CAN_RUN` (you can execute the full audit, or a defined subset — say
  which scenarios) or `CANNOT_RUN` (+ the blocking items).
- If PARTIAL: which scenarios are runnable without the Firebase admin key (e.g. UI-only oracles) vs which need it.
- If you CAN run it: what you need from me (the harness isn't built yet — the design is `PLAN_reviewonly_playwright_audit.md`;
  I'd build it per §8, or you would). Do NOT start building/running yet — just assess.

This is a go/no-go on WHERE the audit runs. `CANNOT_RUN` is a fine answer — I'll take it back to David.
