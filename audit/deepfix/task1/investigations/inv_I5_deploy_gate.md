# I-5 — DEPLOY GATE: G1 landmine root cause (verified), the fix spec, and the gate every Task-2 deploy must pass

**Author:** I-5 deploy-gate designer (Task 1.6). **Date:** 2026-07-13. **Mode:** READ-ONLY code analysis + design
(no live Firebase, no code changes). **Binding rule (David):** every claim carries {evidence `file:line`, confidence};
all lines re-verified against the CURRENT working tree today unless tagged otherwise.

**Inputs:** CONSOLIDATED_ISSUES.md (C-32/C-36/C-30/C-04/C-09/C-27, X1/X2), CENSUS2_FINDINGS.md §F-9,
scan_F1_FINDINGS.md, SUPPORT_RUNBOOK.md CS-2026-06-29, `functions/index.js`, `src/utils/testRecovery.js`,
`src/pages/TypedTest.jsx`, `src/pages/MCQTest.jsx`, `src/config/featureFlags.js`, `scripts/stamp-build.mjs`,
`firebase.json`, git history.

---

## §1 · Nonce root cause — **CONFIRMED end-to-end** (upgraded from plausible-unverified)

The one G1 leg that was still `plausible-unverified` in C-32 is now fully code-traced. The chain, with every link
verified in the working tree:

| # | Link | Evidence | Conf. |
|---|---|---|---|
| 1 | **Grade-time identity** is derived from the nonce: `gradeAttemptDocId = ${uid}_${testId}_${getOrCreateAttemptNonce(testId)}` — **first call** | `src/pages/TypedTest.jsx:767`; put in `gradeContext` `:768-771`; sent to `gradeTypedTest` at `:668` | high |
| 2 | **Token mint binds that docId into the HMAC**: server signs `{uid, attemptDocId: bindCtx.attemptDocId, classId, listId, testId, testType, totalQuestions, createdAt, rows}` | `functions/index.js:1027-1041` (docId at `:1033`); canonical artifact includes `attemptDocId` at `:115`; HMAC-SHA256 `:125-127` | high |
| 3 | **Save-time identity is RE-DERIVED**, not reused: a **second, independent** `getOrCreateAttemptNonce(testId)` call ~90s+ later (after AI grading) | `src/pages/TypedTest.jsx:869-870`; flows into write `context.attemptDocId` `:895`; token forwarded alongside `:909-912` | high |
| 4 | **Verify recomputes the artifact from the SAVE-time docId**: `verifyGradeToken(secret, {…, attemptDocId: context.attemptDocId, …}, gradeToken)` — constant-time compare | `functions/index.js:489-499` (docId at `:491`); compare `:129-135` | high |
| 5 | **Under ENFORCED, mismatch ⇒ permission-denied**: `if (GRADE_TOKEN_ENFORCED && context?.testType === "typed" && !tokenOk) throw HttpsError("permission-denied", …)`; plus the writer-API guard | `functions/index.js:511-513`; guard `:392-399`; flag `:58` (`= true` in HEAD) | high |
| 6 | **The divergence condition**: `getOrCreateAttemptNonce`'s catch-fallback returns a **FRESH per-CALL** nonce whenever localStorage throws (in-app webview storage-denied ⇒ `getItem` throws; private-mode/quota ⇒ `setItem` throws). Its own comment ("in-memory nonce") is wrong — nothing is retained; two calls ⇒ two nonces | `src/utils/testRecovery.js:98-111`, catch `:106-110` (`return \`${Date.now()}_${Math.random()…}\``) | high |
| 7 | ⇒ link 1 mints token over docId **A**, link 3 saves under docId **B** ≠ A ⇒ HMAC mismatch (link 4) ⇒ reject (link 5). **"Retry Save" can never fix it**: the retry closure re-sends the SAME captured docId + SAME token (never re-grades) ⇒ deterministic re-failure | `src/pages/TypedTest.jsx:875-955` (closure capture; `pendingSaveRef` `:949-950`) | high |
| 8 | **Empirical match (06-29 outage)**: 128 `attempt_write_failed_client` in 18h, **118 = permission-denied "requires a valid, fresh server grade token"**; "Retry Save did not fix it"; **"Confirmed via prod data: 4 students re-graded the SAME test under diverging nonces"**; mitigated by hand-deploying `GRADE_TOKEN_ENFORCED=false` ~11:14 KST | `SUPPORT_RUNBOOK.md:113-116` | high (V-data, prior) |
| 9 | **Prod still runs the mitigation**: recent-21d attempts 77% `correctnessSource:null` (gate-off signature) + 96% `writtenBy:cloud-function` | `audit/deepfix/task1/firebase/CENSUS2_FINDINGS.md:39-48` (F-9) | high (V-census) |

