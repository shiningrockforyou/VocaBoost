# CODEX RUNBOOK — running the deepfix Playwright audit (Task 6, before deploy)

**Audience:** Codex, on David's Windows env (the RUNNER — this WSL can't run Vite/Playwright).
**Certifies:** the implemented phases of `audit/deepfix/task2/FIX_PLAN.md` per `audit/deepfix/task4/AUDIT_DESIGN.md`
(83 scenarios, 6 matrices). **Gate position:** this run happens AFTER implementation and BEFORE David deploys —
its ALL-CLEAN program certification is the deploy gate. Fail-closed: **INVALID ≠ PASS**; any FAIL/INVALID/anomaly
in any matrix = no certification.

> **Status:** SCAFFOLD. Environment / discipline / logging / gate sections below are FINAL. The per-matrix
> invocation table is filled in as each Task-5 module lands (build order in `HARNESS_BUILD_PLAN.md`). Do not run
> until this banner is removed and the ★ decision below is resolved.

---

## ★ RESOLVED (David 2026-07-14): M-CALL + M-RULES run against the FIREBASE EMULATOR
The foundation flags are **build-time constants**, and prod runs them **OFF**. Client matrices (M-UI/M-WB/M-MIG)
run against **localhost:5173 + the 25WT sandbox** (as the existing `lsr_*` harness does). The **callable** matrix
(M-CALL: `completeSession`/`resolveListProgress`/`resetProgress`/override/reviewChallenge) and the **rules** matrix
(M-RULES: the P6/P10 cutoff denials) run against the **Firebase EMULATOR SUITE** (functions + firestore + rules,
flags ON, seeded with sandbox fixtures) — zero prod risk, no deploy.

**CONFIRMED execution model (Codex Task-6 probe — `docs/plans/loop/codex_reviews/codex_deepfix_task6_emulator_probe_001.md`):**
Codex proved the emulator VIABLE on the Windows env and pinned the exact model the two matrices are built to
(`audit/playwright/lsr_deepfix_{callable,rules}.mjs`, shared plumbing `lsr_deepfix_emu.mjs`):
1. Run each matrix as the CHILD of `firebase emulators:exec --only functions,firestore,auth --project demo-vocaboost
   "node <matrix>.mjs <runId>"` — **sequential, never parallel** (parallel emulators EADDRINUSE on 9099/8080).
   Set `CI=true FIREBASE_CLI_DISABLE_UPDATE_CHECK=true NO_UPDATE_NOTIFIER=1` (the flag-on `--exec` wrapper sets these).
2. **Seed** with the **Admin SDK** (routes at the emulator via the `FIRESTORE_EMULATOR_HOST` /
   `FIREBASE_AUTH_EMULATOR_HOST` that `emulators:exec` sets) — **NOT the Web SDK** (Codex: it hung + timed out).
3. **M-RULES:** create Auth-emulator users via REST (`accounts:signUp`→ID token; teachers get the P10d custom claim
   `{role:'teacher'}` via Admin then re-`signInWithPassword`), then Firestore **REST** with `Authorization: Bearer
   <token>` → assert **EXACT status codes** (403 = denied forgery, 200 = allowed happy path).
4. **M-CALL:** POST the functions-emulator callables with the **callable-protocol JSON** (`{data:{…}}`) + Auth bearer
   tokens (`http://127.0.0.1:5001/demo-vocaboost/us-central1/<fn>`) → assert the response + side-effect oracles.

Both matrices **REFUSE to run unless `FIRESTORE_EMULATOR_HOST` is set** (INVALID + nonzero exit — never prod), enforce
the `lsr_*@vocaboost.test` / `25WT` / `lsrlist_` sandbox-identity guard, and bind `runId + git-state + flag-set +
sha256(firestore.rules) + per-scenario verdict` into `findings/deepfix_{call,rules}_<runId>.{json,md}`.

---

## 1. Preflight (all matrices) — cold/missing = INVALID, never proceed
1. **Platform-matched deps:** `npm ci` on Windows (do NOT reuse the WSL `node_modules`); `PLAYWRIGHT_BROWSERS_PATH`
   set; `npx playwright install chromium` done.
