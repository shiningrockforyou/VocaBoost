# M-WB build notes — deepfix audit harness, WHITE-BOX matrix (Task 5)

**Scope:** the **M-WB** matrix — the un-drivable gate paths + tripwires that need crafted state
(`audit/deepfix/task4/AUDIT_DESIGN.md` §1.B `W-RA3g/W-RA4/W-RA4b`, §1.D `CS-11`, §1.E `CUT-5`/`CUT-6`; §2
fail-closed manifest; §7 "M-WB extends `lsr_reviewonly_whitebox.mjs`"). Built by extending the proven
`lsr_reviewonly_whitebox.mjs` (the sanctioned `page.evaluate` / session-config-patch exception) and mirroring
`lsr_deepfix_ui.mjs`'s `runScenario` loop + manifest + anomaly-gate conventions. **This is TEST code Codex RUNS
FLAG-ON in Task 6** (David's Windows env, per `CODEX_RUNBOOK.md` row 3). It is **un-runnable in this WSL** (9p
mount — no Vite/Playwright); validated here by `node --check`, import-resolution, reuse-correctness, and an
oracle-walk of every row against the live source (event names + emission sites bound below). **No run was
fabricated — execution validation is Codex's Task-6 job.**

## File built
| File | Role |
|---|---|
| `audit/playwright/lsr_deepfix_whitebox.mjs` | M-WB runner. Imports/extends `lsr_ui.mjs` (browser verbs + import-time BASE guard), `lsr_deepfix_fb.mjs` (seeds/oracles/`assertSandboxTriple`, which `export *`s `lsr_reviewonly_fb.mjs`), `lsr_teacher.mjs` (provisioning). Adopts `patchSessionConfig`/`readBlob`/`clearBlob` + the `W-RA3-gate`/`W-RA4`/`W-RA4b` crafts from `lsr_reviewonly_whitebox.mjs`. Writes `findings/deepfix_wb_<runId>.{json,md}`; nonzero exit on any FAIL/INVALID/fatal. CLI: `node audit/playwright/lsr_deepfix_whitebox.mjs <runId>`. Subset via `DFWB_SCENARIOS="…"`. |

**Existing `lsr_reviewonly_whitebox.mjs` was NOT modified** (nor any `lsr_*` or vocaBoost source); `change_action_log.md`
was NOT touched (per the task).

## Scenarios COVERED (6) — oracle ↔ AUDIT_DESIGN row + realizability class
Realizability: **[client]** crafted-state + client render, fully realizable now · **[fns-env]** the oracle rides a
P-phase server callable / flag that needs the FLAG-ON functions env (a dark/flag-off leg self-reports **INVALID
(env)**, never a false PASS) · **[rules-env]** needs the deployed **P6** rules to make the precondition exist.

- **W-RA3g** [client] — reviewOnlyDay:true SKIPS the gate **and** a non-review-only unpassed day still BLOCKS.
  *Positive arm* (adopted from `lsr_reviewonly_whitebox.mjs:129-143`): `seedInterventionWindow` (interv 1.0 → a
  throttle/review-only day) → enter review → complete → oracle `outcome==='results'`, `csd+1`, `twi` FLAT.
  *Negative arm* (new): `resetStudentState` → a fresh new-word day, submit ALL-BLANK → **definitive invariant:
  the day must NOT complete → `csd` FLAT** (the robust oracle; the blocked TEXT corroborates). Gate: `!reviewOnlyDay`
  short-circuit at `studyService.js:1772`; derivation `:1671-1677`.
- **W-RA4** [client] — absent config fails CLOSED. Craft: `clearBlob` (remove `dailySessionState`) on the test route
  → `cfgNewWordCount` undefined → `Number.isFinite(undefined)===false` → `reviewOnlyDay` false → the gate applies.
  Oracle: **`csd` FLAT** (day did not complete) + a retake/rebuild message. Adopted from `:115-124`, strengthened
  with the `csd`-flat invariant.