**Verdict: CONFIRMED.** When localStorage is unavailable, grade-docId ≠ save-docId → HMAC mismatch → under
`GRADE_TOKEN_ENFORCED=true` every typed save from that client environment is permission-denied and unretryable =
the 06-29 outage mechanism. C-32's nonce leg moves to **verified-evidence**.

Sharpening (new, load-bearing for the fix):
- **The bug is literally the double call.** TypedTest derives the identity twice (`:767` and `:869`);
  **MCQTest derives it once and reuses the variable** (`src/pages/MCQTest.jsx:601-602`) — so MCQ is structurally
  immune within a submit. Even with permanently broken storage, reusing the `:767` value at `:869` would keep
  grade/save consistent for the whole flow. {evidence above, confidence high}
- The fallback's comment ("submission still works, just non-idempotent", `testRecovery.js:108`) records its design
  era: the nonce was an idempotency nicety. G2 made docId-stability **correctness-critical** (HMAC-bound) without
  hardening the fallback — that is the root cause in one sentence.
- **Not a leg (checked and ruled out):** mid-flow expiry-clear. `getTestState` (which clears the nonce on expiry,
  `testRecovery.js:59-62` → `clearTestState` `:76-83`, nonce removal `:79`) is called only at mount
  (`TypedTest.jsx:257`) and in explicit user actions (`:539`, `:553`); the success-path clear (`:802`) runs only
  AFTER the write. No call sits between grade and save. {confidence high}
- **Secondary (real but minor) leg:** multi-tab — tab A completes and rolls the nonce (`:802` → `testRecovery.js:79`);
  tab B graded under the old nonce, saves under a fresh one ⇒ same rejection. Fix legs below cover it. {confidence medium}
- **MCQ is unaffected by enforcement** (typed-only condition at `functions/index.js:511`, no token sent at
  `MCQTest.jsx:635`). The landmine's blast radius is typed tests — i.e. the whole graded cohort. {confidence high}
- **Git corroboration:** `GRADE_TOKEN_ENFORCED = true` was committed **2026-06-27** (`4b82a0a`) — two days BEFORE
  the outage. Prod's `false` is the 06-29 hand-flip, deployed but **never committed back**; the repo has carried the
  armed value ever since. Repo↔prod are inverted on the single most dangerous flag. {evidence `git log -S`, confidence high}

## §2 · The FIX (design now; implement in Task 2 — app source)

Four legs, smallest-diff order. Together they make grade-docId == save-docId **by construction**, independent of
client storage.

**F1 — Single identity per submit flow (client, one-line class).**
Compute `attemptDocId` ONCE at the top of `handleSubmit` (before grading); use that variable for BOTH
`gradeContext.attemptDocId` and the write `context.attemptDocId`. Delete the second derivation at
`TypedTest.jsx:869-870` (replace with `const attemptDocId = gradeAttemptDocId`). This alone closes the primary leg
(both 06-29 legs happen inside one `handleSubmit` invocation). Mirrors MCQTest's existing single-derivation shape
(`MCQTest.jsx:601-602`).

**F2 — Submit with the SERVER-RETURNED attemptDocId (authoritative echo).**
- Server: the grade-only return payload currently omits the bound docId — `functions/index.js:1051-1052` returns
  `{results, gradeToken, gradeTokenCreatedAt}`. Add `attemptDocId: bindCtx?.attemptDocId ?? null` (and include it in
  the cached grading-job payload persisted at `:1053-1054`, so recovery paths `tryRecoverGrade`/`pollForGrade` —
  `TypedTest.jsx:610-632` — return it too; the job is already keyed on the same id, `functions/index.js:972`).
- Client: at write time, `context.attemptDocId = gradingResult.data?.attemptDocId ?? attemptDocId` — the id the
  token was actually minted against always wins. If the local value differs, log a `nonce_identity_divergence`
  system event (it should be impossible after F1; the log is the tripwire).
- This is the invariant the whole G2 scheme needs: **the client never regenerates the identity after the mint.**