2. **Sandbox accounts present:** the `lsr_*@vocaboost.test` roster (provision via `lsr_provision.mjs` if absent);
   `LSR_AUDIT_PW` exported. `scripts/serviceAccountKey.json` present (Admin white-box reads only) — **gitignored,
   never commit**.
3. **BASE guard:** `LSR_BASE_URL` unset or an `http://localhost|127.0.0.1` origin — the import-time guard
   (`lsr_ui.mjs:23-31`) hard-throws on anything else. The live site must be physically unreachable.
4. **Dev server = the FLAG-ON build (load-bearing):** the foundation is dormant behind flags, so you MUST serve a
   build with the target flags ON to exercise it:
   - Set the client flags in `src/config/featureFlags.js` to the target phase set (e.g. `SERVER_PROGRESS_WRITE`,
     `SERVER_REVIEW_MARKER`, `SERVER_CHALLENGE_WRITE`, `LIST_PROGRESS_CANONICAL`, … per the phase under test;
     `CONTINUATION_LINKS` for P8, `cyclingEnabled`-path for P9), and the server `FOUNDATION_FLAGS` in
     `functions/foundation.js` correspondingly for the emulator/test-project functions.
   - `npm run dev` (or a preview of `npm run build`); confirm with `curl -sf http://localhost:5173` returning the
     SPA shell. A cold server = INVALID.
   - **Two-build discipline (from the `lsr_*` harness, Run L vs Run S):** where a scenario asserts flag-OFF
     byte-equivalence (the non-regression rows), run it against a **flag-off baseline build** too; where it
     asserts the new behavior, run against the flag-on build. Record which build each result binds to.
5. **Deployed-sha binding (if any matrix hits deployed functions/rules rather than the emulator):** capture the
   `exports.version` probe `{sha, dirty, flags}` and `sha256(firestore.rules)`; a half-deployed program = INVALID.

## 2. Sandbox discipline (BINDING — data containment)
- **NEVER 26SM.** Only `lsr_*@vocaboost.test` students and `25WT`-prefixed classes/cloned lists.
- Every seed/reset write passes `assertSandboxTriple` (`{studentUid, classId, listId}` all sandbox) — a
  non-sandbox target hard-throws (INVALID).
- M-CALL/M-RULES mint ID tokens ONLY for identity-regex `/^lsr_.*@vocaboost\.test$/` emails and assert every
  request path is sandbox BEFORE sending.
- M-MIG runs the migration with an explicit uid allowlist + `classNameRegex=25WT`; any non-allowlisted doc in the
  `--dry` plan = ABORT. `--commit` only after `--dry` is green (0 asserts-failed AND 0 quarantine).

## 3. Run sequence per matrix (prep → preflight → run[Admin-free browser] → postverify[read-only white-box])
_Commands finalized as each module lands (`HARNESS_BUILD_PLAN.md` build order). Placeholder invocations:_

| Order | Matrix | Command (from `/app`, Windows) | Needs ★ | Artifacts |
|---|---|---|---|---|
| 0 | M-STATIC | `node audit/playwright/lsr_deepfix_static.mjs --target=shipped --run=<id>` | no | `findings/deepfix_static_<id>.{json,md}` |
| 1 | seeds | (library — `lsr_deepfix_fb.mjs`, imported by 2/4) | no | — |
| 2 | M-UI | `node audit/playwright/lsr_deepfix_ui.mjs <runId>` (fleet: `bash lsr_deepfix_fleet.sh`) | no | `findings/deepfix_ui_<id>.json` + screenshots |
| 3 | M-WB | `node audit/playwright/lsr_deepfix_whitebox.mjs <runId>` | no | `findings/deepfix_wb_<id>.json` |
| 4 | M-MIG | `node audit/playwright/lsr_deepfix_migrate_audit.mjs --dry` → (green) → `--commit --confirm-migrate=25WT` | no | `--dry` diff + per-source backups + `findings/deepfix_mig_<id>.json` |
| 5 | M-CALL | flag-on→`emulators:exec`→restore (see **§3a** — one command) | **yes (emulator)** | `findings/deepfix_call_<id>.{json,md}` |
| 6 | M-RULES | flag-on→`emulators:exec`→restore (see **§3a** — one command) | **yes (emulator)** | `findings/deepfix_rules_<id>.{json,md}` |
| 7 | cert | `node audit/playwright/lsr_deepfix_cert.mjs <runId>` | no | `findings/DEEPFIX_AUDIT_CERT_<id>.md` |