- **W-RA4b** [client] — a STALE finite `newWordCount:0` must NOT open the gate (ROI-1). Craft (`patchSessionConfig`):
  `newWordCount:0` BUT `allocation.newWords>0` + `isListComplete:false` + `startPhase:'new_words_study'` (≠
  `SESSION_PHASE.REVIEW_STUDY`='review-study', `sessionService.js:29`) → `reviewOnlyReasonConfirmed` FALSE
  (`studyService.js:1671-1674`) → `reviewOnlyDay` FALSE → gate applies. Submit blanks → **`csd` FLAT**. Adopted from
  `:95-111`, strengthened with the `csd`-flat invariant + a readback that `allocation.newWords>0` actually stuck.
- **CS-11** [fns-env] — the `reviewonly_derivation_mismatch` standing tripwire (server leg
  `functions/foundation.js:1225-1233`, logs **WITH `userId:uid`**). *MISMATCH arm*: a GENUINE new-word day (server
  derives `reviewOnlyDay:false`) with the client preview CRAFTED to `reviewOnlyDay:true` (`newWordCount:0` +
  `allocation.newWords:0` → `reviewOnlyReasonConfirmed` TRUE → client short-circuits the gate + sends
  `clientReviewOnlyDay:true`, `studyService.js:1817`, only under `SERVER_PROGRESS_WRITE`) → server disagrees →
  event. *AGREEING arm*: a fresh un-crafted day → client==server → **no** event. Oracle: mismatch arm emits the
  event AND agreeing arm does not. Client sends `clientReviewOnlyDay` only under `SERVER_PROGRESS_WRITE` + the
  deployed `completeSession` tripwire — a dark callable ⇒ no event on EITHER arm ⇒ **INVALID (env)**.
- **CUT-5** [fns-env] — nonce F1+F3 client legs. Craft (`armStorageKill`): patch `Storage.prototype.setItem` (shared
  by BOTH `localStorage` and `sessionStorage`) to THROW once armed — **exactly** the `nonce_storage_degraded`
  trigger (`testRecovery.js:186-196`: persist fails on both layers → `logNonceStorageDegraded` →
  `logSystemEvent('nonce_storage_degraded', …)`, `:29`). The module memo (`:18/146/176`) keeps ONE nonce → graded
  docId == saved docId. Measured: typed grade→save. Oracle (Admin read): **exactly ONE** new attempt doc created
  (`readAttempts.newAttempts` Δ===1 ⇒ graded==saved) + `nonce_storage_degraded` logged + a results screen. **TWO
  docs ⇒ FAIL** (the F1/F3 double-derivation regression, the 06-29 signature). One doc but no degraded event ⇒
  INVALID (event-name/userId/env calibration — oracle deferred).