**F3 — A nonce that survives the grade→save gap (and refresh), never per-call.**
Rewrite `getOrCreateAttemptNonce` (`testRecovery.js:98-111`) as a layered store with per-testId memoization:
1. module-level `Map<testId, nonce>` — checked first, always writable (single-instance per page load);
2. `localStorage` (survives tab close within the recovery window) with `sessionStorage` fallback (survives refresh
   in-tab; available in most storage-restricted webviews);
3. on ANY storage failure, **memoize the minted nonce in the Map and return the same value on every subsequent
   call** — the catch must never mint per-call again.
`clearTestState` (`testRecovery.js:76-83`) also deletes the Map entry so the success-path rollover still yields a
fresh docId for the next attempt. Degraded-storage behavior becomes: idempotent within the page load (covers
grade→save and Retry Save), non-idempotent only across a full reload after a completed grade — which F2's echo +
the server-side pre-write idempotency read (`functions/index.js:466-467`, `:960-965`) already absorb.

**F4 — Observability before re-arm.**
- Client: emit `nonce_storage_degraded` (once per session) when layer-2 persistence fails → measures the
  webview/private population BEFORE enforcement is re-armed.
- Server: when `tokenOk === false` under enforcement, log `{uid, attemptDocId, reason}` before throwing at
  `functions/index.js:511-513` (today only the exception path at `:500-505` logs) — makes any future divergence
  queryable by signature instead of re-running the 06-29 forensics.

**F5 — Acceptance (gates the re-arm; see §3 sequencing).**
Playwright/emulator run with `Storage.prototype.getItem/setItem` stubbed to throw (the webview simulation):
typed grade→save round-trip must succeed with `GRADE_TOKEN_ENFORCED=true`, written doc has
`correctnessSource:'server-ai'` and `attemptId ==` the token-minted docId. Plus: Retry-Save-after-write-failure
path, and the two-tab scenario. Re-arm order: **client fix deploys and soaks first** (0 permission-denied
`attempt_write_failed_client`, `nonce_storage_degraded` volume known) → flip `functions/index.js:58` true in its
own commit → quiet-window functions deploy → immediate §3-G2 assert + live typed smoke.

## §3 · THE DEPLOY GATE — checklist every Task-2 deploy MUST pass

**G0 — Commit before deploy.** The tree currently carries the **uncommitted #11 fix**
(`src/services/studyService.js`, `src/pages/DailySessionFlow.jsx`, `src/pages/Dashboard.jsx`; +119/−23 by
`git diff --stat`) among 222 dirty paths. Deploying now would stamp `dirty:true` (`scripts/stamp-build.mjs:31-32`)
and the recorded sha would not describe the shipped code. Deploy only from a clean tree; keep the existing
`"Deploying: commit <sha>"` record convention (e.g. `a967f54`, 2026-07-12). {confidence high}

**G1 — Flag-value assertion table.** Assert IN THE SOURCE at build time (grep, not memory), every deploy:

| Flag | Defined at | HEAD value today | REQUIRED at next deploy | Why |
|---|---|---|---|---|
| `GRADE_TOKEN_ENFORCED` | `functions/index.js:58` | **true (ARMED)** | **false** — until §2 F1–F5 shipped, soaked, acceptance-passed | Deploying functions as-is re-arms the 06-29 outage (§1; F-9) |
| `GRADE_TOKEN_MINT` | `functions/index.js:68` | true | true | Additive-only (client ignores unused token); keeps round-trip testable |
| `GRADE_JOB_ENABLED` | `functions/index.js:90` | true | true — but a DELIBERATE activation: first functions deploy turns on the grading-job path; smoke immediately (`GRADE_JOB_LEASE_MS=180000`, `:95`) | New live path in prod |
| `SERVER_ATTEMPT_WRITE` | `src/config/featureFlags.js:10` | true | true | Matches prod (F-9: 96% `writtenBy:cloud-function`) — no posture change |
| `LIST_SCOPED_RECON` | `src/config/featureFlags.js:41` | true | true | Matches prod (F-9: 853 `csd_twi_reconciled` logs); the #9/#11 fixes are flag-gated on it |
| `SERVER_CHALLENGE_WRITE` | `src/config/featureFlags.js:20` | false | false — until W1 fn deployed + validated (PLAN_attempt_write_lockdown W1) | Flag-on without the fn live breaks challenge submission |
| `SERVER_REVIEW_MARKER` | `src/config/featureFlags.js:28` | false | false — until W2 fn live + validated; **must be true BEFORE any W3 rules deploy** (X1 ordering) | Else Day-2+ empty-review completion breaks under `create:false` |