## 3a. M-CALL + M-RULES — flag-on emulator choreography (Task-6, the ★ matrices)
These two matrices do NOT touch localhost:5173 or prod. They run **against the Firebase emulator**, flags ON, via a
**disposable flag-on helper** that GUARANTEES a restore. Preflight (before either): Firebase CLI 14.x, Java (Temurin
21 OK), root + `functions/` `node_modules` present, `firebase.json` emulator ports free (auth 9099 / firestore 8080 /
functions 5001). **Run the two SEQUENTIALLY, never in parallel** (Codex: parallel emulators EADDRINUSE).

**The flag mechanism.** The deepfix flags are code constants (OFF). `audit/playwright/lsr_deepfix_flag_on.mjs`
writes the flag-ON state, lets `emulators:exec` load the flag-ON **functions**, then ALWAYS restores (a verbatim
per-file backup + a `finally` + SIGINT/SIGTERM/`exit` handlers; NEVER commits, NEVER leaves flags ON; a LOUD banner +
nonzero exit if restore ever fails, keeping the lock so `--restore` can retry). Per-matrix flag set:
- **`--matrix=call`** flips the server `FOUNDATION_FLAGS` in `functions/foundation.js`
  (`SERVER_COMPLETE_SESSION_ENABLED`, `SERVER_RESOLVE_LIST_PROGRESS_ENABLED`, `SERVER_RESET_PROGRESS_ENABLED`,
  `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED`, `LIST_PROGRESS_CANONICAL`, `ANCHOR_VALIDATION_SHADOW`,
  `ANCHOR_VALIDATION_ENFORCE`, `CYCLING_ENABLED`, `SERVER_REVIEW_CHALLENGE_ENABLED`, `SERVER_OVERRIDE_ENABLED`,
  `TEACHER_IDS_WRITE_ENABLED`) + the client routing flags in `src/config/featureFlags.js` (coherent P10 end-state).
  `functions/index.js` `GRADE_TOKEN_ENFORCED` stays **OFF** (it is secret-backed — see the deferred oracles) unless
  you pass `--grade-enforced` after supplying the emulator grade secret.
- **`--matrix=rules`** makes **no JS edits** — the rules ENGINE loads `firestore.rules` (the working-tree **P10d
  END-STATE**: P6 cutoff + P10c teacherIds read + P10d claim/narrowings), which is the artifact under test. To probe
  an earlier STAGE, add `--rules-stage=p6` (or `p10c`) — the helper copies `audit/deepfix/task3/firestore.<stage>.rules`
  over `firestore.rules` (backed up + restored). M-RULES binds `sha256(firestore.rules)` into its manifest so "which
  rules were tested" is provable.

**Run M-CALL (one command — apply flags → emulators:exec → guaranteed restore):**
```
node audit/playwright/lsr_deepfix_flag_on.mjs --matrix=call --run=<id> --exec \
  "firebase emulators:exec --only functions,firestore,auth --project demo-vocaboost \
     \"node audit/playwright/lsr_deepfix_callable.mjs <id>\""
```
**Run M-RULES (after M-CALL fully exits — sequential):**
```
node audit/playwright/lsr_deepfix_flag_on.mjs --matrix=rules --run=<id> --exec \
  "firebase emulators:exec --only firestore,auth --project demo-vocaboost \
     \"node audit/playwright/lsr_deepfix_rules.mjs <id>\""
```
(The `--exec` wrapper exports `CI=true FIREBASE_CLI_DISABLE_UPDATE_CHECK=true NO_UPDATE_NOTIFIER=1` and propagates the
child's exit code. If you must run the steps manually: `--matrix=call --apply` → the `emulators:exec …` → `--restore`.
`--restore` is MANDATORY and idempotent; a leftover lock means a prior restore failed — resolve before any deploy.)

