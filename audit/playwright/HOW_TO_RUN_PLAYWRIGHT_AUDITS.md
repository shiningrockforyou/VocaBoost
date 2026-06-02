# How to Successfully Launch Playwright Audits (vocaBoost)

Hard-won setup notes. The early runs lost a lot of time to environment/config issues; this captures what actually works so the next run starts clean. Written 2026-06-01.

---

## 0. The one-paragraph version
Run scripts **from `/app`** (cwd), write them as **`.mjs`** (the repo is `type:module`), launch **your own headless Chromium** at the pinned path (NOT `mcp__playwright__*`), reach the app by **loading `/` then client-routing** (never deep-link `goto` a route — Netlify 404s), **type char-by-char** (never `.fill()` on test inputs), use the **Admin SDK READ-ONLY**, and **verify everything against Firestore by identity (wordId) — never by position**. Always `browser.close()` in `finally`.

---

## 1. Environment (the things that bit us first)

| Thing | Value / rule | Failure if you get it wrong |
|---|---|---|
| Working dir | Run node FROM `/app` | `/tmp` scripts → `Cannot find module 'playwright'` / MODULE_NOT_FOUND |
| Module type | `/app/package.json` is `type:module` → write **`.mjs`**, use `import` not `require` | `require()` of a project `.js` returns `{}` silently; CommonJS in `.js` errors |
| Chromium binary | `executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome'` + `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` | "browser not found"/download attempts |
| Playwright pkg | `@playwright/test@1.60.0` (already installed under /app/node_modules) | version drift |
| Browser tool | Launch your OWN `chromium.launch({headless:true, executablePath})`. Do NOT use `mcp__playwright__*` for batch runs | MCP tool is for one-off interactive checks, not fan-out |
| Cleanup | `await browser.close()` (and close every context) in a `finally` | ~hundreds of leaked chrome procs; memory creep (sandbox tolerated it, but don't rely on that) |
| Build/parse checks | `node --check` CANNOT parse JSX (throws ERR_UNKNOWN_FILE_EXTENSION). Use `esbuild.transformSync(src,{loader:'jsx'})`. Full `vite build` is unrunnable in-sandbox (missing `lucide-react` dep + `.vite-temp` EACCES) — don't treat its failure as your bug | false "build broken" alarms |

## 2. Reaching the app (Netlify SPA gotchas)
- **Never `page.goto()` a deep route** (`/session/..`, `/typedtest/..`, `/login`). Netlify served a SPA-404 for direct deep links historically. Instead: `goto('/')` then **client-side navigate** (click/links). (A `_redirects` SPA fallback is now deployed, so deep links 200 today — but the load-root-then-route pattern is still the safe default.)
- **Login** (`e2e/audit/helpers/auth.js → loginAs(page, personaId, opts)`): it loads `/` (`waitUntil:'domcontentloaded'`), waits for the email field, fills email+password, and **presses Enter on the password field** — because the submit button is labelled **"Continue"**, not "Log in". Post-login lands on `/`. Reuse this helper; don't hand-roll login.
- Reach a test via the in-app path: study → "Go to Test", or the **session menu → "Skip to Test"** (aria-label "Session menu"). NOTE: "Skip to Test" bypasses the study→test phase transition — fine for grading checks, but it does NOT write the `lastPhase:NEW_TEST` recovery marker, so use the real study flow when testing crash-recovery.

## 3. Driving the UI (input realism)
- **Type char-by-char** (`pressSequentially` / per-char), **never `locator.fill()`** on test answers. `.fill()` bypasses the React onChange cascade and hides real bugs. (See `e2e/audit/helpers/personas.js` — it explicitly bans fill.)
- The typed test renders **all questions on one page** (not one-at-a-time); fill each input then click "Submit Test".
- First session shows a **"Customize Your Flashcards" modal** (fixed `inset-0 z-50` overlay) that blocks clicks until dismissed ("Start Studying"). Pre-seed `localStorage` (`vocaboost_showKoreanDef=true`, `vocaboost_showSampleSentence=true`) or click through it, or every click times out.
- **H2 "stale Step-5 / Resume" screen:** on session re-entry the app may show the prior day's complete/resume modal. Detect it and click "Move On to Next Day" (clears session state), then re-enter — else you log a no-op day. Use a **fresh browser context per session** to avoid context-level stale state.
- Real typed grading is a live Cloud Function (~15–20s/call, Claude Haiku 4.5) — budget time; batch where possible.

## 4. Longitudinal walks (multi-day) — the Date shim
- The dashboard's "already studied today" check uses `new Date()` (not just `Date.now()`). To walk many study-days fast, inject a FULL Date-constructor shim via `context.addInitScript()` BEFORE navigation, on EVERY fresh context: override both `new Date()` (no-arg) and `Date.now()` to an advancing fake clock; keep `new Date(arg)` real. (Reference implementation: `e2e/audit/B27/run_walk20.mjs`.) Shimming only `Date.now()` is NOT enough.
- CSD advances on completion unconditionally (no server once-per-day gate) — but the persona must ANSWER CORRECTLY to pass the threshold, or the day correctly won't advance.

## 5. Data + verification discipline (this is where most false findings came from)
- **Admin SDK READ-ONLY.** `scripts/serviceAccountKey.json`, project `vocaboost-879c2`. NEVER write domain docs (attempts/study_states/class_progress/members) from the harness — fabrication created orphan docs and 5 false positives early on. State advances ONLY through the real UI so the app writes correct keys.
- **Verify by IDENTITY, not position.** The decisive lesson: checking review words by list-position gave false positives in BOTH directions. Compare the word the UI ACTUALLY served (`wordId`) against its OWN pre-session `study_state` (status + returnAt). Helper: `e2e/audit/helpers/expectedWords.js` → `checkReviewWords({presentedWordStates, segment, nowMs})` and `checkNewWords`.
- **Use POST-test TWI for segment math.** Read `class_progress.totalWordsIntroduced` AFTER the new-word test completes before computing the review segment — pre-test TWI produced dozens of false "not in eligible pool" violations.
- **Admin SDK bypasses security rules** — so it can verify data but CANNOT test rule enforcement or function authorization. For those, drive a REAL authenticated client (firebase web SDK signInWithEmailAndPassword + httpsCallable), e.g. the join-class and renameStudent e2e tests.

## 6. Orchestration (fan-out)
- Concurrency ~4 browser agents at a time was comfortable on ~8–10GB free RAM; 10 concurrent ran but watch memory.
- One driver per persona/account; dup-guard prompts to avoid double-launching.
- Agents write findings + JSONL logs to `audit/playwright/findings/` and `findings/agent_logs/<LABEL>.{jsonl,status.json}` — `mkdir -p` first. Don't write to `/app/agent_logs`.
- Agent JSONL transcripts are NOISY — trust the findings file + verify against Firestore, not the raw log.
- Lost findings-file writes happened a few times — reconstruct from the STATUS BLOCK + evidence if a file goes missing.

## 7. Verifying a deploy actually landed (don't assume)
- git push ≠ deployed. Web app → Netlify build; **Cloud Functions need `firebase deploy --only functions`**; **firestore.rules need `firebase deploy --only firestore:rules`** — none triggered by a plain push.
- Confirm web: fetch `https://vocaboostone.netlify.app/` → read the `assets/index-*.js` hash → grep the bundle for a code signature of your fix (comments are minified away — search the CODE pattern). An OLD hash that now 404s means you're querying a stale URL.
- Confirm a Cloud Function: POST its prod URL unauthenticated — a DEPLOYED callable returns `401 UNAUTHENTICATED` (its own auth guard); a missing one returns 404.
- **This sandbox cannot push/PR or run `firebase deploy`** (no creds, no `gh`/`firebase` CLI authed). Deliver patches; the human deploys. After they push, the sandbox auto-syncs to origin/main.

## 8. Repeatable assets (already built — reuse, don't rewrite)
- `e2e/audit/helpers/auth.js` — loginAs (warm-root → /login → Continue).
- `e2e/audit/helpers/expectedWords.js` — identity-based checkReviewWords / checkNewWords / intervention model.
- `e2e/audit/helpers/{personas,firestore,evidence,network,state,time}.js` — answer transforms, read-only Firestore queries, evidence capture, fault injection, state, time helpers.
- `e2e/audit/B27/run_walk20.mjs` — full longitudinal driver: Date-constructor shim, H2 Move-On handling, fresh-context-per-session, Skip-to-Test. Best starting template for a new walk.
- Patterns: VERIFY (deploy-gate on bundle signatures → lazy pool-collapse + careful past-day-16); RECOVER3 (persistent context to preserve localStorage across a simulated crash + real study→test flow); join-class / renameStudent (real authenticated client to test rules/function authorization).

## 9. Common failure → fix quick-reference
- MODULE_NOT_FOUND → run from /app, use .mjs.
- helper import returns `{}` → it's `require` on an ESM file; use `import`.
- click times out on session start → "Customize Flashcards" modal not dismissed.
- every "day" is a no-op → H2 stale Step-5; Move On + fresh context.
- CSD won't advance in a walk → shimmed only Date.now(), not `new Date()`.
- review-word "violations" that vanish on recheck → position-based check and/or pre-test TWI; switch to identity + post-test TWI.
- "build is broken" → it's the sandbox's missing lucide-react/vite-temp, not your edit; parse with esbuild instead.
- edit "saved" but not in the file later → linter/reload silently reverted it (happened on HeaderBar/App/DailySessionFlow); ALWAYS re-grep before generating a patch.