Also: `firestore.rules` stays OUT of deploy scoping until the W-plan executes (W3 is deliberately staged as
`docs/plans/W3_attempts_lockdown.rules.md`, per C-29). Always deploy with explicit `--only` targets — never bare
`firebase deploy` (which would ship functions + rules + hosting together and re-arm G1 as a side effect).

**G2 — Post-deploy provenance assert (functions deploys).** Call `exports.version`
(`functions/index.js:1900-1912`) and assert: `sha == git rev-parse HEAD` of the deployed repo, `dirty == false`,
and `flags{GRADE_TOKEN_ENFORCED, GRADE_TOKEN_MINT, GRADE_JOB_ENABLED, GRADE_JOB_LEASE_MS}` equal the G1 table.
**Bootstrap caveat:** `version` is NOT yet live in prod — F-9 had to infer the flags from attempt data because the
probe doesn't exist there. So the FIRST functions deploy both delivers the probe and must itself be verified
out-of-band: repeat the F-9 read (new attempts' `correctnessSource` must stay null while ENFORCED=false) + check
the cold-start log (`functions/index.js:34` logs `BUILD_INFO`). North-star N6: provenance **consulted**, not just
built — G2 is the consult step, wired into the deploy runbook, not optional.

**G3 — Stamp predeploy active.** `firebase.json:40-43` runs `node scripts/stamp-build.mjs` (+ lint) on every
functions deploy; `functions/index.js:28-34` loads `buildInfo.json` into `BUILD_INFO`. Verify the stamp file is
regenerated in the deploy log (`[stamp-build] wrote functions/buildInfo.json`, `stamp-build.mjs:38`).
**Known gap:** hosting has NO predeploy and NO client build stamp (`firebase.json:2-11`) — client provenance is
behavioral-only today. Interim check for hosting deploys: fetch the deployed bundle and grep for a fix-unique
string (e.g. C-27's "Couldn't Grade — Please Reload", `TypedTest.jsx:1755`). File a client build-stamp
(commit sha baked into the bundle + surfaced in an admin/console probe) as Task-2 work. This gap is live:
commit `a967f54` records deploying the #10 fix on 07-12 18:46 KST, yet F-1 shows `day_guard_rejected` still firing
on 07-13 (7 events) — stale cached bundles, an incomplete deploy, or a sibling path; **currently undecidable
precisely because hosting has no provenance**. {evidence `scan_F1_FINDINGS.md:6-16` + git; confidence high that it's
undecidable, no claim which}

**G4 — Data gates around the deploy.**
- `node scripts/cs/data-integrity-sweep.mjs` (26SM) BEFORE and AFTER (SUPPORT_RUNBOOK standing rule).
- Re-run the F-4 H/P/B partition (`scripts/cs/deepfix-census2.mjs`) before/after (X5): expected motion = B shrinks
  as the #11-wall population (183+, growing) unfreezes; `csd_anchor_invalid` stays 0.
- **C-38 pre-req:** teach the sweep the `reviewOnlyDay` marker BEFORE the hosting deploy, or it will flag every
  legitimate review-only completion (current benign noise floor: 31 `reviewNoNewPass`).

**G5 — Watch window + staged rollback.** First 60 min post-deploy, watch `system_logs` for:
`attempt_write_failed_client` with permission-denied (the 06-29 signature — baseline was 118/18h; alert at >3/30min),
`grading_attempt_failed`, `day_guard_rejected_session_cleared` (should trend to 0 for updated clients after the
hosting deploy — F-1 baseline 29 events/6 real students), `csd_anchor_invalid`. Rollback pre-staged: hosting →
redeploy previous bundle; functions → flip the const + redeploy (the const IS the kill-switch,
`functions/index.js:86-90`).

## §4 · The specific #9/#10/#11/C-27 deploy — safe vs gated

**SAFE TO SHIP NOW — hosting-only (`firebase deploy --only hosting`), G1 not touched.** All four fixes are
client-bundle-only (`src/`); a hosting deploy runs no functions predeploy and cannot change the live
`GRADE_TOKEN_ENFORCED=false` posture:

| Item | Fix location (verified today) | Commit state |
|---|---|---|
| #9 / C-04 spurious cross-class retake | `src/services/studyService.js:247-274` (REVIEW_STUDY resume zeroes `nwCount`, preserves anchor range); `src/services/db.js:3402-3443` (list-scoped, position-matched review pairing) | committed `1c91466` |
| #10 / C-30 day-guard self-race | `src/pages/TypedTest.jsx:983-985` + `src/pages/MCQTest.jsx:722-724` (pure `getClassProgress` snapshot read under flag) | committed `14e49a4` (deploy recorded `a967f54` — verify via G3, see caveat there) |
| #11 / C-09/C-10 review-only deadlock | `src/services/studyService.js:1333-1335` (`reviewOnlyDay` predicate), `:1339-1342` (wordsIntroduced clamp), `:1430` (gate bypass); `src/pages/DailySessionFlow.jsx:824-834` (list-end terminal, completes without recording); Dashboard finished-hero | **UNCOMMITTED** (the 3-file diff in G0) — commit first; shipping is X2's decision point (183+ students unfreeze) |
| C-27 grading-error modal | `src/pages/TypedTest.jsx:105-106` (`gradingErrorKind`), `:595-596` (deterministic-error classifier), `:1755` (de-alarmed titles + reload guidance) | committed (last TypedTest change `14e49a4`) |

Why the HEAD client bundle is safe against OLD prod functions (graceful-degradation check, all verified):
`getGradingStatus` calls are try/catch-wrapped → null if the callable doesn't exist in prod
(`TypedTest.jsx:601-608`); `pollForGrade` only triggers on `functions/aborted`, which pre-job prod never throws
(`:700-709`); `gradeContext` is an ignored extra param to an old `gradeTypedTest`; absent `gradeToken` → client
forwards null (`:909-912`) → prod `ENFORCED=false` ignores it; `markReviewComplete`/`submitChallenge` are never
called (flags false, `featureFlags.js:20,28`). `LIST_SCOPED_RECON`'s required composite indexes are proven live in
prod (853 `csd_twi_reconciled` events, F-9). {confidence high}
**Caveat:** hosting ships the ENTIRE bundle at the deployed commit, not just these four — the prod client's current
commit is unknowable (G3 gap), so diff-review the full client delta as part of the pre-deploy review.

**GATED — any `functions/index.js` deploy re-arms G1.** Before ANY functions deploy: the one-line disarm
`functions/index.js:58` → `false` (G1 table). **Recommendation (N5):** flip it in-tree NOW, in its own commit —
"no armed flag whose failure mode is unpatched" is violated by the repo itself today (armed since `4b82a0a`,
06-27, pre-outage); the safe value should be the default and the re-arm should live in the same review as the
validated §2 fix, not in a checklist row someone must remember. Optional hardening: promote the three
GRADE_TOKEN/JOB consts to runtime params (`defineBoolean`/env) so flag flips stop requiring code edits and
`version` keeps reporting them. A functions deploy also newly activates `GRADE_JOB_ENABLED=true` and delivers
`exports.version` + `markReviewComplete` + the challenge fn — each gets the G5 smoke; ENFORCED is the only
outage-class item among them.

## §5 · Claims ledger (delta to CONSOLIDATED_ISSUES)

1. C-32 nonce mechanism: **plausible-unverified → verified-evidence** (§1 trace, links 1–7 all working-tree
   `file:line`; empirics links 8–9). Confidence high.
2. New sharp finding: divergence exists because TypedTest derives the identity TWICE (`:767`, `:869`) while MCQ
   derives once (`MCQTest.jsx:601-602`) — F1 is a two-line fix. Confidence high.
3. New: repo has carried the ARMED flag since 06-27 (`4b82a0a`), i.e. before the outage; prod's `false` was never
   committed back — repo↔prod inverted on the most dangerous flag (C-36's thesis, concretized). Confidence high.
4. New: hosting deploys have zero provenance (`firebase.json:2-11`); the a967f54-deploy-record vs F-1 07-13
   day_guard events tension is undecidable without it → client build stamp filed as Task-2 work. Confidence high
   (that it is undecidable).
5. Correction to my brief: #9/#10/C-27 are COMMITTED (`1c91466`/`14e49a4`), not uncommitted; only #11 remains
   working-tree-only. "Fixed-in-tree-UNDEPLOYED" stands for all four w.r.t. prod behavior (F-1/F-9). Confidence high.