**Oracles realized vs deferred (M-CALL):** CS-1 (+CS-1e no_evidence), CS-2 day-guard reject, CS-3 idempotent retry,
CS-4a/b/c (3-reason reviewOnlyDay), CS-5 (W2 marker shape + pairing), CS-6f/CS-6v (M4 ENFORCE forged→reject /
valid→pass, via `submitVocabAttempt` MCQ), CS-8a/b/c (resolveListProgress canonical / straggler-hydrate / quarantine),
CS-9 (resetProgress epoch + canonical zero F-3), CS-11m/CS-11a (derivation-mismatch tripwire), OV-1/OV-2/OV-3,
CY-3 (lap-aware M4) are **realized**. **DEFERRED — need emulator secrets:** **CS-7** (nonce F2 `gradeTypedTest`) and
**CS-10** (grading-job 7-transition suite) both require `GRADE_TOKEN_SECRET` + `ANTHROPIC_API_KEY`; CS-10's existing
suite (`dsg-edits/srv_validate/grading_job_tests.mjs`) additionally uses the **Web SDK** (Codex: hangs in the Node
emulator shell) and targets the **live prod project** — run it separately against the deployed functions, not under
the emulator. Both emit **SKIP** rows (SKIP ≠ FAIL, but is surfaced in the manifest). Supply the secrets (and
`--grade-enforced`) to realize CS-7.

**Oracles realized (M-RULES):** RUL-1 (attempt create:false), RUL-2 (answers-update removed), RUL-3 (owner
attempt-delete removed), RUL-4 (client progress writes to class_progress/list_progress/progress_meta denied),
RUL-5 (M8 role split — role-update denied / profile-update allowed), RUL-6 (self-teacher-create denied /
student-create allowed), RUL-7 (owner + teacher-of-record + teacher-claim reads allowed, stranger denied),
RUL-8 (client self-select-teacher denied / provisioned teacher legitimate), RUL-9 (M4 composite — rules arm),
OV-6w (outsider-teacher subcollection write denied — P10d narrowing), OV-6r (teacherIds additive read allowed /
unrelated denied). All are exact-status-code (403/200) oracles.


- All artifacts under `audit/playwright/findings/`. Each matrix writes a **bound JSON** (runId + `git rev-parse HEAD`
  + dirty flag + resolved BASE + the build's flag state + per-scenario `{studentUid,classId,listId}` sandbox triple
  + pre/post `snapshotState` hashes + per-scenario verdict ∈ {PASS,FAIL,INVALID}) — the `lsr_accept_manifest.json`
  binding pattern. Plus a human `.md` table. Plus screenshots on every FAIL/INVALID.
- **Return to Claude (via the baton) the ARTIFACTS**, not just "passed": the JSON manifests + the cert md. A bare
  "42/42 green" is not acceptable evidence — the manifests let Claude H1-verify the run.

## 5. Program certification gate (fail-closed)
- A matrix is **CLEAN** iff every attempted scenario is PASS and zero anomalies (console-error / pageerror / native
  dialog / auth failure / non-allowlisted request-failure). Any INVALID or FAIL or fatal app-health signal → matrix
  NOT-CLEAN.
- **Program certifies** iff ALL six matrices are ALL-CLEAN on the SAME bound deployment/build AND the §6
  not-re-executed ledger (transition-window + live-ops artifacts) is complete. The cert consolidator
  (`lsr_deepfix_cert.mjs`) enforces this and exits nonzero otherwise.
- **Subset runs cannot certify** — the program manifest requires the full §1 enumeration for the shipped phase set.
- **What this audit does NOT do (AUDIT_DESIGN §6):** it never touches live 26SM data; the F-4 H/P/B motion, the
  ≥14-day M4 shadow rate, and the G5 live-watch signals stay David/CS-run (with the MIG-10-audited toolchain). The
  audit certifies the MECHANism + the INSTRUMENT, not the live number.

## 6. Handoff back
On completion, flip the baton with the matrix manifests attached; Claude verifies (H1) and only then is the phase
set cleared for David's deploy. A NOT-CLEAN result blocks deploy and returns the failing scenarios' evidence.
