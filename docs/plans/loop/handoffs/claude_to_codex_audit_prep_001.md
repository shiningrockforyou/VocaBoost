# Claude → Codex: PREP your environment to run the review-only Playwright harness (do this WHILE you wait)

> **TASK = REVIEWONLY_AUDIT_PREP.** I am BUILDING the harness now (per `PLAN_reviewonly_playwright_audit.md` §8).
> While you wait for me to hand you the built harness for review, get your Windows environment READY to run it.
> Write your readiness report to `/out/reviews/codex_review_audit_prep_001.md`
> (my-side `docs/plans/loop/codex_reviews/codex_review_audit_prep_001.md`), ending `READY` or `NOT_READY` + gaps.

## Do NOW (all safe: read-only / install-only — do NOT run the audit, do NOT seed, do NOT drive sessions)
1. **Playwright browsers:** confirm a runnable Chromium. If missing, `npx playwright install chromium` (+ deps).
   Report the resolved browser + version. (You said Chromium is cached — just verify it launches headless.)
2. **npm deps:** confirm `node_modules` resolves for the harness deps actually used by `audit/playwright/*.mjs`
   — `playwright`, `firebase-admin`. Do NOT reinstall the whole tree (your Windows binaries are correct); only
   add anything genuinely missing. Report versions.
3. **Dev server smoke (start, confirm, then STOP):** `npm run dev`, then `curl`/GET `http://localhost:5173/` —
   confirm it returns the SPA shell (this also proves my uncommitted Phase-1 code COMPILES under Vite). Then
   STOP the server again — David will authorize the real run separately. Report: did it serve? any Vite compile
   errors in `src/services/studyService.js` / `src/pages/DailySessionFlow.jsx` / `src/pages/Dashboard.jsx`?
4. **Firestore egress preflight (READ-ONLY, SANDBOX-ONLY):** using `scripts/serviceAccountKey.json`, do ONE
   minimal read to prove the Admin SDK + network egress work — e.g. read a `25WT`-prefixed class doc, or
   `db.collection('classes').where('name','>=','25WT').limit(1).get()`. **NO writes. NO 26SM. NO real students.**
   Report: Admin SDK initialized? egress OK? a sandbox doc readable?
5. **Env vars:** confirm you can set `LSR_BASE_URL=http://localhost:5173` for the run.

## Hard constraints (safety — this is the LOCAL-ONLY cycle; live has active 26SM students)
- Target is ONLY `http://localhost:5173`. NEVER the live Netlify site. NEVER deploy.
- Sandbox identities ONLY (`lsr_*@vocaboost.test`, `25WT` classes). NEVER touch `26SM` / real students.
- This is PREP only — do NOT run any audit scenario, do NOT seed fixtures, do NOT drive a session yet.

## Report back
Per-item YES/NO + versions/details, then `READY` (env can run the audit once I hand you the harness) or
`NOT_READY` (+ exactly what's missing). After you report, hand the baton back; I'll send the built harness for
your CODE review (the loop-until-converge round) once it's done.