- **CUT-6** [rules-env] — the denied-legacy-write handler ([C6-2], **DORMANT until the P6 rules cutoff**).
  *Precondition* (`injectDeniedProgressWrite`): via the sanctioned `page.evaluate`, `import('/src/firebase.js')`
  (the SPA's own `db` singleton — Vite dev serves it as an ESM URL) + the SDK, signed in AS the sandbox student,
  attempt a DIRECT client write (a cosmetic `__cut6_probe` merge — cannot corrupt csd/twi) to the student's own
  `class_progress` doc. The deployed **P6** rules (RUL-4) DENY it. If the write is ALLOWED ⇒ pre-P6 env ⇒ the C6-2
  handler cannot be exercised ⇒ **INVALID (env)**. *Measured*: a real typed grade→completion. *Oracle*: a reload
  prompt (`RELOAD_PROMPT_RE`, all sites `TypedTest.jsx:872/1133`, `DailySessionFlow.jsx:886/1573`) + a
  `legacy_write_denied` event + **NO** results screen = **PASS**; a results screen WITH a `legacy_write_denied`
  event = the swallow bug (**FAIL**); a clean results screen with no denial = the server-write path stayed active,
  handler dormant (**INVALID env**).

## Reuse map (AUDIT_DESIGN §7)
| Reused UNCHANGED (imported) | Adopted / adapted from `lsr_reviewonly_whitebox.mjs` | New in this module |
|---|---|---|
| import-time localhost-only **BASE guard** + `makeFindings`/`newAuditPage`/`login`/`joinClass`/`selectList`/`goDashboard`/`driveNewWordsToTest`/`enterReviewSession`/`readTestRows`/`partialAnswers`/`carefulAnswersFrom`/`fillSubmitAndObserve`/`returnFromResultsAndClearCompletion`/`shot`/`sleep` (from `lsr_ui.mjs`); `assertSandboxTriple`/`SANDBOX`/`uidByEmail`/`resetStudentState`/`seedInterventionWindow`/`readProgress`/`readAttempts`/`readSystemLogsSince`/`readListWordCount`/`db` (from `lsr_deepfix_fb.mjs` → `export *` of `lsr_reviewonly_fb.mjs`); `createClass`/`assignList`/`readJoinCode` (from `lsr_teacher.mjs`); the identity guard + `provision` shape | `TEST_ROUTE`, `readBlob`, `patchSessionConfig` (incl. the `__allocationNewWords` nested-merge), `clearBlob`, the `W-RA3-gate`/`W-RA4`/`W-RA4b` crafts | `armStorageKill` (CUT-5 storage stub), `injectDeniedProgressWrite` (CUT-6 injected direct-write via the app's own db), `RELOAD_PROMPT_RE`/`GATE_BLOCK_RE`, the CS-11 two-arm body, the `csd`-flat strengthening of W-RA4/W-RA4b, the deepfix-style fatal anomaly gate + `deepfix_wb_<runId>.{json,md}` manifest + nonzero-exit |

## Sandbox-guard + injected-JS discipline (BINDING — confirmed)
- **Identity guard** (module start): `LSR_TEACHER` + EVERY `SL_STUDENT` must match `/^lsr_.*@vocaboost\.test$/` — a
  non-sandbox teacher OR any non-sandbox student ⇒ **exit 2** (verified in WSL: empty, `@gmail.com` teacher, and a
  mixed student list all exit 2).
- **BASE guard** (import-time, reused): only `http://localhost`/`127.0.0.1` — a live URL throws (verified in WSL).
- **Sandbox triple guard**: every seed/reset write (`seedInterventionWindow`, `resetStudentState`) and the
  `provision` path go through the reused `assertSandboxTriple` (lsr_*@vocaboost.test + `25WT`-prefixed class + its
  assigned clone) FIRST. Classes are named `25WT DFWB <id> <runId>`. **No 26SM path exists.**
- **Injected JS is the sanctioned exception ONLY, confined to crafted preconditions**: `page.evaluate`
  (session-config patch/clear), the `Storage.prototype.setItem` stub (armed only just before submit; **`getItem`
  left intact** so auth/session reads are unaffected), and the injected direct-write (a cosmetic-field merge to the
  student's OWN sandbox doc). **Every ORACLE is observational** — Admin `.get()` reads (`FB.read*`) + visible UI
  text. No forged anchors are written (CS-11's craft lives in `sessionStorage`, never in an attempt doc).

## AUDIT_DESIGN rows I could NOT fully realize here — flagged (INVALID-gated, never a false PASS)
1. **CUT-6 app-handler leg (the load-bearing residual).** A harness-injected direct-write PROVES the P6 rules deny
   a client `class_progress` write, but it does **not** fire the APP's `legacy_write_denied` handler (that reacts
   only to the app's OWN denied completion). Reaching the C6-2 reload-prompt+event requires the **specific env**:
   deployed **P6 rules** AND a **flag-off legacy client-write** completion path (`SERVER_PROGRESS_WRITE` OFF). The
   handler is explicitly DORMANT today (`TypedTest.jsx:1119-1125` comment). So CUT-6 **PASSes only in that env**; in
   the default env it fails CLOSED to **INVALID** (the injected-write denial is the env gate; the server-write path
   ⇒ INVALID). It can never emit a false PASS. **This is the one row whose full oracle is env-deferred to Codex's
   Task-6 rules-cutoff window.**
2. **CS-11 tripwire** is **fns-env-dependent**: the client emits `clientReviewOnlyDay` only under
   `SERVER_PROGRESS_WRITE`, and the event is logged by the deployed `completeSession` callable. If the mismatch arm
   produces no event, the row reports **INVALID (env)** — it does NOT distinguish "flag/callable dark" from a true
   tripwire failure; that distinction is pinned at the flag-on run (a genuine no-event with the callable confirmed
   active ⇒ re-classify FAIL at review).
3. **CUT-5 `nonce_storage_degraded` presence** is **fns-env-dependent** (the dynamic-import logger →
   `logSystemEvent`, keyed on the logged-in uid). The **ONE-docId invariant is the hard oracle** (TWO docs ⇒ FAIL);
   if one-doc holds but the event is absent, the row reports **INVALID** (event-name/userId/env calibration —
   deferred), never PASS.
4. **W-RA3g/W-RA4/W-RA4b visible "blocked" copy** is corroboration only; the **definitive oracle is `csd`-flat**
   (the day did not complete). The exact retake-gate/rebuild strings remain first-run locator tuning.

## First-run CALIBRATION knobs for Codex (design §4 "first-run calibration carry-over")
- **Injection SITE (W-RA4/W-RA4b/CS-11)**: the `page.evaluate` patch must land AFTER `navigateToTest` writes
  `dailySessionState` and BEFORE Submit (on `/typedtest|/mcqtest`). The readback (`patchSessionConfig.back`) + a
  possible post-submit re-read guard an overwrite → **INVALID**, never a false PASS. `startPhase:'new_words_study'`
  only needs to be **≠** `SESSION_PHASE.REVIEW_STUDY` (='review-study') — its exact value is not load-bearing.
- **Storage stub (CUT-5)**: the stub throws on `setItem` for BOTH storages (the exact `nonce_storage_degraded`
  trigger). If the grade→save destabilizes under it, a stricter/looser knob is available (throw on `getItem` too,
  or scope to the `_nonce` key) — kept OFF by default to avoid touching auth reads. A `save-error`/`grading-failed`
  under the stub is treated as a real anomaly (fail-closed), not swallowed.
- **CUT-6 injected-write handle**: `import('/src/firebase.js')` (the SPA `db` singleton) — confirm the module URL if
  the Vite dev graph differs; a handle miss ⇒ INVALID (calibration), not FAIL. The write targets the student's own
  `class_progress` doc (RUL-4 denies it post-P6).
- **Flag env**: CS-11 assumes `SERVER_PROGRESS_WRITE` on + the `completeSession` tripwire deployed; CUT-5 assumes
  the client env reaches the `nonce_storage_degraded` logger; CUT-6 assumes P6 rules deployed AND (for a PASS) the
  legacy client-write completion path. Each dark leg self-reports INVALID.
- **`SL_STUDENTS`** rotate one per scenario (`si % STUDENTS.length`); ≥1 required, ≥3 ideal for full isolation.

## Validation performed in WSL (execution is Codex's)
- `node --check audit/playwright/lsr_deepfix_whitebox.mjs` → **parser-clean** (before and after the `csd`-flat edits).
- Import-resolution probe: all 17 `lsr_ui.mjs` symbols + 3 `lsr_teacher.mjs` + 10 `lsr_deepfix_fb.mjs` symbols
  resolve (FB exposes 43 exports); `SANDBOX.SANDBOX_STUDENT_RE` is a RegExp (`/^lsr_.*@vocaboost\.test$/`).
- **BASE guard** trips on a live URL (`LSR_BASE_URL=https://…` ⇒ throws); **identity guard** exits 2 on empty,
  non-sandbox teacher, and a mixed student list.
- The 6 `WB` scenario keys == `DEFAULT_SCEN` exactly (no unknown-scenario INVALID for the default set).
- Source/event bindings confirmed in-tree: `functions/foundation.js:1225-1233` (`reviewonly_derivation_mismatch`
  WITH `userId`), `src/utils/testRecovery.js:20-35/144-197` (`nonce_storage_degraded`, both-layer trigger + memo),
  `src/pages/TypedTest.jsx:867/1127/1133` + `src/pages/DailySessionFlow.jsx:888/1573` (`legacy_write_denied` +
  reload prompt), `src/services/studyService.js:1652/1671-1677/1772/1817` (client `reviewOnlyDay` preview + gate +
  `clientReviewOnlyDay` send), `src/firebase.js:42` (`export const db`), `src/services/sessionService.js:26-29`
  (`SESSION_PHASE`).
